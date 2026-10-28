// src/logic/weeklyOBLogic.js

export const calculateWeeklyOBs = (klines, timeframe = 'W') => {
  // klines format: [startTime, open, high, low, close, volume, turnover]
  // ensure sorted chronologically (oldest to newest)
  const sorted = [...klines].sort((a, b) => Number(a[0]) - Number(b[0]));
  
  const parsed = sorted.map(k => ({
    time: Number(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4])
  }));

  const swingLen = 10;
  const lookbackOB = 20;

  let lastSH = null;
  let lastSL = null;

  let activeBullishOBs = [];
  let activeBearishOBs = [];

  // Arrays to hold history for visualization
  const allHistoricalOBs = [];

  for (let curr = swingLen * 2; curr < parsed.length; curr++) {
    const currentCandle = parsed[curr];

    // 1. Invalidation Check (Before checking new BOS)
    activeBullishOBs = activeBullishOBs.filter(ob => {
      // Touch check
      if (currentCandle.low <= ob.top && currentCandle.low >= ob.bottom) {
        ob.touchCount += 1;
      }
      return currentCandle.low >= ob.bottom;
    });

    activeBearishOBs = activeBearishOBs.filter(ob => {
      // Touch check
      if (currentCandle.high >= ob.bottom && currentCandle.high <= ob.top) {
        ob.touchCount += 1;
      }
      return currentCandle.high <= ob.top;
    });

    // Increment age for all active OBs
    activeBullishOBs.forEach(ob => ob.ageCandles += 1);
    activeBearishOBs.forEach(ob => ob.ageCandles += 1);

    // 2. Swing Detection at index (curr - swingLen)
    // A swing is confirmed when 10 candles have closed after it.
    const swingIndex = curr - swingLen;
    const swingCandle = parsed[swingIndex];
    
    let isSH = true;
    let isSL = true;

    for (let i = swingIndex - swingLen; i <= swingIndex + swingLen; i++) {
      if (i === swingIndex) continue;
      if (parsed[i].high >= swingCandle.high) isSH = false;
      if (parsed[i].low <= swingCandle.low) isSL = false;
    }

    if (isSH) lastSH = swingCandle.high;
    if (isSL) lastSL = swingCandle.low;

    // 3. Break of Structure (BOS)
    let bullishBOS = false;
    let bearishBOS = false;

    if (lastSH !== null && currentCandle.close > lastSH) {
      bullishBOS = true;
      // Reset lastSH so we don't trigger BOS multiple times for the same swing
      lastSH = null; 
    }

    if (lastSL !== null && currentCandle.close < lastSL) {
      bearishBOS = true;
      lastSL = null;
    }

    // 4. OB Creation
    if (bullishBOS) {
      let foundOB = null;
      const limit = Math.max(0, curr - lookbackOB);
      for (let j = curr; j >= limit; j--) {
        if (parsed[j].close < parsed[j].open) {
          foundOB = {
            type: 'BULLISH',
            top: parsed[j].high,
            bottom: parsed[j].low,
            startTime: parsed[j].time,
            breakTime: null, // active
            timeframe: timeframe,
            touchCount: 0,
            ageCandles: curr - j,
            source: 'BOS'
          };
          break;
        }
      }
      if (foundOB) {
        activeBullishOBs.push(foundOB);
        allHistoricalOBs.push(foundOB);
      }
    }

    if (bearishBOS) {
      let foundOB = null;
      const limit = Math.max(0, curr - lookbackOB);
      for (let j = curr; j >= limit; j--) {
        if (parsed[j].close > parsed[j].open) {
          foundOB = {
            type: 'BEARISH',
            top: parsed[j].high,
            bottom: parsed[j].low,
            startTime: parsed[j].time,
            breakTime: null, // active
            timeframe: timeframe,
            touchCount: 0,
            ageCandles: curr - j,
            source: 'BOS'
          };
          break;
        }
      }
      if (foundOB) {
        activeBearishOBs.push(foundOB);
        allHistoricalOBs.push(foundOB);
      }
    }
    
    // Update broken status for visualization
    for (const ob of allHistoricalOBs) {
      if (ob.breakTime === null) {
        if (ob.type === 'BULLISH' && currentCandle.low < ob.bottom) {
          ob.breakTime = currentCandle.time;
        }
        if (ob.type === 'BEARISH' && currentCandle.high > ob.top) {
          ob.breakTime = currentCandle.time;
        }
      }
    }
  }

  // Active OBs to monitor
  const activeOBs = [...activeBullishOBs, ...activeBearishOBs];
  
  return {
    activeOBs,
    allHistoricalOBs,
    parsedKlines: parsed
  };
};
