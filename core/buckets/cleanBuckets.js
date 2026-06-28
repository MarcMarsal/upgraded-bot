// core/buckets/cleanBuckets.js
import { client } from "../../db/client.js";

export async function cleanBuckets(symbol, timeframe, atr, price_now) {

  // 1) Obtenir tots els buckets del símbol/timeframe
  const res = await client.query(
    `
    SELECT id, bucket_price, atr AS atr_at_creation, timestamp_created,
           total_size, avg_leverage
    FROM sl_buckets
    WHERE symbol = $1 AND timeframe = $2
    ORDER BY timestamp_created DESC
    `,
    [symbol, timeframe]
  );

  const buckets = res.rows;
  const now = Date.now();

  for (const b of buckets) {

    const distance = Math.abs(price_now - b.bucket_price);

    // A) ATR antic (>30% de diferència)
    if (Math.abs(b.atr_at_creation - atr) / b.atr_at_creation > 0.30) {
      await client.query(`DELETE FROM sl_buckets WHERE id = $1`, [b.id]);
      continue;
    }

    // B) Massa lluny del preu (>5 × ATR)
    if (distance > atr * 5) {
      await client.query(`DELETE FROM sl_buckets WHERE id = $1`, [b.id]);
      continue;
    }

    // C) Massa antic (>3 × timeframe)
    const ageMs = now - Number(b.timestamp_created);
    const maxAgeMs = 3 * 60 * 60 * 1000; // 3 hores per timeframe 1H

    if (ageMs > maxAgeMs) {
      await client.query(`DELETE FROM sl_buckets WHERE id = $1`, [b.id]);
      continue;
    }

    // D) Size massa petit (no institucional)
    if (b.total_size < atr * 1000) {
      await client.query(`DELETE FROM sl_buckets WHERE id = $1`, [b.id]);
      continue;
    }

    // E) Leverage incoherent (retail heavy)
    if (b.avg_leverage > 20) {
      await client.query(`DELETE FROM sl_buckets WHERE id = $1`, [b.id]);
      continue;
    }
  }

  // F) Neteja per solapament (buckets massa propers)
  const res2 = await client.query(
    `
    SELECT id, bucket_price
    FROM sl_buckets
    WHERE symbol = $1 AND timeframe = $2
    ORDER BY bucket_price ASC
    `,
    [symbol, timeframe]
  );

  const sorted = res2.rows;

  for (let i = 0; i < sorted.length - 1; i++) {
    const b1 = sorted[i];
    const b2 = sorted[i + 1];

    if (Math.abs(b1.bucket_price - b2.bucket_price) < atr) {
      // Eliminar el més antic (b1)
      await client.query(`DELETE FROM sl_buckets WHERE id = $1`, [b1.id]);
    }
  }
}
