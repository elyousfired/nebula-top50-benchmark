import React, { useState, useEffect, useRef } from 'react';
import { Target, ArrowRight, Activity, Clock, Zap, Maximize2, Minimize2, X } from 'lucide-react';
import { createChart } from 'lightweight-charts';
import { fetchTop500Symbols } from '../../logic/scanner';
import axios from 'axios';

// Fallback proxies for Bybit REST API
const PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
];

const fetchKlines = async (symbol) => {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=60&limit=720`;
  try {
    const res = await axios.get(url, { timeout: 2000 });
    return res.data?.result?.list || [];
  } catch (err) {}
  
  for (let i = 0; i < PROXIES.length; i++) {
    try {
      const response = await axios.get(PROXIES[i](url), { timeout: 3000 });
      let list = response.data?.result?.list || response.data?.list;
      if (!list && typeof response.data === 'string') {
          try { list = JSON.parse(response.data)?.result?.list; } catch(e) {}
      }
      if (list) return list;
    } catch (e) { }
  }
  return [];
};

const VwapSparkline = ({ klines, vwapMax, vwapMin }) => {
  if (!klines || klines.length === 0) return null;
  const width = 150;
  const height = 40;
  
  const prices = klines.map(k => parseFloat(k.close));
  const minPrice = Math.min(...prices, vwapMin);
  const maxPrice = Math.max(...prices, vwapMax);
  const range = maxPrice - minPrice || 1;

  const getY = (val) => height - ((val - minPrice) / range) * height;
  const getX = (idx) => (idx / (klines.length - 1)) * width;

  const points = prices.map((p, i) => `${getX(i)},${getY(p)}`).join(' ');
  const yMax = getY(vwapMax);
  const yMin = getY(vwapMin);

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* VWAP Max Line */}
      <line x1={0} y1={yMax} x2={width} y2={yMax} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" opacity="0.8" />
      {/* VWAP Min Line */}
      <line x1={0} y1={yMin} x2={width} y2={yMin} stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" opacity="0.8" />
      {/* Price Line */}
      <polyline points={points} fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.9" />
      
      {/* Highlight Compression Zone Background */}
      <rect x={0} y={Math.min(yMax, yMin)} width={width} height={Math.abs(yMin - yMax)} fill="rgba(255, 255, 255, 0.05)" />
    </svg>
  );
};

const ExpandedChartModal = ({ data, onClose }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const maxLineRef = useRef(null);
  const minLineRef = useRef(null);
  const [timeframe, setTimeframe] = useState('60');
  const [loading, setLoading] = useState(false);

  const tfs = [
    { label: '15m', value: '15' },
    { label: '1H', value: '60' },
    { label: '4H', value: '240' },
    { label: '1D', value: 'D' }
  ];

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,0.1)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' }
    });
    
    chartRef.current = chart;
    const series = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderVisible: false,
      wickUpColor: '#10b981', wickDownColor: '#ef4444'
    });
    seriesRef.current = series;

    // Add LineSeries for Max and Min to draw segments instead of infinite lines
    if (data.vwapMax) {
      maxLineRef.current = chart.addLineSeries({
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        crosshairMarkerVisible: false,
        lastValueVisible: true,
        priceLineVisible: false,
        title: 'RESISTANCE'
      });
    }
    if (data.vwapMin) {
      minLineRef.current = chart.addLineSeries({
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 2,
        crosshairMarkerVisible: false,
        lastValueVisible: true,
        priceLineVisible: false,
        title: 'SUPPORT'
      });
    }

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${data.symbol}USDT&interval=${timeframe}&limit=1000`;
      
      let klinesRaw = [];
      try {
        const res = await axios.get(url, { timeout: 3000 });
        klinesRaw = res.data?.result?.list || [];
      } catch (err) {}
      
      if (klinesRaw && klinesRaw.length > 0) {
        const formatted = [...klinesRaw].reverse().map(k => ({
          time: Number(k[0]) / 1000,
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4])
        }));
        if (seriesRef.current) {
          seriesRef.current.setData(formatted);
          if (chartRef.current) chartRef.current.timeScale().fitContent();
        }
        
        // Draw resistance and support lines starting from the compression day
        if (formatted.length > 0) {
          const lastTime = formatted[formatted.length - 1].time;
          // Compression started `compressionCount` days ago (approx)
          const startTime = lastTime - (data.compressionCount * 86400);
          
          if (maxLineRef.current && data.vwapMax) {
            const maxData = formatted.filter(k => k.time >= startTime).map(k => ({ time: k.time, value: data.vwapMax }));
            maxLineRef.current.setData(maxData);
          }
          if (minLineRef.current && data.vwapMin) {
            const minData = formatted.filter(k => k.time >= startTime).map(k => ({ time: k.time, value: data.vwapMin }));
            minLineRef.current.setData(minData);
          }
        }
      }
      setLoading(false);
    };
    loadData();
  }, [data.symbol, timeframe]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0f172a', width: '90%', maxWidth: '1000px', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h2 style={{ margin: 0, color: '#fff' }}>{data.symbol} / USDT</h2>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px' }}>
              {tfs.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  style={{
                    background: timeframe === tf.value ? '#f59e0b' : 'transparent',
                    color: timeframe === tf.value ? '#000' : '#94a3b8',
                    border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            {loading && <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>Chargement...</span>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
        </div>
        <div style={{ padding: '20px' }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
        </div>
      </div>
    </div>
  );
};

const VwapCompressionScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const [selectedTokenData, setSelectedTokenData] = useState(null);

  const startScan = async () => {
    setScanning(true);
    setResults([]);
    setProgress(0);

    try {
      const symbols = await fetchTop500Symbols(false, 500); // Top 500 volume
      let validTokens = symbols.filter(t => !t.symbol.includes('USDC') && !t.symbol.includes('EUR'));
      
      const chunkedResults = [];
      
      for (let i = 0; i < validTokens.length; i += 20) {
        const batch = validTokens.slice(i, i + 20);
        
        await Promise.all(batch.map(async (token) => {
          const klinesRaw = await fetchKlines(token.symbol);
          if (klinesRaw && klinesRaw.length > 0) {
            // Reverse so [0] is oldest, [last] is newest
            const chronKlines = [...klinesRaw].reverse().map(k => ({
              time: Number(k[0]),
              open: Number(k[1]),
              high: Number(k[2]),
              low: Number(k[3]),
              close: Number(k[4]),
              volume: Number(k[5]),
              turnover: Number(k[6])
            }));

            // Group by Day
            const dailyData = {};
            let vwapSum = 0;
            let volSum = 0;
            let lastDayStr = '';

            for (let j = 0; j < chronKlines.length; j++) {
              const k = chronKlines[j];
              const date = new Date(k.time);
              const dayStr = date.toISOString().split('T')[0]; // "YYYY-MM-DD"

              // Reset daily at 00:00 UTC
              if (dayStr !== lastDayStr) {
                vwapSum = 0;
                volSum = 0;
                lastDayStr = dayStr;
                if (!dailyData[dayStr]) {
                  dailyData[dayStr] = { high: -Infinity, low: Infinity, vwap: 0 };
                }
              }

              const typicalPrice = (k.high + k.low + k.close) / 3;
              vwapSum += typicalPrice * k.volume;
              volSum += k.volume;
              
              const vwap = volSum > 0 ? (vwapSum / volSum) : k.close;
              
              // On traque le VRAI plus haut et plus bas du prix de la journée (les mèches)
              dailyData[dayStr].high = Math.max(dailyData[dayStr].high, k.high);
              dailyData[dayStr].low = Math.min(dailyData[dayStr].low, k.low);
              dailyData[dayStr].vwap = vwap; // Garder le dernier vwap de la journée
            }
            
            // Compare days backwards
            const days = Object.keys(dailyData).sort((a,b) => b.localeCompare(a)); // Newest first
            if (days.length > 2) {
              // On prend la journée d'hier comme référence (Car la journée d'aujourd'hui n'est pas finie et n'a pas atteint ses pleines mèches)
              const targetMax = dailyData[days[1]].high;
              const targetMin = dailyData[days[1]].low;
              
              const currentPrice = chronKlines[chronKlines.length - 1].close;
              
              // Tolérance élargie pour autoriser les mèches (2.5%)
              const tolerance = 0.025; 
              
              // Annuler les tokens qui ont un breakout majeur aujourd'hui
              if (currentPrice > targetMax * (1 + tolerance) || currentPrice < targetMin * (1 - tolerance)) {
                return; // Ce token a cassé sa résistance/support aujourd'hui, on l'ignore
              }
              
              let matchCount = 0; 
              let maxDiff = 0;

              // Start from 2 days ago (days[2]) and go back, comparing to Yesterday (days[1])
              for (let d = 2; d < days.length; d++) {
                const dayMax = dailyData[days[d]].high;
                const dayMin = dailyData[days[d]].low;
                
                const diffMax = Math.abs(dayMax - targetMax) / targetMax;
                const diffMin = Math.abs(dayMin - targetMin) / targetMin;
                
                if (diffMax <= tolerance && diffMin <= tolerance) {
                  matchCount++;
                  maxDiff = Math.max(maxDiff, diffMax, diffMin);
                } else {
                  break; // Chain broken
                }
              }

              // Only consider if at least Yesterday + Day Before matched (matchCount >= 1)
              if (matchCount >= 1 && targetMax > 0 && targetMin !== Infinity) {
                const gapPct = ((targetMax - targetMin) / targetMin) * 100;
                
                // Only take tokens where the range is meaningful (e.g. > 1%)
                if (gapPct > 1.0) {
                  chunkedResults.push({
                    symbol: token.symbol.replace('USDT', ''),
                    compressionCount: matchCount + 1, // Yesterday + matched days
                    durationStr: (matchCount + 1) + ' jours',
                    vwapMax: targetMax, // It's actually Price Resistance now
                    vwapMin: targetMin, // It's actually Price Support now
                    gapPct,
                    maxDiff, // the largest difference seen during these days
                    klines: chronKlines.slice(-Math.max(60, (matchCount + 2) * 24)), // Context
                    price: currentPrice
                  });
                }
              }
            }
          }
        }));

        setProgress(Math.floor((i / validTokens.length) * 100));
        
        // Update UI progressively
        // Sort by minimal tolerance first (maxDiff ASC), then by duration (compressionCount DESC)
        const sorted = [...chunkedResults].sort((a, b) => {
          if (a.maxDiff !== b.maxDiff) return a.maxDiff - b.maxDiff;
          return b.compressionCount - a.compressionCount;
        });
        setResults(sorted);

        await new Promise(r => setTimeout(r, 200));
      }
      
    } catch (e) {
      console.error(e);
    }
    setScanning(false);
    setProgress(100);
  };

  return (
    <div style={{ padding: '20px', color: '#fff', minHeight: '100vh', background: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Minimize2 size={28} color="#f59e0b" /> COMPRESSION RANGE (HIGH/LOW)
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Détecte les tokens dont les mèches tapent exactement la même résistance et le même support sur plusieurs jours consécutifs.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={startScan}
            disabled={scanning}
            style={{
              background: '#f59e0b', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', 
              fontWeight: 'bold', cursor: scanning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              opacity: scanning ? 0.7 : 1, transition: 'all 0.2s'
            }}
          >
            <Activity size={16} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
            {scanning ? `SCANNING ${progress}%` : 'START COMPRESSION SCAN'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: 'rgba(25, 30, 40, 0.6)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)', overflow: 'hidden' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '15px 20px', borderBottom: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap color="#f59e0b" size={20} />
            <h2 style={{ margin: 0, color: '#f59e0b', fontSize: '1.2rem', fontWeight: 'bold' }}>
              ZONES DE COMPRESSION (En Cours)
            </h2>
          </div>
          
          <div style={{ padding: '0 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#cbd5e1' }}>
              <thead>
                <tr>
                  <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem' }}>ASSET</th>
                  <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>TEMPS COMPRESSÉ</th>
                  <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>VWAP GAP %</th>
                  <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'right' }}>PRICE VS VWAP BANDS</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 && !scanning ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      Aucune compression détectée. Lancez le scan.
                    </td>
                  </tr>
                ) : (
                  results.map((item, idx) => (
                    <tr 
                      key={item.symbol} 
                      onClick={() => setSelectedTokenData(item)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '15px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#fff' }}>
                        <span style={{ color: '#64748b', fontSize: '0.8rem', width: '20px' }}>{idx + 1}.</span>
                        {item.symbol}
                      </td>
                      <td style={{ padding: '15px 0', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: '20px', color: '#f59e0b', fontWeight: 'bold' }}>
                          <Clock size={14} /> {item.durationStr}
                        </div>
                      </td>
                      <td style={{ padding: '15px 0', textAlign: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
                        {item.gapPct.toFixed(2)}%
                      </td>
                      <td style={{ padding: '15px 0', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <VwapSparkline klines={item.klines} vwapMax={item.vwapMax} vwapMin={item.vwapMin} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {selectedTokenData && (
        <ExpandedChartModal data={selectedTokenData} onClose={() => setSelectedTokenData(null)} />
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default VwapCompressionScanner;
