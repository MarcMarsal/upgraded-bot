// liquidation_pro_tiers.js
// Suposem que ja tens a liquidation_pro_state:
// symbol, instId, oi, oi_usd, mark_price, tiers (JSON)

import { client } from "../db/client.js";

export async function rebuildProTiersForSymbol(symbol) {
  const { rows } = await client.query(
    `SELECT instId, mark_price, tiers
     FROM liquidation_pro_state
     WHERE symbol = $1 AND state = 'ok'`,
    [symbol]
  );
  if (!rows.length) return;

  const { instId, mark_price, tiers } = rows[0];
  const markPx = Number(mark_price);
  
  const parsed = Array.isArray(tiers) ? tiers : JSON.parse(tiers);


  // Esborrem trams antics per aquest symbol
  await client.query(
    `DELETE FROM liquidation_pro_tiers WHERE symbol = $1`,
    [symbol]
  );

  for (const t of parsed) {
    const minSz = Number(t.minSz);
    const maxSz = Number(t.maxSz);
    const imr = Number(t.imr);
    const mmr = Number(t.mmr);
    const maxLever = Number(t.maxLever);
    const tier = Number(t.tier);

    const minNotional = minSz * markPx;
    const maxNotional = maxSz * markPx;

    await client.query(
      `INSERT INTO liquidation_pro_tiers
       (symbol, instId, tier, min_sz, max_sz, min_notional, max_notional,
        imr, mmr, max_lever)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        symbol,
        instId,
        tier,
        minSz,
        maxSz,
        minNotional,
        maxNotional,
        imr,
        mmr,
        maxLever
      ]
    );
  }
}

