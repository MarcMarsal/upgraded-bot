import axios from "axios";
import { client } from "../db/client.js";

// Variables d'entorn
const API_OKX     = process.env.API_URL;
const API_WEEX    = process.env.API_WEEX;
const API_BITUNIX = process.env.API_BITUNIX;

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
function toInternal(ts, o, h, l, c, v) {
  return {
    timestamp: ts,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v
  };
}

// -------------------------------------------------------------
// GUARDAR A TAULA
// -------------------------------------------------------------
async function storeCandle(table, symbol, timeframe, c) {

  const timestamp_es = new Date(
    new Date(c.timestamp).toLocaleString("en-US", {
      timeZone: "Europe/Madrid"
    })
  ).getTime();

  const date_es = new Date(c.timestamp).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).replace(",", "");

  await client.query(
    `
    INSERT INTO ${table} (symbol, timeframe, timestamp, open, high, low, close, volume, timestamp_es, date_es)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (symbol, timeframe, timestamp)
    DO UPDATE SET
      open=$4, high=$5, low=$6, close=$7, volume=$8,
      timestamp_es=$9, date_es=$10;
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
      date_es
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
    const res = await axios.get(url);
    const data = res.data.data;

    if (!data || data.length === 0) return [];

    return data.map(k => {
      const ts = normalizeTimestamp(parseInt(k[0]));
      if (!ts) return null;

      return toInternal(
        ts,
        parseFloat(k[1]),
        parseFloat(k[2]),
        parseFloat(k[3]),
        parseFloat(k[4]),
        parseFloat(k[5])
      );
    }).filter(Boolean);

  } catch (err) {
    console.log("❌ Error OKX:", symbol, timeframe, err.message);
    return [];
  }
}

// -------------------------------------------------------------
// FETCH WEEX → TAULA candles_weex
// -------------------------------------------------------------
async function fetchWeex(symbol, timeframe) {
  try {
    const sym = normalizeSymbolFor("WEEX", symbol);
    const tf  = normalizeTimeframeFor("WEEX", timeframe);

    const url = `${API_WEEX}?symbol=${sym}&interval=${tf}`;
    //console.log("WEEX URL FINAL:", url);

    //const res = await axios.get(url);
    const res = await axios.get(url, {headers: {"User-Agent": "Mozilla/5.0","Accept": "application/json"}});

    const data = res.data.data;
    //console.log(res.data);
    if (!data || data.length === 0) return [];

    return data.map(k => {
      const ts = normalizeTimestamp(k.t);
      if (!ts) return null;

      return toInternal(
        ts,
        parseFloat(k[1]), // open
        parseFloat(k[2]), // high
        parseFloat(k[3]), // low
        parseFloat(k[4]), // close
        parseFloat(k[5])  // volume
      );
    }).filter(Boolean);

  } catch (err) {
    console.log("❌ Error WEEX:", symbol, timeframe, err.message);
    return [];
  }
}

// -------------------------------------------------------------
// FETCH BITUNIX → TAULA candles_bitunix
// -------------------------------------------------------------
async function fetchBitunix(symbol, timeframe) {
  try {
    const sym = normalizeSymbolFor("BITUNIX", symbol);
    const tf  = normalizeTimeframeFor("BITUNIX", timeframe);

    const url = `${API_BITUNIX}?symbol=${sym}&interval=${tf}&limit=100`;
    const res = await axios.get(url);
    const data = res.data.data;

    if (!data || data.length === 0) return [];

    return data.map(k => {
      const ts = normalizeTimestamp(k.ts);
      if (!ts) return null;

      return toInternal(
        ts,
        parseFloat(k.open),
        parseFloat(k.high),
        parseFloat(k.low),
        parseFloat(k.close),
        parseFloat(k.volume)
      );
    }).filter(Boolean);

  } catch (err) {
    console.log("❌ Error BITUNIX:", symbol, timeframe, err.message);
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

    // WEEX
    const weex = await fetchWeex(symbol, timeframe);
    for (const c of weex) await storeCandle("candles_weex", symbol, timeframe, c);

    // BITUNIX
    const bitunix = await fetchBitunix(symbol, timeframe);
    for (const c of bitunix) await storeCandle("candles_bitunix", symbol, timeframe, c);

    //console.log(`✔ Candles guardades: ${symbol} ${timeframe}`);

  } catch (err) {
    console.log("❌ Error general descarregant veles:", symbol, timeframe, err.message);
  }
}
