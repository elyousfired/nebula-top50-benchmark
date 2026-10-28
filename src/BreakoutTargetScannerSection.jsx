import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import {
  Target, Search, RotateCcw, Settings, CheckCircle, AlertTriangle,
  TrendingUp, BarChart2, Zap, ArrowUpRight, ShieldAlert, Sparkles,
  Layers, Radio, Flame, Crosshair, HelpCircle, Eye, ShieldCheck,
  Calculator, DollarSign, Percent, Scale, TrendingDown
} from 'lucide-react';
import { calculateBreakoutTargetLogic } from './logic/breakoutTargetLogic';

const POPULAR_TOKENS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT', 'DOGEUSDT', 'PEPEUSDT', 'XRPUSDT', 'BNBUSDT', 'AVAXUSDT', 'LINKUSDT', 'NEARUSDT', 'APTUSDT'];

const TIMEFRAMES = [
  { label: '15m', value: '15', desc: '15 دقيقة (Scalp)' },
  { label: '1h', value: '60', desc: 'ساعة (Intraday)' },
  { label: '4h', value: '240', desc: '4 ساعات (Swing)' },
  { label: '1D', value: 'D', desc: 'يومي (Daily)' },
  { label: '1W', value: 'W', desc: 'أسبوعي (Weekly)' },
  { label: '1M', value: 'M', desc: 'شهري (Monthly)' }
];

