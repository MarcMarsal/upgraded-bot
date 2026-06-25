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

  const CLUSTER_THRESHOLD = 0.005;

  let clusters = [];
  let current = null;

  for (const t of rows) {

    // 🔥 FIX 1: evitar divisió per zero
    const priceMin = t.min_sz === 0
      ? t.max_notional / t.max_sz
      : t.min_notional / t.min_sz;

    const priceMax = t.max_sz === 0
      ? priceMin
      : t.max_notional / t.max_sz;

    const priceMid = (priceMin + priceMax) / 2;

    // 🔥 FIX 2: pes correcte
    const weight = (t.max_notional + t.min_notional) / 2;

    if (!current) {
      current = {
        price_min: priceMin,
        price_max: priceMax,
        weight,
        tiers: 1,
        last_price: priceMid
      };
      continue;
    }

    const dist = Math.abs(priceMid - current.last_price) / current.last_price;

    if (dist < CLUSTER_THRESHOLD) {
      current.price_min = Math.min(current.price_min, priceMin);
      current.price_max = Math.max(current.price_max, priceMax);
      current.weight += weight;
      current.tiers += 1;
      current.last_price = priceMid;
    } else {
      clusters.push(current);
      current = {
        price_min: priceMin,
        price_max: priceMax,
        weight,
        tiers: 1,
        last_price: priceMid
      };
    }
  }

  clusters.push(current);

  await client.query(
    `DELETE FROM liquidation_pro_clusters WHERE symbol = $1`,
    [symbol]
  );

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
