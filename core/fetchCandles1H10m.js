import axios from "axios";
import { client } from "../db/client.js";
// Estructura en memòria
const current = {};        // vela real 1H10m oberta
const dummyOpen = {};      // vela dummy oberta per detectMSES

// ---------------------------------------------------------
// FUNCIO AFEGIDA: obtenir última vela 1H tancada de la BD
// ---------------------------------------------------------
async function getLastClosedCandle1H(symbol) {
  try {
    const res = await client.query(`
      SELECT timestamp, open, high, low, close, volume
      FROM candles
      WHERE symbol = $1 AND timeframe = '1H'
      ORDER BY timestamp DESC
      LIMIT 1
    `, [symbol]);

    return res.rows[0] || null;

  } catch (err) {
    console.log(`[1H10m][${symbol}] ERROR getLastClosedCandle1H:`, err);
    return null;
  }
}

// ---------------------------------------------------------
// FUNCIO PRINCIPAL 1H10m
// ---------------------------------------------------------
export async function fetchAndStoreCandles1H10m(symbol) {
  const now = Date.now();
  const d = new Date(now);

  const minute = d.getMinutes();

  // LOG 1 — veure si entra al minut 10
  if (minute === 10) {
    console.log(`[1H10m][${symbol}] MINUTE=10 current=${!!current[symbol]}`);
  }

  console.log(`[1H10m][${symbol}] minute===10? ${minute === 10} && current null? ${!current[symbol]}`);

  // ---------------------------------------------------------
  // 1) INICI DE VELA REAL (HH:10)
  // ---------------------------------------------------------
  if (minute === 10 && !current[symbol]) {

    console.log(`[1H10m][${symbol}] → INICI condició complerta`);

    // 🔥 Substituïm getOpenCandle per la nova funció
    const oc = await getLastClosedCandle1H(symbol);

    console.log(`[1H10m][${symbol}] getLastClosedCandle1H =`, oc);

    if (!oc) {
      console.log(`[1H10m][${symbol}] ERROR: oc=null → NO es crea la vela`);
      return;
    }

    // Crear la vela real 1H10m
    console.log(`[1H10m][${symbol}] CREANT VELA REAL`);

    current[symbol] = {
      timeframe: "1H10m",
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0,
      startTs: now
    };

    // Crear la dummy oberta
    dummyOpen[symbol] = {
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      timestamp: now
    };

    console.log(`[1H10m][${symbol}] VELA REAL + DUMMY CREADES`);
    return;
  }

  // ---------------------------------------------------------
  // Si no hi ha vela real oberta → res
  // ---------------------------------------------------------
  if (!current[symbol]) {
    console.log(`[1H10m][${symbol}] No hi ha vela oberta, sortint`);
    return;
  }

  // ---------------------------------------------------------
  // 2) ACTUALITZAR VELA REAL
  // ---------------------------------------------------------
  const oc2 = await getLastClosedCandle1H(symbol);

  console.log(`[1H10m][${symbol}] getLastClosedCandle1H DURANT VELA =`, oc2);

  if (!oc2) {
    console.log(`[1H10m][${symbol}] ERROR: oc=null DURANT actualització`);
    return;
  }

  const price = oc2.close;
  const vol   = oc2.volume || 0;

  current[symbol].high = Math.max(current[symbol].high, price);
  current[symbol].low  = Math.min(current[symbol].low,  price);
  current[symbol].close = price;
  current[symbol].volume += vol;

  console.log(`[1H10m][${symbol}] Actualitzada vela real:`, current[symbol]);

  // ---------------------------------------------------------
  // 3) TANCAMENT (HH+1:10)
  // ---------------------------------------------------------
  const elapsed = now - current[symbol].startTs;
  console.log(`[1H10m][${symbol}] elapsed=${elapsed} startTs=${current[symbol].startTs}`);

  if (elapsed >= 60 * 60 * 1000) {

    console.log(`[1H10m][${symbol}] TANCANT VELA REAL`);

    const c = current[symbol];

    await client.query(`
      INSERT INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
      symbol,
      "1H10m",
      c.startTs,
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume
    ]);

    dummyOpen[symbol] = {
      open: c.close,
      high: c.close,
      low: c.close,
      close: c.close,
      volume: 0,
      timestamp: now
    };

    console.log(`[1H10m][${symbol}] DUMMY UPDATE`, dummyOpen[symbol]);

    current[symbol] = null;
    console.log(`[1H10m][${symbol}] RESET VELA REAL`);
  }
}

// ---------------------------------------------------------
// Funció per obtenir veles per detectMSES
// ---------------------------------------------------------
export function getCandlesForDetection1H10m(symbol, closedCandles) {
  return [...closedCandles, dummyOpen[symbol]];
}
