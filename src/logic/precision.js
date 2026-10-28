// src/logic/precision.js

/**
 * Analyzes the precision of Bollinger Bands
 * @param {Array} candles - Array of candle objects { time, open, high, low, close }
 * @param {Object} bb - Bollinger bands object { upper, lower, middle }
 * @param {number} checkCandlesAhead - How many candles ahead to check for success (default 5)
 */
export function analyzeBollingerPrecision(candles, bb, checkCandlesAhead = 5) {
  let bullishSignals = 0;
  let bullishSuccess = 0;
  
  let bearishSignals = 0;
  let bearishSuccess = 0;

  for (let i = 0; i < candles.length - checkCandlesAhead; i++) {
    const candle = candles[i];
    const upper = bb.upper[i]?.value;
    const lower = bb.lower[i]?.value;

    if (!upper || !lower) continue;

    // Bullish Signal: Price touches or closes below lower band
    if (candle.low <= lower || candle.close <= lower) {
      bullishSignals++;
      // Check price 5 candles later
      const futureCandle = candles[i + checkCandlesAhead];
      if (futureCandle.close > candle.close) {
        bullishSuccess++;
      }
    }

    // Bearish Signal: Price touches or closes above upper band
    if (candle.high >= upper || candle.close >= upper) {
      bearishSignals++;
      // Check price 5 candles later
      const futureCandle = candles[i + checkCandlesAhead];
      if (futureCandle.close < candle.close) {
        bearishSuccess++;
      }
    }
  }

  const bullishRate = bullishSignals > 0 ? (bullishSuccess / bullishSignals) * 100 : 0;
  const bearishRate = bearishSignals > 0 ? (bearishSuccess / bearishSignals) * 100 : 0;

  return {
    bullish: { rate: bullishRate, signals: bullishSignals, success: bullishSuccess },
    bearish: { rate: bearishRate, signals: bearishSignals, success: bearishSuccess },
    checkPeriod: checkCandlesAhead
  };
}

/**
 * Analyzes the precision of Ichimoku Cloud
 * @param {Array} candles - Array of candle objects { time, open, high, low, close }
 * @param {Object} ichimoku - Ichimoku object { tenkan, kijun, senkouA, senkouB }
 * @param {number} checkCandlesAhead - How many candles ahead to check for success (default 5)
 */
export function analyzeIchimokuPrecision(candles, ichimoku, checkCandlesAhead = 5) {
  let bullishSignals = 0;
  let bullishSuccess = 0;
  
  let bearishSignals = 0;
  let bearishSuccess = 0;

  for (let i = 1; i < candles.length - checkCandlesAhead; i++) {
    const candle = candles[i];
    const prevCandle = candles[i - 1];
    
    const senkouA = ichimoku.senkouA[i]?.value;
    const senkouB = ichimoku.senkouB[i]?.value;
    
    const prevSenkouA = ichimoku.senkouA[i - 1]?.value;
    const prevSenkouB = ichimoku.senkouB[i - 1]?.value;

    if (senkouA === null || senkouB === null || prevSenkouA === null || prevSenkouB === null) continue;

    const cloudTop = Math.max(senkouA, senkouB);
    const cloudBottom = Math.min(senkouA, senkouB);
    
    const prevCloudTop = Math.max(prevSenkouA, prevSenkouB);
    const prevCloudBottom = Math.min(prevSenkouA, prevSenkouB);

    // Bullish Signal: Price crosses above the cloud (Close > Cloud Top, Prev Close <= Prev Cloud Top)
    if (candle.close > cloudTop && prevCandle.close <= prevCloudTop) {
      bullishSignals++;
      const futureCandle = candles[i + checkCandlesAhead];
      if (futureCandle.close > candle.close) {
        bullishSuccess++;
      }
    }

    // Bearish Signal: Price crosses below the cloud (Close < Cloud Bottom, Prev Close >= Prev Cloud Bottom)
    if (candle.close < cloudBottom && prevCandle.close >= prevCloudBottom) {
      bearishSignals++;
      const futureCandle = candles[i + checkCandlesAhead];
      if (futureCandle.close < candle.close) {
        bearishSuccess++;
      }
    }
  }

  const bullishRate = bullishSignals > 0 ? (bullishSuccess / bullishSignals) * 100 : 0;
  const bearishRate = bearishSignals > 0 ? (bearishSuccess / bearishSignals) * 100 : 0;

  return {
    bullish: { rate: bullishRate, signals: bullishSignals, success: bullishSuccess },
    bearish: { rate: bearishRate, signals: bearishSignals, success: bearishSuccess },
    checkPeriod: checkCandlesAhead
  };
}

