// test_okx.js — Test d'un sol cop per veure la resposta REAL d'OKX

async function testTiers() {
  const url = "https://www.okx.com/api/v5/public/position-tiers?instType=SWAP&tdMode=cross&instFamily=BTC-USDT";

  try {
    console.log("Consultant OKX...");
    const res = await fetch(url);
    const json = await res.json();
    console.log("Resposta OKX:");
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log("ERROR FETCH:", err.message);
  }
}

testTiers();
