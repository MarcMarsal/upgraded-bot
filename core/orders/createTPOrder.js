// core/orders/createTPOrder.js
import { okxCreateOrder } from "../okx/okxClient.js";

export async function createTPOrder({ symbol, side, tpPrice, size }) {
  try {
    const okxSide = side === "long" ? "sell" : "buy";   // TP segons side

    return await okxCreateOrder({
      instId: symbol,
      side: okxSide,
      px: tpPrice,
      sz: size
    });

  } catch (err) {
    console.log("[TP ERROR]", symbol, err.message);
    return null;
  }
}
