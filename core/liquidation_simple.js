// core/liquidation_simple.js — Liquidation Map SIMPLE (OKX estimated-price)

//import fetch from "node-fetch";
import { client } from "../db/client.js";

// Map spot → swap
const SWAP_MAP = {
  "BTC-USDT": "BTC-USDT-SWAP",
  "ETH-USDT": "ETH-USDT-SWAP",
  "SOL-USDT": "SOL-USDT-SWAP"
};

// Distància mínima perquè tingui sentit (en % del preu actual)
const MIN_REL_DIST = 0.005;   // 0.5%
const WATCH_REL_DIST = 0.01;  // 1%
const ENTRY_REL_DIST = 0.02;  // 2%

async function fetchEstimatedLiqPrice(symbol) {
  const instId = SWAP_MAP[symbol];
  if (!instId) return null;

  const url = `https://www.okx.com/api/v5/public/estimated-price?instId=${instId}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  if (!json.data || json.data.length === 0) return null;

  const row = json.data[0];
  const liqPrice = Number(row.settlePx);
  const ts = Number(row.ts);

  if (!liqPrice || !ts) return null;

  return { liqPrice, ts };
}

/**
 * Actualitza la taula liquidation_simple_state amb:
 * - symbol
 * - liq_price
 * - distance (relativa al preu actual)
 * - state: none / watch / entry
 */
export async function updateSimpleLiquidity(symbol, currentPrice) {
  const est = await fetchEstimatedLiqPrice(symbol);
  if (!est) {
    await client.query(
      `
      INSERT INTO liquidation_simple_state (symbol, state, updated_at)
      VALUES ($1,'none',NOW())
      ON CONFLICT (symbol)
      DO UPDATE SET state='none', updated_at=NOW()
      `,
      [symbol]
    );
    return;
  }

  const { liqPrice } = est;

  const absDist = Math.abs(liqPrice - currentPrice);
  const relDist = absDist / currentPrice; // en proporció (0.01 = 1%)

  let state = "none";

  if (relDist <= ENTRY_REL_DIST) {
    state = "entry";
  } else if (relDist <= WATCH_REL_DIST) {
    state = "watch";
  } else if (relDist < MIN_REL_DIST) {
    state = "none";
  }

  await client.query(
    `
    INSERT INTO liquidation_simple_state
    (symbol, liq_price, distance, state, updated_at)
    VALUES ($1,$2,$3,$4,NOW())
    ON CONFLICT (symbol)
    DO UPDATE SET
      liq_price=$2,
      distance=$3,
      state=$4,
      updated_at=NOW()
    `,
    [symbol, liqPrice, relDist, state]
  );
}
