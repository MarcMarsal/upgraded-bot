// fitxer calcFourthExtreme.js

export function calcFourthExtreme(candles, candleIndex, type) {
  const fourth = candles[candleIndex + 1];
  if (!fourth) return null;

  return type === "M" ? fourth.low : fourth.high;
}
