// core/sl_reconstructor.js
import { client } from "../db/client.js";

let last = {}; 
// last[symbol] = { oi, price, ts }

export async function updateSLReconstruction(symbol, price, oi, ts) {
  // Inicialització si és la primera vegada
  if (!last[symbol]) {
    last[symbol] = { oi, price, ts };
    return;
  }

  const prev = last[symbol];

  const oi_delta = oi - prev.oi;
  const price_delta = price - prev.price;

  let side = null;

  // 🔥 Lògica FIAT‑PRO de detecció d'entrades
  if (oi_delta > 0) {
    if (price_delta > 0) side = "long";   // OI↑ + Price↑ → entren LONGS
    else side = "short";                  // OI↑ + Price↓ → entren SHORTS
  }

  // 🔥 Guardem només si hi ha moviment rellevant
  if (Math.abs(oi_delta) > 0) {
    await client.query(
      `INSERT INTO sl_reconstructed
       (symbol, ts, price, oi, oi_delta, price_delta, side)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        symbol,
        ts,
        price,
        oi,
        oi_delta,
        price_delta,
        side
      ]
    );
  }

  // Actualitzem estat
  last[symbol] = { oi, price, ts };
}
