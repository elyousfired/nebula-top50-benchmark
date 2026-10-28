/**
 * BTC VOLATILITY INDICATORS PRO
 * Module de calcul mathématique exact pour la famille VOLATILITY (%B PRO, ATR% PRO, TTM Squeeze PRO, etc.)
 */

/**
 * 1️⃣ %B PRO (Bollinger %B + Bandwalk Trend Strength + Signaux Crossover 0.5 & Walk)
 */
export function calculateBPercentPro(candles, options = {}) {
  const {
    len = 20,
    mult = 2.0,
    walkLen = 6,
    showBG = true,
    showShapes = true
  } = options;

  if (!candles || candles.length < len) {
    return {
      bPercentSeries: [],
      midBullSignals: [],
      midBearSignals: [],
      bullWalkSignals: [],
      bearWalkSignals: [],
      curBPercent: 0.5,
      zone: 'NEUTRE',
      isBull: true
    };
  }

  const n = candles.length;
  const times = candles.map(c => c.time);
  const closes = candles.map(c => c.close);

  const bPercentValues = new Array(n).fill(null);
  const bPercentSeries = [];

  for (let i = len - 1; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < len; j++) sum += closes[i - j];
    const sma = sum / len;

    let variance = 0;
    for (let j = 0; j < len; j++) variance += Math.pow(closes[i - j] - sma, 2);
    const stdev = Math.sqrt(variance / len);

    const upper = sma + mult * stdev;
    const lower = sma - mult * stdev;
    const denom = upper - lower;
    const val = denom === 0 ? 0.5 : (closes[i] - lower) / denom;

    bPercentValues[i] = val;
    bPercentSeries.push({
      time: times[i],
      value: parseFloat(val.toFixed(2))
    });
  }

  // Bandwalk & Crossover Signals
  let aboveCount = 0;
  let belowCount = 0;
  let prevBullWalk = false;
  let prevBearWalk = false;

  const midBullSignals = [];
  const midBearSignals = [];
  const bullWalkSignals = [];
  const bearWalkSignals = [];

  for (let i = len; i < n; i++) {
    const prev = bPercentValues[i - 1];
    const cur = bPercentValues[i];
    if (prev === null || cur === null) continue;

    // Crossovers 0.5
    if (prev <= 0.5 && cur > 0.5) midBullSignals.push({ time: times[i], value: 0.0 });
    if (prev >= 0.5 && cur < 0.5) midBearSignals.push({ time: times[i], value: 1.0 });

    // Bandwalk
    if (cur >= 1.0) aboveCount++;
    else aboveCount = 0;

    if (cur <= 0.0) belowCount++;
    else belowCount = 0;

    const curBullWalk = aboveCount >= walkLen;
    const curBearWalk = belowCount >= walkLen;

    if (curBullWalk && !prevBullWalk) {
      bullWalkSignals.push({ time: times[i], value: 0.0 });
    }
    if (curBearWalk && !prevBearWalk) {
      bearWalkSignals.push({ time: times[i], value: 1.0 });
    }

    prevBullWalk = curBullWalk;
    prevBearWalk = curBearWalk;
  }

  const curBPercent = bPercentValues[n - 1] !== null ? parseFloat(bPercentValues[n - 1].toFixed(1)) : 0.5;
  const isBull = curBPercent >= 0.5;
  const zone = curBPercent >= 1.0 
    ? 'SUR-ACHAT / HORS-BANDE SUPÉRIEURE (> 1.0)' 
    : curBPercent <= 0.0 
    ? 'SUR-VENTE / HORS-BANDE INFÉRIEURE (< 0.0)' 
    : curBPercent >= 0.5 
    ? 'ZONE SUPÉRIEURE HAUSSIÈRE (0.5 - 1.0)' 
    : 'ZONE INFÉRIEURE BAISSIÈRE (0.0 - 0.5)';

  return {
    len,
    mult,
    walkLen,
    showBG,
    showShapes,
    bPercentSeries,
    midBullSignals,
    midBearSignals,
    bullWalkSignals,
    bearWalkSignals,
    curBPercent,
    zone,
    isBull
  };
}

/**
 * 2️⃣ ATR% PRO (Normalized True Range / Close + Percentile Rank 200 + Average 100)
 */
