export function runDynamicBasketSimulation(pricesByTime, alignedTimes, tokens) {
  if (!alignedTimes || alignedTimes.length < 24) return null;

  // Initial State
  let portfolio = {
    asset: 'USDT',
    amount: 10000,
  };
  
  let solBenchmark = {
    amount: 10000 / pricesByTime[alignedTimes[0]]['SOL'] // buy and hold SOL with 10k
  };

  const history = [];
  const trades = [];

  const getPrice = (t, asset) => {
     if (asset === 'USDT') return 1;
     return pricesByTime[t][asset];
  };

  const getReturn = (tNow, tPast, asset) => {
     if (!pricesByTime[tNow] || !pricesByTime[tPast]) return 0;
     const pNow = getPrice(tNow, asset);
     const pPast = getPrice(tPast, asset);
     return (pNow - pPast) / pPast;
  };

  for (let i = 24; i < alignedTimes.length; i++) {
     const tNow = alignedTimes[i];
     // Find timestamps for 1h ago and 24h ago
     // If the interval is 1h, 1h ago is i-1, 24h ago is i-24
     // We will approximate by finding the closest time if exact doesn't exist
     let t1h = alignedTimes[i-1];
     let t4h = alignedTimes[0];
     let t24h = alignedTimes[0];
     
     for (let j = i-1; j >= 0; j--) {
        if (tNow - alignedTimes[j] >= 3600) { t1h = alignedTimes[j]; break; }
     }
     for (let j = i-1; j >= 0; j--) {
        if (tNow - alignedTimes[j] >= 4 * 3600) { t4h = alignedTimes[j]; break; }
     }
     for (let j = i-1; j >= 0; j--) {
        if (tNow - alignedTimes[j] >= 24 * 3600) { t24h = alignedTimes[j]; break; }
     }

     const solRet24h = getReturn(tNow, t24h, 'SOL');
     const solRet1h = getReturn(tNow, t1h, 'SOL');
     const solRet4h = getReturn(tNow, t4h, 'SOL');

     // Check Euphoria (Rule A)
     // Are all altcoins > SOL over 24h?
     let allAltsOutperforming = true;
     for (const tok of tokens) {
        if (tok === 'SOL') continue;
        if (getReturn(tNow, t24h, tok) <= solRet24h) {
           allAltsOutperforming = false;
           break;
        }
     }

     const isEuphoria = allAltsOutperforming;
     let nextAsset = portfolio.asset;

     if (isEuphoria) {
         nextAsset = 'USDT'; // Kill switch activated
     } else {
         // Rule B: Rubber band check if holding an altcoin
         if (portfolio.asset !== 'USDT' && portfolio.asset !== 'SOL') {
             const holdRet1h = getReturn(tNow, t1h, portfolio.asset);
             const holdRet4h = getReturn(tNow, t4h, portfolio.asset);
             const holdRet24h = getReturn(tNow, t24h, portfolio.asset);
             
             // Take profit: Outperformed SOL by 2.5% in 1h, or 10% in 24h -> Take profit to SOL
             if ((holdRet1h - solRet1h > 0.025) || (holdRet24h - solRet24h > 0.10)) {
                 nextAsset = 'SOL';
             }
         }

         // Rule C: Accumulation if in SOL (or just took profit to SOL or USDT)
         if (nextAsset === 'SOL' || nextAsset === 'USDT') {
             // Find best performing asset over last 4h that is NOT overextended
             let bestTok = 'SOL';
             let bestScore = -Infinity;

             for (const tok of tokens) {
                 if (tok === 'SOL') continue;
                 const ret4h = getReturn(tNow, t4h, tok);
                 const ret1h = getReturn(tNow, t1h, tok);
                 
                 // Avoid buying if it's already overextended (Rule B condition)
                 if (ret1h - solRet1h > 0.02) continue; 
                 if (ret4h < 0) continue; // Must have positive momentum

                 // Score is how much it beat SOL in 4h
                 const score = ret4h - getReturn(tNow, t4h, 'SOL');
                 
                 if (score > bestScore && score > 0.01) { // Must beat SOL by at least 1% in 4h to bother switching
                     bestScore = score;
                     bestTok = tok;
                 }
             }
             nextAsset = bestTok;
         }
     }

     // Execute Trade if needed
     if (portfolio.asset !== nextAsset) {
         const currentUsdtValue = portfolio.amount * getPrice(tNow, portfolio.asset);
         const nextAssetAmount = currentUsdtValue / getPrice(tNow, nextAsset);
         
         trades.push({
             time: tNow,
             from: portfolio.asset,
             to: nextAsset,
             price: getPrice(tNow, portfolio.asset) / getPrice(tNow, nextAsset),
             usdtValue: currentUsdtValue
         });

         portfolio = {
             asset: nextAsset,
             amount: nextAssetAmount
         };
     }

     // Record snapshot
     const currentUsdtValue = portfolio.amount * getPrice(tNow, portfolio.asset);
     const solUsdtValue = solBenchmark.amount * getPrice(tNow, 'SOL');

     history.push({
         time: tNow,
         asset: portfolio.asset,
         basketValue: currentUsdtValue,
         solValue: solUsdtValue,
         basketSolBalance: currentUsdtValue / getPrice(tNow, 'SOL'),
         benchmarkSolBalance: solBenchmark.amount
     });
  }

  return {
     history,
     trades,
     finalUsdt: history.length > 0 ? history[history.length - 1].basketValue : 10000,
     benchmarkUsdt: history.length > 0 ? history[history.length - 1].solValue : 10000,
     finalSol: history.length > 0 ? history[history.length - 1].basketSolBalance : 0,
     benchmarkSol: history.length > 0 ? history[history.length - 1].benchmarkSolBalance : 0,
  };
}
