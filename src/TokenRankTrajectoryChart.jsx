import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { Trophy, TrendingUp, Sparkles, Zap, Target, Flame, Eye, EyeOff, Maximize2, ShieldCheck, Activity } from 'lucide-react';

const TOKEN_STATIC_COLORS = {
  'BTC': '#f7931a', 'ETH': '#627eea', 'SOL': '#a855f7', 'BNB': '#f3ba2f', 'XRP': '#00d2ff',
  'AVAX': '#e84142', 'DOGE': '#c2a633', 'ADA': '#0033ad', 'LINK': '#375bd2', 'DOT': '#e6007a',
  'H': '#ff0055', 'SQD': '#9333ea', 'BR': '#0284c7', 'GRASS': '#65a30d', 'ETHFI': '#2563eb',
  'AVNT': '#db2777', 'ME': '#ea580c', 'LAVA': '#dc2626', 'CATI': '#0891b2', 'BG': '#059669',
  'ROAM': '#eab308', 'CAP': '#c026d3', 'CSPR': '#4f46e5', 'SCRT': '#06b6d4', 'PUMP': '#84cc16',
  'MAJOR': '#f97316', 'NOT': '#00ff88', 'CRCLX': '#38bdf8', 'ESE': '#818cf8', 'RECALL': '#e879f9',
  'FIGHT': '#22d3ee', 'OG': '#a3e635', 'SUPRA': '#f97316', 'COMP': '#00d2ff', 'GPS': '#10b981',
  'PORTAL': '#a855f7', 'PIEVERSE': '#e11d48', 'CHIP': '#facc15', 'WLFI': '#f43f5e', 'FHE': '#06b6d4',
  'GODS': '#38bdf8', 'VVV': '#fb923c', 'DOLO': '#10b981', 'MCRT': '#00d2ff'
};

const PALETTE = [
  '#00ff88', '#00d2ff', '#facc15', '#a855f7', '#ec4899', '#f97316',
  '#06b6d4', '#84cc16', '#e11d48', '#3b82f6', '#10b981', '#6366f1',
  '#d946ef', '#f43f5e', '#fb923c', '#a3e635', '#22d3ee', '#818cf8',
  '#e879f9', '#f472b6', '#38bdf8', '#4ade80', '#fde047', '#c084fc',
  '#fb7185', '#60a5fa', '#34d399', '#a78bfa', '#fbbf24'
];

export function getTokenFixedColor(symbol) {
  const clean = (symbol || '').replace('USDT', '').toUpperCase();
  if (TOKEN_STATIC_COLORS[clean]) return TOKEN_STATIC_COLORS[clean];

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}

