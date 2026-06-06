// -------------------------------------------------------------
// FIAT 2.1 — Mini Eval 1:1 executat amb PineScript-JS
// -------------------------------------------------------------

import { PineJS } from "pinescript-js";
import fs from "fs";

// Carreguem el codi Pine FIAT 2.1 Mini Eval
const pineCode = fs.readFileSync("./pine/fiat21_mini_eval.pine", "utf8");

// Compilem el Pine un cop (molt més ràpid)
const compiled = PineJS.compile(pineCode);

export async function evaluateWithPine(candles, sig) {
  const result = await PineJS.run(compiled, {
    symbol: sig.symbol,
    timeframe: sig.timeframe,
    candles: candles.map(c => ({
      time: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }))
  });

  const isGoodMS = result.series["isGoodMS"];
  const isGoodES = result.series["isGoodES"];

  const isGood =
    sig.type === "M" ? isGoodMS === 1 :
    sig.type === "E" ? isGoodES === 1 :
    false;

  return {
    isGood,
    discard: !isGood
  };
}
