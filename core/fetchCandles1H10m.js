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
// ---------------------------------------------------------
// CALCULAR INICI TEÒRIC DE L’INTERVAL 1H10m (hora local ES)
// ---------------------------------------------------------
function getIntervalStartTs(now) {

  // Obtenir hora local ES sense trencar-la
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  });

  const parts = fmt.formatToParts(now);

  const hour   = parseInt(parts.find(p => p.type === "hour").value);
  const minute = parseInt(parts.find(p => p.type === "minute").value);

  // Construir data local ES manualment
  const d = new Date(now);
  d.setHours(hour);
  d.setMinutes(minute);
  d.setSeconds(0);
  d.setMilliseconds(0);

  const start = new Date(d);

  if (minute < 10) {
    start.setHours(hour - 1);
    start.setMinutes(10);
  } else {
    start.setHours(hour);
    start.setMinutes(10);
  }

  start.setSeconds(0);
  start.setMilliseconds(0);

  return start.getTime();
}


// ---------------------------------------------------------
// GUARDAR VELA (igual que 1H)
// ---------------------------------------------------------
async function storeCandle1H10m(symbol, c) {

  // Aquí c.timestamp JA ÉS l'hora d'obertura que vols (intervalStart)
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
// FUNCIO PRINCIPAL 1H10m
// ---------------------------------------------------------
export async function fetchAndStoreCandles1H10m(symbol) {

  const now = Date.now();
  const intervalStart = getIntervalStartTs(now);

  const oc = await getOpenCandle1H(symbol);
  if (!oc) {
    console.log(`[1H10m][${symbol}] NO TINC VELA 1H OBERTA`);
    return;
  }

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

    // ✔ GUARDAR VELA OBERTA (igual que 1H)
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

    // ✔ GUARDAR VELA TANCADA
    await storeCandle1H10m(symbol, {
      timestamp: c.startTs,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    });

    console.log(`[1H10m][${symbol}] VELA TANCADA`, new Date(c.startTs).toISOString());

    // Crear nova vela oberta
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

    // ✔ GUARDAR NOVA VELA OBERTA
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

  // ✔ Actualitzar vela oberta a DB
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
