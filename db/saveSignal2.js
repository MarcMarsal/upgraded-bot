// db/saveSignal2.js — FIAT‑UPGRADED (patrons + ATR + tracking + JS eval)

import { client } from "./client.js";
import { splitSpainDate } from "../core/utils.js";
import { sendTelegram } from "../telegram/send.js";

/**
 * Guarda una senyal FIAT‑UPGRADED a la taula signals_upgraded
 *
 * - timestamp = moment de la vela (ms)
 * - created_at = moment real en què el bot crea la senyal (ms)
 */
export async function saveSignal2({
  symbol,
  timeframe,
  type,        // "M" o "E"
  color,
  entry,
  entryr,
  tp,
  sl,
  timestamp,   // ms (moment de la vela)

  // 🔥 Camps JS FIAT 2.0
  mag_pts_js = null,
  macd_pts_js = null,
  trend_pts_js = null,
  sat_pts_js = null,
  mode_js = null,
  score_js = null,
  is_good_js = null,

  // 🔥 Camps NOUS FIAT 2.0 (diagnòstic complet)
  microtrend_js = null,
  ema4_now_js = null,
  ema4_past_js = null,
  slope_js = null,

  vela_actual_timestamp_js = null,
  vela_validada_timestamp_js = null,
  vela_past_timestamp_js = null,
  vela_first_pattern_timestamp_js = null,
  vela_third_pattern_timestamp_js = null
}) {
  const tsMs = Number(timestamp);
  const createdAt = Date.now();

  // 🔥 Criptos ACTIVADES 4H
  const ACTIVE_CRYPTOS_4H = [
    "APT-USDT",
    "BNB-USDT",
    "BTC-USDT",
    "ETH-USDT",
    "FET-USDT",
    "RENDER-USDT",
    "SOL-USDT",
    "XRP-USDT"
  ];

  // 🔥 Criptos ACTIVADES 1H
  const ACTIVE_CRYPTOS_1H = [
    "ARB-USDT",
    "FET-USDT",
    "INJ-USDT",
    "OP-USDT",
    "XRP-USDT"
  ];

  // Seleccionar llista segons timeframe
  const activeList = timeframe === "1H" ? ACTIVE_CRYPTOS_1H : ACTIVE_CRYPTOS_4H;

  // Data ES basada en la vela
  const { date_es, hora_es, timestamp_es } = splitSpainDate(tsMs);

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

      -- 🔥 FIAT 2.0 punts
      mag_pts_js,
      macd_pts_js,
      trend_pts_js,
      sat_pts_js,
      mode_js,
      score_js,
      is_good_js,

      -- 🔥 FIAT 2.0 diagnòstic
      microtrend_js,
      ema4_now_js,
      ema4_past_js,
      slope_js,

      vela_actual_timestamp_js,
      vela_validada_timestamp_js,
      vela_past_timestamp_js,
      vela_first_pattern_timestamp_js,
      vela_third_pattern_timestamp_js
    )
    VALUES (
      $1,$2,$3,
      $4,$5,$6,$7,
      $8,$9,$10,$11,$12,
      $13,$14,
      false,

      $15,$16,$17,$18,$19,$20,$21,

      $22,$23,$24,$25,

      $26,$27,$28,$29,$30
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

      // 🔥 FIAT 2.0 punts
      mag_pts_js,
      macd_pts_js,
      trend_pts_js,
      sat_pts_js,
      mode_js,
      score_js,
      is_good_js,

      // 🔥 FIAT 2.0 diagnòstic
      microtrend_js,
      ema4_now_js,
      ema4_past_js,
      slope_js,

      vela_actual_timestamp_js,
      vela_validada_timestamp_js,
      vela_past_timestamp_js,
      vela_first_pattern_timestamp_js,
      vela_third_pattern_timestamp_js
    ]
  );

  // 🔔 Enviar alerta NOMÉS si la cripto està activada
  if (activeList.includes(symbol)) {
    await sendTelegram({
      symbol,
      timeframe,
      signalType: type,
      entry,
      tp,
      sl
    });
  }
}
