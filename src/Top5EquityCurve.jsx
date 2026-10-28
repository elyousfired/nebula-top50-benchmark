import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { TrendingUp, TrendingDown, Activity, Award, ShieldAlert, Zap, ChevronDown, ChevronUp } from 'lucide-react';

export default function Top5EquityCurve({ trades = [], livePrices = {} }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 1. Calculate live PnL for each trade & full portfolio performance
  const { totalPnL, closedPnL, runningPnL, maxPeak, maxDrawdown, winRate, curveData } = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { totalPnL: 0, closedPnL: 0, runningPnL: 0, maxPeak: 0, maxDrawdown: 0, winRate: 0, curveData: [] };
    }

    // Chronological order (oldest trade first)
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = new Date(a.timestamp.replace(' UTC', '')).getTime() || 0;
      const timeB = new Date(b.timestamp.replace(' UTC', '')).getTime() || 0;
      return timeA - timeB;
    });

    let runningSum = 0;
    let closedSum = 0;
    let openSum = 0;
    let peak = 0;
    let maxDd = 0;

    const points = [];
    const seenTimes = new Set();

    // Start baseline at 0.00%
    const firstTradeTime = Math.floor((new Date(sortedTrades[0].timestamp.replace(' UTC', '')).getTime() || Date.now()) / 1000) - 60;
    points.push({ time: firstTradeTime, value: 0 });
    seenTimes.add(firstTradeTime);

    let cumulative = 0;
    sortedTrades.forEach((t) => {
      const isClosed = t.status === 'FERMÉ';
      let tradePnl = 0;

      if (isClosed) {
        tradePnl = t.pnlFinal !== null && t.pnlFinal !== undefined ? t.pnlFinal : 0;
        closedSum += tradePnl;
      } else {
        const currPrice = livePrices[t.symbol] || t.entryPrice;
        tradePnl = t.entryPrice > 0 ? ((currPrice - t.entryPrice) / t.entryPrice) * 100 : 0;
        openSum += tradePnl;
      }

      cumulative += tradePnl;
      if (cumulative > peak) peak = cumulative;
      const dd = cumulative - peak;
      if (dd < maxDd) maxDd = dd;

      const tSec = Math.floor((new Date(t.timestamp.replace(' UTC', '')).getTime() || Date.now()) / 1000);
      let uniqueSec = tSec;
      while (seenTimes.has(uniqueSec)) {
        uniqueSec += 1;
      }
      seenTimes.add(uniqueSec);

      points.push({
        time: uniqueSec,
        value: parseFloat(cumulative.toFixed(2))
      });
    });

    // Add Live real-time current endpoint
    const nowSec = Math.floor(Date.now() / 1000);
    let currentSec = nowSec;
    while (seenTimes.has(currentSec)) {
      currentSec += 1;
    }
    points.push({
      time: currentSec,
      value: parseFloat(cumulative.toFixed(2))
    });

    const total = closedSum + openSum;

    const closedList = trades.filter(t => t.status === 'FERMÉ');
    const wins = closedList.filter(t => (t.pnlFinal || 0) > 0).length;
    const wr = closedList.length > 0 ? (wins / closedList.length) * 100 : 0;

    return {
      totalPnL: total,
      closedPnL: closedSum,
      runningPnL: openSum,
      maxPeak: peak,
      maxDrawdown: maxDd,
      winRate: wr,
      curveData: points
    };
  }, [trades, livePrices]);

  // 2. Initialize and update Lightweight Chart
  useEffect(() => {
    if (!containerRef.current || isCollapsed) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 150,
      layout: {
        background: { color: 'rgba(8, 14, 24, 0.5)' },
        textColor: '#94a3b8',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)', style: 1 },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)', style: 1 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        autoScale: true,
      },
      crosshair: {
        mode: 1,
      },
    });

    const isPositive = totalPnL >= 0;
    const series = chart.addAreaSeries({
      topColor: isPositive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
      bottomColor: isPositive ? 'rgba(16, 185, 129, 0.02)' : 'rgba(244, 63, 94, 0.02)',
      lineColor: isPositive ? '#10b981' : '#f43f5e',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price) => `${price >= 0 ? '+' : ''}${price.toFixed(2)}%`,
      },
    });

    // Add baseline zero reference line
    series.createPriceLine({
      price: 0,
      color: 'rgba(255, 255, 255, 0.3)',
      lineWidth: 1,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: '0.00% BASELINE',
    });

    if (curveData.length > 0) {
      series.setData(curveData);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [curveData, totalPnL, isCollapsed]);

  if (trades.length === 0) return null;

  const isUp = totalPnL >= 0;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      borderRadius: '10px',
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {/* Header & KPI Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={15} color={isUp ? '#10b981' : '#f43f5e'} />
          <span style={{ color: '#f8fafc', fontSize: '0.78rem', fontWeight: '900', letterSpacing: '0.5px' }}>
            COURBE DE PERFORMANCE CUMULÉE LIVE (%)
          </span>
          <span style={{
            background: isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            color: isUp ? '#10b981' : '#f43f5e',
            border: `1px solid ${isUp ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.78rem',
            fontWeight: '900'
          }}>
            {isUp ? '+' : ''}{totalPnL.toFixed(2)}% TOTAL
          </span>
        </div>

        {/* 4 Fast Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.68rem', fontWeight: '700', flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8' }}>
            Fermés : <strong style={{ color: closedPnL >= 0 ? '#10b981' : '#f43f5e' }}>{closedPnL >= 0 ? '+' : ''}{closedPnL.toFixed(2)}%</strong>
          </span>
          <span style={{ color: '#94a3b8' }}>
            En Cours : <strong style={{ color: runningPnL >= 0 ? '#10b981' : '#f43f5e' }}>{runningPnL >= 0 ? '+' : ''}{runningPnL.toFixed(2)}%</strong>
          </span>
          <span style={{ color: '#94a3b8' }}>
            Pic Max : <strong style={{ color: '#10b981' }}>+{maxPeak.toFixed(2)}%</strong>
          </span>
          <span style={{ color: '#94a3b8' }}>
            Max DD : <strong style={{ color: '#f43f5e' }}>{maxDrawdown.toFixed(2)}%</strong>
          </span>

          <button
            onClick={() => setIsCollapsed(prev => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
          >
            {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>

      {/* Interactive Equity Chart Canvas */}
      {!isCollapsed && (
        <div style={{ position: 'relative', width: '100%', height: '150px', borderRadius: '6px', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      )}
    </div>
  );
}
