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

  // Calculem el pes màxim per normalitzar
  const maxWeight = Math.max(...rows.map(r => Number(r.weight)));

  let zones = [];

  for (const r of rows) {
    const weight = Number(r.weight);
    const score = weight / maxWeight; // 0..1

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

  // Esborrem mapa antic
  await client.query(
    `DELETE FROM liquidation_pro_map WHERE symbol = $1`,
    [symbol]
  );

  // Guardem mapa nou
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
