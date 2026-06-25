// core/liquidation_pro_cluster.js

import { client } from "../db/client.js";

export async function buildClustersForSymbol(symbol) {
  const { rows } = await client.query(
    `SELECT min_notional, max_notional, min_sz, max_sz, imr, mmr, max_lever
     FROM liquidation_pro_tiers
     WHERE symbol = $1
     ORDER BY min_notional ASC`,
    [symbol]
  );

  if (!rows.length) return;

  // Paràmetre de proximitat (0.5% del preu)
  const CLUSTER_THRESHOLD = 0.005;

  let clusters = [];
  let current = null;

  for (const t of rows) {
    const priceMin = t.min_notional / t.min_sz;
    const priceMax = t.max_notional / t.max_sz;
    const priceMid = (priceMin + priceMax) / 2;

    if (!current) {
      current = {
        price_min: priceMin,
        price_max: priceMax,
        weight: t.max_notional,
        tiers: 1,
        last_price: priceMid
      };
      continue;
    }

    const dist = Math.abs(priceMid - current.last_price) / current.last_price;

    if (dist < CLUSTER_THRESHOLD) {
      // mateix cluster
      current.price_min = Math.min(current.price_min, priceMin);
      current.price_max = Math.max(current.price_max, priceMax);
      current.weight += t.max_notional;
      current.tiers += 1;
      current.last_price = priceMid;
    } else {
      // tanquem cluster i n’obrim un altre
      clusters.push(current);
      current = {
        price_min: priceMin,
        price_max: priceMax,
        weight: t.max_notional,
        tiers: 1,
        last_price: priceMid
      };
    }
  }

  clusters.push(current);

  // Esborrem clusters antics
  await client.query(
    `DELETE FROM liquidation_pro_clusters WHERE symbol = $1`,
    [symbol]
  );

  // Guardem clusters nous
  let id = 1;
  for (const c of clusters) {
    await client.query(
      `INSERT INTO liquidation_pro_clusters
       (symbol, cluster_id, price_min, price_max, weight, tiers_included)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        symbol,
        id++,
        c.price_min,
        c.price_max,
        c.weight,
        c.tiers
      ]
    );
  }
}
