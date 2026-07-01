// core/orders/createOrder.js
import { client } from "../../db/client.js";
import { okxCreateOrder } from "../okx/okxClient.js";

export async function createOrder(orderData) {
  const {
    symbol,
    side,
    entry_price,
    tp,
    sl,
    atr,
    bucket_price,
    timeframe
  } = orderData;

  // 1) Crear registre local
  const res = await client.query(
    `
    INSERT INTO orders (symbol, side, entry_price, tp, sl, atr, bucket_price, timeframe, status_local)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING_SEND')
    RETURNING id
    `,
    [symbol, side, entry_price, tp, sl, atr, bucket_price, timeframe]
  );

  const id = res.rows[0].id;

  // 2) Enviar ordre a OKX
  const okx = await okxCreateOrder({
    instId: symbol,
    side,
    px: entry_price,
    sz: "1", // mida mínima per ara
    tp,
    sl
  });

  const okxOrderId = okx.data[0].ordId;

  // 3) Actualitzar DB amb OKX
  await client.query(
    `
    UPDATE orders
    SET okx_order_id = $1,
        status_local = 'SENT',
        status_okx = 'live'
    WHERE id = $2
    `,
    [okxOrderId, id]
  );

  console.log("[OKX] ORDER SENT:", symbol, okxOrderId);

  return id;
}
