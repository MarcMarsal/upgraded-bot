// liquidation_pro_tiers.js
// Suposem que ja tens a liquidation_pro_state:
// symbol, instId, oi, oi_usd, mark_price, tiers (JSON)
// liquidation_pro_tiers.js
import { client } from "../db/client.js";

export async function rebuildProTiersForSymbol(symbol) {
  const { rows } = await client.query(
    `SELECT instid, mark_price, tiers
     FROM liquidation_pro_state
     WHERE symbol = $1 AND state = 'ok'`,
    [symbol]
  );

  if (!rows.length) return;

  const { instid, mark_price, tiers } = rows[0];
  const markPx = Number(mark_price);

  let parsed;

  if (Array.isArray(tiers)) {
    parsed = tiers;
  } else if (typeof tiers === "string") {
    try {
      parsed = JSON.parse(tiers);
    } catch (err) {
      console.error("tiers no parsejable per", symbol, err);
      return;
    }
  } else {
    console.error("tiers en format inesperat per", symbol, typeof tiers, tiers);
    return;
  }

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
       (symbol, instid, tier, min_sz, max_sz, min_notional, max_notional,
        imr, mmr, max_lever)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        symbol,
        instid,       // DB → instid
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
