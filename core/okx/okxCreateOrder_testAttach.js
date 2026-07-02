// core/okx/okxCreateOrder_testAttach.js
import crypto from "crypto";
import axios from "axios";

const TRADING_API_URL = "https://my.okx.com/api/v5/trade/order";

const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

// ===============================
// NORMALITZACIÓ SPOT
// ===============================
function normalizeInstId(symbol) {
  return symbol.replace("USDT", "USDC");
}

function normalizeSide(side) {
  if (side === "long") return "buy";
  if (side === "short") return "sell";
  return side;
}

// ===============================
// SIGNATURA OKX
// ===============================
function sign(message) {
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(message)
    .digest("base64");
}

// ===============================
// VERSIÓ DE PROVA AMB TP/SL ADJUNTS
// ===============================
export async function okxCreateOrderAttachTest({
  instId,
  side,
  px,
  sz,
  tpTriggerPx,
  tpOrdPx,
  slTriggerPx,
  slOrdPx
}) {
  const timestamp = new Date().toISOString();

  const body = {
    instId: normalizeInstId(instId),
    tdMode: "cash",
    side: normalizeSide(side),
    ordType: "limit",
    px: px.toString(),
    sz: sz.toString(),

    // 🔥 AQUI AFEGIM TP/SL ADJUNTS
    attachAlgoOrds: [
      {
        tpTriggerPx: tpTriggerPx.toString(),
        tpOrdPx: tpOrdPx.toString(),   // -1 = market
        slTriggerPx: slTriggerPx.toString(),
        slOrdPx: slOrdPx.toString()    // -1 = market
      }
    ]
  };

  console.log("OKX REQUEST BODY (ATTACH TEST):", JSON.stringify(body, null, 2));

  const path = "/api/v5/trade/order";
  const message = timestamp + "POST" + path + JSON.stringify(body);
  const signature = sign(message);

  const headers = {
    "OK-ACCESS-KEY": API_KEY,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": PASSPHRASE,
    "Content-Type": "application/json",
    "x-simulated-trading": "1"
  };

  try {
    const res = await axios.post(TRADING_API_URL, body, { headers });

    console.log("OKX RAW RESPONSE (ATTACH TEST):", JSON.stringify(res.data, null, 2));

    return res.data;
  } catch (err) {
    console.log("OKX RAW ERROR (ATTACH TEST):", err.response?.data || err.message);
    throw err;
  }
}
