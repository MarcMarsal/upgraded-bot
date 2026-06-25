// core/liquidation_pro_map.js

import { client } from "../db/client.js";

export async function buildLiquidationMapForSymbol(symbol) {
  const { rows } = await client.query(
    `SELECT cluster_id, price_min, price_max, weight, tiers_included
     FROM liquidation_pro_clusters
     WHERE symbol = $1
     ORDER BY price_min ASC`,
    [symbol]
  );

  if (!rows.length) return;

  // 🔥 FIX 1: evitar maxWeight = 0
  const maxWeight = Math.max(...rows.map(r => Number(r.weight))) || 1;

  let zones = [];

  for (const r of rows) {

    // 🔥 FIX 2: assegurar que weight és numèric
    const weight = Number(r.weight) || 0;

    const score = weight / maxWeight;

    let type = "low_risk";
    if (score > 0.66) type = "high_risk";
    else if (score > 0.33) type = "medium_risk";

    zones.push({
      price_min: Number(r.price_min),
      price_max: Number(r.price_max),
      weight,
      risk_score: score,
      zone_type: type
    });
  }

  await client.query(
    `DELETE FROM liquidation_pro_map WHERE symbol = $1`,
    [symbol]
  );

  let id = 1;
  for (const z of zones) {
    await client.query(
      `INSERT INTO liquidation_pro_map
       (symbol, zone_id, price_min, price_max, weight, risk_score, zone_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        symbol,
        id++,
        z.price_min,
        z.price_max,
        z.weight,
        z.risk_score,
        z.zone_type
      ]
    );
  }
}
