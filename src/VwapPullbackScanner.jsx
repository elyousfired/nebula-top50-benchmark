import React, { useState, useEffect, useRef } from 'react';
import { Activity, Target, ArrowUpRight, ArrowDownRight, Clock, Crosshair, TrendingUp } from 'lucide-react';
import { createChart } from 'lightweight-charts';
import { fetchTop500Symbols, fetchBybitData, calculateNebulaLogic } from './logic/scanner';

const formatMoney = (val) => {
  if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + 'B';
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(2) + 'K';
  return val.toFixed(2);
};

// Compute net flow from array of klines [{time, open, close, turnover}]
export const computeNetFlow24h = (klines15m) => {
  if (!klines15m || klines15m.length === 0) return { netFlowTotal: 0, netFlowSeries: [], volumeSeries: [] };
  const sorted = [...klines15m].sort((a, b) => Number(a[0]) - Number(b[0]));
  const latestTime = Number(sorted[sorted.length - 1][0]);
  const oneDayMs = 24 * 60 * 60 * 1000;

  let prevNetFlow = 0;
  let prevVolume = 0;
  const netFlowSeries = [];
  const volumeSeries = [];
  let cumNetFlow = 0;
  let cumVolume = 0;

  sorted.forEach(k => {
    const time = Number(k[0]);
    if ((latestTime - time) < oneDayMs) {
      const open = parseFloat(k[1]);
      const close = parseFloat(k[4]);
      const volume = parseFloat(k[5]);
      const turnover = parseFloat(k[6]);
      const nf = turnover * ((close - open) / (open || 1));
      cumNetFlow += nf;
      cumVolume += volume;
      netFlowSeries.push({ time: time / 1000, value: cumNetFlow });
      volumeSeries.push({ time: time / 1000, value: cumVolume });
    }
  });

  // Compare first half vs second half to check if increasing
  const mid = Math.floor(netFlowSeries.length / 2);
  if (netFlowSeries.length > 2) {
    prevNetFlow = netFlowSeries[mid]?.value || 0;
    prevVolume = volumeSeries[mid]?.value || 0;
  }

  return {
    netFlowTotal: cumNetFlow,
    netFlowIncreasing: mid > 0 && cumNetFlow > prevNetFlow,
    volumeTotal: cumVolume,
    volumeIncreasing: mid > 0 && cumVolume > prevVolume,
    netFlowSeries,
    volumeSeries
  };
};

