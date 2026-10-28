import { fetchBybitData, calculateEMA } from './scanner';

// Cache pour éviter de re-fetch les mêmes données trop souvent
const cache = new Map();

export const evaluateTokenExpert = async (rawSymbol, pattern) => {
  const now = Date.now();
  if (cache.has(rawSymbol)) {
    const cached = cache.get(rawSymbol);
    if (now - cached.timestamp < 300000) { // 5 minutes cache
      return cached.data;
    }
  }

  try {
    const timeframes = [
      { label: '1D', interval: 'D', limit: 200 },
      { label: '4H', interval: '240', limit: 200 },
      { label: '1H', interval: '60', limit: 200 }
    ];
    
    const trends = {};
    for (const tf of timeframes) {
      const data = await fetchBybitData(rawSymbol, tf.interval, tf.limit);
      if (data && data.length > 50) {
        // Bybit returns newest first (descending). We must reverse to chronological order for EMA
        const closes = [...data].reverse().map(k => parseFloat(k[4]));
        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);
        
        const lastClose = closes[closes.length - 1];
        const lastEma20 = ema20[ema20.length - 1];
        const lastEma50 = ema50[ema50.length - 1];
        
        trends[tf.label] = {
          ema20: lastEma20,
          ema50: lastEma50,
          price: lastClose,
          isBullish: lastEma20 > lastEma50 && lastClose > lastEma50
        };
      } else {
        trends[tf.label] = { isBullish: false };
      }
    }
    
    // Evaluate Confluences from pattern
    let hasRetest = false;
    let entryPoint = pattern.currentPrice;
    let stopLoss = pattern.currentPrice * 0.95;
    
    if (pattern.parabolaCurve && pattern.parabolaCurve.length > 0 && pattern.klines) {
        const curveMap = new Map();
        pattern.parabolaCurve.forEach(p => curveMap.set(p.time, p.value));
        
        // Find if any retest happened recently
        pattern.klines.forEach(d => {
           const cVal = curveMap.get(d.time);
           if (cVal && d.low <= cVal * 1.05 && d.low >= cVal * 0.90 && d.close >= cVal) {
               hasRetest = true;
           }
        });
        
        // Define stop loss as slightly below the current curve value
        const lastCurveValue = pattern.parabolaCurve[pattern.parabolaCurve.length - 1]?.value;
        if (lastCurveValue) {
           stopLoss = lastCurveValue * 0.96; // 4% below curve
           entryPoint = lastCurveValue * 1.02; // Enter close to curve
        }
    }
    
    const isVwapBullish = pattern.anchoredVWAP && pattern.anchoredVWAP.length > 0 
        ? pattern.currentPrice > pattern.anchoredVWAP[pattern.anchoredVWAP.length - 1].value 
        : true;
    
    const volumeAccumulation = pattern.deadZoneBox && pattern.deadZoneBox.length > 0;
    const emaReclaim = pattern.hasEmaReclaim;
    
    // Calculate Score
    const isFullTrendBullish = trends['1D']?.isBullish && trends['4H']?.isBullish && trends['1H']?.isBullish;
    
    let score = 0;
    if (isFullTrendBullish) score += 50;
    else if (trends['1D']?.isBullish && trends['4H']?.isBullish) score += 30;
    
    if (hasRetest) score += 20;
    if (emaReclaim) score += 10;
    if (volumeAccumulation) score += 10;
    if (isVwapBullish) score += 10;
    
    let verdict = 'DO NOT TRADE';
    if (score >= 80) verdict = 'STRONG BUY';
    else if (score >= 50) verdict = 'BUY';
    else if (score >= 30) verdict = 'WAIT';
    
    let mainReason = `${rawSymbol.replace('USDT', '/SOL')} is ${trends['4H']?.isBullish ? 'strong bullish' : 'neutral'} on 4h. Daily trend: ${trends['1D']?.isBullish ? 'strong bullish' : 'bearish'}.`;
    let mainRisk = pattern.breakoutPercent > 15 ? 'Entry is extended near the high, so waiting for a pullback is safer.' : 'Momentum can stall if the next 4h candle does not hold support.';
    let holdingPlan = trends['1D']?.isBullish ? 'Expected hold 3-10 days. Entry acceptable now, but prefer a pullback instead of chasing.' : 'Stay mostly in SOL until 4h structure improves or a daily reversal starts to confirm.';
    let reviewTime = trends['1D']?.isBullish ? 'Review every 1d candle' : 'Review every 4h candle';

    const result = {
      trends,
      score,
      verdict,
      confluences: {
         retest: hasRetest,
         emaReclaim,
         volumeAccumulation,
         vwapBullish: isVwapBullish
      },
      plan: {
         entry: entryPoint,
         takeProfit: pattern.oldHigh,
         stopLoss: stopLoss,
         riskReward: entryPoint > stopLoss ? ((pattern.oldHigh - entryPoint) / (entryPoint - stopLoss)).toFixed(2) : 0
      },
      instructions: {
         mainReason,
         mainRisk,
         holdingPlan,
         reviewTime
      }
    };

    cache.set(rawSymbol, { timestamp: now, data: result });
    return result;

  } catch (err) {
    console.error(`Error evaluating token ${rawSymbol}:`, err);
    return null;
  }
};
