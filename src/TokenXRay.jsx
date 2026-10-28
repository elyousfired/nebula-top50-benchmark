import React, { useState, useEffect, useRef } from 'react';
import { Search, Zap, Crosshair, BarChart2, Link, Activity, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { fetchBybitData, fetchOpenInterest } from './logic/scanner';
import { fetchMacroSol, fetchSolData, fetchBtcData } from './logic/sol-scanner';
import { createChart } from 'lightweight-charts';
import { ResistanceChart } from './ResistanceChart';
import { ChannelChart } from './TrendChannelDashboard';
import { detectChannel } from './logic/channelDetector';
import { detectDemandZone } from './logic/demandZone';
import { syntheticRatio } from './logic/solSwitchEngine';
import MultiPackCharts from './MultiPackCharts';
import TokenNews from './TokenNews';
import TokenWhales from './TokenWhales';

// Utility for formatting
const formatMoney = (val) => {
  if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + 'B';
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(2) + 'K';
  return val.toFixed(2);
};

const calculateMTFFlow = (dailyKlines, h4Klines, overrides = {}) => {
  // Process 1D, 3D, 1W from dailyKlines
  const dSorted = [...dailyKlines].sort((a,b) => a.time - b.time);
  const dFlows = dSorted.map(k => {
    let flow = 0;
    if (k.open > 0) flow = k.turnover * ((k.close - k.open) / k.open);
    return { flow, turnover: k.turnover, close: k.close };
  });

  const flow1D = overrides.netFlow1D !== undefined ? overrides.netFlow1D : (dFlows.length > 0 ? dFlows[dFlows.length - 1].flow : 0);
  
  const last3Days = dFlows.slice(-3);
  const flow3D = last3Days.reduce((acc, f) => acc + f.flow, 0);
  
  const last7Days = dFlows.slice(-7);
  const flow1W = last7Days.reduce((acc, f) => acc + f.flow, 0);

  const priceChange1W = dFlows.length >= 7 ? ((dFlows[dFlows.length - 1].close / dFlows[dFlows.length - 7].close) - 1) * 100 : 0;

  // Process 4H from h4Klines
  const h4Sorted = [...h4Klines].sort((a,b) => a.time - b.time);
  let flow4H = 0;
  if (overrides.netFlow4H !== undefined) {
    flow4H = overrides.netFlow4H;
  } else if (h4Sorted.length > 0 && h4Sorted[h4Sorted.length - 1].open > 0) {
    flow4H = h4Sorted[h4Sorted.length - 1].turnover * ((h4Sorted[h4Sorted.length - 1].close - h4Sorted[h4Sorted.length - 1].open) / h4Sorted[h4Sorted.length - 1].open);
  }

  const flow1H = overrides.netFlow1H || 0;
  const flow15m = overrides.netFlow15m || 0;

  // Gravity Score
  let score = 0;
  if (flow15m > 0) score += 2; else score -= 2;
  if (flow1H > 0) score += 5; else score -= 5;
  if (flow4H > 0) score += 10; else score -= 10;
  if (flow1D > 0) score += 20; else score -= 20;
  if (flow3D > 0) score += 30; else score -= 30;
  if (flow1W > 0) score += 40; else score -= 40;
  
  if (flow1W > 0 && priceChange1W > 0) score += 10;
  if (flow1W < 0 && priceChange1W < 0) score -= 10;
  score = Math.max(-100, Math.min(100, score));

  let status = { label: '⏳ MONITORING', col: '#94a3b8' };
  if (flow1D > 0 && flow3D > 0 && flow1W > 0) {
    status = { label: '💎 STRATEGIC ACCUMULATION', col: '#00e676' };
  } else if (flow1D > 0 && flow3D > 0 && flow1W < 0) {
    status = { label: '⚡ EARLY ROTATION', col: '#00e5ff' };
  } else if (flow1D > 0 && flow3D < 0 && flow1W < 0) {
    status = { label: '⚠️ EXIT LIQUIDITY', col: '#f59e0b' };
  } else if (flow1D < 0 && flow3D < 0 && flow1W < 0) {
    status = { label: '💀 ACTIVE DISTRIBUTION', col: '#ff3b30' };
  } else if (flow1D < 0 && flow3D < 0 && flow1W > 0) {
    status = { label: '🛡️ SUPPORT TEST', col: '#7b2cbf' };
  }

  return { flow15m, flow1H, flow4H, flow1D, flow3D, flow1W, score, status };
};

function computeNetFlow(klines) {
  return klines.map(k => {
    const pctChange = k.open > 0 ? (k.close - k.open) / k.open : 0;
    return { time: k.time, netFlow: k.turnover * pctChange };
  });
}

function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 4) return 0;
  const xs = x.slice(0, n), ys = y.slice(0, n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx2 += (xs[i] - mx) ** 2;
    dy2 += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

function getCorrelationLabel(r) {
  if (r >= 0.8) return { text: 'TRÈS CORRÉLÉ', color: '#00ff88' };
  if (r >= 0.5) return { text: 'CORRÉLÉ', color: '#7fff00' };
  if (r >= 0.2) return { text: 'FAIBLE +', color: '#facc15' };
  if (r >= -0.2) return { text: 'NEUTRE', color: '#888' };
  if (r >= -0.5) return { text: 'FAIBLE -', color: '#ff9500' };
  if (r >= -0.8) return { text: 'INVERSE', color: '#ff3b30' };
  return { text: 'TRÈS INVERSE', color: '#ff0040' };
}

function NetFlowSparkline({ data, width = 120, height = 40 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.netFlow);
  const maxV = Math.max(...vals.map(Math.abs), 1);
  const midY = height / 2;
  const stepX = width / (vals.length - 1);

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <line x1="0" y1={midY} x2={width} y2={midY} stroke="#333" strokeWidth="1" />
      {vals.map((v, i) => (
        <rect
          key={i}
          x={i * stepX - 3}
          y={v >= 0 ? midY - (v / maxV) * midY * 0.85 : midY}
          width={6}
          height={Math.abs((v / maxV) * midY * 0.85)}
          fill={v >= 0 ? '#00ff88' : '#ff3b30'}
          opacity={0.7}
        />
      ))}
    </svg>
  );
}

