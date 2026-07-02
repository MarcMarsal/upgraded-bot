// core/orders/createSLOrder.js
import { okxClient } from "../okx/client.js";

export async function createSLOrder({ symbol, entryOrderId, slPrice }) {
  try {
    const res = await okxClient.post("/api/v5/trade/order", {
      instId: symbol,
      tdMode: "cross",
      ordType: "stop-loss",
      triggerPx: slPrice.toString(),
      orderId: entryOrderId
    });

    return res.data;
  } catch (err) {
    console.log("[SL ERROR]", symbol, err.message);
    return null;
  }
}
