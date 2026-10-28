/**
 * Logic: Breakout + Next Resistance Target + Risk/Reward Engine
 * Faithful translation with automated Stop Loss, Target, and R:R calculations
 */

export function calculateBreakoutTargetLogic(candles, options = {}) {
  const {
    pivLen = 15,
    maxLevels = 6,
    volMult = 2.0,
    volLen = 20,
    minClose = 0.3,
    slBufferPct = 0.8 // 0.8% buffer below broken resistance / low
  } = options;

  if (!candles || candles.length === 0) {
    return {
      activeResistances: [],
      breakoutHistory: [],
      latestBreakout: null,
      currentPrice: 0,
      volSmaSeries: [],
      highVolCandles: [],
      nextTarget: null,
      isPriceDiscovery: false,
      riskRewardSetup: null
    };
  }

  const n = candles.length;
  const resArr = [];
  const breakoutHistory = [];
  const volSmaSeries = [];
  const highVolCandles = [];

  // 1. Calculate Volume SMA(20)
  for (let i = 0; i < n; i++) {
    let sumVol = 0;
    let count = 0;
    for (let j = Math.max(0, i - volLen + 1); j <= i; j++) {
      sumVol += (candles[j].volume || 0);
      count++;
    }
    const avgVol = count > 0 ? sumVol / count : 0;
    volSmaSeries.push({ time: candles[i].time, value: avgVol });

    const isVolStrong = (candles[i].volume || 0) > avgVol * volMult;
    if (isVolStrong) {
      highVolCandles.push(candles[i].time);
    }
  }

  // 2. Iterate bar by bar to detect Pivot Highs and Pivot Lows
  for (let i = 0; i < n; i++) {
    if (i >= 2 * pivLen) {
      const centerIdx = i - pivLen;
      const centerHigh = candles[centerIdx].high;
      let isPivotHigh = true;

      for (let k = centerIdx - pivLen; k <= centerIdx + pivLen; k++) {
        if (k !== centerIdx && candles[k].high > centerHigh) {
          isPivotHigh = false;
          break;
        }
      }

      if (isPivotHigh) {
        resArr.push({
          price: centerHigh,
          time: candles[centerIdx].time,
          index: centerIdx
        });
        if (resArr.length > maxLevels) {
          resArr.shift();
        }
      }

      const centerLow = candles[centerIdx].low;
      let isPivotLow = true;
      for (let k = centerIdx - pivLen; k <= centerIdx + pivLen; k++) {
        if (k !== centerIdx && candles[k].low < centerLow) {
          isPivotLow = false;
          break;
        }
      }

      if (isPivotLow && resArr.length > 0) {
        for (let r = resArr.length - 1; r >= 0; r--) {
          if (resArr[r].price < centerLow) {
            resArr.splice(r, 1);
          }
        }
      }
    }

    const curClose = candles[i].close;
    const curLow = candles[i].low;
    const prevClose = i > 0 ? candles[i - 1].close : curClose;
    const curVol = candles[i].volume || 0;
    const curVolAvg = volSmaSeries[i]?.value || 0;
    const volOK = curVol > curVolAvg * volMult;

    let brokenLvl = null;
    let nextRes = null;

    if (resArr.length > 0) {
      for (let r = 0; r < resArr.length; r++) {
        const lvl = resArr[r].price;
        if (curClose > lvl * (1 + minClose / 100) && prevClose <= lvl) {
          if (brokenLvl === null || lvl > brokenLvl) {
            brokenLvl = lvl;
          }
        }
      }

      if (brokenLvl !== null) {
        for (let r = 0; r < resArr.length; r++) {
          const lvl = resArr[r].price;
          if (lvl > curClose) {
            if (nextRes === null || lvl < nextRes) {
              nextRes = lvl;
            }
          }
        }
      }
    }

    const isBreakout = brokenLvl !== null && volOK;
    if (isBreakout) {
      // Stop Loss calculation for this breakout
      const stopLoss = Math.min(brokenLvl * (1 - slBufferPct / 100), curLow);
      const riskPct = curClose > 0 ? ((curClose - stopLoss) / curClose) * 100 : 1;

      // Target calculation
      let targetPrice = nextRes;
      let isPD = false;
      if (targetPrice === null) {
        isPD = true;
        // In price discovery, default target is 3x Risk (R:R 1:3)
        targetPrice = curClose + (curClose - stopLoss) * 3.0;
      }

      const rewardPct = curClose > 0 ? ((targetPrice - curClose) / curClose) * 100 : 0;
      const rrRatio = riskPct > 0 ? (rewardPct / riskPct) : 1;

      breakoutHistory.push({
        time: candles[i].time,
        index: i,
        entryPrice: curClose,
        brokenLevel: brokenLvl,
        stopLoss: stopLoss,
        riskPct: riskPct,
        nextTarget: targetPrice,
        rewardPct: rewardPct,
        rrRatio: rrRatio,
        isPriceDiscovery: isPD,
        volume: curVol,
        volAvgRatio: curVolAvg > 0 ? (curVol / curVolAvg).toFixed(2) : '1.0'
      });
    }
  }

  const latestCandle = candles[n - 1];
  const currentPrice = latestCandle?.close || 0;

  // Active sorted resistance levels
  const activeResistances = [...resArr]
    .map(r => ({
      price: r.price,
      time: r.time,
      isAboveCurrent: r.price > currentPrice,
      distancePct: currentPrice > 0 ? ((r.price - currentPrice) / currentPrice) * 100 : 0
    }))
    .sort((a, b) => b.price - a.price);

  const resistancesAbove = activeResistances.filter(r => r.price > currentPrice).sort((a, b) => a.price - b.price);
  const resistancesBelow = activeResistances.filter(r => r.price <= currentPrice).sort((a, b) => b.price - a.price);

  const nextTarget = resistancesAbove.length > 0 ? resistancesAbove[0] : null;
  const nearestSupport = resistancesBelow.length > 0 ? resistancesBelow[0] : null;
  const isPriceDiscovery = resistancesAbove.length === 0 && activeResistances.length > 0;
  const latestBreakout = breakoutHistory.length > 0 ? breakoutHistory[breakoutHistory.length - 1] : null;

  // Automated Risk/Reward Setup for Current Trade
  let riskRewardSetup = null;
  if (currentPrice > 0) {
    const entry = currentPrice;
    // Stop Loss: nearest broken support level or last candle low
    const slBase = nearestSupport ? nearestSupport.price * (1 - slBufferPct / 100) : (latestCandle.low * 0.995);
    const stopLoss = Math.min(slBase, entry * 0.985); // Minimum 1.5% SL cap
    const riskPct = ((entry - stopLoss) / entry) * 100;

    let targetPrice = nextTarget ? nextTarget.price : (entry + (entry - stopLoss) * 3.0);
    const rewardPct = ((targetPrice - entry) / entry) * 100;
    const rrRatio = riskPct > 0 ? (rewardPct / riskPct) : 1;

    let verdict = 'POOR';
    let verdictColor = '#ef4444';
    if (rrRatio >= 3.0) {
      verdict = '🔥 صفقة ممتازة (GOLDEN SETUP R:R >= 1:3)';
      verdictColor = '#00ff88';
    } else if (rrRatio >= 2.0) {
      verdict = '🟢 صفقة إيجابية وجيدة (R:R >= 1:2)';
      verdictColor = '#38bdf8';
    } else if (rrRatio >= 1.5) {
      verdict = '🟡 صفقة متوسطة (R:R >= 1:1.5)';
      verdictColor = '#facc15';
    } else {
      verdict = '🔴 عائد ضعيف مقارنة بالمخاطرة (R:R < 1:1.5)';
      verdictColor = '#ef4444';
    }

    riskRewardSetup = {
      entryPrice: entry,
      stopLoss: stopLoss,
      targetPrice: targetPrice,
      riskPct: riskPct,
      rewardPct: rewardPct,
      rrRatio: rrRatio,
      verdict: verdict,
      verdictColor: verdictColor,
      isPriceDiscovery: isPriceDiscovery
    };
  }

  return {
    activeResistances,
    breakoutHistory,
    latestBreakout,
    currentPrice,
    volSmaSeries,
    highVolCandles,
    nextTarget,
    isPriceDiscovery,
    riskRewardSetup
  };
}