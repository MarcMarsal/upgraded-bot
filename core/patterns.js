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
// core/patterns.js — detectMSES FIAT‑PRO (MS/ES RAW + body3 + range1 + ratio + GOOD + color)

export function detectMSES(candles, symbol, timeframe) {
  const signals = [];

  if (!candles || candles.length < 4) {
    return { signals };
  }

  for (let i = 3; i < candles.length; i++) {

    let c1 = candles[i - 3];
    let c2 = candles[i - 2];
    let c3 = candles[i - 1];

    // ============================
    // NORMALITZACIÓ PEPE (igual que Pine)
    // ============================
    //if (symbol === "PEPE-USDT") {
    //  const k = 1000;

    //  c1 = { ...c1, open: c1.open * k, high: c1.high * k, low: c1.low * k, close: c1.close * k };
    //  c2 = { ...c2, open: c2.open * k, close: c2.close * k };
    //  c3 = { ...c3, open: c3.open * k, high: c3.high * k, low: c3.low * k, close: c3.close * k };
    //}

    // ============================
    // RAW BASE (igual que Pine)
    // ============================
    const rawMS =
      c1.close < c1.open &&
      Math.abs(c2.close - c2.open) <= (c1.high - c1.low) * 0.3 &&
      c3.close > c3.open;

    const rawES =
      c1.close > c1.open &&
      Math.abs(c2.close - c2.open) <= (c1.high - c1.low) * 0.3 &&
      c3.close < c3.open;

    // ============================
    // MICRO-PULSE (cos + metxes)
    // ============================
    const body3 = Math.abs(c3.close - c3.open);
    const range3 = c3.high - c3.low;

    const wickUp = c3.high - Math.max(c3.open, c3.close);
    const wickDn = Math.min(c3.open, c3.close) - c3.low;

    const cosOK = body3 > range3 * 0.35;
    const wicksOK = wickUp < range3 * 0.4 && wickDn < range3 * 0.4;

    const msCond = rawMS && cosOK && wicksOK;
    const esCond = rawES && cosOK && wicksOK;

    if (!msCond && !esCond) continue;

    const type = msCond ? "M" : "E";

    // ============================
    // FIAT‑PRO: càlculs de la 3a vela
    // ============================
    const range1 = c1.high - c1.low;
    const ratio = range1 !== 0 ? body3 / range1 : 0;

    // ============================
    // FIAT‑PRO: GOOD / DISCARD
    // ============================
    const isGood = body3 > range1 * 0.25;

    // ============================
    // FIAT‑PRO: color
    // ============================
    const color = isGood
      ? (type === "M" ? "green" : "red")
      : "blue";

    // ============================
    // Timestamp
    // ============================
    const ts = c3.timestamp;

    // ============================
    // Retorn FIAT‑PRO complet
    // ============================
    signals.push({
      symbol,
      timeframe,
      type,
      timestamp: ts,

      thirdCandle: {
        open: c3.open,
        close: c3.close,
        high: c3.high,
        low: c3.low,
        timestamp: c3.timestamp   // 🔥 FIAT
      },

      body3,
      range1,
      ratio,
      isGood,
      color
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
