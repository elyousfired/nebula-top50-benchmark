const axios = require('axios');

const symbol = 'DEEPUSDT';

async function deepForensic() {
    console.log(`\n🔍 NEBULA FORENSIC: ANALYSING ${symbol}...\n`);

    try {
        const depthUrl = `https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${symbol}&limit=50`;
        const depthRes = await axios.get(depthUrl);
        const bids = depthRes.data.result.b;
        const asks = depthRes.data.result.a;

        const totalBids = bids.reduce((acc, b) => acc + parseFloat(b[1]), 0);
        const totalAsks = asks.reduce((acc, a) => acc + parseFloat(a[1]), 0);
        const ratio = (totalBids / (totalBids + totalAsks)) * 100;

        console.log(`📊 LIQUIDITY MAP:`);
        console.log(`   - Buy Walls (Bids): ${totalBids.toFixed(2)} DEEP`);
        console.log(`   - Sell Walls (Asks): ${totalAsks.toFixed(2)} DEEP`);
        console.log(`   - Pressure Ratio: ${ratio.toFixed(2)}% ${ratio > 50 ? '🟢 BULLISH' : '🔴 BEARISH'}\n`);

        const biggestBid = bids.sort((a, b) => b[1] - a[1])[0];
        console.log(`🛡️ STRATEGIC SUPPORT: ${biggestBid[1]} DEEP at price $${biggestBid[0]}`);

        const tradesUrl = `https://api.bybit.com/v5/market/recent-trade?category=spot&symbol=${symbol}&limit=100`;
        const tradesRes = await axios.get(tradesUrl);
        const trades = tradesRes.data.result.list;

        const buyTrades = trades.filter(t => t.side === 'Buy').length;
        const sellTrades = trades.filter(t => t.side === 'Sell').length;
        const buyVol = trades.filter(t => t.side === 'Buy').reduce((acc, t) => acc + parseFloat(t.size), 0);
        const sellVol = trades.filter(t => t.side === 'Sell').reduce((acc, t) => acc + parseFloat(t.size), 0);

        console.log(`🌊 TRADE FLOW (Last 100 trades):`);
        console.log(`   - Aggressive Buyers: ${buyTrades} (${buyVol.toFixed(2)} DEEP)`);
        console.log(`   - Aggressive Sellers: ${sellTrades} (${sellVol.toFixed(2)} DEEP)`);
        
        const flowRatio = (buyVol / (buyVol + sellVol)) * 100;
        console.log(`   - Flow Dominance: ${flowRatio.toFixed(2)}% ${flowRatio > 50 ? '🔥 BUYING PRESSURE' : '❄️ SELLING PRESSURE'}`);

        console.log(`\n✅ FORENSIC COMPLETE for ${symbol}`);

    } catch (e) {
        console.error("Forensic Error:", e.message);
    }
}

deepForensic();
