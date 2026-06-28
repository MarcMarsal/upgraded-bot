// core/candles/getOpenCandle.js
import { client } from "../../db/client.js";

/**
 * Retorna només la última vela (la oberta) del símbol i timeframe.
 * És molt més eficient que demanar 80 veles.
 */
export async function getOpenCandle(symbol, timeframe) {
  const res = await client.query(
    `
    SELECT *
    FROM candles
    WHERE symbol = $1 AND timeframe = $2
    ORDER BY timestamp DESC
    LIMIT 1
    `,
    [symbol, timeframe]
  );

  if (res.rows.length === 0) return null;

  return res.rows[0]; // la vela oberta
}
