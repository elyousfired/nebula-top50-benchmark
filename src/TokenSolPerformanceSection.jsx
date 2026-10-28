import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { fetchTop500Symbols } from './logic/scanner';
import tokenEntries from './data/token_entries.json';
import { DeltaSMomentumRadar } from './DeltaSMomentumRadar';
import { TokenRankTrajectoryChart } from './TokenRankTrajectoryChart';
import BtcSolBenchmarkHeader from './BtcSolBenchmarkHeader';
import LiquidityRotationNetwork from './LiquidityRotationNetwork';
import MultiHorizonTop5Matrix from './MultiHorizonTop5Matrix';
import MarketContextEngine from './MarketContextEngine';
import { Trophy, Search, RefreshCw, Zap, TrendingUp, Filter, BarChart3, Globe, Award, ArrowUpDown, ChevronLeft, ChevronRight, Scale, X, DollarSign, Calendar, Percent, Flame } from 'lucide-react';

async function fetchBybitKlines(symbol, interval = '15', limit = 1000) {
  const cleanBase = symbol.replace('USDT', '').toUpperCase();
  const formattedSymbol = `${cleanBase}USDT`;

  const nowMs = Date.now();
  const maxAgeMs = 36 * 3600 * 1000; // max 36 hours old to be considered LIVE

  // Query Bybit V5 Live API ONLY (Bybit Spot Real-Time Data)
  try {
    const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`);
    if (res.ok) {
      const json = await res.json();
      if (json.result?.list?.length) {
        const rawList = json.result.list.slice().reverse();
        const lastTs = parseInt(rawList[rawList.length - 1][0]);
        if (nowMs - lastTs < maxAgeMs) {
          return rawList;
        }
      }
    }
  } catch (_) {}

  return [];
}

// Calculate EXACT Multi-Timeframe Score
// W=3.0, D=2.5, 4H=2.0, 1H=1.5, 15m=1.0 (Max = 10 pts) + WeightedPerf
function computeExactMultiTfScore(tokenRatioData) {
  if (!tokenRatioData || tokenRatioData.length < 2) return 0;
  const getVal = (v) => (typeof v === 'object' && v !== null ? (v.close ?? v.value ?? 0) : v);

  const len = tokenRatioData.length;
  const curTokenRatio = getVal(tokenRatioData[len - 1]);

  const getPerf = (reqOff) => {
    if (len <= reqOff) return 0; // Guard against short history / listing spikes
    const prevIdx = len - 1 - reqOff;
    const prev = getVal(tokenRatioData[prevIdx]);
    if (!prev || prev <= 0) return 0;
    const rawPerf = ((curTokenRatio - prev) / prev) * 100;
    // Clamp extreme listing distortion to [-100%, +200%]
    return Math.min(200, Math.max(-100, rawPerf));
  };

  const p15m = getPerf(1);
  const p1h  = getPerf(4);
  const p4h  = getPerf(16);
  const p1d  = getPerf(96);
  const p1w  = getPerf(672);

  let confluencePts = 0;
  if (p1w  > 0) confluencePts += 3.0;
  if (p1d  > 0) confluencePts += 2.5;
  if (p4h  > 0) confluencePts += 2.0;
  if (p1h  > 0) confluencePts += 1.5;
  if (p15m > 0) confluencePts += 1.0;

  const weightedPerf = (p1w * 0.30) + (p1d * 0.25) + (p4h * 0.20) + (p1h * 0.15) + (p15m * 0.10);
  return confluencePts + weightedPerf;
}

// 🎯 MULTI-TIMEFRAME CROSS DETECTION ENGINE (15m, 1h, 4h across ALL Top 500 Tokens)
export function detectCrossesForTokens(tokensList) {
  if (!tokensList || tokensList.length === 0) return tokensList;

  const positiveTokens = tokensList.filter(t => t.score >= 0 && t.ratioSeries && t.ratioSeries.length > 20);
  if (positiveTokens.length === 0) return tokensList;

  const depth = 96; // 24h timeline of 15m candles
  const groupDeltaCurve = new Array(depth).fill(0);
  const tokenDeltasMap = {};

  positiveTokens.forEach(t => {
    const rSeries = t.ratioSeries;
    const len = rSeries.length;
    const startIdx = Math.max(0, len - depth);
    const startObj = rSeries[startIdx];
    const startRatio = typeof startObj === 'object' ? startObj.close : startObj;
    if (!startRatio || startRatio <= 0) return;

    const deltas = [];
    for (let i = startIdx; i < len; i++) {
      const item = rSeries[i];
      const val = typeof item === 'object' ? item.close : item;
      deltas.push(((val - startRatio) / startRatio) * 100);
    }
    tokenDeltasMap[t.cleanSymbol] = deltas;
  });

  for (let idx = 0; idx < depth; idx++) {
    let sum = 0;
    let count = 0;
    Object.values(tokenDeltasMap).forEach(deltas => {
      if (deltas[idx] !== undefined && !isNaN(deltas[idx])) {
        sum += deltas[idx];
        count++;
      }
    });
    groupDeltaCurve[idx] = count > 0 ? sum / count : 0;
  }

  return tokensList.map(token => {
    const rSeries = token.ratioSeries;
    if (!rSeries || rSeries.length < 20) return token;

    const len = rSeries.length;
    const startIdx = Math.max(0, len - depth);
    const startObj = rSeries[startIdx];
    const startRatio = typeof startObj === 'object' ? startObj.close : startObj;
    if (!startRatio || startRatio <= 0) return token;

    const tokDeltas = [];
    for (let i = startIdx; i < len; i++) {
      const item = rSeries[i];
      const val = typeof item === 'object' ? item.close : item;
      tokDeltas.push(((val - startRatio) / startRatio) * 100);
    }

    const curIdx = tokDeltas.length - 1;
    if (curIdx < 16) return token;

    const curTok   = tokDeltas[curIdx];
    const curGroup = groupDeltaCurve[curIdx] || 0;

    // STRICT MANDATORY RULE: A token MUST currently be ABOVE the group reference line (curTok > curGroup)!
    if (curTok <= curGroup) {
      return {
        ...token,
        crosses: { m15: false, h1: false, h4: false, isTriple: false, hasAny: false }
      };
    }

    // Check 15m Cross (within last 1-3 candles)
    let cross15m = false;
    for (let lookback = 1; lookback <= 3; lookback++) {
      const pIdx = curIdx - lookback;
      if (pIdx >= 0) {
        const prevTok   = tokDeltas[pIdx];
        const prevGroup = groupDeltaCurve[pIdx] || 0;
        if (prevTok <= prevGroup && curTok > curGroup) {
          cross15m = true;
          break;
        }
      }
    }

    // Check 1h Cross (4 candles back)
    let cross1h = false;
    const idx1h = curIdx - 4;
    if (idx1h >= 0) {
      const prevTok1h   = tokDeltas[idx1h];
      const prevGroup1h = groupDeltaCurve[idx1h] || 0;
      if (prevTok1h <= prevGroup1h && curTok > curGroup) {
        cross1h = true;
      }
    }

    // Check 4h Cross (16 candles back)
    let cross4h = false;
    const idx4h = curIdx - 16;
    if (idx4h >= 0) {
      const prevTok4h   = tokDeltas[idx4h];
      const prevGroup4h = groupDeltaCurve[idx4h] || 0;
      if (prevTok4h <= prevGroup4h && curTok > curGroup) {
        cross4h = true;
      }
    }

    const isTripleCross = cross15m && cross1h && cross4h;
    const hasAnyCross = cross15m || cross1h || cross4h;

    return {
      ...token,
      crosses: {
        m15: cross15m,
        h1: cross1h,
        h4: cross4h,
        isTriple: isTripleCross,
        hasAny: hasAnyCross,
      }
    };
  });
}

// Inline Quad Chart Component embedded directly inside the section (4 Synchronized Charts)
const InlineQuadCharts = ({ cleanSymbol, onClose, topTokensList = [] }) => {
  const [timeframe, setTimeframe] = useState('15m');
  const [scoreCandles, setScoreCandles]     = useState([]);
  const [usdtCandles, setUsdtCandles]       = useState([]);
  const [ratioCandles, setRatioCandles]     = useState([]);
  const [scorePctSeries, setScorePctSeries] = useState([]);
  const [compTokenData, setCompTokenData]   = useState([]);
  const [compGroupData, setCompGroupData]   = useState([]);
  const [isLoading, setIsLoading]           = useState(true);

  const startRatioRef = useRef(null);
  const containerScoreRef     = useRef(null);
  const containerUsdtRef      = useRef(null);
  const containerRatioRef     = useRef(null);
  const containerScorePctRef  = useRef(null);
  const containerCompGroupRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    const loadChartData = async () => {
      setIsLoading(true);
      try {
        const bybitTfMap = { '15m':'15', '1h':'60', '4h':'240', '1d':'D', '1w':'W' };
        const tf = bybitTfMap[timeframe] || '15';

        // 1. Fetch main token + SOL
        const [tokKlines, solKlines] = await Promise.all([
          fetchBybitKlines(cleanSymbol, tf, 500),
          fetchBybitKlines('SOLUSDT', tf, 500),
        ]);

        if (isCancelled) return;
        if (!tokKlines.length || !solKlines.length) return;

        // USDT Price Candles
        const formattedUsdt = tokKlines.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low:  parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));

        // Ratio Candles & Score Candles
        const solMap = {};
        for (const sk of solKlines) {
          solMap[parseInt(sk[0])] = {
            open: parseFloat(sk[1]),
            high: parseFloat(sk[2]),
            low: parseFloat(sk[3]),
            close: parseFloat(sk[4]),
          };
        }

        const ratioData = [];
        for (const tk of tokKlines) {
          const ts = parseInt(tk[0]);
          const solK = solMap[ts];
          if (!solK || solK.close <= 0) continue;

          const rOpen  = parseFloat(tk[1]) / solK.open;
          const rHigh  = parseFloat(tk[2]) / solK.low;
          const rLow   = parseFloat(tk[3]) / solK.high;
          const rClose = parseFloat(tk[4]) / solK.close;

          ratioData.push({
            time: Math.floor(ts / 1000),
            open: rOpen,
            high: Math.max(rOpen, rHigh, rClose),
            low:  Math.min(rOpen, rLow, rClose),
            close: rClose,
          });
        }

        // Build score candles
        const scoreOHLC = [];
        let offsets = { m15: 1, h1: 4, h4: 16, d1: 96, w1: 672 };
        if (timeframe === '1h') offsets = { m15: 1, h1: 1, h4: 4, d1: 24, w1: 168 };
        if (timeframe === '4h') offsets = { m15: 1, h1: 1, h4: 1, d1: 6, w1: 42 };
        if (timeframe === '1d') offsets = { m15: 1, h1: 1, h4: 1, d1: 1, w1: 7 };
        if (timeframe === '1w') offsets = { m15: 1, h1: 1, h4: 1, d1: 1, w1: 1 };

        const computeScoreAtIdx = (series, idx, field = 'close') => {
          if (!series || idx < 0 || idx >= series.length) return 0;
          const cur = series[idx][field];
          const getP = (off) => {
            const prev = series[Math.max(0, idx - off)][field];
            return prev > 0 ? ((cur - prev) / prev) * 100 : 0;
          };
          const p15m = getP(offsets.m15);
          const p1h  = getP(offsets.h1);
          const p4h  = getP(offsets.h4);
          const p1d  = getP(offsets.d1);
          const p1w  = getP(offsets.w1);

          let pts = 0;
          if (p1w > 0) pts += 3.0;
          if (p1d > 0) pts += 2.5;
          if (p4h > 0) pts += 2.0;
          if (p1h > 0) pts += 1.5;
          if (p15m > 0) pts += 1.0;

          const wPerf = (p1w * 0.30) + (p1d * 0.25) + (p4h * 0.20) + (p1h * 0.15) + (p15m * 0.10);
          return pts + wPerf;
        };

        for (let i = 0; i < ratioData.length; i++) {
          const sO = computeScoreAtIdx(ratioData, i, 'open');
          const sH = computeScoreAtIdx(ratioData, i, 'high');
          const sL = computeScoreAtIdx(ratioData, i, 'low');
          const sC = computeScoreAtIdx(ratioData, i, 'close');

          scoreOHLC.push({
            time: ratioData[i].time,
            open: parseFloat(sO.toFixed(1)),
            high: parseFloat(Math.max(sO, sH, sC).toFixed(1)),
            low:  parseFloat(Math.min(sO, sL, sC).toFixed(1)),
            close: parseFloat(sC.toFixed(1)),
          });
        }

        // 2. Fetch all confluence tokens (score > 10) to compute exact dynamic basket history for Graph #4
        const confluenceTokens = topTokensList.filter(t => t.score > 10);
        const basketCandidates = (confluenceTokens.length > 0 ? confluenceTokens : topTokensList.slice(0, 30))
          .map(t => typeof t === 'string' ? t : t.cleanSymbol || t.symbol);

        const peerRatios = {};
        await Promise.all(basketCandidates.map(async (sym) => {
          if (sym.toUpperCase() === cleanSymbol.toUpperCase()) return;
          try {
            const pKlines = await fetchBybitKlines(sym, tf, 500);
            if (!pKlines.length) return;
            const pRatio = [];
            for (const pk of pKlines) {
              const ts = parseInt(pk[0]);
              const solK = solMap[ts];
              if (solK && solK.close > 0) {
                pRatio.push({
                  time: Math.floor(ts / 1000),
                  close: parseFloat(pk[4]) / solK.close,
                });
              }
            }
            if (pRatio.length > 5) peerRatios[sym] = pRatio;
          } catch (_) {}
        }));

        // Compute Score% curve over time (Graph #4) & 24h Comp Trajectory (Graph #0)
        const pctSeries = [];
        const compTokenSeries = [];
        const compGroupSeries = [];

        // Harmonize start ratio using targetStartTs matching 24h ago
        const nowSec = Math.floor(Date.now() / 1000);
        const tfSecMap = { '15m': 24*3600, '1h': 7*86400, '4h': 30*86400, '1d': 90*86400, '1w': 365*86400 };
        const timeWindowSec = tfSecMap[timeframe] || 24 * 3600;
        const targetStartTs = nowSec - timeWindowSec;

        let compStartIdx = ratioData.findIndex(r => r.time >= targetStartTs);
        if (compStartIdx < 0 || compStartIdx >= ratioData.length) {
          compStartIdx = Math.max(0, ratioData.length - 96);
        }
        const startObj = ratioData[compStartIdx] || ratioData[0];
        const startRatio = (startObj && startObj.close > 0) ? startObj.close : 1;
        startRatioRef.current = startRatio;

        for (let i = 0; i < scoreOHLC.length; i++) {
          const tScore = scoreOHLC[i].close;
          const tsTime = scoreOHLC[i].time;

          let basketSum = tScore > 10 ? tScore : 0;
          let peerDeltasSum = 0;
          let peerDeltasCount = 0;

          // Token relative delta % from 24h start of timeline
          if (ratioData[i] && i >= compStartIdx) {
            const tDelta = ((ratioData[i].close - startRatio) / startRatio) * 100;
            compTokenSeries.push({ time: tsTime, value: parseFloat(tDelta.toFixed(2)) });
          }

          // Add peer scores > 10 at timestamp i & calculate dynamic peer deltas
          Object.values(peerRatios).forEach(pSeries => {
            const matchIdx = pSeries.findIndex(p => p.time === tsTime);
            if (matchIdx >= 0) {
              const pScore = computeScoreAtIdx(pSeries, matchIdx, 'close');
              if (pScore > 10) basketSum += pScore;

              let pStartIdx = pSeries.findIndex(p => p.time >= targetStartTs);
              if (pStartIdx < 0 || pStartIdx >= pSeries.length) pStartIdx = Math.max(0, pSeries.length - 96);
              const pStartRatio = pSeries[pStartIdx] ? pSeries[pStartIdx].close : 0;

              if (pStartRatio > 0 && matchIdx >= pStartIdx) {
                const pDelta = ((pSeries[matchIdx].close - pStartRatio) / pStartRatio) * 100;
                if (pScore >= 0) {
                  peerDeltasSum += pDelta;
                  peerDeltasCount++;
                }
              }
            }
          });

          const pct = (tScore > 10 && basketSum > 0) ? (tScore / basketSum) * 100 : 0;
          pctSeries.push({
            time: tsTime,
            value: parseFloat(pct.toFixed(2)),
          });

          if (i >= compStartIdx) {
            const gDelta = peerDeltasCount > 0 ? peerDeltasSum / peerDeltasCount : 0;
            compGroupSeries.push({
              time: tsTime,
              value: parseFloat(gDelta.toFixed(2)),
            });
          }
        }

        setUsdtCandles(formattedUsdt);
        setRatioCandles(ratioData);
        setScoreCandles(scoreOHLC);
        setScorePctSeries(pctSeries);
        setCompTokenData(compTokenSeries);
        setCompGroupData(compGroupSeries);

      } catch (_) {
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadChartData();
    return () => { isCancelled = true; };
  }, [cleanSymbol, timeframe]);

  // High Frequency 1-Second Ticker for Live Candle movement + New Candle Period Creation (0 Lag!)
  useEffect(() => {
    if (!cleanSymbol || !usdtCandles.length) return;

    const intervalId = setInterval(async () => {
      try {
        const [resTok, resSol] = await Promise.all([
          fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${cleanSymbol}USDT`),
          fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=SOLUSDT`),
        ]);

        if (resTok.ok && resSol.ok) {
          const jsonTok = await resTok.json();
          const jsonSol = await resSol.json();

          const tokP = parseFloat(jsonTok.result?.list?.[0]?.lastPrice || 0);
          const solP = parseFloat(jsonSol.result?.list?.[0]?.lastPrice || 0);

          if (tokP > 0 && solP > 0) {
            const curRatio = tokP / solP;
            const nowSec = Math.floor(Date.now() / 1000);

            const tfSecMap = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800 };
            const stepSec = tfSecMap[timeframe] || 900;
            const currentBarTime = Math.floor(nowSec / stepSec) * stepSec;

            // Update USDT candle last point / append new bar live
            setUsdtCandles(prev => {
              if (!prev.length) return prev;
              const last = prev[prev.length - 1];
              if (currentBarTime > last.time) {
                return [...prev, { time: currentBarTime, open: tokP, high: tokP, low: tokP, close: tokP }];
              } else {
                const updated = { ...last, close: tokP, high: Math.max(last.high, tokP), low: Math.min(last.low, tokP) };
                return [...prev.slice(0, prev.length - 1), updated];
              }
            });

            // Update Ratio candle last point / append new bar live
            setRatioCandles(prev => {
              if (!prev.length) return prev;
              const last = prev[prev.length - 1];
              if (currentBarTime > last.time) {
                return [...prev, { time: currentBarTime, open: curRatio, high: curRatio, low: curRatio, close: curRatio }];
              } else {
                const updated = { ...last, close: curRatio, high: Math.max(last.high, curRatio), low: Math.min(last.low, curRatio) };
                return [...prev.slice(0, prev.length - 1), updated];
              }
            });

            // Update Comp Token Delta (Graph #0) using startRatioRef (24h ago)
            setCompTokenData(prev => {
              if (!prev.length || !startRatioRef.current || startRatioRef.current <= 0) return prev;
              const baseRatio = startRatioRef.current;
              const liveDelta = parseFloat((((curRatio - baseRatio) / baseRatio) * 100).toFixed(2));
              const last = prev[prev.length - 1];

              if (currentBarTime > last.time) {
                return [...prev, { time: currentBarTime, value: liveDelta }];
              } else {
                return [...prev.slice(0, prev.length - 1), { time: last.time, value: liveDelta }];
              }
            });
          }
        }
      } catch (_) {}
    }, 1000); // 1 second fast tick!

    return () => clearInterval(intervalId);
  }, [cleanSymbol, usdtCandles.length, ratioCandles, timeframe]);

  // Render Comparative Group Graph #0 (Token vs Red Group Line Méthode 1)
  useEffect(() => {
    if (!containerCompGroupRef.current || !compTokenData.length) return;
    const chart = createChart(containerCompGroupRef.current, {
      width: containerCompGroupRef.current.clientWidth,
      height: 320,
      layout: { background: { color: 'rgba(10,15,25,0.95)' }, textColor: '#b2b5be' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.2)' }, horzLines: { color: 'rgba(42, 46, 57, 0.2)' } },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        timeVisible: true,
        rightOffset: 15,
      },
    });

    const tokenSeries = chart.addLineSeries({
      color: '#00ff88',
      lineWidth: 3,
      title: `🟢 ${cleanSymbol} (Delta Réel %)`,
    });
    tokenSeries.setData(compTokenData);

    const groupSeries = chart.addLineSeries({
      color: '#ff3366',
      lineWidth: 2,
      title: `🔴 LIGNE DE RÉFÉRENCE DYNAMIQUE DU GROUPE (MÉTHODE 1)`,
    });
    groupSeries.setData(compGroupData);

    chart.timeScale().fitContent();
    chart.timeScale().applyOptions({ rightOffset: 15 });
    return () => {
      try { chart.remove(); } catch (_) {}
    };
  }, [compTokenData, compGroupData, cleanSymbol]);

  // Render Score Chart #1
  useEffect(() => {
    if (!containerScoreRef.current || !scoreCandles.length) return;
    const chart = createChart(containerScoreRef.current, {
      width: containerScoreRef.current.clientWidth,
      height: 300,
      layout: { background: { color: 'rgba(10,15,25,0.95)' }, textColor: '#b2b5be' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.2)' }, horzLines: { color: 'rgba(42, 46, 57, 0.2)' } },
      rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0.4)' },
      timeScale: { borderColor: 'rgba(42, 46, 57, 0.4)', timeVisible: true },
    });
    const s = chart.addCandlestickSeries({ upColor: '#00ff88', downColor: '#ff3366', borderVisible: false });
    s.setData(scoreCandles);
    s.createPriceLine({ price: 0, color: '#00ff88', lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: 'LIGNE 0 PT : PERF TOKEN = PERF SOL ⚖️' });
    s.createPriceLine({ price: 10, color: '#facc15', lineWidth: 1.5, lineStyle: 2, axisLabelVisible: true, title: 'SEUIL 10 PTS (ENTRÉE DANS LE PANIER)' });
    chart.timeScale().fitContent();
    return () => {
      try { chart.remove(); } catch (_) {}
    };
  }, [scoreCandles]);

  // Render USDT Chart #2
  useEffect(() => {
    if (!containerUsdtRef.current || !usdtCandles.length) return;
    const chart = createChart(containerUsdtRef.current, {
      width: containerUsdtRef.current.clientWidth,
      height: 260,
      layout: { background: { color: 'rgba(10,15,25,0.95)' }, textColor: '#b2b5be' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.2)' }, horzLines: { color: 'rgba(42, 46, 57, 0.2)' } },
      rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0.4)' },
      timeScale: { borderColor: 'rgba(42, 46, 57, 0.4)', timeVisible: true },
    });
    const s = chart.addCandlestickSeries({ upColor: '#00ff88', downColor: '#ff3366', borderVisible: false });
    s.setData(usdtCandles);
    chart.timeScale().fitContent();
    return () => {
      try { chart.remove(); } catch (_) {}
    };
  }, [usdtCandles]);

  // Render Ratio Chart #3
  useEffect(() => {
    if (!containerRatioRef.current || !ratioCandles.length) return;
    const chart = createChart(containerRatioRef.current, {
      width: containerRatioRef.current.clientWidth,
      height: 260,
      layout: { background: { color: 'rgba(10,15,25,0.95)' }, textColor: '#b2b5be' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.2)' }, horzLines: { color: 'rgba(42, 46, 57, 0.2)' } },
      rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0.4)' },
      timeScale: { borderColor: 'rgba(42, 46, 57, 0.4)', timeVisible: true },
    });
    const s = chart.addCandlestickSeries({ upColor: '#00d2ff', downColor: '#a855f7', borderVisible: false });
    s.setData(ratioCandles);
    chart.timeScale().fitContent();
    return () => {
      try { chart.remove(); } catch (_) {}
    };
  }, [ratioCandles]);

  // Render Score % Basket Chart #4
  useEffect(() => {
    if (!containerScorePctRef.current || !scorePctSeries.length) return;
    const chart = createChart(containerScorePctRef.current, {
      width: containerScorePctRef.current.clientWidth,
      height: 280,
      layout: { background: { color: 'rgba(10,15,25,0.95)' }, textColor: '#b2b5be' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.2)' }, horzLines: { color: 'rgba(42, 46, 57, 0.2)' } },
      rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0.4)' },
      timeScale: { borderColor: 'rgba(42, 46, 57, 0.4)', timeVisible: true },
    });
    const areaSeries = chart.addAreaSeries({
      topColor: 'rgba(168, 85, 247, 0.5)',
      bottomColor: 'rgba(236, 72, 153, 0.05)',
      lineColor: '#a855f7',
      lineWidth: 2,
    });
    areaSeries.setData(scorePctSeries);
    chart.timeScale().fitContent();
    return () => {
      try { chart.remove(); } catch (_) {}
    };
  }, [scorePctSeries]);

  return (
    <div style={{
      background: 'rgba(5,10,15,0.98)',
      borderRadius: '16px',
      border: '2px solid #00ff88',
      padding: '20px',
      margin: '15px 0 25px 0',
      boxShadow: '0 0 35px rgba(0,255,136,0.35)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* Header controls inside chart box */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={24} color="#00ff88" />
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: '900' }}>
            LES 4 GRAPHIQUES DIRECTS POUR : <span style={{ color: '#00ff88' }}>{cleanSymbol} / USDT</span>
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Timeframe selector */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.3)' }}>
            {['15m', '1h', '4h', '1d', '1w'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#00ff88' : 'transparent',
                  color: timeframe === tf ? '#000' : '#888',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: '900',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,51,102,0.2)',
              color: '#ff3366',
              border: '1px solid #ff3366',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: '900',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <X size={16} /> FERMER LES GRAPHIQUES
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: '30px', textAlign: 'center', color: '#00ff88', fontWeight: '900' }}>
          CHARGEMENT DES BOUGIES ET DU CALCUL DYNAMIQUE DE PANIER EN DIRECT POUR {cleanSymbol}...
        </div>
      )}

      {/* CHART 0: GRAPHIQUE COMPARATIF DYNAMIQUE (TOKEN VS LIGNE ROUGE DYNAMIQUE DU GROUPE) */}
      <div style={{ border: '2px solid rgba(0,255,136,0.5)', borderRadius: '14px', padding: '14px', background: 'rgba(0,255,136,0.03)' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#00ff88', fontSize: '1.05rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Flame size={20} color="#00ff88" />
          0. GRAPHIQUE COMPARATIF DYNAMIQUE : {cleanSymbol} (VERT) vs LIGNE ROUGE DYNAMIQUE DU GROUPE (MÉTHODE 1)
        </h4>
        <div ref={containerCompGroupRef} style={{ width: '100%', height: '320px', borderRadius: '10px', overflow: 'hidden' }} />
      </div>

      {/* CHART 1: SCORE */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', color: '#00ff88', fontSize: '0.95rem', fontWeight: 'bold' }}>
          1. GRAPH DU SCORE SOL ({cleanSymbol}) — LIGNE VERTE 0 PT = PERF TOKEN EQUIVALENTE A SOL
        </h4>
        <div ref={containerScoreRef} style={{ width: '100%', height: '300px', borderRadius: '10px', overflow: 'hidden' }} />
      </div>

      {/* CHART 2: USDT */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', color: '#00d2ff', fontSize: '0.95rem', fontWeight: 'bold' }}>
          2. GRAPH PRIX NOMINAL USDT ($) — {cleanSymbol} / USDT
        </h4>
        <div ref={containerUsdtRef} style={{ width: '100%', height: '260px', borderRadius: '10px', overflow: 'hidden' }} />
      </div>

      {/* CHART 3: RATIO */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', color: '#a855f7', fontSize: '0.95rem', fontWeight: 'bold' }}>
          3. GRAPH RATIO BRUT {cleanSymbol} / SOL
        </h4>
        <div ref={containerRatioRef} style={{ width: '100%', height: '260px', borderRadius: '10px', overflow: 'hidden' }} />
      </div>

      {/* CHART 4: SCORE % DU PANIER */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', color: '#ec4899', fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Percent size={18} color="#ec4899" />
          4. GRAPH SCORE % DU PANIER (%) — HISTORIQUE DE LA PART D'ALLOCATION DANS LE PANIER (&gt;10 PTS)
        </h4>
        <div ref={containerScorePctRef} style={{ width: '100%', height: '280px', borderRadius: '10px', overflow: 'hidden' }} />
      </div>
    </div>
  );
};

const FULL_REFRESH_INTERVAL = 5 * 60; // 5 minutes between full scans

export const TokenSolPerformanceSection = ({ initialShowExhaustiveOnly = false }) => {
  const [tokensList, setTokensList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [sortBy, setSortBy] = useState('scoreDesc');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown] = useState(FULL_REFRESH_INTERVAL);
  const [scoreHorizon, setScoreHorizon] = useState('daytrading'); // Default ⚡ DAYTRADING 24H INTRADAY
  const countdownRef = useRef(FULL_REFRESH_INTERVAL);
  const fullRefreshRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Active Inline Chart Symbol (Toggle on same page!)
  const [activeChartSymbol, setActiveChartSymbol] = useState(null);

  // Optional On-Demand Complementary Radars (Today Session, Strate 15-20, 7D and 30D), Rank Trajectory Chart & Scanner Table
  const [showTodayRadar, setShowTodayRadar] = useState(false);
  const [showStrate15to20Radar, setShowStrate15to20Radar] = useState(false);
  const [show7dRadar, setShow7dRadar] = useState(false);
  const [show30dRadar, setShow30dRadar] = useState(false);
  const [showGlobalExhaustiveRadar, setShowGlobalExhaustiveRadar] = useState(false);
  const [showRankTrajectoryChart, setShowRankTrajectoryChart] = useState(false);
  const [showScannerTable, setShowScannerTable] = useState(false); // Disabled by default for maximum page speed & 0 lag

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const loadPerformanceData = async (currentHorizon = scoreHorizon, isSilent = false) => {
    // Only show loading spinner on initial cold start if no tokens are loaded yet
    const silent = isSilent || tokensList.length > 0;
    if (!silent) {
      setIsLoading(true);
      setProgressMsg('Récupération du Top 500 Bybit Spot USDT...');
    }
    try {
      const topSymbolsRaw = await fetchTop500Symbols(true, 500);
      let candidateSymbols = [];
      if (Array.isArray(topSymbolsRaw) && topSymbolsRaw.length > 0) {
        candidateSymbols = topSymbolsRaw
          .map(t => typeof t === 'string' ? t : t.symbol)
          .filter(s => s.endsWith('USDT') && !s.includes('USDC') && !s.includes('SOLUSDT'));
      }

      // Merge with historical token_entries.json keys to guarantee tokens like TUT, BICO, etc. are ALWAYS included
      const historicalSymbols = Object.keys(tokenEntries).map(k => `${k.toUpperCase()}USDT`);
      const combinedCandidatesSet = new Set([...candidateSymbols, ...historicalSymbols, 'TUTUSDT', 'BICOUSDT', 'HOMEUSDT', 'CAPUSDT', 'BMTUSDT', 'GRVTUSDT', 'SQDUSDT', 'MMTUSDT', 'BOMEUSDT', 'VOOIUSDT', 'CATIUSDT', 'ROAMUSDT', 'PUMPUSDT', 'WLDUSDT', 'SYNUSDT', 'ZBTUSDT', 'ASTERUSDT', 'PEPEUSDT']);
      candidateSymbols = Array.from(combinedCandidatesSet).slice(0, 450);

      setProgressMsg(`Chargement des klines SOL/USDT...`);

      const solKlines = await fetchBybitKlines('SOLUSDT', '15', 1000);
      if (!solKlines.length) throw new Error('Impossible de charger les klines SOL');

      const solCloses = solKlines.map(k => parseFloat(k[4]));

      const results = [];

      // Process tokens in parallel batches
      const batchSize = 10;
      for (let i = 0; i < candidateSymbols.length; i += batchSize) {
        const batch = candidateSymbols.slice(i, i + batchSize);
        if (!silent) setProgressMsg(`Calcul des scores: ${i + batch.length} / ${candidateSymbols.length} tokens...`);

        const batchPromises = batch.map(async (symbol) => {
          const tokKlines = await fetchBybitKlines(symbol, '15', 1000);
          if (!tokKlines || tokKlines.length < 5) return null;

          const tokCloses = tokKlines.map(k => parseFloat(k[4]));
          const tokLatestClose = tokCloses[tokCloses.length - 1];

          // Build ratio series with exact real candle timestamps and full OHLC
          const minLen = Math.min(tokKlines.length, solKlines.length);
          const ratioSeries = [];
          for (let k = 0; k < minLen; k++) {
            const sK = solKlines[solKlines.length - minLen + k];
            const tK = tokKlines[tokKlines.length - minLen + k];

            const sO = parseFloat(sK[1]);
            const sH = parseFloat(sK[2]);
            const sL = parseFloat(sK[3]);
            const sC = parseFloat(sK[4]);

            const tO = parseFloat(tK[1]);
            const tH = parseFloat(tK[2]);
            const tL = parseFloat(tK[3]);
            const tC = parseFloat(tK[4]);

            const ts = Math.floor(parseInt(sK[0]) / 1000);
            if (sC > 0 && sO > 0) {
              const safeSL = sL > 0 ? sL : sC;
              const safeSH = sH > 0 ? sH : sC;
              ratioSeries.push({
                time: ts,
                open: tO / sO,
                high: tH / safeSL,
                low: tL / safeSH,
                close: tC / sC
              });
            }
          }

          if (ratioSeries.length < 5) return null;

          const curRatio  = ratioSeries[ratioSeries.length - 1].close;
          const prevRatio = ratioSeries[ratioSeries.length - 2].close;
          const ratioPerf15m = ((curRatio - prevRatio) / prevRatio) * 100;

          // Multi-TF Score according to currentHorizon (daytrading vs macro)
          const exactScore = computeExactMultiTfScore(ratioSeries, currentHorizon);

          return {
            symbol,
            cleanSymbol: symbol.replace('USDT', '').toUpperCase(),
            price: tokLatestClose,
            curRatio,
            ratioPerf15m,
            score: exactScore,
            ratioSeries,
          };
        });

        const batchResults = await Promise.all(batchPromises);
        for (const item of batchResults) {
          if (item) results.push(item);
        }
      }

      results.sort((a, b) => b.score - a.score);
      const resultsWithCrosses = detectCrossesForTokens(results);
      setTokensList(resultsWithCrosses);

    } catch (err) {
      setProgressMsg(`Erreur: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHorizonChange = (newHorizon) => {
    setScoreHorizon(newHorizon);
    if (tokensList.length > 0) {
      const updated = tokensList.map(t => ({
        ...t,
        score: computeExactMultiTfScore(t.ratioSeries, newHorizon),
      })).sort((a, b) => b.score - a.score);
      setTokensList(updated);
    }
  };

  useEffect(() => {
    // Initial full load
    loadPerformanceData().then(() => {
      setLastUpdated(new Date());
      countdownRef.current = FULL_REFRESH_INTERVAL;
    });

    // Countdown ticker (every second)
    countdownTimerRef.current = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(c => {
        if (c <= 1) return FULL_REFRESH_INTERVAL;
        return c - 1;
      });
    }, 1000);

    // Full scan every 5 minutes
    fullRefreshRef.current = setInterval(() => {
      loadPerformanceData().then(() => {
        setLastUpdated(new Date());
      });
    }, FULL_REFRESH_INTERVAL * 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (fullRefreshRef.current) clearInterval(fullRefreshRef.current);
    };
  }, []);

  // 1-Second Ultra-Fast Synchronized Price & Score Ticker Loop for ALL Tokens (0 Lag, Exact Same Second!)
  useEffect(() => {
    if (tokensList.length === 0) return;

    const fastTickerInterval = setInterval(async () => {
      try {
        // Query ALL Bybit Spot Tickers in 1 SINGLE BATCH REQUEST (0 lag, 100% synchronized at the exact same second)
        const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
        if (!res.ok) return;

        const json = await res.json();
        const rawList = json.result?.list || [];
        if (rawList.length === 0) return;

        const priceMap = {};
        rawList.forEach(item => {
          if (item.symbol && item.symbol.endsWith('USDT')) {
            const sym = item.symbol.replace('USDT', '');
            const p = parseFloat(item.lastPrice || 0);
            if (p > 0) priceMap[sym] = p;
          }
        });

        const solP = priceMap['SOL'];
        if (solP && solP > 0) {
          setTokensList(prevList => {
            let updated = false;
            const newList = prevList.map(t => {
              const tokP = priceMap[t.cleanSymbol];
              if (!tokP || tokP <= 0 || !t.ratioSeries || t.ratioSeries.length === 0) return t;

              const liveRatio = tokP / solP;
              const rSeries = [...t.ratioSeries];
              const nowSec = Math.floor(Date.now() / 1000);
              const cur15mTs = Math.floor(nowSec / 900) * 900;
              const lastObj = rSeries[rSeries.length - 1];

              if (typeof lastObj === 'object' && lastObj !== null) {
                if (lastObj.time < cur15mTs) {
                  // A new 15-minute live candle period has started: push the new live 15m candle!
                  rSeries.push({ time: cur15mTs, close: liveRatio });
                } else {
                  // Update the current live 15-minute candle in real-time every 1 second!
                  rSeries[rSeries.length - 1] = { ...lastObj, close: liveRatio };
                }
              } else {
                rSeries.push({ time: cur15mTs, close: liveRatio });
              }

              const prevObj = rSeries.length >= 2 ? rSeries[rSeries.length - 2] : null;
              const prevRatio = prevObj ? (typeof prevObj === 'object' ? prevObj.close : prevObj) : liveRatio;
              const livePerf15m = (prevRatio > 0 && !isNaN(prevRatio)) ? ((liveRatio - prevRatio) / prevRatio) * 100 : 0;
              const liveScore = computeExactMultiTfScore(rSeries);

              if (Math.abs(t.price - tokP) > 0.000001 || Math.abs(t.score - liveScore) > 0.01) {
                updated = true;
                return {
                  ...t,
                  price: tokP,
                  curRatio: liveRatio,
                  ratioPerf15m: isNaN(livePerf15m) ? 0 : livePerf15m,
                  score: isNaN(liveScore) ? t.score : liveScore,
                  ratioSeries: rSeries,
                };
              }
              return t;
            });
            return updated ? newList : prevList;
          });
        }
      } catch (_) {}
    }, 1000); // 1-second ultra-fast synchronized tick for ALL tokens!

    return () => clearInterval(fastTickerInterval);
  }, [tokensList.length]);

  // ── On-demand instant search fetch for any typed token (ex: TUT, YB) ──
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return;
    const cleanQ = searchTerm.trim().replace('USDT','').toUpperCase();
    const alreadyExists = tokensList.some(t => t.cleanSymbol.includes(cleanQ));
    if (alreadyExists) return;

    let isCancelled = false;
    const fetchSearchedToken = async () => {
      try {
        const symbol = `${cleanQ}USDT`;
        const [tokKlines, solKlines] = await Promise.all([
          fetchBybitKlines(symbol, '15', 1000),
          fetchBybitKlines('SOLUSDT', '15', 1000),
        ]);
        if (isCancelled || !tokKlines || tokKlines.length < 5 || !solKlines.length) return;

        const minLen = Math.min(tokKlines.length, solKlines.length);
        const ratioSeries = [];
        for (let k = 0; k < minLen; k++) {
          const sK = solKlines[solKlines.length - minLen + k];
          const tK = tokKlines[tokKlines.length - minLen + k];

          const sO = parseFloat(sK[1]);
          const sH = parseFloat(sK[2]);
          const sL = parseFloat(sK[3]);
          const sC = parseFloat(sK[4]);

          const tO = parseFloat(tK[1]);
          const tH = parseFloat(tK[2]);
          const tL = parseFloat(tK[3]);
          const tC = parseFloat(tK[4]);

          const ts = Math.floor(parseInt(sK[0]) / 1000);
          if (sC > 0 && sO > 0) {
            const safeSL = sL > 0 ? sL : sC;
            const safeSH = sH > 0 ? sH : sC;
            ratioSeries.push({
              time: ts,
              open: tO / sO,
              high: tH / safeSL,
              low: tL / safeSH,
              close: tC / sC
            });
          }
        }
        if (ratioSeries.length < 5) return;

        const curRatio  = ratioSeries[ratioSeries.length - 1].close;
        const prevRatio = ratioSeries[ratioSeries.length - 2].close;
        const ratioPerf15m = ((curRatio - prevRatio) / prevRatio) * 100;
        const exactScore = computeExactMultiTfScore(ratioSeries);

        const newItem = {
          symbol,
          cleanSymbol: cleanQ,
          price: tokCloses[tokCloses.length - 1],
          curRatio,
          ratioPerf15m,
          score: exactScore,
        };

        setTokensList(prev => {
          if (prev.some(p => p.cleanSymbol === cleanQ)) return prev;
          return [newItem, ...prev];
        });
      } catch (_) {}
    };

    fetchSearchedToken();
    return () => { isCancelled = true; };
  }, [searchTerm, tokensList]);

  const [crossFilter, setCrossFilter] = useState('all'); // 'all', '15m', '1h', '4h', 'triple', 'any', 'tracked'
  const [trackedSymbols, setTrackedSymbols] = useState(new Set());

  const filteredTokens = useMemo(() => {
    let data = tokensList;

    if (searchTerm) {
      const q = searchTerm.trim().toUpperCase();
      data = data.filter(d => d.symbol.toUpperCase().includes(q) || d.cleanSymbol.toUpperCase().includes(q));
    }

    if (scoreFilter === 'positive') data = data.filter(d => d.score >= 0);
    if (scoreFilter === 'negative') data = data.filter(d => d.score < 0);

    // Cross Detection Filters
    if (crossFilter === '15m')     data = data.filter(d => d.crosses?.m15);
    if (crossFilter === '1h')      data = data.filter(d => d.crosses?.h1);
    if (crossFilter === '4h')      data = data.filter(d => d.crosses?.h4);
    if (crossFilter === 'triple')  data = data.filter(d => d.crosses?.isTriple);
    if (crossFilter === 'any')     data = data.filter(d => d.crosses?.hasAny);
    if (crossFilter === 'tracked') data = data.filter(d => trackedSymbols.has(d.cleanSymbol));

    return [...data].sort((a, b) => {
      if (sortBy === 'scoreDesc') return b.score - a.score;
      if (sortBy === 'scoreAsc') return a.score - b.score;
      if (sortBy === 'symbol') return a.cleanSymbol.localeCompare(b.cleanSymbol);
      return b.score - a.score;
    });
  }, [tokensList, searchTerm, scoreFilter, crossFilter, trackedSymbols, sortBy]);

  const totalPages = Math.ceil(filteredTokens.length / pageSize) || 1;
  const paginatedTokens = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTokens.slice(start, start + pageSize);
  }, [filteredTokens, page]);

  return (
    <div style={{
      background: 'rgba(10,15,25,0.95)',
      border: '1px solid rgba(0,255,136,0.35)',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {/* HEADER & CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={26} color="#facc15" />
          <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '900' }}>
            TOKEN SOL PERFORMANCE (TOP 500 BYBIT SPOT)
          </span>
        </div>

        {/* LIVE STATUS + Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {/* LIVE dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '10px', padding: '6px 14px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: isLoading ? '#facc15' : '#00ff88',
              boxShadow: isLoading ? '0 0 10px #facc15' : '0 0 10px #00ff88',
            }} />
            <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.85rem' }}>
              {isLoading ? 'CALCUL EN COURS...' : '🟢 LIVE'}
            </span>
          </div>

          {/* Countdown */}
          {!isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '0.8rem' }}>
              <span>⏱ Prochain scan dans :</span>
              <span style={{ color: '#facc15', fontWeight: '900', fontVariantNumeric: 'tabular-nums' }}>
                {String(Math.floor(countdown / 60)).padStart(2,'0')}:{String(countdown % 60).padStart(2,'0')}
              </span>
            </div>
          )}

          {/* Last updated */}
          {lastUpdated && (
            <span style={{ color: '#444', fontSize: '0.75rem' }}>
              Mis à jour : {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { loadPerformanceData(); setCountdown(FULL_REFRESH_INTERVAL); }}
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #00ff88 100%)',
              color: '#000',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '10px',
              fontWeight: '900',
              fontSize: '0.85rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 0 20px rgba(250,204,21,0.4)',
            }}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            {isLoading ? 'CALCUL DU CLASSEMENT...' : 'RAFRAÎCHIR CLASSEMENT TOP 500'}
          </button>
        </div>
      </div>

      {/* ── INLINE QUAD CHARTS DISPLAYED ON THE EXACT SAME PAGE ── */}
      {activeChartSymbol && (
        <InlineQuadCharts
          cleanSymbol={activeChartSymbol}
          onClose={() => setActiveChartSymbol(null)}
          topTokensList={tokensList}
        />
      )}

      {/* Dedicated Independent Section View for All Tokens */}
      {initialShowExhaustiveOnly ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(8,14,24,0.95)', border: '2px solid #00d2ff', borderRadius: '16px', padding: '20px', boxShadow: '0 0 30px rgba(0,210,255,0.2)' }}>
            <h2 style={{ color: '#00d2ff', fontSize: '1.4rem', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🌐 RADAR MACRO GLOBAL EXHAUSTIF — TOUS LES JETONS (SECTION INDÉPENDANTE)
            </h2>
            <p style={{ color: '#aaaaaa', fontSize: '0.86rem', margin: 0 }}>
              Cette section totalement indépendante analyse les 400+ jetons du classement Bybit sans aucun filtre de Top 20 ou Top 50. Utilisez la barre de tranches Zéro Lag ci-dessous pour une fluidité 60 FPS parfaite !
            </p>
          </div>

          {/* ON-DEMAND TOGGLE CONTROL BAR FOR RANK TRAJECTORY */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(8,14,24,0.9)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(0,210,255,0.3)' }}>
            <button
              onClick={() => setShowRankTrajectoryChart(!showRankTrajectoryChart)}
              style={{
                background: showRankTrajectoryChart ? 'linear-gradient(135deg, #00d2ff, #0077ff)' : 'rgba(255,255,255,0.05)',
                color: showRankTrajectoryChart ? '#000000' : '#00d2ff',
                border: showRankTrajectoryChart ? 'none' : '1px solid rgba(0,210,255,0.4)',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: showRankTrajectoryChart ? '0 0 16px rgba(0,210,255,0.7)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Trophy size={15} color={showRankTrajectoryChart ? '#000000' : '#00d2ff'} />
              {showRankTrajectoryChart ? '📈 MASQUER TRAJECTOIRE DES RANGS' : '📈 AFFICHER TRAJECTOIRE DES RANGS (HISTORIQUE DU CLASSEMENT)'}
            </button>
          </div>

          {showRankTrajectoryChart && (
            <TokenRankTrajectoryChart tokensList={tokensList} />
          )}

          <DeltaSMomentumRadar
            tokensList={tokensList}
            onSelectToken={(sym) => setActiveChartSymbol(sym)}
            initialTimeframe="7d-4h"
            isExhaustiveAllMode={true}
            radarTitle="🌐 RADAR MOMENTUM 7 JOURS EXHAUSTIF — TOUS LES JETONS DU CLASSEMENT SANS EXCEPTION (4H)"
          />
        </div>
      ) : (
        /* ── DELTA S MOMENTUM RADAR CHARTS ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 🚀 LIVE MARKET BENCHMARKS : BTC/USDT & SOL/USDT SIDE-BY-SIDE */}
        <BtcSolBenchmarkHeader tokensList={tokensList} />

        {/* 👑 TABLEAU MULTI-HORIZONS DES TOP 5 (24H | 7J | 30J) AVEC FLÈCHES DYNAMIQUES */}
        <MultiHorizonTop5Matrix
          tokensList={tokensList}
          onSelectToken={(sym) => setActiveChartSymbol(sym)}
        />

        {/* 🪐 CONSTELLATION DE LIQUIDITÉ & TRANSFERT DE CASH (SPHÈRES & FLÈCHES VECTORIELLES) */}
        <LiquidityRotationNetwork
          tokensList={tokensList}
          onSelectToken={(sym) => setActiveChartSymbol(sym)}
        />

        {/* 📅 APERÇU 7 JOURS / 1 SEMAINE (4H) COMPACT (SANS AUCUN BOUTON - ZOOMABLE ET BASCULABLE) */}
        <DeltaSMomentumRadar
          tokensList={tokensList}
          onSelectToken={(sym) => setActiveChartSymbol(sym)}
          initialTimeframe="7d-4h"
          compactMode={true}
          radarTitle="📅 APERÇU 7 JOURS / 1 SEMAINE (4H) — PANORAMIQUE MACRO (BASCULABLE & ZOOMABLE)"
        />

        {/* PRIMARY RADAR 1: 24H (15m) ALWAYS DISPLAYED */}
        <DeltaSMomentumRadar
          tokensList={tokensList}
          onSelectToken={(sym) => setActiveChartSymbol(sym)}
          initialTimeframe="24h-15m"
          radarTitle="⚡ RADAR MOMENTUM 24 HEURES (15m)"
        />

        {/* ON-DEMAND TOGGLE CONTROL BAR : TABLEAU + TRAJECTOIRE DES RANGS + RADAR 30 JOURS */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(8,14,24,0.9)', padding: '12px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📊 OPTIONS & VUES SUPPLÉMENTAIRES :
          </span>

          {/* 1. Bouton Trajectoire des Rangs (Historique du Classement) */}
          <button
            onClick={() => setShowRankTrajectoryChart(!showRankTrajectoryChart)}
            style={{
              background: showRankTrajectoryChart ? 'linear-gradient(135deg, #facc15, #f59e0b)' : 'rgba(255,255,255,0.05)',
              color: showRankTrajectoryChart ? '#000000' : '#facc15',
              border: showRankTrajectoryChart ? 'none' : '1px solid rgba(250,204,21,0.4)',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '900',
              cursor: 'pointer',
              boxShadow: showRankTrajectoryChart ? '0 0 16px rgba(250,204,21,0.7)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Trophy size={16} color={showRankTrajectoryChart ? '#000000' : '#facc15'} />
            {showRankTrajectoryChart ? '🏆 MASQUER TRAJECTOIRE DES RANGS' : '🏆 AFFICHER TRAJECTOIRE DES RANGS (HISTORIQUE DU CLASSEMENT)'}
          </button>

          {/* 2. Bouton Tableau Scanner (400+ tokens) */}
          <button
            onClick={() => setShowScannerTable(!showScannerTable)}
            style={{
              background: showScannerTable ? '#00ff88' : 'rgba(255,255,255,0.05)',
              color: showScannerTable ? '#000000' : '#ffffff',
              border: showScannerTable ? 'none' : '1px solid rgba(255,255,255,0.15)',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '900',
              cursor: 'pointer',
              boxShadow: showScannerTable ? '0 0 16px rgba(0,255,136,0.5)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📊</span>
            {showScannerTable ? '📊 MASQUER TABLEAU DU SCANNER' : '📊 AFFICHER TABLEAU DU SCANNER (400+ TOKENS)'}
          </button>

          {/* 3. Bouton Monthly Radar (30 Jours / 1 Mois) */}
          <button
            onClick={() => setShow30dRadar(!show30dRadar)}
            style={{
              background: show30dRadar ? '#00d2ff' : 'rgba(255,255,255,0.05)',
              color: show30dRadar ? '#000000' : '#ffffff',
              border: show30dRadar ? 'none' : '1px solid rgba(255,255,255,0.15)',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '900',
              cursor: 'pointer',
              boxShadow: show30dRadar ? '0 0 16px rgba(0,210,255,0.5)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📆</span>
            {show30dRadar ? '📆 MASQUER RADAR 30 JOURS (4H)' : '📆 AFFICHER RADAR 30 JOURS / 1 MOIS (4H)'}
          </button>
        </div>

        {/* 📅 OPTIONAL RADAR SESSION DU JOUR (NON-ROLLING, DEPUIS 00:00 UTC) */}
        {showTodayRadar && (
          <DeltaSMomentumRadar
            tokensList={tokensList}
            onSelectToken={(sym) => setActiveChartSymbol(sym)}
            initialTimeframe="today-15m"
            radarTitle="📅 RADAR MOMENTUM SESSION DU JOUR — NON-ROLLING (DEPUIS 00:00 UTC - 15m)"
          />
        )}

        {/* 🚪 OPTIONAL RADAR STRATE [15-20] (RANGS 15 À 20 EN ACCUMULATION) */}
        {showStrate15to20Radar && (
          <DeltaSMomentumRadar
            tokensList={tokensList}
            onSelectToken={(sym) => setActiveChartSymbol(sym)}
            initialTimeframe="24h-15m"
            strate15to20Only={true}
            radarTitle="🚪 RADAR STRATE [15-20] — PORTE D'ENTRÉE DU TOP 20 (RANGS #15 À #20 EN ACCUMULATION)"
          />
        )}

        {/* OPTIONAL RANK TRAJECTORY CHART (HISTORIQUE DU CLASSEMENT DANS LE TEMPS) */}
        {showRankTrajectoryChart && (
          <TokenRankTrajectoryChart tokensList={tokensList} />
        )}

        {/* OPTIONAL RADAR 2: 7J / 1 WEEK (4H) */}
        {show7dRadar && (
          <DeltaSMomentumRadar
            tokensList={tokensList}
            onSelectToken={(sym) => setActiveChartSymbol(sym)}
            initialTimeframe="7d-4h"
            radarTitle="📅 RADAR MOMENTUM 7 JOURS / 1 SEMAINE (4H)"
          />
        )}

        {/* OPTIONAL RADAR 3: 30J / 1 MONTH (4H) */}
        {show30dRadar && (
          <DeltaSMomentumRadar
            tokensList={tokensList}
            onSelectToken={(sym) => setActiveChartSymbol(sym)}
            initialTimeframe="30d-4h"
            radarTitle="📆 RADAR MOMENTUM 30 JOURS / 1 MOIS (4H)"
          />
        )}

        {/* OPTIONAL RADAR 4: EXHAUSTIVE WEEKLY RADAR WITH ALL TOKENS WITHOUT ANY TOP 20/50 LIMIT */}
        {showGlobalExhaustiveRadar && (
          <DeltaSMomentumRadar
            tokensList={tokensList}
            onSelectToken={(sym) => setActiveChartSymbol(sym)}
            initialTimeframe="7d-4h"
            isExhaustiveAllMode={true}
            radarTitle="🌐 RADAR MOMENTUM 7 JOURS EXHAUSTIF — TOUS LES JETONS DU CLASSEMENT SANS EXCEPTION (4H)"
          />
        )}
      </div>
      )}

      {/* 📋 TABLEAU COMPLET DU SCANNER (SUR DEMANDE PAR BOUTON) */}
      {showScannerTable && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(5,10,15,0.8)', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#00ff88" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher un token (ex: BICO, RAD, ESE)..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(0,255,136,0.3)',
                color: '#fff',
                padding: '8px 14px 8px 36px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                outline: 'none',
                width: '240px',
              }}
            />
          </div>

          {/* Score Filter Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 'bold' }}>Score :</span>
            <button
              onClick={() => { setScoreFilter('all'); setPage(1); }}
              style={{
                background: scoreFilter === 'all' ? '#00ff88' : 'rgba(255,255,255,0.05)',
                color: scoreFilter === 'all' ? '#000' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Tous ({tokensList.length})
            </button>
            <button
              onClick={() => { setScoreFilter('positive'); setPage(1); }}
              style={{
                background: scoreFilter === 'positive' ? '#00ff88' : 'rgba(255,255,255,0.05)',
                color: scoreFilter === 'positive' ? '#000' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              🟢 Score Positif &gt; 0 ({tokensList.filter(t => t.score >= 0).length})
            </button>
            <button
              onClick={() => { setScoreFilter('negative'); setPage(1); }}
              style={{
                background: scoreFilter === 'negative' ? '#ff3366' : 'rgba(255,255,255,0.05)',
                color: scoreFilter === 'negative' ? '#fff' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              🔴 Score Négatif &lt; 0 ({tokensList.filter(t => t.score < 0).length})
            </button>
          </div>

          {/* Sort Select */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 'bold' }}>Trier par :</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(250,204,21,0.4)',
                color: '#facc15',
                padding: '6px 12px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="scoreDesc">🏆 Du Meilleur au Plus Bas Score</option>
              <option value="scoreAsc">🔻 Du Plus Bas au Meilleur Score</option>
              <option value="symbol">🔤 Ordre Alphabétique (A-Z)</option>
            </select>
          </div>
        </div>

        {/* 🚀 CROSS DETECTION FILTER STRIP (15m, 1h, 4h) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ color: '#00ff88', fontSize: '0.8rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Flame size={15} color="#00ff88" /> CROISEMENTS DE GROUPE (TOP 500) :
          </span>
          <button
            onClick={() => { setCrossFilter('all'); setPage(1); }}
            style={{
              background: crossFilter === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
              color: crossFilter === 'all' ? '#fff' : '#888',
              border: 'none', padding: '5px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            Tous les Tokens
          </button>
          <button
            onClick={() => { setCrossFilter('15m'); setPage(1); }}
            style={{
              background: crossFilter === '15m' ? '#00ff88' : 'rgba(0,255,136,0.1)',
              color: crossFilter === '15m' ? '#000' : '#00ff88',
              border: '1px solid #00ff88', padding: '5px 12px', borderRadius: '6px', fontWeight: '900', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            🚀 Cross 15M ({tokensList.filter(t => t.crosses?.m15).length})
          </button>
          <button
            onClick={() => { setCrossFilter('1h'); setPage(1); }}
            style={{
              background: crossFilter === '1h' ? '#facc15' : 'rgba(250,204,21,0.1)',
              color: crossFilter === '1h' ? '#000' : '#facc15',
              border: '1px solid #facc15', padding: '5px 12px', borderRadius: '6px', fontWeight: '900', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            🔥 Cross 1H ({tokensList.filter(t => t.crosses?.h1).length})
          </button>
          <button
            onClick={() => { setCrossFilter('4h'); setPage(1); }}
            style={{
              background: crossFilter === '4h' ? '#a855f7' : 'rgba(168,85,247,0.1)',
              color: crossFilter === '4h' ? '#fff' : '#a855f7',
              border: '1px solid #a855f7', padding: '5px 12px', borderRadius: '6px', fontWeight: '900', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            ⚡ Cross 4H ({tokensList.filter(t => t.crosses?.h4).length})
          </button>
          <button
            onClick={() => { setCrossFilter('triple'); setPage(1); }}
            style={{
              background: crossFilter === 'triple' ? 'linear-gradient(90deg, #facc15, #ec4899)' : 'rgba(236,72,153,0.12)',
              color: crossFilter === 'triple' ? '#000' : '#ec4899',
              border: '1px solid #ec4899', padding: '5px 12px', borderRadius: '6px', fontWeight: '900', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            💥 Triple Cross (15m+1h+4h) ({tokensList.filter(t => t.crosses?.isTriple).length})
          </button>
          <button
            onClick={() => { setCrossFilter('tracked'); setPage(1); }}
            style={{
              background: crossFilter === 'tracked' ? '#facc15' : 'rgba(250,204,21,0.15)',
              color: crossFilter === 'tracked' ? '#000' : '#facc15',
              border: '1px solid #facc15', padding: '5px 12px', borderRadius: '6px', fontWeight: '900', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            📌 Tokens Suivis En Direct ({trackedSymbols.size})
          </button>
        </div>
      </div>

      {/* LEADERBOARD TABLE */}
      <div style={{ background: 'rgba(5,10,15,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
        {/* Subtle background status indicator if scanning while table is present */}
        {isLoading && tokensList.length > 0 && (
          <div style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid #00ff88', borderRadius: '8px', padding: '8px 16px', marginBottom: '14px', fontSize: '0.82rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={14} className="spin" />
            ACTUALISATION EN ARRIÈRE-PLAN EN COURS... (LE TABLEAU RESTE VISIBLE EN DIRECT)
          </div>
        )}

        {tokensList.length === 0 && isLoading ? (
          <div style={{ color: '#00ff88', fontWeight: '900', padding: '40px', textAlign: 'center', fontSize: '1.1rem' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '10px' }} />
            <div>{progressMsg}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                  <th style={{ padding: '12px' }}>Rang</th>
                  <th style={{ padding: '12px' }}>Token</th>
                  <th style={{ padding: '12px' }}>Prix USDT ($)</th>
                  <th style={{ padding: '12px' }}>Ratio TOKEN/SOL</th>
                  <th style={{ padding: '12px' }}>Perf Ratio 15m</th>
                  <th style={{ padding: '12px' }}>Score SOL (Pondéré Exact)</th>
                  <th style={{ padding: '12px', color: '#a855f7' }}>Score % du Panier</th>
                  <th style={{ padding: '12px' }}>Statut &amp; Croisement Groupe</th>
                  <th style={{ padding: '12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalConfluenceScore = filteredTokens.reduce((acc, tk) => acc + (tk.score > 10 ? tk.score : 0), 0);

                  return paginatedTokens.map((t, idx) => {
                  const globalRank = (page - 1) * pageSize + idx + 1;
                  const isTop3 = globalRank <= 3;
                  const rankBadge = globalRank === 1 ? '🥇 #1' : globalRank === 2 ? '🥈 #2' : globalRank === 3 ? '🥉 #3' : `#${globalRank}`;
                  const isOpen = activeChartSymbol === t.cleanSymbol;
                  const isTracked = trackedSymbols.has(t.cleanSymbol);

                  const scorePct = (t.score > 10 && totalConfluenceScore > 0)
                    ? (t.score / totalConfluenceScore) * 100
                    : 0;

                  return (
                    <tr
                      key={t.symbol}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isOpen ? 'rgba(0,255,136,0.15)' : isTracked ? 'rgba(250,204,21,0.08)' : isTop3 ? 'rgba(250,204,21,0.06)' : t.score >= 0 ? 'rgba(0,255,136,0.03)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: '900', color: isTop3 ? '#facc15' : '#9ca3af', fontSize: isTop3 ? '1rem' : '0.88rem' }}>
                        {rankBadge}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '900', color: '#fff', fontSize: '1rem' }}>
                        {t.cleanSymbol} <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>/ USDT</span>
                        {isTracked && <span style={{ color: '#facc15', marginLeft: '6px', fontSize: '0.75rem' }}>📌</span>}
                      </td>
                      <td style={{ padding: '12px', color: '#00d2ff', fontWeight: 'bold' }}>
                        ${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(4)}
                      </td>
                      <td style={{ padding: '12px', color: '#facc15', fontWeight: 'bold' }}>
                        {t.curRatio.toFixed(6)}
                      </td>
                      <td style={{ padding: '12px', color: (t.ratioPerf15m && !isNaN(t.ratioPerf15m) && t.ratioPerf15m >= 0) ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {(!t.ratioPerf15m || isNaN(t.ratioPerf15m)) ? '+0.00%' : `${t.ratioPerf15m >= 0 ? '+' : ''}${t.ratioPerf15m.toFixed(2)}%`}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '900', fontSize: '1.05rem', color: t.score >= 10 ? '#00ff88' : t.score >= 0 ? '#facc15' : '#ff3366' }}>
                        {t.score >= 0 ? '+' : ''}{t.score.toFixed(1)} pts
                      </td>
                      <td style={{ padding: '12px' }}>
                        {scorePct > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', background: 'rgba(168,85,247,0.15)', borderRadius: '4px', minWidth: '60px' }}>
                              <div style={{ width: `${Math.min(scorePct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7, #ec4899)', borderRadius: '4px', transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ color: '#a855f7', fontWeight: '900', fontSize: '0.9rem', minWidth: '52px' }}>
                              {scorePct.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#444', fontWeight: 'bold', fontSize: '0.8rem' }}>— exclu</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          {t.crosses?.isTriple ? (
                            <span style={{ color: '#000', fontWeight: '900', fontSize: '0.75rem', background: 'linear-gradient(90deg, #facc15, #00ff88)', padding: '3px 8px', borderRadius: '6px', boxShadow: '0 0 10px #00ff88' }}>
                              💥 TRIPLE CROSS (15m+1h+4h)
                            </span>
                          ) : t.crosses?.m15 ? (
                            <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(0,255,136,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #00ff88' }}>
                              🚀 CROSS 15M DÉTECTÉ
                            </span>
                          ) : t.crosses?.h1 ? (
                            <span style={{ color: '#facc15', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(250,204,21,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #facc15' }}>
                              🔥 CROSS 1H DÉTECTÉ
                            </span>
                          ) : t.crosses?.h4 ? (
                            <span style={{ color: '#a855f7', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(168,85,247,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #a855f7' }}>
                              ⚡ CROSS 4H DÉTECTÉ
                            </span>
                          ) : t.score >= 10 ? (
                            <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(0,255,136,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #00ff88' }}>
                              🔥 CONFLUENCE TOTALE (10+ pts)
                            </span>
                          ) : t.score >= 0 ? (
                            <span style={{ color: '#facc15', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(250,204,21,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #facc15' }}>
                              🟢 SURPERFORMANCE &gt;= SOL
                            </span>
                          ) : (
                            <span style={{ color: '#ff3366', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(255,51,102,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #ff3366' }}>
                              🔴 SOUS-PERFORMANCE &lt; SOL
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              setTrackedSymbols(prev => {
                                const next = new Set(prev);
                                if (next.has(t.cleanSymbol)) next.delete(t.cleanSymbol);
                                else next.add(t.cleanSymbol);
                                return next;
                              });
                            }}
                            style={{
                              background: isTracked ? '#facc15' : 'rgba(250,204,21,0.1)',
                              color: isTracked ? '#000' : '#facc15',
                              border: '1px solid #facc15',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontWeight: '900',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {isTracked ? '📌 SUIVI' : '📌 SUIVRE'}
                          </button>

                          <button
                            onClick={() => {
                              if (isOpen) setActiveChartSymbol(null);
                              else setActiveChartSymbol(t.cleanSymbol);
                            }}
                            style={{
                              background: isOpen ? '#ff3366' : 'rgba(0,255,136,0.12)',
                              color: isOpen ? '#fff' : '#00ff88',
                              border: isOpen ? '1px solid #ff3366' : '1px solid #00ff88',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontWeight: '900',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              boxShadow: isOpen ? '0 0 15px rgba(255,51,102,0.5)' : 'none',
                              transition: 'all 0.2s',
                            }}
                          >
                            {isOpen ? '❌ FERMER' : '📈 CHARTE'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })})()}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {!isLoading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>
              Affichage de {((page - 1) * pageSize) + 1} à {Math.min(page * pageSize, filteredTokens.length)} sur {filteredTokens.length} tokens
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: page === 1 ? '#444' : '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ChevronLeft size={16} /> Précédent
              </button>
              <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.85rem' }}>
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: page === totalPages ? '#444' : '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Suivant <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default TokenSolPerformanceSection;
