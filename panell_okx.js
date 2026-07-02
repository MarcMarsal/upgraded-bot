// panell_okx.js — FIAT‑PRO (portfolio)

import http from "http";
import crypto from "crypto";
import axios from "axios";
import { formatSpainTime } from "./core/utils.js";

// ===============================
// Credencials OKX
// ===============================
const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

// ===============================
// Signatura OKX (igual que la resta del bot)
// ===============================
function sign(message) {
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(message)
    .digest("base64");
}

// ===============================
// Llegir cartera OKX (FIAT‑PRO style)
// ===============================
async function readPortfolio() {
  const path = "/api/v5/account/balance";
  const timestamp = new Date().toISOString();
  const message = timestamp + "GET" + path;
  const signature = sign(message);

  const headers = {
    "OK-ACCESS-KEY": API_KEY,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": PASSPHRASE,
    "x-simulated-trading": "1"
  };

  const url = "https://my.okx.com" + path;

  const res = await axios.get(url, { headers });

  const details = res.data.data[0].details;

  const portfolio = { usdc: 0, btc: 0, eth: 0, sol: 0 };

  for (const asset of details) {
    switch (asset.ccy) {
      case "USDC": portfolio.usdc = parseFloat(asset.availEq); break;
      case "BTC":  portfolio.btc  = parseFloat(asset.availEq); break;
      case "ETH":  portfolio.eth  = parseFloat(asset.availEq); break;
      case "SOL":  portfolio.sol  = parseFloat(asset.availEq); break;
    }
  }

  return portfolio;
}

// ===============================
// Format numèric
// ===============================
function fmt(n) {
  return n !== null && n !== undefined ? Number(n).toFixed(6) : "-";
}

// ===============================
// Render taula
// ===============================
function renderPortfolioTable(p) {
  return `
    <h2>Cartera OKX (SPOT · Paper Trading)</h2>
    <table>
      <thead>
        <tr>
          <th>Actiu</th>
          <th>Disponible</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>USDC</td><td>${fmt(p.usdc)}</td></tr>
        <tr><td>BTC</td><td>${fmt(p.btc)}</td></tr>
        <tr><td>ETH</td><td>${fmt(p.eth)}</td></tr>
        <tr><td>SOL</td><td>${fmt(p.sol)}</td></tr>
      </tbody>
    </table>
  `;
}

// ===============================
// Servidor HTTP
// ===============================
async function startPanel() {

  http.createServer(async (req, res) => {
    if (req.url === "/") {

      const portfolio = await readPortfolio();
      const portfolioHTML = renderPortfolioTable(portfolio);
      const lastUpdate = formatSpainTime(Date.now());

      const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="60">
        <style>
          body {
            background-color: #000;
            color: #00ff00;
            font-family: Consolas, monospace;
            padding: 20px;
          }
          table {
            border-collapse: collapse;
            width: 50%;
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
        <h1>Panell OKX — FIAT‑PRO</h1>
        <p><b>Última actualització:</b> ${lastUpdate}</p>

        ${portfolioHTML}

      </body>
      </html>
      `;

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    res.writeHead(200);
    res.end("Panell OKX FIAT‑PRO OK");
  }).listen(process.env.PORT || 3000);

  console.log("Panell OKX FIAT‑PRO en marxa (port 3000)");
}

startPanel();
