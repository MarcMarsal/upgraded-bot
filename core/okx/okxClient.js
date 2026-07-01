// core/okx/okxClient.js
import crypto from "crypto";
import axios from "axios";

const TRADING_API_URL = "https://my.okx.com/api/v5/trade/order";

const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

function normalizeInstId(symbol) {
  return symbol.replace("-USDT", "-USDT-SWAP");
}

function normalizeSide(side) {
  if (side === "long") return "buy";
  if (side === "short") return "sell";
  return side;
}

function sign(message) {
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(message)
    .digest("base64");
}

export async function okxCreateOrder({
  instId,
  side,
  px,
  sz,
  tp,
  sl
}) {
  const timestamp = new Date().toISOString();

  const body = {
    instId: normalizeInstId(instId),
    tdMode: "cross",
    side: normalizeSide(side),
    ordType: "limit",
    px: px.toString(),
    sz: sz.toString()
  };

  const attachAlgoOrds = [];

  // TP → MARKET (OKX requirement)
  if (tp) {
    attachAlgoOrds.push({
      algoOrdType: "tp",
      tpTriggerPx: tp.toString(),
      tpOrdPx: "-1"   // MARKET TP
    });
  }

  // SL → LIMIT (allowed)
  if (sl) {
    attachAlgoOrds.push({
      algoOrdType: "sl",
      slTriggerPx: sl.toString(),
      slOrdPx: sl.toString()
    });
  }

  if (attachAlgoOrds.length > 0) {
    body.attachAlgoOrds = attachAlgoOrds;
  }

  const path = "/api/v5/trade/order";
  const message = timestamp + "POST" + path + JSON.stringify(body);
  const signature = sign(message);

  console.log("OKX REQUEST BODY:", JSON.stringify(body));
  console.log("SIGN MESSAGE:", message);

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
    console.log("OKX RESPONSE:", res.data);
    return res.data;
  } catch (err) {
    console.log("OKX ERROR:", err.response?.data || err.message);
    throw err;
  }
}
