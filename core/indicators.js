// -------------------------------------------------------------
// indicators.js — FIAT 2.0 exacte (MACD + microTrend)
// -------------------------------------------------------------

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

export function stdev(values, length) {
  const result = [];
  if (values.length < length) return result;

  for (let i = 0; i <= values.length - length; i++) {
    const slice = values.slice(i, i + length);
    const mean = slice.reduce((a, b) => a + b, 0) / length;
    const variance =
      slice.reduce((a, b) => a + (b - mean) ** 2, 0) / length;
    result.push(Math.sqrt(variance));
  }

  return result;
}

export function computeMacdStuff(closes) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const hist = macdLine.map((v, i) => v - signalLine[i]);

  const histSmooth = ema(hist, 5);
  const histStdev = stdev(histSmooth, 20);

  return { histSmooth, histStdev };
}

export function computeMicroTrend(
  closes,
  microLen = 4,
  microLookback = 4,
  microSlopeThr = 0.0008
) {
  const emaS = ema(closes, microLen);
  const n = emaS.length;

  if (n <= microLookback) {
    return { microTrend: 0, emaNow: 0, emaPast: 0, slope: 0 };
  }

  const emaNow = emaS[n - 1];
  const emaPast = emaS[n - 1 - microLookback];
  const slope = (emaNow - emaPast) / emaPast;

  let microTrend = 0;
  if (slope > microSlopeThr) microTrend = 1;
  else if (slope < -microSlopeThr) microTrend = -1;

  return { microTrend, emaNow, emaPast, slope };
}

