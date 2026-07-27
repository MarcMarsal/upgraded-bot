import axios from "axios";
import { client } from "../db/client.js";

// Variables d'entorn
const API_OKX     = process.env.API_OKX;
const API_WEEX    = process.env.API_WEEX;
const API_BITUNIX = process.env.API_BITUNIX;

// Validació robusta del timestamp (en mil·lisegons)
function normalizeTimestamp(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number") return null;
  if (raw === 0) return null;
  if (raw < 1600000000000) return null; // ms (2020+)
  return raw;
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
// FETCH OKX
// -------------------------------------------------------------
async function fetchOKX(symbol, timeframe) {
  try {
    const url = `${API_OKX}?instId=${symbol}&bar=${timeframe}&limit=4`;
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
// FETCH WEEX
// -------------------------------------------------------------
async function fetchWeex(symbol, timeframe) {
  try {
    const url = `${API_WEEX}?symbol=${symbol}&interval=${timeframe}`;
    const res = await axios.get(url);
    const data = res.data.data;

    if (!data || data.length === 0) return [];

    return data.map(k => {
      const ts = normalizeTimestamp(k.t);
      if (!ts) return null;

      return toInternal(
        ts,
        parseFloat(k.o),
        parseFloat(k.h),
        parseFloat(k.l),
        parseFloat(k.c),
        parseFloat(k.v)
      );
    }).filter(Boolean);

  } catch (err) {
    console.log("❌ Error WEEX:", symbol, timeframe, err.message);
    return [];
  }
}

// -------------------------------------------------------------
// FETCH BITUNIX
// -------------------------------------------------------------
async function fetchBitunix(symbol, timeframe) {
  try {
    const url = `${API_BITUNIX}?symbol=${symbol}&interval=${timeframe}&limit=100`;
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
// FETCH + STORE (OKX + WEEX + BITUNIX)
// -------------------------------------------------------------
export async function fetchAndStoreCandles(symbol, timeframe) {
  try {
    // OKX
    const okx = await fetchOKX(symbol, timeframe);
    for (const c of okx) await storeCandle("candles_okx", symbol, timeframe, c);

    // WEEX
    const weex = await fetchWeex(symbol, timeframe);
    for (const c of weex) await storeCandle("candles_weex", symbol, timeframe, c);

    // BITUNIX
    const bitunix = await fetchBitunix(symbol, timeframe);
    for (const c of bitunix) await storeCandle("candles_bitunix", symbol, timeframe, c);

    console.log(`✔ Candles guardades: ${symbol} ${timeframe}`);

  } catch (err) {
    console.log("❌ Error general descarregant veles:", symbol, timeframe, err.message);
  }
}
