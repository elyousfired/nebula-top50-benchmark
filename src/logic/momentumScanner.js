import { fetchBybitData, fetchBinanceData, calculateEMA } from './scanner.js';

const TIMEFRAME_WEIGHTS = {
  "D": 0.40,
  "240": 0.30,
  "60": 0.20,
  "15": 0.10,
};

// Internal Cache for Base Assets (SOL, BTC) candles — stores Promises to avoid race conditions
const baseAssetCache = {};

export const fetchBaseAssetCandles = (baseAsset, tf, exchange = 'bybit') => {
  if (!baseAssetCache[baseAsset]) {
    baseAssetCache[baseAsset] = { bybit: new Map(), binance: new Map() };
  }
  
  if (baseAssetCache[baseAsset][exchange].has(tf)) return baseAssetCache[baseAsset][exchange].get(tf);

  const fetchPromise = exchange === 'binance'
    ? fetchBinanceData(baseAsset, tf, 1000)
    : fetchBybitData(baseAsset, tf, 1000);

  const promise = fetchPromise.then(data => {
    if (!data || data.length === 0) return new Map(); // Return empty map on failure

    const parsed = [...data].reverse().map(k => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      turnover: Number(k[6] || 0)
    }));

    const mapped = new Map();
    parsed.forEach(c => mapped.set(c.time, c));
    return mapped;
  }).catch(() => new Map()); // On network error, return empty map

  baseAssetCache[baseAsset][exchange].set(tf, promise);
  return promise;
};


// 1. Build Synthetic Candles
export const buildSyntheticCandles = (tokenCandles, solMap) => {
  const synthetic = [];
  
  for (const tc of tokenCandles) {
    const sc = solMap.get(tc.time);
    if (!sc) continue; // Must be perfectly aligned

    let syntheticOpen = tc.open / (sc.open || 1);
    let syntheticClose = tc.close / (sc.close || 1);
    // Cross-division for realistic extremes: Token High / SOL Low gives max possible ratio
    let syntheticHigh = tc.high / (sc.low || 1);
    let syntheticLow = tc.low / (sc.high || 1);

    // Validation
    syntheticHigh = Math.max(syntheticHigh, syntheticOpen, syntheticClose);
    syntheticLow = Math.min(syntheticLow, syntheticOpen, syntheticClose);

    // Volume calculation
    const tokenTurnoverUsdt = tc.turnover > 0 ? tc.turnover : tc.volume * tc.close;
    const syntheticVolumeSol = tokenTurnoverUsdt / (sc.close || 1);

    synthetic.push({
      time: tc.time,
      open: syntheticOpen,
      high: syntheticHigh,
      low: syntheticLow,
      close: syntheticClose,
      volume: syntheticVolumeSol
    });
  }
  
  // Ensure chronologically sorted and valid
  return synthetic.filter(c => !isNaN(c.close) && isFinite(c.close)).sort((a, b) => a.time - b.time);
};

// RSI Calculation
const calculateRSI = (data, period = 14) => {
  if (data.length <= period) return data.map(() => 50);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  const rsi = new Array(period).fill(50);
  if (avgLoss === 0) rsi.push(100);
  else {
    let rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      let rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  return rsi;
};

export function detectPivots(candles, window = 3) {
  const pivots = [];
  if (candles.length < window * 2 + 1) return pivots;

  for (let i = window; i < candles.length - window; i++) {
    const current = candles[i];
    let isPivotHigh = true;
    let isPivotLow = true;

    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (candles[j].high >= current.high) isPivotHigh = false;
      if (candles[j].low <= current.low) isPivotLow = false;
    }

    if (isPivotHigh) {
      pivots.push({ type: "H", index: i, time: current.time, value: current.high });
    }
    if (isPivotLow) {
      pivots.push({ type: "L", index: i, time: current.time, value: current.low });
    }
  }
  return pivots.sort((a, b) => a.index - b.index);
}

