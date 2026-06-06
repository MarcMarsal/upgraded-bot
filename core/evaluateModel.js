// -------------------------------------------------------------
// FIAT 2.x — Avaluació MS/ES en JS pur (substitueix evaluateWithPine)
// -------------------------------------------------------------

import { computeMacdStuff, computeMicroTrend } from "./indicators.js";
import { applyFiat2Score } from "./fiatScore.js";

// Funció principal: avaluar senyal
export function evaluateWithModel(candles, sig) {
  const closes = candles.map(c => c.close);

  // -------------------------------------------------------------
  // 1) MS/ES segons el BOT (NO RAW)
  // -------------------------------------------------------------
  const isMs = sig.type === "M";
  const isEs = sig.type === "E";

  // -------------------------------------------------------------
  // 2) MAGNITUD
  // -------------------------------------------------------------
  const n = candles.length;
  const o1 = candles[n - 4].open;
  const c1 = candles[n - 4].close;
  const o3 = candles[n - 2].open;
  const c3 = candles[n - 2].close;

  const bodyFirst = Math.abs(c1 - o1);
  const bodyThird = Math.abs(c3 - o3);
  const magOK = bodyThird > bodyFirst * 0.6;
  const magPts = magOK ? 1 : 0;

  // -------------------------------------------------------------
  // 3) MACD + SATURACIÓ
  // -------------------------------------------------------------
  const { histSmooth, histStdev } = computeMacdStuff(closes);
  const len = histSmooth.length;
  const lenSt = histStdev.length;

  if (len === 0 || lenSt === 0) {
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

  const hs = histSmooth[len - 1];
  const st = histStdev[lenSt - 1];

  const bullishSaturation = hs > st * 2.5;
  const bearishSaturation = hs < -st * 2.5;

  // -------------------------------------------------------------
  // 4) MicroTrend
  // -------------------------------------------------------------
  const { microTrend } = computeMicroTrend(closes);

  // -------------------------------------------------------------
  // 5) MACD punts direccional
  // -------------------------------------------------------------
  const macdPts =
    (isMs && microTrend === 1 && hs > 0) ? 1 :
    (isEs && microTrend === -1 && hs < 0) ? 1 :
    0;

  // -------------------------------------------------------------
  // 6) TREND punts
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
  // 8) Mode efectiu
  // -------------------------------------------------------------
  const modeEff = microTrend !== 0 ? 1 : 0;

  // -------------------------------------------------------------
  // 9) Score FIAT
  // -------------------------------------------------------------
  let { fiatScore, fiatIsGood } = applyFiat2Score(
    sig.symbol,
    magPts,
    macdPts,
    trendPts,
    satPts,
    modeEff
  );

  // Ajustos RANGE
  if (modeEff === 0) {
    const { fiatScore: scoreNoTrend, fiatIsGood: isGoodNoTrend } =
      applyFiat2Score(sig.symbol, magPts, macdPts, 0, satPts, modeEff);

    fiatScore = scoreNoTrend;
    fiatIsGood = (magPts === 1 && macdPts === 1) ? false : isGoodNoTrend;
  }

  // -------------------------------------------------------------
  // 10) Validació final segons tipus
  // -------------------------------------------------------------
  const isGood =
    (isMs && fiatIsGood) ||
    (isEs && fiatIsGood);

  // -------------------------------------------------------------
  // 11) RETURN FI COMPLET
  // -------------------------------------------------------------
  return {
    isGood,
    discard: !isGood,
    score: fiatScore,

    // 🔥 FIAT‑JS complet
    magPts,
    macdPts,
    trendPts,
    satPts,
    modeEff
  };
}
