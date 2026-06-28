// core/orders/orderManager.js

import { getPendingEntryOrders } from "./getPendingEntryOrders.js";
import { getActiveOrders } from "./getActiveOrders.js";
import { createOrder } from "./createOrder.js";
import { activateOrder } from "./activateOrder.js";
import { cancelOrder } from "./cancelOrder.js";
import { trackOrderTP_SL } from "./trackOrderTP_SL.js";

export async function orderManager({
  symbol,
  timeframe,
  price_now,
  high,
  low,
  atr,
  bucket_price,
  side,
  entry_price,
  tp,
  sl,
  zone_ts
}) {

  // ---------------------------------------------------------
  // 1) CREAR ORDRE LIMIT (només si NO existeix i el preu s'apropa)
  // ---------------------------------------------------------
  const pendingOrders = await getPendingEntryOrders(symbol);

  const hasOrderForBucket = pendingOrders.some(
    o => Number(o.bucket_price) === Number(bucket_price)
  );

  const isNear = Math.abs(price_now - bucket_price) <= atr;

  if (!hasOrderForBucket && isNear) {
    await createOrder({
      symbol,
      timeframe,
      bucket_price,
      side,
      entry_price,
      atr,
      tp,
      sl,
      zone_ts,
      price_now
    });
  }

  // ---------------------------------------------------------
  // 2) CANCEL·LAR ORDRE LIMIT (només si el preu se’n va)
  // ---------------------------------------------------------
  for (const order of pendingOrders) {
    const isFar = Math.abs(price_now - order.bucket_price) > 2 * atr;

    if (isFar) {
      await cancelOrder(order, price_now);
    }
  }

  // ---------------------------------------------------------
  // 3) ACTIVAR ORDRE (només si toca l'entry)
  // ---------------------------------------------------------
  for (const order of pendingOrders) {
    const touchesEntry =
      (order.side === "long" && price_now <= order.entry_price) ||
      (order.side === "short" && price_now >= order.entry_price);

    if (touchesEntry) {
      await activateOrder(order, price_now);
    }
  }

  // ---------------------------------------------------------
  // 4) TRACK TP/SL PER ORDRES ACTIVES
  // ---------------------------------------------------------
  const activeOrders = await getActiveOrders(symbol);

  for (const order of activeOrders) {
    await trackOrderTP_SL(order, high, low);
  }
}
