// core/liquidity.js
// -------------------------------------------------------------
// MÒDUL FI DE LIQUIDITAT OKX — (WebSocket + Zones + Estat + Heartbeat)
// -------------------------------------------------------------

import WebSocket from "ws";
import { client } from "../db/client.js";

// -------------------------------------------------------------
// CONFIG
// -------------------------------------------------------------
const BUCKET_SIZE = 0.003;   // 0.3% per bucket (ajustable)
const MIN_MAGNITUDE = 50000; // magnitud mínima per considerar zona

// Només criptos principals (FI i estable)
const ACTIVE_CRYPTOS = [
  "BTC-USDT",
  "ETH-USDT",
  "SOL-USDT"
];

// -------------------------------------------------------------
// BUFFER DE LIQUIDACIONS (per cada cripto)
// -------------------------------------------------------------
const buffers = {};
for (const s of ACTIVE_CRYPTOS) buffers[s] = [];

// -------------------------------------------------------------
// CONNEXIÓ WEBSOCKET OKX
// -------------------------------------------------------------
let ws = null;
let heartbeatInterval = null;

export function startLiquidityFeed() {
  ws = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

  ws.on("open", () => {
    console.log("[LIQ] WebSocket OKX connectat");

    // SUBSCRIPCIÓ FI (només 3 símbols → no cal escalonat)
    for (const symbol of ACTIVE_CRYPTOS) {
      ws.send(JSON.stringify({
        op: "subscribe",
        args: [{ channel: "liquidation-orders", instId: symbol }]
      }));
      console.log("[LIQ] Subscrita", symbol);
    }

    // HEARTBEAT ACTIU (ping cada 20s)
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(() => {
      try {
        ws.send(JSON.stringify({ event: "ping" }));
        // console.log("[LIQ] Ping enviat");
      } catch (err) {
        console.log("[LIQ] Error enviant ping:", err.message);
      }
    }, 20000);
  });

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);

      // 🔥 OKX envia ping → respondre pong
      if (data.event === "ping") {
        ws.send(JSON.stringify({ event: "pong" }));
        // console.log("[LIQ] Pong enviat");
        return;
      }

      if (!data.data) return;

      // 🔥 Liquidacions reals
      for (const liq of data.data) {
        const symbol = liq.instId;
        const price = Number(liq.bkPx);
        const size = Number(liq.sz);
        const side = liq.side;
        const ts = Number(liq.ts);

        // Guardar a DB
        await client.query(`
          INSERT INTO liquidations_raw (symbol, price, size, side, timestamp)
          VALUES ($1,$2,$3,$4,$5)
        `, [symbol, price, size, side, ts]);

        // Guardar al buffer
        buffers[symbol].push({ price, size, side, ts });

        // Limitar buffer a 500 liquidacions
        if (buffers[symbol].length > 500) {
          buffers[symbol].splice(0, buffers[symbol].length - 500);
        }
      }

    } catch (err) {
      console.log("[LIQ] Error parsejant liquidació:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("[LIQ] WebSocket tancat — reconnectant en 3s");

    if (heartbeatInterval) clearInterval(heartbeatInterval);

    setTimeout(startLiquidityFeed, 3000);
  });

  ws.on("error", (err) => {
    console.log("[LIQ] Error WebSocket:", err.message);
  });
}

// -------------------------------------------------------------
// CALCULAR ZONES DE LIQUIDITAT
// -------------------------------------------------------------
function getBucket(price) {
  return Math.round(price / BUCKET_SIZE) * BUCKET_SIZE;
}

function buildZones(symbol) {
  const buf = buffers[symbol];
  if (!buf || buf.length === 0) return null;

  const buckets = {};

  for (const liq of buf) {
    const bucket = getBucket(liq.price);
    if (!buckets[bucket]) buckets[bucket] = 0;
    buckets[bucket] += liq.size;
  }

  // Trobar bucket amb més magnitud
  let bestBucket = null;
  let bestMag = 0;

  for (const b in buckets) {
    if (buckets[b] > bestMag) {
      bestMag = buckets[b];
      bestBucket = Number(b);
    }
  }

  if (!bestBucket || bestMag < MIN_MAGNITUDE) return null;

  return {
    zonePrice: bestBucket,
    magnitude: bestMag
  };
}

// -------------------------------------------------------------
// CALCULAR DISTÀNCIA D’ENTRADA (FI)
// -------------------------------------------------------------
function calcEntryDistance(mag) {
  if (mag < 100000) return 0.002;   // 0.2%
  if (mag < 300000) return 0.004;   // 0.4%
  if (mag < 800000) return 0.008;   // 0.8%
  return 0.012;                     // 1.2%
}

// -------------------------------------------------------------
// ACTUALITZAR ESTAT DE LIQUIDITAT PER UNA CRIPTO
// -------------------------------------------------------------
export async function updateLiquidity(symbol, currentPrice) {
  const zone = buildZones(symbol);
  if (!zone) {
    await client.query(`
      INSERT INTO liquidity_state (symbol, state, updated_at)
      VALUES ($1,'none',NOW())
      ON CONFLICT (symbol)
      DO UPDATE SET state='none', updated_at=NOW()
    `, [symbol]);
    return;
  }

  const { zonePrice, magnitude } = zone;
  const dist = calcEntryDistance(magnitude);

  const watchPrice = zonePrice * (1 - dist * 0.5);
  const entryPrice = zonePrice * (1 - dist);

  let state = "none";
  if (currentPrice <= watchPrice) state = "watch";
  if (currentPrice <= entryPrice) state = "entry";

  await client.query(`
    INSERT INTO liquidity_state
    (symbol, zone_price, magnitude, entry_distance, watch_price, entry_price, state, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT (symbol)
    DO UPDATE SET
      zone_price=$2,
      magnitude=$3,
      entry_distance=$4,
      watch_price=$5,
      entry_price=$6,
      state=$7,
      updated_at=NOW()
  `, [
    symbol,
    zonePrice,
    magnitude,
    dist,
    watchPrice,
    entryPrice,
    state
  ]);
}
