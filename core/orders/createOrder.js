// core/orders/createOrder.js
import { client } from "../../db/client.js";

/**
 * Crea una ordre FIAT‑PRO quan el preu entra a ±1 ATR de la zona institucional.
 * Status inicial: PENDING_ENTRY
 */
export async function createOrder({
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
}) {
  const now = Date.now();

  // 1) Comprovar si ja existeix una ordre viva per aquest bucket
  const existing = await client.query(
    `
    SELECT *
    FROM orders
    WHERE symbol = $1
      AND timeframe = $2
      AND bucket_price = $3
      AND status IN ('PENDING_ZONE','PENDING_ENTRY','ACTIVE')
    `,
    [symbol, timeframe, bucket_price]
  );

  if (existing.rows.length > 0) {
    console.log(`[ORDERS] Ja existeix una ordre viva per ${symbol} bucket ${bucket_price}`);
    return null;
  }

  // 2) Inserir ordre nova
  const res = await client.query(
    `
    INSERT INTO orders
      (symbol, timeframe, bucket_price, side,
       entry_price, atr, tp, sl,
       status, timestamp_created,
       price_at_creation, zone_ts, last_update)
    VALUES
      ($1,$2,$3,$4,
       $5,$6,$7,$8,
       'PENDING_ENTRY', $9,
       $10, $11, $12)
    RETURNING *
    `,
    [
      symbol,
      timeframe,
      bucket_price,
      side,
      entry_price,
      atr,
      tp,
      sl,
      now,
      price_now,
      zone_ts,
      now
    ]
  );

  const order = res.rows[0];

  console.log(`[ORDERS] Nova ordre creada → ${symbol} ${side} @ ${entry_price} (bucket ${bucket_price})`);

  return order;
}
