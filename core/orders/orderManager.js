// core/orders/orderManager.js
import { client } from "../../db/client.js";
import { createOrder } from "./createOrder.js";
import { cancelOrder } from "./cancelOrder.js";
import { readPortfolio } from "../../core/portfolio.js";
// -------------------------------------------------------------
// 1) CREACIÓ D’ORDRES LIMIT + TP/SL ADJUNTS (FIAT‑PRO SPOT)
// -------------------------------------------------------------
export async function managePendingCreation(symbol, price_now, atr, timeframe = "1H") {
 
  // 1) Obtenir buckets disponibles
  const res = await client.query(
    `SELECT *
     FROM sl_buckets
     WHERE symbol = $1
       AND timeframe = $2
       AND status = 'available'
       AND (order_status = 'none' OR order_status = 'pending')
     ORDER BY bucket_price ASC`,
    [symbol, timeframe]
  );

  const buckets = res.rows;

 
  if (buckets.length === 0) return;

  // 2) Bucket dominant per SIZE
  const dominant = buckets.reduce(
    (best, b) =>
      !best || Number(b.total_size) > Number(best.total_size) ? b : best,
    null
  );

  if (!dominant) return;

  const bucket_price = Number(dominant.bucket_price);
  const side = dominant.side;
 
  // 3) Condició de proximitat
  let isNear = false;

  if (side === "short") {
    isNear = price_now < bucket_price &&
             (bucket_price - price_now) <= atr;
  } else if (side === "long") {
    isNear = price_now > bucket_price &&
             (price_now - bucket_price) <= atr;
  }
console.log("isNear:", isNear);
  if (!isNear) return;

  // 4) Si ja hi ha pending → no crear res
  if (dominant.order_status === "pending") return;

  // 5) Calcular entry, TP i SL
  const entry_price = bucket_price;

  const tp = side === "long"
    ? entry_price + atr
    : entry_price - atr;

  const sl = side === "long"
    ? entry_price - atr
    : entry_price + atr;
 console.log("TP/SL:", { tp, sl });
  // -------------------------------------------------------------
  // 🔥 6) CALCULAR SIZE INSTITUCIONAL
  // -------------------------------------------------------------

  // Obtenir portfolio actual
  const portfolio = await readPortfolio(); // BTC, ETH, SOL, USDC
 console.log("portfolio:", portfolio);
  let size = 0;

  if (side === "short") {
    // SELL → tota la cripto disponible
    size = portfolio[symbol] || 0;
  } else {
    // LONG → USDC / 3
    const usdc = portfolio["USDC"] || 0;
    size = usdc / 3;
  }
 console.log("STOP: size <= 0");
  // Si no hi ha size → no obrir ordre
  if (size <= 0) return;
  console.log("createOrder");
  // 7) Crear ordre LIMIT + TP/SL adjunts
  const order = await createOrder({
    symbol,
    timeframe,
    bucket_price,
    side,
    entry_price,
    atr,
    tp,
    sl,
    size,
    zone_ts: new Date(dominant.updated_at).getTime(),
    price_now
  });

  // 8) Actualitzar bucket FIAT‑PRO
  await client.query(
    `UPDATE sl_buckets
     SET order_status = 'pending',
         status = 'available',
         order_id = $1,
         tp_price = $2,
         sl_price = $3
     WHERE id = $4`,
    [order.okxOrderId, tp, sl, dominant.id]
  );

  console.log("[PENDING CREATED]", symbol, "bucket:", bucket_price, "size:", size);
}


// -------------------------------------------------------------
// 2) CANCEL·LACIÓ PER DISTÀNCIA (FIAT‑PRO SPOT)
// -------------------------------------------------------------
export async function manageDistanceCancels(symbol, price_now, atr, timeframe = "1H") {

  // 1) Buscar buckets pending
  const res = await client.query(
    `SELECT *
     FROM sl_buckets
     WHERE symbol = $1
       AND timeframe = $2
       AND order_status = 'pending'`,
    [symbol, timeframe]
  );

  const buckets = res.rows;
  if (buckets.length === 0) return;

  for (const b of buckets) {

    const distance = Math.abs(price_now - Number(b.bucket_price));
    const isFar = distance > 2 * atr;

    if (!isFar) continue;
    if (!b.order_id) continue;

    console.log("[CANCEL·LACIÓ PER DISTÀNCIA]", symbol, "bucket:", b.bucket_price);

    // 2) Cancel·lar ordre a OKX
    await cancelOrder({ id: b.order_id, symbol });

    // 3) Actualitzar bucket FIAT‑PRO
    await client.query(
      `UPDATE sl_buckets
       SET order_status = 'cancelled',
           status = 'closed',
           cancelled_at = NOW(),
           cancel_reason = 'distance'
       WHERE id = $1`,
      [b.id]
    );
  }
}
