// core/okx/getOrderStatusOKX.js
import { okxClient } from "./client.js";   // el mateix client que fas servir a createOrder

export async function getOrderStatusOKX(orderId) {
  try {
    const res = await okxClient.get("/api/v5/trade/order", {
      params: { ordId: orderId }
    });

    if (!res || !res.data || !res.data.data || res.data.data.length === 0) {
      return null;
    }

    return res.data.data[0];   // OKX sempre retorna array
  } catch (err) {
    console.log("[OKX STATUS ERROR]", orderId, err.message);
    return null;
  }
}
