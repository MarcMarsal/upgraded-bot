// fitxer fetchCandles1H10m.js

import { client } from "../db/client.js";

// Estructura en memòria
const current = {};        // vela real 1H10m oberta
const dummyOpen = {};      // vela dummy oberta per detectMSES

// ---------------------------------------------------------
// OBTENIR VELA OBERTA 1H (la que s'actualitza cada minut)
// ---------------------------------------------------------
async function getOpenCandle1H(symbol) {
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
    console.log(`[1H10m][${symbol}] ERROR getOpenCandle1H:`, err);
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

  if (minute === 10) {
    console.log(`[1H10m][${symbol}] MINUTE=10 current=${!!current[symbol]}`);
  }

  // ---------------------------------------------------------
  // 1) INICI DE VELA REAL (HH:10)
  // ---------------------------------------------------------
  if (minute === 10 && !current[symbol]) {

    console.log(`[1H10m][${symbol}] → INICI condició complerta`);

    const oc = await getOpenCandle1H(symbol);

    console.log(`[1H10m][${symbol}] getOpenCandle1H =`, oc);

    if (!oc) {
      console.log(`[1H10m][${symbol}] ERROR: oc=null → NO es crea la vela`);
      return;
    }

    // Crear la vela real 1H10m
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
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
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
    return;
  }

  // ---------------------------------------------------------
  // 2) ACTUALITZAR VELA REAL
  // ---------------------------------------------------------
  const oc2 = await getOpenCandle1H(symbol);

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

  // ---------------------------------------------------------
  // 3) TANCAMENT (HH+1:10)
  // ---------------------------------------------------------
  const elapsed = now - current[symbol].startTs;

  if (elapsed >= 60 * 60 * 1000) {

    const c = current[symbol];

    // Convertir timestamps humans
    const timestamp_es = new Date(
      new Date(c.startTs).toLocaleString("en-US", {
        timeZone: "Europe/Madrid"
      })
    ).getTime();

    const date_es = new Date(c.startTs).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).replace(",", "");

    const created_at = Date.now();

    // INSERT FIAT
    await client.query(`
      INSERT INTO candles (
        symbol, timeframe, timestamp,
        open, high, low, close, volume,
        timestamp_es, date_es, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      symbol,
      "1H10m",
      c.startTs,
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume,
      timestamp_es,
      date_es,
      created_at
    ]);

    // Dummy reflecteix nova vela oberta
    dummyOpen[symbol] = {
      open: c.close,
      high: c.close,
      low: c.close,
      close: c.close,
      volume: 0,
      timestamp: now
    };

    current[symbol] = null;
  }
}

// ---------------------------------------------------------
// Funció per obtenir veles per detectMSES
// ---------------------------------------------------------
export function getCandlesForDetection1H10m(symbol, closedCandles) {
  return [...closedCandles, dummyOpen[symbol]];
}
