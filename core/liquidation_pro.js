// core/liquidation_pro.js — Liquidation Map PRO (Pas 1: dades crues OKX)
import { client } from "../db/client.js";
import { rebuildProTiersForSymbol } from "./liquidation_pro_tiers.js";
import { buildClustersForSymbol } from "./liquidation_pro_cluster.js";
import { buildLiquidationMapForSymbol } from "./liquidation_pro_map.js";

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

// Position Tiers
async function fetchPositionTiers(symbol) {
  const instFamily = symbol;
  const url = `https://www.okx.com/api/v5/public/position-tiers?instType=SWAP&tdMode=cross&instFamily=${instFamily}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json || json.code !== "0") return null;
  return json.data;
}

/**
 * Actualitza la taula liquidation_pro_state
 */
export async function updateProLiquidity(symbol) {
  console.log(`\n[PRO] Actualitzant dades OKX per ${symbol}`);

  const instId = SWAP_MAP[symbol] ?? symbol;

  try {
    const [oi, mark, tiers] = await Promise.all([
      fetchOpenInterest(instId),
      fetchMarkPrice(instId),
      fetchPositionTiers(symbol)
    ]);

    console.log(`[PRO] ${symbol} OI:`, oi);
    console.log(`[PRO] ${symbol} MARK:`, mark);
    console.log(`[PRO] ${symbol} TIERS LENGTH:`, tiers?.length);

    if (!mark || !tiers) {
      console.error(`❌ [PRO] ${symbol} dades incompletes`, { oi, mark, tiers });

      await client.query(
        `INSERT INTO liquidation_pro_state (symbol, state, updated_at)
         VALUES ($1,'error',NOW())
         ON CONFLICT (symbol)
         DO UPDATE SET state='error', updated_at=NOW()`,
        [symbol]
      );

      return;
    }

    if (!oi) {
      console.warn(`⚠️ [PRO] ${symbol} OI null — continuem igualment`);
    }

    await client.query(
      `INSERT INTO liquidation_pro_state
       (symbol, instid, oi, oi_usd, mark_price, tiers, state, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'ok',NOW())
       ON CONFLICT (symbol)
       DO UPDATE SET instid=$2, oi=$3, oi_usd=$4, mark_price=$5,
                     tiers=$6, state='ok', updated_at=NOW()`,
      [
        symbol,
        instId,               // OKX → instId, DB → instid
        oi?.oi ?? null,
        oi?.oiUsd ?? null,
        mark.markPx,
        JSON.stringify(tiers)
      ]
    );

    console.log(`[PRO] ${symbol} estat OK → reconstruint tiers…`);

    await rebuildProTiersForSymbol(symbol);
    console.log(`[PRO] ${symbol} tiers OK`);

    await buildClustersForSymbol(symbol);
    console.log(`[PRO] ${symbol} clusters OK`);

    await buildLiquidationMapForSymbol(symbol);
    console.log(`[PRO] ${symbol} map OK`);

  } catch (err) {
    console.error(`🔥🔥🔥 ERROR updateProLiquidity(${symbol})`);
    console.error("Nom:", err.name);
    console.error("Missatge:", err.message);
    console.error("Stack:", err.stack);

    await client.query(
      `INSERT INTO liquidation_pro_state (symbol, state, updated_at)
       VALUES ($1,'error',NOW())
       ON CONFLICT (symbol)
       DO UPDATE SET state='error', updated_at=NOW()`,
      [symbol]
    );
  }
}
