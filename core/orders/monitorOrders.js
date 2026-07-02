// core/orders/monitorOrders.js
import { client } from "../../db/client.js";
import { getOrderStatusOKX } from "../okx/getOrderStatusOKX.js";

export async function monitorOrders(timeframe = "1H") {

  // 1) Buscar buckets amb ordres enviades
  const res = await client.query(
    `SELECT *
     FROM sl_buckets
     WHERE timeframe = $1
       AND order_id IS NOT NULL
       AND status != 'closed'`,
    [timeframe]
  );

  const buckets = res.rows;
  if (buckets.length === 0) return;

  for (const b of buckets) {

    const status = await getOrderStatusOKX(b.order_id);
    if (!status) continue;

    // ------------------------------
    // 2) TP / SL EXECUTAT
    // ------------------------------
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
        console.log("[TP EXECUTAT]", b.symbol, b.bucket_price);
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
        console.log("[SL EXECUTAT]", b.symbol, b.bucket_price);
      }

      continue;
    }

    // ------------------------------
    // 3) ORDRE LIMIT EXECUTADA (entrada)
    // ------------------------------
    if (status.state === "filled" || status.state === "partially_filled") {

      await client.query(
        `UPDATE sl_buckets
         SET order_status = 'active',
             status = 'mitigated',
             activated_at = NOW()
         WHERE id = $1`,
        [b.id]
      );

      console.log("[ENTRADA EXECUTADA]", b.symbol, b.bucket_price);
      continue;
    }

    // ------------------------------
    // 4) CANCEL·LACIÓ OKX
    // ------------------------------
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

      console.log("[CANCEL·LADA PER OKX]", b.symbol, b.bucket_price);
      continue;
    }
  }
}