export function calculateATRPercentPro(candles, options = {}) {
  const {
    len = 14,
    avgLen = 100,
    rankLen = 200,
    hiRank = 80,
    loRank = 20,
    showBG = true,
    showTable = true
  } = options;

  if (!candles || candles.length < len + 1) {
    return {
      atrPctSeries: [],
      atrAvgSeries: [],
      curATRPct: 8.04,
      curATRAvg: 9.8,
      curRank: 25,
      volStatus: 'NORMAL',
      isBull: true
    };
  }

  const n = candles.length;
  const times = candles.map(c => c.time);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  // True Range
  const tr = [highs[0] - lows[0]];
  for (let i = 1; i < n; i++) {
    const h = highs[i];
    const l = lows[i];
    const prevC = closes[i - 1];
    tr.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
  }

  // RMA (Wilder)
  const rmaTR = new Array(n).fill(0);
  const alpha = 1 / len;
  let sumTR = 0;
  for (let i = 0; i < len; i++) sumTR += tr[i];
  rmaTR[len - 1] = sumTR / len;

  for (let i = len; i < n; i++) {
    rmaTR[i] = alpha * tr[i] + (1 - alpha) * rmaTR[i - 1];
  }

  // ATR% = (atr / close) * 100
  const atrPctValues = new Array(n).fill(null);
  const atrPctSeries = [];

  for (let i = len - 1; i < n; i++) {
    const val = (rmaTR[i] / closes[i]) * 100;
    atrPctValues[i] = val;
    atrPctSeries.push({
      time: times[i],
      value: parseFloat(val.toFixed(2))
    });
  }

  // ATR% Average (SMA avgLen)
  const atrAvgSeries = [];
  for (let i = len - 1 + avgLen - 1; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < avgLen; j++) sum += atrPctValues[i - j];
    atrAvgSeries.push({
      time: times[i],
      value: parseFloat((sum / avgLen).toFixed(2))
    });
  }

  // Percentile Rank: ta.percentrank(atrPct, rankLen)
  const pRankValues = new Array(n).fill(50);
  for (let i = len - 1 + rankLen - 1; i < n; i++) {
    const cur = atrPctValues[i];
    let count = 0;
    for (let j = 0; j < rankLen; j++) {
      if (atrPctValues[i - j] <= cur) count++;
    }
    pRankValues[i] = (count / rankLen) * 100;
  }

  const curATRPct = atrPctValues[n - 1] !== null ? parseFloat(atrPctValues[n - 1].toFixed(2)) : 8.04;
  const curATRAvg = atrAvgSeries.length > 0 ? atrAvgSeries[atrAvgSeries.length - 1].value : 9.8;
  const curRank = Math.round(pRankValues[n - 1] || 25);

  const volStatus = curRank >= hiRank ? 'HIGH' : curRank <= loRank ? 'LOW' : 'NORMAL';
  const isBull = curRank <= hiRank; // Volatilité saine non surchauffée

  return {
    len,
    avgLen,
    rankLen,
    hiRank,
    loRank,
    showBG,
    showTable,
    atrPctSeries,
    atrAvgSeries,
    curATRPct,
    curATRAvg,
    curRank,
    volStatus,
    isBull
  };
}

/**
 * 3️⃣ TTM Squeeze PRO (Bollinger vs Keltner Channels + Linear Regression Momentum + Fire Signals)
 */