export const TokenChartCard = ({ token, isModal = false }) => {
  const candleRef = useRef(null);
  const netflowRef = useRef(null);
  const volumeRef = useRef(null);
  const chartsRef = useRef(null);
  const [timeframe, setTimeframe] = useState('15');
  const [currentPrice, setCurrentPrice] = useState(token.currentPrice);
  const wsRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const initChart = async () => {
      const now = new Date();
      const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const startOfYesterday = startOfToday - 86400000;

      // 1. Fetch Daily for Yesterday candle
      const dailyKlines = await fetchBybitData(token.symbol, 'D', 5);
      if (!isMounted || !dailyKlines) return;
      const yesterdayKline = dailyKlines.find(k => Number(k[0]) === startOfYesterday);

      // 2. Fetch timeframe klines (today)
      const klines = await fetchBybitData(token.symbol, timeframe, 300);
      if (!isMounted || !klines) return;
      const todayKlines = klines.filter(k => Number(k[0]) >= startOfToday);

      // 3. Net flow and volume from 15m (24h)
      const klines15m = await fetchBybitData(token.symbol, '15', 200);
      if (!isMounted) return;
      const { netFlowSeries, volumeSeries, netFlowTotal, volumeTotal } = computeNetFlow24h(klines15m || []);

      // Cleanup old charts
      if (chartsRef.current) {
        chartsRef.current.forEach(c => c.remove());
        chartsRef.current = null;
      }

      if (!candleRef.current || !netflowRef.current || !volumeRef.current) return;

      // --- CANDLE CHART ---
      const candleChart = createChart(candleRef.current, {
        height: isModal ? candleRef.current.clientHeight || 400 : 220,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
        timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
        rightPriceScale: { borderVisible: false }
      });
      const candleSeries = candleChart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });
      if (token.prevVwap > 0) {
        candleSeries.createPriceLine({
          price: token.prevVwap, color: '#00d2ff', lineWidth: 2, lineStyle: 2,
          axisLabelVisible: true, title: 'Prev VWAP MAX'
        });
      }
      const combined = yesterdayKline ? [yesterdayKline, ...todayKlines] : todayKlines;
      const sortedCombined = [...combined].sort((a, b) => Number(a[0]) - Number(b[0]));
      const seenTimes = new Set();
      const uniqueData = [];
      for (const k of sortedCombined) {
        const t = Number(k[0]) / 1000;
        if (!seenTimes.has(t)) {
          seenTimes.add(t);
          uniqueData.push({ time: t, open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) });
        }
      }
      candleSeries.setData(uniqueData);
      candleChart.timeScale().fitContent();

      // --- NET FLOW CHART ---
      const nfChart = createChart(netflowRef.current, {
        height: isModal ? 150 : 100,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
        timeScale: { visible: false, borderVisible: false },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } }
      });
      const nfSeries = nfChart.addAreaSeries({
        lineColor: netFlowTotal >= 0 ? '#00d2ff' : '#ff3b30',
        topColor: netFlowTotal >= 0 ? 'rgba(0, 210, 255, 0.4)' : 'rgba(255, 59, 48, 0.4)',
        bottomColor: netFlowTotal >= 0 ? 'rgba(0, 210, 255, 0.0)' : 'rgba(255, 59, 48, 0.0)',
        lineWidth: 2,
        priceLineVisible: false
      });
      if (netFlowSeries.length > 0) {
        nfSeries.setData(netFlowSeries);
        nfChart.timeScale().fitContent();
      }

      // --- VOLUME CHART ---
      const volChart = createChart(volumeRef.current, {
        height: isModal ? 150 : 100,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
        timeScale: { visible: false, borderVisible: false },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } }
      });
      const volSeries = volChart.addHistogramSeries({
        color: '#8b5cf6', priceLineVisible: false
      });
      if (volumeSeries.length > 0) {
        volSeries.setData(volumeSeries.map((d, i) => ({
          ...d,
          color: i > 0 && d.value > volumeSeries[i - 1].value ? '#10b981' : '#6366f1'
        })));
        volChart.timeScale().fitContent();
      }

      chartsRef.current = [candleChart, nfChart, volChart];

      // WebSocket live update (candles only)
      if (wsRef.current) wsRef.current.close();
      const ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ op: 'subscribe', args: [`kline.${timeframe}.${token.symbol}`] }));
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.topic && msg.topic.startsWith('kline.') && msg.data?.length > 0) {
          const k = msg.data[0];
          candleSeries.update({
            time: Number(k.start) / 1000,
            open: parseFloat(k.open), high: parseFloat(k.high),
            low: parseFloat(k.low), close: parseFloat(k.close)
          });
          if (isMounted) setCurrentPrice(parseFloat(k.close));
        }
      };
    };

    initChart();
    return () => {
      isMounted = false;
      if (wsRef.current) wsRef.current.close();
      if (chartsRef.current) { chartsRef.current.forEach(c => c.remove()); chartsRef.current = null; }
    };
  }, [token, timeframe]);

  const liveGap = ((currentPrice - token.prevVwap) / token.prevVwap) * 100;

  return (
    <div style={{ 
      background: 'rgba(15, 23, 42, 0.85)', 
      border: `1px solid ${Math.abs(liveGap) < 1 ? '#00d2ff' : '#1e293b'}`, 
      borderRadius: '16px', 
      overflow: 'hidden',
      height: isModal ? '100%' : 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ padding: '0.8rem 1rem', background: 'rgba(0, 210, 255, 0.06)', borderBottom: '1px solid rgba(0, 210, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 800 }}>{token.symbol.replace('USDT', '')}</h3>
          <span style={{ background: 'rgba(0,210,255,0.1)', color: '#00d2ff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
            {Math.abs(liveGap).toFixed(2)}% du VWAP
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem' }}>
          <span style={{ color: token.netFlowIncreasing ? '#10b981' : '#ef4444' }}>
            NF {token.netFlowIncreasing ? '▲' : '▼'} {token.netFlowTotal >= 0 ? '+' : ''}{formatMoney(token.netFlowTotal)}
          </span>
          <span style={{ color: token.volumeIncreasing ? '#10b981' : '#ef4444' }}>
            VOL {token.volumeIncreasing ? '▲' : '▼'} {formatMoney(token.volumeTotal)}
          </span>
        </div>
      </div>

      {/* Timeframe Buttons */}
      <div style={{ padding: '0.4rem 1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Clock size={13} color="#94a3b8" />
        {['15', '60', '240', 'D'].map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)} style={{
            background: timeframe === tf ? '#1e3a5f' : 'transparent',
            border: `1px solid ${timeframe === tf ? '#00d2ff' : 'transparent'}`,
            color: timeframe === tf ? '#00d2ff' : '#64748b',
            padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold'
          }}>
            {tf === '15' ? '15m' : tf === '60' ? '1H' : tf === '240' ? '4H' : '1D'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>${currentPrice}</span>
        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>→ VWAP Max: <span style={{ color: '#00d2ff' }}>${token.prevVwap.toFixed(4)}</span></span>
      </div>

      {/* Charts */}
      <div style={{ padding: '0.5rem 1rem 0.25rem', flex: isModal ? 1 : 'none', display: 'flex', flexDirection: 'column' }}>
        <div ref={candleRef} style={{ width: '100%', flex: 1 }} />
      </div>

      <div style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ color: token.netFlowTotal >= 0 ? '#00d2ff' : '#ff3b30', fontSize: '0.65rem', fontWeight: 700, writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', minWidth: '12px' }}>NET FLOW</span>
        <div ref={netflowRef} style={{ width: '100%' }} />
      </div>
      <div style={{ padding: '0 1rem 0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ color: '#8b5cf6', fontSize: '0.65rem', fontWeight: 700, writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', minWidth: '12px' }}>VOLUME</span>
        <div ref={volumeRef} style={{ width: '100%' }} />
      </div>
    </div>
  );
};

export const VwapPullbackScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [scanLimit, setScanLimit] = useState(100);

  const scanTokens = async () => {
    setScanning(true);
    setResults([]);
    setProgress(0);

    try {
      const topSymbols = await fetchTop500Symbols();
      const targets = topSymbols.slice(0, scanLimit).map(t => t.symbol);
      const batchSize = 8;
      const allResults = [];

      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);

        const promises = batch.map(async (symbol) => {
          try {
            // Fetch 15m klines — used for VWAP calc + net flow + volume
            const klines15m = await fetchBybitData(symbol, '15', 500);
            if (!klines15m || klines15m.length < 50) return null;

            // Previous Daily VWAP Max via calculateNebulaLogic
            const logic = calculateNebulaLogic(klines15m);
            const prevVwap = logic.yesterdayMax;
            if (!prevVwap || prevVwap <= 0) return null;

            const currentPrice = parseFloat(klines15m[0][4]);
            const gap = ((currentPrice - prevVwap) / prevVwap) * 100;

            // VWAP filter: prix entre -2% et +2% du VWAP Max (breakout ou retest)
            if (gap < -2 || gap > 2) return null;

            // Net Flow + Volume check over last 24h
            const { netFlowTotal, netFlowIncreasing, volumeTotal, volumeIncreasing } = computeNetFlow24h(klines15m);

            // FILTER: both net flow AND volume must be increasing
            if (!netFlowIncreasing || !volumeIncreasing) return null;

            return { symbol, currentPrice, prevVwap, gap, netFlowTotal, netFlowIncreasing, volumeTotal, volumeIncreasing };
          } catch (e) {
            console.warn("Error scanning", symbol, e);
          }
          return null;
        });

        const batchResults = await Promise.all(promises);
        allResults.push(...batchResults.filter(r => r !== null));
        setProgress(Math.floor(((i + batchSize) / targets.length) * 100));
      }

      // Sort by closest to breakout
      allResults.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
      setResults(allResults);
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.8rem', margin: 0, background: 'linear-gradient(90deg, #00d2ff, #3a7bd5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
          <Crosshair size={38} color="#00d2ff" /> VWAP BREAKOUT RADAR
        </h1>
        <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '8px' }}>
          Tokens dans la zone ±2% de leur Previous Daily VWAP Max · Net Flow ▲ · Volume ▲ · Live
        </p>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(0, 210, 255, 0.15)', borderRadius: '20px', padding: '1.5rem', marginBottom: '2.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '10px' }}>
          {[100, 200, 300].map(limit => (
            <button key={limit} onClick={() => setScanLimit(limit)} style={{
              background: scanLimit === limit ? 'rgba(0, 210, 255, 0.15)' : 'transparent',
              border: `1px solid ${scanLimit === limit ? '#00d2ff' : 'transparent'}`,
              color: scanLimit === limit ? '#00d2ff' : '#64748b',
              padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
            }}>TOP {limit}</button>
          ))}
        </div>

        {/* Conditions legend */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#64748b' }}>
          <span style={{ color: '#10b981' }}>✓ VWAP ±2%</span>
          <span style={{ color: '#00d2ff' }}>✓ Net Flow ▲</span>
          <span style={{ color: '#8b5cf6' }}>✓ Volume ▲</span>
        </div>

        <button onClick={scanTokens} disabled={scanning} style={{
          background: scanning ? '#1e293b' : 'linear-gradient(45deg, #00d2ff, #3a7bd5)',
          border: 'none', color: '#fff', padding: '13px 35px', borderRadius: '30px',
          fontSize: '1.1rem', fontWeight: 'bold', cursor: scanning ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: scanning ? 'none' : '0 8px 20px rgba(0, 210, 255, 0.35)', transition: 'all 0.3s'
        }}>
          {scanning ? <Activity size={22} /> : <Target size={22} />}
          {scanning ? `SCAN EN COURS… ${progress}%` : 'LANCER LE SCAN LIVE'}
        </button>
      </div>

      {results.length > 0 && (
        <>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            <span style={{ color: '#00d2ff', fontWeight: 700 }}>{results.length} token(s) détecté(s)</span> — triés du plus proche au plus loin du breakout
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.5rem' }}>
            {results.map((r, i) => <TokenChartCard key={i} token={r} />)}
          </div>
        </>
      )}

      {results.length === 0 && !scanning && progress === 100 && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: '3rem', fontSize: '1rem' }}>
          Aucun token ne respecte les 3 conditions simultanément (VWAP ±2% + Net Flow ▲ + Volume ▲).
        </div>
      )}
    </div>
  );
};

export default VwapPullbackScanner;
