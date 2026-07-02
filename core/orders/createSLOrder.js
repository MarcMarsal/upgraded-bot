// core/orders/createSLOrder.js
import { okxCreateOrder } from "../okx/okxClient.js";

export async function createSLOrder({ symbol, side, slPrice, size }) {
  try {
    const okxSide = side === "long" ? "sell" : "buy";   // SL segons side

    return await okxCreateOrder({
      instId: symbol,
      side: okxSide,
      ordType: "trigger",       // STOP-LIMIT SPOT
      triggerPx: slPrice,
      px: slPrice,
      sz: size
    });

  } catch (err) {
    console.log("[SL ERROR]", symbol, err.message);
    return null;
  }
}
