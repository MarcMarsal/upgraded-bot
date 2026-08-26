// fitxer calcTpSlFiat.js
//SET sl_new = CASE
//    WHEN type = 'M' THEN entryr_new - (atr * 0.8)
//    WHEN type = 'E' THEN entryr_new + (atr * 0.8)
//END;

export function calcTpSlFiat(type, entryR, thirdBody, atr) {
  // SL FIAT
  let sl;
  if (type === "M") {
    //sl = Math.max(
    //  entryR - thirdBody * 0.70,
    //  entryR * 0.80
    //);
    sl = entryR -(atr * 0.8);
  } else {
    //sl = Math.min(
    //  entryR + thirdBody * 0.70,
    //  entryR * 1.20
    //);
    sl = entryR + (atr * 0.8);
  }

  //SET tp_new = CASE
  //  WHEN type = 'M' THEN entryr_new + (atr * 0.6)
  //  WHEN type = 'E' THEN entryr_new - (atr * 0.6)
  //END;
  // TP FIAT (ATR * 0.3)
  //const tp = type === "M"
  //  ? entryR + atr * 0.3
  //  : entryR - atr * 0.3;
  let tp;
  if (type === "M") {
    tp = entryR + (atr * 0.6);
  } else {
    tp = entryR - (atr * 0.6);
  }
  

  return { tp, sl };
}
