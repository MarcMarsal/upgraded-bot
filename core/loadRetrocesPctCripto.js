// fitxer loadRetrocesPctCripto.js

import { client } from "../db/client.js";

export async function loadRetrocesPctCripto(symbol) {
  const q = await client.query(`
    SELECT retroces_p50
    FROM retroces_cripto
    WHERE symbol = $1
  `, [symbol]);

  if (!q.rows.length) return null;
  return Number(q.rows[0].retroces_p50);
}