const TokenCorrelationTable = ({ symbol }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      
      const parseCandles = (raw) => {
        if (!raw || !Array.isArray(raw)) return [];
        return raw.map(k => ({
          time: Number(k[0]),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          turnover: parseFloat(k[6] || 0)
        }));
      };

      try {
        const [btcData, solData, tokenData] = await Promise.all([
          fetchBybitData('BTCUSDT', 'W', 40),
          fetchBybitData('SOLUSDT', 'W', 40),
          symbol !== 'BTCUSDT' && symbol !== 'SOLUSDT' ? fetchBybitData(symbol, 'W', 40) : Promise.resolve(null)
        ]);
        
        if (!isMounted) return;

        const btcKlines = parseCandles(btcData).reverse();
        const solKlines = parseCandles(solData).reverse();
        const tokenKlines = tokenData ? parseCandles(tokenData).reverse() : [];
        
        const oct2024 = new Date('2024-10-01').getTime();
        const btcFiltered = btcKlines.filter(k => k.time >= oct2024);
        const btcFlow = computeNetFlow(btcFiltered);
        
        const processToken = (klines, sym) => {
           const filtered = klines.filter(k => k.time >= oct2024);
           const flow = computeNetFlow(filtered);
           
           const btcTimeSet = new Set(btcFlow.map(d => d.time));
           const aligned = flow.filter(d => btcTimeSet.has(d.time));
           const btcAligned = btcFlow.filter(d => new Set(flow.map(f => f.time)).has(d.time));
           
           const flowVals = aligned.map(d => d.netFlow);
           const btcAlignedVals = btcAligned.map(d => d.netFlow);
           
           const corr = sym === 'BTCUSDT' ? 1.0 : pearsonCorrelation(flowVals, btcAlignedVals);
           const totalFlow = flowVals.reduce((a, b) => a + b, 0);
           const avgWeeklyFlow = totalFlow / (flowVals.length || 1);
           const lastFlow = flowVals[flowVals.length - 1] || 0;
           
           return {
             symbol: sym.replace('USDT', ''),
             correlation: corr,
             weeklyFlowData: aligned,
             totalFlow,
             avgWeeklyFlow,
             lastFlow,
             weeksAnalyzed: aligned.length,
           };
        };

        const tokens = [processToken(btcKlines, 'BTCUSDT'), processToken(solKlines, 'SOLUSDT')];
        if (symbol !== 'BTCUSDT' && symbol !== 'SOLUSDT' && tokenData) {
            tokens.push(processToken(tokenKlines, symbol));
        }

        setResults(tokens);
      } catch (e) {
      }
      setLoading(false);
    };

    loadData();
    
    return () => { isMounted = false; };
  }, [symbol]);

  const formatFlow = (v) => {
    const abs = Math.abs(v);
    const sign = v >= 0 ? '+' : '-';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B$`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M$`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K$`;
    return `${sign}${abs.toFixed(0)}$`;
  };

  const th = { padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' };
  const td = { padding: '16px 12px', verticalAlign: 'middle' };

  if (results.length === 0 && !loading) return null;

  return (
    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem', marginBottom: '1rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: '#00ff88', fontSize: '1.2rem', textTransform: 'uppercase', textShadow: '0 0 10px rgba(0, 255, 136, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 12, height: 12, background: '#00ff88', borderRadius: '50%' }} /> NET FLOW BTC
        </h3>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={th}>#</th>
              <th style={th}>TOKEN</th>
              <th style={th}>CORRÉLATION BTC</th>
              <th style={th}>INTERPRÉTATION</th>
              <th style={th}>NET FLOW HEBDO (VISUEL)</th>
              <th style={th}>DERNIER FLUX</th>
              <th style={th}>FLUX MOYEN/SEMAINE</th>
              <th style={th}>SEMAINES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontWeight: 900, letterSpacing: 2 }}>SYNCING...</td></tr>
            ) : results.map((t, i) => {
              const label = getCorrelationLabel(t.correlation);
              const corrBarWidth = Math.abs(t.correlation) * 100;
              const corrBarColor = t.correlation >= 0 ? '#00ff88' : '#ff3b30';
              return (
                <tr key={t.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                  <td style={td}><span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 900 }}>#{i + 1}</span></td>
                  <td style={td}>
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{t.symbol}</span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 900, fontSize: '1rem', color: corrBarColor, minWidth: '52px' }}>
                        {t.correlation >= 0 ? '+' : ''}{t.correlation.toFixed(2)}
                      </span>
                      <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${corrBarWidth}%`, height: '100%', background: corrBarColor, borderRadius: '3px' }} />
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.5px', background: `${label.color}15`, color: label.color, border: `1px solid ${label.color}40` }}>
                      {label.text}
                    </span>
                  </td>
                  <td style={td}>
                    <NetFlowSparkline data={t.weeklyFlowData} width={130} height={36} />
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: t.lastFlow >= 0 ? '#00ff88' : '#ff3b30' }}>
                      {formatFlow(t.lastFlow)}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: t.avgWeeklyFlow >= 0 ? '#00ff88' : '#ff3b30' }}>
                      {formatFlow(t.avgWeeklyFlow)}/sem
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{t.weeksAnalyzed}w</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OpenInterestChart = ({ symbol, onOIData }) => {
  const [timeframe, setTimeframe] = useState('15');
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,0.05)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      crosshair: { mode: 0, vertLine: { color: 'rgba(255,255,255,0.1)' }, horzLine: { color: 'rgba(255,255,255,0.1)' } },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
    });
    chartRef.current = chart;

    const series = chart.addAreaSeries({
      topColor: 'rgba(245, 158, 11, 0.4)',
      bottomColor: 'rgba(245, 158, 11, 0.05)',
      lineColor: '#f59e0b',
      lineWidth: 2,
    });
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
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
  }, []);

  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      const data = await fetchOpenInterest(symbol, timeframe);
      if (!isMounted) return;
      if (data && data.length > 0 && seriesRef.current && chartRef.current) {
        const sorted = [...data].reverse();
        const chartData = [];
        sorted.forEach(o => {
          chartData.push({ time: Math.floor(Number(o.timestamp) / 1000), value: Number(o.openInterest) });
        });
        
        // Ensure chronological order
        chartData.sort((a,b) => a.time - b.time);
        
        seriesRef.current.setData(chartData);
        chartRef.current.timeScale().fitContent();

        if (onOIData && chartData.length >= 2) {
           const first = chartData[0].value;
           const last = chartData[chartData.length - 1].value;
           const changePct = ((last - first) / first) * 100;
           onOIData({
              trend: changePct >= 0 ? 'RISING' : 'FALLING',
              changePct
           });
        }
      } else if (seriesRef.current) {
        seriesRef.current.setData([]);
      }
      setLoading(false);
    };
    
    loadData();
    
    return () => { isMounted = false; };
  }, [symbol, timeframe]);

  return (
    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem', marginBottom: '1rem', marginTop: '1rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: '#f59e0b', fontSize: '1.2rem', textTransform: 'uppercase', textShadow: '0 0 10px rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: '50%' }} /> OPEN INTEREST
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ val: '15', lbl: '15m' }, { val: '60', lbl: '1H' }, { val: '240', lbl: '4H' }, { val: 'D', lbl: '1D' }, { val: 'W', lbl: '1W' }].map(tf => (
             <button 
                key={tf.val} 
                style={{
                  background: timeframe === tf.val ? '#f59e0b' : 'rgba(30, 41, 59, 0.5)',
                  color: timeframe === tf.val ? '#000' : '#94a3b8',
                  border: '1px solid ' + (timeframe === tf.val ? '#f59e0b' : '#334155'),
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => setTimeframe(tf.val)}
             >
                {tf.lbl}
             </button>
          ))}
        </div>
      </div>
      <div style={{ height: '250px', width: '100%', position: 'relative' }}>
        {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#f59e0b', zIndex: 10, fontWeight: 900, fontSize: '0.8rem', letterSpacing: 2 }}>SYNCING...</div>}
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

const TokenXRay = () => {
  const [searchInput, setSearchInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [analyzeAgainst, setAnalyzeAgainst] = useState('USDT');
  const [chartData, setChartData] = useState(null);
  const [engineData, setEngineData] = useState(null);
  const [oiData, setOiData] = useState(null);
  const [relativeEngineData, setRelativeEngineData] = useState(null);
  const [masterEngineData, setMasterEngineData] = useState(null);
  const [swapData, setSwapData] = useState(null);
  const [globalPrices, setGlobalPrices] = useState({ btc: null, sol: null });
  const liveIntervalRef = useRef(null);
  
  useEffect(() => {
    if (activeSymbolRef.current && searchInput) {
      performDeepDive();
    }
  }, [analyzeAgainst]);

  const lsChartRef = useRef(null);
  const vpChartRef = useRef(null);
  const flowChartRef = useRef(null);
  const paraChartRef = useRef(null);
  
  const chartInstances = useRef({});
  const activeSymbolRef = useRef('');

  useEffect(() => {
    if (!result || !chartData || !result.trendChannels || !result.macroFlow) return;
    
    const t15 = result.trendChannels['15']?.channelType; // 'Ascending', 'Descending', 'Sideways'
    const t1H = result.trendChannels['60']?.channelType;
    const t4H = result.trendChannels['240']?.channelType;
    const t1D = result.trendChannels['D']?.channelType;

    const macroScore = result.macroFlow.score;
    const { currentPrice, ema20, vwapD, pdh } = chartData;

    const isAboveVwap = vwapD ? currentPrice > vwapD : false;
    const isAboveEma = ema20 ? currentPrice > ema20 : false;
    const isAbovePDH = pdh ? currentPrice > pdh : false;
    
    let state = "MIXED";
    let decision = "WAIT";
    let reason = "Timeframes are conflicting.";
    let score = 50;

    const sweepType = result.liquiditySweep?.type;
    const poc = result.volumeProfile?.poc;
    const isAbovePOC = poc ? currentPrice > poc : false;
    const isOIRising = oiData ? oiData.trend === 'RISING' : false;

    if (t4H === 'Ascending' && t1D === 'Ascending' && isAboveVwap && isAboveEma && macroScore > 0) {
      state = "BULLISH ALIGNMENT";
      decision = "AGGRESSIVE BUY";
      reason = "4H and 1D are ascending, price > VWAP & EMA, and macro flow is positive.";
      score = 90;
    } else if (t1D === 'Ascending' && (t1H === 'Descending' || t15 === 'Descending') && (currentPrice > (vwapD * 0.98) && currentPrice < (vwapD * 1.02))) {
      state = "PULLBACK TO SUPPORT";
      decision = "BUY THE DIP";
      reason = "Daily trend is up, but lower timeframes are pulling back to VWAP support.";
      score = 75;
    } else if ((t4H === 'Descending' && t1H === 'Descending') && !isAboveVwap && macroScore < 0) {
      state = "BEARISH CASCADE";
      decision = "AVOID / SHORT";
      reason = "Multiple timeframes descending, price below VWAP, negative flow.";
      score = 20;
    } else if (t4H === 'Sideways' || t1D === 'Sideways') {
      state = "CONSOLIDATION";
      decision = "WAIT FOR BREAKOUT";
      reason = "Major timeframes are in a sideways channel.";
      score = 50;
    } else {
      score = 50;
      if (t4H === 'Ascending') score += 15; else if (t4H === 'Descending') score -= 15;
      if (t1D === 'Ascending') score += 20; else if (t1D === 'Descending') score -= 20;
      if (isAboveVwap) score += 15; else score -= 15;
      if (isAboveEma) score += 10; else score -= 10;
      if (macroScore > 0) score += 10; else score -= 10;
    }

    if (sweepType === 'BULLISH') score += 15; else if (sweepType === 'BEARISH') score -= 15;
    if (isAbovePOC) score += 10; else score -= 10;
    if (isOIRising) score += 10; else score -= 5;
    
    score = Math.max(0, Math.min(100, score));
    if (state === "MIXED") {
      if (score >= 70) { state = "BULLISH"; decision = "LOOK FOR ENTRY"; reason = "Overall indicators are leaning positive."; }
      else if (score <= 35) { state = "BEARISH"; decision = "AVOID / SHORT"; reason = "Overall indicators are leaning negative."; }
    }

    setEngineData({ state, decision, reason, score, t15, t1H, t4H, t1D, isAboveVwap, isAboveEma, isAbovePDH, isAbovePOC, isOIRising, sweepType });
  }, [result, chartData, oiData]);

  useEffect(() => {
    if (!engineData || !relativeEngineData) return;
    
    let masterState = "NEUTRAL";
    let masterDecision = "WAIT";
    let masterReason = "Awaiting full data confluence.";
    
    const masterScore = Math.round((engineData.score + relativeEngineData.score) / 2);
    
    const xrayBullish = engineData.score >= 60;
    const relBullish = relativeEngineData.score >= 60;
    const xrayBearish = engineData.score <= 40;
    const relBearish = relativeEngineData.score <= 40;

    if (xrayBullish && relBullish) {
       masterState = "PERFECT LONG";
       masterDecision = "ALL SYSTEMS GO";
       masterReason = "Absolute chart structure and Relative strength against SOL/BTC are both highly bullish.";
    } else if (xrayBullish && relBearish) {
       masterState = "FAKE PUMP TRAP";
       masterDecision = "AVOID LONG";
       masterReason = "Price is rising in USD, but it is bleeding against SOL/BTC. Fake strength.";
    } else if (xrayBearish && relBullish) {
       masterState = "HIDDEN ACCUMULATION";
       masterDecision = "WATCH FOR REVERSAL";
       masterReason = "Price looks bearish in USD, but it is showing strong resilience against the market.";
    } else if (xrayBearish && relBearish) {
       masterState = "TOXIC DUMP";
       masterDecision = "AVOID / SHORT";
       masterReason = "Both absolute structure and relative strength are completely broken.";
    } else {
       masterState = "MIXED CONDITIONS";
       masterDecision = "CAUTION";
       masterReason = "There is no strong alignment between absolute and relative metrics.";
    }

    setMasterEngineData({ state: masterState, decision: masterDecision, reason: masterReason, score: masterScore });

    // Swap Logic
    let swapState = "HOLD POSITION";
    let swapAction = "WAIT";
    let swapReason = "Token and SOL are moving together. No clear advantage to swap.";
    
    if (relativeEngineData.vsSol24h > 2 && relativeEngineData.score >= 60) {
      swapState = "TOKEN OUTPERFORMING";
      swapAction = "SWAP TO TOKEN";
      swapReason = "Token is gaining massive strength against SOL. Swap to capture alpha.";
    } else if (relativeEngineData.vsSol24h < -2 && relativeEngineData.score <= 40) {
      swapState = "TOKEN BLEEDING";
      swapAction = "SWAP TO SOL";
      swapReason = "Token is losing value against SOL. Swap back to SOL to protect capital.";
    }

    setSwapData({ state: swapState, action: swapAction, reason: swapReason, vsSol: relativeEngineData.vsSol24h });
  }, [engineData, relativeEngineData]);

  useEffect(() => {
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchGlobalPrices = async () => {
      try {
        const [btcRes, solRes] = await Promise.all([
          fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT'),
          fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=SOLUSDT')
        ]);
        const btcJson = await btcRes.json();
        const solJson = await solRes.json();
        
        const btcData = btcJson.result?.list?.[0];
        const solData = solJson.result?.list?.[0];

        setGlobalPrices({
          btc: btcData ? { price: parseFloat(btcData.lastPrice), change: parseFloat(btcData.price24hPcnt) * 100 } : null,
          sol: solData ? { price: parseFloat(solData.lastPrice), change: parseFloat(solData.price24hPcnt) * 100 } : null
        });
      } catch (e) {
        console.error("Failed to fetch global prices", e);
      }
    };
    fetchGlobalPrices();
    const interval = setInterval(fetchGlobalPrices, 15000);
    return () => clearInterval(interval);
  }, []);

  const calculateSweep = (candles, tfLabel) => {
    if (!candles || candles.length < 5) return { type: 'NONE', distance: 1000, level: 0, tf: tfLabel, candles: [] };
    const sorted = [...candles].sort((a,b) => a.time - b.time);
    const current = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    
    if (current.low < previous.low && current.close > previous.low) {
      return { type: 'BULLISH', distance: ((previous.low - current.low) / previous.low) * 100, level: previous.low, tf: tfLabel, candles: sorted, currentPrice: current.close };
    } else if (current.high > previous.high && current.close < previous.high) {
      return { type: 'BEARISH', distance: ((current.high - previous.high) / previous.high) * 100, level: previous.high, tf: tfLabel, candles: sorted, currentPrice: current.close };
    }
    return { type: 'NONE', distance: 1000, level: 0, tf: tfLabel, candles: sorted, currentPrice: current.close };
  };

  const parseCandles = (raw) => {
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map(k => ({
      time: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      turnover: parseFloat(k[6] || 0)
    }));
  };

  const fetchAndProcess = async (symbol, isBackgroundUpdate = false) => {
    try {
      const requests = [
        fetchBybitData(symbol, 'D', 200),
        fetchBybitData(symbol, '240', 200),
        fetchBybitData(symbol, '60', 200),
        fetchBybitData(symbol, '15', 200)
      ];

      if (analyzeAgainst === 'SOL') {
        requests.push(
          fetchSolData('D', 200),
          fetchSolData('240', 200),
          fetchSolData('60', 200),
          fetchSolData('15', 200)
        );
      } else if (analyzeAgainst === 'BTC') {
        requests.push(
          fetchBtcData('D', 200),
          fetchBtcData('240', 200),
          fetchBtcData('60', 200),
          fetchBtcData('15', 200)
        );
      }

      const results = await Promise.all(requests);
      
      let dCandles = parseCandles(results[0]);
      let h4Candles = parseCandles(results[1]);
      let h1Candles = parseCandles(results[2]);
      let m15Candles = parseCandles(results[3]);

      if (analyzeAgainst === 'SOL' || analyzeAgainst === 'BTC') {
        const baseD = parseCandles(results[4]);
        const base4H = parseCandles(results[5]);
        const base1H = parseCandles(results[6]);
        const base15m = parseCandles(results[7]);

        dCandles = syntheticRatio(dCandles, baseD);
        h4Candles = syntheticRatio(h4Candles, base4H);
        h1Candles = syntheticRatio(h1Candles, base1H);
        m15Candles = syntheticRatio(m15Candles, base15m);
      }

      if (!m15Candles || m15Candles.length < 5) throw new Error("Données insuffisantes pour " + symbol);
      
      const oiData = await fetchOpenInterest(symbol, '15', 96);

      // --- PARABOLIC RECOVERY LOGIC ---
      const nebulaData = await fetchMacroSol(symbol, '1D', analyzeAgainst);
      const cupPattern = nebulaData && nebulaData.isValid ? nebulaData.cupPattern : null;

      // --- MTF LIQUIDITY SWEEP CALCULATION ---
      const sweeps = [
        calculateSweep(dCandles, '1D'),
        calculateSweep(h4Candles, '4H'),
        calculateSweep(h1Candles, '1H'),
        calculateSweep(m15Candles, '15m')
      ];

      // Find the best sweep (closest distance)
      const validSweeps = sweeps.filter(s => s.type !== 'NONE');
      validSweeps.sort((a, b) => a.distance - b.distance);
      const bestSweep = validSweeps.length > 0 ? validSweeps[0] : sweeps[0]; // fallback to 1D if none

      // --- VOLUME PROFILE CALCULATION ---
      let totalVol = 0;
      const bins = {};
      const sorted15m = [...m15Candles].sort((a,b) => a.time - b.time);
      
      let minP = Infinity, maxP = -Infinity;
      sorted15m.forEach(c => {
        if(c.low < minP) minP = c.low;
        if(c.high > maxP) maxP = c.high;
      });
      
      const numBins = 50;
      const binSize = (maxP - minP) / numBins;
      
      sorted15m.forEach(c => {
        totalVol += c.volume;
        const typP = (c.high + c.low + c.close) / 3;
        const binIndex = Math.floor((typP - minP) / binSize);
        bins[binIndex] = (bins[binIndex] || 0) + c.volume;
      });
      
      let pocBin = -1;
      let maxVol = -1;
      Object.entries(bins).forEach(([idx, vol]) => {
        if(vol > maxVol) { maxVol = vol; pocBin = parseInt(idx); }
      });
      const pocPrice = minP + (pocBin * binSize) + (binSize / 2);

      // --- BLOCKCHAIN FLOW CALCULATION ---
      let totalInflow = 0;
      let totalOutflow = 0;
      let totalInflow4H = 0;
      let totalOutflow4H = 0;
      let totalInflow1H = 0;
      let totalOutflow1H = 0;
      let totalInflow15m = 0;
      let totalOutflow15m = 0;
      let flowHistory = [];
      
      const last24h15m = sorted15m.slice(-96);
      const last4h15mStartIndex = Math.max(0, last24h15m.length - 16);
      const last1h15mStartIndex = Math.max(0, last24h15m.length - 4);
      const last15mStartIndex = Math.max(0, last24h15m.length - 1);
      
      last24h15m.forEach((c, idx) => {
        const isUp = c.close >= c.open;
        const volUsd = c.volume * c.close;
        const oi = oiData ? oiData.find(o => Math.abs(o.time - c.time) < 900000) : null;
        const oiDelta = oi ? (oi.turnover || 0) : 0; 
        
        let flow = 0;
        if (isUp) {
          flow = volUsd; 
          totalInflow += flow;
          if (idx >= last4h15mStartIndex) totalInflow4H += flow;
          if (idx >= last1h15mStartIndex) totalInflow1H += flow;
          if (idx >= last15mStartIndex) totalInflow15m += flow;
        } else {
          flow = -volUsd;
          totalOutflow += Math.abs(flow);
          if (idx >= last4h15mStartIndex) totalOutflow4H += Math.abs(flow);
          if (idx >= last1h15mStartIndex) totalOutflow1H += Math.abs(flow);
          if (idx >= last15mStartIndex) totalOutflow15m += Math.abs(flow);
        }
        flowHistory.push({ time: c.time / 1000, value: flow });
      });

      const netFlow = totalInflow - totalOutflow;
      const netFlow4H = totalInflow4H - totalOutflow4H;
      const netFlow1H = totalInflow1H - totalOutflow1H;
      const netFlow15m = totalInflow15m - totalOutflow15m;
      const currentPrice = sorted15m[sorted15m.length - 1].close;

      // MULTI-TIMEFRAME TREND CHANNELS
      const mapForChannel = (candles) => {
        if (!candles || candles.length < 50) return [];
        return [...candles].reverse().map(c => ({
          ...c,
          time: Math.floor(c.time / 1000)
        })).filter((v, i, a) => i === 0 || v.time > a[i - 1].time);
      };

      const trendChannels = {};
      const ch15 = detectChannel(mapForChannel(m15Candles));
      if (ch15) trendChannels['15'] = ch15;
      const ch60 = detectChannel(mapForChannel(h1Candles));
      if (ch60) trendChannels['60'] = ch60;
      const ch240 = detectChannel(mapForChannel(h4Candles));
      if (ch240) trendChannels['240'] = ch240;
      const chD = detectChannel(mapForChannel(dCandles));
      if (chD) trendChannels['D'] = chD;

      const sorted4h = [...(h4Candles || [])].reverse();
      const demandZone = detectDemandZone(sorted4h);
      const macroFlow = calculateMTFFlow(dCandles, h4Candles, { netFlow4H, netFlow1D: netFlow, netFlow1H, netFlow15m });

      // --- STRENGTH METRICS ---
      const now = new Date();
      const startOfDayTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
      const todayCandle = sorted15m.find(c => c.time >= startOfDayTime) || sorted15m[0];
      const todayStrength = todayCandle ? ((currentPrice / todayCandle.open) - 1) * 100 : 0;
      
      const candle24hAgo = sorted15m[Math.max(0, sorted15m.length - 96)];
      const strength24H = candle24hAgo ? ((currentPrice / candle24hAgo.open) - 1) * 100 : 0;

      const newResult = {
        symbol,
        macroFlow,
        currentPrice,
        demandZone,
        liquiditySweep: bestSweep,
        volumeProfile: { poc: pocPrice, minP, maxP, bins, binSize, maxVol },
        flow: { netFlow, totalInflow, totalOutflow, history: flowHistory },
        cupPattern,
        sweepCandles: bestSweep.candles,
        m15Candles: sorted15m,
        dCandles,
        trendChannels,
        todayStrength,
        strength24H
      };

      setResult(newResult);

      // Live Chart Update
      if (isBackgroundUpdate && chartInstances.current.ls && chartInstances.current.vp && chartInstances.current.flow) {
        const lastSweepCandle = bestSweep.candles[bestSweep.candles.length - 1];
        chartInstances.current.ls.series[0].update({ time: lastSweepCandle.time / 1000, open: lastSweepCandle.open, high: lastSweepCandle.high, low: lastSweepCandle.low, close: lastSweepCandle.close });
        
        const last15mCandle = sorted15m[sorted15m.length - 1];
        chartInstances.current.vp.series[0].update({ time: last15mCandle.time / 1000, open: last15mCandle.open, high: last15mCandle.high, low: last15mCandle.low, close: last15mCandle.close });
        
        const lastFlow = flowHistory[flowHistory.length - 1];
        chartInstances.current.flow.series[0].update({ time: lastFlow.time, value: lastFlow.value, color: lastFlow.value >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)' });
        
        if (chartInstances.current.para) {
          const lastD = dCandles && dCandles[0]; 
          if (lastD) {
             chartInstances.current.para.series[0].update({ time: Math.floor(lastD.time / 1000), open: lastD.open, high: lastD.high, low: lastD.low, close: lastD.close });
          }
        }
      }

    } catch (err) {
      if (!isBackgroundUpdate) {
        console.error("TokenXRay Error:", err);
        setError("Erreur: " + (err.message || "Token introuvable sur Bybit Linear."));
      }
    }
  };

  const performDeepDive = async () => {
    if (!searchInput.trim()) return;
    const symbol = searchInput.toUpperCase().trim() + (searchInput.toUpperCase().endsWith('USDT') ? '' : 'USDT');
    
    setScanning(true);
    setError('');
    setResult(null);
    setIsLive(false);
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    activeSymbolRef.current = symbol;

    // Clean up old charts
    Object.values(chartInstances.current).forEach(c => {
      try { c.remove(); } catch(e){}
    });
    chartInstances.current = {};

    try {
      await fetchAndProcess(symbol, false);
      setIsLive(true);
      
      // Start background Live Polling (3 seconds)
      liveIntervalRef.current = setInterval(() => {
        if (activeSymbolRef.current === symbol) {
          fetchAndProcess(symbol, true);
        }
      }, 3000);

    } finally {
      setScanning(false);
    }
  };

  // Render Charts when result is available
  useEffect(() => {
    if (!result) return;

    const chartOptions = {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false }
    };

    // 1. LIQUIDITY SWEEP CHART
    if (lsChartRef.current) {
      const chart = createChart(lsChartRef.current, { ...chartOptions, height: 320 });
      chartInstances.current.ls = chart;
      
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });
      
      const dData = result.sweepCandles.map(c => ({
        time: c.time / 1000, open: c.open, high: c.high, low: c.low, close: c.close
      }));
      candleSeries.setData(dData);
      chartInstances.current.ls.series = [candleSeries];

      if (result.liquiditySweep.type !== 'NONE') {
        const color = result.liquiditySweep.type === 'BULLISH' ? '#10b981' : '#ef4444';
        candleSeries.createPriceLine({
          price: result.liquiditySweep.level,
          color: color,
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Sweep Level'
        });
      }
      chart.timeScale().fitContent();
    }

    // 2. VOLUME PROFILE CHART
    if (vpChartRef.current) {
      const chart = createChart(vpChartRef.current, { ...chartOptions, height: 320 });
      chartInstances.current.vp = chart;
      
      const candleSeries = chart.addCandlestickSeries({
        upColor: 'rgba(16, 185, 129, 0.5)', downColor: 'rgba(239, 68, 68, 0.5)', borderVisible: false, wickUpColor: 'rgba(16, 185, 129, 0.5)', wickDownColor: 'rgba(239, 68, 68, 0.5)'
      });
      
      const m15Data = result.m15Candles.map(c => ({
        time: c.time / 1000, open: c.open, high: c.high, low: c.low, close: c.close
      }));
      candleSeries.setData(m15Data);
      chartInstances.current.vp.series = [candleSeries];

      candleSeries.createPriceLine({
        price: result.volumeProfile.poc,
        color: '#eab308',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'POC'
      });
      chart.timeScale().fitContent();
    }

    // 3. FLOW CHART
    if (flowChartRef.current) {
      const chart = createChart(flowChartRef.current, { ...chartOptions, height: 320 });
      chartInstances.current.flow = chart;
      
      const histSeries = chart.addHistogramSeries({
        color: '#3b82f6', priceFormat: { type: 'volume' }, priceScaleId: ''
      });
      
      const flowData = result.flow.history.map(f => ({
        time: f.time,
        value: f.value,
        color: f.value >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
      }));
      histSeries.setData(flowData);
      chartInstances.current.flow.series = [histSeries];
      chart.timeScale().fitContent();
    }

    // 4. PARABOLIC STRUCTURE CHART
    if (paraChartRef.current) {
      const chart = createChart(paraChartRef.current, { ...chartOptions, height: 320 });
      chartInstances.current.para = chart;
      
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });
      
      let dKlines;
      if (result.cupPattern && result.cupPattern.klines) {
         dKlines = [...result.cupPattern.klines];
      } else if (result.dCandles && result.dCandles.length > 0) {
         dKlines = [...result.dCandles].reverse().map(c => ({
           time: Math.floor(c.time / 1000), open: c.open, high: c.high, low: c.low, close: c.close
         }));
      } else {
         dKlines = [];
      }
      candleSeries.setData(dKlines);
      chartInstances.current.para.series = [candleSeries];

      if (result.cupPattern && result.cupPattern.parabolaCurve && result.cupPattern.parabolaCurve.length > 0) {
        const lineSeries = chart.addLineSeries({
          color: '#d946ef',
          lineWidth: 2,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        lineSeries.setData(result.cupPattern.parabolaCurve);
      }
      
      chart.timeScale().fitContent();
    }

    // Handle resize
    const handleResize = () => {
      if (lsChartRef.current && chartInstances.current.ls) chartInstances.current.ls.applyOptions({ width: lsChartRef.current.clientWidth });
      if (vpChartRef.current && chartInstances.current.vp) chartInstances.current.vp.applyOptions({ width: vpChartRef.current.clientWidth });
      if (flowChartRef.current && chartInstances.current.flow) chartInstances.current.flow.applyOptions({ width: flowChartRef.current.clientWidth });
      if (paraChartRef.current && chartInstances.current.para) chartInstances.current.para.applyOptions({ width: paraChartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [result]);

  return (
    <div style={{ padding: '0.5rem', height: '100%', overflowY: 'auto', position: 'relative' }}>
      
      {/* GLOBAL PRICES DISPLAY (TOP LEFT) */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
        {globalPrices.btc && (
          <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
            <span style={{ fontWeight: '900', color: '#f7931a', fontSize: '1.1rem' }}>BTC</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>${globalPrices.btc.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style={{ color: globalPrices.btc.change >= 0 ? '#00ff88' : '#ff3366', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {globalPrices.btc.change >= 0 ? '+' : ''}{globalPrices.btc.change.toFixed(2)}%
            </span>
          </div>
        )}
        {globalPrices.sol && (
          <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
            <span style={{ fontWeight: '900', color: '#14f195', fontSize: '1.1rem' }}>SOL</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>${globalPrices.sol.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style={{ color: globalPrices.sol.change >= 0 ? '#00ff88' : '#ff3366', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {globalPrices.sol.change >= 0 ? '+' : ''}{globalPrices.sol.change.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* HEADER & SEARCH */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#00d0ff', fontSize: '2rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px', textShadow: '0 0 20px rgba(0, 208, 255, 0.5)', margin: '0 0 0.5rem 0' }}>
          <Crosshair size={32} /> TOKEN X-RAY
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
          Recherche unifiée instantanée : Liquidity Sweep, Volume Profile & Blockchain Flow.
        </p>

        <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '600px', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                type="text" 
                placeholder="Entrez un symbole (ex: SOL, WIF, BTC)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && performDeepDive()}
                style={{
                  width: '100%', padding: '16px 20px 16px 48px', fontSize: '1.2rem',
                  background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 208, 255, 0.3)',
                  borderRadius: '12px', color: '#fff', outline: 'none', transition: 'border-color 0.2s',
                  textTransform: 'uppercase'
                }}
                onFocus={e => e.target.style.borderColor = '#00d0ff'}
                onBlur={e => e.target.style.borderColor = 'rgba(0, 208, 255, 0.3)'}
              />
            </div>
            <button 
              onClick={performDeepDive}
              disabled={scanning}
              style={{
                padding: '0 32px', fontSize: '1.1rem', fontWeight: 'bold',
                background: scanning ? '#64748b' : '#00d0ff', color: '#000',
                border: 'none', borderRadius: '12px', cursor: scanning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', boxShadow: scanning ? 'none' : '0 0 20px rgba(0, 208, 255, 0.4)'
              }}
            >
              {scanning ? <Activity className="spin" size={24} /> : <Zap size={24} />}
              {scanning ? 'SCAN...' : 'X-RAY'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(0, 208, 255, 0.2)' }}>
              <span style={{ padding: '0 8px', fontSize: '0.8rem', color: '#94a3b8' }}>Analyze against:</span>
              <button 
                onClick={() => setAnalyzeAgainst('SOL')}
                style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'SOL' ? '#00d0ff' : 'transparent', color: analyzeAgainst === 'SOL' ? '#000' : '#888', fontWeight: analyzeAgainst === 'SOL' ? 'bold' : 'normal', cursor: 'pointer' }}
              >
                VS SOL
              </button>
              <button 
                onClick={() => setAnalyzeAgainst('BTC')}
                style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'BTC' ? '#f7931a' : 'transparent', color: analyzeAgainst === 'BTC' ? '#000' : '#888', fontWeight: analyzeAgainst === 'BTC' ? 'bold' : 'normal', cursor: 'pointer' }}
              >
                VS BTC
              </button>
              <button 
                onClick={() => setAnalyzeAgainst('USDT')}
                style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'USDT' ? '#00ff88' : 'transparent', color: analyzeAgainst === 'USDT' ? '#000' : '#888', fontWeight: analyzeAgainst === 'USDT' ? 'bold' : 'normal', cursor: 'pointer' }}
              >
                VS USDT
              </button>
            </div>
          </div>
        </div>
        {error && <div style={{ color: '#ef4444', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> {error}</div>}
      </div>

      {/* RESULTS DASHBOARD */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* 1. PRICE & SUMMARY */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '2rem', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${result.symbol === 'BTCUSDT' ? '1' : result.symbol === 'ETHUSDT' ? '1027' : '825'}.png`} 
                   alt="icon" style={{ width: '40px', height: '40px', borderRadius: '50%' }} 
                   onError={(e) => e.target.style.display = 'none'} />
              {result.symbol} <span style={{ color: '#00d0ff', fontSize: '1.8rem', fontWeight: 'normal' }}>${result.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
            </h2>
          </div>

          {/* GRAND MASTER ENGINE & SWAP ENGINE CONTAINER */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            
            {/* GRAND MASTER ENGINE */}
            {masterEngineData && (
               <div style={{ flex: 2, minWidth: '400px', background: 'linear-gradient(135deg, rgba(20, 30, 48, 0.9), rgba(36, 59, 85, 0.9))', border: '2px solid rgba(0, 208, 255, 0.4)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 0 30px rgba(0, 208, 255, 0.15)' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.4rem', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' }}>
                     <Zap size={24} color="#00d0ff" />
                     GRAND MASTER VERDICT
                  </h3>
                  
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 'bold' }}>XRAY ENGINE (ABSOLUTE)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: engineData.score >= 70 ? '#10b981' : engineData.score <= 30 ? '#ef4444' : '#eab308' }}>
                           {engineData.state}
                        </div>
                     </div>
                     
                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '2rem' }}>
                        <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 'bold' }}>MULTI-PAIR ENGINE (RELATIVE)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: relativeEngineData.score >= 70 ? '#10b981' : relativeEngineData.score <= 30 ? '#ef4444' : '#eab308' }}>
                           {relativeEngineData.state}
                        </div>
                     </div>

                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '2rem' }}>
                        <div style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>MASTER SCORE</div>
                        <div style={{ fontSize: '3.5rem', fontWeight: '900', color: masterEngineData.score >= 70 ? '#10b981' : masterEngineData.score <= 30 ? '#ef4444' : '#eab308', lineHeight: '1' }}>
                           {masterEngineData.score}
                        </div>
                     </div>
                  </div>

                  <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '1.1rem' }}>VERDICT:</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '900', color: masterEngineData.decision.includes('ALL SYSTEMS GO') || masterEngineData.decision.includes('ENTRY') ? '#10b981' : masterEngineData.decision.includes('AVOID') ? '#ef4444' : '#eab308' }}>
                           {masterEngineData.decision}
                        </span>
                     </div>
                     <div style={{ color: '#cbd5e1', fontSize: '1.1rem', fontStyle: 'italic' }}>
                        "{masterEngineData.reason}"
                     </div>
                  </div>
               </div>
            )}

            {/* SWAP ENGINE */}
            {swapData && (
               <div style={{ flex: 1, minWidth: '300px', background: 'linear-gradient(135deg, rgba(20, 10, 48, 0.9), rgba(56, 19, 85, 0.9))', border: `2px solid ${swapData.action === 'SWAP TO TOKEN' ? '#00ff88' : swapData.action === 'SWAP TO SOL' ? '#ff3366' : '#eab308'}`, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: `0 0 30px ${swapData.action === 'SWAP TO TOKEN' ? 'rgba(0, 255, 136, 0.15)' : swapData.action === 'SWAP TO SOL' ? 'rgba(255, 51, 102, 0.15)' : 'rgba(234, 179, 8, 0.15)'}` }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.4rem', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' }}>
                     <Crosshair size={24} color={swapData.action === 'SWAP TO TOKEN' ? '#00ff88' : swapData.action === 'SWAP TO SOL' ? '#ff3366' : '#eab308'} />
                     STRATEGIC SWAP
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 'bold' }}>RELATIVE VS SOL</div>
                     <div style={{ fontSize: '2rem', fontWeight: '900', color: swapData.vsSol >= 0 ? '#00ff88' : '#ff3366' }}>
                        {swapData.vsSol >= 0 ? '+' : ''}{swapData.vsSol.toFixed(2)}%
                     </div>
                     <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
                        {swapData.state}
                     </div>
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '1rem' }}>ACTION:</span>
                        <span style={{ fontSize: '1.6rem', fontWeight: '900', color: swapData.action === 'SWAP TO TOKEN' ? '#00ff88' : swapData.action === 'SWAP TO SOL' ? '#ff3366' : '#eab308' }}>
                           {swapData.action}
                        </span>
                     </div>
                     <div style={{ color: '#cbd5e1', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: '1.4' }}>
                        "{swapData.reason}"
                     </div>
                  </div>
               </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>

            {/* STRENGTH INDICATORS */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
               <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                 <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Today Strength</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: '900', color: result.todayStrength >= 0 ? '#00ff88' : '#ff3366' }}>
                   {result.todayStrength >= 0 ? '+' : ''}{result.todayStrength.toFixed(2)}%
                 </div>
               </div>
               <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                 <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>24H Strength</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: '900', color: result.strength24H >= 0 ? '#00ff88' : '#ff3366' }}>
                   {result.strength24H >= 0 ? '+' : ''}{result.strength24H.toFixed(2)}%
                 </div>
               </div>
            </div>
          </div>

          <OpenInterestChart symbol={result.symbol} onOIData={setOiData} />

          {/* MULTI-TIMEFRAME MACRO FLOW ROW */}
          {result.macroFlow && (
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem', marginBottom: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                <Zap size={24} style={{ color: '#00ff88' }} /> 
                <h3 style={{ margin: 0, color: '#00ff88', fontSize: '1.2rem', textTransform: 'uppercase', textShadow: '0 0 10px rgba(0, 255, 136, 0.3)' }}>MULTI-TIMEFRAME MACRO FLOW</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: '#64748b', fontWeight: 900, letterSpacing: '0.5px' }}>
                <span>ASSET</span>
                <span>NET FLOW (15m)</span>
                <span>NET FLOW (1H)</span>
                <span>NET FLOW (4H)</span>
                <span>NET FLOW (1D)</span>
                <span>NET FLOW (3D)</span>
                <span>NET FLOW (1W)</span>
                <span style={{ textAlign: 'right' }}>GRAVITY</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', alignItems: 'center', padding: '16px 0', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>{result.symbol.replace('USDT', '')}</span>
                  <span style={{ fontSize: '0.65rem', padding: '4px 8px', background: `${result.macroFlow.status.col}15`, color: result.macroFlow.status.col, border: `1px solid ${result.macroFlow.status.col}30`, borderRadius: '6px', width: 'fit-content', marginTop: '6px', fontWeight: 800 }}>{result.macroFlow.status.label}</span>
                </div>
                <span style={{ color: result.macroFlow.flow15m >= 0 ? '#00e676' : '#ff3b30', fontWeight: 800, fontSize: '1rem' }}>{result.macroFlow.flow15m >= 0 ? '+' : '-'}${formatMoney(Math.abs(result.macroFlow.flow15m))}</span>
                <span style={{ color: result.macroFlow.flow1H >= 0 ? '#00e676' : '#ff3b30', fontWeight: 800, fontSize: '1rem' }}>{result.macroFlow.flow1H >= 0 ? '+' : '-'}${formatMoney(Math.abs(result.macroFlow.flow1H))}</span>
                <span style={{ color: result.macroFlow.flow4H >= 0 ? '#00e676' : '#ff3b30', fontWeight: 800, fontSize: '1rem' }}>{result.macroFlow.flow4H >= 0 ? '+' : '-'}${formatMoney(Math.abs(result.macroFlow.flow4H))}</span>
                <span style={{ color: result.macroFlow.flow1D >= 0 ? '#00e676' : '#ff3b30', fontWeight: 800, fontSize: '1rem' }}>{result.macroFlow.flow1D >= 0 ? '+' : '-'}${formatMoney(Math.abs(result.macroFlow.flow1D))}</span>
                <span style={{ color: result.macroFlow.flow3D >= 0 ? '#00e676' : '#ff3b30', fontWeight: 800, fontSize: '1rem' }}>{result.macroFlow.flow3D >= 0 ? '+' : '-'}${formatMoney(Math.abs(result.macroFlow.flow3D))}</span>
                <span style={{ color: result.macroFlow.flow1W >= 0 ? '#00e676' : '#ff3b30', fontWeight: 800, fontSize: '1rem' }}>{result.macroFlow.flow1W >= 0 ? '+' : '-'}${formatMoney(Math.abs(result.macroFlow.flow1W))}</span>
                <div style={{ textAlign: 'right' }}>
                   <span style={{ color: result.macroFlow.score > 0 ? '#00e676' : '#ff3b30', fontWeight: 900, fontSize: '1.3rem' }}>{result.macroFlow.score > 0 ? '+' : ''}{result.macroFlow.score}</span>
                </div>
              </div>
            </div>
          )}
          
          <TokenCorrelationTable symbol={result.symbol} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            
            {/* 1. LIQUIDITY SWEEP */}
            <div style={{ background: 'rgba(10, 26, 33, 0.8)', border: '1px solid rgba(255, 51, 102, 0.3)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 1rem', background: 'rgba(255, 51, 102, 0.1)', borderBottom: '1px solid rgba(255, 51, 102, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Crosshair size={16} color="#ff3366" />
                  <h3 style={{ margin: 0, color: '#ff3366', fontSize: '0.9rem' }}>LIQUIDITY SWEEP</h3>
                </div>
                {isLive && <span style={{ color: '#ff3366', fontSize: '0.7rem', animation: 'pulse 1.5s infinite' }}>● LIVE</span>}
              </div>
              <div style={{ padding: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Statut ({result.liquiditySweep.tf})</span>
                  <span style={{ fontWeight: 'bold', color: result.liquiditySweep.type === 'BULLISH' ? '#10b981' : result.liquiditySweep.type === 'BEARISH' ? '#ef4444' : '#64748b' }}>
                    {result.liquiditySweep.type === 'NONE' ? 'Aucun Sweep' : `${result.liquiditySweep.type} SWEEP`}
                  </span>
                </div>
                {result.liquiditySweep.type !== 'NONE' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                    <span style={{ color: '#94a3b8' }}>Distance (Stop Loss)</span>
                    <span style={{ fontWeight: 'bold', color: '#fff' }}>{result.liquiditySweep.distance.toFixed(2)}%</span>
                  </div>
                )}
                <div ref={lsChartRef} style={{ width: '100%', height: '320px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }} />
              </div>
            </div>

            {/* 2. VOLUME PROFILE */}
            <div style={{ background: 'rgba(10, 26, 33, 0.8)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 1rem', background: 'rgba(234, 179, 8, 0.1)', borderBottom: '1px solid rgba(234, 179, 8, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart2 size={16} color="#eab308" />
                  <h3 style={{ margin: 0, color: '#eab308', fontSize: '0.9rem' }}>VOLUME PROFILE (24H)</h3>
                </div>
                {isLive && <span style={{ color: '#eab308', fontSize: '0.7rem', animation: 'pulse 1.5s infinite' }}>● LIVE</span>}
              </div>
              <div style={{ padding: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Point of Control (POC)</span>
                  <span style={{ fontWeight: 'bold', color: '#eab308' }}>${result.volumeProfile.poc.toFixed(4)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Distance du POC</span>
                  <span style={{ fontWeight: 'bold', color: '#fff' }}>
                    {(((result.currentPrice - result.volumeProfile.poc) / result.volumeProfile.poc) * 100).toFixed(2)}%
                  </span>
                </div>
                <div ref={vpChartRef} style={{ width: '100%', height: '320px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }} />
              </div>
            </div>

            {/* 3. BLOCKCHAIN FLOW */}
            <div style={{ background: 'rgba(10, 26, 33, 0.8)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 1rem', background: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Link size={16} color="#3b82f6" />
                  <h3 style={{ margin: 0, color: '#3b82f6', fontSize: '0.9rem' }}>BLOCKCHAIN FLOW (24H)</h3>
                </div>
                {isLive && <span style={{ color: '#3b82f6', fontSize: '0.7rem', animation: 'pulse 1.5s infinite' }}>● LIVE</span>}
              </div>
              <div style={{ padding: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Net Flow</span>
                  <span style={{ fontWeight: 'bold', color: result.flow.netFlow >= 0 ? '#10b981' : '#ef4444' }}>
                    {result.flow.netFlow > 0 ? '+' : ''}${formatMoney(result.flow.netFlow)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                  <span style={{ color: '#10b981' }}>Inflow: ${formatMoney(result.flow.totalInflow)}</span>
                  <span style={{ color: '#ef4444' }}>Outflow: ${formatMoney(result.flow.totalOutflow)}</span>
                </div>
                <div ref={flowChartRef} style={{ width: '100%', height: '320px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }} />
              </div>
            </div>

            {/* 4. PARABOLIC STRUCTURE */}
            <div style={{ background: 'rgba(10, 26, 33, 0.8)', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 1rem', background: 'rgba(217, 70, 239, 0.1)', borderBottom: '1px solid rgba(217, 70, 239, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={16} color="#d946ef" />
                  <h3 style={{ margin: 0, color: '#d946ef', fontSize: '0.9rem' }}>MACRO SOL 1D (CUP & HANDLE)</h3>
                </div>
                {isLive && <span style={{ color: '#d946ef', fontSize: '0.7rem', animation: 'pulse 1.5s infinite' }}>● LIVE</span>}
              </div>
              <div style={{ padding: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#94a3b8' }}>Statut</span>
                  <span style={{ fontWeight: 'bold', color: result.cupPattern ? '#d946ef' : '#64748b' }}>
                    {result.cupPattern ? result.cupPattern.type : 'AUCUN BOL'}
                  </span>
                </div>
                {result.cupPattern && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                    <span style={{ color: '#94a3b8' }}>Ancien Sommet: <span style={{ color: '#fff', fontWeight: 'bold' }}>${result.cupPattern.oldHigh}</span></span>
                    <span style={{ color: '#94a3b8' }}>To Breakout: <span style={{ color: result.cupPattern.breakoutPercent >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{result.cupPattern.breakoutPercent.toFixed(2)}%</span></span>
                  </div>
                )}
                <div ref={paraChartRef} style={{ width: '100%', height: '320px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }} />
              </div>
            </div>

            {/* 5. MULTI-TIMEFRAME TREND CHANNELS */}
            {result.trendChannels && Object.keys(result.trendChannels).length > 0 && (
              <div style={{ gridColumn: '1 / -1', background: 'rgba(10, 26, 33, 0.8)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '16px', overflow: 'hidden', marginTop: '1rem' }}>
                <div style={{ padding: '0.6rem 1rem', background: 'rgba(0, 255, 136, 0.1)', borderBottom: '1px solid rgba(0, 255, 136, 0.2)', display: 'flex', alignItems: 'center' }}>
                  <BarChart2 size={16} color="#00ff88" style={{ marginRight: '8px' }} />
                  <h3 style={{ margin: 0, color: '#00ff88', fontSize: '0.9rem', textTransform: 'uppercase' }}>DEEP TREND CHANNEL ANALYSIS (4 TIMEFRAMES)</h3>
                </div>
                <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {[
                    { tf: '15', label: '15M' },
                    { tf: '60', label: '1H' },
                    { tf: '240', label: '4H' },
                    { tf: 'D', label: '1D' }
                  ].map(({ tf, label }) => result.trendChannels[tf] && (
                    <div key={tf} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '12px' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                        {label} Trend ({result.trendChannels[tf].channelType}) - Score: {Math.round(result.trendChannels[tf].quality)}/100
                      </h4>
                      <ChannelChart channelData={{ ...result.trendChannels[tf] }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. RESISTANCE LEVELS CHART */}
          <ResistanceChart symbol={result.symbol} analyzeAgainst={analyzeAgainst} setAnalyzeAgainst={setAnalyzeAgainst} demandZone={result.demandZone} onChartData={setChartData} />

          {/* 7. MULTI-PACK CHARTS (USDT, SOL, BTC) */}
          <MultiPackCharts symbol={result.symbol} onEngineData={setRelativeEngineData} />

          {/* 11. TOKEN NEWS */}
          <TokenNews symbol={result.symbol} />

          {/* 11. TOKEN WHALES (Hyperliquid Smart Money) */}
          <TokenWhales symbol={result.symbol} />
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
};

export default TokenXRay;
