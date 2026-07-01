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
  return symbol; // BTC-USDT, ETH-USDT, SOL-USDT
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
// CREAR ORDRE SPOT
// ===============================
export async function okxCreateOrder({
  instId,
  side,
  px,
  sz
}) {
  const timestamp = new Date().toISOString();

  const body = {
    instId: normalizeInstId(instId),
    side: normalizeSide(side),
    ordType: "limit",
    px: px.toString(),
    sz: sz.toString()
  };

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
    return res.data;
  } catch (err) {
    console.log("OKX ERROR:", err.response?.data || err.message);
    throw err;
  }
}

export async function okxCancelOrder(instId, ordId) {
  const timestamp = new Date().toISOString();

  const body = {
    instId,
    ordId
  };

  const path = "/api/v5/trade/cancel-order";
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

  const url = "https://my.okx.com/api/v5/trade/cancel-order";

  const res = await axios.post(url, body, { headers });
  return res.data;
}

