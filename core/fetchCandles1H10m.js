// fitxer fetchCandles1H10m.js
import { client } from "../db/client.js";

const current = {};
const dummyOpen = {};

// Vela oberta 1H (última)
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

// Calcula l’inici teòric de l’interval 1H10m que conté "now"
function getIntervalStartTs(now) {
  const d = new Date(now);
  const minute = d.getMinutes();
  const hour = d.getHours();

  const start = new Date(d);

  if (minute < 10) {
    // Estem entre HH:00 i HH:09 → interval és [hora-1:10, hora:10)
    start.setHours(hour - 1);
    start.setMinutes(10);
  } else {
    // Estem entre HH:10 i HH:59 → interval és [hora:10, hora+1:10)
    start.setHours(hour);
    start.setMinutes(10);
  }

  start.setSeconds(0);
  start.setMilliseconds(0);

  return start.getTime();
}

export async function fetchAndStoreCandles1H10m(symbol) {
  const now = Date.now();
  const d = new Date(now);
  const minute = d.getMinutes();

  // Si no hi ha vela oberta, crear la de l’interval actual
  if (!current[symbol]) {
    const oc = await getOpenCandle1H(symbol);
    if (!oc) {
      console.log(`[1H10m][${symbol}] NO TINC VELA 1H OBERTA, no puc iniciar`);
      return;
    }

    const startTs = getIntervalStartTs(now);

    current[symbol] = {
      timeframe: "1H10m",
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: oc.volume || 0,
      startTs
    };

    dummyOpen[symbol] = {
      open: oc.close,
      high: oc.close,
      low: oc.close,
      close: oc.close,
      volume: 0,
      timestamp: startTs
    };

    console.log(`[1H10m][${symbol}] VELA 1H10m CREADA PER INTERVAL`, new Date(startTs).toISOString());
    return;
  }

  // Actualitzar vela oberta
  const oc2 = await getOpenCandle1H(symbol);
  if (!oc2) {
    console.log(`[1H10m][${symbol}] ERROR: oc2=null DURANT actualització`);
    return;
  }

  const price = oc2.close;
  const vol   = oc2.volume || 0;

  current[symbol].high = Math.max(current[symbol].high, price);
  current[symbol].low  = Math.min(current[symbol].low,  price);
  current[symbol].close = price;
  current[symbol].volume += vol;

  // Tancament exactament a 1h de l’inici teòric (HH:10 → HH+1:10)
  const elapsed = now - current[symbol].startTs;

  if (elapsed >= 60 * 60 * 1000) {
    const c = current[symbol];

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

    // Dummy passa a reflectir el close de la vela tancada
    dummyOpen[symbol] = {
      open: c.close,
      high: c.close,
      low: c.close,
      close: c.close,
      volume: 0,
      timestamp: now
    };

    console.log(`[1H10m][${symbol}] VELA TANCADA INTERVAL`, new Date(c.startTs).toISOString());

    // Reset per a que al següent minut es creï la nova (per l’interval següent)
    current[symbol] = null;
  }
}

export function getCandlesForDetection1H10m(symbol, closedCandles) {
  return [...closedCandles, dummyOpen[symbol]];
}
