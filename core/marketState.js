// core/marketState.js — FIAT‑PRO (multi‑cripto)

import { client } from "../db/client.js";

// 🟩 Llindars FIAT per cada cripto
// (adaptats a volum institucional vs volum retail)
const THRESHOLDS = {
  // 🟩 Institucionals
  "ETH-USDT":     { volume: 20000, body: 20, range: 30, wick: 8 },
  "SOL-USDT": { volume: 50000, body: 1.0, range: 1.5, wick: 1.0 },
  "BNB-USDT": { volume: 384.42, body: 0.10, range: 2.20, wick: 2.10 },

  

  // 🟦 Mid‑cap retail
  "AVAX-USDT":    { volume: 60, body: 40, range: 80,  wick: 20 },
  "DOT-USDT":     { volume: 40, body: 30, range: 60,  wick: 15 },
  "INJ-USDT":     { volume: 45, body: 35, range: 70,  wick: 18 },
  "LINK-USDT":    { volume: 50, body: 35, range: 75,  wick: 18 },
  "XRP-USDT":     { volume: 55, body: 38, range: 75,  wick: 20 },

  // 🟥 Low‑cap retail
  "SEI-USDT":     { volume: 20, body: 18, range: 35,  wick: 10 },
  
  //"SUI-USDT":     { volume: 25, body: 20, range: 40,  wick: 10 },
  "SUI-USDT":     { volume: 700000, body: 0.010, range: 0.015, wick: 0.004 },


  "HBAR-USDT":    { volume: 22, body: 18, range: 35,  wick: 10 },
  "ARB-USDT":     { volume: 30, body: 25, range: 50,  wick: 15 },

  // 🟧 Especial
  "VIRTUAL-USDT": { volume: 10, body: 10, range: 25,  wick: 8 },
};


// 🟩 FIAT — DETECTOR D’ESTAT DEL MERCAT PER CRIPTO
export async function getMarketState(symbol) {
  try {
    const q = await client.query(`
      SELECT open, high, low, close, volume
      FROM candles
      WHERE symbol=$1 AND timeframe='1H'
      ORDER BY timestamp DESC
      LIMIT 24
    `, [symbol]);

    const candles = q.rows;
    if (!candles || candles.length === 0) return "MORT";

    // 🟩 Càlcul FIAT
    const avgVolume =
      candles.reduce((a, c) => a + Number(c.volume || 0), 0) / candles.length;

    const avgBody =
      candles.reduce((a, c) => a + Math.abs((c.close || 0) - (c.open || 0)), 0) /
      candles.length;

    const highs = candles.map(c => Number(c.high || 0));
    const lows = candles.map(c => Number(c.low || 0));
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const range = maxHigh - minLow;

    const avgWick =
      candles.reduce((a, c) => {
        const upper = (c.high || 0) - Math.max(c.open || 0, c.close || 0);
        const lower = Math.min(c.open || 0, c.close || 0) - (c.low || 0);
        return a + (upper + lower);
      }, 0) / candles.length;

    // 🟩 Llindars per cripto
    const t = THRESHOLDS[symbol] || THRESHOLDS["BTC-USDT"];

    let score = 0;
    if (avgVolume > t.volume) score++;
    if (avgBody > t.body) score++;
    if (range > t.range) score++;
    if (avgWick > t.wick) score++;

    if (score >= 3) return "VIU";
    if (score === 2) return "RECONSTRUCCIO";
    return "MORT";

  } catch (err) {
    console.error("❌ Error getMarketState:", err);
    return "ERROR";
  }
}

// 🟩 FIAT — Estat global del conjunt de criptos
export async function getGlobalMarketState(symbols) {
  const states = await Promise.all(symbols.map(s => getMarketState(s)));
  const alive = states.filter(st => st === "VIU").length;
  const total = states.length;

  return {
    states,
    alive,
    total,
    ratio: alive / total,
    global:
      alive / total < 0.10 ? "GLOBAL_MORT"
      : alive / total < 0.30 ? "GLOBAL_RECONSTRUCCIO"
      : "GLOBAL_VIU"
  };
}
