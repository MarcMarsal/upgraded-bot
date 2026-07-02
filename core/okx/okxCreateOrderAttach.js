// core/okx/okxCreateOrderAttach.js
import crypto from "crypto";
import axios from "axios";

const TRADING_API_URL = "https://my.okx.com/api/v5/trade/order";

const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

// ===============================
// SPOT: instId correcte
// ===============================
function normalizeInstId(symbol) {
  return symbol.replace("USDT", "USDC");
}

// ===============================
// SPOT: side correcte
// ===============================
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
// ORDRE SPOT + TP/SL ADJUNTS
// ===============================
export async function okxCreateOrderAttach({
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

    // 🔥 TP/SL adjunts
    attachAlgoOrds: [
      {
        tpTriggerPx: tpTriggerPx.toString(),
        tpOrdPx: tpOrdPx.toString(),
        slTriggerPx: slTriggerPx.toString(),
        slOrdPx: slOrdPx.toString()
      }
    ]
  };

  console.log("OKX REQUEST BODY (ATTACH):", JSON.stringify(body, null, 2));

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

    console.log("OKX RAW RESPONSE (ATTACH):", JSON.stringify(res.data, null, 2));

    return res.data;
  } catch (err) {
    console.log("OKX RAW ERROR (ATTACH):", err.response?.data || err.message);
    throw err;
  }
}
