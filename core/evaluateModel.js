// -------------------------------------------------------------
// FIAT 2.x — Avaluació MS/ES en JS pur (substitueix evaluateWithPine)
// -------------------------------------------------------------

import { computeMacdStuff, computeMicroTrend, computeTrend12h } from "./indicators.js";
import { applyFiat2Score } from "./fiatScore.js";

// Detectar MS/ES RAW (mateix patró que al Pine)
function detectMsEs(candles) {
  const n = candles.length;
  if (n < 4) return { msRaw: false, esRaw: false };

  const o1 = candles[n - 4].open;
  const h1 = candles[n - 4].high;
  const l1 = candles[n - 4].low;
  const c1 = candles[n - 4].close;

  const o2 = candles[n - 3].open;
  const c2 = candles[n - 3].close;

  const o3 = candles[n - 2].open;
  const c3 = candles[n - 2].close;

  const isBull = (o, c) => c > o;
  const isBear = (o, c) => c < o;

  const msCond = isBear(o1, c1) &&
    Math.abs(c2 - o2) <= (h1 - l1) * 0.3 &&
    isBull(o3, c3);

  const esCond = isBull(o1, c1) &&
    Math.abs(c2 - o2) <= (h1 - l1) * 0.3 &&
    isBear(o3, c3);

  return { msRaw: msCond, esRaw: esCond };
}

// Mode selector (TREND/RANGE) basat en microTrend
function computeModeEff(closes) {
  const { microTrend } = computeMicroTrend(closes);
  const newMode = microTrend !== 0 ? 1 : 0;
  // histeresi mínima ignorada per simplicitat
  return newMode; // 1 TREND, 0 RANGE
}

// Funció principal: avaluar senyal
export function evaluateWithModel(candles, sig) {
  const closes = candles.map(c => c.close);

  // 1) Detectar MS/ES
  const { msRaw, esRaw } = detectMsEs(candles);
  const isMs = msRaw;
  const isEs = esRaw;

  if (!isMs && !isEs) {
    return { isGood: false, discard: true };
  }

  // 2) MAGNITUD
  const n = candles.length;
  const o1 = candles[n - 4].open;
  const c1 = candles[n - 4].close;
  const o3 = candles[n - 2].open;
  const c3 = candles[n - 2].close;

  const bodyFirst = Math.abs(c1 - o1);
  const bodyThird = Math.abs(c3 - o3);
  const magOK = bodyThird > bodyFirst * 0.6;
  const magPts = magOK ? 1 : 0;

  // 3) MACD + SATURACIÓ
  const { macdLine, signalLine, histSmooth, histStdev } = computeMacdStuff(closes);
  const len = histSmooth.length;
  const lenSt = histStdev.length;
  if (len === 0 || lenSt === 0) {
    return { isGood: false, discard: true };
  }
  const hs = histSmooth[len - 1];
  const st = histStdev[lenSt - 1];

  const bullishSaturation = hs > st * 2.5;
  const bearishSaturation = hs < -st * 2.5;

  // 4) MicroTrend
  const { microTrend } = computeMicroTrend(closes);

  // 5) MACD punts direccional
  const macdPts =
    (isMs && microTrend === 1 && hs > 0) ? 1 :
    (isEs && microTrend === -1 && hs < 0) ? 1 :
    0;

  // 6) TREND punts (penalització contratrendència)
  let trendPts = 0;
  if (isMs && microTrend === 1) trendPts = 1;
  else if (isMs && microTrend === -1) trendPts = -1;
  else if (isEs && microTrend === -1) trendPts = 1;
  else if (isEs && microTrend === 1) trendPts = -1;

  // 7) SAT punts
  const satPts =
    (isMs && bullishSaturation) ? 1 :
    (isEs && bearishSaturation) ? 1 :
    0;

  // 8) Impuls
  const isImpulse = magPts === 1 && macdPts === 1;

  // 9) Mode efectiu
  const modeEff = computeModeEff(closes); // 1 TREND, 0 RANGE

  // 10) Score FIAT
  let { fiatScore, fiatIsGood } = applyFiat2Score(
    sig.symbol,
    magPts,
    macdPts,
    trendPts,
    satPts,
    modeEff
  );

  // 11) Ajustos segons mode (imitant Pine)
  if (modeEff === -1) {
    fiatIsGood = false;
  } else if (modeEff === 0) {
    const { fiatScore: scoreNoTrend, fiatIsGood: isGoodNoTrend } = applyFiat2Score(
      sig.symbol,
      magPts,
      macdPts,
      0,
      satPts,
      modeEff
    );
    fiatScore = scoreNoTrend;
    fiatIsGood = isImpulse ? false : isGoodNoTrend;
  }

  const isGood =
    (sig.type === "M" && isMs && fiatIsGood) ||
    (sig.type === "E" && isEs && fiatIsGood);

 return {
  isGood,
  discard: !isGood,
  score: fiatScore,

  // 🔥 FIAT‑JS (això és el que faltava)
  magPts,
  macdPts,
  trendPts,
  satPts,
  modeEff
};

}