export const TokenRankTrajectoryChart = ({ tokensList = [] }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef({});

  const [timeframe, setTimeframe] = useState('7d-1h'); // '15m', '1h', '24h-15m', '24h-1h', '7d-1h', '7d-4h', '30d-4h'
  const [selectedTranche, setSelectedTranche] = useState('1-15'); // '1-10', '1-15', '16-30', '31-50', '51-100', 'climbers'
  const [isolatedSymbol, setIsolatedSymbol] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const isFirstDataRenderRef = useRef(true);

  useEffect(() => {
    isFirstDataRenderRef.current = true;
  }, [timeframe]);

  const handleResetScale = () => {
    if (chartRef.current) {
      try {
        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
        chartRef.current.timeScale().fitContent();
        chartRef.current.timeScale().applyOptions({ rightOffset: 12 });
      } catch (_) {}
    }
  };

  // Mouse Draggable Chart Height
  const storageKey = 'nebula_rank_trajectory_chart_height';
  const [chartHeight, setChartHeight] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return Math.max(300, Math.min(1200, parseInt(saved, 10)));
    } catch (_) {}
    return 540;
  });
  const [isDraggingHeight, setIsDraggingHeight] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  const handleMouseDownResize = (e) => {
    e.preventDefault();
    setIsDraggingHeight(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = chartHeight;
  };

  useEffect(() => {
    if (!isDraggingHeight) return;

    const handleMouseMove = (e) => {
      const deltaY = e.clientY - dragStartYRef.current;
      const newHeight = Math.max(300, Math.min(1200, dragStartHeightRef.current + deltaY));
      setChartHeight(newHeight);
      try { localStorage.setItem(storageKey, newHeight.toString()); } catch (_) {}
    };

    const handleMouseUp = () => {
      setIsDraggingHeight(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHeight]);

  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      chartRef.current.applyOptions({
        height: chartHeight,
        width: chartContainerRef.current.clientWidth
      });
    }
  }, [chartHeight]);

  // 1. Calculate Historical Ranking for all tokens across timePoints
  const rankTrajectoryData = useMemo(() => {
    if (!tokensList || tokensList.length === 0) {
      return { timePoints: [], tokenRanksMap: {}, tokenGainMap: {}, tokensRankSummary: [] };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const nowDate = new Date();
    const utcMidnightTs = Math.floor(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()) / 1000);

    let targetStartTs = nowSec - 7 * 86400; // default 7 days

    if (timeframe === 'today-15m') { targetStartTs = utcMidnightTs; }
    else if (timeframe === '15m')     { targetStartTs = nowSec - 15 * 60; }
    else if (timeframe === '1h')      { targetStartTs = nowSec - 3600; }
    else if (timeframe === '24h-15m') { targetStartTs = nowSec - 24 * 3600; }
    else if (timeframe === '24h-1h')  { targetStartTs = nowSec - 24 * 3600; }
    else if (timeframe === '7d-1h')   { targetStartTs = nowSec - 7 * 86400; }
    else if (timeframe === '7d-4h')   { targetStartTs = nowSec - 7 * 86400; }
    else if (timeframe === '30d-4h')  { targetStartTs = nowSec - 30 * 86400; }
    const validTokens = tokensList.filter(t => t.ratioSeries && t.ratioSeries.length >= 5);
    if (validTokens.length === 0) {
      return { timePoints: [], tokenRanksMap: {}, tokenGainMap: {}, tokensRankSummary: [] };
    }

    // A. Gather unique timestamps within window
    const timePointsSet = new Set();
    validTokens.forEach(token => {
      token.ratioSeries.forEach(item => {
        const t = typeof item === 'object' ? item.time : null;
        if (t && t >= targetStartTs) {
          timePointsSet.add(t);
        }
      });
    });

    let timePoints = Array.from(timePointsSet).sort((a, b) => a - b);

    // Fallback if series timestamps don't span window
    if (timePoints.length < 5) {
      const maxLen = Math.max(...validTokens.map(t => t.ratioSeries.length));
      timePoints = Array.from({ length: Math.min(96, maxLen) }, (_, i) => nowSec - (96 - i) * 900);
    }

    // B. Calculate relative performance at each timestamp
    const tokenPerfOverTime = {};
    validTokens.forEach(token => {
      const rSeries = token.ratioSeries;
      let startIdx = rSeries.findIndex(item => (typeof item === 'object' ? item.time : 0) >= targetStartTs);
      if (startIdx < 0 || startIdx >= rSeries.length) {
        startIdx = Math.max(0, rSeries.length - 96);
      }

      const startObj = rSeries[startIdx] || rSeries[0];
      const startRatio = typeof startObj === 'object' ? startObj.close : startObj;
      if (!startRatio || startRatio <= 0 || isNaN(startRatio)) return;

      const pMap = {};
      for (let i = startIdx; i < rSeries.length; i++) {
        const item = rSeries[i];
        const val = typeof item === 'object' ? item.close : item;
        const t = typeof item === 'object' ? item.time : null;
        if (t) {
          pMap[t] = ((val - startRatio) / startRatio) * 100;
        }
      }
      tokenPerfOverTime[token.cleanSymbol] = { pMap, startRatio };
    });

    // C. Reconstruct Ranks (1 to N) at each timestamp
    const tokenRanksMap = {};
    const tokenGainMap = {};
    validTokens.forEach(t => {
      tokenRanksMap[t.cleanSymbol] = [];
      tokenGainMap[t.cleanSymbol] = [];
    });

    timePoints.forEach(t => {
      const activeSnapshot = [];
      validTokens.forEach(token => {
        const sym = token.cleanSymbol;
        const info = tokenPerfOverTime[sym];
        if (!info) return;
        const gain = info.pMap[t] !== undefined ? info.pMap[t] : (token.score || 0);
        activeSnapshot.push({ token, sym, gain });
      });

      // Sort snapshot by gain descending (Rank #1 is highest gain)
      activeSnapshot.sort((a, b) => b.gain - a.gain);

      activeSnapshot.forEach((item, rankIdx) => {
        const rank = rankIdx + 1;
        // We invert rank using negative values: -1 = Rank #1 (Top of chart), -50 = Rank #50 (Bottom)
        tokenRanksMap[item.sym].push({ time: t, value: -rank });
        tokenGainMap[item.sym].push({ time: t, gain: item.gain, rank });
      });
    });

    // D. Build Summary metrics for each token
    const tokensRankSummary = validTokens.map(token => {
      const sym = token.cleanSymbol;
      const rankSeries = tokenRanksMap[sym] || [];
      const currentRankObj = rankSeries[rankSeries.length - 1];
      const startRankObj = rankSeries[0];

      const currentRank = currentRankObj ? Math.abs(currentRankObj.value) : 999;
      const startRank = startRankObj ? Math.abs(startRankObj.value) : 999;
      const bestRank = rankSeries.length > 0 ? Math.min(...rankSeries.map(r => Math.abs(r.value))) : 999;
      const rankDelta = startRank - currentRank; // Positive = climbed up the ladder (e.g. #100 -> #5 = +95)

      return {
        ...token,
        currentRank,
        startRank,
        bestRank,
        rankDelta,
      };
    });

    // Sort summary by current rank
    tokensRankSummary.sort((a, b) => a.currentRank - b.currentRank);

    return { timePoints, tokenRanksMap, tokenGainMap, tokensRankSummary };
  }, [tokensList, timeframe]);

  // Filter Tokens to Plot based on Selected Tranche or Climbers Filter
  const activeTokensToPlot = useMemo(() => {
    const { tokensRankSummary } = rankTrajectoryData;
    if (!tokensRankSummary || tokensRankSummary.length === 0) return [];

    if (isolatedSymbol) {
      return tokensRankSummary.filter(t => t.cleanSymbol === isolatedSymbol);
    }

    if (selectedTranche === '1-10') {
      return tokensRankSummary.slice(0, 10);
    }
    if (selectedTranche === '1-15') {
      return tokensRankSummary.slice(0, 15);
    }
    if (selectedTranche === '16-30') {
      return tokensRankSummary.slice(15, 30);
    }
    if (selectedTranche === '31-50') {
      return tokensRankSummary.slice(30, 50);
    }
    if (selectedTranche === '51-100') {
      return tokensRankSummary.slice(50, 100);
    }
    if (selectedTranche === 'climbers') {
      // Top Climbers: Tokens that made the biggest climb in rank!
      return [...tokensRankSummary].sort((a, b) => b.rankDelta - a.rankDelta).slice(0, 15);
    }

    return tokensRankSummary.slice(0, 15);
  }, [rankTrajectoryData, selectedTranche, isolatedSymbol]);

  // 2. Initialize Lightweight Chart on Mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
      layout: {
        background: { color: 'rgba(8,14,24,0.98)' },
        textColor: '#ffffff',
        fontSize: 12,
        fontFamily: 'JetBrains Mono, monospace'
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.18)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.18)' }
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 210, 255, 0.3)',
        scaleMargins: { top: 0.06, bottom: 0.06 },
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true
      },
      crosshair: {
        vertLine: { color: '#00d2ff', width: 1, style: 2 },
        horzLine: { color: '#00d2ff', width: 1, style: 2 }
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || param.seriesData.size === 0) {
        setHoveredInfo(null);
        return;
      }
      const activeHoverList = [];
      param.seriesData.forEach((valObj, series) => {
        const sym = series.symbolRef;
        if (sym && valObj) {
          const rank = Math.abs(Math.round(valObj.value));
          activeHoverList.push({ sym, rank });
        }
      });
      activeHoverList.sort((a, b) => a.rank - b.rank);
      setHoveredInfo({ time: param.time, list: activeHoverList.slice(0, 5) });
    });

    chartRef.current = chart;
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, []);

  // 3. Update Line Series on Data or Tranche Change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || activeTokensToPlot.length === 0) return;

    const { tokenRanksMap } = rankTrajectoryData;
    const activeSymbolsSet = new Set(activeTokensToPlot.map(t => t.cleanSymbol));

    // Remove inactive series
    Object.keys(seriesMapRef.current).forEach(sym => {
      if (!activeSymbolsSet.has(sym)) {
        try { chart.removeSeries(seriesMapRef.current[sym]); } catch (_) {}
        delete seriesMapRef.current[sym];
      }
    });

    // Add or update active series
    activeTokensToPlot.forEach((token, idx) => {
      const sym = token.cleanSymbol;
      const dataPoints = tokenRanksMap[sym] || [];
      if (dataPoints.length === 0) return;

      const baseColor = getTokenFixedColor(sym);
      const isLeader = token.currentRank <= 3;
      const isIsolated = isolatedSymbol === sym;

      let lineSeries = seriesMapRef.current[sym];
      if (lineSeries) {
        lineSeries.setData(dataPoints);
        lineSeries.applyOptions({
          color: baseColor,
          lineWidth: isIsolated ? 5 : (isLeader ? 3.5 : 2.2),
          title: `#${token.currentRank} ${sym} (Départ: #${token.startRank})`,
        });
      } else {
        lineSeries = chart.addLineSeries({
          color: baseColor,
          lineWidth: isIsolated ? 5 : (isLeader ? 3.5 : 2.2),
          title: `#${token.currentRank} ${sym} (Départ: #${token.startRank})`,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        lineSeries.symbolRef = sym;
        lineSeries.setData(dataPoints);
        seriesMapRef.current[sym] = lineSeries;
      }
    });

    // 🎯 Preserve user zoom: fitContent ONLY on very first render or timeframe change
    if (isFirstDataRenderRef.current) {
      chart.timeScale().fitContent();
      chart.timeScale().applyOptions({ rightOffset: 12 });
      isFirstDataRenderRef.current = false;
    }
  }, [activeTokensToPlot, rankTrajectoryData, isolatedSymbol]);

  return (
    <div style={{ background: 'rgba(8,14,24,0.98)', border: '2px solid rgba(0,210,255,0.4)', borderRadius: '16px', padding: '20px', boxShadow: '0 0 35px rgba(0,210,255,0.15)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(0,210,255,0.15)', border: '1px solid #00d2ff', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={22} color="#00d2ff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#00d2ff', fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                📈 TRAJECTOIRE DU RANG DANS LE TEMPS (HISTORIQUE DU CLASSEMENT)
              </span>
              <span style={{ background: '#00d2ff', color: '#000000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '900' }}>
                #1 EN HAUT
              </span>
            </div>
            <span style={{ color: '#888888', fontSize: '0.75rem' }}>
              Trace l'ascension et la chute de la position de chaque token (#1, #5, #50...) au fil des heures.
            </span>
          </div>
        </div>

        {/* Timeframe Switcher */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
          {[
            { id: 'today-15m', label: "📅 AUJOURD'HUI (00:00 UTC)" },
            { id: '15m',     label: '⚡ 15 MIN' },
            { id: '1h',      label: '⏱️ 1 HEURE' },
            { id: '24h-15m', label: '24H ROLLING (15m)' },
            { id: '24h-1h',  label: '24H (1H)' },
            { id: '7d-1h',   label: '📅 7J WEEKLY (1H)' },
            { id: '7d-4h',   label: '7J (4H)' },
            { id: '30d-4h',  label: '🗓️ 30 JOURS' }
          ].map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              style={{
                background: timeframe === tf.id ? '#00d2ff' : 'transparent',
                color: timeframe === tf.id ? '#000000' : '#888888',
                border: 'none',
                padding: '5px 11px',
                borderRadius: '6px',
                fontWeight: '900',
                fontSize: '0.76rem',
                cursor: 'pointer',
                boxShadow: timeframe === tf.id ? '0 0 10px rgba(0,210,255,0.5)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {tf.label}
            </button>
          ))}

          <button
            onClick={handleResetScale}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#00d2ff',
              border: '1px solid rgba(0,210,255,0.4)',
              padding: '5px 11px',
              borderRadius: '6px',
              fontWeight: '900',
              fontSize: '0.76rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Cliquez pour réinitialiser le zoom des axes à la vue par défaut !"
          >
            🔄 RESET ÉCHELLE
          </button>
        </div>
      </div>

      {/* Tranche Selector Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '8px 12px', background: 'rgba(0,210,255,0.08)', borderRadius: '10px', border: '1px solid rgba(0,210,255,0.3)', scrollbarWidth: 'thin' }}>
        <span style={{ color: '#00d2ff', fontSize: '0.78rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', paddingRight: '6px' }}>
          🎯 SÉLECTION DU FAISCEAU DE RANGS :
        </span>
        {[
          { id: '1-10',     label: '🥇 TOP 1 À 10' },
          { id: '1-15',     label: '🏆 TOP 1 À 15' },
          { id: '16-30',    label: '🥈 TOP 16 À 30' },
          { id: '31-50',    label: '🥉 TOP 31 À 50' },
          { id: '51-100',   label: '🎖️ TOP 51 À 100' },
          { id: 'climbers', label: '🚀 PLUS FORTES ASCENSIONS (CLIMBERS)' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => {
              setSelectedTranche(item.id);
              setIsolatedSymbol(null);
            }}
            style={{
              background: selectedTranche === item.id && !isolatedSymbol ? '#00d2ff' : 'rgba(255,255,255,0.06)',
              color: selectedTranche === item.id && !isolatedSymbol ? '#000000' : '#ffffff',
              border: selectedTranche === item.id && !isolatedSymbol ? 'none' : '1px solid rgba(0,210,255,0.3)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: '900',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: selectedTranche === item.id && !isolatedSymbol ? '0 0 12px rgba(0,210,255,0.6)' : 'none',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Interactive Token Isolation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '6px 10px', background: 'rgba(0,0,0,0.6)', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.2)', scrollbarWidth: 'thin' }}>
        <span style={{ color: '#00ff88', fontSize: '0.74rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', paddingRight: '4px' }}>
          🎯 ISOLER UN JETON :
        </span>

        {isolatedSymbol && (
          <button
            onClick={() => setIsolatedSymbol(null)}
            style={{
              background: '#00ff88',
              color: '#000000',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '900',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 0 10px rgba(0,255,136,0.6)',
            }}
          >
            🌐 VOIR TOUS LES RANGS DU GROUPE
          </button>
        )}

        {activeTokensToPlot.map(token => {
          const sym = token.cleanSymbol;
          const isIsolated = isolatedSymbol === sym;
          const baseColor = getTokenFixedColor(sym);
          const climbed = token.rankDelta > 0;

          return (
            <button
              key={sym}
              onClick={() => setIsolatedSymbol(prev => prev === sym ? null : sym)}
              style={{
                background: isIsolated ? baseColor : (isolatedSymbol ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)'),
                color: isIsolated ? '#000000' : (isolatedSymbol ? '#555555' : '#ffffff'),
                border: `1px solid ${isIsolated ? baseColor : 'rgba(255,255,255,0.15)'}`,
                borderLeft: `4px solid ${baseColor}`,
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: '900',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: (isolatedSymbol && !isIsolated) ? 0.35 : 1,
                transition: 'all 0.2s ease',
                boxShadow: isIsolated ? `0 0 12px ${baseColor}` : 'none',
              }}
              title={`Rang Actuel: #${token.currentRank} | Rang de Départ: #${token.startRank} | Meilleur: #${token.bestRank}`}
            >
              #{token.currentRank} {sym} {climbed ? `(🔺+${token.rankDelta} pl.)` : (token.rankDelta < 0 ? `(🔻${token.rankDelta})` : '')}
            </button>
          );
        })}
      </div>

      {/* Main Chart Canvas */}
      <div style={{ position: 'relative' }}>
        <div
          ref={chartContainerRef}
          style={{
            width: '100%',
            height: `${chartHeight}px`,
            borderRadius: '10px 10px 0 0',
            overflow: 'hidden',
          }}
        />

        {/* Hover Inspector Overlay */}
        {hoveredInfo && hoveredInfo.list && (
          <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(8,14,24,0.92)', border: '1px solid rgba(0,210,255,0.5)', padding: '6px 12px', borderRadius: '8px', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '3px', zIndex: 10, boxShadow: '0 0 15px rgba(0,0,0,0.8)' }}>
            <span style={{ color: '#00d2ff', fontSize: '0.72rem', fontWeight: '900' }}>
              📍 CLASSEMENT À CET INSTANT :
            </span>
            {hoveredInfo.list.map(item => (
              <span key={item.sym} style={{ color: getTokenFixedColor(item.sym), fontSize: '0.75rem', fontWeight: 'bold' }}>
                #{item.rank} {item.sym}
              </span>
            ))}
          </div>
        )}

        {/* Mouse Drag Resize Handle */}
        <div
          onMouseDown={handleMouseDownResize}
          style={{
            width: '100%',
            height: '24px',
            background: isDraggingHeight ? 'rgba(0, 210, 255, 0.35)' : 'rgba(255, 255, 255, 0.06)',
            borderTop: '1px dashed rgba(0, 210, 255, 0.5)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0 0 10px 10px',
            cursor: 'row-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            userSelect: 'none',
            transition: 'background 0.2s ease',
            boxShadow: isDraggingHeight ? '0 0 15px rgba(0,210,255,0.4)' : 'none'
          }}
          title="Cliquez et glissez vers le bas ou le haut pour redimensionner la hauteur du graphique !"
        >
          <div style={{ width: '40px', height: '4px', background: isDraggingHeight ? '#00d2ff' : '#666', borderRadius: '2px' }} />
          <span style={{ color: isDraggingHeight ? '#00d2ff' : '#cccccc', fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.5px' }}>
            ↕️ GLISSER À LA SOURIS POUR REDIMENSIONNER LA HAUTEUR ({chartHeight}px)
          </span>
          <div style={{ width: '40px', height: '4px', background: isDraggingHeight ? '#00d2ff' : '#666', borderRadius: '2px' }} />
        </div>
      </div>
    </div>
  );
};
