// fitxer calcRetroces.js

export function calcRetroces(thirdClose, fourthExtreme, thirdBody) {
  if (!fourthExtreme || thirdBody === 0) return null;

  return Math.abs((thirdClose - fourthExtreme) / thirdBody);
}
