// fitxer fetchCandles1HCustom.js
import { client } from "../db/client.js";

const current = {};
const dummyOpen = {};

// ---------------------------------------------------------
// OBTENIR VELA OBERTA 1H (última)
// ---------------------------------------------------------
async function getOpenCandle1H(symbol) {
  try {
    const res = await client.query(`
      SELECT timestamp, open, high, low, close, volume
      FROM candles
      WHERE symbol = $1 AND timeframe = '1H'
      ORDER BY timestamp DESC
      LIMIT 1
    `, [symbol]);

    if (!res.rows[0]) return null;

    return {
      ...res.rows[0],
      timestamp: Number(res.rows[0].timestamp)
    };

  } catch (err) {
    console.log(`[1HCustom][${symbol}] ERROR getOpenCandle1H:`, err);
    return null;
  }
}


// ---------------------------------------------------------
// GUARDAR VELA CUSTOM (1H + offset)
// ---------------------------------------------------------
async function storeCandle1HCustom(symbol, timeframe, c) {

  const timestamp_es = c.timestamp;

  const date_es = new Date(c.timestamp).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).replace(",", "");

  const created_at = Date.now();

  await client.query(`
    INSERT INTO candles (
      symbol, timeframe, timestamp,
      open, high, low, close, volume,
      timestamp_es, date_es, created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (symbol, timeframe, timestamp)
    DO UPDATE SET
      open=$4, high=$5, low=$6, close=$7, volume=$8,
      timestamp_es=$9, date_es=$10,
      created_at=$11;
  `, [
    symbol,
    timeframe,
    c.timestamp,
    c.open,
    c.high,
    c.low,
    c.close,
    c.volume,
    timestamp_es,
    date_es,
    created_at
  ]);
}


// ---------------------------------------------------------
// FUNCIO PRINCIPAL (1H + offset)
// ---------------------------------------------------------
export async function fetchAndStoreCandles1HCustom(symbol, offsetMinutes) {

  const oc = await getOpenCandle1H(symbol);
  if (!oc) return;

  const offsetMs = offsetMinutes * 60 * 1000;
  const timeframe = `1H${offsetMinutes}m`;

  const nextStart = oc.timestamp + offsetMs;
  const now = Date.now();

  // 1) CREAR VELA SI NO EXISTEIX
  if (!current[symbol]) {

    if (now < nextStart) return;

    current[symbol] = {
      timeframe,
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0,
      startTs: nextStart
    };

    dummyOpen[symbol] = {
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: 0,
      timestamp: nextStart
    };

    await storeCandle1HCustom(symbol, timeframe, {
      timestamp: nextStart,
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0
    });

    return;
  }

  // 2) ACTUALITZAR VELA OBERTA
  if (now < current[symbol].startTs + (60 * 60 * 1000)) {

    const oc2 = await getOpenCandle1H(symbol);
    if (!oc2) return;

    const price = oc2.close;
    const vol   = oc2.volume || 0;

    current[symbol].high = Math.max(current[symbol].high, price);
    current[symbol].low  = Math.min(current[symbol].low,  price);
    current[symbol].close = price;
    current[symbol].volume += vol;

    await storeCandle1HCustom(symbol, timeframe, {
      timestamp: current[symbol].startTs,
      open: current[symbol].open,
      high: current[symbol].high,
      low: current[symbol].low,
      close: current[symbol].close,
      volume: current[symbol].volume
    });

    return;
  }

  // 3) TANCAR I CREAR NOVA
  const c = current[symbol];

  await storeCandle1HCustom(symbol, timeframe, {
    timestamp: c.startTs,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume
  });

  const newStart = oc.timestamp + offsetMs;

  current[symbol] = {
    timeframe,
    open: oc.close,
    high: oc.close,
    low: oc.close,
    close: oc.close,
    volume: oc.volume || 0,
    startTs: newStart
  };

  dummyOpen[symbol] = {
    open: oc.close,
    high: oc.close,
    low: oc.close,
    close: oc.close,
    volume: 0,
    timestamp: newStart
  };

  await storeCandle1HCustom(symbol, timeframe, {
    timestamp: newStart,
    open: oc.close,
    high: oc.close,
    low: oc.close,
    close: oc.close,
    volume: oc.volume || 0
  });
}


// ---------------------------------------------------------
export function getCandlesForDetection1HCustom(symbol, closedCandles) {
  return [...closedCandles, dummyOpen[symbol]];
}
