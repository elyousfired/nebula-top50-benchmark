import Top20MonthlyUnderRefRadar from './Top20MonthlyUnderRefRadar';
import ChampionsHigherHighScanner from './ChampionsHigherHighScanner';
import MarketRotationCycleWheel from './MarketRotationCycleWheel';
import Top1KingsHistorySection from './Top1KingsHistorySection';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { fetchTop500Symbols } from './logic/scanner';
import tokenEntries from './data/token_entries.json';
import { DeltaSMomentumRadar } from './DeltaSMomentumRadar';
import { TokenRankTrajectoryChart } from './TokenRankTrajectoryChart';
import BtcSolBenchmarkHeader from './BtcSolBenchmarkHeader';
import LiquidityRotationNetwork from './LiquidityRotationNetwork';
import MultiHorizonTop5Matrix from './MultiHorizonTop5Matrix';
import Top5IntraClusterPredictor from './Top5IntraClusterPredictor';
import MarketContextEngine from './MarketContextEngine';
import { Trophy, Search, RefreshCw, Zap, TrendingUp, Filter, BarChart3, Globe, Award, ArrowUpDown, ChevronLeft, ChevronRight, Scale, X, DollarSign, Calendar, Percent, Flame } from 'lucide-react';

const KLINE_PERSISTENT_CACHE = new Map();