export function analyzeMarketStructure(candles, options = {}) {
  const pivotWindow = options.pivotWindow ?? 3;
  const structureLookbackCandles = options.structureLookbackCandles ?? 50;
  const breakBufferPct = options.breakBufferPct ?? 0.003;

  const emptyResult = {
    score: 0,
    recentHH: false,
    recentHL: false,
    structureBullish: false,
    structureBearish: false,
    state: "INSUFFICIENT_DATA",
    lastHigh: null,
    previousHigh: null,
    lastLow: null,
    previousLow: null,
    pivots: [],
    reason: "Insufficient data to confirm market structure.",
  };

  if (!candles || candles.length < pivotWindow * 2 + 10) return emptyResult;

  const pivots = detectPivots(candles, pivotWindow);
  const highPivots = pivots.filter(p => p.type === "H");
  const lowPivots = pivots.filter(p => p.type === "L");

  const lastHigh = highPivots.at(-1) ?? null;
  const previousHigh = highPivots.at(-2) ?? null;
  const lastLow = lowPivots.at(-1) ?? null;
  const previousLow = lowPivots.at(-2) ?? null;

  if (!lastHigh || !previousHigh || !lastLow || !previousLow) {
    return { ...emptyResult, pivots, lastHigh, previousHigh, lastLow, previousLow, reason: "Not enough confirmed pivots to classify HH/HL structure." };
  }

  const minRecentIndex = candles.length - structureLookbackCandles;
  const lastHighIsRecent = lastHigh.index >= minRecentIndex;
  const lastLowIsRecent = lastLow.index >= minRecentIndex;

  const recentHH = lastHighIsRecent && lastHigh.value > previousHigh.value;
  const recentHL = lastLowIsRecent && lastLow.value > previousLow.value;

  let score = 0;
  if (recentHH) score += 5;
  if (recentHL) score += 10;

  const structureBullish = recentHH && recentHL;
  const current = candles.at(-1);
  const structureBearish = structureBullish && current.close < lastLow.value * (1 - breakBufferPct);

  if (structureBearish) {
    score = Math.max(0, score - 15);
  }

  let state = "NEUTRAL";
  if (structureBearish) state = "BEARISH";
  else if (structureBullish) state = "BULLISH";
  else if (recentHL && !recentHH) state = "EARLY_BULLISH";
  else if (lastHigh.value < previousHigh.value && lastLow.value < previousLow.value) state = "BEARISH";
  else state = "NEUTRAL";

  let reason = "";
  if (state === "BULLISH") reason = "Market structure is bullish: the latest confirmed pivot high is above the previous pivot high, and the latest confirmed pivot low is above the previous pivot low.";
  else if (state === "EARLY_BULLISH") reason = "Market structure is early bullish: the latest confirmed pivot low is higher than the previous pivot low, but a new confirmed higher high is not yet present.";
  else if (state === "BEARISH") reason = "Market structure is bearish or has broken down: the current close invalidated the latest confirmed higher low or the latest pivots show weakening structure.";
  else reason = "Market structure is neutral: recent confirmed pivots do not yet show a clear HH/HL bullish structure.";

  return {
    score, recentHH, recentHL, structureBullish, structureBearish,
    state, lastHigh, previousHigh, lastLow, previousLow, pivots, reason
  };
}

