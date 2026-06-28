// core/orders/getActiveOrders.js
import { client } from "../../db/client.js";

/**
 * Retorna totes les ordres FIAT‑PRO en estat ACTIVE
 * per un símbol concret.
 */
export async function getActiveOrders(symbol) {
  const res = await client.query(
    `
    SELECT *
    FROM orders
    WHERE symbol = $1
      AND status = 'ACTIVE'
    ORDER BY timestamp_activated ASC
    `,
    [symbol]
  );

  return res.rows;
}
