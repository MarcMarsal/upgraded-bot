import { computeMacdStuff, computeMicroTrend } from "./indicators.js";
import { applyFiat2Score } from "./fiatScore.js";

// FIAT 2.0 — avaluació MS/ES 1:1 amb Pine (sempre a vela tancada)
export function evaluateWithModel(candles, sig) {
  // 🟩 0) Vela de senyal = última vela TANCADA
  // candles[n-1] = vela actual (oberta)
  // candles[n-2] = última vela tancada = close[1] a Pine
  const n = candles.length;
  if (n < 4) {
    return {
      isGood: false,
      discard: true,
      score: 0,
      magPts: 0,
      macdPts: 0,
      trendPts: 0,
      satPts: 0,
      modeEff: 0
    };
  }

  const lastClosedIdx = n - 2;      // bar de la senyal (third candle)
  const closesAll = candles.map(c => c.close);
  const closesClosed = closesAll.slice(0, -1); // excloem la vela actual

  // -------------------------------------------------------------
  // 1) Tipus de senyal (MS / ES)
  // -------------------------------------------------------------
  const isMs = sig.type === "M";
  const isEs = sig.type === "E";

  // -------------------------------------------------------------
  // 2) MAGNITUD (o1 = open[3], o3 = open[1] a Pine)
  //    first candle = n-4, third candle = n-2
  // -------------------------------------------------------------
  const o1 = candles[lastClosedIdx - 2].open;
  const c1 = candles[lastClosedIdx - 2].close;
  const o3 = candles[lastClosedIdx].open;
  const c3 = candles[lastClosedIdx].close;

  const bodyFirst = Math.abs(c1 - o1);
  const bodyThird = Math.abs(c3 - o3);
  const magOK = bodyThird > bodyFirst * 0.6;
  const magPts = magOK ? 1 : 0;

  // -------------------------------------------------------------
  // 3) MACD + SATURACIÓ (sempre sobre veles tancades)
  //    Pine: macdLine, signalLine, hist, histSmooth, histStdev
  // -------------------------------------------------------------
  const { histSmooth, histStdev } = computeMacdStuff(closesClosed);
  const lenHs = histSmooth.length;
  const lenSt = histStdev.length;

  if (lenHs === 0 || lenSt === 0) {
    return {
      isGood: false,
      discard: true,
      score: 0,
      magPts,
      macdPts: 0,
      trendPts: 0,
      satPts: 0,
      modeEff: 0
    };
  }

  // Última vela tancada = últim element de histSmooth/histStdev
  const hs = histSmooth[lenHs - 1];
  const st = histStdev[lenSt - 1];

  const bullishSaturation = hs > st * 2.5;
  const bearishSaturation = hs < -st * 2.5;

  // -------------------------------------------------------------
  // 4) microTrend FIAT (EMA curt + slope) sobre veles tancades
  //    Pine: microTrend basat en emaS i emaS[microLookback]
  // -------------------------------------------------------------
  const { microTrend } = computeMicroTrend(closesClosed);

  // -------------------------------------------------------------
  // 5) MACD punts direccional (FIAT 2.3)
  // -------------------------------------------------------------
  const macdPts =
    (isMs && microTrend === 1 && hs > 0) ? 1 :
    (isEs && microTrend === -1 && hs < 0) ? 1 :
    0;

  // -------------------------------------------------------------
  // 6) TREND punts (FIAT 2.3 — penalització contratrendència)
  // -------------------------------------------------------------
  let trendPts = 0;
  if (isMs && microTrend === 1) trendPts = 1;
  else if (isMs && microTrend === -1) trendPts = -1;
  else if (isEs && microTrend === -1) trendPts = 1;
  else if (isEs && microTrend === 1) trendPts = -1;

  // -------------------------------------------------------------
  // 7) SAT punts
  // -------------------------------------------------------------
  const satPts =
    (isMs && bullishSaturation) ? 1 :
    (isEs && bearishSaturation) ? 1 :
    0;

  // -------------------------------------------------------------
  // 8) Mode efectiu (TREND / RANGE) basat en microTrend
  //    Pine: modeEff = 1 si microTrend != 0, 0 si RANGE
  // -------------------------------------------------------------
  const modeEff = microTrend !== 0 ? 1 : 0;

  // -------------------------------------------------------------
  // 9) Score FIAT 2.0 (ponderacions per sym + mode)
  // -------------------------------------------------------------
  let { fiatScore, fiatIsGood } = applyFiat2Score(
    sig.symbol,
    magPts,
    macdPts,
    trendPts,
    satPts,
    modeEff
  );

  // RANGE: ignorar tendència + bloquejar impulsos (mag+macd)
  if (modeEff === 0) {
    const { fiatScore: scoreNoTrend, fiatIsGood: isGoodNoTrend } =
      applyFiat2Score(sig.symbol, magPts, macdPts, 0, satPts, modeEff);

    fiatScore = scoreNoTrend;
    // impuls pur en RANGE → DISCARD
    const isImpulse = magPts === 1 && macdPts === 1;
    fiatIsGood = isImpulse ? false : isGoodNoTrend;
  }

  // -------------------------------------------------------------
  // 10) Validació final
  // -------------------------------------------------------------
  const isGood = fiatIsGood && (isMs || isEs);

  return {
    isGood,
    discard: !isGood,
    score: fiatScore,
    magPts,
    macdPts,
    trendPts,
    satPts,
    modeEff
  };
}
