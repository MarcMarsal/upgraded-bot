// panell_okx.js — FIAT‑PRO (portfolio)

import http from "http";
import { initDB, client } from "./db/client.js";
import { formatSpainTime } from "./core/utils.js";

// Format numèric
function fmt(n) {
  return n !== null && n !== undefined ? Number(n).toFixed(6) : "-";
}

// Llegir l'últim portfolio OKX de la BD
async function getPortfolioFromDB() {
  const q = await client.query(`
    SELECT usdc, btc, eth, sol, updated_at
    FROM okx_portfolio
    ORDER BY updated_at DESC
    LIMIT 1
  `);

  return q.rows[0];
}

// Llegir buckets ordenats per estat
async function getBuckets() {
  const q = await client.query(`
    SELECT *
    FROM sl_buckets
    ORDER BY timestamp_created DESC
  `);

  const buckets = q.rows;

  // Ordenació FIAT‑PRO
  const orderMap = {
    "available": 1,
    "mitigated": 2,
    "closed": 3,
    "cancelled": 4
  };

  return buckets.sort((a, b) => {
    const sa = orderMap[a.status] || 99;
    const sb = orderMap[b.status] || 99;
    return sa - sb;
  });
}

// Renderitzar taula de buckets
function renderBucketsTable(buckets) {
  let rows = "";

  for (const b of buckets) {
    rows += `
      <tr>
        <td>${b.symbol}</td>
        <td>${b.side}</td>
        <td>${fmt(b.bucket_price)}</td>
        <td>${fmt(b.tp_price)}</td>
        <td>${fmt(b.sl_price)}</td>
        <td>${b.status}</td>
        <td>${b.cancel_reason || "-"}</td>
        <td>${b.order_status || "-"}</td>
        <td>${formatSpainTime(b.timestamp_created)}</td>
      </tr>
    `;
  }

  return `
    <h2>Buckets FIAT‑PRO</h2>
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Side</th>
          <th>Entry</th>
          <th>TP</th>
          <th>SL</th>
          <th>Status</th>
          <th>Cancel Reason</th>
          <th>Order Status</th>
          <th>Created</th>
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

      const p = await getPortfolioFromDB();
      const buckets = await getBuckets();

      const portfolioHTML = renderPortfolioTable(p);
      const bucketsHTML = renderBucketsTable(buckets);

      const lastUpdate = formatSpainTime(p.updated_at);

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
            width: 90%;
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
        ${bucketsHTML}

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
