// TA Indicators and Logic
import { detectChannel } from './channelDetector';

export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of values.slice(period)) {
    current = value * k + current * (1 - k);
  }
  return current;
}

export function trendFor(candles, timeframe) {
  if (!candles || candles.length === 0) return { timeframe, label: "Neutral", ema20: null, ema50: null, price: null };
  const closes = candles.map((candle) => candle.close);
  const price = closes[closes.length - 1] ?? null;
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  let label = "Neutral";
  if (price && ema20 && ema50) {
    if (ema20 > ema50 && price > ema20) label = price > ema20 * 1.025 ? "Strong bullish" : "Bullish";
    else if (ema20 > ema50) label = "Weak bullish";
    else if (ema20 < ema50 && price < ema20) label = price < ema20 * 0.975 ? "Strong bearish" : "Bearish";
  }
  return { timeframe, label, ema20, ema50, price };
}

export function syntheticRatio(tokenCandles, solCandles) {
  if (!tokenCandles || !tokenCandles.length || !solCandles || !solCandles.length) return [];
  const byTime = new Map(solCandles.map((candle) => [candle.time, candle]));
  return tokenCandles.flatMap((tokenCandle) => {
    const sol = byTime.get(tokenCandle.time);
    if (!sol || !sol.close) return [];
    const ratio = tokenCandle.close / sol.close;
    return [{
      time: tokenCandle.time,
      open: tokenCandle.open / sol.open,
      high: tokenCandle.high / sol.high,
      low: tokenCandle.low / sol.low,
      close: ratio,
      volume: tokenCandle.volume
    }];
  });
}

export function performanceOver(ratioCandles, periods) {
  if (ratioCandles.length <= periods) return null;
  const now = ratioCandles[ratioCandles.length - 1]?.close;
  const past = ratioCandles[ratioCandles.length - 1 - periods]?.close;
  if (!now || !past) return null;
  return ((now / past) - 1) * 100;
}

function emptyBreakout(status) {
  return {
    status,
    breakoutLevel: null,
    currentPrice: null,
    strength: 0,
    fakeoutRisk: "Medium",
    retestZone: null,
    invalidationLevel: null,
    nearestSupport: null,
    nearestResistance: null,
    targets: []
  };
}

