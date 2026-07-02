// core/orders/orderManager.js
import { client } from "../../db/client.js";
import { createOrder } from "./createOrder.js";
import { cancelOrder } from "./cancelOrder.js";
// import { getOrderStatusOKX } from "./okxClient.js"; // l'afegirem després

export async function managePendingCreation(symbol, price_now, atr, timeframe = "1H") {

  // 1) Obtenir buckets disponibles (status=available)
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

  // 3) Condició de proximitat (preu només aquí)
  let isNear = false;

  if (side === "short") {
    isNear = price_now < bucket_price &&
             (bucket_price - price_now) <= atr;
  } else if (side === "long") {
    isNear = price_now > bucket_price &&
             (price_now - bucket_price) <= atr;
  }

  if (!isNear) return;

  // 4) Si ja hi ha pending → no crear res
  if (dominant.order_status === "pending") return;

  // 5) Calcular TP i SL
  const entry_price = bucket_price;

  const tp = side === "long"
    ? entry_price + atr
    : entry_price - atr;

  const sl = side === "long"
    ? entry_price - atr
    : entry_price + atr;

  // 6) Crear ordre LIMIT a OKX (reutilitzem createOrder)
  const order = await createOrder({
    symbol,
    timeframe,
    bucket_price,
    side,
    entry_price,
    atr,
    tp,
    sl,
    zone_ts: new Date(dominant.updated_at).getTime(),
    price_now
  });

  // 7) Actualitzar bucket FIAT‑PRO
  await client.query(
    `UPDATE sl_buckets
     SET order_status = 'pending',
         status = 'available',
         order_id = $1,
         tp_price = $2,
         sl_price = $3
     WHERE id = $4`,
    [order.id, tp, sl, dominant.id]
  );

  console.log("[PENDING CREATED]", symbol, "bucket:", bucket_price);
}

export async function manageActivation(symbol, timeframe = "1H") {
  // s'omplirà després
}

export async function manageClosures(symbol, timeframe = "1H") {
  // s'omplirà després
}

export async function manageDistanceCancels(symbol, price_now, atr, timeframe = "1H") {
  // s'omplirà després
}
