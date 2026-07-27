// panell_microimpulsos.js — MicroPulse Panel

import http from "http";
import { initDB, client } from "./db/client.js";
import { formatSpainTime } from "./core/utils.js";

// Formatador numèric
function fmt(n) {
  return n !== null && n !== undefined ? Number(n).toFixed(4) : "-";
}

// 🟩 MicroPulse — Estat del Mercat BTC (1H)
async function getMarketState() {
  try {
    const q = await client.query(`
      SELECT open, high, low, close, volume
      FROM candles_okx
      WHERE symbol='BTC-USDT' AND timeframe='1H'
      ORDER BY timestamp DESC
      LIMIT 24
    `);

    const candles = q.rows;
    if (!candles || candles.length === 0) return "MORT";

    const avgVolume =
      candles.reduce((a, c) => a + Number(c.volume || 0), 0) / candles.length;

    const avgBody =
      candles.reduce((a, c) => a + Math.abs((c.close || 0) - (c.open || 0)), 0) /
      candles.length;

    const highs = candles.map(c => Number(c.high || 0));
    const lows = candles.map(c => Number(c.low || 0));
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const range = maxHigh - minLow;

    const avgWick =
      candles.reduce((a, c) => {
        const upper = (c.high || 0) - Math.max(c.open || 0, c.close || 0);
        const lower = Math.min(c.open || 0, c.close || 0) - (c.low || 0);
        return a + (upper + lower);
      }, 0) / candles.length;

    let score = 0;
    if (avgVolume > 150) score++;
    if (avgBody > 80) score++;
    if (range > 150) score++;
    if (avgWick > 40) score++;

    if (score >= 3) return "VIU";
    if (score === 2) return "RECONSTRUCCIO";
    return "MORT";

  } catch (err) {
    console.error("❌ Error getMarketState:", err);
    return "ERROR";
  }
}

// 🟩 Llegir 10 senyals per exchange
async function getActiveSignals() {
  const q = await client.query(`
    (
      SELECT *, 'OKX' AS exchange
      FROM signals_upgraded
      ORDER BY created_at DESC
      LIMIT 10
    )
    UNION ALL
    (
      SELECT *, 'BITUNIX' AS exchange
      FROM signals_bitunix
      ORDER BY created_at DESC
      LIMIT 10
    )
    UNION ALL
    (
      SELECT *, 'WEEX' AS exchange
      FROM signals_weex
      ORDER BY created_at DESC
      LIMIT 10
    )
    ORDER BY exchange ASC, created_at DESC;
  `);

  return q.rows;
}

// 🟩 Colors per exchange
function bgColor(exchange) {
  if (exchange === "OKX") return "#ff4d4d";     // vermell
  if (exchange === "BITUNIX") return "#4dff4d"; // verd
  if (exchange === "WEEX") return "#ffff4d";    // groc
  return "#222";
}

function renderActiveSignalsTable(signals) {
  let rows = "";

  for (const s of signals) {
    rows += `
      <tr style="
        background-color: ${bgColor(s.exchange)};
        color: black;
        font-weight: bold;
      ">
        <td>${s.exchange}</td>
        <td>${s.id}</td>
        <td>${s.symbol}</td>
        <td>${s.timeframe}</td>
        <td>${s.type}</td>
        <td>${fmt(s.entry)}</td>
        <td>${fmt(s.entryr)}</td>
        <td>${fmt(s.tp)}</td>
        <td>${fmt(s.sl)}</td>
        <td>${fmt(s.rsi)}</td>
        <td>${s.date_es}</td>
        <td>${s.hora_es}</td>
        <td>${formatSpainTime(s.created_at)}</td>
      </tr>
    `;
  }

  return `
    <h2>Últimes 10 alertes per exchange — MicroPulse</h2>
    <table>
      <thead>
        <tr>
          <th>Exchange</th>
          <th>ID</th>
          <th>Symbol</th>
          <th>Timeframe</th>
          <th>Tipus</th>
          <th>Entrada</th>
          <th>EntradaR</th>
          <th>TP</th>
          <th>SL</th>
          <th>RSI</th>
          <th>Data vela</th>
          <th>Hora vela</th>
          <th>Creat (ES)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// 🟩 Servidor HTTP
async function startPanel() {
  await initDB();

  http.createServer(async (req, res) => {
    if (req.url === "/") {
      const signals = await getActiveSignals();
      const signalsHTML = renderActiveSignalsTable(signals);
      const lastUpdate = formatSpainTime(Date.now());
      const marketState = await getMarketState();

      const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="5">
        <style>
          body {
            background-color: #000;
            color: #00ff00;
            font-family: Consolas, monospace;
            padding: 20px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 40px;
          }
          th, td {
            border: 1px solid #00ff00;
            padding: 6px;
            text-align: center;
          }
          th {
            background-color: #003300;
          }
        </style>
      </head>
      <body>
        <h1>Panell Microimpulsos — MicroPulse</h1>
        <p><b>Última actualització:</b> ${lastUpdate}</p>

        <h2>Estat del Mercat BTC (1H)</h2>
        <p><b>${marketState}</b></p>

        ${signalsHTML}

      </body>
      </html>
      `;

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    res.writeHead(200);
    res.end("Panell MicroPulse OK");
  }).listen(process.env.PORT || 3000);

  console.log("Panell Microimpulsos MicroPulse en marxa");
}

startPanel();

