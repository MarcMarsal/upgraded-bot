// core/orders/cancelOrder.js
import { client } from "../../db/client.js";
import { okxCancelOrder } from "../okx/okxClient.js";

/**
 * Cancel·la una ordre FIAT‑PRO quan el preu surt de ±1.5 ATR.
 * Cancel·la en LOCAL i també a OKX (SPOT).
 */
export async function cancelOrder(order, price_now, atr) {
  const {
    id,
    symbol,
    bucket_price,
    status,
    okx_order_id
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

    // 1) CANCEL·LAR A OKX (SPOT)
    if (okx_order_id) {
      try {
        await okxCancelOrder(symbol, okx_order_id);
        console.log(`[OKX] CANCEL SENT → ${symbol} ${okx_order_id}`);
      } catch (err) {
        console.log("[OKX] ERROR CANCEL:", err.message);
      }
    }

    // 2) CANCEL·LAR EN LOCAL
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
