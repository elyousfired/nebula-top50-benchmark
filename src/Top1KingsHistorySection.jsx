import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { 
  Crown, Trophy, Clock, Sparkles, TrendingUp, TrendingDown, 
  Activity, ArrowRight, ShieldCheck, Calendar, Zap, AlertCircle, ChevronRight,
  Flame, Target, ArrowUpRight, Play, RefreshCw, DollarSign, BarChart3, CheckCircle2,
  History, RotateCcw, ShieldAlert
} from 'lucide-react';

const KING_COLORS = ['#facc15', '#38bdf8', '#00ff88', '#f43f5e', '#a855f7', '#fb923c', '#e879f9'];
const STORAGE_KEY = 'NEBULA_KINGS_PAPER_BOT_V1';

export default function Top1KingsHistorySection({ tokensList = [], onSelectToken }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef({});

  // Horizon temporel pour la vue analytique : '24h' | '7d' | '30d'
  const [timeframe, setTimeframe] = useState('24h');
  const [showFullTradeLog, setShowFullTradeLog] = useState(false);

  // 🛡️ ÉTAT PERSISTANT DU BOT (SURVIT À LA FERMETURE DU SITE VIA LOCALSTORAGE)
  const [botState, setBotState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return {
      initialCapital: 1000,
      currentBalance: 1000,
      activePosition: null, // { symbol, entryPrice, entryTime, allocatedCapital }
      tradesHistory: [],    // [{ id, symbol, entryTime, exitTime, entryPrice, exitPrice, pnlPct, pnlUsd, balanceAfter }]
      lastProcessedTs: 0
    };
  });

  // Sauvegarder dans localStorage à chaque modification
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(botState));
    } catch (_) {}
  }, [botState]);

  // Réinitialiser le Bot de Démo à $1,000
  const handleResetBot = () => {
    if (window.confirm('Voulez-vous réinitialiser le Bot de Démo à $1,000 USD ?')) {
      const freshState = {
        initialCapital: 1000,
        currentBalance: 1000,
        activePosition: null,
        tradesHistory: [],
        lastProcessedTs: 0
      };
      setBotState(freshState);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(freshState));
      } catch (_) {}
    }
  };

  // 1. Analyse des Rois et Moteur de Réconciliation Continue (Temps Réel + Hors Ligne)
  const kingsAnalysis = useMemo(() => {
    if (!tokensList || tokensList.length === 0) return null;

    const maxCandles = timeframe === '24h' ? 96 : timeframe === '7d' ? 672 : 1000;
    const stepHours = 0.25;

    const validTokens = tokensList.filter(t => (t.ratioSeries && t.ratioSeries.length >= 10) || (t.rawUsdtSeries && t.rawUsdtSeries.length >= 10));
    if (validTokens.length === 0) return null;

    const tokenSeriesMap = {};
    validTokens.forEach(t => {
      const raw = t.ratioSeries || t.rawUsdtSeries || [];
      const sliced = raw.slice(Math.max(0, raw.length - maxCandles));
      const startClose = typeof sliced[0] === 'object' ? sliced[0].close : sliced[0];
      if (startClose > 0) {
        tokenSeriesMap[t.cleanSymbol] = {
          token: t,
          startClose,
          candles: sliced,
          deltas: sliced.map(c => {
            const time = typeof c === 'object' ? c.time : 0;
            const close = typeof c === 'object' ? c.close : c;
            const perf = ((close - startClose) / startClose) * 100;
            return { time, close, perf };
          })
        };
      }
    });

    const symbols = Object.keys(tokenSeriesMap);
    if (symbols.length === 0) return null;

    const totalPoints = Math.min(...symbols.map(s => tokenSeriesMap[s].deltas.length));
    if (totalPoints < 5) return null;

    const kingsTimeline = [];
    const kingsOrderSet = [];

    // Identifier qui est le #1 à chaque bougie temporelle
    for (let i = 0; i < totalPoints; i++) {
      let topSym = null;
      let maxPerf = -999999;
      let curTime = 0;

      symbols.forEach(sym => {
        const pt = tokenSeriesMap[sym].deltas[i];
        if (pt) {
          curTime = pt.time;
          if (pt.perf > maxPerf) {
            maxPerf = pt.perf;
            topSym = sym;
          }
        }
      });

      if (topSym && maxPerf > -50) {
        kingsTimeline.push({ time: curTime, symbol: topSym, index: i, perf: maxPerf });
        if (!kingsOrderSet.includes(topSym)) {
          kingsOrderSet.push(topSym);
        }
      }
    }

    // Statistiques des Rois pour le tableau
    const kingsList = kingsOrderSet.map((sym, idx) => {
      const tokenData = tokenSeriesMap[sym];
      const deltas = tokenData.deltas;

      const firstKingEntry = kingsTimeline.find(k => k.symbol === sym);
      const t0Index = firstKingEntry ? firstKingEntry.index : 0;
      const t0Candle = deltas[t0Index];
      const t0Time = t0Candle?.time || 0;
      const priceAtT0 = t0Candle?.close || tokenData.startClose;

      const reignPoints = kingsTimeline.filter(k => k.symbol === sym).length;
      const reignHours = (reignPoints * stepHours).toFixed(1);

      let maxPricePostT0 = priceAtT0;
      let peakPostT0Index = t0Index;

      for (let j = t0Index; j < deltas.length; j++) {
        const p = deltas[j].close;
        if (p > maxPricePostT0) {
          maxPricePostT0 = p;
          peakPostT0Index = j;
        }
      }

      const postCrownGainPct = priceAtT0 > 0 ? parseFloat((((maxPricePostT0 - priceAtT0) / priceAtT0) * 100).toFixed(2)) : 0;
      const timeToPeakHours = ((peakPostT0Index - t0Index) * stepHours).toFixed(1);

      const currentPrice = deltas[deltas.length - 1]?.close || priceAtT0;
      const currentPerf = deltas[deltas.length - 1]?.perf || 0;
      const pullBackFromPeak = maxPricePostT0 > 0 ? parseFloat((((maxPricePostT0 - currentPrice) / maxPricePostT0) * 100).toFixed(1)) : 0;

      const isCurrentKing = kingsTimeline[kingsTimeline.length - 1]?.symbol === sym;

      let status = {
        label: '📉 ANCIEN LEADER (EN REPLI)',
        color: '#94a3b8',
        desc: `Repli de -${pullBackFromPeak}% depuis son sommet`
      };

      if (isCurrentKing) {
        status = {
          label: '👑 ROI ACTUEL DU MARCHÉ',
          color: '#facc15',
          desc: 'Détient actuellement la 1ère place du marché'
        };
      } else if (pullBackFromPeak < 10 && currentPerf > 15) {
        status = {
          label: '🔄 CONSOLIDATION / SECOND WAVE',
          color: '#00ff88',
          desc: 'Maintient sa force près du sommet, éligible à une 2ème vague'
        };
      }

      return {
        symbol: sym,
        token: tokenData.token,
        color: KING_COLORS[idx % KING_COLORS.length],
        t0Time,
        priceAtT0,
        maxPricePostT0,
        postCrownGainPct,
        timeToPeakHours,
        reignHours,
        reignPoints,
        currentPrice,
        currentPerf,
        pullBackFromPeak,
        isCurrentKing,
        status,
        seriesData: deltas
      };
    });

    kingsList.sort((a, b) => b.reignPoints - a.reignPoints);

    return {
      kingsList,
      currentKing: kingsList.find(k => k.isCurrentKing) || kingsList[0],
      kingsTimeline,
      tokenSeriesMap
    };
  }, [tokensList, timeframe]);

  // 2. Moteur de Réconciliation des Trades Automatisés (Persistance & Execution)
  useEffect(() => {
    if (!kingsAnalysis || !kingsAnalysis.kingsTimeline || kingsAnalysis.kingsTimeline.length === 0) return;

    const { kingsTimeline, tokenSeriesMap } = kingsAnalysis;

    setBotState(prev => {
      let balance = prev.currentBalance;
      let activePos = prev.activePosition ? { ...prev.activePosition } : null;
      let history = [...prev.tradesHistory];
      let lastProcessed = prev.lastProcessedTs;

      // Filtrer les nouveaux points de la timeline postérieurs au dernier traitement
      const pendingPoints = kingsTimeline.filter(pt => pt.time > lastProcessed);

      if (pendingPoints.length === 0 && activePos) {
        // Mettre à jour uniquement le prix en direct de la position active
        const liveCandle = tokenSeriesMap[activePos.symbol]?.deltas[tokenSeriesMap[activePos.symbol]?.deltas.length - 1];
        const liveP = liveCandle?.close || activePos.entryPrice;
        const livePnlPct = activePos.entryPrice > 0 ? ((liveP - activePos.entryPrice) / activePos.entryPrice) * 100 : 0;
        const livePnlUsd = activePos.allocatedCapital * (livePnlPct / 100);

        return {
          ...prev,
          activePosition: {
            ...activePos,
            currentPrice: liveP,
            livePnlPct: parseFloat(livePnlPct.toFixed(2)),
            livePnlUsd: parseFloat(livePnlUsd.toFixed(2)),
            liveCapital: parseFloat((balance + livePnlUsd).toFixed(2))
          }
        };
      }

      // Traiter les successions de trône
      kingsTimeline.forEach(pt => {
        if (pt.time <= lastProcessed && prev.tradesHistory.length > 0) return;

        const sym = pt.symbol;

        if (!activePos) {
          // Premier trade initial
          const candle = tokenSeriesMap[sym]?.deltas[pt.index];
          const entryPrice = candle?.close || 1;
          activePos = {
            symbol: sym,
            entryTime: pt.time,
            entryPrice,
            allocatedCapital: balance,
            currentPrice: entryPrice,
            livePnlPct: 0,
            livePnlUsd: 0,
            liveCapital: balance
          };
        } else if (activePos.symbol !== sym) {
          // Le trône a changé de Roi : Clôturer la position actuelle et entrer sur le nouveau Roi
          const exitCandle = tokenSeriesMap[activePos.symbol]?.deltas[pt.index];
          const exitPrice = exitCandle?.close || activePos.currentPrice || activePos.entryPrice;
          const pnlPct = activePos.entryPrice > 0 ? ((exitPrice - activePos.entryPrice) / activePos.entryPrice) * 100 : 0;
          const pnlUsd = activePos.allocatedCapital * (pnlPct / 100);
          balance += pnlUsd;

          history.unshift({
            id: `trade_${activePos.symbol}_${activePos.entryTime}`,
            symbol: activePos.symbol,
            entryTime: activePos.entryTime,
            exitTime: pt.time,
            entryPrice: activePos.entryPrice,
            exitPrice,
            pnlPct: parseFloat(pnlPct.toFixed(2)),
            pnlUsd: parseFloat(pnlUsd.toFixed(2)),
            balanceAfter: parseFloat(balance.toFixed(2))
          });

          // Acheter immédiatement le nouveau Roi avec le capital total disponible
          const newEntryCandle = tokenSeriesMap[sym]?.deltas[pt.index];
          const newEntryPrice = newEntryCandle?.close || 1;
          activePos = {
            symbol: sym,
            entryTime: pt.time,
            entryPrice: newEntryPrice,
            allocatedCapital: balance,
            currentPrice: newEntryPrice,
            livePnlPct: 0,
            livePnlUsd: 0,
            liveCapital: balance
          };
        } else {
          // Même Roi toujours en place, mise à jour du prix
          const candle = tokenSeriesMap[sym]?.deltas[pt.index];
          const p = candle?.close || activePos.entryPrice;
          const pnlPct = activePos.entryPrice > 0 ? ((p - activePos.entryPrice) / activePos.entryPrice) * 100 : 0;
          activePos.currentPrice = p;
          activePos.livePnlPct = parseFloat(pnlPct.toFixed(2));
          activePos.livePnlUsd = parseFloat((activePos.allocatedCapital * (pnlPct / 100)).toFixed(2));
          activePos.liveCapital = parseFloat((balance + activePos.livePnlUsd).toFixed(2));
        }

        lastProcessed = pt.time;
      });

      return {
        ...prev,
        currentBalance: parseFloat(balance.toFixed(2)),
        activePosition: activePos,
        tradesHistory: history.slice(0, 50), // Garder les 50 derniers trades
        lastProcessedTs: lastProcessed
      };
    });
  }, [kingsAnalysis]);

  // 3. Graphique Exclusif des Rois
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
      seriesMapRef.current = {};
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
      layout: { background: { color: 'rgba(3, 7, 18, 0.98)' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.04)' }, horzLines: { color: 'rgba(255, 255, 255, 0.04)' } },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        autoScale: true,
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
    });

    if (kingsAnalysis && kingsAnalysis.kingsList) {
      const smoothWindow = timeframe === '24h' ? 4 : timeframe === '7d' ? 8 : 16;
      const alpha = 2 / (smoothWindow + 1);

      kingsAnalysis.kingsList.forEach(king => {
        const lineSeries = chart.addLineSeries({
          color: king.color,
          lineWidth: king.isCurrentKing ? 3 : 2,
          lineStyle: 0,
          title: `👑 ${king.symbol} (Post-Top1: +${king.postCrownGainPct}% | Règne: ${king.reignHours}h)`,
          priceLineVisible: false,
          lastValueVisible: true,
        });

        const cleanData = [];
        let ema = king.seriesData[0]?.perf || 0;

        king.seriesData.forEach((pt, idx) => {
          if (idx === 0) {
            ema = pt.perf;
          } else {
            ema = (pt.perf * alpha) + (ema * (1 - alpha));
          }
          cleanData.push({
            time: pt.time,
            value: parseFloat(ema.toFixed(2))
          });
        });

        lineSeries.setData(cleanData);
        seriesMapRef.current[king.symbol] = lineSeries;
      });
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, [kingsAnalysis, timeframe]);

  if (!kingsAnalysis || kingsAnalysis.kingsList.length === 0) {
    return null;
  }

  const { kingsList } = kingsAnalysis;
  const activeTrade = botState.activePosition;
  const currentTotalEquity = activeTrade ? (botState.currentBalance + (activeTrade.livePnlUsd || 0)) : botState.currentBalance;
  const totalNetGainPct = parseFloat((((currentTotalEquity - botState.initialCapital) / botState.initialCapital) * 100).toFixed(2));
  const winningTrades = botState.tradesHistory.filter(t => t.pnlPct > 0).length + (activeTrade && activeTrade.livePnlPct > 0 ? 1 : 0);
  const totalTradesCount = botState.tradesHistory.length + (activeTrade ? 1 : 0);
  const winRate = totalTradesCount > 0 ? Math.round((winningTrades / totalTradesCount) * 100) : 0;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(8, 14, 28, 0.98) 0%, rgba(3, 7, 18, 0.99) 100%)',
      border: '2px solid rgba(250, 204, 21, 0.35)',
      borderRadius: '16px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      boxShadow: '0 0 35px rgba(250, 204, 21, 0.12)'
    }}>
      {/* 👑 1. HEADER DU HALL OF FAME DES MONARQUES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #facc15, #eab308)',
            padding: '10px',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(250, 204, 21, 0.5)'
          }}>
            <Crown size={24} color="#000" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#facc15', letterSpacing: '0.5px' }}>
                👑 HISTORIQUE & EXTENSION DES MONARQUES TOP 1
              </h2>
              <span style={{ background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', border: '1px solid rgba(250, 204, 21, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '900' }}>
                24/7 AUTONOMOUS BOT
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              تتبع ملوك السوق مع بوت تجريبي يتاجر تلقائياً في الخلفية ويستمر في العمل حتى عند إغلاق الموقع
            </p>
          </div>
        </div>

        {/* SÉLECTEUR D'HORIZON (24H / 7D / 30D) */}
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setTimeframe('24h')}
            style={{
              background: timeframe === '24h' ? 'linear-gradient(135deg, #facc15, #eab308)' : 'transparent',
              color: timeframe === '24h' ? '#000' : '#888',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '900',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            🕒 24 HEURES
          </button>
          <button
            onClick={() => setTimeframe('7d')}
            style={{
              background: timeframe === '7d' ? 'linear-gradient(135deg, #facc15, #eab308)' : 'transparent',
              color: timeframe === '7d' ? '#000' : '#888',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '900',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            📅 7 JOURS (SEMAINE)
          </button>
          <button
            onClick={() => setTimeframe('30d')}
            style={{
              background: timeframe === '30d' ? 'linear-gradient(135deg, #facc15, #eab308)' : 'transparent',
              color: timeframe === '30d' ? '#000' : '#888',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '900',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            🌕 30 JOURS (MOIS)
          </button>
        </div>
      </div>

      {/* 🤖 2. BANDEAU PERSISTANT DU SIMULATEUR DÉMO BOT (SURVIT À LA FERMETURE DU SITE) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.14) 0%, rgba(8, 16, 32, 0.98) 100%)',
        border: '2px solid rgba(0, 255, 136, 0.45)',
        borderRadius: '14px',
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 0 35px rgba(0, 255, 136, 0.18)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#00ff88', color: '#000', padding: '6px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Play size={14} fill="#000" /> DÉMO BOT (PERSISTANT 24/7 EN ARRIÈRE-PLAN)
            </div>
            <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
              🛡️ يواصل الدخول والخروج من الصفقات وحفظ الأرباح حتى عند إغلاق المتصفح
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#888' }}>CAPITAL ACTUEL</div>
              <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#fff' }}>
                ${currentTotalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#888' }}>GAIN NET CUMULÉ</div>
              <div style={{ fontSize: '1.35rem', fontWeight: '900', color: totalNetGainPct >= 0 ? '#00ff88' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowUpRight size={20} />
                {totalNetGainPct >= 0 ? '+' : ''}{totalNetGainPct}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#888' }}>WIN RATE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#38bdf8' }}>
                {winRate}% ({winningTrades}/{totalTradesCount})
              </div>
            </div>
            <button
              onClick={handleResetBot}
              title="Réinitialiser le capital du bot à $1,000"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#94a3b8',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RotateCcw size={13} /> RESET
            </button>
          </div>
        </div>

        {/* Trade Actuel en Direct */}
        {activeTrade ? (
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(0, 255, 136, 0.35)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#facc15', color: '#000', padding: '3px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '0.74rem' }}>
                👑 POSITION ACTIVE EN DIRECT
              </span>
              <strong style={{ color: '#fff', fontSize: '1.05rem' }}>{activeTrade.symbol} / USDT</strong>
              <span style={{ fontSize: '0.78rem', color: '#888' }}>
                Acheté à ${activeTrade.entryPrice.toFixed(activeTrade.entryPrice < 0.01 ? 6 : 4)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                Prix Spot: ${activeTrade.currentPrice ? activeTrade.currentPrice.toFixed(activeTrade.currentPrice < 0.01 ? 6 : 4) : '--'}
              </div>
              <div style={{
                background: (activeTrade.livePnlPct || 0) >= 0 ? 'rgba(0, 255, 136, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: (activeTrade.livePnlPct || 0) >= 0 ? '#00ff88' : '#ef4444',
                border: `1px solid ${(activeTrade.livePnlPct || 0) >= 0 ? '#00ff88' : '#ef4444'}`,
                padding: '5px 12px',
                borderRadius: '6px',
                fontWeight: '900',
                fontSize: '0.88rem'
              }}>
                PnL Latent: {(activeTrade.livePnlPct || 0) >= 0 ? '+' : ''}{activeTrade.livePnlPct || 0}% (+${activeTrade.livePnlUsd || 0})
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#888', textAlign: 'center', padding: '6px' }}>
            En attente du prochain Roi Top 1 pour ouvrir la position automatique...
          </div>
        )}

        {/* Bouton pour afficher le Journal des Trades Passés */}
        {botState.tradesHistory.length > 0 && (
          <div>
            <button
              onClick={() => setShowFullTradeLog(!showFullTradeLog)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: 0
              }}
            >
              <History size={14} />
              {showFullTradeLog ? 'MASQUER LE JOURNAL DES TRADES' : `AFFICHER L'HISTORIQUE DES ${botState.tradesHistory.length} TRADES EXÉCUTÉS`}
            </button>

            {showFullTradeLog && (
              <div style={{ marginTop: '10px', maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '6px' }}>TOKEN</th>
                      <th style={{ padding: '6px' }}>ENTRÉE ($t_0$)</th>
                      <th style={{ padding: '6px' }}>SORTIE (PASSATION)</th>
                      <th style={{ padding: '6px' }}>PNL (%)</th>
                      <th style={{ padding: '6px' }}>PNL ($)</th>
                      <th style={{ padding: '6px' }}>CAPITAL APRÈS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botState.tradesHistory.map((t, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px', fontWeight: 'bold', color: '#fff' }}>👑 {t.symbol}</td>
                        <td style={{ padding: '6px', color: '#888' }}>${t.entryPrice.toFixed(t.entryPrice < 0.01 ? 6 : 4)}</td>
                        <td style={{ padding: '6px', color: '#888' }}>${t.exitPrice.toFixed(t.exitPrice < 0.01 ? 6 : 4)}</td>
                        <td style={{ padding: '6px', fontWeight: 'bold', color: t.pnlPct >= 0 ? '#00ff88' : '#ef4444' }}>
                          {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct}%
                        </td>
                        <td style={{ padding: '6px', fontWeight: 'bold', color: t.pnlUsd >= 0 ? '#00ff88' : '#ef4444' }}>
                          {t.pnlUsd >= 0 ? '+' : ''}${t.pnlUsd}
                        </td>
                        <td style={{ padding: '6px', color: '#38bdf8', fontWeight: 'bold' }}>${t.balanceAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 📊 3. GRAPHIQUE ÉPURÉ DES ROIS DU TOP 1 */}
      <div style={{ background: 'rgba(3, 7, 18, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
          <span style={{ color: '#facc15', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Crown size={16} color="#facc15" />
            CHARTE DE SUCCESSION ET EXTENSION DES ROIS TOP 1 ({timeframe.toUpperCase()})
          </span>
          <span style={{ color: '#888' }}>
            {kingsList.length} Rois Détectés sur la période | Calcul pur post-couronnement
          </span>
        </div>
        <div ref={chartContainerRef} style={{ width: '100%', height: '380px', borderRadius: '8px', overflow: 'hidden' }} />
      </div>

      {/* 🎴 4. TABLEAU DÉTAILLÉ AVEC GAIN PUR POST-TOP 1 (t0 -> Pic) */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#888', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ padding: '10px 14px' }}>MONARQUE</th>
              <th style={{ padding: '10px 14px' }}>PRIX À t0 (SACRE #1)</th>
              <th style={{ padding: '10px 14px' }}>🚀 GAIN PUR POST-TOP 1</th>
              <th style={{ padding: '10px 14px' }}>🏔️ PRIX AU SOMMET</th>
              <th style={{ padding: '10px 14px' }}>⏱️ TEMPS JUSQU'AU PIC</th>
              <th style={{ padding: '10px 14px' }}>⏳ DURÉE DE RÈGNE</th>
              <th style={{ padding: '10px 14px' }}>STATUT DU CYCLE</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {kingsList.map((king) => {
              const formattedDate = new Date(king.t0Time * 1000).toLocaleDateString('fr-FR', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });

              return (
                <tr
                  key={king.symbol}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: king.isCurrentKing ? 'rgba(250, 204, 21, 0.08)' : 'transparent',
                    transition: 'background 0.2s ease'
                  }}
                >
                  {/* Symbole & Date t0 */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: king.color,
                        color: '#000',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: '900'
                      }}>
                        👑
                      </span>
                      <div>
                        <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{king.symbol}</strong>
                        <div style={{ fontSize: '0.66rem', color: '#888' }}>Sacre t0 : {formattedDate}</div>
                      </div>
                    </div>
                  </td>

                  {/* Prix Spot à t0 */}
                  <td style={{ padding: '12px 14px', color: '#cbd5e1', fontWeight: 'bold' }}>
                    ${king.priceAtT0 ? king.priceAtT0.toFixed(king.priceAtT0 < 0.01 ? 6 : 4) : '--'}
                  </td>

                  {/* Gain Pur Post-Top 1 */}
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      background: king.postCrownGainPct > 15 ? 'rgba(0, 255, 136, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                      color: king.postCrownGainPct > 15 ? '#00ff88' : '#38bdf8',
                      border: `1px solid ${king.postCrownGainPct > 15 ? 'rgba(0, 255, 136, 0.5)' : 'rgba(56, 189, 248, 0.4)'}`,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: '900',
                      fontSize: '0.86rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <ArrowUpRight size={14} />
                      +{king.postCrownGainPct}%
                    </span>
                  </td>

                  {/* Prix au Sommet (Peak) */}
                  <td style={{ padding: '12px 14px', color: '#00ff88', fontWeight: '900', fontSize: '0.88rem' }}>
                    ${king.maxPricePostT0 ? king.maxPricePostT0.toFixed(king.maxPricePostT0 < 0.01 ? 6 : 4) : '--'}
                  </td>

                  {/* Temps pour atteindre le pic */}
                  <td style={{ padding: '12px 14px', color: '#fb923c', fontWeight: 'bold' }}>
                    ⚡ {king.timeToPeakHours}h
                  </td>

                  {/* Durée de Règne */}
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontWeight: '900' }}>
                      ⏳ {king.reignHours}h
                    </span>
                  </td>

                  {/* Statut */}
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      background: `${king.status.color}15`,
                      color: king.status.color,
                      border: `1px solid ${king.status.color}40`,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: '900'
                    }}>
                      {king.status.label}
                    </span>
                  </td>

                  {/* Action */}
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectToken && onSelectToken(king.symbol)}
                      style={{
                        background: 'rgba(250, 204, 21, 0.15)',
                        color: '#facc15',
                        border: '1px solid rgba(250, 204, 21, 0.4)',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: '900',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      CHARTE <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
