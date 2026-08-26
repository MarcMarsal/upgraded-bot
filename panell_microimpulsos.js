// panell_microimpulsos.js — MicroPulse Panel

import http from "http";
import { initDB, client } from "./db/client.js";
import { formatSpainTime } from "./core/utils.js";
import { fmt } from "./core/activeCryptos.js";

// 🟩 MicroPulse — Estat del Mercat BTC (1H)
async function getMarketState() {
  try {
    const q = await client.query(`
      SELECT open, high, low, close, volume
      FROM candles
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

// 🟩 Llegir 40 senyals — NOMÉS OKX
//async function getActiveSignals() {
//  const q = await client.query(`
//    SELECT *
//    FROM signals_upgraded
//    WHERE timeframe='15m'
//    ORDER BY created_at DESC
//    LIMIT 40;
    
 // `);

 // return q.rows;
//}

// 🟩 Llegir 40 senyals — ordenats per última tanda i qualitat FIAT
async function getActiveSignals(timeframeFilter) {
  const q = await client.query(`
    SELECT *
    FROM signals_upgraded
    WHERE timeframe = $1
      --AND pattern_valid = true
    ORDER BY
      created_at DESC,            -- 1) última alerta generada
      third_timestamp DESC,       -- 2) agrupació per vela (tanda)
      retroces_pct_cripto DESC,   -- 3) retrocés històric
      third_body DESC,            -- 4) impuls
      atr ASC,                    -- 5) ATR segur
      slope DESC,                 -- 6) direcció
      wicks_both DESC             -- 7) patró net
    LIMIT 40;
  `, [timeframeFilter]);

  return q.rows;
}


// 🟩 Render taula sense Exchange i sense Entrada
function renderActiveSignalsTable(signals, timeframeFilter) {
  //const filtered = signals.filter(s => s.timeframe === timeframeFilter);
  const filtered = signals;

  let rows = "";

  for (const s of filtered) {
    let color = s.color || "#00ff00";
    if (color.toLowerCase() === "blue") color = "cyan";

    rows += `
      <tr style="color:${color}">
        <td>${s.symbol}</td>
        <td>${s.timeframe}</td>
        <td>${s.type}</td>

        <td>${fmt(s.entryr, s.symbol)}</td>
        <td>${fmt(s.tp, s.symbol)}</td>
        <td>${fmt(s.sl, s.symbol)}</td>

        <td>${s.tps48h}</td>
        <td>${s.percent48h}%</td>

        <td>${s.date_es}</td>
        <td>${s.hora_es}</td>
        <td>${formatSpainTime(s.created_at)}</td>
      </tr>
    `;
  }

  return `
    <h2>Últimes 40 alertes — MicroPulse (OKX)</h2>

    <label style="font-size:18px;">Temporalitat:</label>
    <select id="timeframeSelector" style="font-size:18px; margin-left:10px;">
      <option value="1H">1H</option>
      <option value="15m">15m</option>
      <option value="1H03m">1H03m</option>
      <option value="1H10m">1H10m</option>
      <option value="1H33m">1H33m</option>
      <option value="1H40m">1H40m</option>
    </select>

    <script>
      const saved = localStorage.getItem('mp_timeframe') || '1H';
      document.getElementById('timeframeSelector').value = saved;

      document.getElementById('timeframeSelector').addEventListener('change', (e) => {
        localStorage.setItem('mp_timeframe', e.target.value);
        window.location.href = "/?tf=" + e.target.value;
      });
    </script>

    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Timeframe</th>
          <th>Tipus</th>

          <th>EntradaR</th>
          <th>TP</th>
          <th>SL</th>

          <th>TPs 48h</th>
          <th>%TP 48h</th>

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

    // 🔥 Llegir temporalitat del navegador
    let timeframeFilter = "1H";
    if (req.url.includes("?tf=")) {
      const tf = req.url.split("?tf=")[1];
      if (tf) timeframeFilter = tf;
    }

    if (req.url.startsWith("/")) {
      //const signals = await getActiveSignals();
      const signals = await getActiveSignals(timeframeFilter);

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

        ${renderActiveSignalsTable(signals, timeframeFilter)}

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
