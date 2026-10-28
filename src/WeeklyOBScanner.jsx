import React, { useState, useEffect, useRef } from 'react';
import { Activity, Target, Layers, Crosshair } from 'lucide-react';
import { createChart } from 'lightweight-charts';
import { fetchTop500Symbols, fetchBybitData } from './logic/scanner';
import { calculateWeeklyOBs } from './logic/weeklyOBLogic';

const TokenOBChartCard = ({ token, obData, tfLabel }) => {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !obData || !obData.parsedKlines) return;

    if (!chartInstance.current) {
      const chart = createChart(chartContainerRef.current, {
        height: 280,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
        timeScale: { timeVisible: false, borderVisible: false },
        rightPriceScale: { borderVisible: false }
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });

      chartInstance.current = { chart, candleSeries, lines: [] };
    }

    const { chart, candleSeries, lines } = chartInstance.current;
    
    // Clear previous OB lines
    lines.forEach(s => chart.removeSeries(s));
    lines.length = 0;

    // Load Candles
    const data = obData.parsedKlines.map(k => ({
      time: k.time / 1000,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close
    }));
    candleSeries.setData(data);

    // Draw OBs
    const activeOBs = obData.activeOBs;
    const latestTime = data[data.length - 1].time;

    for (const ob of activeOBs) {
      const color = ob.type === 'BULLISH' ? '#10b981' : '#ef4444'; // Green or Red
      
      const topSeries = chart.addLineSeries({ color, lineWidth: 2, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
      const bottomSeries = chart.addLineSeries({ color, lineWidth: 2, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
      
      // Filter klines that are >= ob.startTime to draw the lines
      const lineData = data.filter(d => d.time >= ob.startTime / 1000);
      
      topSeries.setData(lineData.map(d => ({ time: d.time, value: ob.top })));
      bottomSeries.setData(lineData.map(d => ({ time: d.time, value: ob.bottom })));
      
      lines.push(topSeries, bottomSeries);
    }

    chart.timeScale().fitContent();

  }, [token, obData]);

  // Find nearest OB gap
  let minGap = Infinity;
  let nearestType = '';
  
  if (obData.activeOBs.length > 0) {
    const cp = token.currentPrice;
    obData.activeOBs.forEach(ob => {
      // Distance to the closest boundary of the OB
      const distTop = Math.abs((cp - ob.top) / ob.top * 100);
      const distBottom = Math.abs((cp - ob.bottom) / ob.bottom * 100);
      const minDist = Math.min(distTop, distBottom);
      if (minDist < minGap) {
        minGap = minDist;
        nearestType = ob.type;
      }
    });
  }

  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: `1px solid ${nearestType === 'BULLISH' ? '#10b981' : '#ef4444'}`, borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${token.symbol === 'BTCUSDT' ? '1' : token.symbol === 'ETHUSDT' ? '1027' : '825'}.png`} 
               alt="icon" style={{ width: '24px', height: '24px', borderRadius: '50%' }} 
               onError={(e) => e.target.style.display = 'none'} />
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{token.symbol.replace('USDT', '')}</h3>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: nearestType === 'BULLISH' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '1.1rem' }}>
            {nearestType === 'BULLISH' ? `BULL OB ${tfLabel}` : `BEAR OB ${tfLabel}`}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>À {minGap.toFixed(2)}% de la zone</div>
        </div>
      </div>
      
      <div style={{ padding: '1rem' }}>
        <div ref={chartContainerRef} style={{ width: '100%', height: '280px' }} />
      </div>
    </div>
  );
};

export const WeeklyOBScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [scanLimit, setScanLimit] = useState(100);
  const [selectedTF, setSelectedTF] = useState('W');
  const [disableFilter, setDisableFilter] = useState(false);

  const tfLabels = {
    'W': '1W',
    'D': '1D',
    '240': '4H',
    '60': '1H',
    '15': '15M'
  };

  const scanTokens = async () => {
    setScanning(true);
    setResults([]);
    setProgress(0);

    try {
      const topSymbols = await fetchTop500Symbols();
      const targets = topSymbols.slice(0, scanLimit).map(t => t.symbol);
      const batchSize = 10;
      const allResults = [];

      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        
        const promises = batch.map(async (symbol) => {
          try {
            // Fetch 500 klines for the selected timeframe
            const klines = await fetchBybitData(symbol, selectedTF, 500); 
            if (!klines || klines.length < 50) return null; // Need enough history for Swings

            const obData = calculateWeeklyOBs(klines);
            
            if (obData.activeOBs.length === 0) return null;

            const currentPrice = obData.parsedKlines[obData.parsedKlines.length - 1].close;
            
            // Check proximity: Is price within 5% of any active OB?
            let isClose = false;
            let closestGap = Infinity;

            for (const ob of obData.activeOBs) {
              // Distance to the zone (0 if inside the zone)
              let gap = 0;
              if (currentPrice > ob.top) {
                gap = ((currentPrice - ob.top) / ob.top) * 100;
              } else if (currentPrice < ob.bottom) {
                gap = ((ob.bottom - currentPrice) / currentPrice) * 100;
              }

              if (gap <= 5 || disableFilter) {
                isClose = true;
              }
              if (gap < closestGap) closestGap = gap;
            }

            if (isClose) {
              return {
                symbol,
                currentPrice,
                obData,
                closestGap
              };
            }
          } catch (e) {
            console.warn("Error scanning", symbol, e);
          }
          return null;
        });

        const batchResults = await Promise.all(promises);
        allResults.push(...batchResults.filter(r => r !== null));
        
        setProgress(Math.floor(((i + batchSize) / targets.length) * 100));
      }

      // Sort by closest to OB zone
      allResults.sort((a, b) => a.closestGap - b.closestGap);
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
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', margin: 0, background: 'linear-gradient(90deg, #10b981, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
          <Layers size={40} color="#10b981" /> ORDER BLOCKS SCANNER
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginTop: '10px' }}>
          Détection pure des zones OB basées sur la structure de marché (Swing High/Low confirmés).
        </p>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '24px', padding: '2rem', marginBottom: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', backdropFilter: 'blur(10px)' }}>
        
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '12px' }}>
            {['W', 'D', '240', '60', '15'].map(tf => (
              <button
                key={tf}
                onClick={() => setSelectedTF(tf)}
                style={{
                  background: selectedTF === tf ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  border: `1px solid ${selectedTF === tf ? '#10b981' : 'transparent'}`,
                  color: selectedTF === tf ? '#10b981' : '#94a3b8',
                  padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                {tfLabels[tf]}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '12px' }}>
            {[100, 200, 300].map(limit => (
              <button
                key={limit}
                onClick={() => setScanLimit(limit)}
                style={{
                  background: scanLimit === limit ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  border: `1px solid ${scanLimit === limit ? '#10b981' : 'transparent'}`,
                  color: scanLimit === limit ? '#10b981' : '#94a3b8',
                  padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                TOP {limit}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '12px' }}>
            <button
              onClick={() => setDisableFilter(!disableFilter)}
              style={{
                background: disableFilter ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                border: `1px solid ${disableFilter ? '#ef4444' : '#10b981'}`,
                color: disableFilter ? '#ef4444' : '#10b981',
                padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              {disableFilter ? 'FILTRE: DÉSACTIVÉ (TOUS)' : 'FILTRE: <= 5%'}
            </button>
          </div>
        </div>
        
        <button 
          onClick={scanTokens} 
          disabled={scanning}
          style={{
            background: scanning ? '#334155' : 'linear-gradient(45deg, #10b981, #3a7bd5)',
            border: 'none', color: '#fff', padding: '15px 40px', borderRadius: '30px',
            fontSize: '1.2rem', fontWeight: 'bold', cursor: scanning ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '10px', boxShadow: scanning ? 'none' : '0 10px 25px rgba(16, 185, 129, 0.4)', transition: 'all 0.3s'
          }}
        >
          {scanning ? <Activity className="spin" size={24} /> : <Target size={24} />}
          {scanning ? `RECHERCHE DES OB (${progress}%)` : `LANCER LE SCAN OB ${tfLabels[selectedTF]}`}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
          {results.map((r, i) => (
            <TokenOBChartCard key={i} token={r} obData={r.obData} tfLabel={tfLabels[selectedTF]} />
          ))}
        </div>
      )}

      {results.length === 0 && !scanning && progress === 100 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '2rem' }}>
          Aucun token ne s'approche actuellement d'un OB {tfLabels[selectedTF]}.
        </div>
      )}
    </div>
  );
};

export default WeeklyOBScanner;
