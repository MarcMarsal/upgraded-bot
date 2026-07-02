// core/orders/createOrder.js
import { client } from "../../db/client.js";
import { okxCreateOrderAttach } from "../okx/okxCreateOrderAttach.js";

export async function createOrder(orderData) {
  const {
    symbol,
    side,          // "long" | "short"
    entry_price,
    tp,
    sl,
    atr,
    bucket_price,
    timeframe,
    size           // 👈 ara sí
  } = orderData;

  // Traducció institucional FIAT‑PRO SPOT
  const okxSide = side === "long" ? "buy" : "sell";

  // 1) Crear registre local
  const res = await client.query(
    `
    INSERT INTO orders (symbol, side, entry_price, tp, sl, atr, bucket_price, timeframe, size, status_local)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING_SEND')
    RETURNING id
    `,
    [symbol, side, entry_price, tp, sl, atr, bucket_price, timeframe, size]
  );

  const id = res.rows[0].id;

  // 2) Enviar ordre LIMIT + TP/SL adjunts a OKX
  const okx = await okxCreateOrderAttach({
    instId: symbol,
    side: okxSide,
    px: entry_price,
    sz: size.toString(),
    tpTriggerPx: tp,
    tpOrdPx: -1,
    slTriggerPx: sl,
    slOrdPx: -1
  });

  const okxOrderId = okx.data?.[0]?.ordId || null;
  const algoId = okx.data?.[0]?.algoId || null;

  // 3) Actualitzar DB amb OKX
  await client.query(
    `
    UPDATE orders
    SET okx_order_id = $1,
        okx_algo_id = $2,
        status_local = 'SENT',
        status_okx = 'live'
    WHERE id = $3
    `,
    [okxOrderId, algoId, id]
  );

  console.log("[OKX] ORDER SENT + TP/SL ATTACHED:", symbol, okxOrderId);

  return { id, okxOrderId, algoId };
}
