export const detectAccumulation = (klines, maxRangePct = 7, marginPct = 0.5, windowSize = 200) => {
  if (!klines || klines.length < windowSize + 20) return null;

  // We look at the last `windowSize` candles for the box
  const windowKlines = klines.slice(-windowSize); 
  
  // Pre-range klines to determine trend before the box (50 candles before windowSize)
  const preRangeKlines = klines.slice(-(windowSize + 50), -windowSize);
  
  const highs = windowKlines.map(k => k.high);
  const lows = windowKlines.map(k => k.low);
  const closes = windowKlines.map(k => k.close);
  const currentPrice = windowKlines[windowKlines.length - 1].close;
  
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  
  if (minLow === 0) return null;
  
  const rangePct = ((maxHigh - minLow) / minLow) * 100;
  
  // Filter out algorithmic noise (too tight) and huge ranges
  if (rangePct > maxRangePct || rangePct < 1.0) return null;

  // --- 1. Pre-Range Trend ---
  let preRangeTrend = "SIDEWAYS";
  if (preRangeKlines.length > 20) {
    const preStartAvg = preRangeKlines.slice(0, 10).reduce((sum, k) => sum + k.close, 0) / 10;
    const boxStartAvg = windowKlines.slice(0, 10).reduce((sum, k) => sum + k.close, 0) / 10;
    
    const preRangeMovePct = ((boxStartAvg - preStartAvg) / preStartAvg) * 100;
    if (preRangeMovePct > 4) preRangeTrend = "STRONG PUMP";
    else if (preRangeMovePct > 1.5) preRangeTrend = "PUMP";
    else if (preRangeMovePct < -4) preRangeTrend = "STRONG DROP";
    else if (preRangeMovePct < -1.5) preRangeTrend = "DROP";
  }

  // --- 2. Pivot Touches (Swing Logic) ---
  let resistanceTouches = 0;
  let supportTouches = 0;
  
  let inResistanceZone = false;
  let inSupportZone = false;

  for (const k of windowKlines) {
    const isNearRes = k.high >= maxHigh * (1 - marginPct / 100);
    const isNearSup = k.low <= minLow * (1 + marginPct / 100);
    
    // Resistance Swing Touch
    if (isNearRes && !inResistanceZone) {
      resistanceTouches++;
      inResistanceZone = true;
    }
    // Reset resistance zone if price drops significantly from resistance
    if (inResistanceZone && k.high < maxHigh * (1 - (marginPct * 2) / 100)) {
      inResistanceZone = false;
    }

    // Support Swing Touch
    if (isNearSup && !inSupportZone) {
      supportTouches++;
      inSupportZone = true;
    }
    // Reset support zone if price rises significantly from support
    if (inSupportZone && k.low > minLow * (1 + (marginPct * 2) / 100)) {
      inSupportZone = false;
    }
  }
  
  // If we don't have clear levels (at least 2 distinct swing touches on both), it's not a strong structural box.
  if (resistanceTouches < 2 || supportTouches < 2) return null;

  // --- 3. Price Location ---
  const thirdOfRange = (maxHigh - minLow) / 3;
  const upperBoundary = maxHigh - thirdOfRange;
  const lowerBoundary = minLow + thirdOfRange;

  let priceLocation = "MIDDLE THIRD";
  if (currentPrice >= upperBoundary) priceLocation = "UPPER THIRD";
  else if (currentPrice <= lowerBoundary) priceLocation = "LOWER THIRD";

  // --- 4. Internal Structure (HL / LH) ---
  // Compare lows/highs of first half vs second half
  const recentSize = Math.floor(windowSize * 0.3);
  const oldSize = Math.floor(windowSize * 0.7);
  
  const recentKlines = windowKlines.slice(-recentSize);
  const oldKlines = windowKlines.slice(0, oldSize);
  
  const recentLowest = Math.min(...recentKlines.map(k => k.low));
  const oldLowest = Math.min(...oldKlines.map(k => k.low));
  
  const recentHighest = Math.max(...recentKlines.map(k => k.high));
  const oldHighest = Math.max(...oldKlines.map(k => k.high));

  let structure = "NEUTRAL";
  
  // If recent lowest is significantly higher than old lowest (by 25% of the range size)
  if (recentLowest > minLow + ((maxHigh - minLow) * 0.25)) {
    structure = "HIGHER LOWS";
  } 
  // If recent highest is significantly lower than old highest
  else if (recentHighest < maxHigh - ((maxHigh - minLow) * 0.25)) {
    structure = "LOWER HIGHS";
  }

  // --- 5. Pressure & Status ---
  let pressure = "NEUTRAL";
  if (structure === "HIGHER LOWS" || (structure === "NEUTRAL" && priceLocation === "UPPER THIRD")) {
    pressure = "BUYERS";
  } else if (structure === "LOWER HIGHS" || (structure === "NEUTRAL" && priceLocation === "LOWER THIRD")) {
    pressure = "SELLERS";
  }

  let status = "NEUTRAL RANGE";
  
  if (pressure === "BUYERS") {
    if (priceLocation === "UPPER THIRD") status = "PRE-BREAKOUT";
    else status = "BULLISH ACCUMULATION";
  } else if (pressure === "SELLERS") {
    if (priceLocation === "LOWER THIRD") status = "PRE-BREAKDOWN";
    else status = "BEARISH DISTRIBUTION";
  }
  
  // Calculate raw distance for pure visual stats
  const distToSupport = ((currentPrice - minLow) / minLow) * 100;
  const distToResistance = ((maxHigh - currentPrice) / currentPrice) * 100;
  
  return {
    isAccumulating: true,
    boxHigh: maxHigh,
    boxLow: minLow,
    rangePct,
    resistanceTouches,
    supportTouches,
    currentPrice,
    distToSupport,
    distToResistance,
    preRangeTrend,
    priceLocation,
    structure,
    pressure,
    status,
    accumulationLength: windowSize
  };
};
