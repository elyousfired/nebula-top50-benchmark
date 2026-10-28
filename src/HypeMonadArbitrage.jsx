import React, { useState, useEffect, useRef } from 'react';
import { fetchBybitData } from './logic/scanner';
import { createChart } from 'lightweight-charts';

// Math Helpers
const calcSMA = (data, period) => {
  return data.map((val, idx, arr) => {
    if (idx < period - 1) return null;
    const slice = arr.slice(idx - period + 1, idx + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
  });
};

const calcStdDev = (data, smaData, period) => {
  return data.map((val, idx, arr) => {
    if (idx < period - 1) return null;
    const slice = arr.slice(idx - period + 1, idx + 1);
    const mean = smaData[idx];
    const variance = slice.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / period;
    return Math.sqrt(variance);
  });
};

const HypeMonadArbitrage = () => {
  const chartContainer1 = useRef();
  const chartContainer2 = useRef();
  const [loading, setLoading] = useState(true);
  const [lastZScore, setLastZScore] = useState(0);
  const [lastRatio, setLastRatio] = useState(0);
  const [lastMonPrice, setLastMonPrice] = useState(0);

  useEffect(() => {
    let active = true;
    
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch 4H data for both
        const [hypeRes, monRes] = await Promise.all([
          fetchBybitData('HYPEUSDT', '240', 200),
          fetchBybitData('MONUSDT', '240', 200)
        ]);

        if (!active || !hypeRes || !monRes) return;

        // Reverse to oldest -> newest
        const hypeData = hypeRes.reverse();
        const monData = monRes.reverse();

        // Align data by timestamp in case of missing candles
        const monMap = new Map();
        monData.forEach(c => monMap.set(c[0], parseFloat(c[4]))); // [0] is timestamp, [4] is close

        const alignedData = [];
        const normalizedHype = [];
        const normalizedMon = [];
        
        let firstHypePrice = 0;
        let firstMonPrice = 0;

        hypeData.forEach(c => {
          const ts = c[0];
          const hypeClose = parseFloat(c[4]);
          const monClose = monMap.get(ts);

          if (monClose) {
            if (alignedData.length === 0) {
              firstHypePrice = hypeClose;
              firstMonPrice = monClose;
            }
            
            const timeStr = parseInt(ts) / 1000;
            
            normalizedHype.push({ time: timeStr, value: ((hypeClose - firstHypePrice) / firstHypePrice) * 100 });
            normalizedMon.push({ time: timeStr, value: ((monClose - firstMonPrice) / firstMonPrice) * 100 });
            
            alignedData.push({
              time: timeStr,
              hype: hypeClose,
              mon: monClose,
              ratio: hypeClose / monClose
            });
          }
        });

        // Calculate Z-Score
        const ratios = alignedData.map(d => d.ratio);
        const period = 20;
        const smaData = calcSMA(ratios, period);
        const stdDevData = calcStdDev(ratios, smaData, period);

        const zScoreData = [];
        let currentZ = 0;
        let currentRatio = 0;

        alignedData.forEach((d, i) => {
          if (i >= period - 1) {
            const z = (d.ratio - smaData[i]) / stdDevData[i];
            zScoreData.push({ time: d.time, value: z });
            currentZ = z;
            currentRatio = d.ratio;
          }
        });

        setLastZScore(currentZ);
        setLastRatio(currentRatio);
        if (alignedData.length > 0) {
          setLastMonPrice(alignedData[alignedData.length - 1].mon);
        }

        // Chart 1: Normalized Performance
        if (chartContainer1.current) {
          chartContainer1.current.innerHTML = '';
          const chart1 = createChart(chartContainer1.current, {
            layout: { background: { type: 'solid', color: '#111827' }, textColor: '#9ca3af' },
            grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
            timeScale: { timeVisible: true }
          });
          const hypeSeries = chart1.addLineSeries({ color: '#06b6d4', lineWidth: 2, title: 'HYPE %' });
          const monSeries = chart1.addLineSeries({ color: '#836EFD', lineWidth: 2, title: 'MON %' });
          hypeSeries.setData(normalizedHype);
          monSeries.setData(normalizedMon);
          chart1.timeScale().fitContent();
        }

        // Chart 2: Z-Score
        if (chartContainer2.current) {
          chartContainer2.current.innerHTML = '';
          const chart2 = createChart(chartContainer2.current, {
            layout: { background: { type: 'solid', color: '#111827' }, textColor: '#9ca3af' },
            grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
            timeScale: { timeVisible: true }
          });
          const zSeries = chart2.addAreaSeries({ 
            topColor: 'rgba(239, 68, 68, 0.4)', 
            bottomColor: 'rgba(34, 197, 94, 0.4)',
            lineColor: '#eab308', 
            lineWidth: 2, 
            title: 'Z-Score' 
          });
          
          zSeries.setData(zScoreData);
          
          const upperSeries = chart2.addLineSeries({ color: '#ef4444', lineWidth: 1, lineStyle: 2, title: '+2 SD' });
          upperSeries.setData(zScoreData.map(d => ({ time: d.time, value: 2 })));
          
          const lowerSeries = chart2.addLineSeries({ color: '#22c55e', lineWidth: 1, lineStyle: 2, title: '-2 SD' });
          lowerSeries.setData(zScoreData.map(d => ({ time: d.time, value: -2 })));

          chart2.timeScale().fitContent();
        }
        
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 60000); // 1 min update

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const getSignal = (z) => {
    if (z > 2) return { text: 'SHORT HYPE / LONG MON', color: '#ef4444', desc: 'HYPE is historically overvalued against MON' };
    if (z < -2) return { text: 'LONG HYPE / SHORT MON', color: '#22c55e', desc: 'HYPE is historically undervalued against MON' };
    return { text: 'NEUTRAL', color: '#eab308', desc: 'Ratio is within normal standard deviation' };
  };

  const getActionAdvice = (z, price) => {
    const entry = 0.026255; // DCA of 50@0.02676 and 50@0.02577
    if (price >= entry) {
      if (z < -1.5) return { text: "Take 100% Profit (MON is heavily overvalued)", color: "#22c55e", emoji: "💰" };
      if (z > -0.5 && z < 0.5) return { text: "Take 50% Profit (Mean Reversion complete)", color: "#38bdf8", emoji: "⚖️" };
      return { text: "Hold Position (Trailing stop recommended)", color: "#eab308", emoji: "⏳" };
    } else {
      if (z > 1.5) return { text: "Hold Position (MON is still undervalued, wait for rebound)", color: "#eab308", emoji: "🛡️" };
      if (z < -1.5) return { text: "Cut Losses (MON overvalued but you are in loss)", color: "#ef4444", emoji: "✂️" };
      return { text: "Hold Position (Monitor closely)", color: "#eab308", emoji: "👀" };
    }
  };

  const signal = getSignal(lastZScore);
  const advice = getActionAdvice(lastZScore, lastMonPrice);

  return (
    <div style={{ padding: '20px', color: '#fff', background: '#0f172a', minHeight: '100vh', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>⚖️</span>
        <span>Statistical Arbitrage: HYPE / MON (4H)</span>
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', position: 'relative' }}>
        
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', fontSize: '1.2rem', color: '#38bdf8' }}>
            Loading historical data & crunching Z-Scores...
          </div>
        )}

        {/* Signal Card */}
        <div style={{ background: '#1e293b', padding: '25px', borderRadius: '12px', borderLeft: `6px solid ${signal.color}`, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Signal</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '900', color: signal.color }}>{signal.text}</div>
          <div style={{ color: '#cbd5e1', marginTop: '8px', fontSize: '1.1rem' }}>{signal.desc}</div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
            <div style={{ background: '#0f172a', padding: '15px 20px', borderRadius: '8px', minWidth: '150px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase' }}>Current Ratio</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px' }}>{lastRatio.toFixed(4)}</div>
            </div>
            <div style={{ background: '#0f172a', padding: '15px 20px', borderRadius: '8px', minWidth: '150px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase' }}>Z-Score (20)</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px', color: lastZScore > 2 ? '#ef4444' : lastZScore < -2 ? '#22c55e' : '#eab308' }}>
                {lastZScore.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* USER POSITION SECTION */}
        {lastMonPrice > 0 && (
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: `2px solid ${lastMonPrice >= 0.026255 ? '#22c55e' : '#ef4444'}`, boxShadow: `0 0 15px ${lastMonPrice >= 0.026255 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`, display: 'flex', flexWrap: 'wrap', gap: '25px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: lastMonPrice >= 0.026255 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '50%', fontSize: '1.2rem' }}>
                {lastMonPrice >= 0.026255 ? '🚀' : '📉'}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Trade (DCA)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>LONG MONAD</div>
              </div>
            </div>
            
            <div style={{ height: '30px', width: '2px', background: '#334155' }} />

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Invested</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>$100</div>
            </div>

            <div style={{ height: '30px', width: '2px', background: '#334155' }} />
            
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Avg Entry</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>$0.026255</div>
            </div>
            
            <div style={{ height: '30px', width: '2px', background: '#334155' }} />
            
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Current</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>${lastMonPrice.toFixed(5)}</div>
            </div>

            <div style={{ height: '30px', width: '2px', background: '#334155' }} />
            
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>PnL %</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: lastMonPrice >= 0.026255 ? '#22c55e' : '#ef4444' }}>
                {lastMonPrice >= 0.026255 ? '+' : ''}{(((lastMonPrice - 0.026255) / 0.026255) * 100).toFixed(2)}%
              </div>
            </div>

            <div style={{ height: '30px', width: '2px', background: '#334155' }} />
            
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>PnL $</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: lastMonPrice >= 0.026255 ? '#22c55e' : '#ef4444' }}>
                {lastMonPrice >= 0.026255 ? '+$' : '-$'}{Math.abs((((lastMonPrice - 0.026255) / 0.026255) * 100)).toFixed(2)}
              </div>
            </div>

            <div style={{ flexBasis: '100%', marginTop: '5px', background: '#0f172a', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${advice.color}` }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase' }}>Live Trade Manager Advice</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: advice.color, marginTop: '5px' }}>
                {advice.emoji} {advice.text}
              </div>
            </div>
          </div>
        )}

        {/* Chart 2: Z-Score */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: '#f8fafc' }}>Z-Score Oscillator (Mean Reversion)</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 15px 0' }}>When Z-score crosses +2 (red) or -2 (green), an arbitrage opportunity exists.</p>
          <div ref={chartContainer2} style={{ height: '350px', width: '100%' }} />
        </div>

        {/* Chart 1: Normalized Returns */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: '#f8fafc' }}>Normalized Cumulative Return (%)</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 15px 0' }}>Cyan: HYPE, Purple: MON. Shows relative performance divergence.</p>
          <div ref={chartContainer1} style={{ height: '350px', width: '100%' }} />
        </div>

      </div>
    </div>
  );
};

export default HypeMonadArbitrage;
