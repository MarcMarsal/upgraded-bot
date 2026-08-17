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
// CALCULAR INICI TEÒRIC DE L’INTERVAL 1H10m (hora local ES)
// ---------------------------------------------------------
function getIntervalStartTs(now) {

  // Convertim "now" a hora local ES
  const d = new Date(
    new Date(now).toLocaleString("en-US", { timeZone: "Europe/Madrid" })
  );

  const minute = d.getMinutes();
  const hour = d.getHours();

  const start = new Date(d);

  if (minute < 10) {
    // Interval anterior: [hora-1:10 → hora:10)
    start.setHours(hour - 1);
    start.setMinutes(10);
  } else {
    // Interval actual: [hora:10 → hora+1:10)
    start.setHours(hour);
    start.setMinutes(10);
  }

  start.setSeconds(0);
  start.setMilliseconds(0);

  return start.getTime();
}

// ---------------------------------------------------------
// FUNCIO PRINCIPAL 1H10m
// ---------------------------------------------------------
export async function fetchAndStoreCandles1H10m(symbol) {

  const now = Date.now();

  // Interval teòric actual (basat en hora local ES)
  const intervalStart = getIntervalStartTs(now);

  // Obtenir vela oberta 1H
  const oc = await getOpenCandle1H(symbol);
  if (!oc) {
    console.log(`[1H10m][${symbol}] NO TINC VELA 1H OBERTA`);
    return;
  }

  // ---------------------------------------------------------
  // 1) SI NO HI HA VELA OBERTA 1H10m → CREAR-LA
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

    console.log(`[1H10m][${symbol}] VELA 1H10m CREADA PER INTERVAL`, new Date(intervalStart).toISOString());
    return;
  }

  // ---------------------------------------------------------
  // 2) SI L’INTERVAL HA CANVIAT → TANCAR I CREAR NOVA
  // ---------------------------------------------------------
  if (current[symbol].startTs !== intervalStart) {

    const c = current[symbol];

    const timestamp_es = new Date(
      new Date(c.startTs).toLocaleString("en-US", { timeZone: "Europe/Madrid" })
    ).getTime();

    const date_es = new Date(c.startTs).toLocaleString("es-ES", {
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
    `, [
      symbol,
      "1H10m",
      c.startTs,
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume,
      timestamp_es,
      date_es,
      created_at
    ]);

    console.log(`[1H10m][${symbol}] VELA TANCADA INTERVAL`, new Date(c.startTs).toISOString());

    // Crear nova vela per al nou interval
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

    console.log(`[1H10m][${symbol}] NOVA VELA 1H10m PER INTERVAL`, new Date(intervalStart).toISOString());
    return;
  }

  // ---------------------------------------------------------
  // 3) ACTUALITZAR VELA OBERTA (interval actual)
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

  // Actualització correcta
  // console.log(`[1H10m][${symbol}] Actualitzada vela oberta`);
}

// ---------------------------------------------------------
// Funció per obtenir veles per detectMSES
// ---------------------------------------------------------
export function getCandlesForDetection1H10m(symbol, closedCandles) {
  return [...closedCandles, dummyOpen[symbol]];
}