// 2. Score Calculation Per Timeframe
export const calculateTimeframeMomentum = (candles) => {
  if (candles.length < 50) return { score: 0, state: 'INSUFFICIENT_DATA', invalid: true };

  const N = candles.length;
  const current = candles[N - 1];
  const closes = candles.map(c => c.close);
  
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const rsiArray = calculateRSI(closes, 14);
  
  const curEma20 = ema20[N - 1];
  const prevEma20 = ema20[N - 2];
  const curEma50 = ema50[N - 1];
  const curRsi = rsiArray[N - 1];
  const prevRsi = rsiArray[N - 2];

  let score = 0;

  // A. Relative Returns (20 pts)
  const ret1 = N > 1 ? (closes[N - 1] / closes[N - 2] - 1) * 100 : 0;
  const ret3 = N > 3 ? (closes[N - 1] / closes[N - 4] - 1) * 100 : 0;
  const ret5 = N > 5 ? (closes[N - 1] / closes[N - 6] - 1) * 100 : 0;
  const ret10 = N > 10 ? (closes[N - 1] / closes[N - 11] - 1) * 100 : 0;

  if (ret1 > 0) score += 5;
  if (ret3 > 0) score += 5;
  if (ret5 > 0) score += 5;
  if (ret10 > 0) score += 5;

  // B. Acceleration (5 pts)
  if (ret3 > ret5 / (5/3) && ret1 > ret3 / 3) score += 5;

  // C. Positive Streak (15 pts)
  let posCloseStreak = 0;
  for (let i = N - 1; i > 0; i--) {
    if (candles[i].close > candles[i - 1].close) posCloseStreak++;
    else break;
  }
  
  let hlStreak = 0;
  for (let i = N - 1; i > 0; i--) {
    if (candles[i].low > candles[i - 1].low) hlStreak++;
    else break;
  }
  
  let bullishCandleStreak = 0;
  for (let i = N - 1; i >= 0; i--) {
    if (candles[i].close > candles[i].open) bullishCandleStreak++;
    else break;
  }

  if (posCloseStreak >= 2) score += 5;
  if (bullishCandleStreak >= 2) score += 5;
  if (hlStreak >= 2) score += 5;

  // D. EMA Structure (15 pts)
  if (current.close > curEma20) score += 5;
  if (curEma20 > curEma50) score += 5;
  if (curEma20 > prevEma20) score += 5;

  // E. RSI Momentum (10 pts)
  if (curRsi > 50) score += 5;
  if (curRsi > prevRsi && curRsi < 75) score += 5;

  // F. Volume Confirmation (10 pts)
  const volWindow = 20;
  let avgVol = 0;
  for (let i = N - 1 - volWindow; i < N - 1; i++) {
    if (i >= 0) avgVol += candles[i].volume;
  }
  avgVol /= volWindow;
  
  const volRatio = avgVol > 0 ? current.volume / avgVol : 1;
  if (volRatio > 1.2) score += 5;
  if (volRatio > 1.8) score += 5;

  // G. Candle Strength (5 pts)
  const range = current.high - current.low;
  const body = Math.abs(current.close - current.open);
  const bodyPct = range > 0 ? body / range : 0;
  const closePos = range > 0 ? (current.close - current.low) / range : 0.5;

  if (current.close > current.open && bodyPct > 0.6 && closePos > 0.75) score += 5;

  // H. Structure (15 pts)
  const structure = analyzeMarketStructure(candles);
  score += structure.score;
  const structureBullish = structure.structureBullish;
  const structureBearish = structure.structureBearish;
  const lastHighValue = structure.lastHigh ? structure.lastHigh.value : 0;

  // I. Context & Penalties
  let contextScore = 5;
  if (current.close > curEma20 * 1.15) {
    score -= 8;
    contextScore = 0;
  }
  if (ret3 > 0 && volRatio < 0.8) score -= 8;
  if (closePos < 0.3 && bodyPct < 0.4 && current.high > current.open) score -= 7;
  if (lastHighValue > 0 && current.high > lastHighValue && curRsi < prevRsi - 5) score -= 10;
  if (structureBearish) score -= 15;

  score += contextScore;
  score = Math.max(0, Math.min(100, score));

  let state = "NEUTRAL";
  if (score >= 80 && structureBullish && volRatio > 1.2 && structure.state !== "BEARISH") state = "STRONG";
  else if (score >= 65) state = "BUILDING";
  else if (score >= 50 && curEma20 > prevEma20) state = "EARLY";
  else if (score >= 40) state = "NEUTRAL";
  else if (score >= 25) state = "FADING";
  else state = "BEARISH";

  let streakDuration = { candles: 0, startedAt: null, durationMs: 0, returnSinceStartPct: 0 };
  if (posCloseStreak > 0) {
    const startIdx = N - 1 - posCloseStreak;
    streakDuration.candles = posCloseStreak;
    streakDuration.startedAt = candles[startIdx].time * 1000;
    streakDuration.durationMs = Date.now() - streakDuration.startedAt;
    streakDuration.returnSinceStartPct = ((current.close / candles[startIdx].close) - 1) * 100;
  }

  return {
    score, state, rsi: curRsi, volRatio, ema20: curEma20, ema50: curEma50,
    structureBullish, structureBearish, structure, streakDuration,
    candles, returns: { ret1, ret3, ret5, ret10 }
  };
};

