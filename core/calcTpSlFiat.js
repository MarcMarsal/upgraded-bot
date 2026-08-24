// fitxer calcTpSlFiat.js

export function calcTpSlFiat(type, entryR, thirdBody, atr) {
  // SL FIAT
  let sl;
  if (type === "M") {
    sl = Math.max(
      entryR - thirdBody * 0.70,
      entryR * 0.80
    );
  } else {
    sl = Math.min(
      entryR + thirdBody * 0.70,
      entryR * 1.20
    );
  }

  // TP FIAT (ATR * 0.3)
  const tp = type === "M"
    ? entryR + atr * 0.3
    : entryR - atr * 0.3;

  return { tp, sl };
}
