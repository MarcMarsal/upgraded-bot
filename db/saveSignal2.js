// db/saveSignal2.js — FIAT‑PRO SIMPLE (patrons + ATR + tracking)

import { client } from "./client.js";
import { splitSpainDate } from "../core/utils.js";
import { sendTelegram } from "../telegram/send.js";

export async function saveSignal2({
  symbol,
  timeframe,
  type,        // "M" o "E"
  entry,
  tp,
  sl,
  timestamp,   // ms (moment de la vela)

  // 🔥 FIAT‑PRO diagnostics
  color,
  isGood,
  body3,
  range1,
  ratio
}) {
  const tsMs = Number(timestamp);
  const createdAt = Date.now();

  const ACTIVE_CRYPTOS_4H = [
    "BTC-USDT","FET-USDT","LINK-USDT","RENDER-USDT","SOL-USDT","XRP-USDT"
  ];

  const ACTIVE_CRYPTOS_1H = [
    "APT-USDT","LINK-USDT","OP-USDT","SOL-USDT"
  ];

  const activeList = timeframe === "1H" ? ACTIVE_CRYPTOS_1H : ACTIVE_CRYPTOS_4H;

  const { date_es, hora_es, timestamp_es } = splitSpainDate(tsMs);

  await client.query(
    `
    INSERT INTO signals_upgraded (
      symbol,
      timeframe,
      type,
      color,
      entry,
      tp,
      sl,
      timestamp,
      timestamp_ms,
      timestamp_es,
      date_es,
      hora_es,
      created_at,
      closed,
      is_good,
      body3,
      range1,
      ratio
    )
    VALUES (
      $1,$2,$3,
      $4,
      $5,$6,$7,
      $8,$9,$10,$11,$12,
      $13,
      false,
      $14,$15,$16,$17
    )
    ON CONFLICT DO NOTHING
    `,
    [
      symbol,
      timeframe,
      type,
      color,
      entry,
      tp,
      sl,
      tsMs,
      tsMs,
      timestamp_es,
      date_es,
      hora_es,
      createdAt,
      isGood,
      body3,
      range1,
      ratio
    ]
  );
  await sendTelegram({
    bot: "FIAT-PRO",
    symbol,
    timeframe,
    signalType: type,
    color,   // 🟩 FIAT‑PRO: ara sí, enviem el color
    entry: Number(entry).toFixed(4),
    tp: Number(tp).toFixed(4),
    sl: Number(sl).toFixed(4)
  });
 
  
}