const computeGlobalLevels = (dailyCandles) => {
  if (!dailyCandles || dailyCandles.length < 2) return null;
  
  const completedDaily = dailyCandles.slice(0, -1);
  const lastCompletedDay = completedDaily[completedDaily.length - 1];
  const PDH = lastCompletedDay.high;
  const PVWAP_D = (lastCompletedDay.high + lastCompletedDay.low + lastCompletedDay.close) / 3;

  const getWeekKey = (date) => {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getMonthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

  const weeks = {};
  const months = {};

  completedDaily.forEach(c => {
    const d = new Date(c.time * 1000);
    const wKey = getWeekKey(d);
    const mKey = getMonthKey(d);

    if (!weeks[wKey]) weeks[wKey] = { high: -Infinity, sumVwap: 0, sumVol: 0 };
    if (!months[mKey]) months[mKey] = { high: -Infinity, sumVwap: 0, sumVol: 0 };

    const hlc3 = (c.high + c.low + c.close) / 3;
    const vol = c.volume;

    weeks[wKey].high = Math.max(weeks[wKey].high, c.high);
    weeks[wKey].sumVwap += hlc3 * vol;
    weeks[wKey].sumVol += vol;

    months[mKey].high = Math.max(months[mKey].high, c.high);
    months[mKey].sumVwap += hlc3 * vol;
    months[mKey].sumVol += vol;
  });

  const weekKeys = Object.keys(weeks).sort();
  const monthKeys = Object.keys(months).sort();

  const today = new Date(dailyCandles[dailyCandles.length - 1].time * 1000);
  const currentWeekKey = getWeekKey(today);
  const currentMonthKey = getMonthKey(today);

  const prevWeekKeys = weekKeys.filter(k => k !== currentWeekKey);
  const prevMonthKeys = monthKeys.filter(k => k !== currentMonthKey);

  const lastWeek = prevWeekKeys.length > 0 ? weeks[prevWeekKeys[prevWeekKeys.length - 1]] : null;
  const lastMonth = prevMonthKeys.length > 0 ? months[prevMonthKeys[prevMonthKeys.length - 1]] : null;

  return {
    PDH,
    PWH: lastWeek ? lastWeek.high : null,
    PMH: lastMonth ? lastMonth.high : null,
    PVWAP_D,
    PVWAP_W: lastWeek ? (lastWeek.sumVol > 0 ? lastWeek.sumVwap / lastWeek.sumVol : 0) : null,
    PVWAP_M: lastMonth ? (lastMonth.sumVol > 0 ? lastMonth.sumVwap / lastMonth.sumVol : 0) : null,
  };
};

export const fetchMomentumData = async (symbol, exchange = 'bybit', baseAsset = 'SOLUSDT') => {
  const tfs = ['15', '60', '240', 'D'];

  // Fetch Base Asset caches and token klines ALL in parallel
  const fetchSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;

  const [baseMaps, klinesArr] = await Promise.all([
    baseAsset === 'USDT' 
      ? Promise.resolve(tfs.map(() => new Map()))
      : Promise.all(tfs.map(tf => fetchBaseAssetCandles(baseAsset, tf, exchange))),
    Promise.all(tfs.map(tf => exchange === 'binance' ? fetchBinanceData(fetchSymbol, tf, 200) : fetchBybitData(fetchSymbol, tf, 200)))
  ]);

  const results = {};

  for (let i = 0; i < tfs.length; i++) {
    const tf = tfs[i];
    const baseMap = baseMaps[i];
    const klines = klinesArr[i];

    if (baseAsset !== 'USDT' && (!baseMap || baseMap.size === 0)) {
      results[tf] = { score: 0, state: 'INSUFFICIENT_DATA', invalid: true };
      continue;
    }

    if (!klines || klines.length < 50) {
      results[tf] = { score: 0, state: 'INSUFFICIENT_DATA', invalid: true };
      continue;
    }

    const parsed = [...klines].reverse().map(k => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      turnover: Number(k[6] || 0)
    }));

    const synthetic = baseAsset === 'USDT' ? parsed : buildSyntheticCandles(parsed, baseMap);
    results[tf] = calculateTimeframeMomentum(synthetic);
  }

  const dailyCandles = results['D']?.candles;
  if (dailyCandles && dailyCandles.length > 1) {
    results.globalLevels = computeGlobalLevels(dailyCandles);
  }

  return results;
};


