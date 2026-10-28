import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { Flame, Eye, Sparkles, TrendingDown, ZoomIn, EyeOff } from 'lucide-react';

const TOKEN_STATIC_COLORS = {
  'BTC': '#f7931a', 'ETH': '#627eea', 'SOL': '#a855f7', 'BNB': '#f3ba2f', 'XRP': '#00d2ff',
  'AVAX': '#e84142', 'DOGE': '#c2a633', 'ADA': '#0033ad', 'LINK': '#375bd2', 'DOT': '#e6007a',
  'H': '#ff0055', 'SQD': '#9333ea', 'BR': '#0284c7', 'GRASS': '#65a30d', 'ETHFI': '#2563eb',
  'AVNT': '#db2777', 'ME': '#ea580c', 'LAVA': '#dc2626', 'CATI': '#0891b2', 'BG': '#059669',
  'ROAM': '#eab308', 'CAP': '#c026d3', 'CSPR': '#4f46e5', 'SCRT': '#06b6d4', 'PUMP': '#84cc16',
  'MAJOR': '#f97316', 'NOT': '#00ff88', 'CRCLX': '#38bdf8', 'ESE': '#818cf8', 'RECALL': '#e879f9',
  'FIGHT': '#22d3ee', 'OG': '#a3e635'
};

const PALETTE = [
  '#00ff88', '#00d2ff', '#facc15', '#a855f7', '#ec4899', '#f97316',
  '#06b6d4', '#84cc16', '#e11d48', '#3b82f6', '#10b981', '#6366f1',
  '#d946ef', '#f43f5e', '#fb923c', '#a3e635', '#22d3ee', '#818cf8',
  '#e879f9', '#f472b6', '#38bdf8', '#4ade80', '#fde047', '#c084fc',
  '#fb7185', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fbbf24'
];

function getTokenFixedColor(symbol) {
  const clean = (symbol || '').replace('USDT', '').toUpperCase();
  if (TOKEN_STATIC_COLORS[clean]) return TOKEN_STATIC_COLORS[clean];

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}

