// core/orders/getPendingEntryOrders.js
import { client } from "../../db/client.js";

/**
 * Retorna totes les ordres FIAT‑PRO en estat PENDING_ENTRY
 * per un símbol concret.
 */
export async function getPendingEntryOrders(symbol) {
  const res = await client.query(
    `
    SELECT *
    FROM orders
    WHERE symbol = $1
      AND status = 'PENDING_ENTRY'
    ORDER BY timestamp_created ASC
    `,
    [symbol]
  );

  return res.rows;
}
