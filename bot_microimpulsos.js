// bot_microimpulsos.js — MICRO‑PULSE (patrons + ATR + tracking + ordres)

import cron from "node-cron";
import { client, initDB } from "./db/client.js";
import { alreadySent2 } from "./db/alreadySent2.js";
import { saveSignal2 } from "./db/saveSignal2.js";
import { detectMSES } from "./core/patterns.js";
import { fetchAndStoreCandles } from "./core/fetchcandles.js";
import { calculateRSI } from "./core/rsi.js";
import { ACTIVE_CRYPTO_LIST, UNIVERSE } from "./core/activeCryptos.js";
import { getPerformance48h } from "./core/stats.js";
import { fetchAndStoreCandles1HCustom } from "./core/fetchCandles1H10m.js";

import { calcFourthExtreme } from "./core/calcFourthExtreme.js";
import { calcRetroces } from "./core/calcRetroces.js";
import { loadRetrocesPctCripto } from "./core/loadRetrocesPctCripto.js";
import { calcEntryR } from "./core/calcEntryR.js";
import { calcTpSlFiat } from "./core/calcTpSlFiat.js";



function shouldProcess(symbol) {
  return ACTIVE_CRYPTO_LIST.includes(symbol);
}

// -------------------------------------------------------------
// FILTRES MICRO‑PULSE (abans FIAT‑PRO)
// -------------------------------------------------------------
function applyMicroPulseFilters(candles, candleIndex, atrManual, type, timeframe) {
  const atr = atrManual[candleIndex];
  //const slopeLen = timeframe === "15m" ? 40 : 20;
  const slopeLen = 20;
  //if (!atr || candleIndex - 20 < 0) {
  if (!atr || candleIndex - slopeLen < 0) {
    
    return {
      isGood: false,
      slope: null,
      wicksBoth: false,
      color: "blue"
    };
  }

  //const slopeLen = 20;
  const slope = candles[candleIndex].close - candles[candleIndex - slopeLen].close;
  const slopeOk = Math.abs(slope) < atr * 3.5;

  const o = candles[candleIndex].open;
  const c = candles[candleIndex].close;
  const h = candles[candleIndex].high;
  const l = candles[candleIndex].low;

  const wickUp   = h - Math.max(o, c);
  const wickDown = Math.min(o, c) - l;

  const wicksBoth = (wickUp > atr * 0.05) && (wickDown > atr * 0.05);

  const isGood = slopeOk && wicksBoth;

  let color;
  if (!isGood) {
    color = "blue";
  } else {
    color = type === "M" ? "green" : "red";
  }

  return {
    isGood,
    slope,
    wicksBoth,
    color
  };
}

// -------------------------------------------------------------
// CONFIG
// -------------------------------------------------------------
//const TIMEFRAMES = ["1H"];
//const TIMEFRAMES = ["1H","1H10m"];
const TIMEFRAMES_DOWNLOAD = ["5m","15m","30m","1H"];
//const TIMEFRAMES_EXECUTE = ["1H", "1H10m"];
const TIMEFRAMES_EXECUTE = ["15m","1H","1H03m","1H10m","1H33m","1H40m"];



// -------------------------------------------------------------
// TIMEFRAME → MS
// -------------------------------------------------------------
function timeframeToMs(tf) {
  if (tf === "1H") return 60 * 60 * 1000;
  if (tf === "1H03m") return 60 * 60 * 1000;   // continua sent 60 min
  if (tf === "1H10m") return 60 * 60 * 1000;   // continua sent 60 min
  if (tf === "1H33m") return 60 * 60 * 1000;   // continua sent 60 min
  if (tf === "1H40m") return 60 * 60 * 1000;   // continua sent 60 min
  if (tf === "30m") return 30 * 60 * 1000;
  if (tf === "15m") return 15 * 60 * 1000;
  if (tf === "5m") return 5 * 60 * 1000;
  throw new Error("Timeframe no suportat: " + tf);
}

