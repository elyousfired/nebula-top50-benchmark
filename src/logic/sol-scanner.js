import { fetchBybitData, calculateEMA } from './scanner.js';

let solCache = {};
let btcCache = {};

export const fetchSolData = async (interval, limit) => {
  const cacheKey = `${interval}-${limit}`;
  const now = Date.now();
  
  if (solCache[cacheKey] && now - solCache[cacheKey].timestamp < 60000) {
    return solCache[cacheKey].promise;
  }

  const promise = fetchBybitData('SOLUSDT', interval, limit);

  solCache[cacheKey] = {
    timestamp: now,
    promise: promise
  };

  return promise;
};

export const fetchBtcData = async (interval, limit) => {
  const cacheKey = `${interval}-${limit}`;
  const now = Date.now();
  
  if (btcCache[cacheKey] && now - btcCache[cacheKey].timestamp < 60000) {
    return btcCache[cacheKey].promise;
  }

  const promise = fetchBybitData('BTCUSDT', interval, limit);

  btcCache[cacheKey] = {
    timestamp: now,
    promise: promise
  };

  return promise;
};

const calculateAnchoredVWAP = (klines, startIndex) => {
  if (!klines || klines.length === 0 || startIndex < 0 || startIndex >= klines.length) return [];
  
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  let vwapArray = [];
  
  for (let i = startIndex; i < klines.length; i++) {
    const k = klines[i];
    const typicalPrice = (k.high + k.low + k.close) / 3;
    const volume = k.volume;
    
    cumulativePV += typicalPrice * volume;
    cumulativeVolume += volume;
    
    const vwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : typicalPrice;
    vwapArray.push({ time: k.time, value: vwap });
  }
  return vwapArray;
};

