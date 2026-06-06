// -------------------------------------------------------------
// fiatScore.js — FIAT 2.0 exacte
// -------------------------------------------------------------

const fiatConfig = {
  TREND: {
    wMag: 3,
    wMacd: 1,
    wTrend: 7,
    wSat: 2,
    thr: 0.75
  },
  RANGE: {
    wMag: 1,
    wMacd: 1.5,
    wTrend: 0,
    wSat: 1.5,
    thr: 1.0
  },
  TRANS: {
    wMag: 0,
    wMacd: 0,
    wTrend: 0,
    wSat: 0,
    thr: 999
  }
};

function getFiatConfigFor(symbol, modeEff) {
  if (modeEff === 1) return fiatConfig.TREND;
  if (modeEff === 0) return fiatConfig.RANGE;
  return fiatConfig.TRANS;
}

export function applyFiat2Score(
  symbol,
  magPts,
  macdPts,
  trendPts,
  satPts,
  modeEff
) {
  const cfg = getFiatConfigFor(symbol, modeEff);

  const fiatScore =
    cfg.wMag * magPts +
    cfg.wMacd * macdPts +
    cfg.wTrend * trendPts +
    cfg.wSat * satPts;

  const fiatIsGood = fiatScore >= cfg.thr;

  return { fiatScore, fiatIsGood };
}

  return { fiatScore, fiatIsGood };
}
