// panell_okx.js — FIAT‑PRO (portfolio)

import http from "http";
import { readPortfolio } from "./core/portfolio.js";     // ✔ PATH correcte
import { okxClient } from "./core/okx/okxClient.js";
import { formatSpainTime } from "./core/utils.js";

// Format numèric
function fmt(n) {
  return n !== null && n !== undefined ? Number(n).toFixed(6) : "-";
}

// Renderitzar taula de cartera OKX
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

// Servidor HTTP
async function startPanel() {

  http.createServer(async (req, res) => {
    if (req.url === "/") {

      // 🔥 Llegir cartera OKX amb el client correcte
      const portfolio = await readPortfolio(okxClient);

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
  }).listen(process.env.PORT || 3001);

  console.log("Panell OKX FIAT‑PRO en marxa (port 3001)");
}

startPanel();
