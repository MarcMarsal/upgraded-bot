// Estructura en memòria
const current = {};        // vela real 1H10m oberta
const dummyOpen = {};      // vela dummy oberta per detectMSES

export async function fetchAndStoreCandles1H10m(symbol) {
  const now = Date.now();
  const d = new Date(now);

  const minute = d.getMinutes();

  //console.log(`[1H10m] Tick ${symbol} minute=${minute} current=${!!current[symbol]}`);

  // ---------------------------------------------------------
  // 1) INICI DE VELA REAL (HH:10) — només si NO existeix
  // ---------------------------------------------------------
  //console.log(`[1H10m] minute===10? ${minute === 10} && current null? ${!current[symbol]}`);

  if (minute === 10 && !current[symbol]) {

    console.log(`[1H10m] Intentant iniciar vela real ${symbol}`);

    const oc = await getOpenCandle(symbol);   // vela oberta 1H de l'exchange
    console.log(`[1H10m] getOpenCandle(${symbol}) =`, oc);

    if (!oc) {
      console.log(`[1H10m] ERROR: oc=null per ${symbol}, no puc iniciar la vela`);
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

    console.log(`[1H10m] CREANT VELA REAL ${symbol}`, current[symbol]);

    // Crear la dummy oberta (placeholder per detectMSES)
    dummyOpen[symbol] = {
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      timestamp: now
    };

    console.log(`[1H10m] CREANT DUMMY ${symbol}`, dummyOpen[symbol]);
    return;
  }

  // ---------------------------------------------------------
  // Si no hi ha vela real oberta → res
  // ---------------------------------------------------------
  if (!current[symbol]) {
    //console.log(`[1H10m] No hi ha vela oberta per ${symbol}, sortint`);
    return;
  }

  // ---------------------------------------------------------
  // 2) ACTUALITZAR VELA REAL 1H10m AMB LA VELA OBERTA 1H
  // ---------------------------------------------------------
  const oc = await getOpenCandle(symbol);
  console.log(`[1H10m] getOpenCandle DURANT VELA ${symbol} =`, oc);

  if (!oc) {
    console.log(`[1H10m] ERROR: oc=null durant actualització per ${symbol}`);
    return;
  }

  const price = oc.close;
  const vol   = oc.volume || 0;

  current[symbol].high = Math.max(current[symbol].high, price);
  current[symbol].low  = Math.min(current[symbol].low,  price);
  current[symbol].close = price;
  current[symbol].volume += vol;

  console.log(`[1H10m] Actualitzada vela real ${symbol}:`, current[symbol]);

  // ---------------------------------------------------------
  // 3) TANCAMENT (HH+1:10) — 60 minuts exactes
  // ---------------------------------------------------------
  const elapsed = now - current[symbol].startTs;
  console.log(`[1H10m] elapsed=${elapsed} startTs=${current[symbol].startTs}`);

  if (elapsed >= 60 * 60 * 1000) {

    const c = current[symbol];
    console.log(`[1H10m] TANCANT VELA REAL ${symbol}`);

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

    console.log(`[1H10m] DUMMY UPDATE ${symbol}:`, dummyOpen[symbol]);

    // ---------------------------------------------------------
    // 5) Reset de la vela real → llesta per la següent hora
    // ---------------------------------------------------------
    current[symbol] = null;
    console.log(`[1H10m] RESET VELA REAL ${symbol}`);
  }
}

// ---------------------------------------------------------
// Funció per obtenir veles per detectMSES
// ---------------------------------------------------------
export function getCandlesForDetection1H10m(symbol, closedCandles) {
  return [...closedCandles, dummyOpen[symbol]];
}