// -------------------------------------------------------------
// LLEGIR VELAS DE LA DB
// -------------------------------------------------------------
async function getCandlesFromDB(symbol, timeframe, limit, untilTimestamp = null) {
  if (untilTimestamp === null) {
    const res = await client.query(`
      SELECT *
      FROM candles
      WHERE symbol = $1 AND timeframe = $2
      ORDER BY timestamp DESC
      LIMIT $3
    `, [symbol, timeframe, limit]);

    return res.rows.reverse();
  }

  const nextTs = Number(untilTimestamp) + Number(timeframeToMs(timeframe));

  const res = await client.query(`
    SELECT *
    FROM candles
    WHERE symbol = $1 AND timeframe = $2
    AND timestamp <= $3
    ORDER BY timestamp DESC
    LIMIT $4
  `, [symbol, timeframe, nextTs, limit]);

  return res.rows.reverse();
}

// -------------------------------------------------------------
// ATRSeries SIMPLE
// -------------------------------------------------------------
function calcATRManualSeries(candles, atrLen = 10) {
  const atrManual = new Array(candles.length).fill(null);

  for (let i = atrLen; i < candles.length; i++) {
    let trSum = 0;

    for (let j = 0; j < atrLen; j++) {
      const cur  = candles[i - j];
      const prev = candles[i - j - 1];

      const highLow   = cur.high - cur.low;
      const highClose = Math.abs(cur.high - prev.close);
      const lowClose  = Math.abs(cur.low  - prev.close);

      const tr = Math.max(highLow, highClose, lowClose);
      trSum += tr;
    }

    atrManual[i] = trSum / atrLen;
  }

  return atrManual;
}

// -------------------------------------------------------------
// TP/SL MICRO‑PULSE (abans FIAT‑PRO)
// -------------------------------------------------------------
function tpSlMicroPulse(isLong, entry, atr) {
  //const tpMult = 0.5;
  //const slMult = 1.0;
  const tpMult = 0.6;
  const slMult = 0.8;

  const tp = isLong ? entry + atr * tpMult : entry - atr * tpMult;
  const sl = isLong ? entry - atr * slMult : entry + atr * slMult;

  return { tp, sl };
}

