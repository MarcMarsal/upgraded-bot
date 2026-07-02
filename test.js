import { okxCreateOrderAttachTest } from "./core/okx/okxCreateOrderAttachTest.js";

async function test() {
  const res = await okxCreateOrderAttachTest({
    instId: "SOL-USDT",
    side: "long",        // OKX rep "buy"
    px: 100,
    sz: 0.1,
    tpTriggerPx: 101,
    tpOrdPx: -1,
    slTriggerPx: 99,
    slOrdPx: -1
  });

  console.log("RESULTAT TEST:", JSON.stringify(res, null, 2));
}

test();
