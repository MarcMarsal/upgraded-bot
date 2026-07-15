// bot_microimpulsos.js — FIAT‑PRO (patrons + ATR + tracking + ordres)

import cron from "node-cron";
import { client, initDB } from "./db/client.js";
import { alreadySent2 } from "./db/alreadySent2.js";
import { saveSignal2 } from "./db/saveSignal2.js";
import { detectMSES } from "./core/patterns.js";
import { fetchAndStoreCandles } from "./core/fetchcandles.js";

// -------------------------------------------------------------
// LLISTES FIAT‑PRO
// -------------------------------------------------------------

// 1) Univers complet (informativa, no detecta ni envia)
const UNIVERSE = [
  "APT-USDT","LINK-USDT","OP-USDT","SOL-USDT","BTC-USDT","FET-USDT",
  "RENDER-USDT","XRP-USDT","ARB-USDT","ATOM-USDT","BNB-USDT","DOT-USDT",
  "ETH-USDT","INJ-USDT","PEPE-USDT","TRUMP-USDT","ADA-USDT","ASTER-USDT",
  "AVAX-USDT","BCH-USDT","HBAR-USDT","NEAR-USDT","SEI-USDT","SUI-USDT",
  "VIRTUAL-USDT","LTC-USDT"
];

const ACTIVE_CRYPTO_LIST = [
  "ARB-USDT","AVAX-USDT","BNB-USDT","DOT-USDT","ETH-USDT",
  "HBAR-USDT","INJ-USDT","LINK-USDT","SEI-USDT","SOL-USDT","SUI-USDT","VIRTUAL-USDT",
  "XRP-USDT"
];



function shouldProcess(symbol) {
  return ACTIVE_CRYPTO_LIST.includes(symbol);
}



function applyFiatFilters(candles, candleIndex, atrManual, type) {
  const atr = atrManual[candleIndex];
  if (!atr || candleIndex - 20 < 0) {
    return {
      isGood: false,
      slope: null,
      wicksBoth: false,
      color: "blue"
    };
  }

  // --- Slope FIAT‑MS/ES v2.3 ---
  const slopeLen = 20;
  const slope = candles[candleIndex].close - candles[candleIndex - slopeLen].close;
  const slopeOk = Math.abs(slope) < atr * 3.5;

  // --- Wicks ATR suau ---
  const o = candles[candleIndex].open;
  const c = candles[candleIndex].close;
  const h = candles[candleIndex].high;
  const l = candles[candleIndex].low;

  const wickUp   = h - Math.max(o, c);
  const wickDown = Math.min(o, c) - l;

  const wicksBoth = (wickUp > atr * 0.05) && (wickDown > atr * 0.05);

  // --- Classificació GOOD/DISCARD ---
  const isGood = slopeOk && wicksBoth;

  // --- Colors FIAT ---
  let color;
  if (!isGood) {
    color = "blue";                // DISCARD
  } else {
    color = type === "M" ? "green" // MS GOOD
                         : "red";  // ES GOOD
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

const TIMEFRAMES = ["1H"];

// -------------------------------------------------------------
// TIMEFRAME → MS
// -------------------------------------------------------------
function timeframeToMs(tf) {
  if (tf === "1H") return 60 * 60 * 1000;
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

function tpSlFiat(isLong, entry, atr) {
  const tpMult = 0.4;
  const slMult = 1.0;

  const tp = isLong ? entry + atr * tpMult : entry - atr * tpMult;
  const sl = isLong ? entry - atr * slMult : entry + atr * slMult;

  return { tp, sl };
}

function calcTargets(type, candles, atrManual, candleIndex) {
  const entry = candles[candleIndex].close;
  const atrEv = atrManual[candleIndex];

  const { tp, sl } = tpSlFiat(type === "M", entry, atrEv);
  return { entry, tp, sl };
}

// -------------------------------------------------------------
// PROCESSAR UN SÍMBOL (FIAT‑PRO)
// -------------------------------------------------------------
export async function processSymbol(symbol, timeframe) {

  // --- 1) Només processem criptos bones ---
  if (!shouldProcess(symbol)) return;

  const candles = await getCandlesFromDB(symbol, timeframe, 120);
  //const candles = await getCandlesFromDB(symbol, timeframe, 2160);
  if (!candles || candles.length < 40) return;

  candles.sort((a, b) => a.timestamp - b.timestamp);

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

    // FIAT‑MS/ES v2.3 encapsulat
    const { isGood, slope, wicksBoth, color } = applyFiatFilters(candles, candleIndex, atrManual, sig.type);
    
    // Congelar valors
    sig.isGood = isGood;
    sig.slope = slope;
    sig.wicksBoth = wicksBoth;
    sig.color = color;


    // --- 3) TP/SL ---
    const { entry, tp, sl } = calcTargets(
      sig.type,
      candles,
      atrManual,
      candleIndex
    );

    sig.entry = entry;
    sig.tp    = tp;
    sig.sl    = sl;

    
    await saveSignal2({
      symbol:   sig.symbol,
      timeframe:sig.timeframe,
      type:     sig.type,
      entry:    sig.entry,
      tp:       sig.tp,
      sl:       sig.sl,
      timestamp:sig.timestamp,
      color:    sig.color,
      isGood:   sig.isGood,
      slope:    sig.slope,
      wicksBoth:sig.wicksBoth
    });
  }
}

// -------------------------------------------------------------
// LOOP PRINCIPAL FIAT‑PRO
// -------------------------------------------------------------
async function mainLoop() {

  // 1) Actualitzar veles
  for (const symbol of UNIVERSE) {
    for (const timeframe of TIMEFRAMES) {
      await fetchAndStoreCandles(symbol, timeframe);
    }
  }

  // 2) Processar patrons FIAT‑PRO
  for (const symbol of ACTIVE_CRYPTO_LIST) {
    for (const timeframe of TIMEFRAMES) {
      try {
        await processSymbol(symbol, timeframe);
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
  console.log("Bot FIAT‑PRO en marxa (patrons + ATR + tracking + ordres)");
  cron.schedule("* * * * *", mainLoop);
}

startBot();
