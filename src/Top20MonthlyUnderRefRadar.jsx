import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { 
  Trophy, Target, Zap, Flame, ShieldAlert, ArrowRight, ArrowUpRight, 
  Activity, CheckCircle2, AlertCircle, ChevronRight, Layers, Sparkles,
  RotateCcw
} from 'lucide-react';

const PALETTE = [
  '#38bdf8', '#00ff88', '#facc15', '#f43f5e', '#a855f7', 
  '#fb923c', '#e879f9', '#22d3ee', '#a3e635', '#fdba74',
  '#ec4899', '#818cf8', '#34d399', '#f472b6', '#3b82f6',
  '#10b981', '#6366f1', '#e11d48', '#84cc16', '#d946ef',
  '#14b8a6', '#f59e0b', '#06b6d4', '#8b5cf6', '#00e5ff'
];

function getTokenFixedColor(symbol) {
  if (!symbol) return '#38bdf8';
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}

export default function Top20MonthlyUnderRefRadar({ tokensList = [], onSelectToken }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef({});
  const refMonthlySeriesRef = useRef(null);
  const refDailySeriesRef = useRef(null);
  const hasFittedOnceRef = useRef(false);

  const [chartHeight, setChartHeight] = useState(520);
  const [isDraggingHeight, setIsDraggingHeight] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(520);

  const [filterMode, setFilterMode] = useState('under_ref'); // 'under_ref' | 'attacking' | 'broken' | 'all_top20'
  const [selectedTokens, setSelectedTokens] = useState([]);

  // Gestion du glissement de la souris pour changer la hauteur
  const handleMouseDownHeight = (e) => {
    setIsDraggingHeight(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = chartHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingHeight) return;
      const deltaY = e.clientY - dragStartYRef.current;
      const newHeight = Math.max(320, Math.min(1200, dragStartHeightRef.current + deltaY));
      setChartHeight(newHeight);
      if (chartRef.current) {
        chartRef.current.applyOptions({ height: newHeight });
      }
    };
    const handleMouseUp = () => {
      if (isDraggingHeight) {
        setIsDraggingHeight(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };
    if (isDraggingHeight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHeight]);

  // 1. CALCUL DYNAMIQUE RÉEL DE LA LIGNE DE RÉFÉRENCE MENSUELLE (ÉVOLUTIVE DANS LE TEMPS)
  const radarData = useMemo(() => {
    if (!tokensList || tokensList.length === 0) return { candidates: [], underRefList: [], attackingList: [], brokenList: [], dynamicMonthlyRefLevel: 18.0, dailyRefLevel: 2.0, timePoints: [], monthlyRefCurve: [], dailyRefCurve: [] };

    const validTokens = tokensList.filter(t => (t.ratioSeries && t.ratioSeries.length >= 8) || (t.rawUsdtSeries && t.rawUsdtSeries.length >= 8));
    if (validTokens.length === 0) return { candidates: [], underRefList: [], attackingList: [], brokenList: [], dynamicMonthlyRefLevel: 18.0, dailyRefLevel: 2.0, timePoints: [], monthlyRefCurve: [], dailyRefCurve: [] };

    // Extraire les bougies des 30 derniers jours (1000 bougies) pour tous les tokens
    const positiveTokens30d = validTokens.filter(t => {
      const isStock = t.cleanSymbol.endsWith('X') && ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'GOOGL', 'META'].some(s => t.cleanSymbol.startsWith(s));
      return !isStock;
    });

    let longestSeries = [];
    positiveTokens30d.forEach(t => {
      const s = t.ratioSeries || t.rawUsdtSeries || [];
      if (s.length > longestSeries.length) longestSeries = s;
    });

    const sliced24hGlobal = longestSeries.slice(Math.max(0, longestSeries.length - 96));
    const timePoints = sliced24hGlobal.map(c => typeof c === 'object' ? c.time : 0).filter(t => t > 0);

    // A. Calculer la courbe de référence mensuelle dynamique à chaque instant t des dernières 24H
    const monthlyRefCurve = timePoints.map((targetTime) => {
      let sum30d = 0;
      let count30d = 0;

      positiveTokens30d.forEach(t => {
        const raw = t.ratioSeries || t.rawUsdtSeries || [];
        const sliced30d = raw.slice(Math.max(0, raw.length - 1000));
        if (sliced30d.length >= 8) {
          const start30dPrice = typeof sliced30d[0] === 'object' ? sliced30d[0].close : sliced30d[0];
          // Trouver le prix à l'instant targetTime
          const candleAtTime = sliced30d.find(c => (typeof c === 'object' ? c.time : 0) === targetTime);
          const priceAtTime = candleAtTime ? (typeof candleAtTime === 'object' ? candleAtTime.close : candleAtTime) : (typeof sliced30d[sliced30d.length - 1] === 'object' ? sliced30d[sliced30d.length - 1].close : sliced30d[sliced30d.length - 1]);
          
          if (start30dPrice > 0 && priceAtTime > 0) {
            const perf30dAtTime = ((priceAtTime - start30dPrice) / start30dPrice) * 100;
            // On ne prend que les tokens positifs (Score >= 0) comme dans la référence groupe
            if (perf30dAtTime >= 0) {
              sum30d += perf30dAtTime;
              count30d++;
            }
          }
        }
      });

      return count30d > 0 ? parseFloat((sum30d / count30d).toFixed(2)) : 17.5;
    });

    // Valeur actuelle en direct de la Référence Mensuelle (Ex: 18.06%)
    const currentDynamicMonthlyRef = monthlyRefCurve.length > 0 ? monthlyRefCurve[monthlyRefCurve.length - 1] : 18.0;

    // B. Courbe de référence 24H dynamique
    const dailyRefCurve = timePoints.map((targetTime) => {
      let sum24h = 0;
      let count24h = 0;

      positiveTokens30d.forEach(t => {
        const raw = t.ratioSeries || t.rawUsdtSeries || [];
        const sliced24h = raw.slice(Math.max(0, raw.length - 96));
        if (sliced24h.length >= 8) {
          const start24hPrice = typeof sliced24h[0] === 'object' ? sliced24h[0].close : sliced24h[0];
          const candleAtTime = sliced24h.find(c => (typeof c === 'object' ? c.time : 0) === targetTime);
          const priceAtTime = candleAtTime ? (typeof candleAtTime === 'object' ? candleAtTime.close : candleAtTime) : (typeof sliced24h[sliced24h.length - 1] === 'object' ? sliced24h[sliced24h.length - 1].close : sliced24h[sliced24h.length - 1]);
          
          if (start24hPrice > 0 && priceAtTime > 0) {
            const perf24hAtTime = ((priceAtTime - start24hPrice) / start24hPrice) * 100;
            if (perf24hAtTime >= 0) {
              sum24h += perf24hAtTime;
              count24h++;
            }
          }
        }
      });

      return count24h > 0 ? parseFloat((sum24h / count24h).toFixed(2)) : 2.5;
    });

    const currentDailyRef = dailyRefCurve.length > 0 ? dailyRefCurve[dailyRefCurve.length - 1] : 2.5;

    // C. Analyser chaque token individuel
    const analyzedMonthly = positiveTokens30d.map(t => {
      const raw = t.ratioSeries || t.rawUsdtSeries || [];
      const sliced30d = raw.slice(Math.max(0, raw.length - 1000));
      if (sliced30d.length < 5) return null;

      const start30d = typeof sliced30d[0] === 'object' ? sliced30d[0].close : sliced30d[0];
      const curClose = typeof sliced30d[sliced30d.length - 1] === 'object' ? sliced30d[sliced30d.length - 1].close : sliced30d[sliced30d.length - 1];
      const perf30d = start30d > 0 ? ((curClose - start30d) / start30d) * 100 : 0;

      const sliced24h = raw.slice(Math.max(0, raw.length - 96));
      const start24h = typeof sliced24h[0] === 'object' ? sliced24h[0].close : sliced24h[0];
      const perf24h = start24h > 0 ? ((curClose - start24h) / start24h) * 100 : 0;

      const len24 = sliced24h.length;
      const p1hClose = typeof sliced24h[Math.max(0, len24 - 5)] === 'object' ? sliced24h[Math.max(0, len24 - 5)].close : sliced24h[Math.max(0, len24 - 5)];
      const p2hClose = typeof sliced24h[Math.max(0, len24 - 9)] === 'object' ? sliced24h[Math.max(0, len24 - 9)].close : sliced24h[Math.max(0, len24 - 9)];
      const speedCur = p1hClose > 0 ? ((curClose - p1hClose) / p1hClose) * 100 : 0;
      const speedPrev = p2hClose > 0 ? ((p1hClose - p2hClose) / p2hClose) * 100 : 0;
      const acc24h = parseFloat((speedCur - speedPrev).toFixed(2));

      let hh30d = start30d;
      sliced30d.forEach(c => {
        const h = typeof c === 'object' ? (c.high || c.close) : c;
        if (h > hh30d) hh30d = h;
      });
      const distToHhPct = hh30d > 0 ? parseFloat((((curClose - hh30d) / hh30d) * 100).toFixed(2)) : 0;

      // Courbe 24H lissée EMA
      const alpha = 2 / (8 + 1);
      let ema = 0;
      const dataPoints = [];
      sliced24h.forEach((c, idx) => {
        const tTime = typeof c === 'object' ? c.time : 0;
        const pClose = typeof c === 'object' ? c.close : c;
        if (tTime > 0) {
          const perf = start24h > 0 ? ((pClose - start24h) / start24h) * 100 : 0;
          if (idx === 0) ema = perf;
          else ema = (perf * alpha) + (ema * (1 - alpha));
          dataPoints.push({ time: tTime, value: parseFloat(ema.toFixed(2)) });
        }
      });

      return {
        symbol: t.cleanSymbol,
        token: t,
        price: curClose,
        perf30d: parseFloat(perf30d.toFixed(2)),
        perf24h: parseFloat(perf24h.toFixed(2)),
        acc24h,
        hh30d: parseFloat(hh30d.toFixed(hh30d < 0.01 ? 6 : 4)),
        distToHhPct,
        dataPoints
      };
    }).filter(Boolean);

    analyzedMonthly.sort((a, b) => b.perf30d - a.perf30d);
    const top20Monthly = analyzedMonthly.slice(0, 20);

    const candidates = top20Monthly.map((t, idx) => {
      const distToMonthlyRef = parseFloat((t.perf24h - currentDynamicMonthlyRef).toFixed(2));
      
      let status = {
        label: '💤 SOUS LA RÉSISTANCE (EN REPLI)',
        color: '#94a3b8',
        badge: 'PRÉPARATION',
        isAttacking: false,
        isBroken: false
      };

      if (t.perf24h >= currentDynamicMonthlyRef) {
        status = {
          label: '🔥 BREAKOUT DE LA RÉSISTANCE (EN DIRECT !)',
          color: '#00ff88',
          badge: `PORTAIL FRANCHI (>${currentDynamicMonthlyRef}%)`,
          isAttacking: false,
          isBroken: true
        };
      } else if (distToMonthlyRef >= -5.0 && t.acc24h > 0) {
        status = {
          label: '⚡ ATTAQUE IMMINENTE DU PORTAIL (13%-18%)',
          color: '#facc15',
          badge: 'ZONE DE TEST (BREAKOUT IMMINENT)',
          isAttacking: true,
          isBroken: false
        };
      }

      return {
        ...t,
        rank30d: idx + 1,
        distToMonthlyRef,
        status
      };
    });

    const underRefList = candidates.filter(c => c.perf24h < currentDynamicMonthlyRef);
    const attackingList = candidates.filter(c => c.status.isAttacking);
    const brokenList = candidates.filter(c => c.status.isBroken);

    return {
      timePoints,
      monthlyRefCurve,
      dailyRefCurve,
      candidates,
      underRefList,
      attackingList,
      brokenList,
      dynamicMonthlyRefLevel: currentDynamicMonthlyRef,
      dailyRefLevel: currentDailyRef
    };
  }, [tokensList]);

  const handleToggleToken = (sym) => {
    setSelectedTokens(prev => {
      if (prev.includes(sym)) {
        return prev.filter(s => s !== sym);
      } else {
        return [...prev, sym];
      }
    });
  };

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  // 2. CRÉATION DU GRAPHIQUE AU MONTAGE
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth || 800,
      height: chartHeight,
      layout: { background: { color: 'rgba(8,14,24,0.95)' }, textColor: '#ffffff', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.15)' }, horzLines: { color: 'rgba(42, 46, 57, 0.15)' } },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        scaleMargins: { top: 0.08, bottom: 0.08 },
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 15,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true
      },
    });

    // Ligne Jaune Évolutive Référence 30D (Dynamique avec le marché !)
    refMonthlySeriesRef.current = chart.addLineSeries({
      color: '#facc15',
      lineWidth: 2.5,
      lineStyle: 2,
      title: '🟡 RÉSISTANCE MACRO 30D (DYNAMIQUE)',
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // Ligne Blanche Évolutive Référence 24H (Dynamique avec le marché !)
    refDailySeriesRef.current = chart.addLineSeries({
      color: '#ffffff',
      lineWidth: 2,
      lineStyle: 0,
      title: '⚪ SOL DE DÉPART 24H (DYNAMIQUE)',
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    chartRef.current = chart;

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (_) {}
        chartRef.current = null;
        seriesMapRef.current = {};
        hasFittedOnceRef.current = false;
      }
    };
  }, []);

  // 3. MISE À JOUR IN-PLACE DES COURBES AVEC LA LIGNE DYNAMIQUE RÉELLE
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !radarData || !radarData.candidates || radarData.candidates.length === 0) return;

    const { timePoints, monthlyRefCurve, dailyRefCurve, candidates, dynamicMonthlyRefLevel, dailyRefLevel } = radarData;
    if (!timePoints || timePoints.length === 0) return;

    let tokensToDraw = [];
    if (selectedTokens.length > 0) {
      tokensToDraw = candidates.filter(c => selectedTokens.includes(c.symbol));
    } else if (filterMode === 'all_top20') {
      tokensToDraw = candidates;
    } else if (filterMode === 'attacking') {
      tokensToDraw = radarData.attackingList.length > 0 ? radarData.attackingList : candidates.slice(0, 6);
    } else if (filterMode === 'under_ref') {
      tokensToDraw = radarData.underRefList.length > 0 ? radarData.underRefList : candidates;
    } else if (filterMode === 'broken') {
      tokensToDraw = radarData.brokenList.length > 0 ? radarData.brokenList : candidates;
    } else {
      tokensToDraw = candidates;
    }

    if (tokensToDraw.length === 0) tokensToDraw = candidates;

    // 1. Mettre à jour la vraie courbe jaune dynamique du mois (qui ondule et évolue avec le marché !)
    if (refMonthlySeriesRef.current && monthlyRefCurve && monthlyRefCurve.length > 0) {
      refMonthlySeriesRef.current.applyOptions({ title: `🟡 RÉSISTANCE MACRO 30D DYNAMIQUE (${dynamicMonthlyRefLevel}%)` });
      refMonthlySeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: monthlyRefCurve[idx] || dynamicMonthlyRefLevel })));
    }

    // 2. Mettre à jour la vraie courbe blanche dynamique de 24H
    if (refDailySeriesRef.current && dailyRefCurve && dailyRefCurve.length > 0) {
      refDailySeriesRef.current.applyOptions({ title: `⚪ SOL DE DÉPART 24H DYNAMIQUE (${dailyRefLevel}%)` });
      refDailySeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: dailyRefCurve[idx] || dailyRefLevel })));
    }

    // 3. Gestion des séries des tokens
    const activeSymbolsSet = new Set(tokensToDraw.map(t => t.symbol));

    Object.keys(seriesMapRef.current).forEach(sym => {
      if (!activeSymbolsSet.has(sym)) {
        try {
          chart.removeSeries(seriesMapRef.current[sym]);
          delete seriesMapRef.current[sym];
        } catch (_) {}
      }
    });

    tokensToDraw.forEach((item) => {
      const fixedColor = getTokenFixedColor(item.symbol);
      const title = `👑 #${item.rank30d} ${item.symbol} (24H: ${item.perf24h}% | 30D: +${item.perf30d}% | Acc: ${item.acc24h >= 0 ? '+' : ''}${item.acc24h}%/h)`;

      let lineSeries = seriesMapRef.current[item.symbol];
      if (!lineSeries) {
        lineSeries = chart.addLineSeries({
          color: fixedColor,
          lineWidth: 2,
          lineStyle: 0,
          title: title,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        seriesMapRef.current[item.symbol] = lineSeries;
      } else {
        lineSeries.applyOptions({ color: fixedColor, title });
      }

      if (item.dataPoints && item.dataPoints.length > 0) {
        lineSeries.setData(item.dataPoints);
      }
    });

    if (!hasFittedOnceRef.current) {
      chart.timeScale().fitContent();
      hasFittedOnceRef.current = true;
    }
  }, [radarData, filterMode, selectedTokens]);

  const { candidates = [], underRefList = [], attackingList = [], brokenList = [], dynamicMonthlyRefLevel = 18.0, dailyRefLevel = 2.5 } = radarData || {};

  const displayedList = filterMode === 'under_ref' ? underRefList :
                        filterMode === 'attacking' ? attackingList :
                        filterMode === 'broken' ? brokenList : candidates;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(8, 14, 28, 0.98) 0%, rgba(3, 7, 18, 0.99) 100%)',
      border: '2px solid rgba(250, 204, 21, 0.45)',
      borderRadius: '16px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      boxShadow: '0 0 35px rgba(250, 204, 21, 0.15)'
    }}>
      {/* 👑 1. HEADER DU RADAR TOP 20 SOUS LA RÉSISTANCE 17% */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #facc15, #eab308)',
            padding: '10px',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(250, 204, 21, 0.5)'
          }}>
            <Trophy size={24} color="#000" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#facc15', letterSpacing: '0.5px' }}>
                👑 RADAR TOP 20 DU MOIS SOUS LA RÉSISTANCE MENSUELLE ({dynamicMonthlyRefLevel}%)
              </h2>
              <span style={{ background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', border: '1px solid rgba(250, 204, 21, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '900' }}>
                RÉFÉRENCE DYNAMIQUE ÉVOLUTIVE
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              رصد أبطال الـ 20 شهرياً مع خط المقاومة الشهري المتحرك والمتنفس مع سيولة السوق بالدقيقة ({dynamicMonthlyRefLevel}%)
            </p>
          </div>
        </div>

        {/* ONGLETS DE FILTRAGE RAPIDE & BOUTON RESET ZOOM */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setFilterMode('under_ref'); setSelectedTokens([]); }}
              style={{
                background: filterMode === 'under_ref' ? 'linear-gradient(135deg, #facc15, #eab308)' : 'transparent',
                color: filterMode === 'under_ref' ? '#000' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              📉 SOUS LA RÉSISTANCE ({underRefList.length})
            </button>
            <button
              onClick={() => { setFilterMode('attacking'); setSelectedTokens([]); }}
              style={{
                background: filterMode === 'attacking' ? '#facc15' : 'transparent',
                color: filterMode === 'attacking' ? '#000' : '#facc15',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              ⚡ EN ATTAQUE DU PORTAIL ({attackingList.length})
            </button>
            <button
              onClick={() => { setFilterMode('broken'); setSelectedTokens([]); }}
              style={{
                background: filterMode === 'broken' ? '#00ff88' : 'transparent',
                color: filterMode === 'broken' ? '#000' : '#00ff88',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              🔥 BREAKOUT ACTIF ({brokenList.length})
            </button>
            <button
              onClick={() => { setFilterMode('all_top20'); setSelectedTokens([]); }}
              style={{
                background: filterMode === 'all_top20' ? 'linear-gradient(135deg, #38bdf8, #0284c7)' : 'transparent',
                color: filterMode === 'all_top20' ? '#fff' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              👑 TOUT LE TOP 20 ({candidates.length})
            </button>
          </div>

          <button
            onClick={handleResetZoom}
            title="Réinitialiser le zoom de la souris et ajuster la vue"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCcw size={13} /> RESET ZOOM
          </button>
        </div>
      </div>

      {/* 📊 2. GRAPHIQUE 24H AVEC BARRE DE REDIMENSIONNEMENT VERTICAL À LA SOURIS */}
      <div style={{ background: 'rgba(3, 7, 18, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ color: '#fff', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={16} color="#facc15" />
            {filterMode === 'all_top20' ? 'CHARTE DES 20 CHAMPIONS DU TOP 20 DU MOIS' :
             filterMode === 'under_ref' ? `CHARTE DES ${underRefList.length} CHAMPIONS SOUS LA RÉSISTANCE MENSUELLE (${dynamicMonthlyRefLevel}%)` :
             filterMode === 'broken' ? `CHARTE DES ${brokenList.length} CHAMPIONS EN BREAKOUT ACTIF (>${dynamicMonthlyRefLevel}%)` :
             'CHARTE DES CANDIDATS EN ATTAQUE DU PORTAIL'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.72rem' }}>
            <span style={{ color: '#facc15' }}>🟡 Résistance Macro 30D Dynamique ({dynamicMonthlyRefLevel}%)</span>
            <span style={{ color: '#ffffff' }}>⚪ Sol 24H Dynamique ({dailyRefLevel}%)</span>
            <span style={{ color: '#94a3b8' }}>💡 Zoom : Roulette souris | Glisser axes</span>
          </div>
        </div>

        {/* CANVAS DU GRAPHIQUE */}
        <div ref={chartContainerRef} style={{ width: '100%', height: `${chartHeight}px`, borderRadius: '8px', overflow: 'hidden' }} />

        {/* ↕️ BARRE DE REDIMENSIONNEMENT VERTICAL À LA SOURIS */}
        <div
          onMouseDown={handleMouseDownHeight}
          style={{
            width: '100%',
            height: '24px',
            background: isDraggingHeight ? 'rgba(250, 204, 21, 0.25)' : 'rgba(255, 255, 255, 0.04)',
            borderTop: isDraggingHeight ? '2px solid #facc15' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0 0 8px 8px',
            cursor: 'row-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            userSelect: 'none',
            transition: 'background 0.2s ease',
            boxShadow: isDraggingHeight ? '0 0 15px rgba(250, 204, 21, 0.4)' : 'none'
          }}
          title="Cliquez et glissez vers le bas ou le haut avec la souris pour agrandir ou réduire la hauteur du graphique !"
        >
          <div style={{ width: '40px', height: '4px', background: isDraggingHeight ? '#facc15' : '#666', borderRadius: '2px' }} />
          <span style={{ color: isDraggingHeight ? '#facc15' : '#cccccc', fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.5px' }}>
            ↕️ GLISSER À LA SOURIS POUR REDIMENSIONNER LA HAUTEUR ({chartHeight}px)
          </span>
          <div style={{ width: '40px', height: '4px', background: isDraggingHeight ? '#facc15' : '#666', borderRadius: '2px' }} />
        </div>
      </div>

      {/* 🎴 3. TABLEAU DES CANDIDATS DU TOP 20 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#888', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ padding: '8px 10px' }}>RANG 30D</th>
              <th style={{ padding: '8px 10px' }}>TOKEN</th>
              <th style={{ padding: '8px 10px' }}>GAIN MOIS (30D)</th>
              <th style={{ padding: '8px 10px' }}>PERF 24H</th>
              <th style={{ padding: '8px 10px' }}>PRIX SPOT</th>
              <th style={{ padding: '8px 10px' }}>ÉCART AU SEUIL {dynamicMonthlyRefLevel}%</th>
              <th style={{ padding: '8px 10px' }}>ACCÉLÉRATION 24H</th>
              <th style={{ padding: '8px 10px' }}>STATUT / SIGNAL</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {displayedList.map((item) => {
              const isSelected = selectedTokens.includes(item.symbol);
              const fixedColor = getTokenFixedColor(item.symbol);
              return (
                <tr
                  key={item.symbol}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: item.status.isBroken ? 'rgba(0, 255, 136, 0.08)' : item.status.isAttacking ? 'rgba(250, 204, 21, 0.08)' : isSelected ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <td style={{ padding: '10px', color: item.rank30d <= 3 ? '#facc15' : '#888', fontWeight: '900' }}>
                    #{item.rank30d}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: fixedColor, display: 'inline-block' }} />
                      <strong style={{ color: '#fff', fontSize: '0.90rem' }}>{item.symbol}</strong>
                    </div>
                  </td>
                  <td style={{ padding: '10px', color: '#00ff88', fontWeight: 'bold' }}>
                    +{item.perf30d}%
                  </td>
                  <td style={{ padding: '10px', color: item.perf24h >= 0 ? '#38bdf8' : '#ef4444', fontWeight: 'bold' }}>
                    {item.perf24h >= 0 ? '+' : ''}{item.perf24h}%
                  </td>
                  <td style={{ padding: '10px', color: '#cbd5e1' }}>
                    ${item.price.toFixed(item.price < 0.01 ? 6 : 4)}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      color: item.distToMonthlyRef >= 0 ? '#00ff88' : item.distToMonthlyRef >= -5.0 ? '#facc15' : '#fb923c',
                      fontWeight: '900'
                    }}>
                      {item.distToMonthlyRef >= 0 ? `+${item.distToMonthlyRef}%` : `${item.distToMonthlyRef}%`}
                    </span>
                  </td>
                  <td style={{ padding: '10px', color: item.acc24h >= 0 ? '#00ff88' : '#f43f5e', fontWeight: 'bold' }}>
                    {item.acc24h >= 0 ? '+' : ''}{item.acc24h}%/h
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      background: `${item.status.color}15`,
                      color: item.status.color,
                      border: `1px solid ${item.status.color}40`,
                      padding: '4px 8px',
                      borderRadius: '5px',
                      fontSize: '0.66rem',
                      fontWeight: '900'
                    }}>
                      {item.status.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleToken(item.symbol)}
                      style={{
                        background: isSelected ? fixedColor : 'rgba(255,255,255,0.06)',
                        color: isSelected ? '#000' : '#fff',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.70rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {isSelected ? '✓ MASQUER' : '+ CHARTE'}
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