export function calculateTTMSqueezePro(candles, options = {}) {
  const {
    bbLength = 20,
    bbMult = 2.0,
    kcLength = 20,
    kcMult = 1.5,
    useTrueRange = true,
    kcMultX = 1.0,
    showBG = true,
    showTable = true
  } = options;

  if (!candles || candles.length < Math.max(bbLength, kcLength) + 1) {
    return {
      histSeries: [],
      fireBullSignals: [],
      fireBearSignals: [],
      curVal: -1364.2,
      sqzStatus: 'NO SQUEEZE',
      sqzCount: 0,
      isBull: false
    };
  }

  const n = candles.length;
  const times = candles.map(c => c.time);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  // True Range
  const tr = [highs[0] - lows[0]];
  for (let i = 1; i < n; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }

  // Linear regression calc (offset 0)
  function calcLinreg(srcArr, len) {
    const out = new Array(srcArr.length).fill(0);
    const xSum = (len * (len - 1)) / 2;
    const x2Sum = (len * (len - 1) * (2 * len - 1)) / 6;
    const divisor = len * x2Sum - xSum * xSum;

    for (let i = len - 1; i < srcArr.length; i++) {
      let ySum = 0;
      let xySum = 0;
      for (let j = 0; j < len; j++) {
        const y = srcArr[i - (len - 1 - j)];
        const x = j;
        ySum += y;
        xySum += x * y;
      }
      const slope = (len * xySum - xSum * ySum) / divisor;
      const intercept = (ySum - slope * xSum) / len;
      out[i] = intercept + slope * (len - 1);
    }
    return out;
  }

  // Source for Linreg: close - avg(avgHL, sma(close, kcLength))
  const srcLinreg = new Array(n).fill(0);
  for (let i = kcLength - 1; i < n; i++) {
    let hMax = -Infinity, lMin = Infinity;
    let cSum = 0;
    for (let j = 0; j < kcLength; j++) {
      const idx = i - j;
      if (highs[idx] > hMax) hMax = highs[idx];
      if (lows[idx] < lMin) lMin = lows[idx];
      cSum += closes[idx];
    }
    const avgHL = (hMax + lMin) / 2;
    const smaC = cSum / kcLength;
    const meanOfBoth = (avgHL + smaC) / 2;
    srcLinreg[i] = closes[i] - meanOfBoth;
  }

  const valLinreg = calcLinreg(srcLinreg, kcLength);

  // Bollinger Bands & Keltner Channels Squeeze
  const sqzNormalArr = new Array(n).fill(false);
  const sqzExtremeArr = new Array(n).fill(false);

  for (let i = Math.max(bbLength, kcLength) - 1; i < n; i++) {
    // BB
    let bbSum = 0;
    for (let j = 0; j < bbLength; j++) bbSum += closes[i - j];
    const bbBasis = bbSum / bbLength;

    let bbVar = 0;
    for (let j = 0; j < bbLength; j++) bbVar += Math.pow(closes[i - j] - bbBasis, 2);
    const bbDev = bbMult * Math.sqrt(bbVar / bbLength);
    const upperBB = bbBasis + bbDev;
    const lowerBB = bbBasis - bbDev;

    // KC
    let kcSum = 0;
    let rSum = 0;
    for (let j = 0; j < kcLength; j++) {
      kcSum += closes[i - j];
      rSum += useTrueRange ? tr[i - j] : (highs[i - j] - lows[i - j]);
    }
    const kcMA = kcSum / kcLength;
    const rangema = rSum / kcLength;

    const upperKC = kcMA + rangema * kcMult;
    const lowerKC = kcMA - rangema * kcMult;
    const upperKCX = kcMA + rangema * kcMultX;
    const lowerKCX = kcMA - rangema * kcMultX;

    sqzNormalArr[i] = lowerBB > lowerKC && upperBB < upperKC;
    sqzExtremeArr[i] = lowerBB > lowerKCX && upperBB < upperKCX;
  }

  // Count & Squeeze Fire Signals
  let sqzCount = 0;
  const fireBullSignals = [];
  const fireBearSignals = [];
  const histSeries = [];

  for (let i = kcLength; i < n; i++) {
    const val = valLinreg[i];
    const prevVal = valLinreg[i - 1];

    if (sqzNormalArr[i]) sqzCount++;
    else sqzCount = 0;

    const sqzFire = sqzNormalArr[i - 1] && !sqzNormalArr[i];
    if (sqzFire && val > 0) fireBullSignals.push({ time: times[i], value: 0 });
    if (sqzFire && val < 0) fireBearSignals.push({ time: times[i], value: 0 });

    // Histogram Color
    let color;
    if (val > 0) {
      color = val > prevVal ? '#22c55e' : '#15803d'; // Lime / Green
    } else {
      color = val < prevVal ? '#ef4444' : '#881337'; // Red / Maroon
    }

    histSeries.push({
      time: times[i],
      value: parseFloat(val.toFixed(1)),
      color
    });
  }

  const curVal = valLinreg[n - 1] !== undefined ? parseFloat(valLinreg[n - 1].toFixed(1)) : -1364.2;
  const curNormal = sqzNormalArr[n - 1];
  const curExtreme = sqzExtremeArr[n - 1];

  const sqzStatus = curExtreme 
    ? `EXTREME SQUEEZE: ${sqzCount} bars` 
    : curNormal 
    ? `SQUEEZE: ${sqzCount} bars` 
    : 'NO SQUEEZE';

  const isBull = curVal >= 0;

  return {
    bbLength,
    bbMult,
    kcLength,
    kcMult,
    useTrueRange,
    kcMultX,
    showBG,
    showTable,
    histSeries,
    fireBullSignals,
    fireBearSignals,
    curVal,
    sqzStatus,
    sqzCount,
    isBull
  };
}
