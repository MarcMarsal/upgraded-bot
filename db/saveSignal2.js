// db/saveSignal2.js — FIAT‑MS/ES v2.5 (patrons + ATR + tracking + entryR + tercera vela)

import { client } from "./client.js";
import { splitSpainDate } from "../core/utils.js";
import { fmt } from "../core/activeCryptos.js";

export async function saveSignal2({
  symbol,
  timeframe,
  type,

  // entrades
  entry,
  entryr,

  // TP/SL
  tp,
  sl,

  // timestamps
  timestamp,

  // filtres
  color,
  isGood,
  slope,
  wicksBoth,

  // RSI + panell
  rsi,
  tps48h,
  percent48h,

  // 🔥 nous camps
  third_open,
  third_close,
  third_high,
  third_low,
  third_body,
  third_timestamp,
  atr
}) {

  const tsMs = Number(timestamp);
  const createdAt = Date.now();

  const { date_es, hora_es, timestamp_es } = splitSpainDate(tsMs);

  // format FIAT per cryptos (ADA, PEPE, etc.)
  entry        = fmt(entry,        symbol);
  entryr       = fmt(entryr,       symbol);
  tp           = fmt(tp,           symbol);
  sl           = fmt(sl,           symbol);
  third_open   = fmt(third_open,   symbol);
  third_close  = fmt(third_close,  symbol);
  third_high   = fmt(third_high,   symbol);
  third_low    = fmt(third_low,    symbol);
  third_body   = fmt(third_body,   symbol);
  atr          = fmt(atr,          symbol);

  await client.query(
    `
    INSERT INTO signals_upgraded (
      symbol,
      timeframe,
      type,
      color,

      entry,
      entryr,
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
      slope,
      wicks_both,
      rsi,
      tps48h,
      percent48h,

      -- 🔥 nous camps
      third_open,
      third_close,
      third_high,
      third_low,
      third_body,
      third_timestamp,
      atr
    )
    VALUES (
      $1,$2,$3,
      $4,

      $5,$6,
      $7,$8,

      $9,$10,$11,$12,$13,
      $14,
      false,

      $15,$16,$17,
      $18,$19,$20,

      -- 🔥 nous camps
      $21,$22,$23,$24,$25,$26,$27
    )
    ON CONFLICT DO NOTHING
    `,
    [
      symbol,
      timeframe,
      type,
      color,

      entry,
      entryr,
      tp,
      sl,

      tsMs,
      tsMs,
      timestamp_es,
      date_es,
      hora_es,
      createdAt,

      isGood,
      slope,
      wicksBoth,
      rsi,
      tps48h,
      percent48h,

      // 🔥 nous camps
      third_open,
      third_close,
      third_high,
      third_low,
      third_body,
      third_timestamp,
      atr
    ]
  );
}
