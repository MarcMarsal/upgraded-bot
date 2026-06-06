
// -------------------------------------------------------------
// Indicadors bàsics FIAT 2.x en JS pur
// -------------------------------------------------------------

// EMA simple
export function ema(values, length) {
  const out = [];
  if (values.length === 0) return out;
  const k = 2 / (length + 1);
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// SMA simple
export function sma(values, length) {
  const out = [];
  if (values.length < length) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out.push(sum / length);
  }
  return out;
}

// Desviació estàndard
export function stdev(values, length) {
  const out = [];
  if (values.length < length) return out;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    sum += v;
    sumSq += v * v;
    if (i >= length) {
      const old = values[i - length];
      sum -= old;
      sumSq -= old * old;
    }
    if (i >= length - 1) {
      const mean = sum / length;
      const variance = sumSq / length - mean * mean;
      out.push(Math.sqrt(Math.max(variance, 0)));
    }
  }
  return out;
}

// MACD + histograma suau + stdev
export function computeMacdStuff(closes) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = [];
  const len = Math.min(ema12.length, ema26.length);
  for (let i = 0; i < len; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }
  const signalLine = ema(macdLine, 9);
  const hist = [];
  const len2 = Math.min(macdLine.length, signalLine.length);
  for (let i = 0; i < len2; i++) {
    hist.push(macdLine[i] - signalLine[i]);
  }
  const histSmooth = ema(hist, 5);
  const histStdev = stdev(histSmooth, 20);
  return { macdLine, signalLine, hist, histSmooth, histStdev };
}

export function computeMicroTrend(closes, microLen = 4, microLookback = 4, microSlopeThr = 0.0008) {
  const emaS = ema(closes, microLen);
  const n = emaS.length;
  if (n <= microLookback) return { microTrend: 0, microTrendDur: 1 };

  // 🔥 CORRECCIÓ FIAT 2.0 — usar la vela ACTUAL
  const slopeS = (emaS[n - 1] - emaS[n - microLookback]) / emaS[n - microLookback];

  let microTrend = 0;
  if (slopeS > microSlopeThr) microTrend = 1;
  else if (slopeS < -microSlopeThr) microTrend = -1;

  return { microTrend, microTrendDur: 1 };
}


// Tendència 12h aproximada (transportable)
export function computeTrend12h(candles) {
  if (candles.length < 2) return 0;

  const closes = candles.map(c => c.close);
  const lastIdx = candles.length - 1;
  const nowTs = candles[lastIdx].timestamp;

  // assumim timeframe constant
  const tfMs = candles.length >= 2
    ? candles[lastIdx].timestamp - candles[lastIdx - 1].timestamp
    : 60 * 60 * 1000;

  const bars12h = Math.floor((12 * 60 * 60 * 1000) / tfMs);
  if (candles.length <= bars12h) return 0;

  const pastIdx = Math.max(0, lastIdx - bars12h);

  const closeNow = closes[lastIdx];
  const closePast = closes[pastIdx];

  const smaLen = Math.min(bars12h, closes.length);
  const smaAll = sma(closes, smaLen);
  if (smaAll.length === 0) return 0;

  const avgNow = smaAll[smaAll.length - 1];
  const avgPast = smaAll[Math.max(0, smaAll.length - 1 - (lastIdx - pastIdx))];

  const trendUp12h = closeNow > closePast && avgNow > avgPast;
  const trendDown12h = closeNow < closePast && avgNow < avgPast;

  return trendUp12h ? 1 : trendDown12h ? -1 : 0;
}
