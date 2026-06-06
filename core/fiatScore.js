// -------------------------------------------------------------
// FIAT 2.x — Punts, pesos i score final en JS pur
// -------------------------------------------------------------

// Config FIAT per símbols (copiat del Pine)
const fiatSymbols = [
  "ADAUSDT", "APTUSDT", "ARBUSDT", "ASTERUSDT", "ATOMUSDT",
  "AVAXUSDT", "BCHUSDT", "BNBUSDT", "BTCUSDT", "DOTUSDT",
  "ETHUSDT", "FETUSDT", "HBARUSDT", "INJUSDT", "NEARUSDT",
  "OPUSDT", "RENDERUSDT", "SEIUSDT", "SUIUSDT", "VIRTUALUSDT",
  "XRPUSDT", "LINKUSDT", "SOLUSDT"
];

const fiat_wMag       = Array(fiatSymbols.length).fill(3.0);
const fiat_wMacd      = Array(fiatSymbols.length).fill(1.0);
const fiat_wTrend     = Array(fiatSymbols.length).fill(7.0);
const fiat_wSat       = Array(fiatSymbols.length).fill(2.0);
const fiat_thr        = Array(fiatSymbols.length).fill(0.75);

const fiat_wMag_range   = Array(fiatSymbols.length).fill(1.0);
const fiat_wMacd_range  = Array(fiatSymbols.length).fill(1.5);
const fiat_wSat_range   = Array(fiatSymbols.length).fill(1.5);
const fiat_thr_range    = Array(fiatSymbols.length).fill(1.0);
const fiat_wTrend_range = Array(fiatSymbols.length).fill(0.0);

// Recuperar config FIAT segons mode (TREND/RANGE/TRANS) i símbol
export function getFiat2Config(symbol, modeEff) {
  let idx = fiatSymbols.indexOf(symbol);
  if (idx === -1) idx = 0;

  if (modeEff === 1) {
    return {
      wMag:   fiat_wMag[idx],
      wMacd:  fiat_wMacd[idx],
      wTrend: fiat_wTrend[idx],
      wSat:   fiat_wSat[idx],
      thr:    fiat_thr[idx]
    };
  } else if (modeEff === 0) {
    return {
      wMag:   fiat_wMag_range[idx],
      wMacd:  fiat_wMacd_range[idx],
      wTrend: 0.0,
      wSat:   fiat_wSat_range[idx],
      thr:    fiat_thr_range[idx]
    };
  } else {
    return {
      wMag: 0.0, wMacd: 0.0, wTrend: 0.0, wSat: 0.0, thr: 999.0
    };
  }
}

// Aplicar score FIAT 2.x
export function applyFiat2Score(symbol, magPts, macdPts, trendPts, satPts, modeEff) {
  const cfg = getFiat2Config(symbol, modeEff);
  const fiatScore =
    cfg.wMag   * magPts +
    cfg.wMacd  * macdPts +
    cfg.wTrend * trendPts +
    cfg.wSat   * satPts;

  const fiatIsGood = fiatScore >= cfg.thr;
  return { fiatScore, fiatIsGood };
}