async function fetchBybitKlines(symbol, interval = '15', limit = 1000) {
  const cleanBase = symbol.replace('USDT', '').toUpperCase();
  const formattedSymbol = `${cleanBase}USDT`;
  const cacheKey = `${formattedSymbol}_${interval}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.result?.list && json.result.list.length >= 3) {
          const rawList = json.result.list.slice().reverse();
          KLINE_PERSISTENT_CACHE.set(cacheKey, rawList);
          return rawList;
        }
      }
    } catch (_) {}
  }

  // Fallback to cache if network glitched
  if (KLINE_PERSISTENT_CACHE.has(cacheKey)) {
    return KLINE_PERSISTENT_CACHE.get(cacheKey);
  }

  return [];
}

// Calculate EXACT Multi-Timeframe Score in Pure USDT
// W=3.0, D=2.5, 4H=2.0, 1H=1.5, 15m=1.0 (Max = 10 pts) + WeightedPerf
function computeExactMultiTfScore(tokenPriceData) {
  if (!tokenPriceData || tokenPriceData.length < 2) return 0;
  const getVal = (v) => (typeof v === 'object' && v !== null ? (v.close ?? v.value ?? 0) : v);

  const len = tokenPriceData.length;
  const curTokenPrice = getVal(tokenPriceData[len - 1]);

  const getPerf = (reqOff) => {
    if (len <= reqOff) return 0;
    const prevIdx = len - 1 - reqOff;
    const prev = getVal(tokenPriceData[prevIdx]);
    if (!prev || prev <= 0) return 0;
    const rawPerf = ((curTokenPrice - prev) / prev) * 100;
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

// 🎯 MULTI-TIMEFRAME CROSS DETECTION ENGINE (15m, 1h, 4h across ALL Top 500 Tokens in Pure USDT)
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
    const startPrice = typeof startObj === 'object' ? startObj.close : startObj;
    if (!startPrice || startPrice <= 0) return;

    const deltas = [];
    for (let i = startIdx; i < len; i++) {
      const item = rSeries[i];
      const val = typeof item === 'object' ? item.close : item;
      deltas.push(((val - startPrice) / startPrice) * 100);
    }
    tokenDeltasMap[t.cleanSymbol] = deltas;
  });

  const validSymbols = Object.keys(tokenDeltasMap);
  if (validSymbols.length === 0) return tokensList;

  for (let idx = 0; idx < depth; idx++) {
    let sum = 0;
    let count = 0;
    validSymbols.forEach(sym => {
      const arr = tokenDeltasMap[sym];
      if (arr && arr[idx] !== undefined) {
        sum += arr[idx];
        count++;
      }
    });
    groupDeltaCurve[idx] = count > 0 ? (sum / count) : 0;
  }

  return tokensList.map(t => {
    const deltas = tokenDeltasMap[t.cleanSymbol];
    if (!deltas || deltas.length < 16) {
      return {
        ...t,
        crossStatus: t.score >= 10 ? 'CONFLUENCE_HIGH' : (t.score >= 0 ? 'NEUTRAL_POS' : 'LAGGING'),
        crossDetails: { is15mCross: false, is1hCross: false, is4hCross: false, isTripleCross: false }
      };
    }

    const lastIdx = deltas.length - 1;
    const curDiff = deltas[lastIdx] - groupDeltaCurve[lastIdx];

    const idx15m = Math.max(0, lastIdx - 1);
    const diff15m = deltas[idx15m] - groupDeltaCurve[idx15m];
    const is15mCross = diff15m <= 0 && curDiff > 0;

    const idx1h = Math.max(0, lastIdx - 4);
    const diff1h = deltas[idx1h] - groupDeltaCurve[idx1h];
    const is1hCross = diff1h <= 0 && curDiff > 0;

    const idx4h = Math.max(0, lastIdx - 16);
    const diff4h = deltas[idx4h] - groupDeltaCurve[idx4h];
    const is4hCross = diff4h <= 0 && curDiff > 0;

    const isTripleCross = is15mCross && is1hCross && is4hCross;

    let crossStatus = 'LAGGING';
    if (isTripleCross) {
      crossStatus = 'TRIPLE_CROSS';
    } else if (is4hCross) {
      crossStatus = 'CROSS_4H';
    } else if (is1hCross) {
      crossStatus = 'CROSS_1H';
    } else if (is15mCross) {
      crossStatus = 'CROSS_15M';
    } else if (t.score >= 10 && curDiff > 0) {
      crossStatus = 'CONFLUENCE_HIGH';
    } else if (curDiff > 0) {
      crossStatus = 'OUTPERFORMING';
    }

    return {
      ...t,
      crossStatus,
      crossDetails: {
        is15mCross,
        is1hCross,
        is4hCross,
        isTripleCross,
        diffAgainstGroup: curDiff
      }
    };
  });
}

// ── COMPONENT : INLINE QUAD CHARTS (4 TIMEFRAMES IN PURE USDT) ──
const InlineQuadCharts = ({ cleanSymbol, onClose, topTokensList = [] }) => {
  const containerRef15m = useRef(null);
  const containerRef1h = useRef(null);
  const containerRef4h = useRef(null);
  const containerRef1d = useRef(null);

  const [loading, setLoading] = useState(true);
  const [tfData, setTfData] = useState({ '15': [], '60': [], '240': [], 'D': [] });

  useEffect(() => {
    let isCancelled = false;
    async function loadAllTfs() {
      setLoading(true);
      try {
        const [k15, k60, k240, kD] = await Promise.all([
          fetchBybitKlines(cleanSymbol, '15', 300),
          fetchBybitKlines(cleanSymbol, '60', 300),
          fetchBybitKlines(cleanSymbol, '240', 300),
          fetchBybitKlines(cleanSymbol, 'D', 300),
        ]);

        if (!isCancelled) {
          const mapCandles = (kArr) => {
            return (kArr || []).map(k => ({
              time: Math.floor(parseInt(k[0]) / 1000),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4])
            })).filter(c => c.close > 0 && !isNaN(c.close));
          };

          setTfData({
            '15': mapCandles(k15),
            '60': mapCandles(k60),
            '240': mapCandles(k240),
            'D': mapCandles(kD),
          });
          setLoading(false);
        }
      } catch (_) {
        if (!isCancelled) setLoading(false);
      }
    }

    loadAllTfs();
    return () => { isCancelled = true; };
  }, [cleanSymbol]);

  const renderSingleChart = (containerRef, data, title, tfColor) => {
    if (!containerRef.current || !data || data.length === 0) return;
    containerRef.current.innerHTML = '';

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 220,
      layout: { background: { color: '#070c14' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.04)' }, horzLines: { color: 'rgba(255, 255, 255, 0.04)' } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff3366',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff3366',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff3366',
    });

    series.setData(data);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  };

  useEffect(() => {
    if (loading) return;
    const cleanups = [
      renderSingleChart(containerRef15m, tfData['15'], '15 MINUTES', '#00d2ff'),
      renderSingleChart(containerRef1h, tfData['60'], '1 HEURE', '#38bdf8'),
      renderSingleChart(containerRef4h, tfData['240'], '4 HEURES', '#a855f7'),
      renderSingleChart(containerRef1d, tfData['D'], '1 JOUR', '#facc15'),
    ];
    return () => cleanups.forEach(c => c && c());
  }, [loading, tfData]);

  return (
    <div style={{
      background: 'rgba(5, 10, 20, 0.98)',
      border: '2px solid #00ff88',
      borderRadius: '16px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      boxShadow: '0 0 35px rgba(0, 255, 136, 0.25)',
      marginTop: '10px',
      marginBottom: '20px',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#00ff88' }}>
            📈 {cleanSymbol}/USDT — CHARTE MULTI-HORIZONS SPOT LIVE
          </span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            (Analyse simultanée 15m · 1h · 4h · 1d en Dollars US)
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <X size={16} /> FERMER
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#00ff88', fontWeight: 'bold' }}>
          CHARGEMENT DES 4 TIME-FRAMES SPOT USDT...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#070c14', borderRadius: '10px', padding: '10px', border: '1px solid rgba(0, 210, 255, 0.3)' }}>
            <div style={{ color: '#00d2ff', fontWeight: '900', fontSize: '0.85rem', marginBottom: '6px' }}>⚡ 15 MINUTES (SPOT USDT)</div>
            <div ref={containerRef15m} style={{ height: '220px', width: '100%' }} />
          </div>
          <div style={{ background: '#070c14', borderRadius: '10px', padding: '10px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <div style={{ color: '#38bdf8', fontWeight: '900', fontSize: '0.85rem', marginBottom: '6px' }}>⏱️ 1 HEURE (SPOT USDT)</div>
            <div ref={containerRef1h} style={{ height: '220px', width: '100%' }} />
          </div>
          <div style={{ background: '#070c14', borderRadius: '10px', padding: '10px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <div style={{ color: '#a855f7', fontWeight: '900', fontSize: '0.85rem', marginBottom: '6px' }}>📊 4 HEURES (SPOT USDT)</div>
            <div ref={containerRef4h} style={{ height: '220px', width: '100%' }} />
          </div>
          <div style={{ background: '#070c14', borderRadius: '10px', padding: '10px', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
            <div style={{ color: '#facc15', fontWeight: '900', fontSize: '0.85rem', marginBottom: '6px' }}>🏛️ 1 JOUR (SPOT USDT)</div>
            <div ref={containerRef1d} style={{ height: '220px', width: '100%' }} />
          </div>
        </div>
      )}
    </div>
  );
};

const FULL_REFRESH_INTERVAL = 5 * 60; // 5 minutes between full scans

export const TokenUsdtPerformanceSection = ({ initialShowExhaustiveOnly = false }) => {
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

  // Optional On-Demand Complementary Radars
  const [showTodayRadar, setShowTodayRadar] = useState(false);
  const [showRankTrajectoryChart, setShowRankTrajectoryChart] = useState(false);
  const [showScannerTable, setShowScannerTable] = useState(true); // Directement affiché pour confort

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const loadPerformanceData = async (currentHorizon = scoreHorizon, isSilent = false) => {
    const silent = isSilent || tokensList.length > 0;
    if (!silent) {
      setIsLoading(true);
      setProgressMsg('Récupération du Top 500 Bybit Spot USDT (Pure USD)...');
    }
    try {
      const topSymbolsRaw = await fetchTop500Symbols(true, 500);
      let candidateSymbols = [];
      if (Array.isArray(topSymbolsRaw) && topSymbolsRaw.length > 0) {
        candidateSymbols = topSymbolsRaw
          .map(t => typeof t === 'string' ? t : t.symbol)
          .filter(s => s.endsWith('USDT') && !s.includes('USDC'));
      }

      // Merge with historical token_entries.json keys to guarantee tokens like AGI, MEE, TUT, BICO, etc. are ALWAYS included
      const historicalSymbols = Object.keys(tokenEntries || {}).map(k => `${k.toUpperCase()}USDT`);
      const combinedCandidatesSet = new Set([...candidateSymbols, ...historicalSymbols, 'AGIUSDT', 'MEEUSDT', 'CHIPUSDT', 'TRUMPUSDT', 'TUTUSDT', 'BICOUSDT', 'HOMEUSDT', 'CAPUSDT', 'BMTUSDT', 'GRVTUSDT', 'SQDUSDT', 'MMTUSDT', 'BOMEUSDT', 'VOOIUSDT', 'CATIUSDT', 'ROAMUSDT', 'PUMPUSDT', 'WLDUSDT', 'SYNUSDT', 'ZBTUSDT', 'ASTERUSDT', 'PEPEUSDT']);
      candidateSymbols = Array.from(combinedCandidatesSet).slice(0, 450);

      const results = [];
      const batchSize = 10;
      for (let i = 0; i < candidateSymbols.length; i += batchSize) {
        const batch = candidateSymbols.slice(i, i + batchSize);
        if (!silent) setProgressMsg(`Calcul des scores USDT: ${i + batch.length} / ${candidateSymbols.length} tokens...`);

        const batchPromises = batch.map(async (symbol) => {
          const tokKlines = await fetchBybitKlines(symbol, '15', 1000);
          if (!tokKlines || tokKlines.length < 5) return null;

          const tokCloses = tokKlines.map(k => parseFloat(k[4]));
          const tokLatestClose = tokCloses[tokCloses.length - 1];

          // Pure USDT Candles (Real USD Performance)
          const ratioSeries = tokKlines.map(k => ({
            time: Math.floor(parseInt(k[0]) / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4])
          })).filter(c => c.close > 0 && !isNaN(c.close));

          if (ratioSeries.length < 5) return null;

          const curRatio  = ratioSeries[ratioSeries.length - 1].close;
          const prevRatio = ratioSeries[ratioSeries.length - 2].close;
          const ratioPerf15m = ((curRatio - prevRatio) / prevRatio) * 100;

          const exactScore = computeExactMultiTfScore(ratioSeries);

          return {
            symbol,
            cleanSymbol: symbol.replace('USDT', '').toUpperCase(),
            price: tokLatestClose,
            curRatio,
            ratioPerf15m,
            score: exactScore,
            ratioSeries,
            rawUsdtSeries: ratioSeries
          };
        });

        const batchResults = await Promise.all(batchPromises);
        for (const item of batchResults) {
          if (item) results.push(item);
        }
      }

      // 🛡️ PERSISTENT MERGE : Conserver tous les tokens existants pour éviter qu'un token (comme MEE) ne disparaisse lors d'un micro-timeout API Bybit
      setTokensList(prevList => {
        const tokenMap = new Map();
        // 1. Charger l'état précédent
        if (Array.isArray(prevList)) {
          prevList.forEach(t => {
            if (t && t.symbol) tokenMap.set(t.symbol, t);
          });
        }
        // 2. Mettre à jour avec les nouveaux résultats frais
        results.forEach(item => {
          if (item && item.symbol) tokenMap.set(item.symbol, item);
        });

        const mergedList = Array.from(tokenMap.values());
        mergedList.sort((a, b) => b.score - a.score);
        return detectCrossesForTokens(mergedList);
      });

      setLastUpdated(new Date());
    } catch (err) {
      setProgressMsg(`Erreur: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load when entering the page
  useEffect(() => {
    loadPerformanceData();
  }, []);

  // Automatic 5-minute background refresh
  useEffect(() => {
    fullRefreshRef.current = setInterval(() => {
      loadPerformanceData(scoreHorizon, true);
      setCountdown(FULL_REFRESH_INTERVAL);
      countdownRef.current = FULL_REFRESH_INTERVAL;
    }, FULL_REFRESH_INTERVAL * 1000);

    return () => clearInterval(fullRefreshRef.current);
  }, [scoreHorizon]);

  // 1-second countdown ticker
  useEffect(() => {
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return FULL_REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimerRef.current);
  }, []);

  // 1-Second Ultra-Fast Synchronized Spot Price Ticker in USDT
  useEffect(() => {
    if (tokensList.length === 0) return;

    const fastTickerInterval = setInterval(async () => {
      try {
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

        setTokensList(prevList => {
          let updated = false;
          const newList = prevList.map(t => {
            const tokP = priceMap[t.cleanSymbol];
            if (!tokP || tokP <= 0 || !t.ratioSeries || t.ratioSeries.length === 0) return t;

            const rSeries = [...t.ratioSeries];
            const nowSec = Math.floor(Date.now() / 1000);
            const cur15mTs = Math.floor(nowSec / 900) * 900;
            const lastObj = rSeries[rSeries.length - 1];

            if (typeof lastObj === 'object' && lastObj !== null) {
              if (lastObj.time < cur15mTs) {
                rSeries.push({ time: cur15mTs, open: tokP, high: tokP, low: tokP, close: tokP });
              } else {
                rSeries[rSeries.length - 1] = {
                  ...lastObj,
                  close: tokP,
                  high: Math.max(lastObj.high || tokP, tokP),
                  low: Math.min(lastObj.low || tokP, tokP)
                };
              }
            } else {
              rSeries.push({ time: cur15mTs, open: tokP, high: tokP, low: tokP, close: tokP });
            }

            const prevObj = rSeries.length >= 2 ? rSeries[rSeries.length - 2] : null;
            const prevPrice = prevObj ? (typeof prevObj === 'object' ? prevObj.close : prevObj) : tokP;
            let livePerf15m = 0;
            if (prevPrice > 0 && !isNaN(prevPrice)) {
              const diffPct = ((tokP - prevPrice) / prevPrice) * 100;
              if (diffPct > -80 && diffPct < 500) {
                livePerf15m = diffPct;
              }
            }
            const liveScore = computeExactMultiTfScore(rSeries);

            if (Math.abs(t.price - tokP) > 0.000001 || Math.abs(t.score - liveScore) > 0.01) {
              updated = true;
              return {
                ...t,
                price: tokP,
                curRatio: tokP,
                ratioPerf15m: isNaN(livePerf15m) ? 0 : livePerf15m,
                score: isNaN(liveScore) ? t.score : liveScore,
                ratioSeries: rSeries,
                rawUsdtSeries: rSeries
              };
            }
            return t;
          });
          return updated ? newList : prevList;
        });
      } catch (_) {}
    }, 1000);

    return () => clearInterval(fastTickerInterval);
  }, [tokensList.length]);

  // ── On-demand instant search fetch for any typed token (ex: AGI, TUT, YB) ──
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return;
    const cleanSym = searchTerm.trim().toUpperCase().replace('USDT', '');
    const fullSym = `${cleanSym}USDT`;

    const exists = tokensList.some(t => t.cleanSymbol === cleanSym);
    if (exists) return;

    let isCancelled = false;
    async function fetchSearchedToken() {
      try {
        const tokKlines = await fetchBybitKlines(fullSym, '15', 1000);
        if (!tokKlines || tokKlines.length < 5 || isCancelled) return;

        const tokCloses = tokKlines.map(k => parseFloat(k[4]));
        const tokLatestClose = tokCloses[tokCloses.length - 1];

        const ratioSeries = tokKlines.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4])
        })).filter(c => c.close > 0 && !isNaN(c.close));

        if (ratioSeries.length < 5) return;

        const curRatio = ratioSeries[ratioSeries.length - 1].close;
        const prevRatio = ratioSeries[ratioSeries.length - 2].close;
        const ratioPerf15m = ((curRatio - prevRatio) / prevRatio) * 100;
        const exactScore = computeExactMultiTfScore(ratioSeries);

        const newToken = {
          symbol: fullSym,
          cleanSymbol: cleanSym,
          price: tokLatestClose,
          curRatio: tokLatestClose,
          ratioPerf15m,
          score: exactScore,
          ratioSeries,
          rawUsdtSeries: ratioSeries,
          crossStatus: exactScore >= 10 ? 'CONFLUENCE_HIGH' : (exactScore >= 0 ? 'NEUTRAL_POS' : 'LAGGING'),
          crossDetails: { is15mCross: false, is1hCross: false, is4hCross: false, isTripleCross: false }
        };

        setTokensList(prev => {
          if (prev.some(t => t.cleanSymbol === cleanSym)) return prev;
          const merged = [...prev, newToken].sort((a, b) => b.score - a.score);
          return merged;
        });
      } catch (_) {}
    }

    const timer = setTimeout(fetchSearchedToken, 400);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, tokensList]);

  // Tracked symbols in localStorage
  const [trackedSymbols, setTrackedSymbols] = useState(() => {
    try {
      const saved = localStorage.getItem('tracked_usdt_symbols');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleTrackSymbol = (sym) => {
    setTrackedSymbols(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym];
      try {
        localStorage.setItem('tracked_usdt_symbols', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // Cross & Status Filter
  const [crossFilter, setCrossFilter] = useState('all');

  const filteredTokens = useMemo(() => {
    let data = tokensList;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(t => t.cleanSymbol.toLowerCase().includes(q));
    }

    if (scoreFilter === 'positive') data = data.filter(t => t.score > 0);
    if (scoreFilter === 'negative') data = data.filter(t => t.score < 0);
    if (scoreFilter === 'strong') data = data.filter(t => t.score >= 10);
    if (scoreFilter === 'tracked') data = data.filter(t => trackedSymbols.includes(t.cleanSymbol));

    if (crossFilter === 'triple') data = data.filter(t => t.crossStatus === 'TRIPLE_CROSS');
    if (crossFilter === '4h') data = data.filter(t => t.crossStatus === 'CROSS_4H');
    if (crossFilter === '1h') data = data.filter(t => t.crossStatus === 'CROSS_1H');
    if (crossFilter === '15m') data = data.filter(t => t.crossStatus === 'CROSS_15M');
    if (crossFilter === 'confluence') data = data.filter(t => t.crossStatus === 'CONFLUENCE_HIGH');

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
      border: '1px solid rgba(16,185,129,0.35)',
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
          <Zap size={26} color="#10b981" />
          <span style={{ color: '#10b981', fontSize: '1.2rem', fontWeight: '900' }}>
            💵 PURE TOKEN / USDT PERFORMANCE (TOP 500 BYBIT SPOT)
          </span>
        </div>

        {/* LIVE STATUS + Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '6px 14px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: isLoading ? '#facc15' : '#10b981',
              boxShadow: isLoading ? '0 0 10px #facc15' : '0 0 10px #10b981',
            }} />
            <span style={{ color: '#10b981', fontWeight: '900', fontSize: '0.85rem' }}>
              {isLoading ? 'CALCUL EN COURS...' : '🟢 LIVE USDT'}
            </span>
          </div>

          {!isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '0.8rem' }}>
              <span>⏱ Prochain scan dans :</span>
              <span style={{ color: '#10b981', fontWeight: '900', fontVariantNumeric: 'tabular-nums' }}>
                {String(Math.floor(countdown / 60)).padStart(2,'0')}:{String(countdown % 60).padStart(2,'0')}
              </span>
            </div>
          )}

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
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '10px',
              fontWeight: '900',
              fontSize: '0.85rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 0 20px rgba(16,185,129,0.4)',
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

      {/* ── MACRO BENCHMARKS & MARKET REGIME ── */}
      <MarketContextEngine tokensList={tokensList} />
      <BtcSolBenchmarkHeader tokensList={tokensList} />

      {/* ── MULTI-HORIZON TOP 10 RANKING (24H | 7J | 30J) ── */}
      <MultiHorizonTop5Matrix
        tokensList={tokensList}
        onSelectToken={(sym) => setActiveChartSymbol(typeof sym === 'string' ? sym : (sym?.cleanSymbol || sym?.sym || sym?.symbol || null))}
      />

      {/* ── MAIN 24H LIVE RADAR CHART ── */}
      <DeltaSMomentumRadar
        tokensList={tokensList}
        onSelectToken={(sym) => setActiveChartSymbol(sym)}
      />

      {/* 👑 RADAR PRÉDICTIF & ROTATION INTRA-TOP 5 (EXCLUSIF USDT) */}
      <Top5IntraClusterPredictor
        tokensList={tokensList}
        onSelectToken={(sym) => setActiveChartSymbol(sym)}
      />

      {/* 🎯 SCANNER DES CHAMPIONS & BREAKOUT DU HIGHER HIGH (30D, 7D, 24H) */}
      <ChampionsHigherHighScanner
        tokensList={tokensList}
        onSelectToken={(sym) => setActiveChartSymbol(sym)}
      />

      {/* 👑 RADAR TOP 20 DU MOIS SOUS LA RÉSISTANCE MENSUELLE (17.5%) */}
      <Top20MonthlyUnderRefRadar
        tokensList={tokensList}
        onSelectToken={(sym) => setActiveChartSymbol(sym)}
      />

      {/* 🔄 ROUE DU CYCLE DE LIQUIDITÉ & 4 PHASES DE MARCHÉ (ROTATION ENGINE) */}
      <MarketRotationCycleWheel
        tokensList={tokensList}
        onSelectToken={(sym) => setActiveChartSymbol(sym)}
      />

      {/* 👑 TABLEAU & CHARTE HISTORIQUE DES MONARQUES TOP 1 (24H & 7 JOURS) */}
      <Top1KingsHistorySection
        tokensList={tokensList}
        onSelectToken={(sym) => setActiveChartSymbol(sym)}
      />

      {/* ── OPTIONAL ON-DEMAND RADARS ── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setShowTodayRadar(!showTodayRadar)}
          style={{
            background: showTodayRadar ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
            color: showTodayRadar ? '#ffffff' : '#10b981',
            border: showTodayRadar ? 'none' : '1px solid rgba(16,185,129,0.4)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: '900',
            cursor: 'pointer',
          }}
        >
          {showTodayRadar ? '🟢 MASQUER SESSION TODAY' : '🟢 AFFICHER RADAR SESSION TODAY (00:00 UTC)'}
        </button>

        <button
          onClick={() => setShowRankTrajectoryChart(!showRankTrajectoryChart)}
          style={{
            background: showRankTrajectoryChart ? 'linear-gradient(135deg, #00d2ff, #0077ff)' : 'rgba(255,255,255,0.05)',
            color: showRankTrajectoryChart ? '#000000' : '#00d2ff',
            border: showRankTrajectoryChart ? 'none' : '1px solid rgba(0,210,255,0.4)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: '900',
            cursor: 'pointer',
          }}
        >
          {showRankTrajectoryChart ? '📈 MASQUER TRAJECTOIRE DES RANGS' : '📈 HISTORIQUE DU CLASSEMENT (RANGS)'}
        </button>

        <button
          onClick={() => setShowScannerTable(!showScannerTable)}
          style={{
            background: showScannerTable ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
            color: showScannerTable ? '#ffffff' : '#10b981',
            border: showScannerTable ? 'none' : '1px solid rgba(16,185,129,0.4)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: '900',
            cursor: 'pointer',
          }}
        >
          {showScannerTable ? '📋 MASQUER LE TABLEAU TOP 500' : '📋 AFFICHER LE TABLEAU TOP 500 USDT'}
        </button>
      </div>

      {showRankTrajectoryChart && (
        <TokenRankTrajectoryChart tokensList={tokensList} />
      )}

      {showTodayRadar && (
        <DeltaSMomentumRadar
          tokensList={tokensList}
          onSelectToken={(sym) => setActiveChartSymbol(sym)}
          initialTimeframe="today"
          radarTitle="🟢 RADAR MOMENTUM SESSION TODAY (DEPUIS 00:00 UTC EN USDT)"
        />
      )}

      {/* ── TABLEAU DU CLASSEMENT TOP 500 PURE USDT ── */}
      {showScannerTable && (
        <div style={{ background: 'rgba(5,10,18,0.85)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '20px' }}>
          {/* SEARCH & FILTERS */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 12px', minWidth: '220px' }}>
              <Search size={16} color="#9ca3af" />
              <input
                type="text"
                placeholder="Filtrer par symbole (ex: BTC, AGI)..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setScoreFilter('all')}
                style={{
                  background: scoreFilter === 'all' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid ' + (scoreFilter === 'all' ? '#10b981' : 'rgba(255,255,255,0.1)'),
                  color: scoreFilter === 'all' ? '#10b981' : '#9ca3af',
                  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold'
                }}
              >
                TOUS ({tokensList.length})
              </button>
              <button
                onClick={() => setScoreFilter('positive')}
                style={{
                  background: scoreFilter === 'positive' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid ' + (scoreFilter === 'positive' ? '#10b981' : 'rgba(255,255,255,0.1)'),
                  color: scoreFilter === 'positive' ? '#10b981' : '#9ca3af',
                  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold'
                }}
              >
                HAUSSIERS (&gt; 0 PTS)
              </button>
              <button
                onClick={() => setScoreFilter('strong')}
                style={{
                  background: scoreFilter === 'strong' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid ' + (scoreFilter === 'strong' ? '#10b981' : 'rgba(255,255,255,0.1)'),
                  color: scoreFilter === 'strong' ? '#10b981' : '#9ca3af',
                  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold'
                }}
              >
                FUSÉES (&gt;= 10 PTS)
              </button>
              <button
                onClick={() => setScoreFilter('tracked')}
                style={{
                  background: scoreFilter === 'tracked' ? 'rgba(250,204,21,0.3)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid ' + (scoreFilter === 'tracked' ? '#facc15' : 'rgba(255,255,255,0.1)'),
                  color: scoreFilter === 'tracked' ? '#facc15' : '#9ca3af',
                  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold'
                }}
              >
                📌 SUIVIS ({trackedSymbols.length})
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px' }}>Rang</th>
                  <th style={{ padding: '12px' }}>Token</th>
                  <th style={{ padding: '12px' }}>Prix Spot USDT ($)</th>
                  <th style={{ padding: '12px' }}>Perf 15m (USDT)</th>
                  <th style={{ padding: '12px' }}>Score USDT Multi-TF</th>
                  <th style={{ padding: '12px' }}>Part du Panier (%)</th>
                  <th style={{ padding: '12px' }}>Statut & Confluence</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTokens.map((t, idx) => {
                  const actualRank = (page - 1) * pageSize + idx + 1;
                  const isTracked = trackedSymbols.includes(t.cleanSymbol);
                  const isTop3 = actualRank <= 3;
                  const scorePct = t.score > 0 ? (t.score / (tokensList[0]?.score || 1)) * 100 : 0;

                  return (
                    <tr
                      key={t.symbol}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isTracked ? 'rgba(250,204,21,0.08)' : isTop3 ? 'rgba(16,185,129,0.06)' : t.score >= 0 ? 'rgba(16,185,129,0.02)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: '900', color: isTop3 ? '#10b981' : '#9ca3af', fontSize: isTop3 ? '1rem' : '0.88rem' }}>
                        #{actualRank}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '900', color: '#fff', fontSize: '1rem' }}>
                        {t.cleanSymbol} <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>/ USDT</span>
                        {isTracked && <span style={{ color: '#facc15', marginLeft: '6px', fontSize: '0.75rem' }}>📌</span>}
                      </td>
                      <td style={{ padding: '12px', color: '#00d2ff', fontWeight: 'bold' }}>
                        ${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(4)}
                      </td>
                      <td style={{ padding: '12px', color: (t.ratioPerf15m && !isNaN(t.ratioPerf15m) && t.ratioPerf15m >= 0) ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {(!t.ratioPerf15m || isNaN(t.ratioPerf15m)) ? '+0.00%' : `${t.ratioPerf15m >= 0 ? '+' : ''}${t.ratioPerf15m.toFixed(2)}%`}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '900', fontSize: '1.05rem', color: t.score >= 10 ? '#00ff88' : t.score >= 0 ? '#10b981' : '#ff3366' }}>
                        {t.score >= 0 ? '+' : ''}{t.score.toFixed(1)} pts
                      </td>
                      <td style={{ padding: '12px' }}>
                        {scorePct > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', background: 'rgba(16,185,129,0.15)', borderRadius: '4px', minWidth: '60px' }}>
                              <div style={{ width: `${Math.min(scorePct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #00ff88)', borderRadius: '4px' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>{scorePct.toFixed(1)}%</span>
                          </div>
                        ) : (
                          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: t.score >= 10 ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                          border: '1px solid ' + (t.score >= 10 ? '#00ff88' : 'rgba(255,255,255,0.1)'),
                          color: t.score >= 10 ? '#00ff88' : '#9ca3af',
                          padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '900'
                        }}>
                          {t.score >= 10 ? '🔥 CONFLUENCE TOTALE' : (t.score >= 0 ? '🟢 HAUSSIER' : '🔴 BAISSIER')}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => toggleTrackSymbol(t.cleanSymbol)}
                            style={{
                              background: isTracked ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.05)',
                              border: '1px solid ' + (isTracked ? '#facc15' : 'rgba(255,255,255,0.1)'),
                              color: isTracked ? '#facc15' : '#9ca3af',
                              padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold'
                            }}
                          >
                            {isTracked ? '📌 SUIVI' : '📌 SUIVRE'}
                          </button>
                          <button
                            onClick={() => setActiveChartSymbol(t.cleanSymbol)}
                            style={{
                              background: 'rgba(16,185,129,0.15)',
                              border: '1px solid #10b981',
                              color: '#10b981',
                              padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold'
                            }}
                          >
                            📈 CHARTE
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Page {page} sur {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default TokenUsdtPerformanceSection;