export default function BreakoutTargetScannerSection() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [searchInput, setSearchInput] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('D');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [isLogScale, setIsLogScale] = useState(false);
  const [showRrBox, setShowRrBox] = useState(true);

  // Capital & Risk Management State
  const [accountBalance, setAccountBalance] = useState(10000);
  const [riskAmountUsd, setRiskAmountUsd] = useState(100);

  // Indicator Settings
  const [pivLen, setPivLen] = useState(15);
  const [maxLevels, setMaxLevels] = useState(6);
  const [volMult, setVolMult] = useState(2.0);
  const [volLen, setVolLen] = useState(20);
  const [minClose, setMinClose] = useState(0.3);
  const [slBufferPct, setSlBufferPct] = useState(0.8);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Chart Refs
  const chartContainerRef = useRef(null);
  const canvasOverlayRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const resistanceSeriesRef = useRef([]);

  const oscChartContainerRef = useRef(null);
  const oscChartRef = useRef(null);

  // Fetch Live Kline Data from Bybit API
  const fetchCandles = useCallback(async (sym, tf) => {
    setLoading(true);
    try {
      let cleanSym = sym.trim().toUpperCase();
      if (!cleanSym.endsWith('USDT') && !cleanSym.endsWith('USDC')) {
        cleanSym += 'USDT';
      }

      let res = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${cleanSym}&interval=${tf}&limit=300`);
      let data = await res.json();

      if (!data?.result?.list || data.result.list.length === 0) {
        res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${cleanSym}&interval=${tf}&limit=300`);
        data = await res.json();
      }

      if (data?.result?.list && data.result.list.length > 0) {
        const formatted = data.result.list.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5])
        })).reverse();

        setCandles(formatted);
        setLastSyncTime(Date.now());
      }
    } catch (err) {
      console.error('Error fetching klines:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandles(symbol, timeframe);
    const interval = setInterval(() => fetchCandles(symbol, timeframe), 30000);
    return () => clearInterval(interval);
  }, [symbol, timeframe, fetchCandles]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      let s = searchInput.trim().toUpperCase();
      if (!s.endsWith('USDT') && !s.endsWith('USDC')) s += 'USDT';
      setSymbol(s);
    }
  };

  // Run Indicator Logic
  const analysis = useMemo(() => {
    return calculateBreakoutTargetLogic(candles, {
      pivLen,
      maxLevels,
      volMult,
      volLen,
      minClose,
      slBufferPct
    });
  }, [candles, pivLen, maxLevels, volMult, volLen, minClose, slBufferPct]);

  const currentPrice = analysis?.currentPrice || 0;
  const rr = analysis?.riskRewardSetup;
  const isBreakoutActive = analysis?.latestBreakout && candles.length > 0 && 
    (candles[candles.length - 1].time === analysis.latestBreakout.time);

  // Position Size Computations
  const positionCalc = useMemo(() => {
    if (!rr || rr.riskPct <= 0 || currentPrice <= 0) return null;
    const riskDec = rr.riskPct / 100;
    const posSizeUsd = riskAmountUsd / riskDec;
    const coinQty = posSizeUsd / currentPrice;
    const potentialProfitUsd = riskAmountUsd * rr.rrRatio;
    const maxLossUsd = riskAmountUsd;

    return {
      posSizeUsd,
      coinQty,
      potentialProfitUsd,
      maxLossUsd
    };
  }, [rr, riskAmountUsd, currentPrice]);

  // Redraw Canvas Overlay for TradingView Position Box, Target & Stop Loss
  const redrawCanvasOverlay = useCallback(() => {
    try {
      const canvas = canvasOverlayRef.current;
      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      if (!canvas || !chart || !candleSeries || !candles || candles.length === 0) return;

      const container = chartContainerRef.current;
      if (container) {
        if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight || 500;
        }
      }

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const timeScale = chart.timeScale();

      // Draw Risk / Reward Long Position Box
      if (showRrBox && rr && currentPrice > 0) {
        const yEntry = candleSeries.priceToCoordinate(rr.entryPrice);
        const yTarget = candleSeries.priceToCoordinate(rr.targetPrice);
        const yStop = candleSeries.priceToCoordinate(rr.stopLoss);

        const lastBarIdx = candles.length - 1;
        const startBarIdx = Math.max(0, lastBarIdx - 35);
        const xStart = timeScale.timeToCoordinate(candles[startBarIdx].time) || (width - 320);
        const xEnd = width - 65;
        const boxWidth = Math.max(140, xEnd - xStart);

        if (yEntry !== null && yTarget !== null && yStop !== null) {
          ctx.save();

          // 🟢 1. Green Profit / Reward Zone
          ctx.fillStyle = 'rgba(0, 255, 136, 0.16)';
          ctx.fillRect(xStart, yTarget, boxWidth, yEntry - yTarget);
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(xStart, yTarget, boxWidth, yEntry - yTarget);

          // 🔴 2. Red Risk / Loss Zone
          ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
          ctx.fillRect(xStart, yEntry, boxWidth, yStop - yEntry);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(xStart, yEntry, boxWidth, yStop - yEntry);

          // 🚪 3. Entry Line (White dashed)
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(xStart, yEntry);
          ctx.lineTo(xEnd, yEntry);
          ctx.stroke();
          ctx.setLineDash([]);

          // 🏷️ Labels & Badges on the right of Box
          // Target Label
          ctx.fillStyle = '#00ff88';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`🎯 TP: $${rr.targetPrice.toLocaleString()} (+${rr.rewardPct.toFixed(1)}%)`, xStart + 8, yTarget + 14);

          // Entry & R:R Ratio Label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`🚪 ENTRY: $${rr.entryPrice.toLocaleString()} (R:R 1:${rr.rrRatio.toFixed(2)})`, xStart + 8, yEntry - 5);

          // Stop Loss Label
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`🛑 SL: $${rr.stopLoss.toLocaleString()} (-${rr.riskPct.toFixed(1)}%)`, xStart + 8, yStop - 6);

          ctx.restore();
        }
      }

      // Draw Price Discovery Banner if no resistance above
      if (analysis?.isPriceDiscovery) {
        ctx.save();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.beginPath();
        ctx.roundRect(width / 2 - 190, 16, 380, 30, 8);
        ctx.fill();
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ ماكاين حتى مقاومة فوق (منطقة جديدة / PRICE DISCOVERY)', width / 2, 35);
        ctx.restore();
      }

    } catch (e) {
      console.error(e);
    }
  }, [candles, analysis, currentPrice, rr, showRrBox]);

  // Main Candlestick Chart Initialization
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
      resistanceSeriesRef.current = [];
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,
      layout: { background: { color: 'rgba(4, 8, 16, 0.98)' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)', autoScale: true, mode: isLogScale ? 1 : 0, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, secondsVisible: false, rightOffset: 12 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true }
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff88', downColor: '#ef4444', borderUpColor: '#00ff88', borderDownColor: '#ef4444',
      wickUpColor: '#00ff88', wickDownColor: '#ef4444', priceLineVisible: true, lastValueVisible: true
    });

    if (candles.length > 0) {
      const highVolSet = new Set(analysis?.highVolCandles || []);
      const coloredCandles = candles.map(c => {
        if (highVolSet.has(c.time)) {
          return { ...c, color: '#f97316', borderColor: '#ea580c', wickColor: '#f97316' };
        }
        return c;
      });
      candleSeries.setData(coloredCandles);
    }

    candleSeriesRef.current = candleSeries;
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const triggerRedraw = () => { if (canvasOverlayRef.current) requestAnimationFrame(redrawCanvasOverlay); };
    chart.timeScale().subscribeVisibleLogicalRangeChange(triggerRedraw);
    chart.timeScale().subscribeVisibleTimeRangeChange(triggerRedraw);

    const handleResize = () => {
      if (container && chartRef.current && canvasOverlayRef.current) {
        chartRef.current.applyOptions({ width: container.clientWidth });
        canvasOverlayRef.current.width = container.clientWidth;
        canvasOverlayRef.current.height = 520;
        triggerRedraw();
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
  }, [candles, isLogScale, analysis?.highVolCandles, redrawCanvasOverlay]);

  // Sync Resistance Lines on Main Chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !analysis?.activeResistances || candles.length === 0) return;

    resistanceSeriesRef.current.forEach(s => {
      try { chart.removeSeries(s); } catch (_) {}
    });
    resistanceSeriesRef.current = [];

    analysis.activeResistances.forEach((res, idx) => {
      const isAbove = res.price > currentPrice;
      const s = chart.addLineSeries({
        color: isAbove ? 'rgba(239, 68, 68, 0.85)' : 'rgba(148, 163, 184, 0.4)',
        lineWidth: isAbove ? 2 : 1,
        lineStyle: isAbove ? 0 : 2,
        title: `R${idx + 1} ($${res.price.toLocaleString()})`,
        priceLineVisible: false,
        lastValueVisible: true
      });

      const lineData = candles.map(c => ({ time: c.time, value: res.price }));
      s.setData(lineData);
      resistanceSeriesRef.current.push(s);
    });

    if (analysis?.breakoutHistory?.length > 0 && candleSeriesRef.current) {
      const markers = analysis.breakoutHistory.map(b => ({
        time: b.time,
        position: 'belowBar',
        color: '#00ff88',
        shape: 'arrowUp',
        text: `▲ اختراق $${b.brokenLevel.toLocaleString()} (R:R 1:${b.rrRatio.toFixed(1)})`
      })).sort((a, b) => a.time - b.time);

      candleSeriesRef.current.setMarkers(markers);
    }

    if (canvasOverlayRef.current) requestAnimationFrame(redrawCanvasOverlay);
  }, [analysis, currentPrice, candles, redrawCanvasOverlay]);

  // Volume Sub-Chart Initialization
  useEffect(() => {
    if (!oscChartContainerRef.current || candles.length === 0) return;
    if (oscChartRef.current) {
      try { oscChartRef.current.remove(); } catch (_) {}
      oscChartRef.current = null;
    }

    const container = oscChartContainerRef.current;
    const oscChart = createChart(container, {
      width: container.clientWidth,
      height: 140,
      layout: { background: { color: 'rgba(4, 8, 16, 0.98)' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)', autoScale: true, scaleMargins: { top: 0.1, bottom: 0.05 } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, secondsVisible: false, rightOffset: 12 }
    });

    const volHist = oscChart.addHistogramSeries({
      title: 'Volume',
      priceFormat: { type: 'volume' }
    });

    const highVolSet = new Set(analysis?.highVolCandles || []);
    const volData = candles.map(c => {
      const isUp = c.close >= c.open;
      const isSurge = highVolSet.has(c.time);
      return {
        time: c.time, 
        value: c.volume || 0,
        color: isSurge ? '#f97316' : isUp ? 'rgba(0, 255, 136, 0.6)' : 'rgba(239, 68, 68, 0.6)'
      };
    });
    volHist.setData(volData);

    if (analysis?.volSmaSeries?.length > 0) {
      const volSma = oscChart.addLineSeries({
        color: '#38bdf8',
        lineWidth: 1.5,
        title: `SMA (${volLen})`,
        priceLineVisible: false
      });
      volSma.setData(analysis.volSmaSeries);
    }

    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && oscChart) oscChart.timeScale().setVisibleLogicalRange(range);
      });
      oscChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && chartRef.current) chartRef.current.timeScale().setVisibleLogicalRange(range);
      });
    }

    const handleResize = () => {
      if (oscChartContainerRef.current && oscChart) {
        oscChart.applyOptions({ width: oscChartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    oscChartRef.current = oscChart;

    return () => {
      window.removeEventListener('resize', handleResize);
      if (oscChartRef.current) {
        try { oscChartRef.current.remove(); } catch (_) {}
        oscChartRef.current = null;
      }
    };
  }, [candles, analysis?.volSmaSeries, analysis?.highVolCandles, volLen]);

  return (
    <div style={{ minHeight: '100vh', background: '#040810', color: '#ffffff', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      {/* 👑 HEADER PRINCIPAL */}
      <div style={{ background: 'linear-gradient(135deg, rgba(8, 16, 32, 0.98) 0%, rgba(4, 8, 16, 0.99) 100%)', border: '2px solid rgba(0, 255, 136, 0.35)', borderRadius: '18px', padding: '20px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxShadow: '0 0 35px rgba(0, 255, 136, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'linear-gradient(135deg, #00ff88, #059669)', padding: '10px', borderRadius: '12px', boxShadow: '0 0 20px rgba(0, 255, 136, 0.6)' }}>
            <Target size={28} color="#000" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#00ff88' }}>🎯 BREAKOUT + RISK/REWARD & TARGET RADAR</h1>
              <span style={{ background: 'rgba(0, 255, 136, 0.15)', border: '1px solid #00ff88', color: '#00ff88', fontSize: '0.68rem', fontWeight: '900', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Radio size={12} className="animate-pulse" /> LIVE RISK ENGINE
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.80rem', color: '#94a3b8' }}>حساب دقيق لمستويات الدخول، وقف الخسارة (Risk)، الأهداف (Reward)، ونسبة العائد للمخاطرة R:R مع حاسبة رأس المال</p>
          </div>
        </div>

        {/* SEARCH FORM */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="اكتب اسم العملة (e.g. SOL, BTC...)" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(0, 255, 136, 0.4)', color: '#fff', padding: '10px 16px 10px 36px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none', width: '220px' }} />
          </div>
          <button type="submit" style={{ background: 'linear-gradient(135deg, #00ff88, #059669)', color: '#000', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '900', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Crosshair size={15} /> فحص العملة
          </button>
        </form>
      </div>

      {/* 🚀 QUICK TOKENS SUGGESTION PILLS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 'bold' }}>⚡ عملات سريعة :</span>
        {POPULAR_TOKENS.map(t => (
          <button key={t} onClick={() => { setSymbol(t); setSearchInput(t); }} style={{ background: symbol === t ? 'linear-gradient(135deg, #00ff88, #059669)' : 'rgba(255,255,255,0.03)', color: symbol === t ? '#000' : '#ccc', border: symbol === t ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.08)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease' }}>
            {t.replace('USDT', '')}
          </button>
        ))}
      </div>

      {/* ⏱️ TIMEFRAME SELECTOR & CONTROLS BAR */}
      <div style={{ background: 'rgba(8, 16, 28, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>الفريم الزمني (Timeframe) :</span>
          {TIMEFRAMES.map(tf => (
            <button key={tf.value} onClick={() => setTimeframe(tf.value)} style={{ background: timeframe === tf.value ? 'linear-gradient(135deg, #00ff88, #059669)' : 'rgba(255,255,255,0.03)', color: timeframe === tf.value ? '#000' : '#fff', border: timeframe === tf.value ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', cursor: 'pointer' }}>
              {tf.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setShowRrBox(!showRrBox)} style={{ background: showRrBox ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255,255,255,0.05)', color: showRrBox ? '#00ff88' : '#888', border: showRrBox ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Scale size={13} /> صندوق الـ R:R ({showRrBox ? 'ظاهر' : 'مخفي'})
          </button>

          <button onClick={() => fetchCandles(symbol, timeframe)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={13} className={loading ? 'animate-spin' : ''} /> تحديث حي
          </button>

          <button onClick={() => setShowSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #00ff88, #059669)', color: '#00ff88', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={13} color="#000" /> <span style={{ color: '#000' }}>إعدادات الاختراق و R:R</span>
          </button>
        </div>
      </div>

      {/* 🛡️ 4 TOP RISK/REWARD & BREAKOUT METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
        {/* Card 1: Entry & Current Price */}
        <div style={{ background: 'rgba(8, 16, 28, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>سعر الدخول / الحالي ({symbol}) :</span>
          <strong style={{ fontSize: '1.35rem', color: '#fff' }}>${currentPrice.toLocaleString()}</strong>
          <span style={{ fontSize: '0.70rem', color: '#888' }}>الفريم: {TIMEFRAMES.find(t => t.value === timeframe)?.desc}</span>
        </div>

        {/* Card 2: Risk / Stop Loss */}
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldAlert size={14} /> وقف الخسارة (Stop Loss / RISK) :
            </span>
            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.72rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>
              -{rr?.riskPct.toFixed(2)}%
            </span>
          </div>
          <strong style={{ fontSize: '1.25rem', color: '#ef4444' }}>
            ${rr?.stopLoss ? rr.stopLoss.toLocaleString() : '---'}
          </strong>
          <span style={{ fontSize: '0.70rem', color: '#aaa' }}>أقصى خسارة محددة في الصفقة</span>
        </div>

        {/* Card 3: Reward / Take Profit */}
        <div style={{ background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.35)', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#00ff88', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Target size={14} /> الهدف القادم (Take Profit / REWARD) :
            </span>
            <span style={{ background: 'rgba(0, 255, 136, 0.2)', color: '#00ff88', fontSize: '0.72rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>
              +{rr?.rewardPct.toFixed(2)}%
            </span>
          </div>
          <strong style={{ fontSize: '1.25rem', color: '#00ff88' }}>
            ${rr?.targetPrice ? rr.targetPrice.toLocaleString() : '---'}
          </strong>
          <span style={{ fontSize: '0.70rem', color: '#aaa' }}>
            {rr?.isPriceDiscovery ? '⚠️ منطقة Price Discovery' : 'المقاومة التالية المستهدفة'}
          </span>
        </div>

        {/* Card 4: R:R Ratio & Verdict */}
        <div style={{ background: 'linear-gradient(135deg, rgba(8, 16, 28, 0.95), rgba(15, 23, 42, 0.95))', border: `1px solid ${rr?.verdictColor || '#facc15'}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>نسبة العائد للمخاطرة (R:R Ratio) :</span>
            <Scale size={15} color={rr?.verdictColor || '#facc15'} />
          </div>
          <strong style={{ fontSize: '1.35rem', color: rr?.verdictColor || '#facc15' }}>
            1 : {rr?.rrRatio ? rr.rrRatio.toFixed(2) : '1.0'}
          </strong>
          <span style={{ fontSize: '0.70rem', fontWeight: 'bold', color: rr?.verdictColor || '#cbd5e1' }}>
            {rr?.verdict || 'جاري التقييم...'}
          </span>
        </div>
      </div>

      {/* 🧮 5. SECTION CALCULATRICE POSITION SIZING & GESTION DU CAPITAL */}
      <div style={{ background: 'linear-gradient(135deg, rgba(8, 16, 32, 0.98) 0%, rgba(4, 8, 16, 0.99) 100%)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '16px', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(0, 255, 136, 0.15)', padding: '7px', borderRadius: '8px', border: '1px solid rgba(0, 255, 136, 0.4)' }}>
              <Calculator size={18} color="#00ff88" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '900', color: '#fff' }}>🧮 حاسبة حجم الصفقة الذكية (Position Sizing & Risk Management)</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>حدد المبلغ المعرض للمخاطرة (Risk $) لمعرفة حجم المحفظة وعدد الحبات الموصى بها للدخول</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>المخاطرة المستهدفة ($ Risk) :</span>
              <div style={{ position: 'relative' }}>
                <DollarSign size={13} color="#ef4444" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="number" value={riskAmountUsd} onChange={(e) => setRiskAmountUsd(Math.max(5, parseFloat(e.target.value) || 5))} style={{ background: '#1e222d', border: '1px solid #ef4444', color: '#fff', padding: '5px 10px 5px 24px', borderRadius: '6px', fontSize: '0.80rem', fontWeight: 'bold', width: '90px', outline: 'none' }} />
              </div>
            </div>
          </div>
        </div>

        {positionCalc && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>حجم الصفقة الإجمالي (Position Size) :</span>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#38bdf8' }}>${Math.round(positionCalc.posSizeUsd).toLocaleString()} USDT</div>
            </div>
            <div>
              <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>كمية العملات (Coins Qty) :</span>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#facc15' }}>{positionCalc.coinQty.toFixed(4)} {symbol.replace('USDT', '')}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>أقصى خسارة عند ضرب SL :</span>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#ef4444' }}>-${positionCalc.maxLossUsd.toFixed(1)} USD</div>
            </div>
            <div>
              <span style={{ fontSize: '0.70rem', color: '#94a3b8' }}>صافي الربح المتوقع عند TP :</span>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#00ff88' }}>+${positionCalc.potentialProfitUsd.toFixed(1)} USD</div>
            </div>
          </div>
        )}
      </div>

      {/* 📈 6. GRAND GRAPHIQUE CANDLESTICKS + LEVELS + TRADINGVIEW POSITION BOX */}
      <div style={{ background: 'rgba(6, 12, 24, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 0 35px rgba(0, 0, 0, 0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={18} color="#00ff88" />
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>CHARTE {symbol} ({TIMEFRAMES.find(t => t.value === timeframe)?.label}) — BREAKOUT & RISK/REWARD POSITION BOX</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => chartRef.current?.timeScale().fitContent()} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer' }}><RotateCcw size={13} /> FIT ZOOM</button>
            <button onClick={() => setIsLogScale(!isLogScale)} style={{ background: isLogScale ? 'linear-gradient(135deg, #00ff88, #059669)' : 'rgba(255,255,255,0.05)', color: isLogScale ? '#000' : '#ccc', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer' }}>📐 ÉCHELLE LOG ({isLogScale ? 'ON' : 'OFF'})</button>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '520px', borderRadius: '10px', overflow: 'hidden' }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
          <canvas ref={canvasOverlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} />
        </div>

        {/* 📊 VOLUME SUB-CHART */}
        <div style={{ background: 'rgba(4, 8, 16, 0.98)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '10px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
            <span style={{ color: '#00ff88', fontWeight: '900' }}>📊 حجم التداول (Volume) + معدل {volLen} بار (SMA) — الشموع البرتقالية = فوليوم انفجاري &gt; {volMult}x</span>
          </div>
          <div ref={oscChartContainerRef} style={{ width: '100%', height: '140px', borderRadius: '6px', overflow: 'hidden' }} />
        </div>
      </div>

      {/* 📋 7. TABLEAU DES NIVEAUX DE RÉSISTANCE ET OBJECTIFS */}
      <div style={{ background: 'linear-gradient(135deg, rgba(8, 16, 32, 0.98) 0%, rgba(4, 8, 16, 0.99) 100%)', border: '1px solid rgba(0, 255, 136, 0.35)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 0 35px rgba(0, 255, 136, 0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(0, 255, 136, 0.15)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0, 255, 136, 0.4)' }}>
              <Layers size={20} color="#00ff88" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#fff' }}>📋 جدول المقاومات المتتبعة والأهداف القادمة ({symbol})</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>المستويات السعرية التي رصدها المؤشر مع المسافة المئوية وحالة الاختراق</p>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.80rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>المستوى (Niveau)</th>
                <th style={{ padding: '12px 16px' }}>السعر (Prix)</th>
                <th style={{ padding: '12px 16px' }}>الموقع بالنسبة للسعر الحالي</th>
                <th style={{ padding: '12px 16px' }}>المسافة المئوية (% Distance)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>الحالة (Statut)</th>
              </tr>
            </thead>
            <tbody>
              {analysis?.activeResistances?.length > 0 ? (
                analysis.activeResistances.map((res, idx) => {
                  const isAbove = res.price > currentPrice;
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#fff' }}>مقاومة R{idx + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '900', color: isAbove ? '#ef4444' : '#00ff88' }}>${res.price.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{isAbove ? '🔴 فوق السعر الحالي (مقاومة/هدف)' : '🟢 تم اختراقها مسبقاً (دعم حالي)'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: isAbove ? '#ef4444' : '#00ff88' }}>{isAbove ? `+${res.distancePct.toFixed(1)}%` : `${res.distancePct.toFixed(1)}%`}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ background: isAbove ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 255, 136, 0.15)', border: isAbove ? '1px solid #ef4444' : '1px solid #00ff88', color: isAbove ? '#ef4444' : '#00ff88', padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '900' }}>
                          {isAbove ? 'مقاومة نشطة' : 'تم الاختراق'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>جاري تحميل وحساب المستويات...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⚙️ MODALE SETTINGS */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>إعدادات الاختراق و R:R Engine</h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>المستويات (PIVOTS)</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>حساسية المقاومة/الدعم (بارات)</span>
                  <input type="number" value={pivLen} onChange={(e) => setPivLen(Math.max(3, parseInt(e.target.value) || 3))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>عدد المستويات المتتبعة</span>
                  <input type="number" value={maxLevels} onChange={(e) => setMaxLevels(Math.max(2, Math.min(15, parseInt(e.target.value) || 6)))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>شروط الاختراق و وقف الخسارة</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>الفوليوم × المعدل (Multiplier)</span>
                  <input type="number" step="0.1" value={volMult} onChange={(e) => setVolMult(Math.max(1.0, parseFloat(e.target.value) || 2.0))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>فترة معدل الفوليوم (SMA Period)</span>
                  <input type="number" value={volLen} onChange={(e) => setVolLen(Math.max(5, parseInt(e.target.value) || 20))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>هامش وقف الخسارة (% SL Buffer)</span>
                  <input type="number" step="0.1" value={slBufferPct} onChange={(e) => setSlBufferPct(Math.max(0.1, parseFloat(e.target.value) || 0.8))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: '#00ff88', color: '#00ff88', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}><span style={{ color: '#000' }}>Ok</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}