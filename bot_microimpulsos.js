// bot_microimpulsos.js — FIAT‑PRO (patrons + ATR + tracking + ordres)

import cron from "node-cron";
import { client, initDB } from "./db/client.js";
import { alreadySent2 } from "./db/alreadySent2.js";
import { saveSignal2 } from "./db/saveSignal2.js";
import { detectMSES } from "./core/patterns.js";
import { fetchAndStoreCandles } from "./core/fetchcandles.js";
import { splitSpainDate } from "./core/utils.js";

// -------------------------------------------------------------
// CONFIG
// -------------------------------------------------------------
//const ACTIVE_CRYPTOS = [
//  "ADA-USDT","APT-USDT","ARB-USDT","ATOM-USDT","ASTER-USDT",
//  "AVAX-USDT","BCH-USDT","BNB-USDT","BTC-USDT","DOT-USDT",
//  "ETH-USDT","FET-USDT","HBAR-USDT","INJ-USDT","LINK-USDT",
//  "NEAR-USDT","OP-USDT","RENDER-USDT","SEI-USDT","SOL-USDT",
//  "SUI-USDT","VIRTUAL-USDT","XRP-USDT","PEPE-USDT","TRUMP-USDT",
//  "LTC-USDT"
//];

const ACTIVE_CRYPTOS = [
  "APT-USDT","ARB-USDT","ATOM-USDT","AVAX-USDT","BCH-USDT",
  "BNB-USDT","BTC-USDT","DOT-USDT","ETH-USDT","ETH-USDC",
  "HBAR-USDT","INJ-USDT","LINK-USDT","LINK-USDC","OP-USDT",
  "RENDER-USDT","SEI-USDT","SOL-USDT","SOL-USDC","SUI-USDT",
  "VIRTUAL-USDT","XRP-USDT","PEPE-USDT","TRUMP-USDT","LTC-USDT"
];



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

  // candles ordenades de més antiga a més nova
  for (let i = atrLen; i < candles.length; i++) {
    let trSum = 0;

    for (let j = 0; j < atrLen; j++) {
      const cur  = candles[i - j];     // high[j], low[j]
      const prev = candles[i - j - 1]; // close[j+1]

      const highLow   = cur.high - cur.low;
      const highClose = Math.abs(cur.high - prev.close);
      const lowClose  = Math.abs(cur.low  - prev.close);

      const tr = Math.max(highLow, highClose, lowClose);
      trSum += tr;
    }

    atrManual[i] = trSum / atrLen;
  }

  return atrManual; // mateix significat que atrManual al Pine
}

function tpSlFiat(isLong, entry, atr) {
  //const tpMult = 1.5;
  const tpMult = 0.5;
  const slMult = 1.0;

  const tp = isLong ? entry + atr * tpMult : entry - atr * tpMult;
  const sl = isLong ? entry - atr * slMult : entry + atr * slMult;

  return { tp, sl };
}

function calcTargets(type, candles, atrManual, candleIndex) {
  const entry = candles[candleIndex].close;   // close[barsAgo]
  const atrEv = atrManual[candleIndex];       // atrManual[barsAgo]

  const { tp, sl } = tpSlFiat(type === "M", entry, atrEv);
  return { entry, tp, sl };
}




// -------------------------------------------------------------
// PROCESSAR UN SÍMBOL (FIAT‑PRO)
// -------------------------------------------------------------
export async function processSymbol(symbol, timeframe) {
  const candles = await getCandlesFromDB(symbol, timeframe, 120); // 80–120 és suficient
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
      body3:    sig.body3,
      range1:   sig.range1,
      ratio:    sig.ratio
    });
  }
}

// -------------------------------------------------------------
// LOOP PRINCIPAL FIAT‑PRO
// -------------------------------------------------------------
async function mainLoop() {
  // 1) Actualitzar veles
  for (const symbol of ACTIVE_CRYPTOS) {
    for (const timeframe of TIMEFRAMES) {
      await fetchAndStoreCandles(symbol, timeframe);
    }
  }

  // 2) Processar patrons FIAT‑PRO (M/E)
  for (const symbol of ACTIVE_CRYPTOS) {
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
