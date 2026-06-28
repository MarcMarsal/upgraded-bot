// core/buckets/cleanBuckets.js
import { client } from "../../db/client.js";

export async function cleanBuckets(symbol, timeframe, atr, price_now) {

  // 1) Obtenir tots els buckets del símbol/timeframe
  const res = await client.query(
    `
    SELECT id, bucket_price, atr AS atr_at_creation, timestamp_created
    FROM buckets
    WHERE symbol = $1 AND timeframe = $2
    ORDER BY timestamp_created DESC
    `,
    [symbol, timeframe]
  );

  const buckets = res.rows;

  for (const b of buckets) {

    const distance = Math.abs(price_now - b.bucket_price);

    // A) Neteja per ATR antic (>30% de diferència)
    if (Math.abs(b.atr_at_creation - atr) / b.atr_at_creation > 0.30) {
      await client.query(`DELETE FROM buckets WHERE id = $1`, [b.id]);
      continue;
    }

    // B) Neteja per distància (>5 × ATR)
    if (distance > atr * 5) {
      await client.query(`DELETE FROM buckets WHERE id = $1`, [b.id]);
      continue;
    }
  }

  // C) Neteja per solapament (buckets massa propers)
  // Recarregar buckets després de la primera neteja
  const res2 = await client.query(
    `
    SELECT id, bucket_price
    FROM buckets
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
      await client.query(`DELETE FROM buckets WHERE id = $1`, [b1.id]);
    }
  }
}