export const fetchMacroSol = async (symbol, timeframe = 'D', isUSDTModeOrAnalyzeAgainst = false) => {
  let interval = 'D';
  let limit = 365;
  let dropThreshold = -30;
  let bottomMinAge = 5; 
  let startLookback = 15; 
  
  if (timeframe === '4H') {
    interval = '240';
    limit = 270;
    dropThreshold = -20;
    bottomMinAge = 18; 
    startLookback = 40; 
  } else if (timeframe === '1H') {
    interval = '60';
    limit = 240;
    dropThreshold = -15; 
    bottomMinAge = 24; 
    startLookback = 72; 
  } else if (timeframe === '15M') {
    interval = '15';
    limit = 288;
    dropThreshold = -8; 
    bottomMinAge = 32; 
    startLookback = 96; 
  }

  let klines = await fetchBybitData(symbol, interval, limit);
  if (!klines || klines.length === 0) return { isValid: false, cupPattern: null };

  const rawTokenKlines = [...klines];
  let solMap = new Map();

  const isUSDTMode = isUSDTModeOrAnalyzeAgainst === true || isUSDTModeOrAnalyzeAgainst === 'USDT';
  const analyzeAgainst = (isUSDTModeOrAnalyzeAgainst === true || isUSDTModeOrAnalyzeAgainst === 'USDT')
    ? 'USDT'
    : (isUSDTModeOrAnalyzeAgainst === 'BTC')
      ? 'BTC'
      : 'SOL';

  if (!isUSDTMode) {
    const baseKlines = analyzeAgainst === 'BTC'
      ? await fetchBtcData(interval, limit)
      : await fetchSolData(interval, limit);
    if (!baseKlines || baseKlines.length === 0) return { isValid: false, cupPattern: null };

    baseKlines.forEach(k => solMap.set(k[0], k));

    const syntheticKlines = [];
    for (let idx = 0; idx < klines.length; idx++) {
       const k = klines[idx];
       const timestamp = k[0];
       const solK = solMap.get(timestamp);
       if (solK) {
          const open = parseFloat(k[1]) / parseFloat(solK[1]);
          const close = parseFloat(k[4]) / parseFloat(solK[4]);
          const high = parseFloat(k[2]) / parseFloat(solK[3]);
          const low = parseFloat(k[3]) / parseFloat(solK[2]);
          
          const safeHigh = Math.max(open, close, high);
          const safeLow = Math.min(open, close, low);

          syntheticKlines.push([
             timestamp,
             open.toString(),
             safeHigh.toString(),
             safeLow.toString(),
             close.toString(),
             k[5],
             k[6]
          ]);
       }
    }

    if (syntheticKlines.length < 50) return { isValid: false, cupPattern: null };
    klines = syntheticKlines;
  }
  
  const currentPrice = parseFloat(klines[0][4]);

  const rawTokenData = [];
  const rawSolData = [];

  const formattedKlines = [...klines].reverse().map(k => {
     const timestamp = k[0];
     const timeSec = Math.floor(Number(timestamp) / 1000);

     const origTokenClose = rawTokenKlines.find(tk => tk[0] === timestamp)?.[4];
     const origSolClose = solMap.has(timestamp) ? solMap.get(timestamp)[4] : null;
     
     if (origTokenClose) rawTokenData.push({ time: timeSec, value: parseFloat(origTokenClose) });
     if (origSolClose) rawSolData.push({ time: timeSec, value: parseFloat(origSolClose) });

     const open = parseFloat(k[1]);
     const close = parseFloat(k[4]);
     return {
       time: timeSec,
       open,
       high: parseFloat(k[2]),
       low: parseFloat(k[3]),
       close,
       volume: parseFloat(k[6] || k[5]),
       volColor: close > open ? 'rgba(0, 184, 255, 0.4)' : 'rgba(100, 116, 139, 0.4)'
     };
  });

  let bestPeakIndex = -1;
  let bestPotentialHigh = -1;
  
  for (let i = startLookback; i < klines.length; i++) {
    const high = parseFloat(klines[i][2]);
    if (high > bestPotentialHigh) {
      bestPotentialHigh = high;
      bestPeakIndex = i;
    }
  }

  if (bestPeakIndex === -1) {
    return { 
      isValid: false, 
      cupPattern: { type: 'NONE', dropPercent: 0, daysSinceHigh: 0, oldHigh: 0, parabolaCurve: [], breakoutPercent: 0, klines: formattedKlines } 
    };
  }

  for (let i = 0; i < startLookback; i++) {
    const recentHigh = parseFloat(klines[i][2]);
    if (recentHigh > bestPotentialHigh * 1.05) {
      return { isValid: false, cupPattern: null };
    }
  }

  let macroPeakIndex = bestPeakIndex;
  let macroPotentialHigh = bestPotentialHigh;

  for (let i = bestPeakIndex + 1; i < klines.length; i++) {
    const olderHigh = parseFloat(klines[i][2]);
    if (olderHigh >= bestPotentialHigh * 0.90 && olderHigh <= bestPotentialHigh * 1.10) {
      let isValidEqualHigh = true;
      for (let j = bestPeakIndex; j < i; j++) {
         if (parseFloat(klines[j][2]) > olderHigh * 1.05) {
           isValidEqualHigh = false;
           break;
         }
      }
      if (isValidEqualHigh) {
        macroPeakIndex = i;
        macroPotentialHigh = olderHigh;
      }
    }
  }

  const i = macroPeakIndex;
  const potentialHigh = macroPotentialHigh;
  
  let cupBottom = Infinity;
  let cupBottomIndex = -1;
  for (let j = 1; j < i; j++) {
    const low = parseFloat(klines[j][3]);
    if (low < cupBottom) {
      cupBottom = low;
      cupBottomIndex = j;
    }
  }

  const dropPercent = ((cupBottom / potentialHigh) - 1) * 100;
  const distanceToHigh = ((currentPrice / potentialHigh) - 1) * 100;

  const meetsStrictConditions = dropPercent <= dropThreshold && cupBottomIndex >= bottomMinAge;
  const meetsWeakConditions = dropPercent < -0.1 && cupBottomIndex >= 1;
  
  const isValid = meetsStrictConditions || meetsWeakConditions;
  const dropSeverity = meetsStrictConditions ? '' : 'FAIBLE';

  const idx1 = klines.length - 1 - i; 
  const idx2 = klines.length - 1 - cupBottomIndex; 
  const idx3 = klines.length - 1; 

  const x2 = idx2 - idx1;
  const x3 = idx3 - idx1;
  const y1 = potentialHigh;
  const y2 = cupBottom;
  const y3 = currentPrice;

  let parabolaCurve = [];
  let mathCoeffs = null;
  
  if (x2 > 0 && x3 > x2) {
    const A = ((y3 - y1) - (x3 / x2) * (y2 - y1)) / (x3 * (x3 - x2));
    const B = (y2 - y1 - (x2 * x2) * A) / x2;
    const C = y1;
    mathCoeffs = { a: A, b: B, c: C };

    for (let idx = idx1; idx <= idx3; idx++) {
      const x = idx - idx1;
      const y = A * x * x + B * x + C;
      parabolaCurve.push({
        time: formattedKlines[idx].time,
        value: y
      });
    }
  }

  let patternType = 'RECOVERY';
  if (distanceToHigh >= -15 && distanceToHigh < 0) patternType = 'PRE-BREAKOUT';
  else if (distanceToHigh >= 0) patternType = 'EARLY BREAKOUT';

  const ema50Data = formattedKlines.map(k => k.close);
  const ema50Values = calculateEMA(ema50Data, 50);
  const ema50 = formattedKlines.map((k, index) => ({ time: k.time, value: ema50Values[index] }));
  
  const ema20Values = calculateEMA(ema50Data, 20);
  const ema20 = formattedKlines.map((k, index) => ({ time: k.time, value: ema20Values[index] }));

  let hasEmaReclaim = false;
  let emaReclaimAge = -1;
  if (ema50.length > 0) {
    const emaMap = new Map();
    ema50.forEach(e => emaMap.set(e.time, e.value));
    for (let j = formattedKlines.length - 1; j >= Math.max(0, formattedKlines.length - 15); j--) {
       const curr = formattedKlines[j];
       const currEma = emaMap.get(curr.time);
       if (currEma && curr.low <= currEma && curr.close > currEma && curr.close <= potentialHigh * 1.05) {
          hasEmaReclaim = true;
          emaReclaimAge = formattedKlines.length - 1 - j;
          break;
       }
    }
  }

  // Dead Volume Zone computation (Liquidation / Exhaustion)
  const cupKlines = formattedKlines.slice(idx1, idx3 + 1);
  const avgCupVolume = cupKlines.length > 0 ? cupKlines.reduce((acc, k) => acc + k.volume, 0) / cupKlines.length : 1;

  const volumeData = formattedKlines.map((k, index) => {
      const isDeadZone = index >= idx1 && k.low <= cupBottom * 1.15 && k.volume <= avgCupVolume * 0.75;
      return {
          time: k.time,
          value: k.volume,
          color: isDeadZone ? '#e879f9' : (k.close > k.open ? 'rgba(0, 184, 255, 0.4)' : 'rgba(100, 116, 139, 0.4)')
      };
  });

  let deadZoneStart = null;
  let deadZoneEnd = null;
  let deadZoneMaxHigh = 0;
  
  formattedKlines.forEach((k, index) => {
      const isDeadZone = index >= idx1 && k.low <= cupBottom * 1.15 && k.volume <= avgCupVolume * 0.75;
      if (isDeadZone) {
          if (!deadZoneStart) deadZoneStart = k.time;
          deadZoneEnd = k.time;
          if (k.high > deadZoneMaxHigh) deadZoneMaxHigh = k.high;
      }
  });

  const deadZoneBox = [];
  if (deadZoneStart && deadZoneEnd) {
      formattedKlines.forEach(k => {
          if (k.time >= deadZoneStart && k.time <= deadZoneEnd) {
              deadZoneBox.push({ time: k.time, value: deadZoneMaxHigh * 1.05 });
          }
      });
  }

  const cupPattern = {
    type: patternType,
    oldHigh: potentialHigh,
    cupBottom,
    currentPrice,
    dropPercent,
    dropSeverity,
    breakoutPercent: distanceToHigh,
    daysSinceHigh: i,
    daysSinceBottom: cupBottomIndex,
    klines: formattedKlines,
    parabolaCurve,
    mathCoeffs,
    ema20,
    ema50,
    hasEmaReclaim,
    emaReclaimAge,
    anchoredVWAP: calculateAnchoredVWAP(formattedKlines, idx1),
    volumeData,
    deadZoneBox,
    rawTokenData,
    rawSolData
  };

  return { isValid, cupPattern };
};
