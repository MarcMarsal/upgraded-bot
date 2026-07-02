// core/portfolio.js

import { okxClient } from "../core/okx/okxClient.js";

export async function readPortfolio(okxClient) {
    const res = await okxClient.get("/api/v5/account/balance");
    const details = res.data[0].details;

    const portfolio = { usdc: 0, btc: 0, eth: 0, sol: 0 };

    for (const asset of details) {
        switch (asset.ccy) {
            case "USDC": portfolio.usdc = parseFloat(asset.availEq); break;
            case "BTC":  portfolio.btc  = parseFloat(asset.availEq); break;
            case "ETH":  portfolio.eth  = parseFloat(asset.availEq); break;
            case "SOL":  portfolio.sol  = parseFloat(asset.availEq); break;
        }
    }

    return portfolio;
}

