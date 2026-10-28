import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { fetchBybitData, calculateEMA } from './logic/scanner';
import { fetchSolData, fetchBtcData } from './logic/sol-scanner';
import { syntheticRatio } from './logic/solSwitchEngine';
import { Activity, LayoutDashboard } from 'lucide-react';

const parseCandles = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(k => ({
    time: Number(k[0]) / 1000, // lightweight-charts uses seconds
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  })).sort((a,b) => a.time - b.time);
};

const calculateRSI = (candles, period = 14) => {
  if (candles.length <= period) return [];

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rsi = [];
  
  if (avgLoss === 0) {
    rsi.push({ time: candles[period].time, value: 100 });
  } else {
    let rs = avgGain / avgLoss;
    rsi.push({ time: candles[period].time, value: 100 - (100 / (1 + rs)) });
  }

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    let currentGain = 0;
    let currentLoss = 0;
    
    if (change > 0) currentGain = change;
    else currentLoss = -change;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      rsi.push({ time: candles[i].time, value: 100 });
    } else {
      let rs = avgGain / avgLoss;
      rsi.push({ time: candles[i].time, value: 100 - (100 / (1 + rs)) });
    }
  }

  return rsi;
};

const calculateATR = (candles, period = 14) => {
  if (candles.length <= period) return [];

  const tr = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const trValue = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    tr.push(trValue);
  }

  const atr = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  let prevAtr = sum / period;
  
  atr.push({ time: candles[period].time, value: prevAtr });

  for (let i = period; i < tr.length; i++) {
    const currentAtr = ((prevAtr * (period - 1)) + tr[i]) / period;
    atr.push({ time: candles[i + 1].time, value: currentAtr });
    prevAtr = currentAtr;
  }

  return atr;
};

