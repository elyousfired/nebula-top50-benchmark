export const calculateSMC = (klines, swingLen = 10, lookbackOB = 20) => {
  if (!klines || klines.length < swingLen * 2 + 1) return null;

  let lastSH = null;
  let lastSL = null;
  let trend = 0;
  
  let activeBullOBs = [];
  let activeBearOBs = [];
  let lastSignals = { bullOB: null, bearOB: null, strongBull: null, strongBear: null };
  
  const currentPrice = parseFloat(klines[klines.length - 1][4]);

  for (let i = swingLen * 2; i < klines.length; i++) {
    const pivotIdx = i - swingLen;
    const pivotHighVal = parseFloat(klines[pivotIdx][2]); // high
    const pivotLowVal = parseFloat(klines[pivotIdx][3]); // low
    
    // Check if pivotIdx is a pivot high
    let isPH = true;
    let isPL = true;
    for (let j = i - swingLen * 2; j <= i; j++) {
      if (j === pivotIdx) continue;
      if (parseFloat(klines[j][2]) >= pivotHighVal) isPH = false;
      if (parseFloat(klines[j][3]) <= pivotLowVal) isPL = false;
    }

    if (isPH) lastSH = pivotHighVal;
    if (isPL) lastSL = pivotLowVal;

    const currentClose = parseFloat(klines[i][4]);
    const currentOpen = parseFloat(klines[i][1]);
    const currentHigh = parseFloat(klines[i][2]);
    const currentLow = parseFloat(klines[i][3]);
    const currentTime = parseInt(klines[i][0]);

    // Break of Structure detection
    let bosUp = lastSH !== null && currentClose > lastSH;
    let bosDn = lastSL !== null && currentClose < lastSL;
    
    let code = 0;
    let newBull = false;
    let newBear = false;
    let obTopBull = null, obBotBull = null, timeBull = null, typeBull = null;
    let obTopBear = null, obBotBear = null, timeBear = null, typeBear = null;
    
    // OB detection
    if (bosUp) {
      code = trend === -1 ? 2 : 1; // 2=CHoCH, 1=BOS
      trend = 1;
      
      // Lookback for last bearish candle
      let obIdx = -1;
      for (let j = i - 1; j >= Math.max(0, i - lookbackOB); j--) {
        if (parseFloat(klines[j][4]) < parseFloat(klines[j][1])) {
          obIdx = j;
          break;
        }
      }
      if (obIdx !== -1) {
        newBull = true;
        obTopBull = parseFloat(klines[obIdx][2]); // high
        obBotBull = parseFloat(klines[obIdx][3]); // low
        timeBull = parseInt(klines[obIdx][0]);
        typeBull = code === 2 ? 'CHoCH' : 'BOS';
      }
    }
    else if (bosDn) {
      code = trend === 1 ? -2 : -1; // -2=CHoCH, -1=BOS
      trend = -1;
      
      // Lookback for last bullish candle
      let obIdx = -1;
      for (let j = i - 1; j >= Math.max(0, i - lookbackOB); j--) {
        if (parseFloat(klines[j][4]) > parseFloat(klines[j][1])) {
          obIdx = j;
          break;
        }
      }
      if (obIdx !== -1) {
        newBear = true;
        obTopBear = parseFloat(klines[obIdx][2]);
        obBotBear = parseFloat(klines[obIdx][3]);
        timeBear = parseInt(klines[obIdx][0]);
        typeBear = code === -2 ? 'CHoCH' : 'BOS';
      }
    }

    // Edge triggers (like ev_nb1 = nb1 and not nb1[1])
    if (newBull && !lastSignals.prevNewBull) {
      activeBullOBs.push({ top: obTopBull, bot: obBotBull, time: timeBull, type: typeBull });
      lastSignals.bullOB = { top: obTopBull, bot: obBotBull, time: timeBull, triggeredAt: currentTime, type: typeBull };
    }
    if (newBear && !lastSignals.prevNewBear) {
      activeBearOBs.push({ top: obTopBear, bot: obBotBear, time: timeBear, type: typeBear });
      lastSignals.bearOB = { top: obTopBear, bot: obBotBear, time: timeBear, triggeredAt: currentTime, type: typeBear };
    }

    lastSignals.prevNewBull = newBull;
    lastSignals.prevNewBear = newBear;

    // Cleanup mitigation (Invalidation)
    // bull OB is deleted if price wicks strictly below bot
    activeBullOBs = activeBullOBs.filter(ob => currentLow >= ob.bot);
    // bear OB is deleted if price wicks strictly above top
    activeBearOBs = activeBearOBs.filter(ob => currentHigh <= ob.top);

    // Limit to max 20 per TF like TradingView to avoid renderer overload
    if (activeBullOBs.length > 20) activeBullOBs = activeBullOBs.slice(activeBullOBs.length - 20);
    if (activeBearOBs.length > 20) activeBearOBs = activeBearOBs.slice(activeBearOBs.length - 20);

    // Confirmations
    const rng = currentHigh - currentLow;
    const body = Math.abs(currentClose - currentOpen);
    const upWick = currentHigh - Math.max(currentOpen, currentClose);
    const loWick = Math.min(currentOpen, currentClose) - currentLow;
    
    const minBodyPercent = 20;
    const bodyPctOk = rng > 0 ? (body / rng) * 100 >= minBodyPercent : false;
    
    // Engulfing
    const prevOpen = parseFloat(klines[i-1][1]);
    const prevClose = parseFloat(klines[i-1][4]);
    const bullEngulfing = currentClose > currentOpen && prevClose < prevOpen && currentOpen <= prevClose && currentClose >= prevOpen;
    const bearEngulfing = currentClose < currentOpen && prevClose > prevOpen && currentOpen >= prevClose && currentClose <= prevOpen;
    
    const hammerBull = currentClose > currentOpen && loWick >= body * 1.5 && upWick <= body;
    const shootingStarBear = currentClose < currentOpen && upWick >= body * 1.5 && loWick <= body;

    const insideBullZone = activeBullOBs.some(ob => currentHigh >= ob.bot && currentLow <= ob.top);
    const insideBearZone = activeBearOBs.some(ob => currentHigh >= ob.bot && currentLow <= ob.top);

    const bullWeak = insideBullZone && bodyPctOk && currentClose > currentOpen && (bullEngulfing || hammerBull);
    const bearWeak = insideBearZone && bodyPctOk && currentClose < currentOpen && (bearEngulfing || shootingStarBear);

    const prevHigh = parseFloat(klines[i-1][2]);
    const prevLow = parseFloat(klines[i-1][3]);

    const bullStrong = bullWeak && currentClose > prevHigh;
    const bearStrong = bearWeak && currentClose < prevLow;

    if (bullStrong) {
      lastSignals.strongBull = { time: currentTime, price: currentClose };
    }
    if (bearStrong) {
      lastSignals.strongBear = { time: currentTime, price: currentClose };
    }
  }

  return {
    activeBullOBs,
    activeBearOBs,
    lastSignals,
    trend,
    currentPrice
  };
};
