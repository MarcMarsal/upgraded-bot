// core/orders/cancelOrder.js
import { client } from "../../db/client.js";

/**
 * Cancel·la una ordre FIAT‑PRO quan el preu surt de ±1.5 ATR de la zona institucional.
 * Només aplica a ordres PENDING_ENTRY.
 */
export async function cancelOrder(order, price_now, atr) {
  const {
    id,
    symbol,
    bucket_price,
    status
  } = order;

  // Només cancel·lem ordres pendents
  if (status !== "PENDING_ENTRY") {
    return false;
  }

  // Si el preu surt de ±1.5 ATR → zona invalidada
  const distance = Math.abs(price_now - bucket_price);
  const cancelThreshold = 1.5 * atr;

  if (distance > cancelThreshold) {
    const now = Date.now();

    await client.query(
      `
      UPDATE orders
      SET status = 'CANCELLED',
          timestamp_closed = $1,
          price_at_close = $2,
          last_update = $1
      WHERE id = $3
      `,
      [now, price_now, id]
    );

    console.log(`[ORDERS] CANCELLED → ${symbol} bucket ${bucket_price} (preu ${price_now})`);

    return true;
  }

  return false;
}
