import { fetchDepth } from './src/logic/scanner.js';
import util from 'util';

async function checkAGLDSupport() {
  console.log("Fetching AGLDUSDT Orderbook from Bybit...");
  const depth = await fetchDepth('AGLDUSDT');
  if (!depth || (!depth.b && !depth.bids)) {
    console.log("No depth found.");
    return;
  }
  
  const bids = depth.b || depth.bids;
  if (!bids || bids.length === 0) {
    console.log("No bids found.");
    return;
  }

  // Parse bids: [price, qty]
  let totalBids = 0;
  const parsedBids = bids.map(b => {
    const price = parseFloat(b[0]);
    const qty = parseFloat(b[1]);
    const value = price * qty;
    totalBids += value;
    return { price, qty, value };
  });

  // Sort by highest value (support walls)
  parsedBids.sort((a, b) => b.value - a.value);

  console.log("Total Support (Bids Value USDT):", totalBids.toFixed(2));
  console.log("Top 10 Largest Buy Walls (Supports):");
  for (let i = 0; i < 10; i++) {
    if (parsedBids[i]) {
      console.log(`Price: $${parsedBids[i].price.toFixed(4)} | Value: $${parsedBids[i].value.toFixed(2)} | Qty: ${parsedBids[i].qty}`);
    }
  }
}

checkAGLDSupport();
