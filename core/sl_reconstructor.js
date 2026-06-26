// core/sl_reconstructor.js
import { client } from "../db/client.js";

let last = {}; 
// last[symbol] = { oi, price, ts }

export async function updateSLReconstruction(symbol, price, oi, ts) {
  // Primera lectura: només guardem referència, no inserim
  if (!last[symbol]) {
    last[symbol] = { oi, price, ts };
    return;
  }

  const prev = last[symbol];

  const oi_delta = oi - prev.oi;
  const price_delta = price - prev.price;

  let side = null;

  // Detecció d'entrades FIAT‑PRO
  if (oi_delta > 0) {
    if (price_delta > 0) side = "long";   // OI↑ + Price↑ → entren LONGS
    else if (price_delta < 0) side = "short"; // OI↑ + Price↓ → entren SHORTS
  }

  // Reconstrucció d'entry_price estimat
  let entry_price = null;

  if (oi_delta > 0 && side) {
    const factor = 0.5; // coeficient FIAT‑PRO per BTC

    if (side === "long") {
      entry_price = price - (price_delta * factor);
    } else if (side === "short") {
      entry_price = price + (price_delta * factor);
    }
  }

  // Només inserim si hi ha moviment d'OI
  if (Math.abs(oi_delta) > 0) {
    await client.query(
      `INSERT INTO sl_reconstructed
       (symbol, ts, price, oi, oi_delta, price_delta, side, entry_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        symbol,
        ts,
        price,
        oi,
        oi_delta,
        price_delta,
        side,
        entry_price
      ]
    );
  }

  // Actualitzem estat
  last[symbol] = { oi, price, ts };
}
