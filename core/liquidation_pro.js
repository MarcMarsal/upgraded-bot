// core/liquidation_pro.js — Liquidation Map PRO (Pas 1: dades crues OKX)

import { client } from "../db/client.js";

// Map spot → swap instId OKX
const SWAP_MAP = {
  "BTC-USDT": "BTC-USDT-SWAP",
  "ETH-USDT": "ETH-USDT-SWAP",
  "SOL-USDT": "SOL-USDT-SWAP"
};

// Helper genèric per fer fetch JSON
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json.code !== "0") {
    throw new Error(`OKX code ${json.code} msg ${json.msg}`);
  }
  return json.data;
}

// Open Interest
async function fetchOpenInterest(instId) {
  const url = `https://www.okx.com/api/v5/public/open-interest?instId=${instId}`;
  const data = await fetchJson(url);
  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    oi: Number(row.oi),
    oiCcy: Number(row.oiCcy),
    oiUsd: Number(row.oiUsd),
    ts: Number(row.ts)
  };
}

// Mark Price
async function fetchMarkPrice(instId) {
  const url = `https://www.okx.com/api/v5/public/mark-price?instId=${instId}`;
  const data = await fetchJson(url);
  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    markPx: Number(row.markPx),
    ts: Number(row.ts)
  };
}

// Position Tiers (risk limits / leverage trams)
async function fetchPositionTiers(instId) {
  const url = `https://www.okx.com/api/v5/public/position-tiers?instId=${instId}`;
  const data = await fetchJson(url);
  if (!data || data.length === 0) return null;

  // Guardem tal qual en JSON per no inventar res
  return data;
}

/**
 * Actualitza la taula liquidation_pro_state amb:
 * - symbol
 * - instId
 * - oi, oiUsd
 * - mark_price
 * - tiers (JSON brut d’OKX)
 * - updated_at
 * - state: 'ok' | 'error'
 */
export async function updateProLiquidity(symbol) {
  const instId = SWAP_MAP[symbol];
  if (!instId) {
    await client.query(
      `
      INSERT INTO liquidation_pro_state (symbol, state, updated_at)
      VALUES ($1,'error',NOW())
      ON CONFLICT (symbol)
      DO UPDATE SET state='error', updated_at=NOW()
      `,
      [symbol]
    );
    return;
  }

  try {
    const [oi, mark, tiers] = await Promise.all([
      fetchOpenInterest(instId),
      fetchMarkPrice(instId),
      fetchPositionTiers(instId)
    ]);

    if (!oi || !mark || !tiers) {
      await client.query(
        `
        INSERT INTO liquidation_pro_state (symbol, instId, state, updated_at)
        VALUES ($1,$2,'error',NOW())
        ON CONFLICT (symbol)
        DO UPDATE SET instId=$2, state='error', updated_at=NOW()
        `,
        [symbol, instId]
      );
      return;
    }

    await client.query(
      `
      INSERT INTO liquidation_pro_state
      (symbol, instId, oi, oi_usd, mark_price, tiers, state, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,'ok',NOW())
      ON CONFLICT (symbol)
      DO UPDATE SET
        instId=$2,
        oi=$3,
        oi_usd=$4,
        mark_price=$5,
        tiers=$6,
        state='ok',
        updated_at=NOW()
      `,
      [symbol, instId, oi.oi, oi.oiUsd, mark.markPx, JSON.stringify(tiers)]
    );
  } catch (err) {
    await client.query(
      `
      INSERT INTO liquidation_pro_state (symbol, instId, state, updated_at)
      VALUES ($1,$2,'error',NOW())
      ON CONFLICT (symbol)
      DO UPDATE SET instId=$2, state='error', updated_at=NOW()
      `,
      [symbol, instId]
    );
  }
}

