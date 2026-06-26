// core/fetchMarketData.js

export async function fetchMarkPrice(symbol) {
  try {
    const instId = symbol + "-SWAP";
    const url = `https://www.okx.com/api/v5/public/mark-price?instId=${instId}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!json.data || json.data.length === 0) return null;

    return {
      markPx: Number(json.data[0].markPx)
    };
  } catch (err) {
    console.log("fetchMarkPrice ERROR", symbol, err.message);
    return null;
  }
}

export async function fetchOpenInterest(symbol) {
  try {
    const instId = symbol + "-SWAP";
    const url = `https://www.okx.com/api/v5/public/open-interest?instId=${instId}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!json.data || json.data.length === 0) return null;

    return {
      oi: Number(json.data[0].oi)
    };
  } catch (err) {
    console.log("fetchOpenInterest ERROR", symbol, err.message);
    return null;
  }
}
