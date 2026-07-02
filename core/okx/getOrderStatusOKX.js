// core/okx/getOrderStatusOKX.js
import crypto from "crypto";
import axios from "axios";

const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

// IMPORTANT: mateix endpoint base que okxCreateOrder
const TRADING_API_URL = "https://my.okx.com";

// ===============================
// SIGNATURA OKX (mateixa que okxCreateOrder)
// ===============================
function sign(message) {
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(message)
    .digest("base64");
}

// ===============================
// GET ESTAT ORDRE SPOT
// ===============================
export async function getOrderStatusOKX(ordId) {
  const timestamp = new Date().toISOString();

  const path = `/api/v5/trade/order?ordId=${ordId}`;
  const message = timestamp + "GET" + path;
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
    const url = TRADING_API_URL + path;

    const res = await axios.get(url, { headers });

    console.log("[OKX RAW STATUS RESPONSE]", JSON.stringify(res.data, null, 2));

    if (!res.data || !res.data.data || res.data.data.length === 0) {
      return null;
    }

    return res.data.data[0];

  } catch (err) {
    console.log("[OKX STATUS ERROR]", ordId, err.response?.data || err.message);
    return null;
  }
}