/**
 * Analyzes the precision of EMAs (9, 20, 50) using two methods:
 * 1. Price Crossover (Price crosses EMA 20 or 50)
 * 2. EMA Crossover (EMA 9 crosses EMA 20 or 50)
 */
export function analyzeEMAPrecision(candles, emas, checkCandlesAhead = 5) {
  const stats = {
    priceCross20: { bullish: { signals: 0, success: 0 }, bearish: { signals: 0, success: 0 } },
    priceCross50: { bullish: { signals: 0, success: 0 }, bearish: { signals: 0, success: 0 } },
    emaCross9_20: { bullish: { signals: 0, success: 0 }, bearish: { signals: 0, success: 0 } },
    emaCross9_50: { bullish: { signals: 0, success: 0 }, bearish: { signals: 0, success: 0 } },
    emaCross20_50: { bullish: { signals: 0, success: 0 }, bearish: { signals: 0, success: 0 } }
  };

  const { ema9, ema20, ema50 } = emas;

  for (let i = 1; i < candles.length - checkCandlesAhead; i++) {
    const candle = candles[i];
    const prevCandle = candles[i - 1];
    const futureCandle = candles[i + checkCandlesAhead];

    const e9 = ema9[i]?.value;
    const pe9 = ema9[i - 1]?.value;
    const e20 = ema20[i]?.value;
    const pe20 = ema20[i - 1]?.value;
    const e50 = ema50[i]?.value;
    const pe50 = ema50[i - 1]?.value;

    // --- METHOD 1: PRICE CROSSOVER ---
    // Price vs EMA 20
    if (e20 && pe20) {
      if (candle.close > e20 && prevCandle.close <= pe20) { // Bullish Cross
        stats.priceCross20.bullish.signals++;
        if (futureCandle.close > candle.close) stats.priceCross20.bullish.success++;
      } else if (candle.close < e20 && prevCandle.close >= pe20) { // Bearish Cross
        stats.priceCross20.bearish.signals++;
        if (futureCandle.close < candle.close) stats.priceCross20.bearish.success++;
      }
    }

    // Price vs EMA 50
    if (e50 && pe50) {
      if (candle.close > e50 && prevCandle.close <= pe50) { // Bullish Cross
        stats.priceCross50.bullish.signals++;
        if (futureCandle.close > candle.close) stats.priceCross50.bullish.success++;
      } else if (candle.close < e50 && prevCandle.close >= pe50) { // Bearish Cross
        stats.priceCross50.bearish.signals++;
        if (futureCandle.close < candle.close) stats.priceCross50.bearish.success++;
      }
    }

    // --- METHOD 2: EMA CROSSOVER ---
    // EMA 9 vs EMA 20
    if (e9 && pe9 && e20 && pe20) {
      if (e9 > e20 && pe9 <= pe20) { // Bullish Cross
        stats.emaCross9_20.bullish.signals++;
        if (futureCandle.close > candle.close) stats.emaCross9_20.bullish.success++;
      } else if (e9 < e20 && pe9 >= pe20) { // Bearish Cross
        stats.emaCross9_20.bearish.signals++;
        if (futureCandle.close < candle.close) stats.emaCross9_20.bearish.success++;
      }
    }

    // EMA 9 vs EMA 50
    if (e9 && pe9 && e50 && pe50) {
      if (e9 > e50 && pe9 <= pe50) { // Bullish Cross
        stats.emaCross9_50.bullish.signals++;
        if (futureCandle.close > candle.close) stats.emaCross9_50.bullish.success++;
      } else if (e9 < e50 && pe9 >= pe50) { // Bearish Cross
        stats.emaCross9_50.bearish.signals++;
        if (futureCandle.close < candle.close) stats.emaCross9_50.bearish.success++;
      }
    }

    // EMA 20 vs EMA 50
    if (e20 && pe20 && e50 && pe50) {
      if (e20 > e50 && pe20 <= pe50) { // Bullish Cross
        stats.emaCross20_50.bullish.signals++;
        if (futureCandle.close > candle.close) stats.emaCross20_50.bullish.success++;
      } else if (e20 < e50 && pe20 >= pe50) { // Bearish Cross
        stats.emaCross20_50.bearish.signals++;
        if (futureCandle.close < candle.close) stats.emaCross20_50.bearish.success++;
      }
    }
  }

  // Calculate Rates
  const calcRate = (obj) => ({
    ...obj,
    rate: obj.signals > 0 ? (obj.success / obj.signals) * 100 : 0
  });

  return {
    priceCross20: { bullish: calcRate(stats.priceCross20.bullish), bearish: calcRate(stats.priceCross20.bearish) },
    priceCross50: { bullish: calcRate(stats.priceCross50.bullish), bearish: calcRate(stats.priceCross50.bearish) },
    emaCross9_20: { bullish: calcRate(stats.emaCross9_20.bullish), bearish: calcRate(stats.emaCross9_20.bearish) },
    emaCross9_50: { bullish: calcRate(stats.emaCross9_50.bullish), bearish: calcRate(stats.emaCross9_50.bearish) },
    emaCross20_50: { bullish: calcRate(stats.emaCross20_50.bullish), bearish: calcRate(stats.emaCross20_50.bearish) },
    checkPeriod: checkCandlesAhead
  };
}

