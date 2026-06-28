// core/orders/orderManager.js

import { getPendingEntryOrders } from "./getPendingEntryOrders.js";
import { getActiveOrders } from "./getActiveOrders.js";
import { createOrder } from "./createOrder.js";
import { activateOrder } from "./activateOrder.js";
import { cancelOrder } from "./cancelOrder.js";
import { trackOrderTP_SL } from "./trackOrderTP_SL.js";

/**
 * Loop FIAT‑PRO de gestió d'ordres.
 * - Crea ordres quan el preu entra a ±1 ATR
 * - Activa ordres quan toca l'entry
 * - Cancel·la ordres si surt de ±1.5 ATR
 * - Tanca ordres per TP/SL
 */
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
  // 1) CREAR ORDRE (si entra a ±1 ATR)
  // ---------------------------------------------------------
  const distance = Math.abs(price_now - bucket_price);

  if (distance <= atr) {
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
  // 2) CANCEL·LAR ORDRES PENDENTS
  // ---------------------------------------------------------
  const pendingOrders = await getPendingEntryOrders(symbol);

  for (const order of pendingOrders) {
    await cancelOrder(order, price_now);
  }

  // ---------------------------------------------------------
  // 3) ACTIVAR ORDRES (si toca entry)
  // ---------------------------------------------------------
  for (const order of pendingOrders) {
    await activateOrder(order, price_now);
  }

  // ---------------------------------------------------------
  // 4) TRACKING TP/SL PER ORDRES ACTIVES
  // ---------------------------------------------------------
  const activeOrders = await getActiveOrders(symbol);

  for (const order of activeOrders) {
    await trackOrderTP_SL(order, high, low);
  }
}
