// fetchCandles1HCustom.js — versió FIAT, simple i funcional
import { client } from "../db/client.js";

const current = {};   // current[symbol][timeframe]

// ---------------------------------------------------------
// OBTENIR ÚLTIMA VELA 1H (la oberta, actualitzada cada minut)
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
// GUARDAR VELA CUSTOM
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
// HORA RODONA (inici de la vela 1H real)
// ---------------------------------------------------------
function getHourOpenTs() {
  const now = Date.now();
  return Math.floor(now / 3600000) * 3600000;
}

// ---------------------------------------------------------
// FUNCIO PRINCIPAL (1H + offset)
// ---------------------------------------------------------
export async function fetchAndStoreCandles1HCustom(symbol, offsetMinutes) {

  const timeframe = `1H${offsetMinutes}m`;
  const offsetMs = offsetMinutes * 60000;

  if (!current[symbol]) current[symbol] = {};
  if (!current[symbol][timeframe]) current[symbol][timeframe] = null;

  const openHourTs = getHourOpenTs();
  const nextStart = openHourTs + offsetMs;
  const now = Date.now();

  // 1) NO HI HA VELA OBERTA → crear-la quan toca
  if (!current[symbol][timeframe]) {

    if (now < nextStart) return;   // encara no toca crear-la

    const oc = await getOpenCandle1H(symbol);
    if (!oc) return;

    current[symbol][timeframe] = {
      startTs: nextStart,
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0
    };

    await storeCandle1HCustom(symbol, timeframe, current[symbol][timeframe]);
    return;
  }

  const c = current[symbol][timeframe];

  // 2) ACTUALITZAR VELA OBERTA (encara no ha passat 1 hora)
  if (now < c.startTs + 3600000) {

    const oc = await getOpenCandle1H(symbol);
    if (!oc) return;

    const price = oc.close;
    const vol   = oc.volume || 0;

    c.high = Math.max(c.high, price);
    c.low  = Math.min(c.low,  price);
    c.close = price;
    c.volume += vol;

    await storeCandle1HCustom(symbol, timeframe, c);
    return;
  }

  // 3) TANCAR I CREAR NOVA
  await storeCandle1HCustom(symbol, timeframe, c);

  const oc = await getOpenCandle1H(symbol);
  if (!oc) return;

  const newStart = c.startTs + 3600000;   // següent vela 1h després de l’anterior

  current[symbol][timeframe] = {
    startTs: newStart,
    open: oc.close,
    high: oc.close,
    low: oc.close,
    close: oc.close,
    volume: oc.volume || 0
  };

  await storeCandle1HCustom(symbol, timeframe, current[symbol][timeframe]);
}

// ---------------------------------------------------------
// PER A LA DETECCIÓ: afegir la vela oberta al conjunt tancat
// ---------------------------------------------------------
export function getCandlesForDetection1HCustom(symbol, timeframe, closedCandles) {
  const openCandle = current[symbol]?.[timeframe];
  return openCandle ? [...closedCandles, openCandle] : closedCandles;
}