export const analyzeMomentumProfile = (tfs) => {
  const score1d = tfs['D']?.score || 0;
  const score4h = tfs['240']?.score || 0;
  const score1h = tfs['60']?.score || 0;
  const score15m = tfs['15']?.score || 0;

  const overallScore = Math.floor(
    score1d * TIMEFRAME_WEIGHTS['D'] +
    score4h * TIMEFRAME_WEIGHTS['240'] +
    score1h * TIMEFRAME_WEIGHTS['60'] +
    score15m * TIMEFRAME_WEIGHTS['15']
  );

  let alignment = "MIXED";
  if (score1d >= 65 && score4h >= 65 && score1h >= 65) alignment = "STRONG_BULLISH";
  else if (score4h >= 50 && score1h >= 65 && score15m < 50) alignment = "BULLISH"; 
  else if (score1d < 40 && score4h < 40 && score15m >= 65) alignment = "WEAKENING"; 
  else if (score1d < 40 && score4h < 40) alignment = "BEARISH";

  let action = "NO_ACTION";
  let reason = "";

  if (overallScore >= 65 && score4h >= 50 && score1h >= 50) {
    if (tfs['240']?.rsi > 70 || tfs['D']?.rsi > 70) {
      action = "WAIT_FOR_PULLBACK";
      reason = "Strong momentum across 1H and 4H against SOL, but RSI indicates overextension. Wait for pullback.";
    } else {
      action = "WATCH_FOR_ENTRY";
      reason = "Consistent outperformance vs SOL on 1H/4H. Structure is bullish. Prime setup.";
    }
  } else if (overallScore >= 50 && tfs['240']?.structureBullish) {
    action = "ZONE_A_CONFIRMED";
    reason = "Token broke out structurally against SOL and maintains support.";
  } else if (score1h >= 50 && score15m >= 60 && score4h < 50) {
    action = "ZONE_B_EARLY";
    reason = "Early relative recovery on lower timeframes. 4H trend has not flipped yet.";
  } else if (score1d < 40 && score4h < 40) {
    action = "AVOID";
    reason = "Bearish macro structure relative to SOL. Rapid momentum fading.";
  } else if (score15m < 30 && score1h < 40 && overallScore >= 60) {
    action = "TAKE_PROFIT_WARNING";
    reason = "Higher timeframes are strong, but short-term momentum is breaking down heavily.";
  }

  const isBearishState = tfs['240']?.structure?.state === "BEARISH";
  if (isBearishState && ["WATCH_FOR_ENTRY", "ZONE_A_CONFIRMED"].includes(action)) {
    action = "AVOID";
    reason = tfs['240']?.structure?.reason || "Structure has broken down.";
  }

  return { overallScore, alignment, action, reason };
};
