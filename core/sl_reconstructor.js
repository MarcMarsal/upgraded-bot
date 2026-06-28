// core/sl_reconstructor.js
import { client } from "../db/client.js";

let last = {}; 
// last[symbol] = { oi, price, ts }

export async function updateSLReconstruction(symbol, price, oi, ts, atr, timeframe = "1H") {
  // Primera lectura: només guardem referència, no inserim
  if (!last[symbol]) {
    last[symbol] = { oi, price, ts };
    return;
  }

  const prev = last[symbol];

  const oi_delta = oi - prev.oi;
  const price_delta = price - prev.price;

  let side = null;

  // Detecció d'entrades FIAT‑PRO
  if (oi_delta > 0) {
    if (price_delta > 0) side = "long";
    else if (price_delta < 0) side = "short";
  }

  // Reconstrucció d'entry_price estimat
  let entry_price = null;

  if (oi_delta > 0 && side) {
    const factor = 0.5;

    entry_price =
      side === "long"
        ? price - (price_delta * factor)
        : price + (price_delta * factor);
  }

  // Leverage estimat
  let leverage = null;

  if (oi_delta > 0 && side && entry_price) {
    const vol = Math.abs(price_delta) / price;
    const sizeFactor = Math.abs(oi_delta) / 1000;

    leverage = 1 + (vol * 100) + (sizeFactor * 0.1);

    if (leverage < 1) leverage = 1;
    if (leverage > 200) leverage = 200;
  }

  // Liquidation price estimada
  let liq_price = null;

  if (leverage && entry_price && side) {
    const k = 0.9;

    liq_price =
      side === "long"
        ? entry_price * (1 - (1 / leverage) * k)
        : entry_price * (1 + (1 / leverage) * k);
  }

  // Size estimat
  let size_estimated = null;

  if (oi_delta > 0 && entry_price) {
    size_estimated = Math.abs(oi_delta) * entry_price;
  }

  // Només inserim si hi ha moviment d'OI
  if (Math.abs(oi_delta) > 0) {
    await client.query(
      `INSERT INTO sl_reconstructed
       (symbol, ts, price, oi, oi_delta, price_delta, side, entry_price, leverage, liq_price, size_estimated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        symbol,
        ts,
        price,
        oi,
        oi_delta,
        price_delta,
        side,
        entry_price,
        leverage,
        liq_price,
        size_estimated
      ]
    );
  }

  // -------------------------------
  // 🟥 CAPA RETAIL 50x+
  // -------------------------------
  if (oi_delta > 0 && leverage >= 50 && entry_price && liq_price) {
    await client.query(
      `INSERT INTO retail_liquidations
       (symbol, entry_price, leverage, liq_price, side, size, ts)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [symbol, entry_price, leverage, liq_price, side, size_estimated, ts]
    );
  }

  // -------------------------------
  // 🟩 CAPA INSTITUCIONAL FIAT‑PRO (ATR BUCKETS)
  // -------------------------------
  if (oi_delta > 0 && entry_price && leverage && liq_price) {

    // Bucket basat en ATR
    const bucket_step = atr;
    const bucket_price = Math.round(entry_price / bucket_step) * bucket_step;

    const existing = await client.query(
      `SELECT * FROM sl_buckets
       WHERE symbol = $1 AND bucket_price = $2 AND side = $3 AND timeframe = $4`,
      [symbol, bucket_price, side, timeframe]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];

      await client.query(
        `UPDATE sl_buckets
         SET total_size = total_size + $1,
             avg_leverage = (avg_leverage * entries_count + $2) / (entries_count + 1),
             liq_min = LEAST(liq_min, $3),
             liq_max = GREATEST(liq_max, $3),
             entries_count = entries_count + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [size_estimated, leverage, liq_price, row.id]
      );

    } else {
      await client.query(
        `INSERT INTO sl_buckets
         (symbol, timeframe, bucket_price, side, total_size, avg_leverage, liq_min, liq_max, entries_count, atr, timestamp_created)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,1,$8,NOW())`,
        [symbol, timeframe, bucket_price, side, size_estimated, leverage, liq_price, atr]
      );
    }
  }

  // Actualitzem estat
  last[symbol] = { oi, price, ts };
}
