// core/orders/createTPOrder.js
import { okxClient } from "../okx/client.js";

export async function createTPOrder({ symbol, entryOrderId, tpPrice }) {
  try {
    const res = await okxClient.post("/api/v5/trade/order", {
      instId: symbol,
      tdMode: "cross",
      ordType: "take-profit",
      triggerPx: tpPrice.toString(),
      orderId: entryOrderId
    });

    return res.data;
  } catch (err) {
    console.log("[TP ERROR]", symbol, err.message);
    return null;
  }
}
