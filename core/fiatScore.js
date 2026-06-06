// -------------------------------------------------------------
// fiatScore.js — FIAT 2.0 exacte (pesos + score)
// -------------------------------------------------------------

// Config FIAT 2.0 per sym i mode (TREND / RANGE / TRANS)
const fiatConfig = {
  // Exemple genèric; adapta si tens taules específiques per sym
  // Aquí assumim mateixos pesos que al Pine que m’has passat:
  // wMag = 3, wMacd = 1, wTrend = 7, wSat = 2, thr = 0.75 (TREND)
  // RANGE: wTrend = 0, thr_range = 1.0, etc.
  TREND: {
    wMag: 3.0,
    wMacd: 1.0,
    wTrend: 7.0,
    wSat: 2.0,
    thr: 0.75
  },
  RANGE: {
    wMag: 1.0,
    wMacd: 1.5,
    wTrend: 0.0,
    wSat: 1.5,
    thr: 1.0
  },
  TRANS: {
    wMag: 0.0,
    wMacd: 0.0,
    wTrend: 0.0,
    wSat: 0.0,
    thr: 999.0
  }
};

// Si tens per-symbol, aquí podries mapejar per sym, però la lògica FIAT 2.0
// és la mateixa: segons modeEff, agafes TREND/RANGE/TRANS.
function getFiatConfigFor(symbol, modeEff) {
  if (modeEff === 1) return fiatConfig.TREND;
  if (modeEff === 0) return fiatConfig.RANGE;
  return fiatConfig.TRANS;
}

// -------------------------------------------------------------
// applyFiat2Score — FIAT 2.0 exacte
// -------------------------------------------------------------
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
