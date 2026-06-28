// core/orders/activateOrder.js
import { client } from "../../db/client.js";

/**
 * Activa una ordre FIAT‑PRO quan el preu toca l'entry reconstruït.
 * Status passa de PENDING_ENTRY → ACTIVE.
 */
export async function activateOrder(order, price_now) {
  const {
    id,
    symbol,
    side,
    entry_price,
    status
  } = order;

  // Només activem ordres pendents
  if (status !== "PENDING_ENTRY") {
    return false;
  }

  let shouldActivate = false;

  // Condició d'activació FIAT‑PRO:
  // LONG → el preu ha de tocar o baixar fins a entry_price
  // SHORT → el preu ha de tocar o pujar fins a entry_price
  if (side === "long" && price_now <= entry_price) {
    shouldActivate = true;
  }

  if (side === "short" && price_now >= entry_price) {
    shouldActivate = true;
  }

  if (!shouldActivate) {
    return false;
  }

  const now = Date.now();

  await client.query(
    `
    UPDATE orders
    SET status = 'ACTIVE',
        timestamp_activated = $1,
        price_at_activation = $2,
        last_update = $1
    WHERE id = $3
    `,
    [now, price_now, id]
  );

  console.log(`[ORDERS] ACTIVATED → ${symbol} ${side} @ ${entry_price}`);

  return true;
}
