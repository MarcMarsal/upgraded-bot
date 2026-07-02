// core/orders/orderManager.js
import { client } from "../../db/client.js";
import { createOrder } from "./createOrder.js";
import { cancelOrder } from "./cancelOrder.js";
// import { getOrderStatusOKX } from "./okxClient.js"; // l'afegirem després

export async function managePendingCreation(symbol, price_now, atr, timeframe = "1H") {
  // s'omplirà al següent pas
}

export async function manageActivation(symbol, timeframe = "1H") {
  // s'omplirà després
}

export async function manageClosures(symbol, timeframe = "1H") {
  // s'omplirà després
}

export async function manageDistanceCancels(symbol, price_now, atr, timeframe = "1H") {
  // s'omplirà després
}
