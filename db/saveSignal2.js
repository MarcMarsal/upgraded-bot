// db/saveSignal2.js — FIAT‑PRO SIMPLE (patrons + ATR + tracking)

import { client } from "./client.js";
import { splitSpainDate } from "../core/utils.js";
import { sendTelegram } from "../telegram/send.js";

export async function saveSignal2({
  symbol,
  timeframe,
  type,        // "M" o "E"
  entry,
  entryr,
  tp,
  sl,
  timestamp   // ms (moment de la vela)
}) {
  const tsMs = Number(timestamp);
  const createdAt = Date.now();

  // Criptos activades per enviar alerta
  const ACTIVE_CRYPTOS_4H = [
    "BTC-USDT",
    "FET-USDT",
    "LINK-USDT",
    "RENDER-USDT",
    "SOL-USDT",
    "XRP-USDT"
  ];

  const ACTIVE_CRYPTOS_1H = [
    "APT-USDT",
    "LINK-USDT",
    "OP-USDT",
    "SOL-USDT"
  ];

  const activeList = timeframe === "1H" ? ACTIVE_CRYPTOS_1H : ACTIVE_CRYPTOS_4H;

  // Data ES basada en la vela
  const { date_es, hora_es, timestamp_es } = splitSpainDate(tsMs);

  await client.query(
    `
    INSERT INTO signals_upgraded (
      symbol,
      timeframe,
      type,
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
      $13,
      false
    )
    ON CONFLICT DO NOTHING
    `,
    [
      symbol,
      timeframe,
      type,
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

  // Enviar alerta si la cripto està activada
  if (activeList.includes(symbol)) {
    await sendTelegram({
      bot: "FIAT-PRO",
      symbol,
      timeframe,
      signalType: type,
      entry: Number(entry).toFixed(4),
      tp: Number(tp).toFixed(4),
      sl: Number(sl).toFixed(4)
    });
  }
}
