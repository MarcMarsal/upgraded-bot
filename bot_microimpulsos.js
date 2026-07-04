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
const ACTIVE_CRYPTOS = [
  "ADA-USDT","APT-USDT","ARB-USDT","ATOM-USDT","ASTER-USDT",
  "AVAX-USDT","BCH-USDT","BNB-USDT","BTC-USDT","DOT-USDT",
  "ETH-USDT","FET-USDT","HBAR-USDT","INJ-USDT","LINK-USDT",
  "NEAR-USDT","OP-USDT","RENDER-USDT","SEI-USDT","SOL-USDT",
  "SUI-USDT","VIRTUAL-USDT","XRP-USDT","PEPE-USDT","TRUMP-USDT","LTC-USDT"
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
// ATR10 SIMPLE
// -------------------------------------------------------------
function calcATR(candles, period = 10) {
  if (!candles || candles.length <= period) return null;

  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];

    const highLow = cur.high - cur.low;
    const highClose = Math.abs(cur.high - prev.close);
    const lowClose = Math.abs(cur.low - prev.close);

    trs.push(Math.max(highLow, highClose, lowClose));
  }

  if (trs.length < period) return null;

  const last = trs.slice(-period);
  return last.reduce((a, b) => a + b, 0) / period;
}

// -------------------------------------------------------------
// TP/SL FIAT‑PRO (ATR * 1)
// -------------------------------------------------------------
function tpSlAtr1(isLong, entry, atr) {
  const tp = isLong ? entry + atr : entry - atr;
  const sl = isLong ? entry - atr : entry + atr;
  return { tp, sl };
}

// -------------------------------------------------------------
// ENTRYR / TP / SL FIAT‑PRO
// -------------------------------------------------------------
function calcTargets(type, thirdCandle, atr) {
  const { open, close } = thirdCandle;
  const body = Math.abs(close - open);

  const entry = close;

  const { tp, sl } = tpSlAtr1(type === "M", entry, atr);

  return { entry, tp, sl };
}


// -------------------------------------------------------------
// PROCESSAR UN SÍMBOL (FIAT‑PRO)
// -------------------------------------------------------------
export async function processSymbol(symbol, timeframe) {
  const candles = await getCandlesFromDB(symbol, timeframe, 80);
  if (!candles || candles.length < 40) return;

  candles.sort((a, b) => a.timestamp - b.timestamp);

  const atr = calcATR(candles, 10);
  if (atr == null) return;

  const { signals } = await detectMSES(candles, symbol, timeframe);
  if (!signals || signals.length === 0) return;

  for (const sig of signals) {
    if (sig.type !== "M" && sig.type !== "E") continue;

    const exists = await alreadySent2(symbol, timeframe, sig.timestamp);
    if (exists) continue;

    console.log("[FIAT‑PRO]", symbol, timeframe, sig.type, sig.timestamp);

    const { entry, tp, sl } = calcTargets(
      sig.type,
      sig.thirdCandle,
      atr
    );

    sig.entry = entry;
    sig.tp = tp;
    sig.sl = sl;

    await saveSignal2({
      symbol: sig.symbol,
      timeframe: sig.timeframe,
      type: sig.type,
      entry: sig.entry,
      tp: sig.tp,
      sl: sig.sl,
      timestamp: sig.timestamp
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
