// -------------------------------------------------------------
// indicators.js — FIAT 2.0 exacte (MACD + microTrend)
// -------------------------------------------------------------

// EMA simple
export function ema(values, length) {
  const result = [];
  if (values.length === 0 || length <= 0) return result;

  const k = 2 / (length + 1);
  let prevEma = values[0];

  for (let i = 0; i < values.length; i++) {
    const price = values[i];
    const currentEma = i === 0 ? price : (price - prevEma) * k + prevEma;
    result.push(currentEma);
    prevEma = currentEma;
  }

  return result;
}

// SMA simple (per a trend 12h si cal)
export function sma(values, length) {
  const result = [];
  if (values.length < length || length <= 0) return result;

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= length) {
      sum -= values[i - length];
    }
    if (i >= length - 1) {
      result.push(sum / length);
    }
  }

  return result;
}

// Desviació estàndard
export function stdev(values, length) {
  const result = [];
  if (values.length < length || length <= 0) return result;

  for (let i = 0; i <= values.length - length; i++) {
    const slice = values.slice(i, i + length);
    const mean = slice.reduce((a, b) => a + b, 0) / length;
    const variance =
      slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / length;
    result.push(Math.sqrt(variance));
  }

  return result;
}

// -------------------------------------------------------------
// MACD + histograma suau + stdev (FIAT 2.0)
// IMPORTANT: cridar-ho sempre amb veles TANCADES (sense la vela actual)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// MicroTrend (EMA curt + slope) FIAT 2.0
// IMPORTANT: cridar-ho sempre amb veles TANCADES (sense la vela actual)
// -------------------------------------------------------------
export function computeMicroTrend(
  closes,
  microLen = 4,
  microLookback = 4,
  microSlopeThr = 0.0008
) {
  const emaS = ema(closes, microLen);
  const n = emaS.length;
  if (n <= microLookback) return { microTrend: 0, microTrendDur: 1 };

  // Pine: emaS (vela tancada) i emaS[microLookback] (fa microLookback barres)
  // Aquí: última EMA = emaS[n-1], passada = emaS[n-1-microLookback]
  const emaNow = emaS[n - 1];
  const emaPast = emaS[n - 1 - microLookback];

  const slopeS = (emaNow - emaPast) / emaPast;

  let microTrend = 0;
  if (slopeS > microSlopeThr) microTrend = 1;
  else if (slopeS < -microSlopeThr) microTrend = -1;

  // microTrendDur aquí no es pot calcular exactament (no tenim sèries internes),
  // però per FIAT 2.0 només ens cal el signe.
  const microTrendDur = 1;

  return { microTrend, microTrendDur };
}
