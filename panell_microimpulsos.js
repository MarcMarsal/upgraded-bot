// panell_microimpulsos.js — FIAT‑PRO (multi‑cripto + market_state)

import http from "http";
import { initDB, client } from "./db/client.js";
import { formatSpainTime } from "./core/utils.js";
import { ACTIVE_CRYPTO_LIST } from "./core/activeCryptos.js";
import { getMarketState } from "./core/marketState.js";

// Formatador numèric
function fmt(n) {
  return n !== null && n !== undefined ? Number(n).toFixed(4) : "-";
}

// 🟩 Obtenir estat del mercat de totes les criptos actives
async function getAllMarketStates() {
  const states = {};
  for (const symbol of ACTIVE_CRYPTO_LIST) {
    states[symbol] = await getMarketState(symbol);
  }
  return states;
}

// Llegir últimes 20 alertes FIAT‑PRO
async function getActiveSignals() {
  const q = await client.query(`
    SELECT
      id,
      symbol,
      timeframe,
      type,
      entry,
      tp,
      sl,
      color,
      rsi,
      market_state,     -- 🟩 AFEGIT
      date_es,
      hora_es,
      created_at
    FROM signals_upgraded
    ORDER BY created_at DESC
    LIMIT 20
  `);

  return q.rows;
}

// Render taula de senyals
function renderActiveSignalsTable(signals) {
  let rows = "";

  for (const s of signals) {
    let color = s.color || "#00ff00";
    if (color.toLowerCase() === "blue") color = "cyan";

    rows += `
      <tr style="color: ${color}">
        <td>${s.id}</td>
        <td>${s.symbol}</td>
        <td>${s.timeframe}</td>
        <td>${s.type}</td>
        <td>${fmt(s.entry)}</td>
        <td>${fmt(s.tp)}</td>
        <td>${fmt(s.sl)}</td>
        <td>${fmt(s.rsi)}</td>
        <td>${s.market_state}</td>   <!-- 🟩 AFEGIT -->
        <td>${s.date_es}</td>
        <td>${s.hora_es}</td>
        <td>${formatSpainTime(s.created_at)}</td>
      </tr>
    `;
  }

  return `
    <h2>Últimes 20 alertes FIAT‑PRO</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Symbol</th>
          <th>Timeframe</th>
          <th>Tipus</th>
          <th>Entrada</th>
          <th>TP</th>
          <th>SL</th>
          <th>RSI</th>
          <th>Mercat</th>        <!-- 🟩 AFEGIT -->
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

// Render taula multi‑cripto
function renderMarketStatesTable(states) {
  let rows = "";

  for (const symbol of ACTIVE_CRYPTO_LIST) {
    rows += `
      <tr>
        <td>${symbol}</td>
        <td>${states[symbol]}</td>
      </tr>
    `;
  }

  return `
    <h2>Estat del Mercat (1H) — Criptos Actives</h2>
    <table>
      <thead>
        <tr>
          <th>Cripto</th>
          <th>Estat</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// Servidor HTTP
async function startPanel() {
  await initDB();

  http.createServer(async (req, res) => {
    if (req.url === "/") {
      const signals = await getActiveSignals();
      const signalsHTML = renderActiveSignalsTable(signals);

      const marketStates = await getAllMarketStates();
      const marketStatesHTML = renderMarketStatesTable(marketStates);

      const lastUpdate = formatSpainTime(Date.now());

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
        <h1>Panell Microimpulsos FIAT‑PRO</h1>
        <p><b>Última actualització:</b> ${lastUpdate}</p>

        ${marketStatesHTML}
        ${signalsHTML}

      </body>
      </html>
      `;

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    res.writeHead(200);
    res.end("Panell FIAT‑PRO OK");
  }).listen(process.env.PORT || 3000);

  console.log("Panell Microimpulsos FIAT‑PRO en marxa");
}

startPanel();
