// Fitxer fetchcandles.js

import axios from "axios";
import { client } from "../db/client.js";

// Variables d'entorn
const API_OKX     = process.env.API_URL;

// -------------------------------------------------------------
// NORMALITZAR TIMESTAMP
// -------------------------------------------------------------
function normalizeTimestamp(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number") return null;
  if (raw === 0) return null;
  if (raw < 1600000000000) return null; // ms (2020+)
  return raw;
}

// -------------------------------------------------------------
// NORMALITZAR SYMBOL PER EXCHANGE
// -------------------------------------------------------------
function normalizeSymbolFor(exchange, symbol) {
  if (exchange === "OKX") return symbol;       // BTC-USDT
  return symbol.replace("-", "");              // BTCUSDT
}

// -------------------------------------------------------------
// NORMALITZAR TIMEFRAME PER EXCHANGE
// -------------------------------------------------------------
function normalizeTimeframeFor(exchange, timeframe) {
  if (exchange === "OKX") return timeframe;    // 1H
  return timeframe.toLowerCase();              // 1h
}

// -------------------------------------------------------------
// FORMAT INTERN MICRO‑PULSE
// -------------------------------------------------------------
function toInternal(ts, o, h, l, c, v, confirm) {
  return {
    timestamp: ts,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
    confirm: confirm
  };
}

// -------------------------------------------------------------
// GUARDAR A TAULA
// -------------------------------------------------------------

async function storeCandle(table, symbol, timeframe, c) {

  // Timestamp en hora espanyola
  const timestamp_es = new Date(
    new Date(c.timestamp).toLocaleString("en-US", {
      timeZone: "Europe/Madrid"
    })
  ).getTime();

  // Data humana en hora espanyola
  const date_es = new Date(c.timestamp).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).replace(",", "");

  // Hora real de creació FIAT
  const created_at = Date.now();

  await client.query(
    `
    INSERT INTO ${table} (
      symbol, timeframe, timestamp,
      open, high, low, close, volume,
      timestamp_es, date_es, created_at, confirm
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12)
    ON CONFLICT (symbol, timeframe, timestamp)
    DO UPDATE SET
      open=$4, high=$5, low=$6, close=$7, volume=$8,
      timestamp_es=$9, date_es=$10,
      created_at=$11,
      confirm=$12;
    `,
    [
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
    ]
  );
}

// -------------------------------------------------------------
// FETCH OKX → TAULA candles
// -------------------------------------------------------------
async function fetchOKX(symbol, timeframe) {
  try {
    const sym = normalizeSymbolFor("OKX", symbol);
    const tf  = normalizeTimeframeFor("OKX", timeframe);

    const url = `${API_OKX}?instId=${sym}&bar=${tf}&limit=4`;
    //const url = `${API_OKX}?instId=${sym}&bar=${tf}&limit=50`;
    //const url = `${API_OKX}?instId=${sym}&bar=${tf}&limit=300`;
    const res = await axios.get(url);
    const data = res.data.data;

    //if (!data || data.length === 0) return [];
    if (!data || data.length === 0) {
      console.log(`⚠️ OKX sense dades per ${symbol} ${timeframe}`);
      return [];
    }


    return data.map(k => {
      const ts = normalizeTimestamp(parseInt(k[0]));
      if (!ts) return null;

      return toInternal(
        ts,
        parseFloat(k[1]),
        parseFloat(k[2]),
        parseFloat(k[3]),
        parseFloat(k[4]),
        parseFloat(k[5]),
        parseInt(k[8])
      );
    }).filter(Boolean);

  } catch (err) {
    console.log("❌ Error OKX:", symbol, timeframe, err.message);
    return [];
  }
}

// -------------------------------------------------------------
// FETCH + STORE (OKX → candles, WEEX → candles_weex, BITUNIX → candles_bitunix)
// -------------------------------------------------------------
export async function fetchAndStoreCandles(symbol, timeframe) {
  try {
    // OKX
    const okx = await fetchOKX(symbol, timeframe);
    for (const c of okx) await storeCandle("candles", symbol, timeframe, c);

  } catch (err) {
    console.log("❌ Error general descarregant veles:", symbol, timeframe, err.message);
  }
}



