// db/saveSignal2.js — FIAT‑MS/ES v2.7 (primera/segona vela + wick_contaminated)

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

  // PRIMERA VELA 🔥
  first_open,
  first_close,
  first_high,
  first_low,
  first_body,

  // SEGONA VELA 🔥
  second_open,
  second_close,
  second_high,
  second_low,
  second_body,

  // tercera vela
  third_open,
  third_close,
  third_high,
  third_low,
  third_body,
  third_timestamp,

  // ATR
  atr,

  // quarta vela + retrocesos
  fourth_extreme,
  retroces_pct,
  retroces_pct_cripto,

  // contaminació 🔥
  wick_contaminated
}) {

  const tsMs = Number(timestamp);
  const createdAt = Date.now();

  const { date_es, hora_es, timestamp_es } = splitSpainDate(tsMs);

  // format FIAT
  entry              = fmt(entry,              symbol);
  entryr             = fmt(entryr,             symbol);
  tp                 = fmt(tp,                 symbol);
  sl                 = fmt(sl,                 symbol);

  first_open         = fmt(first_open,         symbol);
  first_close        = fmt(first_close,        symbol);
  first_high         = fmt(first_high,         symbol);
  first_low          = fmt(first_low,          symbol);
  first_body         = fmt(first_body,         symbol);

  second_open        = fmt(second_open,        symbol);
  second_close       = fmt(second_close,       symbol);
  second_high        = fmt(second_high,        symbol);
  second_low         = fmt(second_low,         symbol);
  second_body        = fmt(second_body,        symbol);

  third_open         = fmt(third_open,         symbol);
  third_close        = fmt(third_close,        symbol);
  third_high         = fmt(third_high,         symbol);
  third_low          = fmt(third_low,          symbol);
  third_body         = fmt(third_body,         symbol);

  atr                = fmt(atr,                symbol);
  fourth_extreme     = fmt(fourth_extreme,     symbol);
  retroces_pct       = fmt(retroces_pct,       symbol);
  retroces_pct_cripto = fmt(retroces_pct_cripto, symbol);

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

      -- PRIMERA VELA 🔥
      first_open,
      first_close,
      first_high,
      first_low,
      first_body,

      -- SEGONA VELA 🔥
      second_open,
      second_close,
      second_high,
      second_low,
      second_body,

      -- TERCERA VELA
      third_open,
      third_close,
      third_high,
      third_low,
      third_body,
      third_timestamp,

      atr,

      -- QUARTA + RETROCESOS
      fourth_extreme,
      retroces_pct,
      retroces_pct_cripto,

      -- CONTAMINACIÓ 🔥
      wick_contaminated
    )
    VALUES (
      $1,$2,$3,
      $4,

      $5,$6,$7,$8,

      $9,$10,$11,$12,$13,
      $14,
      false,

      $15,$16,$17,
      $18,$19,$20,

      -- PRIMERA VELA 🔥
      $21,$22,$23,$24,$25,

      -- SEGONA VELA 🔥
      $26,$27,$28,$29,$30,

      -- TERCERA VELA
      $31,$32,$33,$34,$35,$36,

      $37,

      -- QUARTA + RETROCESOS
      $38,$39,$40,

      -- CONTAMINACIÓ 🔥
      $41
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

      // PRIMERA VELA 🔥
      first_open,
      first_close,
      first_high,
      first_low,
      first_body,

      // SEGONA VELA 🔥
      second_open,
      second_close,
      second_high,
      second_low,
      second_body,

      // TERCERA VELA
      third_open,
      third_close,
      third_high,
      third_low,
      third_body,
      third_timestamp,

      atr,

      // QUARTA + RETROCESOS
      fourth_extreme,
      retroces_pct,
      retroces_pct_cripto,

      // CONTAMINACIÓ 🔥
      wick_contaminated
    ]
  );
}
