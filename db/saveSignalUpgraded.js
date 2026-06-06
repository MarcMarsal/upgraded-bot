// db/saveSignalUpgraded.js — FIAT‑UPGRADED (patrons + ATR + tracking)

import { client } from "./client.js";
import { splitSpainDate } from "../core/utils.js";
import { sendTelegram } from "../telegram/send.js";

/**
 * Guarda una senyal FIAT‑UPGRADED a la taula signals_upgraded
 *
 * - timestamp = moment de la vela (ms)
 * - created_at = moment real en què el bot crea la senyal (ms)
 */
export async function saveSignalUpgraded({
  symbol,
  timeframe,
  type,        // "M" o "E"
  color,
  entry,
  entryr,
  tp,
  sl,
  timestamp    // ms (moment de la vela)
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
    "APT-USDT",
    "ATOM-USDT",
    "BNB-USDT",
    "DOT-USDT",
    "FET-USDT"
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
      closed
    )
    VALUES (
      $1,$2,$3,
      $4,$5,$6,$7,
      $8,$9,$10,$11,$12,
      $13,$14,
      false
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
      createdAt
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
