// fitxer fetchCandles1H10m.js
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

    return res.rows[0] || null;

  } catch (err) {
    console.log(`[1H10m][${symbol}] ERROR getOpenCandle1H:`, err);
    return null;
  }
}

// ---------------------------------------------------------
// GUARDAR VELA 1H10m (FIAT, sense conversions trencades)
// ---------------------------------------------------------
async function storeCandle1H10m(symbol, c) {

  // timestamp_es = el mateix timestamp (ja és l’hora d’obertura)
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
    "1H10m",
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
// FUNCIO PRINCIPAL 1H10m (Opció A FIAT)
// ---------------------------------------------------------
export async function fetchAndStoreCandles1H10m(symbol) {

  const oc = await getOpenCandle1H(symbol);
  if (!oc) {
    console.log(`[1H10m][${symbol}] NO TINC VELA 1H OBERTA`);
    return;
  }

  // ✔ Opció A: la 1H10m obre 10 minuts després de la 1H
  const intervalStart = oc.timestamp + (10 * 60 * 1000);

  // ---------------------------------------------------------
  // 1) CREAR VELA OBERTA SI NO EXISTEIX
  // ---------------------------------------------------------
  if (!current[symbol]) {

    current[symbol] = {
      timeframe: "1H10m",
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0,
      startTs: intervalStart
    };

    dummyOpen[symbol] = {
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: 0,
      timestamp: intervalStart
    };

    await storeCandle1H10m(symbol, {
      timestamp: intervalStart,
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0
    });

    console.log(`[1H10m][${symbol}] VELA 1H10m CREADA I GUARDADA`, new Date(intervalStart).toISOString());
    return;
  }

  // ---------------------------------------------------------
  // 2) SI L’INTERVAL CANVIA → TANCAR I CREAR NOVA
  // ---------------------------------------------------------
  if (current[symbol].startTs !== intervalStart) {

    const c = current[symbol];

    await storeCandle1H10m(symbol, {
      timestamp: c.startTs,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    });

    console.log(`[1H10m][${symbol}] VELA TANCADA`, new Date(c.startTs).toISOString());

    current[symbol] = {
      timeframe: "1H10m",
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0,
      startTs: intervalStart
    };

    dummyOpen[symbol] = {
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: 0,
      timestamp: intervalStart
    };

    await storeCandle1H10m(symbol, {
      timestamp: intervalStart,
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0
    });

    console.log(`[1H10m][${symbol}] NOVA VELA 1H10m GUARDADA`, new Date(intervalStart).toISOString());
    return;
  }

  // ---------------------------------------------------------
  // 3) ACTUALITZAR VELA OBERTA
  // ---------------------------------------------------------
  const oc2 = await getOpenCandle1H(symbol);
  if (!oc2) {
    console.log(`[1H10m][${symbol}] ERROR: oc2=null DURANT actualització`);
    return;
  }

  const price = oc2.close;
  const vol   = oc2.volume || 0;

  current[symbol].high = Math.max(current[symbol].high, price);
  current[symbol].low  = Math.min(current[symbol].low,  price);
  current[symbol].close = price;
  current[symbol].volume += vol;

  await storeCandle1H10m(symbol, {
    timestamp: current[symbol].startTs,
    open: current[symbol].open,
    high: current[symbol].high,
    low: current[symbol].low,
    close: current[symbol].close,
    volume: current[symbol].volume
  });
}

// ---------------------------------------------------------
export function getCandlesForDetection1H10m(symbol, closedCandles) {
  return [...closedCandles, dummyOpen[symbol]];
}
