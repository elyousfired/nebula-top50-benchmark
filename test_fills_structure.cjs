const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://api.hyperliquid.xyz/info', { type: 'userFills', user: '0xd6e5f5f403df26107bb4c1a2fcd4520cc3c75b42' }); // Systemic Strategies HyperGrowth
    console.log(JSON.stringify(res.data.slice(0, 5), null, 2));
    
    // Check for liquidations
    const liquidations = res.data.filter(f => f.dir === 'Liquidated' || f.isLiquidation || f.type === 'liquidation' || f.liquidation);
    console.log("Found liquidations: ", liquidations.length);
    if (liquidations.length > 0) {
      console.log(JSON.stringify(liquidations[0], null, 2));
    } else {
      // Find a fill with a negative closed PnL to see if it implies liquidation
      const losses = res.data.filter(f => parseFloat(f.closedPnl) < 0);
      console.log("Losses found: ", losses.length);
      if (losses.length > 0) {
          console.log("Sample loss:", JSON.stringify(losses[0], null, 2));
      }
    }
  } catch (e) {
    console.error(e);
  }
}
test();