export const calculateRollingStrength = (candles, period) => {
  if (!candles || candles.length < 2) return [];

  const strength = [];
  for (let i = 1; i < candles.length; i++) {
    const currentClose = candles[i].close;
    // Use full period if available, otherwise use the oldest available candle for newly listed tokens
    const lookbackIndex = i >= period ? i - period : 0;
    const oldClose = candles[lookbackIndex].close;
    
    if (oldClose === 0) continue;
    
    const pctChange = ((currentClose / oldClose) - 1) * 100;
    
    // For exactly 0, we can give it a neutral or slightly visible color so it doesn't completely disappear
    const color = pctChange > 0 ? 'rgba(16, 185, 129, 0.8)' : (pctChange < 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(148, 163, 184, 0.8)');
    strength.push({ time: candles[i].time, value: pctChange, color });
  }

  return strength;
};

// --- CHART ROW COMPONENT ---
export const ChartRow = ({ title, icon: Icon, usdtData, solData, btcData, type, options, formatFunc, showZeroCrossLine }) => {
  const usdtRef = useRef(null);
  const solRef = useRef(null);
  const btcRef = useRef(null);

  const usdtChart = useRef(null);
  const solChart = useRef(null);
  const btcChart = useRef(null);

  const usdtSeries = useRef(null);
  const solSeries = useRef(null);
  const btcSeries = useRef(null);

  useEffect(() => {
    if (!usdtRef.current || !solRef.current || !btcRef.current) return;

    const chartOptions = {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { mode: 0 },
      handleScroll: { vertTouchDrag: false },
    };

    usdtChart.current = createChart(usdtRef.current, chartOptions);
    solChart.current = createChart(solRef.current, chartOptions);
    btcChart.current = createChart(btcRef.current, chartOptions);

    const initSeries = (chartRef) => {
      if (type === 'candlestick') {
        return chartRef.current.addCandlestickSeries({
          upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350'
        });
      } else if (type === 'area') {
        const s = chartRef.current.addAreaSeries(options || {
          lineColor: '#2962FF', topColor: 'rgba(41, 98, 255, 0.28)', bottomColor: 'rgba(41, 98, 255, 0.05)'
        });
        if (options && options.addLines) options.addLines(s);
        return s;
      } else if (type === 'histogram') {
        const histSeries = chartRef.current.addHistogramSeries({
          priceFormat: { type: 'custom', formatter: formatFunc || (price => price.toFixed(2)) }
        });
        
        let lineSeries = null;
        if (showZeroCrossLine) {
           lineSeries = chartRef.current.addLineSeries({
             color: 'rgba(255, 255, 255, 0.8)',
             lineWidth: 2,
             crosshairMarkerVisible: false,
             lastValueVisible: false,
             priceLineVisible: false
           });
        }
        
        return {
           setData: (data) => {
              histSeries.setData(data);
              if (lineSeries) {
                 const lineData = data.map(d => ({ time: d.time, value: d.value }));
                 lineSeries.setData(lineData);
              }
           }
        };
      }
    };

    usdtSeries.current = initSeries(usdtChart);
    solSeries.current = initSeries(solChart);
    btcSeries.current = initSeries(btcChart);

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === usdtRef.current && usdtChart.current) {
          usdtChart.current.resize(entry.contentRect.width, 160);
        } else if (entry.target === solRef.current && solChart.current) {
          solChart.current.resize(entry.contentRect.width, 160);
        } else if (entry.target === btcRef.current && btcChart.current) {
          btcChart.current.resize(entry.contentRect.width, 160);
        }
      }
    });

    if (usdtRef.current) resizeObserver.observe(usdtRef.current);
    if (solRef.current) resizeObserver.observe(solRef.current);
    if (btcRef.current) resizeObserver.observe(btcRef.current);

    return () => {
      resizeObserver.disconnect();
      usdtChart.current?.remove();
      solChart.current?.remove();
      btcChart.current?.remove();
    };
  }, [type, options, formatFunc, showZeroCrossLine]);

  useEffect(() => {
    if (usdtSeries.current && usdtData && usdtData.length > 0) {
      usdtSeries.current.setData(usdtData);
      usdtChart.current.timeScale().fitContent();
    }
  }, [usdtData]);

  useEffect(() => {
    if (solSeries.current && solData && solData.length > 0) {
      solSeries.current.setData(solData);
      solChart.current.timeScale().fitContent();
    }
  }, [solData]);

  useEffect(() => {
    if (btcSeries.current && btcData && btcData.length > 0) {
      btcSeries.current.setData(btcData);
      btcChart.current.timeScale().fitContent();
    }
  }, [btcData]);

  return (
    <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <h3 style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#a855f7', fontSize: '0.9rem', textTransform: 'uppercase' }}>
        <Icon size={16} color="#00d0ff" />
        <span style={{ color: '#fff' }}>{title}</span>
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '4px 8px', fontSize: '0.7rem', color: '#eab308', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>VS USDT</div>
          <div ref={usdtRef} style={{ height: '160px' }} />
        </div>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '4px 8px', fontSize: '0.7rem', color: '#eab308', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>VS SOL</div>
          <div ref={solRef} style={{ height: '160px' }} />
        </div>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '4px 8px', fontSize: '0.7rem', color: '#eab308', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>VS BTC</div>
          <div ref={btcRef} style={{ height: '160px' }} />
        </div>
      </div>
    </div>
  );
};

// --- CONSTANTS FOR OPTIONS ---
const rsiOptions = {
  topColor: 'rgba(168, 85, 247, 0.4)',
  bottomColor: 'rgba(168, 85, 247, 0.05)',
  lineColor: '#a855f7',
  lineWidth: 2,
  addLines: (series) => {
    series.createPriceLine({ price: 70, color: 'rgba(239, 68, 68, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OB' });
    series.createPriceLine({ price: 30, color: 'rgba(34, 197, 94, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OS' });
  }
};

const atrOptions = {
  topColor: 'rgba(6, 182, 212, 0.4)',
  bottomColor: 'rgba(6, 182, 212, 0.05)',
  lineColor: '#06b6d4',
  lineWidth: 2,
};

const priceOptions = {
  topColor: 'rgba(168, 85, 247, 0.4)',
  bottomColor: 'rgba(168, 85, 247, 0.05)',
  lineColor: '#a855f7',
  lineWidth: 2,
};

const formatStrength = price => price.toFixed(2) + '%';

