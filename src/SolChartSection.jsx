import React, { useState, useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { fetchBybitData, fetchMaxHistory } from './logic/scanner';
import { calculateSMC } from './logic/smc';
import { Activity, Target } from 'lucide-react';

const TIMEFRAMES = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: 'M' }
];

const SolChartSection = () => {
  const chartContainerRef = useRef(null);
  const [chart, setChart] = useState(null);
  const [candleSeries, setCandleSeries] = useState(null);
  
  // SMC MTF 
  const [showSmcObs, setShowSmcObs] = useState(false);
  const smcLinesRef = useRef([]);
  
  const [activeTimeframe, setActiveTimeframe] = useState('60'); 
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [formattedCandlesData, setFormattedCandlesData] = useState([]);

  // --- SMC MTF Logic ---
  useEffect(() => {
    if (!candleSeries || !showSmcObs) {
      if (smcLinesRef.current.length > 0 && candleSeries) {
        smcLinesRef.current.forEach(line => candleSeries.removePriceLine(line));
        smcLinesRef.current = [];
      }
      return;
    }

      const drawSmcLines = async () => {
        if (!chart) return;
        if (smcLinesRef.current.length > 0) {
          smcLinesRef.current.forEach(series => {
            try { chart.removeSeries(series); } catch(e){}
          });
          smcLinesRef.current = [];
        }

        const bybitTfs = ['1', '5', '15', '60', '240', 'D', 'W', 'M'];
        const tfLabels = { '1': '1m', '5': '5m', '15': '15m', '60': '1H', '240': '4H', 'D': '1D', 'W': '1W', 'M': '1M' };
        
        const activeIdx = bybitTfs.indexOf(activeTimeframe);
        const tfsToDraw = bybitTfs.slice(activeIdx);
        
        const lines = [];

        for (const tf of tfsToDraw) {
          try {
            const klines = await fetchMaxHistory('SOLUSDT', tf);
            if (!klines || klines.length === 0) continue;
            
            const chronKlines = [...klines].reverse();
            const smcData = calculateSMC(chronKlines);
            if (!smcData) continue;
            
            const chartEndTime = formattedCandlesData[formattedCandlesData.length - 1].time;
            
            if (smcData.activeBullOBs) {
              smcData.activeBullOBs.forEach(ob => {
                const obTime = ob.time / 1000;
                if (obTime >= chartEndTime) return;
                
                const topSeries = chart.addBaselineSeries({
                  baseValue: { type: 'price', price: ob.bot },
                  topFillColor1: 'rgba(16, 185, 129, 0.25)',
                  topFillColor2: 'rgba(16, 185, 129, 0.25)',
                  topLineColor: 'rgba(16, 185, 129, 0.9)',
                  bottomFillColor1: 'transparent',
                  bottomFillColor2: 'transparent',
                  bottomLineColor: 'transparent',
                  baseLineVisible: false,
                  lineWidth: 1,
                  lineStyle: 0, 
                  lastValueVisible: true,
                  priceLineVisible: false,
                  title: `${tfLabels[tf]} OB`,
                });
                
                const seriesData = formattedCandlesData
                  .filter(c => c.time >= obTime)
                  .map(c => ({ time: c.time, value: ob.top }));
                
                if (seriesData.length > 0 && seriesData[0].time > obTime) {
                  seriesData.unshift({ time: obTime, value: ob.top });
                }
                if (seriesData.length === 0) {
                  seriesData.push({ time: obTime, value: ob.top }, { time: chartEndTime, value: ob.top });
                }
                if (seriesData[seriesData.length - 1].time < chartEndTime) {
                  seriesData.push({ time: chartEndTime, value: ob.top });
                }

                topSeries.setData(seriesData);
                
                const botSeriesData = seriesData.map(d => ({ time: d.time, value: ob.bot }));
                
                const botSeries = chart.addLineSeries({
                  color: 'rgba(16, 185, 129, 0.4)',
                  lineWidth: 1,
                  lineStyle: 2, 
                  lastValueVisible: false,
                  priceLineVisible: false,
                });
                botSeries.setData(botSeriesData);
                
                lines.push(topSeries, botSeries);
              });
            }

            if (smcData.activeBearOBs) {
              smcData.activeBearOBs.forEach(ob => {
                const obTime = ob.time / 1000;
                if (obTime >= chartEndTime) return;
                
                const seriesData = formattedCandlesData
                  .filter(c => c.time >= obTime)
                  .map(c => ({ time: c.time, value: ob.bot }));
                  
                if (seriesData.length > 0 && seriesData[0].time > obTime) {
                  seriesData.unshift({ time: obTime, value: ob.bot });
                }
                if (seriesData.length === 0) {
                  seriesData.push({ time: obTime, value: ob.bot }, { time: chartEndTime, value: ob.bot });
                }
                if (seriesData[seriesData.length - 1].time < chartEndTime) {
                  seriesData.push({ time: chartEndTime, value: ob.bot });
                }

                const botSeries = chart.addLineSeries({
                  color: 'rgba(239, 68, 68, 0.9)',
                  lineWidth: 1,
                  lineStyle: 0, 
                  lastValueVisible: true,
                  priceLineVisible: false,
                  title: `${tfLabels[tf]} OB`,
                });
                botSeries.setData(seriesData);
                
                const topSeries = chart.addBaselineSeries({
                  baseValue: { type: 'price', price: ob.bot },
                  topFillColor1: 'rgba(239, 68, 68, 0.25)',
                  topFillColor2: 'rgba(239, 68, 68, 0.25)',
                  topLineColor: 'rgba(239, 68, 68, 0.4)',
                  bottomFillColor1: 'transparent',
                  bottomFillColor2: 'transparent',
                  bottomLineColor: 'transparent',
                  baseLineVisible: false,
                  lineWidth: 1,
                  lineStyle: 2, 
                  lastValueVisible: false,
                  priceLineVisible: false,
                });
                
                const topSeriesData = seriesData.map(d => ({ time: d.time, value: ob.top }));
                topSeries.setData(topSeriesData);
                
                lines.push(topSeries, botSeries);
              });
            }
          } catch (e) {
            console.error(`Failed to fetch SMC for ${tf}`, e);
          }
        }
        smcLinesRef.current = lines;
      };

    drawSmcLines();

    return () => {
      if (chart && smcLinesRef.current.length > 0) {
        smcLinesRef.current.forEach(series => {
          try { chart.removeSeries(series); } catch(e){}
        });
        smcLinesRef.current = [];
      }
    };
  }, [showSmcObs, candleSeries, activeTimeframe, formattedCandlesData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const newChart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#334155', // slate-700
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.06)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.06)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 600,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 0, 0, 0.1)',
      },
    });
    
    const newCandleSeries = newChart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    setChart(newChart);
    setCandleSeries(newCandleSeries);

    const handleResize = () => {
      newChart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      newChart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeries) return;

    let isMounted = true;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        const klines = await fetchMaxHistory('SOLUSDT', activeTimeframe, 3000);
        if (!isMounted) return;

        if (klines && klines.length > 0) {
          const chronKlines = [...klines].reverse();
          const formattedCandles = chronKlines.map(k => ({
            time: parseInt(k[0]) / 1000,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4])
          }));
          
          candleSeries.setData(formattedCandles);
          setCurrentPrice(formattedCandles[formattedCandles.length - 1].close);
          setFormattedCandlesData(formattedCandles);
        }
      } catch (error) {
        console.error("Error fetching SOL data:", error);
      }
      setIsLoading(false);
    };

    loadData();

    // Set up a polling interval for live updates (every 3 seconds)
    const intervalId = setInterval(async () => {
      if (!isMounted) return;
      try {
        const liveKlines = await fetchBybitData('SOLUSDT', activeTimeframe, 2, null);
        if (liveKlines && liveKlines.length > 0) {
          const k = liveKlines[0]; // Most recent candle
          const currentCandle = {
            time: parseInt(k[0]) / 1000,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4])
          };
          candleSeries.update(currentCandle);
          setCurrentPrice(currentCandle.close);
          
          // Also update the formatted data state so SMC can recalculate if needed
          setFormattedCandlesData(prev => {
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            if (lastIdx >= 0 && copy[lastIdx].time === currentCandle.time) {
              copy[lastIdx] = currentCandle;
            } else if (lastIdx >= 0 && currentCandle.time > copy[lastIdx].time) {
              copy.push(currentCandle);
            }
            return copy;
          });
        }
      } catch (e) {
        // Silently fail on live update errors to not spam console
      }
    }, 3000);

    return () => { 
      isMounted = false; 
      clearInterval(intervalId);
    };
  }, [activeTimeframe, candleSeries]);

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#00f0ff', margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={24} /> SOLANA CHART
          {currentPrice && (
            <span style={{ fontSize: '1.2rem', color: '#f8fafc', marginLeft: '1rem', background: '#0a1a21', padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              ${currentPrice.toFixed(2)}
            </span>
          )}
        </h2>

        <div style={{ display: 'flex', gap: '8px', background: '#0a1a21', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setActiveTimeframe(tf.value)}
              style={{
                background: activeTimeframe === tf.value ? '#00f0ff' : 'transparent',
                color: activeTimeframe === tf.value ? '#000' : '#64748b',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', marginLeft: '12px' }}>
            <button 
              onClick={() => setShowSmcObs(!showSmcObs)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: showSmcObs ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: showSmcObs ? '#10b981' : '#64748b',
                border: 'none',
                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s'
              }}
            >
              <Target size={14} /> SMC MTF OBs
            </button>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', background: '#051016', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        {isLoading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, color: '#00f0ff', fontWeight: 'bold', letterSpacing: '2px' }}>
            CHARGEMENT DES DONNÉES...
          </div>
        )}

        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default SolChartSection;
