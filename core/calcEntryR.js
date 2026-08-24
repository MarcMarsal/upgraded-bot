// fitxer calcEntryR.js

export function calcEntryR(type, thirdClose, thirdBody, retrocesPctCripto) {
  if (!retrocesPctCripto) return null;

  return type === "M"
    ? thirdClose - thirdBody * retrocesPctCripto
    : thirdClose + thirdBody * retrocesPctCripto;
}
