// core/okx/okxClient.js
import crypto from "crypto";
import axios from "axios";

const TRADING_API_URL = "https://www.okx.com/api/v5/trade/order";

const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

console.log("API_KEY:", API_KEY);
console.log("SECRET_KEY:", SECRET_KEY);
console.log("PASSPHRASE:", PASSPHRASE);


// Signatura OKX
function sign(message) {
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(message)
    .digest("base64");
}

// Crear ordre LIMIT a OKX
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
    instId,
    tdMode: "cross",
    side,
    ordType: "limit",
    px: px.toString(),
    sz: sz.toString(),
    // TP/SL opcionals
    tpTriggerPx: tp ? tp.toString() : undefined,
    slTriggerPx: sl ? sl.toString() : undefined
  };

  //const message = timestamp + "POST" + "/api/v5/trade/order" + JSON.stringify(body);
  const path = "/api/v5/trade/order";
  const message = `${timestamp}POST${path}${JSON.stringify(body)}`;


  console.log("OKX REQUEST BODY:", JSON.stringify(body));

  const signature = sign(message);
  
  console.log("SIGN MESSAGE:", message);

  const headers = {
    "OK-ACCESS-KEY": API_KEY,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": PASSPHRASE,
    "Content-Type": "application/json"
  };

  const res = await axios.post(TRADING_API_URL, body, { headers });

  return res.data;
}
