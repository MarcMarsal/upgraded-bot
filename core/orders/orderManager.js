// core/orders/orderManager.js
import { client } from "../../db/client.js";
import { createOrder } from "./createOrder.js";
import { cancelOrder } from "./cancelOrder.js";

import { getOrderStatusOKX } from "../okx/getOrderStatusOKX.js";
import { createTPOrder } from "./createTPOrder.js";
import { createSLOrder } from "./createSLOrder.js";

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
    if (!b.order_id) continue;

    // 2) Consultar estat de l’ordre a OKX
    const status = await getOrderStatusOKX(b.order_id);
    if (!status) continue;

    // 3) Si OKX ha executat l’ordre → activar bucket
    if (status.state === "filled" || status.state === "partially_filled") {

      // 3A) Marcar bucket com activat
      await client.query(
        `UPDATE sl_buckets
         SET order_status = 'active',
             status = 'mitigated',
             activated_at = NOW()
         WHERE id = $1`,
        [b.id]
      );

      // DINS manageActivation()
      await createTPOrder({
        symbol,
        side: b.side,          // "long" o "short"
        tpPrice: b.tp,
        size: b.size
      });

      await createSLOrder({
        symbol,
        side: b.side,
        slPrice: b.sl,
        size: b.size
      });


      console.log("[ACTIVATED]", b.symbol, "bucket:", b.bucket_price);
    }

    // 4) Si OKX ha cancel·lat l’ordre pending
    if (status.state === "canceled") {
      await client.query(
        `UPDATE sl_buckets
         SET order_status = 'cancelled',
             status = 'closed',
             cancelled_at = NOW(),
             cancel_reason = 'okx'
         WHERE id = $1`,
        [b.id]
      );

      console.log("[CANCELLED BY OKX]", b.symbol, "bucket:", b.bucket_price);
    }
  }
}


export async function manageClosures(symbol, timeframe = "1H") {

  // 1) Buscar buckets actius
  const res = await client.query(
    `SELECT *
     FROM sl_buckets
     WHERE symbol = $1
       AND timeframe = $2
       AND order_status = 'active'`,
    [symbol, timeframe]
  );

  const buckets = res.rows;
  if (buckets.length === 0) return;

  for (const b of buckets) {
    if (!b.order_id) continue;

    // 2) Consultar estat de l’ordre a OKX
    const status = await getOrderStatusOKX(b.order_id);
    if (!status) continue;

    // 3) TP o SL executat
    if (status.state === "triggered") {

      if (status.triggerType === "tp") {
        await client.query(
          `UPDATE sl_buckets
           SET order_status = 'tp',
               status = 'closed',
               closed_at = NOW()
           WHERE id = $1`,
          [b.id]
        );

        console.log("[TP EXECUTAT]", b.symbol, "bucket:", b.bucket_price);
      }

      if (status.triggerType === "sl") {
        await client.query(
          `UPDATE sl_buckets
           SET order_status = 'sl',
               status = 'closed',
               closed_at = NOW()
           WHERE id = $1`,
          [b.id]
        );

        console.log("[SL EXECUTAT]", b.symbol, "bucket:", b.bucket_price);
      }
    }

    // 4) Cancel·lació OKX d’una ordre activa
    if (status.state === "canceled") {
      await client.query(
        `UPDATE sl_buckets
         SET order_status = 'cancelled',
             status = 'closed',
             cancelled_at = NOW(),
             cancel_reason = 'okx'
         WHERE id = $1`,
        [b.id]
      );

      console.log("[CANCEL·LADA PER OKX]", b.symbol, "bucket:", b.bucket_price);
    }
  }
}


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

    // 2) Cancel·lar ordre a OKX (reutilitzes cancelOrder)
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
