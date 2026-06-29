// bot_microimpulsos.js — FIAT‑PRO (patrons + ATR + tracking + ordres)

import cron from "node-cron";
import { client, initDB } from "./db/client.js";
import { alreadySent2 } from "./db/alreadySent2.js";
import { saveSignal2 } from "./db/saveSignal2.js";
import { detectMSES } from "./core/patterns.js";
import { fetchAndStoreCandles } from "./core/fetchcandles.js";
import { splitSpainDate } from "./core/utils.js";

import { fetchMarkPrice, fetchOpenInterest } from "./core/fetchMarketData.js";
import { updateSLReconstruction } from "./core/sl_reconstructor.js";

import { orderManager } from "./core/orders/orderManager.js";
import { getOpenCandle } from "./core/candles/getOpenCandle.js";
import { cleanBuckets } from "./core/buckets/cleanBuckets.js";

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

const TIMEFRAMES = ["1H", "4H"];

// -------------------------------------------------------------
// TIMEFRAME → MS
// -------------------------------------------------------------
function timeframeToMs(tf) {
  if (tf === "1H") return 60 * 60 * 1000;
  if (tf === "4H") return 4 * 60 * 60 * 1000;
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
// ATR14 SIMPLE
// -------------------------------------------------------------
function calcATR(candles, period = 14) {
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

  const entryr =
    type === "M"
      ? entry - body * 0.15
      : entry + body * 0.15;

  const { tp, sl } = tpSlAtr1(type === "M", entry, atr);

  return { entry, entryr, tp, sl };
}

// -------------------------------------------------------------
// PROCESSAR UN SÍMBOL (FIAT‑PRO)
// -------------------------------------------------------------
export async function processSymbol(symbol, timeframe) {
  const candles = await getCandlesFromDB(symbol, timeframe, 80);
  if (!candles || candles.length < 40) return;

  candles.sort((a, b) => a.timestamp - b.timestamp);

  const atr = calcATR(candles, 14);
  if (atr == null) return;

  const { signals } = await detectMSES(candles, symbol, timeframe);
  if (!signals || signals.length === 0) return;

  for (const sig of signals) {
    if (sig.type !== "M" && sig.type !== "E") continue;

    const exists = await alreadySent2(symbol, timeframe, sig.timestamp);
    if (exists) continue;

    console.log("[FIAT‑PRO]", symbol, timeframe, sig.type, sig.timestamp);

    const { entry, entryr, tp, sl } = calcTargets(
      sig.type,
      sig.thirdCandle,
      atr
    );
    sig.entry = entry;
    sig.entryr = entryr;
    sig.tp = tp;
    sig.sl = sl;

    await saveSignal2({
      symbol: sig.symbol,
      timeframe: sig.timeframe,
      type: sig.type,
      entry: sig.entry,
      entryr: sig.entryr,
      tp: sig.tp,
      sl: sig.sl,
      timestamp: sig.timestamp
    });
  }
}

// -------------------------------------------------------------
// TRACKING TP/SL ANTIC
// -------------------------------------------------------------
async function checkOpenSignals() {
  const res = await client.query(`
    SELECT *
    FROM signals_upgraded
    WHERE closed = false
  `);

  for (const s of res.rows) {
    if (s.tp == null && s.sl == null) continue;

    const curr = await getOpenCandle(s.symbol, s.timeframe);
    if (!curr) continue;

    const high = curr.high;
    const low = curr.low;

    let hitTP = false;
    let hitSL = false;

    const isLong = s.type === "M";
    const isShort = s.type === "E";

    if (isLong) {
      if (high >= s.tp) hitTP = true;
      if (low <= s.sl) hitSL = true;
    }

    if (isShort) {
      if (low <= s.tp) hitTP = true;
      if (high >= s.sl) hitSL = true;
    }

    if (hitTP || hitSL) {
      const nowMs = Date.now();
      const { date_es, hora_es } = splitSpainDate(nowMs);

      await client.query(
        `
        UPDATE signals_upgraded
        SET closed = true,
            result = $1,
            timestamp_closed = $2,
            date_es_closed = $3,
            hora_es_closed = $4
        WHERE id = $5
      `,
        [hitTP ? "TP" : "SL", nowMs, date_es, hora_es, s.id]
      );

      console.log(`[TRACK] ${s.symbol} ${s.type} → ${hitTP ? "TP" : "SL"}`);
    }
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

  // 3) Tracking TP/SL antic
  await checkOpenSignals();

// -------------------------------------------------------------
// 4) FIAT‑PRO INSTITUCIONAL: buckets + ordres LIMIT (DOMINANT)
// -------------------------------------------------------------
for (const symbol of ["BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT"]) {
  try {
    const mark = await fetchMarkPrice(symbol);
    const oi = await fetchOpenInterest(symbol);

    if (!mark || !oi) continue;

    const price_now = mark.markPx;
    const ts = Date.now();

    // ATR actual
    const atrCandles = await getCandlesFromDB(symbol, "1H", 80);
    const atrRaw = calcATR(atrCandles, 14);
    if (!atrRaw) continue;

    const atr = Number(atrRaw);
    console.log("[ATR]", symbol, "ATR:", atr, "price:", price_now);

    // Reconstrucció institucional (detecta buckets)
    await updateSLReconstruction(symbol, price_now, oi.oi, ts, atr, "1H");

    // Neteja institucional de buckets
    await cleanBuckets(symbol, "1H", atr, price_now);

    // Obtenir TOTS els buckets vius del símbol
    const bucketsRes = await client.query(
      `SELECT *
       FROM sl_buckets
       WHERE symbol = $1
       ORDER BY bucket_price ASC`,
      [symbol]
    );

    if (bucketsRes.rows.length === 0) continue;

    // FIAT‑PRO DOMINANT: bucket per SIZE
    const bucketsSymbol = bucketsRes.rows;
    const dominantBucket = bucketsSymbol.reduce(
      (best, b) =>
        !best || Number(b.total_size) > Number(best.total_size) ? b : best,
      null
    );

    if (!dominantBucket) continue;

    const bucket_price = Number(dominantBucket.bucket_price);
    const side = dominantBucket.side;

    console.log("[DOMINANT]", symbol, "side:", side, "bucket:", bucket_price, "size:", dominantBucket.total_size);

    // 3) si hi ha un trade ACTIVE → NO obrir res
    const activeRes = await client.query(
      `SELECT *
       FROM orders
       WHERE symbol = $1
         AND timeframe = '1H'
         AND status = 'ACTIVE'
       LIMIT 1`,
      [symbol]
    );

    const hasActiveOrder = activeRes.rows.length > 0;

    if (hasActiveOrder) {
      console.log("[ACTIVE BLOCK]", symbol, "ACTIVE order present, skipping");
      continue;
    }

    // 4) si NO hi ha trade actiu → mirar si ja existeix ordre pendent per aquest bucket
    const pendingRes = await client.query(
      `SELECT *
       FROM orders
       WHERE symbol = $1
         AND timeframe = '1H'
         AND bucket_price = $2
         AND status = 'PENDING_ENTRY'
       LIMIT 1`,
      [symbol, bucket_price]
    );

    const pendingOrder = pendingRes.rows[0] || null;
    const existingPending = !!pendingOrder;

    // 5) Condició institucional FIAT‑PRO
    let isNear = false;

    if (side === "short") {
      isNear = price_now < bucket_price &&
               (bucket_price - price_now) <= atr;
    } else if (side === "long") {
      isNear = price_now > bucket_price &&
               (price_now - bucket_price) <= atr;
    }

    console.log("[CHECK]", symbol, "side:", side, "price:", price_now, "bucket:", bucket_price, "ATR:", atr, "isNear:", isNear, "existingPending:", existingPending);

    // 6) CREAR ORDRE LIMIT
    if (!existingPending && isNear) {

      const entry_price = bucket_price;

      const tp = side === "long"
        ? entry_price + atr
        : entry_price - atr;

      const sl = side === "long"
        ? entry_price - atr
        : entry_price + atr;

      console.log("[ENTRY]", symbol, "CREATING ORDER", "side:", side, "entry:", entry_price, "tp:", tp, "sl:", sl);

      await createOrder({
         symbol,
         timeframe: "1H",
         bucket_price,
         side,
         entry_price,
         atr,
         tp,
         sl,
         zone_ts,
         price_now
      });

    }

    // 7) CANCEL·LAR ORDRE LIMIT si el preu se’n va
    if (existingPending) {
      const isFar = Math.abs(price_now - bucket_price) > 2 * atr;
      console.log("[CANCEL CHECK]", symbol, "price:", price_now, "bucket:", bucket_price, "isFar:", isFar);

      if (isFar) {
        console.log("[CANCEL]", symbol, "CANCEL ORDER", pendingOrder.id);
        await cancelOrder(pendingOrder.id);
      }
    }

  } catch (err) {
    console.log("Error FIAT‑PRO institucional", symbol, err.message);
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
