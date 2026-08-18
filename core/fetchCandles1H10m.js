// fetchCandles1HCustom.js — versió FIAT corregida amb timestamp
import { client } from "../db/client.js";

const current = {};   // current[symbol][timeframe]

// ---------------------------------------------------------
// OBTENIR ÚLTIMA VELA 1H (només veles obertes confirm=0)
// ---------------------------------------------------------
async function getOpenCandle1H(symbol) {
  try {
    const res = await client.query(`
      SELECT timestamp, open, high, low, close, volume, confirm
      FROM candles
      WHERE symbol = $1 AND timeframe = '1H'
      ORDER BY timestamp DESC
      LIMIT 1
    `, [symbol]);

    if (!res.rows[0]) {
      console.log(`[1HCustom][${symbol}] oc=NULL`);
      return null;
    }

    const row = res.rows[0];

    if (row.confirm !== false && row.confirm !== 0) {
      console.log(`[1HCustom][${symbol}] oc descartada (confirm=1)`);
      return null;
    }

    console.log(`[1HCustom][${symbol}] oc=OK ts=${row.timestamp}`);

    return {
      timestamp: Number(row.timestamp),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume),
      confirm: row.confirm
    };

  } catch (err) {
    console.log(`[1HCustom][${symbol}] ERROR getOpenCandle1H:`, err);
    return null;
  }
}

// ---------------------------------------------------------
// GUARDAR VELA CUSTOM (inclou confirm)
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

  const query = `
    INSERT INTO candles (
      symbol, timeframe, timestamp,
      open, high, low, close, volume,
      timestamp_es, date_es, created_at, confirm
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (symbol, timeframe, timestamp)
    DO UPDATE SET
      open=$4, high=$5, low=$6, close=$7, volume=$8,
      timestamp_es=$9, date_es=$10,
      created_at=$11,
      confirm=$12;
  `;

  const values = [
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
    created_at,
    c.confirm
  ];

  console.log("\n================ QUERY 1HCustom ================");
  console.log(query);
  console.log("VALUES:", JSON.stringify(values, null, 2));
  console.log("================================================\n");

  try {
    await client.query(query, values);
  } catch (err) {
    console.log(`[1HCustom][${symbol}] ERROR PG:`, err);
  }
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

  console.log(`\n[1HCustom][${symbol}] INICI offsetMinutes=${offsetMinutes}`);

  if (!Number.isFinite(offsetMinutes)) {
    console.log(`[1HCustom][${symbol}] ERROR: offsetMinutes undefined`);
    return;
  }

  const timeframe = `1H${offsetMinutes}m`;
  const offsetMs = offsetMinutes * 60000;

  const openHourTs = getHourOpenTs();
  const nextStart = openHourTs + offsetMs;
  const now = Date.now();

  console.log(`[1HCustom][${symbol}] openHourTs=${openHourTs} nextStart=${nextStart} now=${now}`);

  if (!current[symbol]) current[symbol] = {};
  if (!current[symbol][timeframe]) current[symbol][timeframe] = null;

  console.log(`[1HCustom][${symbol}] current=${JSON.stringify(current[symbol][timeframe])}`);

  // 1) NO HI HA VELA OBERTA → crear-la quan toca
  if (!current[symbol][timeframe]) {

    if (now < nextStart) {
      console.log(`[1HCustom][${symbol}] Encara no toca crear la primera vela`);
      return;
    }

    const oc = await getOpenCandle1H(symbol);
    if (!oc) {
      console.log(`[1HCustom][${symbol}] No hi ha oc → no es crea la primera vela`);
      return;
    }

    current[symbol][timeframe] = {
      timestamp: nextStart,     // 🔥 FIAT CORREGIT
      startTs: nextStart,
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0,
      confirm: 0
    };

    console.log(`[1HCustom][${symbol}] PRIMERA VELA CREADA startTs=${nextStart}`);

    await storeCandle1HCustom(symbol, timeframe, current[symbol][timeframe]);
    return;
  }

  const c = current[symbol][timeframe];

  // 2) ACTUALITZAR VELA OBERTA (encara no ha passat 1 hora)
  if (now < c.startTs + 3600000) {

    const oc = await getOpenCandle1H(symbol);
    if (!oc) {
      console.log(`[1HCustom][${symbol}] oc=NULL → no actualitzem`);
      return;
    }

    const price = oc.close;
    const vol   = oc.volume || 0;

    c.high = Math.max(c.high, price);
    c.low  = Math.min(c.low,  price);
    c.close = price;
    c.volume += vol;
    c.confirm = 0;
    c.timestamp = c.startTs;   // 🔥 FIAT CORREGIT

    console.log(`[1HCustom][${symbol}] ACTUALITZANT VELA OBERTA`);

    await storeCandle1HCustom(symbol, timeframe, c);
    return;
  }

  // 3) TANCAR I CREAR NOVA
  console.log(`[1HCustom][${symbol}] TANCANT VELA`);
  c.confirm = 1;
  c.timestamp = c.startTs;   // 🔥 FIAT CORREGIT

  await storeCandle1HCustom(symbol, timeframe, c);

  const oc = await getOpenCandle1H(symbol);
  if (!oc) {
    console.log(`[1HCustom][${symbol}] oc=NULL → no es crea nova vela`);
    return;
  }

  const newStart = c.startTs + 3600000;

  current[symbol][timeframe] = {
    timestamp: newStart,     // 🔥 FIAT CORREGIT
    startTs: newStart,
    open: oc.close,
    high: oc.close,
    low: oc.close,
    close: oc.close,
    volume: oc.volume || 0,
    confirm: 0
  };

  console.log(`[1HCustom][${symbol}] NOVA VELA CREADA startTs=${newStart}`);

  await storeCandle1HCustom(symbol, timeframe, current[symbol][timeframe]);
}

// ---------------------------------------------------------
// PER A LA DETECCIÓ: afegir la vela oberta al conjunt tancat
// ---------------------------------------------------------
export function getCandlesForDetection1HCustom(symbol, timeframe, closedCandles) {
  const openCandle = current[symbol]?.[timeframe];
  return openCandle ? [...closedCandles, openCandle] : closedCandles;
}
