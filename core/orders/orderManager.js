// core/orders/orderManager.js

import { getPendingEntryOrders } from "./getPendingEntryOrders.js";
import { getActiveOrders } from "./getActiveOrders.js";
import { activateOrder } from "./activateOrder.js";
import { cancelOrder } from "./cancelOrder.js";
import { trackOrderTP_SL } from "./trackOrderTP_SL.js";

// IMPORTANT:
// FIAT‑PRO DOMINANT ja crea l’ordre LIMIT.
// Aquí només gestionem activació, cancel·lació i TP/SL.

export async function orderManager({
  symbol,
  timeframe,
  price_now,
  high,
  low,
  atr
}) {

  // ---------------------------------------------------------
  // 1) CANCEL·LAR ORDRES LIMIT si el preu se’n va
  // ---------------------------------------------------------
  const pendingOrders = await getPendingEntryOrders(symbol);

  for (const order of pendingOrders) {
    const isFar = Math.abs(price_now - order.bucket_price) > 2 * atr;
    if (isFar) {
      await cancelOrder(order, price_now);
    }
  }

  // ---------------------------------------------------------
  // 2) ACTIVAR ORDRES LIMIT si toca l'entry
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
  // 3) TRACK TP/SL PER ORDRES ACTIVES
  // ---------------------------------------------------------
  const activeOrders = await getActiveOrders(symbol);

  for (const order of activeOrders) {
    await trackOrderTP_SL(order, high, low);
  }
}