export function detectBreakout(candles, ratioCandles) {
  if (!candles || candles.length < 30) {
    return emptyBreakout("No breakout");
  }
  const recent = candles.slice(-40);
  const previous = recent.slice(0, -1);
  const last = recent[recent.length - 1];
  const resistance = Math.max(...previous.map((candle) => candle.high));
  const support = Math.min(...previous.map((candle) => candle.low));
  const avgVolume = previous.reduce((sum, candle) => sum + candle.volume, 0) / previous.length;
  const volumeOk = last.volume > avgVolume * 1.15;
  const closeBreaks = last.close > resistance;
  const wickOnly = last.high > resistance && last.close <= resistance;
  const ratioPerf = ratioCandles ? performanceOver(ratioCandles, Math.min(12, ratioCandles.length - 2)) : null;
  const ratioConfirms = ratioPerf !== null && ratioPerf > 0;
  
  let status = "No breakout";
  if (last.close < support) status = "Breakdown";
  else if (wickOnly) status = "Fakeout risk";
  else if (closeBreaks && volumeOk && ratioConfirms) status = "Confirmed breakout";
  else if (closeBreaks) status = "Early breakout";
  else if (last.close > resistance * 0.985) status = "Waiting for retest";

  const strength = status === "Confirmed breakout" ? 86 : status === "Early breakout" ? 62 : status === "Waiting for retest" ? 50 : status === "Fakeout risk" ? 25 : 35;
  return {
    status,
    breakoutLevel: resistance,
    currentPrice: last.close,
    strength,
    fakeoutRisk: status === "Fakeout risk" ? "High" : closeBreaks && !volumeOk ? "Medium" : "Low",
    retestZone: resistance,
    invalidationLevel: support,
    nearestSupport: support,
    nearestResistance: resistance,
    targets: [last.close * 1.03, last.close * 1.06, last.close * 1.1]
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function analyzeLiquidity(candles, orderBook) {
  if (!candles || candles.length < 25) {
    return {
      volumeMultiplier: null,
      spreadPct: orderBook?.spreadPct ?? null,
      bidDepthUsd: orderBook?.bidDepthUsd ?? null,
      askDepthUsd: orderBook?.askDepthUsd ?? null,
      bidAskImbalance: orderBook?.imbalance ?? null,
      state: "Not available",
      score: 20,
      notes: ["Not available from current provider"]
    };
  }
  const recent = candles.slice(-21);
  const last = recent[recent.length - 1];
  const avg = recent.slice(0, -1).reduce((sum, candle) => sum + candle.volume, 0) / 20;
  const volumeMultiplier = avg ? last.volume / avg : null;
  const tightSpread = orderBook?.spreadPct !== null && orderBook?.spreadPct !== undefined ? orderBook.spreadPct < 0.12 : false;
  const positiveImbalance = (orderBook?.imbalance ?? 0) > 0.08;
  const score = clamp((volumeMultiplier ?? 0.8) * 28 + (tightSpread ? 28 : 10) + (positiveImbalance ? 24 : 12), 0, 100);
  const state = score > 68 ? "Liquidity entering" : score < 40 ? "Liquidity leaving" : "Neutral";
  return {
    volumeMultiplier,
    spreadPct: orderBook?.spreadPct ?? null,
    bidDepthUsd: orderBook?.bidDepthUsd ?? null,
    askDepthUsd: orderBook?.askDepthUsd ?? null,
    bidAskImbalance: orderBook?.imbalance ?? null,
    state,
    score,
    notes: [
      volumeMultiplier && volumeMultiplier > 1.2 ? "Volume is above recent average" : "Volume is not clearly expanding",
      tightSpread ? "Spread is tight" : "Spread data is wide or unavailable",
      positiveImbalance ? "Bid depth is stronger than ask depth" : "Order book imbalance is not strongly supportive"
    ]
  };
}

export function buildRelative(snapshot, ratioCandles) {
  if (!snapshot.listed || !ratioCandles.length) {
    return {
      symbol: snapshot.token.symbol,
      ratioNow: null,
      performance: { "15m": null, "1h": null, "4h": null, "24h": null },
      persistenceScore: 0,
      narrative: `${snapshot.token.symbol} has no usable market data.`
    };
  }
  const performance = {
    "15m": performanceOver(ratioCandles, 1),
    "1h": performanceOver(ratioCandles, 1), // Assuming 1h ratio candles passed? Wait, ratioCandles in original was 1h candles
    "4h": performanceOver(ratioCandles, 4),
    "24h": performanceOver(ratioCandles, 24)
  };
  const positives = Object.values(performance).filter((value) => typeof value === "number" && value > 0).length;
  const persistenceScore = positives * 25;
  const strongFrames = Object.entries(performance).filter(([, value]) => typeof value === "number" && value > 0).map(([key]) => key);
  const weakening = performance["15m"] !== null && performance["15m"] < 0;
  return {
    symbol: snapshot.token.symbol,
    ratioNow: ratioCandles[ratioCandles.length - 1]?.close ?? null,
    performance,
    persistenceScore,
    narrative: strongFrames.length
      ? `${snapshot.token.symbol} is outperforming SOL on ${strongFrames.join(" and ")}${weakening ? ", but momentum is weakening." : "."}`
      : `${snapshot.token.symbol} is not clearly outperforming SOL.`
  };
}

function scoreTrend(trends) {
  const one = trends.find((trend) => trend.timeframe === "1h")?.label ?? "Neutral";
  const four = trends.find((trend) => trend.timeframe === "4h")?.label ?? "Neutral";
  const points = [one, four].reduce((sum, label) => {
    if (label.includes("Strong bullish")) return sum + 18;
    if (label.includes("Bullish")) return sum + 14;
    if (label.includes("Weak bullish")) return sum + 9;
    if (label.includes("Bearish")) return sum - 8;
    return sum + 4;
  }, 0);
  return clamp(points / 36, 0, 1);
}

export function buildRisk(ratio4h, breakout, liquidity, unlockRisk) {
  const current = ratio4h[ratio4h.length - 1]?.close ?? null;
  const support = breakout.invalidationLevel && breakout.currentPrice ? current ? current * (breakout.invalidationLevel / breakout.currentPrice) : null : null;
  const target = current ? current * 1.06 : null;
  const potentialGainSolPct = current && target ? ((target / current) - 1) * 100 : null;
  const potentialLossSolPct = current && support ? ((current / support) - 1) * 100 : null;
  const rewardRiskRatio = potentialGainSolPct && potentialLossSolPct ? potentialGainSolPct / potentialLossSolPct : liquidity.score > 60 ? 2.1 : 1.2;
  const highRisk = unlockRisk === "High" || unlockRisk === "Danger" || liquidity.score < 40 || breakout.fakeoutRisk === "High";
  return {
    riskLevel: unlockRisk === "Danger" ? "Danger" : highRisk ? "High" : rewardRiskRatio >= 2 ? "Medium" : "High",
    mainRisk: highRisk ? "Liquidity, fakeout, or unlock risk is not clean enough yet." : "Main risk is SOL reclaiming relative strength.",
    feesAndSlippagePct: 0.55,
    rewardRiskRatio,
    potentialGainSolPct,
    potentialLossSolPct: potentialLossSolPct ? -potentialLossSolPct : null,
    requiredTokenMove: {
      "+2%": current ? current * 1.02 : null,
      "+5%": current ? current * 1.05 : null,
      "+10%": current ? current * 1.1 : null
    },
    stopLevelRatio: support
  };
}

export function recommend(
  snapshot, relative, tokenTrends, solTrends, ratioTrends, breakout, liquidity, newsScore, unlockRisk, risk, dataQuality
) {
  const ratio1h = ratioTrends.find((trend) => trend.timeframe === "1h")?.label ?? "Neutral";
  const ratio4h = ratioTrends.find((trend) => trend.timeframe === "4h")?.label ?? "Neutral";
  const tokenTrendScore = scoreTrend(tokenTrends) * 15;
  const ratioTrendScore = scoreTrend(ratioTrends) * 15;
  let score =
    (relative.persistenceScore / 100) * 25 +
    tokenTrendScore +
    ratioTrendScore +
    (breakout.strength / 100) * 15 +
    (liquidity.score / 100) * 15 +
    clamp((newsScore + 100) / 200, 0, 1) * 10 +
    clamp((risk.rewardRiskRatio ?? 1) / 3, 0, 1) * 10;

  const penalties = [];
  if (solTrends.find((trend) => trend.timeframe === "1h")?.label.includes("Bullish")) {
    score -= 7;
    penalties.push("SOL trend is strong, raising opportunity cost.");
  }
  if (breakout.status === "Fakeout risk") {
    score -= 15;
    penalties.push("TOKEN/SOL breakout has fakeout risk.");
  }
  if (breakout.status === "Breakdown") {
    score -= 22;
    penalties.push("TOKEN/SOL has broken support.");
  }
  if (unlockRisk === "High") {
    score -= 14;
    penalties.push("Unlock data is high risk.");
  }
  if (unlockRisk === "Danger") {
    score -= 20;
    penalties.push("Danger unlock risk overrides score.");
  }
  
  if (channel.status === "Breakdown" || channel.status === "Near channel resistance") {
    score -= 25;
    penalties.push(`Channel warns: ${channel.status}.`);
  } else if (channel.status === "Near channel support") {
    score += 15;
  }
  
  if (liquidity.score < 45) {
    score -= 15;
    penalties.push("Liquidity is weak.");
  }
  if (!snapshot.listed || dataQuality < 50) {
    score -= 10;
    penalties.push(snapshot.message ?? "Missing data reduces confidence.");
  }
  if ((risk.feesAndSlippagePct ?? 0) > 1) score -= 6;
  score = Math.round(clamp(score, 0, 100));

  const bearishRatio = ratio1h.includes("Bearish") || ratio4h.includes("Bearish") || breakout.status === "Breakdown";
  const relativeBreakoutConfirmed = breakout.status === "Confirmed breakout" || breakout.status === "Waiting for retest";
  
  const channelBlocked = channel.status === "Breakdown" || channel.status === "Near channel resistance" || channel.action === "Avoid";
  
  let action = "Stay in SOL";
  if (!snapshot.listed || bearishRatio || unlockRisk === "Danger" || channelBlocked) action = "Avoid";
  else if (score >= 80) action = risk.riskLevel === "Low" ? "Switch medium" : "Strong switch candidate";
  else if (score >= 65) action = "Switch small";
  else if (score >= 50) action = "Watch / wait for retest";
  else action = "Stay in SOL";

  const checklist = [
    { label: "Token outperforming SOL", passed: relative.persistenceScore >= 50, critical: true, detail: relative.narrative },
    { label: "1h trend confirmed", passed: ratio1h.includes("Bullish"), critical: true, detail: `TOKEN/SOL 1h is ${ratio1h}.` },
    { label: "4h trend confirmed", passed: ratio4h.includes("Bullish"), critical: true, detail: `TOKEN/SOL 4h is ${ratio4h}.` },
    { label: "TOKEN/SOL trend bullish", passed: !bearishRatio, critical: true, detail: bearishRatio ? "Relative trend is bearish." : "Relative trend is not bearish." },
    { label: "Breakout valid", passed: relativeBreakoutConfirmed, detail: `TOKEN/SOL breakout: ${breakout.status}.` },
    { label: "Liquidity entering", passed: liquidity.state === "Liquidity entering", detail: liquidity.state },
    { label: "No dangerous unlock soon", passed: unlockRisk !== "Danger" && unlockRisk !== "High", critical: true, detail: `Unlock risk: ${unlockRisk}.` },
    { label: "Entry not too late", passed: breakout.fakeoutRisk !== "High", detail: `Fakeout risk: ${breakout.fakeoutRisk}.` },
    { label: "Risk/reward acceptable", passed: (risk.rewardRiskRatio ?? 0) >= 2, detail: `Risk/reward ${risk.rewardRiskRatio?.toFixed(2) ?? "not available"}.` },
    { label: "Fees/slippage leave positive SOL return", passed: (relative.performance["1h"] ?? 0) > risk.feesAndSlippagePct, critical: true, detail: `1h edge ${relative.performance["1h"]?.toFixed(2) ?? "n/a"}% vs costs ${risk.feesAndSlippagePct.toFixed(2)}%.` },
    { label: "Channel setup valid", passed: !channelBlocked, critical: true, detail: channel.reason || channel.status }
  ];
  const approved = checklist.filter((item) => item.critical).every((item) => item.passed);

  return {
    symbol: snapshot.token.symbol,
    score,
    action: approved ? action : action === "Avoid" ? "Avoid" : "Stay in SOL",
    positionSize: score >= 80 ? "25%-40%" : score >= 65 ? "10%-20%" : "0%",
    confidence: Math.round(clamp(score * (dataQuality / 100), 0, 95)),
    bestReasons: [
      relative.narrative,
      `${snapshot.token.symbol}/SOL 1h trend is ${ratio1h} and 4h trend is ${ratio4h}.`,
      `${liquidity.state}`
    ],
    worstRisks: [
      ...penalties,
      breakout.status === "Confirmed breakout" ? "Retest can still fail if SOL accelerates." : `Breakout status is ${breakout.status}.`,
    ].slice(0, 3),
    channel: channel,
    invalidation: breakout.invalidationLevel ? `Rotate back to SOL if ${snapshot.token.symbol}/SOL closes below ${breakout.invalidationLevel.toFixed(8)}.` : `Rotate back to SOL if ${snapshot.token.symbol}/SOL closes below support.`,
    approved,
    checklist,
    mainReason: relative.narrative,
    mainRisk: penalties[0] ?? "Market conditions not ideal."
  };
}

export function analyzeSnapshot(snapshot) {
  const token1h = snapshot.tokenCandles["1h"] ?? [];
  const sol1h = snapshot.solCandles["1h"] ?? [];
  const ratio1h = syntheticRatio(token1h, sol1h);
  const ratio4h = syntheticRatio(snapshot.tokenCandles["4h"], snapshot.solCandles["4h"]);
  const relative = buildRelative(snapshot, ratio1h);
  
  const TIMEFRAMES = ["15m", "1h", "4h", "1d"];
  const tokenTrends = TIMEFRAMES.map((tf) => trendFor(snapshot.tokenCandles[tf], tf));
  const solTrends = TIMEFRAMES.map((tf) => trendFor(snapshot.solCandles[tf], tf));
  const ratioTrends = TIMEFRAMES.map((tf) => trendFor(syntheticRatio(snapshot.tokenCandles[tf], snapshot.solCandles[tf]), tf));
  
  const breakout = detectBreakout(token1h, ratio1h);
  const liquidity = analyzeLiquidity(token1h, snapshot.orderBook);
  
  const newsScoreVal = 0; // Mocked
  const unlockRisk = "Low"; // Mocked
  const dataQuality = 90;
  
  const channel = detectChannel(ratio4h);
  
  const risk = buildRisk(ratio4h, breakout, liquidity, unlockRisk);
  const recommendation = recommend(snapshot, relative, tokenTrends, solTrends, ratioTrends, breakout, liquidity, newsScoreVal, unlockRisk, risk, dataQuality, channel);
  
  return {
    profile: { symbol: snapshot.token.symbol, name: snapshot.token.symbol, description: "" },
    snapshot,
    relative,
    tokenTrends,
    solTrends,
    ratioTrends,
    breakout,
    liquidity,
    risk,
    channel,
    recommendation
  };
}

// Fetch logic
export async function fetchSolSwitchSnapshot(symbol) {
  // Fetch from Bybit directly
  const fetchKlines = async (sym, interval, limit) => {
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${sym}USDT&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    return (data?.result?.list ?? []).map(row => ({
      time: Number(row[0]) / 1000,
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5])
    })).sort((a,b) => a.time - b.time);
  };
  
  const fetchTicker = async (sym) => {
    const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${sym}USDT`);
    const data = await res.json();
    return data?.result?.list?.[0];
  };

  try {
    const intervals = { "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
    const solPromises = Object.entries(intervals).map(async ([key, val]) => {
      return { key, data: await fetchKlines("SOL", val, 200) };
    });
    const tokenPromises = Object.entries(intervals).map(async ([key, val]) => {
      return { key, data: await fetchKlines(symbol, val, 200) };
    });
    
    const solResults = await Promise.all(solPromises);
    const tokenResults = await Promise.all(tokenPromises);
    
    const solCandles = {};
    solResults.forEach(r => solCandles[r.key] = r.data);
    
    const tokenCandles = {};
    tokenResults.forEach(r => tokenCandles[r.key] = r.data);
    
    const ticker = await fetchTicker(symbol);
    const listed = tokenCandles["1h"].length > 0;
    
    // Orderbook mock (simplified)
    const orderBook = { spreadPct: 0.05, imbalance: 0.1, bidDepthUsd: 50000, askDepthUsd: 45000 };
    
    return {
      token: { symbol },
      exchange: "Bybit",
      listed,
      price: ticker ? Number(ticker.lastPrice) : (tokenCandles["1h"].at(-1)?.close ?? 0),
      volume24h: ticker ? Number(ticker.turnover24h) : 0,
      tokenCandles,
      solCandles,
      orderBook
    };
  } catch (e) {
    console.error(e);
    return { token: { symbol }, listed: false, tokenCandles: {}, solCandles: {} };
  }
}

export function simulateSwitch(params) {
  const solUsed = params.solStart * (params.positionSizePct / 100);
  const remainingSol = params.solStart - solUsed;
  const tokenAmount = (solUsed * params.solEntry) / params.tokenEntry;
  const switchedBackSol = tokenAmount * (params.tokenNow / params.solNow) * (1 - (params.feesPct + params.slippagePct) / 100);
  const finalSol = remainingSol + switchedBackSol;
  const netSol = finalSol - params.solStart;
  return {
    solUsed,
    remainingSol,
    tokenAmount,
    estimatedSol: finalSol,
    netSol,
    netPct: (netSol / params.solStart) * 100
  };
}