const MultiPackCharts = ({ symbol, onEngineData }) => {
  const [timeframe, setTimeframe] = useState('60'); // Default to 4H
  const [loading, setLoading] = useState(true);
  const [engineData, setEngineData] = useState(null);

  const [dataSets, setDataSets] = useState({
    pairs: { usdt: [], sol: [], btc: [] },
    atr: { usdt: [], sol: [], btc: [] },
    rsi: { usdt: [], sol: [], btc: [] },
    strength: { usdt: [], sol: [], btc: [] }
  });

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [tokenData, solData, btcData] = await Promise.all([
          fetchBybitData(symbol, timeframe, 200),
          fetchSolData(timeframe, 200),
          fetchBtcData(timeframe, 200)
        ]);

        if (!isMounted) return;

        const tokenCandles = parseCandles(tokenData);
        const solCandles = parseCandles(solData);
        const btcCandles = parseCandles(btcData);

        const syntheticSol = syntheticRatio(tokenCandles, solCandles);
        const syntheticBtc = syntheticRatio(tokenCandles, btcCandles);

        // Compute ATR
        const atrUsdt = calculateATR(tokenCandles);
        const atrSol = calculateATR(syntheticSol);
        const atrBtc = calculateATR(syntheticBtc);

        // Compute RSI
        const rsiUsdt = calculateRSI(tokenCandles);
        const rsiSol = calculateRSI(syntheticSol);
        const rsiBtc = calculateRSI(syntheticBtc);

        // Compute Rolling 24H Strength
        const getPeriodForTF = (tf) => {
          if (tf === '15') return 96;
          if (tf === '60') return 24;
          if (tf === '240') return 6;
          if (tf === 'D') return 1;
          if (tf === 'W') return 1;
          return 24;
        };
        const period = getPeriodForTF(timeframe);

        const strUsdt = calculateRollingStrength(tokenCandles, period);
        const strSol = calculateRollingStrength(syntheticSol, period);
        const strBtc = calculateRollingStrength(syntheticBtc, period);

        // --- NEW: Decision Engine Calculations ---
        if (syntheticSol.length > 50) {
          const currentSolCandle = syntheticSol[syntheticSol.length - 1];
          
          const vsSol24h = strSol.length > 0 ? strSol[strSol.length - 1].value : 0;
          const vsBtc24h = strBtc.length > 0 ? strBtc[strBtc.length - 1].value : 0;
          const vsUsdt24h = strUsdt.length > 0 ? strUsdt[strUsdt.length - 1].value : 0;
  
          const currentRsiSol = rsiSol.length > 0 ? rsiSol[rsiSol.length - 1].value : 50;
  
          // Today VS SOL Strength
          const now = new Date();
          const startOfDayTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
          // tokenCandles time is in seconds
          const todaySolCandle = syntheticSol.find(c => (c.time * 1000) >= startOfDayTime) || syntheticSol[0];
          const todaySolStrength = todaySolCandle ? ((currentSolCandle.close / todaySolCandle.open) - 1) * 100 : 0;
  
          // ATR Ratio SOL
          const atrSolValues = atrSol.map(a => a.value);
          const emaAtr50 = calculateEMA(atrSolValues, 50);
          const currentAtrSol = atrSolValues[atrSolValues.length - 1];
          const currentEmaAtr = emaAtr50[emaAtr50.length - 1];
          const atrRatio = currentEmaAtr > 0 ? (currentAtrSol / currentEmaAtr) : 1;
  
          // Chart VS SOL is above EMA20
          const solCloses = syntheticSol.map(c => c.close);
          const ema20Sol = calculateEMA(solCloses, 20);
          const currentEma20Sol = ema20Sol[ema20Sol.length - 1];
          const isAboveEma20 = currentSolCandle.close > currentEma20Sol;
  
          // Evaluate Logic
          let state = "NEUTRAL";
          let decision = "WAIT";
          let reason = "Market is deciding...";
          let score = 50;
  
          if (vsUsdt24h > 0 && vsSol24h < 0 && vsBtc24h < 0) {
             state = "FAKE PUMP RISK";
             decision = "NO BUY";
             reason = "USDT is positive, but SOL and BTC are negative.";
             score = 30;
          } else if (vsSol24h > 0 && vsBtc24h > 0 && currentRsiSol > 50 && atrRatio > 1.2 && isAboveEma20) {
             state = "STRONG MOMENTUM";
             decision = "LOOK FOR ENTRY";
             reason = "Strong against SOL & BTC, positive momentum, expanding energy.";
             score = 90;
          } else if (Math.abs(vsSol24h) <= 2 && currentRsiSol >= 45 && currentRsiSol <= 55 && atrRatio < 0.8) {
             state = "COMPRESSION";
             decision = "WAIT BREAKOUT";
             reason = "Neutral momentum and low volatility. Possible accumulation.";
             score = 50;
          } else if (vsSol24h < 0 && currentRsiSol < 45 && atrRatio > 1.2) {
             state = "BEARISH EXPANSION";
             decision = "AVOID";
             reason = "Losing strength against SOL with high bearish energy.";
             score = 20;
          } else if (vsSol24h > 0 && todaySolStrength < 0 && currentRsiSol > 45 && atrRatio < 2.0) {
             state = "PULLBACK";
             decision = "WATCH SUPPORT";
             reason = "Strong 24H but correcting today. Watch for support bounce.";
             score = 65;
          } else {
             // Fallback Score Logic
             score = 50;
             if (vsSol24h > 0) score += 15; else score -= 15;
             if (currentRsiSol > 50) score += 10; else score -= 10;
             if (isAboveEma20) score += 10; else score -= 10;
             if (vsBtc24h > 0) score += 10; else score -= 10;
             if (atrRatio > 1.2 && vsSol24h > 0) score += 10;
             if (atrRatio > 1.2 && vsSol24h < 0) score -= 10;
             score = Math.max(0, Math.min(100, score));
  
             if (score > 70) { state = "BULLISH"; decision = "LOOK FOR ENTRY"; reason = "Overall relative metrics are leaning positive."; }
             else if (score < 40) { state = "WEAK"; decision = "AVOID"; reason = "Overall relative metrics are leaning negative."; }
             else { state = "MIXED"; decision = "WAIT"; reason = "Conflicting signals between strength, momentum, and energy."; }
          }
  
          const computedEngineData = {
             vsSol24h, vsBtc24h, vsUsdt24h,
             currentRsiSol, atrRatio,
             state, decision, reason, score
          };

          setEngineData(computedEngineData);
          if (onEngineData) onEngineData(computedEngineData);
        }

        setDataSets({
          pairs: { 
            usdt: tokenCandles.map(c => ({ time: c.time, value: c.close })), 
            sol: syntheticSol.map(c => ({ time: c.time, value: c.close })), 
            btc: syntheticBtc.map(c => ({ time: c.time, value: c.close })) 
          },
          atr: { usdt: atrUsdt, sol: atrSol, btc: atrBtc },
          rsi: { usdt: rsiUsdt, sol: rsiSol, btc: rsiBtc },
          strength: { usdt: strUsdt, sol: strSol, btc: strBtc }
        });

      } catch (err) {
        console.error("MultiPackCharts Error:", err);
      }
      if (isMounted) setLoading(false);
    };

    loadData();

    return () => { isMounted = false; };
  }, [symbol, timeframe]);

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
      {/* HEADER & CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '1.2rem', textTransform: 'uppercase' }}>
          <LayoutDashboard size={20} color="#00d0ff" />
          Dashboard Multi-Paires : {symbol}
        </h3>
        
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '8px' }}>
          {['15', '60', '240', 'D', 'W'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                background: timeframe === tf ? '#eab308' : 'transparent',
                color: timeframe === tf ? '#000' : '#94a3b8',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem'
              }}
            >
              {tf === '15' ? '15m' : tf === '60' ? '1H' : tf === '240' ? '4H' : tf === 'D' ? '1D' : '1W'}
            </button>
          ))}
        </div>
      </div>

      {/* DECISION ENGINE BLOCK */}
      {engineData && (
        <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ margin: 0, color: '#eab308', fontSize: '1.1rem', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            {symbol} ENGINE
          </h4>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {/* Left Col: 24H Strengths */}
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <span style={{ color: '#94a3b8' }}>VS SOL 24H:</span>
                <span style={{ color: engineData.vsSol24h >= 0 ? '#10b981' : '#ef4444' }}>{engineData.vsSol24h > 0 ? '+' : ''}{engineData.vsSol24h.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <span style={{ color: '#94a3b8' }}>VS BTC 24H:</span>
                <span style={{ color: engineData.vsBtc24h >= 0 ? '#10b981' : '#ef4444' }}>{engineData.vsBtc24h > 0 ? '+' : ''}{engineData.vsBtc24h.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <span style={{ color: '#94a3b8' }}>VS USDT 24H:</span>
                <span style={{ color: engineData.vsUsdt24h >= 0 ? '#10b981' : '#ef4444' }}>{engineData.vsUsdt24h > 0 ? '+' : ''}{engineData.vsUsdt24h.toFixed(2)}%</span>
              </div>
            </div>

            {/* Mid Col: RSI & ATR */}
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <span style={{ color: '#94a3b8' }}>RSI SOL:</span>
                <span style={{ color: engineData.currentRsiSol > 50 ? '#10b981' : '#ef4444' }}>{engineData.currentRsiSol.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <span style={{ color: '#94a3b8' }}>ATR SOL:</span>
                <span style={{ color: engineData.atrRatio > 1.2 ? '#00d0ff' : engineData.atrRatio < 0.8 ? '#a855f7' : '#fff' }}>
                  {engineData.atrRatio > 1.2 ? 'Expansion' : engineData.atrRatio < 0.8 ? 'Compression' : 'Normal'}
                </span>
              </div>
            </div>

            {/* Right Col: Power Score */}
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '2rem' }}>
               <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>POWER SCORE</div>
               <div style={{ fontSize: '2.5rem', fontWeight: '900', color: engineData.score >= 70 ? '#10b981' : engineData.score <= 30 ? '#ef4444' : '#eab308', textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>
                 {engineData.score}<span style={{ fontSize: '1rem', color: '#64748b' }}>/100</span>
               </div>
            </div>
          </div>

          {/* Bottom Col: Decision & Reason */}
          <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
             <div style={{ display: 'flex', gap: '10px' }}>
               <span style={{ color: '#94a3b8', width: '80px', fontWeight: 'bold' }}>STATE:</span>
               <span style={{ color: '#fff', fontWeight: 'bold' }}>{engineData.state}</span>
             </div>
             <div style={{ display: 'flex', gap: '10px' }}>
               <span style={{ color: '#94a3b8', width: '80px', fontWeight: 'bold' }}>DECISION:</span>
               <span style={{ color: engineData.decision === 'LOOK FOR ENTRY' ? '#10b981' : engineData.decision === 'AVOID' || engineData.decision === 'NO BUY' ? '#ef4444' : '#eab308', fontWeight: '900', fontSize: '1.1rem' }}>
                 {engineData.decision}
               </span>
             </div>
             <div style={{ display: 'flex', gap: '10px' }}>
               <span style={{ color: '#94a3b8', width: '80px', fontWeight: 'bold' }}>REASON:</span>
               <span style={{ color: '#cbd5e1' }}>{engineData.reason}</span>
             </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ margin: '0 auto 10px auto', width: '24px', height: '24px', border: '3px solid rgba(245, 158, 11, 0.3)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Analyse des marchés en cours...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ChartRow 
            title="Multi-Pair Relative Strength (Prix)" 
            icon={Activity} 
            type="area" 
            options={priceOptions}
            usdtData={dataSets.pairs.usdt} solData={dataSets.pairs.sol} btcData={dataSets.pairs.btc} 
          />
          
          <ChartRow 
            title="ATR (Average True Range) - Volatilité" 
            icon={Activity} 
            type="area" 
            options={atrOptions}
            usdtData={dataSets.atr.usdt} solData={dataSets.atr.sol} btcData={dataSets.atr.btc} 
          />
          
          <ChartRow 
            title="RSI (14) - Momentum" 
            icon={Activity} 
            type="area" 
            options={rsiOptions}
            usdtData={dataSets.rsi.usdt} solData={dataSets.rsi.sol} btcData={dataSets.rsi.btc} 
          />
          
          <ChartRow 
            title="Force 24H Roulante (Rolling 24H Strength)" 
            icon={Activity} 
            type="histogram" 
            formatFunc={formatStrength}
            usdtData={dataSets.strength.usdt} solData={dataSets.strength.sol} btcData={dataSets.strength.btc} 
          />
        </div>
      )}
    </div>
  );
};

export default MultiPackCharts;
