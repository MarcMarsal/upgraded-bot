// db/saveSignal2.js — FIAT‑MS/ES v2.3 (patrons + ATR + tracking)

import { client } from "./client.js";
import { splitSpainDate } from "../core/utils.js";
import { sendTelegram } from "../telegram/send.js";

export async function saveSignal2({
  symbol,
  timeframe,
  type,
  entry,
  tp,
  sl,
  timestamp,

  color,
  isGood,
  slope,
  wicksBoth,

  rsi        // 🟩 AFEGIT
}) {

  const tsMs = Number(timestamp);
  const createdAt = Date.now();

  // Data ES basada en la vela
  const { date_es, hora_es, timestamp_es } = splitSpainDate(tsMs);

  // -------------------------------------------------------------
  // GUARDAR SENYAL FIAT‑MS/ES v2.3
  // -------------------------------------------------------------
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
      slope,
      wicks_both,
      rsi
    )
    VALUES (
      $1,$2,$3,
      $4,
      $5,$6,$7,
      $8,$9,$10,$11,$12,
      $13,
      false,
      $14,$15,$16,
      $17
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
      slope,
      wicksBoth,
      rsi
    ]
  );

  // -------------------------------------------------------------
  // ENVIAR ALERTA TELEGRAM (FIAT‑MS/ES v2.3)
  // -------------------------------------------------------------
  //await sendTelegram({
  //  bot: "FIAT-PRO",
  //  symbol,
  //  timeframe,
  //  signalType: type,
  //  color,
  //  entry: Number(entry).toFixed(4),
  //  tp: Number(tp).toFixed(4),
  //  sl: Number(sl).toFixed(4)
  //});
}

