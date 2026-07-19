// core/marketState.js — FIAT‑PRO (multi‑cripto)

import { client } from "../db/client.js";

// 🟩 Llindars FIAT per cada cripto
// (adaptats a volum institucional vs volum retail)
const THRESHOLDS = {
  "BTC-USDT": { volume: 150, body: 80, range: 150, wick: 40 },
  "ETH-USDT": { volume: 120, body: 70, range: 130, wick: 35 },
  "SOL-USDT": { volume: 100, body: 60, range: 120, wick: 30 },

  "AVAX-USDT": { volume: 60, body: 40, range: 80, wick: 20 },
  "DOT-USDT":  { volume: 40, body: 30, range: 60, wick: 15 },
  "SUI-USDT":  { volume: 25, body: 20, range: 40, wick: 10 },
  "SEI-USDT":  { volume: 20, body: 18, range: 35, wick: 10 },
  "OP-USDT":   { volume: 30, body: 25, range: 50, wick: 15 },
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
