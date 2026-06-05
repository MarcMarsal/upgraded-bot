// -------------------------------------------------------------
// FIAT 2.1 — Mini Eval 1:1 executat amb pinets
// -------------------------------------------------------------

import { PineJS } from "@backtest-kit/pinets";
import fs from "fs";

// Carreguem el codi Pine FIAT 2.1 Mini Eval
const pineCode = fs.readFileSync("./pine/fiat21_mini_eval.pine", "utf8");

// Compilem el Pine un cop (molt més ràpid)
const compiled = PineJS.compile(pineCode);

export async function evaluateWithPine(candles, sig) {
  // candles = [{ open, high, low, close, volume, timestamp }, ...]

  const result = await PineJS.run(compiled, {
    symbol: sig.symbol,
    timeframe: sig.timeframe,
    candles: candles.map(c => ({
      time: c.timestamp,   // pinets usa "time"
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }))
  });

  // Llegim les sèries ocultes del Pine
  const isGoodMS = result.series["isGoodMS"];
  const isGoodES = result.series["isGoodES"];

  // Determinar si la senyal és bona segons el tipus
  let isGood = false;

  if (sig.type === "M") isGood = isGoodMS === 1;
  if (sig.type === "E") isGood = isGoodES === 1;

  return {
    isGood,
    discard: !isGood
  };
}
