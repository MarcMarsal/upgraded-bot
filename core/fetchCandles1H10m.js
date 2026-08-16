// Estructura en memòria
const current = {};        // vela real 1H10m oberta
const dummyOpen = {};      // vela dummy oberta per detectMSES

export async function fetchAndStoreCandles1H10m(symbol) {
  const now = Date.now();
  const d = new Date(now);

  const minute = d.getUTCMinutes();

  // ---------------------------------------------------------
  // 1) INICI DE VELA REAL (HH:10) — només si NO existeix
  // ---------------------------------------------------------
  if (minute === 10 && !current[symbol]) {
    const oc = await getOpenCandle(symbol);   // vela oberta 1H de l'exchange
    if (!oc) return;

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

    // Crear la dummy oberta (placeholder per detectMSES)
    dummyOpen[symbol] = {
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      timestamp: now
    };

    console.log(`[1H10m] Inici vela real + dummy ${symbol} @ ${new Date(now).toISOString()}`);
    return;
  }

  // ---------------------------------------------------------
  // Si no hi ha vela real oberta → res
  // ---------------------------------------------------------
  if (!current[symbol]) return;

  // ---------------------------------------------------------
  // 2) ACTUALITZAR VELA REAL 1H10m AMB LA VELA OBERTA 1H
  // ---------------------------------------------------------
  const oc = await getOpenCandle(symbol);
  if (!oc) return;

  const price = oc.close;
  const vol   = oc.volume || 0;

  current[symbol].high = Math.max(current[symbol].high, price);
  current[symbol].low  = Math.min(current[symbol].low,  price);
  current[symbol].close = price;
  current[symbol].volume += vol;

  // ---------------------------------------------------------
  // 3) TANCAMENT (HH+1:10) — 60 minuts exactes
  // ---------------------------------------------------------
  const elapsed = now - current[symbol].startTs;
  if (elapsed >= 60 * 60 * 1000) {

    const c = current[symbol];

    // INSERT de la vela real tancada
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

    console.log(`[1H10m] Tancament vela real ${symbol} @ ${new Date(now).toISOString()}`);

    // ---------------------------------------------------------
    // 4) UPDATE de la dummy → reflecteix la nova vela oberta
    // ---------------------------------------------------------
    dummyOpen[symbol] = {
      open: c.close,
      high: c.close,
      low: c.close,
      close: c.close,
      volume: 0,
      timestamp: now
    };

    // ---------------------------------------------------------
    // 5) Reset de la vela real → llesta per la següent hora
    // ---------------------------------------------------------
    current[symbol] = null;
  }
}

// ---------------------------------------------------------
// Funció per obtenir veles per detectMSES
// ---------------------------------------------------------
export function getCandlesForDetection1H10m(symbol, closedCandles) {
  // closedCandles = veles tancades 1H10m de la BD
  // dummyOpen[symbol] = vela oberta dummy
  return [...closedCandles, dummyOpen[symbol]];
}
