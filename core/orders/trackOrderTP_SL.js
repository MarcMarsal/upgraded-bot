// core/orders/trackOrderTP_SL.js
import { client } from "../../db/client.js";

/**
 * Tracking TP/SL per ordres FIAT‑PRO.
 * Només aplica a ordres ACTIVE.
 */
export async function trackOrderTP_SL(order, high, low) {
  const {
    id,
    symbol,
    side,
    tp,
    sl,
    status
  } = order;

  // Només processem ordres actives
  if (status !== "ACTIVE") {
    return false;
  }

  let hitTP = false;
  let hitSL = false;

  // LONG
  if (side === "long") {
    if (high >= tp) hitTP = true;
    if (low <= sl) hitSL = true;
  }

  // SHORT
  if (side === "short") {
    if (low <= tp) hitTP = true;
    if (high >= sl) hitSL = true;
  }

  // Si no ha tocat res → no fem res
  if (!hitTP && !hitSL) {
    return false;
  }

  const now = Date.now();
  const result = hitTP ? "TP" : "SL";
  const price_close = hitTP ? tp : sl;

  await client.query(
    `
    UPDATE orders
    SET status = $1,
        timestamp_closed = $2,
        price_at_close = $3,
        last_update = $2
    WHERE id = $4
    `,
    [result, now, price_close, id]
  );

  console.log(`[ORDERS] ${symbol} ${side} → ${result}`);

  return true;
}
