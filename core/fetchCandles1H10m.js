import { client } from "../db/client.js";

let current = {};   // estat de la vela oberta 1H10m

async function getOpenCandle(symbol) {
  const q = await client.query(`
    SELECT *
    FROM candles
    WHERE symbol=$1 AND timeframe='1H'
    ORDER BY timestamp DESC
    LIMIT 1
  `, [symbol]);

  return q.rows[0] || null;
}

export async function fetchAndStoreCandles1H10m(symbol) {
  const now = Date.now();
  const d = new Date(now);

  const minute = d.getUTCMinutes();

  // 1) INICI DE VELA (HH:10) — només si NO existeix
  if (minute === 10 && !current[symbol]) {
    const oc = await getOpenCandle(symbol);
    if (!oc) return;

    current[symbol] = {
      timeframe: "1H10m",
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0,
      startTs: now
    };

    console.log(`[1H10m] Inici vela ${symbol} @ ${new Date(now).toISOString()}`);
    return;
  }

  // Si no hi ha vela oberta → res
  if (!current[symbol]) return;

  // 2) ACTUALITZAR VELA 1H10m AMB LA VELA OBERTA 1H
  const oc = await getOpenCandle(symbol);
  if (!oc) return;

  const price = oc.close;
  const vol   = oc.volume || 0;

  current[symbol].high = Math.max(current[symbol].high, price);
  current[symbol].low  = Math.min(current[symbol].low,  price);
  current[symbol].close = price;
  current[symbol].volume += vol;

  // 3) TANCAMENT (HH+1:10) — 60 minuts exactes
  const elapsed = now - current[symbol].startTs;
  if (elapsed >= 60 * 60 * 1000) {

    const c = current[symbol];

    await client.query(`
      INSERT INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
      symbol,
      "1H10m",
      c.startTs,
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume
    ]);

    console.log(`[1H10m] Tancament vela ${symbol} @ ${new Date(now).toISOString()}`);

    current[symbol] = null;
  }
}
