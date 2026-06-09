import { computeMacdStuff, computeMicroTrend } from "./indicators.js";
import { applyFiat2Score } from "./fiatScore.js";

export function evaluateWithModel(candles, sig) {
  const n = candles.length;
  if (n < 6) {
    return {
      isGood: false,
      discard: true,
      score: 0,
      magPts: 0,
      macdPts: 0,
      trendPts: 0,
      satPts: 0,
      modeEff: 0,
      microTrend: 0,
      emaNow: 0,
      emaPast: 0,
      slope: 0,
      velaActualTs: null,
      velaValidadaTs: null,
      velaPastTs: null,
      velaFirstPatternTs: null,
      velaThirdPatternTs: null
    };
  }

  // -------------------------------------------------------------
  // 1) Veles del patró (igual que TradingView)
  // -------------------------------------------------------------
  const velaActual = candles[n - 1];
  const velaValidada = candles[n - 2];

  const closesAll = candles.map(c => c.close);
  const closesClosed = closesAll.slice(0, -1);

  const isMs = sig.type === "M";
  const isEs = sig.type === "E";

  const o1 = candles[n - 4].open;
  const c1 = candles[n - 4].close;

  const o3 = candles[n - 2].open;
  const c3 = candles[n - 2].close;

  // -------------------------------------------------------------
  // 2) MAG (1:1 TradingView)
  // -------------------------------------------------------------
  const bodyFirst = Math.abs(c1 - o1);
  const bodyThird = Math.abs(c3 - o3);
  const magOK = bodyThird > bodyFirst * 0.6;
  const magPts = magOK ? 1 : 0;

  // -------------------------------------------------------------
  // 3) MACD + SAT (1:1 TradingView)
  // -------------------------------------------------------------
  const { histSmooth, histStdev } = computeMacdStuff(closesClosed);
  const hs = histSmooth[histSmooth.length - 1];
  const st = histStdev[histStdev.length - 1];

  const bullishSaturation = hs > st * 2.5;
  const bearishSaturation = hs < -st * 2.5;

  // -------------------------------------------------------------
  // 4) MICRO TREND (1:1 TradingView)
  // -------------------------------------------------------------
  const { microTrend, emaNow, emaPast, slope } = computeMicroTrend(closesClosed);

  // -------------------------------------------------------------
  // 5) MACD PTS (1:1 TradingView)
  // -------------------------------------------------------------
  const macdPts =
    (isMs && microTrend === 1 && hs > 0) ? 1 :
    (isEs && microTrend === -1 && hs < 0) ? 1 :
    0;

  // -------------------------------------------------------------
  // 6) TREND PTS (1:1 TradingView)
  // -------------------------------------------------------------
  let trendPts = 0;
  if (isMs && microTrend === 1) trendPts = 1;
  else if (isMs && microTrend === -1) trendPts = -1;
  else if (isEs && microTrend === -1) trendPts = 1;
  else if (isEs && microTrend === 1) trendPts = -1;

  // -------------------------------------------------------------
  // 7) SAT PTS (1:1 TradingView)
  // -------------------------------------------------------------
  const satPts =
    (isMs && bullishSaturation) ? 1 :
    (isEs && bearishSaturation) ? 1 :
    0;

  // -------------------------------------------------------------
  // 8) modeEff (1:1 TradingView)
  // -------------------------------------------------------------
  const modeEff = microTrend !== 0 ? 1 : 0;

  // -------------------------------------------------------------
  // 9) SCORE FIAT EXACTE (1:1 TradingView)
  // -------------------------------------------------------------
  let { fiatScore, fiatIsGood } = applyFiat2Score(
    sig.symbol,
    magPts,
    macdPts,
    trendPts,
    satPts,
    modeEff
  );

  // -------------------------------------------------------------
  // 10) BLOQUEIG D’IMPULSOS EN RANGE (1:1 TradingView)
  // -------------------------------------------------------------
  if (modeEff === 0) {
    const { fiatScore: scoreNoTrend, fiatIsGood: isGoodNoTrend } =
      applyFiat2Score(sig.symbol, magPts, macdPts, 0, satPts, modeEff);

    fiatScore = scoreNoTrend;

    const isImpulse = magPts === 1 && macdPts === 1;
    fiatIsGood = isImpulse ? false : isGoodNoTrend;
  }

  // -------------------------------------------------------------
  // 11) RESULTAT FINAL
  // -------------------------------------------------------------
  const isGood = fiatIsGood && (isMs || isEs);

  const microLookback = 4;
  const velaPast = candles[n - 2 - microLookback];
  const velaFirstPattern = candles[n - 4];
  const velaThirdPattern = candles[n - 2];

  return {
    isGood,
    discard: !isGood,
    score: fiatScore,
    magPts,
    macdPts,
    trendPts,
    satPts,
    modeEff,
    microTrend,
    emaNow,
    emaPast,
    slope,
    velaActualTs: velaActual.timestamp,
    velaValidadaTs: velaValidada.timestamp,
    velaPastTs: velaPast.timestamp,
    velaFirstPatternTs: velaFirstPattern.timestamp,
    velaThirdPatternTs: velaThirdPattern.timestamp
  };
}
