// core/buckets/cleanBuckets.js
import { client } from "../../db/client.js";

export async function cleanBuckets(symbol, timeframe, atr, price_now) {

  // 1) Obtenir tots els buckets del símbol/timeframe
  const res = await client.query(
    `
    SELECT *
    FROM sl_buckets
    WHERE symbol = $1 AND timeframe = $2
    ORDER BY timestamp_created DESC
    `,
    [symbol, timeframe]
  );

  const buckets = res.rows;
  const now = Date.now();

  for (const b of buckets) {

    // 🟩 FIAT‑PRO: només protegim buckets operats
    const isProtected =
      b.status === "mitigated" ||
      b.status === "closed";

    if (isProtected) {
      continue;
    }

    // 🟥 A) ATR antic (>30% de diferència)
    if (Math.abs(b.atr - atr) / b.atr > 0.30) {
      await client.query(`
        UPDATE sl_buckets
        SET status = 'cancelled',
            cancel_reason = 'atr_change',
            cancelled_at = NOW()
        WHERE id = $1
      `, [b.id]);
      continue;
    }

    // 🟥 B) Massa lluny del preu (>5 × ATR)
    const distance = Math.abs(price_now - Number(b.bucket_price));
    if (distance > atr * 5) {
      await client.query(`
        UPDATE sl_buckets
        SET status = 'cancelled',
            cancel_reason = 'distance',
            cancelled_at = NOW()
        WHERE id = $1
      `, [b.id]);
      continue;
    }

    // 🟥 C) Massa antic (>3 × timeframe)
    const ageMs = now - Number(b.timestamp_created);
    const maxAgeMs = 3 * 60 * 60 * 1000; // 3 hores per 1H
    if (ageMs > maxAgeMs) {
      await client.query(`
        UPDATE sl_buckets
        SET status = 'cancelled',
            cancel_reason = 'too_old',
            cancelled_at = NOW()
        WHERE id = $1
      `, [b.id]);
      continue;
    }

    // 🟥 D) Size massa petit (no institucional)
    if (Number(b.total_size) < atr * 1000) {
      await client.query(`
        UPDATE sl_buckets
        SET status = 'cancelled',
            cancel_reason = 'weak_size',
            cancelled_at = NOW()
        WHERE id = $1
      `, [b.id]);
      continue;
    }

    // 🟥 E) Leverage incoherent (retail heavy)
    if (Number(b.avg_leverage) > 20) {
      await client.query(`
        UPDATE sl_buckets
        SET status = 'cancelled',
            cancel_reason = 'retail_leverage',
            cancelled_at = NOW()
        WHERE id = $1
      `, [b.id]);
      continue;
    }
  }

  // 🟦 F) Neteja per solapament (buckets massa propers)
  const res2 = await client.query(
    `
    SELECT *
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

    if (Math.abs(Number(b1.bucket_price) - Number(b2.bucket_price)) < atr) {

      // 🟩 FIAT‑PRO: només protegim buckets operats
      const isProtected1 =
        b1.status === "mitigated" ||
        b1.status === "closed";

      const isProtected2 =
        b2.status === "mitigated" ||
        b2.status === "closed";

      if (isProtected1 || isProtected2) {
        continue;
      }

      // Eliminar el bucket amb SIZE més petit (FIAT‑PRO DOMINANT)
      const weaker =
        Number(b1.total_size) < Number(b2.total_size) ? b1 : b2;

      await client.query(`
        UPDATE sl_buckets
        SET status = 'cancelled',
            cancel_reason = 'overlap',
            cancelled_at = NOW()
        WHERE id = $1
      `, [weaker.id]);
    }
  }
}
