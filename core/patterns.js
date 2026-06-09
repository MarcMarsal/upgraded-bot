// core/patterns.js — FIAT 2.0 1:1 TradingView

import { ema, sma } from "./ta.js";
import { isBull, isBear } from "./utils.js";
import { client } from "../db/client.js";

function ema_TV(values, length) {
  const alpha = 2 / (length + 1);
  const ema = new Array(values.length);

  // Seed TradingView: mitjana simple dels primers N valors
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += values[i];
  }
  ema[length - 1] = sum / length;

  // A partir d'aquí, EMA estàndard
  for (let i = length; i < values.length; i++) {
    ema[i] = ema[i - 1] + alpha * (values[i] - ema[i - 1]);
  }

  // Omplir els primers valors amb el primer EMA
  for (let i = 0; i < length - 1; i++) {
    ema[i] = ema[length - 1];
  }

  return ema;
}


// -------------------------------------------------------------
// detectMSES — només detecció de patrons MS / ES
// -------------------------------------------------------------

function isBull(o, c) {
  return c > o;
}

function isBear(o, c) {
  return c < o;
}

// -------------------------------------------------------------
// detectMSES — només detecció de patrons MS / ES
// -------------------------------------------------------------
export async function detectMSES(candlesRaw, symbol, timeframe) {
  if (!candlesRaw || candlesRaw.length < 5) {
    return { signals: [] };
  }

  // ordre cronològic
  const candles = [...candlesRaw].sort((a, b) => a.timestamp - b.timestamp);
  const n = candles.length;

  const signals = [];

  for (let i = 3; i < n; i++) {
    const c3 = candles[i - 3];
    const c2 = candles[i - 2];
    const c1 = candles[i - 1]; // tercera vela del patró

    const rangeFirst = c3.high - c3.low;
    const indecisionOK =
      rangeFirst === 0
        ? true
        : Math.abs(c2.close - c2.open) <= rangeFirst * 0.3;

    const msRaw =
      isBear(c3.open, c3.close) &&
      indecisionOK &&
      isBull(c1.open, c1.close);

    const esRaw =
      isBull(c3.open, c3.close) &&
      indecisionOK &&
      isBear(c1.open, c1.close);

    if (!msRaw && !esRaw) continue;

    const type = msRaw ? "M" : "E";
    const thirdCandle = c1;
    const timestamp = thirdCandle.timestamp;

    signals.push({
      symbol,
      timeframe,
      type,
      timestamp,
      thirdCandle
    });
  }

  return { signals };
}


// -------------------------------------------------------------
// FIAT 2.0 — Pesos per cripto (1:1 TradingView)
// -------------------------------------------------------------
const FIAT2_CONFIG = {
  "ADA-USDT":   { wMag: 1, wMacd: 1, wTrend: 4, wSat: 1, thr: 1 },
  "APT-USDT":   { wMag: 0, wMacd: 1, wTrend: 1, wSat: 0, thr: 1 },
  "ARB-USDT":   { wMag: 0, wMacd: 1, wTrend: 2, wSat: 1, thr: 1 },
  "ASTER-USDT": { wMag: 1, wMacd: 1, wTrend: 4, wSat: 0, thr: 1 },
  "ATOM-USDT":  { wMag: 0, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 },
  "AVAX-USDT":  { wMag: 0, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 },
  "BCH-USDT":   { wMag: 0, wMacd: 1, wTrend: 1, wSat: 0, thr: 1 },
  "BNB-USDT":   { wMag: 1, wMacd: 1, wTrend: 4, wSat: 1, thr: 1 },
  "BTC-USDT":   { wMag: 0, wMacd: 1, wTrend: 2, wSat: 1, thr: 1 },
  "DOT-USDT":   { wMag: 1, wMacd: 1, wTrend: 4, wSat: 0, thr: 1 },
  "ETH-USDT":   { wMag: 1, wMacd: 1, wTrend: 2, wSat: 1, thr: 1 },
  "HBAR-USDT":  { wMag: 1, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 },
  "INJ-USDT":   { wMag: 0, wMacd: 1, wTrend: 2, wSat: 1, thr: 1 },
  "NEAR-USDT":  { wMag: 1, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 },
  "OP-USDT":    { wMag: 0, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 },
  "RENDER-USDT":{ wMag: 0, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 },
  "SEI-USDT":   { wMag: 0, wMacd: 1, wTrend: 2, wSat: 1, thr: 1 },
  "SUI-USDT":   { wMag: 2, wMacd: 1, wTrend: 2, wSat: 1, thr: 1 },
  "VIRTUAL-USDT":{ wMag: 0, wMacd: 1, wTrend: 1, wSat: 0, thr: 1 },
  "XRP-USDT":   { wMag: 0, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 },

  // ja existien:
  "LINK-USDT":  { wMag: 0, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 },
  "SOL-USDT":   { wMag: 1, wMacd: 1, wTrend: 2, wSat: 0, thr: 1 }
};



// -------------------------------------------------------------
// FIAT 2.0 — Obtenir configuració per cripto
// -------------------------------------------------------------
function getFiat2Config(symbol) {
  return FIAT2_CONFIG[symbol] || { wMag: 0, wMacd: 1, wTrend: 1, wSat: 0, thr: 1 };
}

// -------------------------------------------------------------
// FIAT 2.0 — Càlcul del score (1:1 TradingView)
// -------------------------------------------------------------
function applyFiat2Score(magPts, macdPts, trendPts, satPts, symbol) {
  const cfg = getFiat2Config(symbol);

  const score =
    cfg.wMag   * magPts +
    cfg.wMacd  * macdPts +
    cfg.wTrend * trendPts +
    cfg.wSat   * satPts;

  const isGood = score >= cfg.thr;

  return { score, isGood, magPts, macdPts, trendPts, satPts };
}

// -------------------------------------------------------------
// STDEV helper (equivalent a ta.stdev(histSmooth, 20))
// -------------------------------------------------------------
function stdev(arr, period) {
  if (!arr || arr.length < period) return 0;
  const slice = arr.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;

  const variance =
    slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
    (period - 1);

  return Math.sqrt(variance);
}
