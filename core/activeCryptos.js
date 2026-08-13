// core/activeCryptos.js — Micrpulse

//Retirats per baix winrate: FET-USDT, ASTER-USDT, XRP-USDT, ARB-USDT, INJ-USDT, BCH-USDT, VIRTUAL-USDT
//Retirats per baix guanys: BNB-USDT, BTC-USDT, ETH-USDT

export const ACTIVE_CRYPTO_LIST = [
  "ADA-USDT","APT-USDT","ATOM-USDT","AVAX-USDT","DOGE-USDT",
  "DOT-USDT","HBAR-USDT","KAITO-USDT","LINK-USDT","LTC-USDT",
  "NEAR-USDT","ONDO-USDT","OP-USDT","PAXG-USDT","PENGU-USDT",
  "PEPE-USDT","RENDER-USDT","SEI-USDT","SUI-USDT","TRUMP-USDT",
  "SOL-USDT"
];


export const UNIVERSE = [
  "ADA-USDT","APT-USDT","ARB-USDT","ASTER-USDT","ATOM-USDT",
  "AVAX-USDT","BCH-USDT","BNB-USDT","BTC-USDT","DOGE-USDT",
  "DOT-USDT","ETH-USDT","FET-USDT","HBAR-USDT","INJ-USDT",
  "KAITO-USDT","LINK-USDT","LTC-USDT","NEAR-USDT","ONDO-USDT",
  "OP-USDT","PAXG-USDT","PENGU-USDT","PEPE-USDT","RENDER-USDT",
  "SEI-USDT","SOL-USDT","SUI-USDT","TRUMP-USDT","VIRTUAL-USDT",
  "XRP-USDT"
];


// -------------------------------------------------------------
// DECIMALS PER SIMBOL (FIAT)
// -------------------------------------------------------------
export const DECIMALS = {
  "ADA-USDT": 4,
  "APT-USDT": 4,
  "ARB-USDT": 5,
  "ASTER-USDT": 4,
  "ATOM-USDT": 3,
  "AVAX-USDT": 3,
  "BCH-USDT": 2,
  "BNB-USDT": 2,
  "BTC-USDT": 1,
  "DOGE-USDT": 5,
  "DOT-USDT": 4,

  "ETH-USDT": 2,
  "FET-USDT": 4,
  "HBAR-USDT": 5,
  "INJ-USDT": 3,
  "KAITO-USDT": 4,
  "LINK-USDT": 3,
  "LTC-USDT": 2,
  "ONDO-USDT":4,
  "OP-USDT": 4,
  "PAXG-USDT": 2,
  "PENGU-USDT": 6,
  "PEPE-USDT": 7,
   
  
  "NEAR-USDT": 3,
  "RENDER-USDT": 3,
  "SEI-USDT": 5,
  "SOL-USDT": 2,
  "SUI-USDT": 4,
  
  
  "TRUMP-USDT": 3,
  "VIRTUAL-USDT": 4,
  "XRP-USDT": 4 
};

// -------------------------------------------------------------
// FORMATAR NÚMEROS SEGONS EL SIMBOL
// -------------------------------------------------------------
export function fmt(n, symbol) {
  const d = DECIMALS[symbol] ?? 4;
  return Number(n).toFixed(d);
}
