import React, { useState, useEffect, useRef } from 'react';
import { Activity, LayoutDashboard } from 'lucide-react';
import { createChart } from 'lightweight-charts';
import { fetchBybitData } from './logic/scanner';
import { calculateSolScore } from './logic/solScoreEngine';

const timeframeHTFMap = {
  '5': '240',
  '15': '240',
  '60': '240',
  '240': 'D',
  'D': 'W',
  'W': 'M',
  'M': 'M'
};

const labelsMap = {
  '5': '5 MIN',
  '15': '15 MIN',
  '60': '1 HOUR',
  '240': '4 HOURS',
  'D': '1 DAY',
  'W': '1 WEEK',
  'M': '1 MONTH'
};

const TimeframeCard = ({ symbol, timeframe, klines, htfKlines }) => {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null);
  
  const scoreData = calculateSolScore(klines, htfKlines);

  useEffect(() => {
    if (!chartContainerRef.current || !klines || klines.length === 0 || !scoreData) return;

    if (!chartInstance.current) {
      const chart = createChart(chartContainerRef.current, {
        height: 250,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
        timeScale: { timeVisible: true, borderVisible: false },
        rightPriceScale: { borderVisible: false }
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });
      
      const emaFastSeries = chart.addLineSeries({ color: '#10b981', lineWidth: 1, crosshairMarkerVisible: false });
      const emaMidSeries = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, crosshairMarkerVisible: false });
      const emaSlowSeries = chart.addLineSeries({ color: '#ef4444', lineWidth: 2, crosshairMarkerVisible: false });
      const vwapSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false });

      chartInstance.current = { chart, candleSeries, emaFastSeries, emaMidSeries, emaSlowSeries, vwapSeries };
    }

    const { chart, candleSeries, emaFastSeries, emaMidSeries, emaSlowSeries, vwapSeries } = chartInstance.current;
    
    const data = klines.map(k => ({
      time: k.time / 1000,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close
    }));
    
    candleSeries.setData(data);

    const formatInd = (arr) => arr.map((val, i) => ({ time: data[i].time, value: val })).filter(d => !isNaN(d.value) && d.value !== 0);

    emaFastSeries.setData(formatInd(scoreData.indicators.emaFast));
    emaMidSeries.setData(formatInd(scoreData.indicators.emaMid));
    emaSlowSeries.setData(formatInd(scoreData.indicators.emaSlow));
    vwapSeries.setData(formatInd(scoreData.indicators.vwapVal));
    
    // Markers for signals
    const markers = [];
    // We only have signal flags for the last candle in our calculation, but we could compute historical if needed.
    // For now, we'll just show the latest if it's a signal
    if (scoreData.bullSignal) {
      markers.push({ time: data[data.length - 1].time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'BULL Score' });
    } else if (scoreData.bearSignal) {
      markers.push({ time: data[data.length - 1].time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'BEAR Score' });
    }
    candleSeries.setMarkers(markers);

    chart.timeScale().fitContent();

  }, [klines, scoreData]);

  if (!scoreData) return <div style={{ padding: '1rem', color: '#94a3b8' }}>Chargement ou données insuffisantes...</div>;

  const bColor = scoreData.bias.includes('BULL') ? '#10b981' : scoreData.bias.includes('BEAR') ? '#ef4444' : '#f59e0b';

  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: `1px solid ${bColor}`, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{symbol} - {labelsMap[timeframe]}</h3>
        <span style={{ background: `${bColor}22`, color: bColor, padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>
          {scoreData.bias}
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Table equivalent from Pine Script */}
        <div style={{ width: '250px', padding: '1rem', borderRight: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1' }}>
            <thead>
              <tr><th style={{ textAlign: 'left', paddingBottom: '8px', color: '#fff' }}>Metric</th><th style={{ textAlign: 'right', paddingBottom: '8px', color: '#fff' }}>Value</th></tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '4px 0' }}>Bull Score</td><td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>{scoreData.bullScore}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Bear Score</td><td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 'bold' }}>{scoreData.bearScore}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Difference</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{scoreData.scoreDiff}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Bias</td><td style={{ textAlign: 'right', color: bColor, fontWeight: 'bold' }}>{scoreData.bias}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>Regime</td><td style={{ textAlign: 'right' }}>{scoreData.bullRegime ? "Bull Regime" : scoreData.bearRegime ? "Bear Regime" : "Range"}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>HTF Bias</td><td style={{ textAlign: 'right' }}>{scoreData.htfBull ? "HTF Bull" : scoreData.htfBear ? "HTF Bear" : "HTF Neutral"}</td></tr>
              <tr><td style={{ padding: '4px 0' }}>RSI</td><td style={{ textAlign: 'right' }}>{Math.round(scoreData.rsi)}</td></tr>
            </tbody>
          </table>
          
          <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '8px', textTransform: 'uppercase' }}>Conditions de la zone</div>
            {scoreData.bullReasons.length > 0 && (
              <div style={{ color: '#10b981', marginBottom: '8px' }}>
                <strong>Bullish :</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '0.8rem' }}>
                  {scoreData.bullReasons.map((r, idx) => <li key={idx}>{r}</li>)}
                </ul>
              </div>
            )}
            {scoreData.bearReasons.length > 0 && (
              <div style={{ color: '#ef4444' }}>
                <strong>Bearish :</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '0.8rem' }}>
                  {scoreData.bearReasons.map((r, idx) => <li key={idx}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div style={{ flex: 1, padding: '1rem' }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
};

export const SolScoreDashboard = () => {
  const [symbol, setSymbol] = useState("SOLUSDT");
  const [searchInput, setSearchInput] = useState("");
  const timeframes = ['5', '15', '60', '240', 'D', 'W', 'M'];
  
  const [dataMap, setDataMap] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = {};
      // Determine unique HTFs we need
      const htfSet = new Set(Object.values(timeframeHTFMap));
      const htfCache = {};
      
      for (const htf of htfSet) {
        htfCache[htf] = await fetchBybitData(symbol, htf, 500);
      }

      for (const tf of timeframes) {
        const klines = await fetchBybitData(symbol, tf, 500);
        const htfKlines = htfCache[timeframeHTFMap[tf]];
        
        // Convert array to object format {time, open, high, low, close, volume}
        const parse = (raw) => raw.map(k => ({
          time: Number(k[0]), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5])
        }));

        results[tf] = {
          klines: parse(klines).sort((a,b)=>a.time-b.time),
          htfKlines: htfKlines ? parse(htfKlines).sort((a,b)=>a.time-b.time) : null
        };
      }
      setDataMap(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh every 1min
    return () => clearInterval(interval);
  }, [symbol]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      let s = searchInput.trim().toUpperCase();
      if (!s.endsWith('USDT')) s += 'USDT';
      setSymbol(s);
      setSearchInput('');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', margin: 0, background: 'linear-gradient(90deg, #9945FF, #14F195)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
          <LayoutDashboard size={40} color="#14F195" /> SCORE ENGINE
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginTop: '10px' }}>
          Tableau de bord multi-timeframe basé sur l'algorithme "Bull/Bear Score Engine"
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Ex: BTC, ETH..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #1e293b', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '1rem', outline: 'none' }}
            />
            <button type="submit" style={{ background: '#14F195', border: 'none', color: '#000', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Rechercher
            </button>
          </form>

          <button onClick={fetchData} disabled={loading} style={{
            background: 'rgba(20, 241, 149, 0.1)', border: '1px solid #14F195', color: '#14F195', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Activity size={18} className={loading ? 'spin' : ''} /> {loading ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {timeframes.map(tf => (
          dataMap[tf] ? (
            <TimeframeCard key={tf} symbol={symbol} timeframe={tf} klines={dataMap[tf].klines} htfKlines={dataMap[tf].htfKlines} />
          ) : null
        ))}
      </div>
    </div>
  );
};

export default SolScoreDashboard;