export const Top50DeltaRadar = ({ tokensList = [], onSelectToken }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef({});
  const [timeframe, setTimeframe] = useState('24h-15m');
  const [hoveredSymbol, setHoveredSymbol] = useState(null);
  const [activeZoomHours, setActiveZoomHours] = useState(0);
  const [hideBelowGroup, setHideBelowGroup] = useState(true); // Default TRUE to hide tokens below ref line automatically!

  const trackedSymbolsRef = useRef(new Set());

  // 1. Filter ALL positive tokens (Score >= 0.0) for the Group Reference Line
  const positiveTokens = useMemo(() => {
    return tokensList.filter(t => t.score >= 0.0);
  }, [tokensList]);

  // 2. Extract Top 50 tokens sorted by Score descending (Ranks #1 to #50)
  const top50Tokens = useMemo(() => {
    return [...positiveTokens]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 50);
  }, [positiveTokens]);

  // 3. Compute 100% REAL HISTORICAL TRAJECTORIES FOR ALL POSITIVE TOKENS & TOP 50
  const realTrajectoryData = useMemo(() => {
    if (positiveTokens.length === 0) return { timePoints: [], groupCurve: [], tokenCurvesMap: {}, tokensBelowGroup: [] };

    const nowSec = Math.floor(Date.now() / 1000);
    let timeWindowSec = 24 * 3600;

    if (timeframe === '24h-15m') { timeWindowSec = 24 * 3600; }
    if (timeframe === '24h-1h')  { timeWindowSec = 24 * 3600; }
    if (timeframe === '24h-4h')  { timeWindowSec = 24 * 3600; }
    if (timeframe === '7d-1h')   { timeWindowSec = 7 * 86400;  }
    if (timeframe === '30d-4h')  { timeWindowSec = 30 * 86400; }

    const targetStartTs = nowSec - timeWindowSec;
    const tokenCurvesMap = {};
    let masterTimePoints = [];

    positiveTokens.forEach(token => {
      const rSeries = token.ratioSeries;
      if (!rSeries || rSeries.length < 5) return;

      let startIdx = rSeries.findIndex(item => {
        const t = typeof item === 'object' ? item.time : 0;
        return t >= targetStartTs;
      });
      if (startIdx < 0 || startIdx >= rSeries.length) {
        startIdx = Math.max(0, rSeries.length - 96);
      }

      const startObj = rSeries[startIdx] || rSeries[0];
      const startRatio = typeof startObj === 'object' ? startObj.close : startObj;
      if (!startRatio || startRatio <= 0 || isNaN(startRatio)) return;

      const curve = [];
      const times = [];

      for (let i = startIdx; i < rSeries.length; i++) {
        const item = rSeries[i];
        const val = typeof item === 'object' ? item.close : item;
        const t   = typeof item === 'object' ? item.time : null;

        const pctChange = ((val - startRatio) / startRatio) * 100;
        curve.push(pctChange);
        if (t) times.push(t);
      }

      tokenCurvesMap[token.cleanSymbol] = curve;
      if (times.length > masterTimePoints.length) masterTimePoints = times;
    });

    if (masterTimePoints.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      masterTimePoints = Array.from({ length: 96 }, (_, i) => now - (96 - i) * 900);
    }

    // Compute Group Average Curve across ALL positive tokens (N ~ 296)
    const groupCurve = masterTimePoints.map((_, idx) => {
      let sum = 0;
      let count = 0;
      Object.values(tokenCurvesMap).forEach(c => {
        if (c[idx] !== undefined && !isNaN(c[idx])) {
          sum += c[idx];
          count++;
        }
      });
      return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
    });

    const latestGroupVal = groupCurve[groupCurve.length - 1] || 0;

    // Persist tokens that were below OR crossed above during the live session!
    top50Tokens.forEach(token => {
      const curve = tokenCurvesMap[token.cleanSymbol];
      if (curve && curve.length > 0) {
        const latestVal = curve[curve.length - 1] || 0;
        if (latestVal <= latestGroupVal) {
          trackedSymbolsRef.current.add(token.cleanSymbol);
        }
      }
    });

    const tokensBelowGroup = top50Tokens
      .map((token, index) => ({ ...token, tableRank: index + 1 }))
      .filter(token => {
        const curve = tokenCurvesMap[token.cleanSymbol];
        if (!curve || curve.length === 0) return false;
        const latestVal = curve[curve.length - 1] || 0;

        const isCurrentlyBelow = latestVal <= latestGroupVal;
        const wasTrackedBelow = trackedSymbolsRef.current.has(token.cleanSymbol);

        return isCurrentlyBelow || wasTrackedBelow;
      });

    return { timePoints: masterTimePoints, groupCurve, tokenCurvesMap, tokensBelowGroup };
  }, [positiveTokens, top50Tokens, timeframe]);

  // Filter tokens to plot based on hideBelowGroup setting
  const filteredTokensToPlot = useMemo(() => {
    const { tokensBelowGroup, tokenCurvesMap, groupCurve } = realTrajectoryData;
    if (!hideBelowGroup) return tokensBelowGroup;

    const latestGroupVal = groupCurve[groupCurve.length - 1] || 0;
    return tokensBelowGroup.filter(token => {
      const curve = tokenCurvesMap[token.cleanSymbol];
      if (!curve || curve.length === 0) return false;
      const latestVal = curve[curve.length - 1] || 0;
      return latestVal >= latestGroupVal;
    });
  }, [realTrajectoryData, hideBelowGroup]);

  // Render Comparative Radar Chart for TOP 50 BELOW GROUP LINE & LIVE CROSSES
  useEffect(() => {
    if (!chartContainerRef.current || top50Tokens.length === 0) return;

    const { timePoints, groupCurve, tokenCurvesMap } = realTrajectoryData;
    if (!timePoints || timePoints.length === 0) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
    }
    seriesMapRef.current = {};

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 620,
      layout: { background: { color: 'rgba(8,14,24,0.95)' }, textColor: '#b2b5be' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.15)' }, horzLines: { color: 'rgba(42, 46, 57, 0.15)' } },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        timeVisible: true,
        rightOffset: 85,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // White/Red Group Reference Series
    const groupSeries = chart.addLineSeries({
      color: '#ffffff',
      lineWidth: 3,
      lineStyle: 0,
      title: 'LIGNE DE RÉFÉRENCE DU GROUPE (TOP 50)',
    });
    groupSeries.setData(timePoints.map((t, idx) => ({ time: t, value: groupCurve[idx] })));

    // Plot curves for tokens with FIXED PERSISTENT COLORS
    filteredTokensToPlot.forEach((token) => {
      const curve = tokenCurvesMap[token.cleanSymbol];
      if (!curve) return;

      const latestVal = curve[curve.length - 1] || 0;
      const latestGroupVal = groupCurve[groupCurve.length - 1] || 0;
      const isCrossedAbove = latestVal > latestGroupVal;

      const baseColor = getTokenFixedColor(token.cleanSymbol);

      const lineSeries = chart.addLineSeries({
        color: baseColor,
        lineWidth: isCrossedAbove ? 3.5 : 2,
        title: `#${token.tableRank} ${token.cleanSymbol} ${isCrossedAbove ? '🎯 CROSSE LIVE' : ''}`,
      });

      lineSeries.setData(timePoints.map((t, idx) => ({
        time: t,
        value: parseFloat((curve[idx] || 0).toFixed(2)),
      })));

      // Find exact upward cross candle index
      let crossIdx = -1;
      for (let i = 1; i < curve.length; i++) {
        const prevTok = curve[i - 1];
        const prevGrp = groupCurve[i - 1];
        const curTok  = curve[i];
        const curGrp  = groupCurve[i];
        if (prevTok <= prevGrp && curTok > curGrp) {
          crossIdx = i;
        }
      }

      if (crossIdx !== -1 && timePoints[crossIdx]) {
        lineSeries.setMarkers([
          {
            time: timePoints[crossIdx],
            position: 'aboveBar',
            color: baseColor,
            shape: 'circle',
            text: `🎯 CROSSE LIVE (${token.cleanSymbol})`,
          }
        ]);
      }

      seriesMapRef.current[token.cleanSymbol] = { series: lineSeries, baseColor };
    });

    if (activeZoomHours > 0) {
      const totalCandles = timePoints.length;
      let candlesPerHour = 4;
      if (timeframe === '24h-1h' || timeframe === '7d-1h') candlesPerHour = 1;
      if (timeframe === '24h-4h' || timeframe === '30d-4h') candlesPerHour = 0.25;
      const numCandles = Math.max(3, Math.round(activeZoomHours * candlesPerHour));
      const fromLogical = Math.max(0, totalCandles - numCandles);
      const toLogical = totalCandles - 1 + 85;
      try { chart.timeScale().setVisibleLogicalRange({ from: fromLogical, to: toLogical }); } catch (_) { chart.timeScale().fitContent(); }
    } else {
      chart.timeScale().fitContent();
    }
    chart.timeScale().applyOptions({ rightOffset: 85 });
    chartRef.current = chart;

    return () => {
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, [realTrajectoryData, top50Tokens, filteredTokensToPlot, activeZoomHours, timeframe]);

  // Update line opacities on hover focus
  useEffect(() => {
    Object.entries(seriesMapRef.current).forEach(([sym, { series, baseColor }]) => {
      if (!series) return;
      if (!hoveredSymbol) {
        series.applyOptions({ color: baseColor, lineWidth: 2 });
      } else if (sym === hoveredSymbol) {
        series.applyOptions({ color: baseColor, lineWidth: 5 });
      } else {
        series.applyOptions({ color: 'rgba(255,255,255,0.05)', lineWidth: 1 });
      }
    });
  }, [hoveredSymbol]);

  const latestGroupVal = realTrajectoryData.groupCurve[realTrajectoryData.groupCurve.length - 1] || 0;

  // Zoom Helper Function using Logical Candle Ranges
  const zoomToZone = (hours) => {
    setActiveZoomHours(hours);
    if (!chartRef.current || !realTrajectoryData.timePoints || realTrajectoryData.timePoints.length === 0) return;

    const timeScale = chartRef.current.timeScale();
    const len = realTrajectoryData.timePoints.length;

    if (hours === 0) {
      timeScale.fitContent();
      return;
    }

    let candlesPerHour = 4;
    if (timeframe === '24h-1h' || timeframe === '7d-1h') candlesPerHour = 1;
    if (timeframe === '24h-4h' || timeframe === '30d-4h') candlesPerHour = 0.25;

    const numCandles = Math.max(3, Math.round(hours * candlesPerHour));
    const fromLogical = Math.max(0, len - numCandles);
    const toLogical = len - 1 + 85;

    try {
      timeScale.setVisibleLogicalRange({
        from: fromLogical,
        to: toLogical,
      });
    } catch (_) {
      const lastTime = realTrajectoryData.timePoints[len - 1];
      const fromTime = lastTime - hours * 3600;
      try {
        timeScale.setVisibleRange({ from: fromTime, to: lastTime });
      } catch (e) {}
    }
  };

  return (
    <div style={{
      background: 'rgba(8,14,24,0.95)',
      border: '2px solid rgba(0,255,136,0.3)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 0 30px rgba(0,255,136,0.1)',
      margin: '20px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
    }}>
      {/* HEADER & TIMEFRAME BUTTONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Flame size={22} color="#00ff88" />
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: '900' }}>
            🔥 RADAR TOP 50 : TOKENS SITUÉS EN-DESSOUS DE LA LIGNE DE RÉFÉRENCE ({realTrajectoryData.tokensBelowGroup.length} TOKENS)
          </h3>
          <span style={{ background: 'rgba(0,255,136,0.15)', color: '#00ff88', border: '1px solid #00ff88', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '900' }}>
            ⚡ 100% SYNCHRO TABLEAU (#1 À #50)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Timeframe selector buttons */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { id: '24h-15m', label: '24H (15m)' },
              { id: '24h-1h',  label: '24H (1H)' },
              { id: '24h-4h',  label: '24H (4H)' },
              { id: '7d-1h',   label: '7J (1H)' },
              { id: '30d-4h',  label: '30J (4H)' },
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                style={{
                  background: timeframe === tf.id ? '#00ff88' : 'transparent',
                  color: timeframe === tf.id ? '#000' : '#888',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: '900',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Zoom & Focus Buttons Bar */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '10px', border: '1px solid rgba(250,204,21,0.4)', flexWrap: 'wrap' }}>
            <span style={{ color: '#facc15', fontSize: '0.75rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ZoomIn size={14} color="#facc15" /> ZOOM :
            </span>
            {[
              { hours: 0, label: 'Vue Globale' },
              { hours: 6, label: '🔍 6h Récentes' },
              { hours: 3, label: '🔍 3h Récentes' },
              { hours: 1, label: '⚡ Zone 1H Récente' },
            ].map(btn => (
              <button
                key={btn.hours}
                onClick={() => zoomToZone(btn.hours)}
                style={{
                  background: activeZoomHours === btn.hours ? '#facc15' : 'rgba(250,204,21,0.12)',
                  color: activeZoomHours === btn.hours ? '#000' : '#facc15',
                  border: `1px solid ${activeZoomHours === btn.hours ? '#facc15' : 'rgba(250,204,21,0.3)'}`,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: activeZoomHours === btn.hours ? '900' : 'bold',
                  cursor: 'pointer',
                  boxShadow: activeZoomHours === btn.hours ? '0 0 12px rgba(250,204,21,0.6)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Group reference value badge & Hide below group button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setHideBelowGroup(!hideBelowGroup)}
            style={{
              background: hideBelowGroup ? '#ff3366' : 'rgba(255,255,255,0.06)',
              color: hideBelowGroup ? '#ffffff' : '#cccccc',
              border: `1px solid ${hideBelowGroup ? '#ff3366' : 'rgba(255,255,255,0.2)'}`,
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: hideBelowGroup ? '0 0 14px rgba(255,51,102,0.5)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {hideBelowGroup ? <EyeOff size={16} color="#ffffff" /> : <Eye size={16} color="#00ff88" />}
            {hideBelowGroup ? '👁️ MASQUER SOUS RÉF. : ACTIF (BASSES MASQUÉES)' : '👁️ MASQUER TOKENS SOUS RÉF.'}
          </button>

          <div style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '6px 14px', borderRadius: '8px', border: '1px solid #fff', fontWeight: '900', fontSize: '0.85rem' }}>
            ⚪ Réf. Groupe: {latestGroupVal >= 0 ? '+' : ''}{latestGroupVal.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* TOKEN ISOLATION CHIPS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        <span style={{ color: '#00ff88', fontSize: '0.78rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles size={14} color="#00ff88" /> ISOLER UN TOKEN :
        </span>
        {filteredTokensToPlot.map((tok, idx) => {
          const curve = realTrajectoryData.tokenCurvesMap[tok.cleanSymbol];
          const latestVal = curve ? curve[curve.length - 1] || 0 : 0;
          const isCrossed = latestVal > latestGroupVal;
          const isHovered = hoveredSymbol === tok.cleanSymbol;
          const chipColor = getTokenFixedColor(tok.cleanSymbol);
          return (
            <button
              key={tok.symbol}
              onMouseEnter={() => setHoveredSymbol(tok.cleanSymbol)}
              onMouseLeave={() => setHoveredSymbol(null)}
              onClick={() => onSelectToken && onSelectToken(tok.cleanSymbol)}
              style={{
                background: isHovered ? chipColor : (isCrossed ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.06)'),
                color: isHovered ? '#000' : (isCrossed ? '#00ff88' : '#ccc'),
                border: `1px solid ${isHovered || isCrossed ? chipColor : 'rgba(255,255,255,0.15)'}`,
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: isCrossed ? '0 0 8px rgba(0,255,136,0.4)' : 'none',
              }}
            >
              {isCrossed ? '🎯 ' : ''}#{tok.tableRank || idx + 1} {tok.cleanSymbol}
            </button>
          );
        })}
      </div>

      {/* CHART CANVAS */}
      <div ref={chartContainerRef} style={{ width: '100%', height: '620px', borderRadius: '12px', overflow: 'hidden' }} />
    </div>
  );
};

export default Top50DeltaRadar;