/**
 * Analyzes the precision of combined strategies:
 * 1. Bollinger Bands + EMA 50 (Bounce with Trend)
 * 2. Ichimoku + EMA 20 (Breakout Confirmation)
 */
export function analyzeCombinedStrategies(candles, bb, ichi, emas, checkCandlesAhead = 5) {
  const stats = {
    bbAndEma50: { bullish: { signals: 0, success: 0 }, bearish: { signals: 0, success: 0 } },
    ichiAndEma20: { bullish: { signals: 0, success: 0 }, bearish: { signals: 0, success: 0 } }
  };

  const { upper, lower } = bb;
  const { tenkan, kijun, senkouA, senkouB } = ichi;
  const { ema20, ema50 } = emas;

  for (let i = 1; i < candles.length - checkCandlesAhead; i++) {
    const candle = candles[i];
    const futureCandle = candles[i + checkCandlesAhead];

    const bLow = lower[i]?.value;
    const bUp = upper[i]?.value;
    
    const sA = senkouA[i]?.value;
    const sB = senkouB[i]?.value;
    const cloudTop = (sA && sB) ? Math.max(sA, sB) : null;
    const cloudBottom = (sA && sB) ? Math.min(sA, sB) : null;

    const e20 = ema20[i]?.value;
    const e50 = ema50[i]?.value;

    // --- STRATEGY 1: BB + EMA 50 ---
    if (bLow && bUp && e50) {
      // Bullish: Price touches/crosses lower BB AND close is above EMA 50
      if (candle.low <= bLow && candle.close > e50) {
        stats.bbAndEma50.bullish.signals++;
        if (futureCandle.close > candle.close) stats.bbAndEma50.bullish.success++;
      }
      // Bearish: Price touches/crosses upper BB AND close is below EMA 50
      else if (candle.high >= bUp && candle.close < e50) {
        stats.bbAndEma50.bearish.signals++;
        if (futureCandle.close < candle.close) stats.bbAndEma50.bearish.success++;
      }
    }

    // --- STRATEGY 2: Ichimoku + EMA 20 ---
    if (cloudTop && cloudBottom && e20) {
      // Bullish: Price close is above cloud Top AND price close is above EMA 20
      if (candle.close > cloudTop && candle.close > e20) {
        stats.ichiAndEma20.bullish.signals++;
        if (futureCandle.close > candle.close) stats.ichiAndEma20.bullish.success++;
      }
      // Bearish: Price close is below cloud Bottom AND price close is below EMA 20
      else if (candle.close < cloudBottom && candle.close < e20) {
        stats.ichiAndEma20.bearish.signals++;
        if (futureCandle.close < candle.close) stats.ichiAndEma20.bearish.success++;
      }
    }
  }

  const calcRate = (obj) => ({
    ...obj,
    rate: obj.signals > 0 ? (obj.success / obj.signals) * 100 : 0
  });

  return {
    bbAndEma50: { bullish: calcRate(stats.bbAndEma50.bullish), bearish: calcRate(stats.bbAndEma50.bearish) },
    ichiAndEma20: { bullish: calcRate(stats.ichiAndEma20.bullish), bearish: calcRate(stats.ichiAndEma20.bearish) },
    checkPeriod: checkCandlesAhead
  };
}