// -------------------------------------------------------------
// PROCESSAR UN SÍMBOL (MICRO‑PULSE)
// -------------------------------------------------------------
// -------------------------------------------------------------
// PROCESSAR UN SÍMBOL (MICRO‑PULSE)
// -------------------------------------------------------------
export async function processSymbol(symbol, timeframe) {

  if (!shouldProcess(symbol)) return;

  let candles = await getCandlesFromDB(symbol, timeframe, 25);
  if (!candles || candles.length < 20) return;

  candles.sort((a, b) => a.timestamp - b.timestamp);

  // NORMALITZACIÓ PEPE
  if (symbol === "PEPE-USDT") {
    const k = 1000;
    candles = candles.map(c => ({
      ...c,
      open:  c.open  * k,
      high:  c.high  * k,
      low:   c.low   * k,
      close: c.close * k
    }));
  }

  const atrManual = calcATRManualSeries(candles, 10);
  if (!atrManual || atrManual.every(v => v === null)) return;

  const { signals } = await detectMSES(candles, symbol, timeframe);
  if (!signals || signals.length === 0) return;

  for (const sig of signals) {
    if (sig.type !== "M" && sig.type !== "E") continue;

    const exists = await alreadySent2(symbol, timeframe, sig.timestamp);
    if (exists) continue;

    const candleIndex = candles.findIndex(c => c.timestamp === sig.timestamp);
    if (candleIndex === -1) continue;

    // -------------------------------------------------------------
    // FILTRES MICRO‑PULSE
    // -------------------------------------------------------------
    const { isGood, slope, wicksBoth, color } =
      applyMicroPulseFilters(candles, candleIndex, atrManual, sig.type, timeframe);

    sig.isGood = isGood;
    sig.slope = slope;
    sig.wicksBoth = wicksBoth;
    sig.color = color;

    // -------------------------------------------------------------
    // TERCERA VELA (FIAT)
    // -------------------------------------------------------------
    sig.third_open      = sig.thirdCandle.open;
    sig.third_close     = sig.thirdCandle.close;
    sig.third_high      = sig.thirdCandle.high;
    sig.third_low       = sig.thirdCandle.low;
    sig.third_body      = Math.abs(sig.thirdCandle.close - sig.thirdCandle.open);
    sig.third_timestamp = sig.thirdCandle.timestamp;


    // -------------------------------------------------------------
    // CONTAMINACIÓ FIAT (metxes grans en qualsevol de les 3 veles)
    // -------------------------------------------------------------
    const body1 = Math.abs(sig.firstCandle.open - sig.firstCandle.close);

    // metxes primera vela
    const wick1_up = sig.firstCandle.high - Math.max(sig.firstCandle.open, sig.firstCandle.close);
    const wick1_dn = Math.min(sig.firstCandle.open, sig.firstCandle.close) - sig.firstCandle.low;

    // metxes segona vela
    const wick2_up = sig.secondCandle.high - Math.max(sig.secondCandle.open, sig.secondCandle.close);
    const wick2_dn = Math.min(sig.secondCandle.open, sig.secondCandle.close) - sig.secondCandle.low;

    // metxes tercera vela
    const wick3_up = sig.thirdCandle.high - Math.max(sig.thirdCandle.open, sig.thirdCandle.close);
    const wick3_dn = Math.min(sig.thirdCandle.open, sig.thirdCandle.close) - sig.thirdCandle.low;

    // regla FIAT institucional
    sig.wick_contaminated =
      wick1_up > body1 ||
      wick1_dn > body1 ||
      wick2_up > body1 ||
      wick2_dn > body1 ||
      wick3_up > body1 ||
      wick3_dn > body1;

    // -------------------------------------------------------------
    // QUARTA VELA (FIAT)
    // -------------------------------------------------------------
    sig.fourth_extreme = calcFourthExtreme(candles, candleIndex, sig.type);
    if (!sig.fourth_extreme) continue;

    // -------------------------------------------------------------
    // RETROCES (FIAT)
    // -------------------------------------------------------------
    sig.retroces_pct = calcRetroces(
      sig.third_close,
      sig.fourth_extreme,
      sig.third_body
    );

    // -------------------------------------------------------------
    // RETROCES P50 PER CRIPTO (FIAT)
    // -------------------------------------------------------------
    sig.retroces_pct_cripto = await loadRetrocesPctCripto(symbol);
    if (!sig.retroces_pct_cripto) continue;

    // -------------------------------------------------------------
    // ENTRYR FIAT
    // -------------------------------------------------------------
    sig.entryr = calcEntryR(
      sig.type,
      sig.third_close,
      sig.third_body,
      sig.retroces_pct_cripto
    );

    // -------------------------------------------------------------
    // ATR
    // -------------------------------------------------------------
    sig.atr = atrManual[candleIndex];
    if (!sig.atr) continue;

    // -------------------------------------------------------------
    // TP/SL FIAT
    // -------------------------------------------------------------
    const { tp, sl } = calcTpSlFiat(
      sig.type,
      sig.entryr,
      sig.third_body,
      sig.atr
    );

    sig.tp = tp;
    sig.sl = sl;

    // -------------------------------------------------------------
    // ENTRY original del patró
    // -------------------------------------------------------------
    sig.entry = candles[candleIndex].close;

    // -------------------------------------------------------------
    // RSI
    // -------------------------------------------------------------
    const q = await client.query(`
      SELECT close
      FROM candles
      WHERE symbol=$1 AND timeframe=$2
      ORDER BY timestamp DESC
      LIMIT 15
    `, [symbol, timeframe]);

    const closes = q.rows.map(r => Number(r.close)).reverse();
    sig.rsi = calculateRSI(closes);

    // -------------------------------------------------------------
    // PANELL 48h
    // -------------------------------------------------------------
    const perf = await getPerformance48h(symbol, timeframe);
    sig.tps48h = perf.tps;
    sig.percent48h = perf.percent;

    // -------------------------------------------------------------
    // VELAS 30m (FIAT tendència + volatilitat)
    // -------------------------------------------------------------
    const candles30m = await getCandlesFromDB(symbol, "30m", 50);
    if (!candles30m || candles30m.length < 20) continue;

    candles30m.sort((a, b) => a.timestamp - b.timestamp);

    const atr30mSeries = calcATRManualSeries(candles30m, 10);
    const atr30m = atr30mSeries[atr30mSeries.length - 1];
    sig.atr30m = atr30m;

    // slope FIAT 30m (5/10)
    const lenA = 5;
    const lenB = 10;

    if (candles30m.length > lenB) {

      const lastClose = candles30m[candles30m.length - 1].close;
      const slopeA = lastClose - candles30m[candles30m.length - lenA].close;
      const slopeB = lastClose - candles30m[candles30m.length - lenB].close;

      sig.slope30m = (slopeA + slopeB) / 2;
     
    } else {
      sig.slope30m = null;
    }

    // -------------------------------------------------------------
    // APTE STATUS FIAT (volatilitat + slope)
    // -------------------------------------------------------------
    function calcApteStatus(slope30m, atr30m) {
      if (slope30m === null || atr30m === null) return "NO_APTE";

      const lastClose = candles30m[candles30m.length - 1].close;
      const volPct = atr30m / lastClose;

      // Volatilitat FIAT
      if (volPct < 0.0025 || volPct > 0.0065) {
        return "NO_APTE";
      }

      // Rang dur (no operable)
      if (Math.abs(slope30m) < atr30m * 0.10) {
        return "NO_APTE";
      }

      // Rang suau (operable M i E)
      if (Math.abs(slope30m) < atr30m * 0.35) {
        return "APTE_ALL";
      }

      // Tendència clara
      if (slope30m > 0) return "APTE_M";
      if (slope30m < 0) return "APTE_E";

      return "NO_APTE";
   }




    // -------------------------------------------------------------
    // GUARDAR SENYAL (FIAT complet)
    // -------------------------------------------------------------
    await saveSignal2({
      symbol:        sig.symbol,
      timeframe:     sig.timeframe,
      type:          sig.type,

      entry:         sig.entry,
      entryr:        sig.entryr,
      tp:            sig.tp,
      sl:            sig.sl,
      timestamp:     sig.timestamp,

      color:         sig.color,
      isGood:        sig.isGood,
      slope:         sig.slope,
      wicksBoth:     sig.wicksBoth,

      rsi:           sig.rsi,
      tps48h:        sig.tps48h,
      percent48h:    sig.percent48h,
      
      // 🔥 FIAT — PRIMERA VELA
      first_open:    sig.firstCandle.open,
      first_close:   sig.firstCandle.close,
      first_high:    sig.firstCandle.high,
      first_low:     sig.firstCandle.low,
      first_body:    sig.firstCandle.body,

      // 🔥 FIAT — SEGONA VELA
      second_open:   sig.secondCandle.open,
      second_close:  sig.secondCandle.close,
      second_high:   sig.secondCandle.high,
      second_low:    sig.secondCandle.low,
      second_body:   sig.secondCandle.body,
      
      third_open:      sig.third_open,
      third_close:     sig.third_close,
      third_high:      sig.third_high,
      third_low:       sig.third_low,
      third_body:      sig.third_body,
      third_timestamp: sig.third_timestamp,

      fourth_extreme:  sig.fourth_extreme,
      retroces_pct:    sig.retroces_pct,
      retroces_pct_cripto: sig.retroces_pct_cripto,

      atr:             sig.atr,
      
      // 🔥 FIAT — CONTAMINACIÓ (de moment false)
      wick_contaminated: sig.wick_contaminated,

      slope30m: sig.slope30m,
      atr30m: sig.atr30m,
      apte_status: sig.apteStatus

    });
  }
}



