// core/portfolio.js

import crypto from "crypto";
import axios from "axios";
import { client } from "../db/client.js";   // 🔥 importem la BD

const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_SECRET_KEY;
const PASSPHRASE = process.env.OKX_PASSPHRASE;

function sign(message) {
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(message)
    .digest("base64");
}

export async function readPortfolio() {
  try {
    const path = "/api/v5/account/balance";
    const timestamp = new Date().toISOString();
    const message = timestamp + "GET" + path;
    const signature = sign(message);

    const headers = {
      "OK-ACCESS-KEY": API_KEY,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": PASSPHRASE,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-simulated-trading": "1"
    };

    const url = "https://www.okx.com" + path;

    const res = await axios.get(url, { headers, timeout: 5000 });

    const details = res.data.data[0].details;

    const portfolio = { usdc: 0, btc: 0, eth: 0, sol: 0 };

    for (const asset of details) {
      switch (asset.ccy) {
        case "USDC": portfolio.usdc = parseFloat(asset.availEq); break;
        case "BTC":  portfolio.btc  = parseFloat(asset.availEq); break;
        case "ETH":  portfolio.eth  = parseFloat(asset.availEq); break;
        case "SOL":  portfolio.sol  = parseFloat(asset.availEq); break;
      }
    }

    // 🔥 GUARDAR A LA BD
    await client.query(
      `
      INSERT INTO okx_portfolio (usdc, btc, eth, sol)
      VALUES ($1, $2, $3, $4)
      `,
      [portfolio.usdc, portfolio.btc, portfolio.eth, portfolio.sol]
    );

    console.log("Portfolio OKX actualitzat:", portfolio);

    return portfolio;

  } catch (err) {
    console.log("ERROR OKX:", err.response?.data || err.message);

    // 🔥 Guardem un registre d'error a la BD per coherència
    await client.query(
      `
      INSERT INTO okx_portfolio (usdc, btc, eth, sol)
      VALUES (NULL, NULL, NULL, NULL)
      `
    );

    return { usdc: "-", btc: "-", eth: "-", sol: "-" };
  }
}
