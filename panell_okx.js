// panell_okx.js — FIAT‑PRO (portfolio + buckets segurs)

import http from "http";
import { initDB, client } from "./db/client.js";
import { formatSpainTime } from "./core/utils.js";

// Format numèric segur
function fmt(n) {
  if (n === null || n === undefined) return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(6);
}

// Format temps segur
function fmtTime(ts) {
  if (!ts) return "-";
  try {
    return formatSpainTime(ts);
  } catch {
    return "-";
  }
}

// Llegir l'últim portfolio OKX de la BD (amb fallback)
async function getPortfolioFromDB() {
  const q = await client.query(`
    SELECT usdc, btc, eth, sol, updated_at
    FROM okx_portfolio
    ORDER BY updated_at DESC
    LIMIT 1
  `);

  const row = q.rows[0];

  if (!row) {
    return {
      usdc: 0,
      btc: 0,
      eth: 0,
      sol: 0,
      updated_at: new Date()
    };
  }

  return row;
}

// Renderitzar taula cartera
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

// Llegir buckets amb ordenació FIAT‑PRO i filtres de seguretat
async function getBuckets() {
  const q = await client.query(`
    SELECT *
    FROM sl_buckets
    ORDER BY timestamp_created DESC
  `);

  const raw = q.rows || [];

  // Filtrar buckets corruptes
  const buckets = raw.filter(b =>
    b &&
    b.symbol &&
    b.bucket_price !== null &&
    b.bucket_price !== undefined
  );

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
  if (!buckets || buckets.length === 0) {
    return `
      <h2>Buckets FIAT‑PRO</h2>
      <p>No hi ha buckets registrats.</p>
    `;
  }

  let rows = "";

  for (const b of buckets) {
    rows += `
      <tr>
        <td>${b.symbol}</td>
        <td>${b.side || "-"}</td>
        <td>${fmt(b.bucket_price)}</td>
        <td>${fmt(b.tp_price)}</td>
        <td>${fmt(b.sl_price)}</td>
        <td>${b.status || "-"}</td>
        <td>${b.cancel_reason || "-"}</td>
        <td>${b.order_status || "-"}</td>
        <td>${fmtTime(b.timestamp_created)}</td>
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
      try {
        const p = await getPortfolioFromDB();
        const buckets = await getBuckets();

        const portfolioHTML = renderPortfolioTable(p);
        const bucketsHTML = renderBucketsTable(buckets);

        const lastUpdate = fmtTime(p.updated_at);

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
      } catch (err) {
        console.error("Error al panell:", err);
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Error intern al panell OKX FIAT‑PRO");
        return;
      }
    }

    res.writeHead(200);
    res.end("Panell OKX FIAT‑PRO OK");
  }).listen(process.env.PORT || 3000);

  console.log("Panell OKX FIAT‑PRO en marxa (port 3000)");
}

startPanel();