// -------------------------------------------------------------
// LOOP PRINCIPAL MICRO‑PULSE
// -------------------------------------------------------------
async function mainLoop() {

  for (const symbol of UNIVERSE) {
    //for (const timeframe of TIMEFRAMES) {
    for (const timeframe of TIMEFRAMES_DOWNLOAD) {
      await fetchAndStoreCandles(symbol, timeframe);   // 1H intacte
    }

    // 🔥 nova temporalitat off-grid
    //await fetchAndStoreCandles1H10m(symbol);
    await fetchAndStoreCandles1HCustom(symbol,3);
    await fetchAndStoreCandles1HCustom(symbol,10);
    await fetchAndStoreCandles1HCustom(symbol,33);
    await fetchAndStoreCandles1HCustom(symbol,40);
  }

  for (const symbol of ACTIVE_CRYPTO_LIST) {
    //for (const timeframe of TIMEFRAMES) {
    for (const timeframe of TIMEFRAMES_EXECUTE) {
      try {
        await processSymbol(symbol, timeframe);   // ara també processa 1H10m
      } catch (err) {
        console.log("Error processant", symbol, timeframe, err.message);
      }
    }
  }
}


// -------------------------------------------------------------
// START BOT
// -------------------------------------------------------------
async function startBot() {
  await initDB();
  console.log("Bot MICRO‑PULSE en marxa (patrons + ATR + tracking + ordres)");
  cron.schedule("* * * * *", mainLoop);
  //cron.schedule("0 * * * *", mainLoop);
}

startBot();
