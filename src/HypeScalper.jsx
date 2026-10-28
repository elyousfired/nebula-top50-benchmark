import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchTop200Symbols, fetchBybitData, fetchOpenInterest } from './logic/scanner';
import { getTokenInfo } from './tokenDatabase';
import { createChart } from 'lightweight-charts';

const InflationProjectionChart = ({ currentPrice }) => {
  const chartContainerRef = useRef();
  
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      crosshair: { mode: 0 },
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.3 } },
      timeScale: { borderColor: '#e2e8f0' }
    });

    const priceSeries = chart.addLineSeries({
      color: '#ef4444', lineWidth: 2, title: 'Projected Price ($)',
    });

    chart.priceScale('left').applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 }, visible: true
    });

    const supplySeries = chart.addAreaSeries({
      topColor: 'rgba(56, 189, 248, 0.4)', bottomColor: 'rgba(56, 189, 248, 0.05)',
      lineColor: '#38bdf8', lineWidth: 2, priceScaleId: 'left', title: 'Circ. Supply (B)',
    });

    const baseSupply = 0.31; // 310M
    const unlockAmount = 0.05; // 50M
    let marketCap = currentPrice > 0 ? currentPrice * baseSupply : 0.0279 * baseSupply;

    const priceData = [];
    const supplyData = [];
    const markers = [];
    const now = new Date();

    for (let i = 0; i <= 365; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const timeStr = d.toISOString().split('T')[0];
      
      let supply = baseSupply;
      if (i >= 90) supply += unlockAmount;
      if (i >= 180) supply += unlockAmount;
      if (i >= 270) supply += unlockAmount;
      if (i >= 360) supply += unlockAmount;

      const projectedPrice = marketCap / supply;
      priceData.push({ time: timeStr, value: projectedPrice });
      supplyData.push({ time: timeStr, value: supply });

      if (i === 0) {
        markers.push({ time: timeStr, position: 'aboveBar', color: '#3b82f6', shape: 'circle', text: `Aujourd'hui: ${projectedPrice.toFixed(4)}$` });
      } else if (i === 90 || i === 180 || i === 270 || i === 360) {
        markers.push({ time: timeStr, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: `Unlock (+50M)\nPrix chute: ${projectedPrice.toFixed(4)}$` });
      }
    }

    priceSeries.setData(priceData);
    priceSeries.setMarkers(markers);
    supplySeries.setData(supplyData);
    chart.timeScale().fitContent();

    const resize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    window.addEventListener('resize', resize);
    
    return () => { window.removeEventListener('resize', resize); chart.remove(); };
  }, [currentPrice]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />;
};

// --- CSS STYLES FOR THEME ---
const themeStyles = `
  .analytics-dashboard {
    padding: 2rem;
    font-family: 'Inter', sans-serif;
    color: #2a3a5a;
    min-height: 100vh;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }
  .dash-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1.5rem;
    max-width: 1600px;
    margin: 0 auto;
  }
  .dash-card {
    background: #ffffff;
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .card-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #64748b;
    font-weight: 800;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .card-value {
    font-size: 2rem;
    font-weight: 900;
    color: #0f172a;
    margin: 0;
  }
  .progress-bg {
    width: 100%;
    height: 8px;
    background: #f1f5f9;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 8px;
  }
  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 1s ease-in-out;
  }
  .eco-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .token-row {
    display: grid;
    grid-template-columns: 2fr 2fr 1fr;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #f1f5f9;
    transition: all 0.2s;
    cursor: pointer;
  }
  .token-row:hover {
    background: #f8fafc;
    transform: translateX(5px);
  }
  .token-row:last-child {
    border-bottom: none;
  }
  .scroller::-webkit-scrollbar {
    width: 6px;
  }
  .scroller::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 4px;
  }
  .tf-btn {
    background: #f1f5f9;
    border: none;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 800;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
  }
  .tf-btn.active {
    background: #6a0dad;
    color: #fff;
    box-shadow: 0 2px 10px rgba(106, 13, 173, 0.3);
  }
  .eco-select {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 0.75rem;
    font-weight: 700;
    color: #334155;
    outline: none;
    cursor: pointer;
  }
`;
const styleEl = document.createElement('style');
styleEl.innerText = themeStyles;
document.head.appendChild(styleEl);

const formatMoney = (val) => {
  const abs = Math.abs(val);
  if (abs >= 1e9) return (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (abs / 1e3).toFixed(2) + 'K';
  return abs.toFixed(2);
};


// --- MAGNET CHART COMPONENT (WHALE MEMORY) ---
const MagnetChart = ({ symbol, timeframe }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const predictionSeriesRef = useRef(null);
  const activeLinesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [showPrediction, setShowPrediction] = useState(false);
  const [predictionData, setPredictionData] = useState(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#f1f5f9', style: 1 }, horzLines: { color: '#f1f5f9', style: 1 } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, rightOffset: 20 }, // Extra space for prediction
      crosshair: { mode: 1 },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chartRef.current.addCandlestickSeries({
      upColor: '#00e676',
      downColor: '#ff3b30',
      borderVisible: false,
      wickUpColor: '#00e676',
      wickDownColor: '#ff3b30',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 }
    });

    predictionSeriesRef.current = chartRef.current.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      lineStyle: 1, // Dotted
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const loadData = async () => {
      // Show loading only on first load, not during background polling
      if (!chartRef.current?.candleSeries) {
         setLoading(true);
      }
      
      // Fetch both the chart timeframe klines and 1-hour klines concurrently
      const [data, hourlyKlines] = await Promise.all([
        fetchBybitData(symbol, timeframe, 300),
        fetchBybitData(symbol, '60', 100)
      ]);

      if (data && data.length > 0) {
        const sorted = [...data].reverse(); 
        const candleData = [];
        const flowList = [];

        sorted.forEach(k => {
          const time = Math.floor(Number(k[0]) / 1000);
          const open = Number(k[1]);
          const high = Number(k[2]);
          const low = Number(k[3]);
          const close = Number(k[4]);
          const turnover = Number(k[6]);
          
          let flow = 0;
          if (open > 0) {
            flow = turnover * ((close - open) / open);
          }

          candleData.push({ time, open, high, low, close });
          flowList.push({ time, flow, close });
        });

        candleSeries.setData(candleData);

        // Whale Tracker Algorithm (Top 3 Inflow / Outflow)
        const sortedByInflow = [...flowList].filter(f => f.flow > 0).sort((a, b) => b.flow - a.flow).slice(0, 3);
        const sortedByOutflow = [...flowList].filter(f => f.flow < 0).sort((a, b) => a.flow - b.flow).slice(0, 3);

        const buyWalls = [];
        const sellWalls = [];

        // Clear previous price lines (prevents memory leak and duplicated rendering)
        activeLinesRef.current.forEach(line => {
          try {
            candleSeries.removePriceLine(line);
          } catch (e) {}
        });
        activeLinesRef.current = [];

        sortedByInflow.forEach(whale => {
           buyWalls.push(whale.close);
           const line = candleSeries.createPriceLine({
              price: whale.close,
              color: '#00e676',
              lineWidth: 2,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `WHALE BUY WALL (+$${formatMoney(whale.flow)})`,
           });
           activeLinesRef.current.push(line);
        });

        sortedByOutflow.forEach(whale => {
           sellWalls.push(whale.close);
           const line = candleSeries.createPriceLine({
              price: whale.close,
              color: '#ff3b30',
              lineWidth: 2,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `WHALE SELL WALL (-$${formatMoney(Math.abs(whale.flow))})`,
           });
           activeLinesRef.current.push(line);
        });

        // CALCULATE PREVIOUS DAY VWAP MAX & MIN FROM HOURLY DATA
        if (hourlyKlines && hourlyKlines.length > 0) {
          const sortedHourly = [...hourlyKlines].reverse();
          const processedHourly = [];
          let currentDay = null;
          let currentVwapSum = 0;
          let currentVolumeSum = 0;

          for (const k of sortedHourly) {
            const date = new Date(Number(k[0]));
            const dayStr = date.toISOString().split('T')[0];
            const close = Number(k[4]);
            const volume = Number(k[5]);

            if (currentDay !== dayStr) {
              currentDay = dayStr;
              currentVwapSum = 0;
              currentVolumeSum = 0;
            }

            currentVwapSum += (close * volume);
            currentVolumeSum += volume;
            processedHourly.push({ 
              vwapDaily: currentVolumeSum > 0 ? (currentVwapSum / currentVolumeSum) : close, 
              date: dayStr 
            });
          }

          const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          let yesterdayMaxVwap = 0, yesterdayMinVwap = Infinity;
          let hasYesterday = false;

          for (const p of processedHourly) {
            if (p.date === yesterdayStr) {
              yesterdayMaxVwap = Math.max(yesterdayMaxVwap, p.vwapDaily);
              yesterdayMinVwap = Math.min(yesterdayMinVwap, p.vwapDaily);
              hasYesterday = true;
            }
          }

          let yesterdayVwap = { max: 0, min: 0 };
          if (hasYesterday && yesterdayMaxVwap > 0 && yesterdayMinVwap !== Infinity) {
            yesterdayVwap = { max: yesterdayMaxVwap, min: yesterdayMinVwap };
          } else {
            // Safe fallback: take overall max/min vwap from history
            const vwaps = processedHourly.map(p => p.vwapDaily);
            yesterdayVwap = { max: Math.max(...vwaps), min: Math.min(...vwaps) };
          }

          // Render PDH VWAP (MAX) - Cyan dashed line
          if (yesterdayVwap.max > 0) {
             const lineMax = candleSeries.createPriceLine({
                price: yesterdayVwap.max,
                color: '#00d0ff',
                lineWidth: 2,
                lineStyle: 1, // Dashed
                axisLabelVisible: true,
                title: 'PDH VWAP (MAX)',
             });
             activeLinesRef.current.push(lineMax);
          }

          // Render PDL VWAP (MIN) - Beautiful Pink dashed line
          if (yesterdayVwap.min > 0) {
             const lineMin = candleSeries.createPriceLine({
                price: yesterdayVwap.min,
                color: '#ff007f',
                lineWidth: 2,
                lineStyle: 1, // Dashed
                axisLabelVisible: true,
                title: 'PDL VWAP (MIN)',
             });
             activeLinesRef.current.push(lineMin);
          }
        }

        // PREDICTION ALGORITHM
        // Calculate recent momentum (last 5 candles)
        const recentFlow = flowList.slice(-5).reduce((acc, f) => acc + f.flow, 0);
        const lastCandle = candleData[candleData.length - 1];
        
        // Determine interval in seconds
        const t1 = candleData[0].time;
        const t2 = candleData[1].time;
        const intervalSec = t2 - t1;

        let futurePath = [];
        let markers = [];

        futurePath.push({ time: lastCandle.time, value: lastCandle.close });

        buyWalls.sort((a, b) => b - a); // highest buy wall first
        sellWalls.sort((a, b) => a - b); // lowest sell wall first

        if (recentFlow >= 0) {
           // BULLISH PREDICTION
           const target1 = sellWalls.find(w => w > lastCandle.close) || (lastCandle.close * 1.02);
           const pullback = buyWalls.find(w => w < target1 && w > lastCandle.close) || (lastCandle.close + (target1 - lastCandle.close) * 0.3);
           const target2 = sellWalls.find(w => w > target1) || (target1 * 1.02);

           futurePath.push({ time: lastCandle.time + intervalSec * 4, value: target1 });
           futurePath.push({ time: lastCandle.time + intervalSec * 7, value: pullback });
           futurePath.push({ time: lastCandle.time + intervalSec * 12, value: target2 });
           
           markers.push({ time: lastCandle.time + intervalSec * 12, position: 'aboveBar', color: '#f59e0b', shape: 'arrowUp', text: 'BULL TARGET' });
        } else {
           // BEARISH PREDICTION
           const target1 = buyWalls.find(w => w < lastCandle.close) || (lastCandle.close * 0.98);
           const pullback = sellWalls.find(w => w > target1 && w < lastCandle.close) || (lastCandle.close - (lastCandle.close - target1) * 0.3);
           const target2 = buyWalls.find(w => w < target1) || (target1 * 0.98);

           futurePath.push({ time: lastCandle.time + intervalSec * 4, value: target1 });
           futurePath.push({ time: lastCandle.time + intervalSec * 7, value: pullback });
           futurePath.push({ time: lastCandle.time + intervalSec * 12, value: target2 });
           
           markers.push({ time: lastCandle.time + intervalSec * 12, position: 'belowBar', color: '#f59e0b', shape: 'arrowDown', text: 'BEAR TARGET' });
        }

        setPredictionData({ path: futurePath, markers });
      }
      setLoading(false);
    };

    loadData();
    const interval = setInterval(loadData, 60000); // Dynamic update every 60 seconds (1 minute)

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  // Handle Prediction Toggle
  useEffect(() => {
     if (predictionSeriesRef.current && predictionData) {
        if (showPrediction) {
           predictionSeriesRef.current.setData(predictionData.path);
           predictionSeriesRef.current.setMarkers(predictionData.markers);
        } else {
           predictionSeriesRef.current.setData([]);
           predictionSeriesRef.current.setMarkers([]);
        }
     }
  }, [showPrediction, predictionData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* HEADER / CONTROLS OVERLAY */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, display: 'flex', gap: 10 }}>
         <button 
           onClick={() => setShowPrediction(!showPrediction)}
           style={{ 
              background: showPrediction ? '#f59e0b' : 'rgba(15, 23, 42, 0.8)', 
              color: showPrediction ? '#0f172a' : '#f59e0b', 
              border: '1px solid #f59e0b', 
              padding: '4px 12px', 
              borderRadius: '6px', 
              fontSize: '0.7rem', 
              fontWeight: 800, 
              cursor: 'pointer', 
              backdropFilter: 'blur(4px)',
              transition: 'all 0.3s'
           }}>
           {showPrediction ? 'HIDE PREDICTION' : '🔮 PREDICT PATH'}
         </button>
      </div>

      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 10 }}>
          <span style={{ fontWeight: 900, color: '#6a0dad', fontSize: '0.8rem', letterSpacing: 2, animation: 'pulse 1.5s infinite' }}>SYNCING...</span>
        </div>
      )}
      <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
};


// --- CHART COMPONENT (MAIN CVD + OI) ---
const FlowChart = ({ symbol, timeframe }) => {
  const chartContainerRef = useRef(null);
  const oiChartContainerRef = useRef(null);
  
  const chartRef = useRef(null);
  const oiChartRef = useRef(null);
  
  const toolTipRef = useRef(null);
  const activeLinesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [hasOI, setHasOI] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current || !oiChartContainerRef.current) return;

    if (!toolTipRef.current) {
      const tt = document.createElement('div');
      tt.style = `position: absolute; display: none; padding: 12px; box-sizing: border-box; font-size: 12px; text-align: left; z-index: 1000; pointer-events: none; border: 1px solid #e2e8f0; border-radius: 8px; background: rgba(255,255,255,0.95); backdrop-filter: blur(4px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); color: #0f172a; font-family: 'Inter', sans-serif; min-width: 200px;`;
      chartContainerRef.current.parentNode.appendChild(tt); 
      toolTipRef.current = tt;
    }

    chartRef.current = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#f1f5f9', style: 1 }, horzLines: { color: '#f1f5f9', style: 1 } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.3 } },
      leftPriceScale: { visible: true, borderColor: '#f1f5f9' },
      timeScale: { borderVisible: false, timeVisible: true, rightOffset: 5 },
      crosshair: { mode: 1 }, 
      handleScroll: { vertTouchDrag: false },
    });

    const areaSeries = chartRef.current.addAreaSeries({
      lineColor: '#6a0dad',
      topColor: 'rgba(106, 13, 173, 0.3)',
      bottomColor: 'rgba(106, 13, 173, 0.0)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 }
    });

    const cvdSeries = chartRef.current.addLineSeries({
      color: '#00e5ff',
      lineWidth: 2,
      priceScaleId: 'left',
      priceFormat: { type: 'volume' }
    });

    const volumeSeries = chartRef.current.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
      scaleMargins: { top: 0.7, bottom: 0 },
    });

    oiChartRef.current = createChart(oiChartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#f1f5f9', style: 1 }, horzLines: { color: '#f1f5f9', style: 1 } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, rightOffset: 5 },
      crosshair: { mode: 1 }, 
      handleScroll: { vertTouchDrag: false },
    });

    const oiSeries = oiChartRef.current.addAreaSeries({
      lineColor: '#f59e0b',
      topColor: 'rgba(245, 158, 11, 0.3)',
      bottomColor: 'rgba(245, 158, 11, 0.0)',
      lineWidth: 2,
      priceFormat: { type: 'volume' }
    });

    const syncCrosshair = (chart, seriesList, param) => {
      const toolTip = toolTipRef.current;
      if (!toolTip) return;
      
      if (!param.time || param.point === undefined || param.point.x < 0 || param.point.y < 0) {
        toolTip.style.display = 'none';
        return;
      }
      
      const dateStr = new Date(param.time * 1000).toLocaleString();
      const price = param.seriesData.get(areaSeries)?.value;
      const cvd = param.seriesData.get(cvdSeries)?.value;
      const vol = param.seriesData.get(volumeSeries)?.value;
      const oi = param.seriesData.get(oiSeries)?.value;

      if (price !== undefined && vol !== undefined && cvd !== undefined) {
        toolTip.style.display = 'block';
        const isGreen = vol >= 0;
        const cvdGreen = cvd >= 0;
        
        const flowText = isGreen ? `+$${formatMoney(vol)}` : `-$${formatMoney(Math.abs(vol))}`;
        const cvdText = cvdGreen ? `+$${formatMoney(cvd)}` : `-$${formatMoney(Math.abs(cvd))}`;
        const oiText = oi !== undefined ? formatMoney(oi) : 'N/A';

        toolTip.innerHTML = `
          <div style="font-weight: 800; color: #64748b; margin-bottom: 8px; font-size: 0.7rem;">${dateStr}</div>
          <div style="display: flex; justify-content: space-between; gap: 20px; align-items: center;">
            <span style="font-weight: 700; color: #94a3b8; font-size: 0.75rem;">Price</span>
            <span style="font-weight: 900; color: #6a0dad; font-size: 0.9rem;">$${price.toFixed(4)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-top: 4px;">
            <span style="font-weight: 700; color: #94a3b8; font-size: 0.75rem;">Bar Flow</span>
            <span style="font-weight: 900; color: ${isGreen ? '#00e676' : '#ff3b30'}; font-size: 0.85rem;">${flowText}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-top: 4px; padding-top: 4px; border-top: 1px solid #f1f5f9;">
            <span style="font-weight: 900; color: #00e5ff; font-size: 0.75rem;">Net Flow</span>
            <span style="font-weight: 900; color: ${cvdGreen ? '#00e5ff' : '#00b8cc'}; font-size: 0.9rem;">${cvdText}</span>
          </div>
          ${oi !== undefined ? `
          <div style="display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-top: 4px;">
            <span style="font-weight: 900; color: #f59e0b; font-size: 0.75rem;">Open Interest</span>
            <span style="font-weight: 900; color: #f59e0b; font-size: 0.85rem;">${oiText}</span>
          </div>
          ` : ''}
        `;

        const toolTipWidth = 220;
        const toolTipHeight = oi !== undefined ? 140 : 120;
        
        const wrapperRect = chartContainerRef.current.parentNode.getBoundingClientRect();
        
        let y = 0;
        if (chart === chartRef.current) {
           y = param.point.y;
        } else {
           y = chartContainerRef.current.clientHeight + param.point.y;
        }

        let x = param.point.x;
        if (x > wrapperRect.width - toolTipWidth) {
          x = x - toolTipWidth - 15;
        } else {
          x = x + 15;
        }
        
        toolTip.style.left = x + 'px';
        toolTip.style.top = Math.max(0, y - toolTipHeight - 15) + 'px';
      } else {
        toolTip.style.display = 'none';
      }
    };

    chartRef.current.subscribeCrosshairMove((param) => {
      if (!oiChartRef.current) return;
      syncCrosshair(chartRef.current, [areaSeries, cvdSeries, volumeSeries], param);
      
      if (param.time) {
         oiChartRef.current.setCrosshairPosition(param.seriesData.get(areaSeries)?.value || 0, param.time, oiSeries);
      } else {
         oiChartRef.current.clearCrosshairPosition();
      }
    });

    oiChartRef.current.subscribeCrosshairMove((param) => {
      if (!chartRef.current) return;
      syncCrosshair(oiChartRef.current, [oiSeries], param);
      
      if (param.time) {
         chartRef.current.setCrosshairPosition(param.seriesData.get(oiSeries)?.value || 0, param.time, areaSeries);
      } else {
         chartRef.current.clearCrosshairPosition();
      }
    });

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (oiChartRef.current) oiChartRef.current.timeScale().setVisibleLogicalRange(range);
    });
    oiChartRef.current.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (chartRef.current) chartRef.current.timeScale().setVisibleLogicalRange(range);
    });

    const loadData = async () => {
      setLoading(true);
      
      const [klineData, oiData, hourlyKlines] = await Promise.all([
        fetchBybitData(symbol, timeframe, 300),
        fetchOpenInterest(symbol, timeframe),
        fetchBybitData(symbol, '60', 100)
      ]);

      if (klineData && klineData.length > 0) {
        const sorted = [...klineData].reverse(); 
        
        const lineData = [];
        const volData = [];
        const cvdData = [];
        let cumulativeFlow = 0;

        sorted.forEach(k => {
          const time = Math.floor(Number(k[0]) / 1000);
          const open = Number(k[1]);
          const high = Number(k[2]);
          const low = Number(k[3]);
          const close = Number(k[4]);
          const turnover = Number(k[6]);
          
          let flow = 0;
          if (open > 0) flow = turnover * ((close - open) / open);
          
          cumulativeFlow += flow;

          lineData.push({ time, value: close });
          cvdData.push({ time, value: cumulativeFlow });
          volData.push({ 
            time, 
            value: flow, 
            color: flow >= 0 ? '#00e676' : '#ff3b30' 
          });
        });

        // Clear previous price lines (prevents memory leak and duplicated rendering)
        activeLinesRef.current.forEach(line => {
          try {
            areaSeries.removePriceLine(line);
          } catch (e) {}
        });
        activeLinesRef.current = [];

        // CALCULATE PREVIOUS DAY VWAP MAX & MIN FROM HOURLY DATA
        if (hourlyKlines && hourlyKlines.length > 0) {
          const sortedHourly = [...hourlyKlines].reverse();
          const processedHourly = [];
          let currentDay = null;
          let currentVwapSum = 0;
          let currentVolumeSum = 0;

          for (const k of sortedHourly) {
            const date = new Date(Number(k[0]));
            const dayStr = date.toISOString().split('T')[0];
            const close = Number(k[4]);
            const volume = Number(k[5]);

            if (currentDay !== dayStr) {
              currentDay = dayStr;
              currentVwapSum = 0;
              currentVolumeSum = 0;
            }

            currentVwapSum += (close * volume);
            currentVolumeSum += volume;
            processedHourly.push({ 
              vwapDaily: currentVolumeSum > 0 ? (currentVwapSum / currentVolumeSum) : close, 
              date: dayStr 
            });
          }

          const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          let yesterdayMaxVwap = 0, yesterdayMinVwap = Infinity;
          let hasYesterday = false;

          for (const p of processedHourly) {
            if (p.date === yesterdayStr) {
              yesterdayMaxVwap = Math.max(yesterdayMaxVwap, p.vwapDaily);
              yesterdayMinVwap = Math.min(yesterdayMinVwap, p.vwapDaily);
              hasYesterday = true;
            }
          }

          let yesterdayVwap = { max: 0, min: 0 };
          if (hasYesterday && yesterdayMaxVwap > 0 && yesterdayMinVwap !== Infinity) {
            yesterdayVwap = { max: yesterdayMaxVwap, min: yesterdayMinVwap };
          } else {
            const vwaps = processedHourly.map(p => p.vwapDaily);
            yesterdayVwap = { max: Math.max(...vwaps), min: Math.min(...vwaps) };
          }

          // Render PDH VWAP (MAX) - Cyan dashed line
          if (yesterdayVwap.max > 0) {
             const lineMax = areaSeries.createPriceLine({
                price: yesterdayVwap.max,
                color: '#00d0ff',
                lineWidth: 2,
                lineStyle: 1, // Dashed
                axisLabelVisible: true,
                title: 'PDH VWAP (MAX)',
             });
             activeLinesRef.current.push(lineMax);
          }

          // Render PDL VWAP (MIN) - Beautiful Pink dashed line
          if (yesterdayVwap.min > 0) {
             const lineMin = areaSeries.createPriceLine({
                price: yesterdayVwap.min,
                color: '#ff007f',
                lineWidth: 2,
                lineStyle: 1, // Dashed
                axisLabelVisible: true,
                title: 'PDL VWAP (MIN)',
             });
             activeLinesRef.current.push(lineMin);
          }
        }

        areaSeries.setData(lineData);
        cvdSeries.setData(cvdData);
        volumeSeries.setData(volData);
        chartRef.current.timeScale().fitContent();

        if (oiData && oiData.length > 0) {
           setHasOI(true);
           const oiSorted = [...oiData].reverse();
           const oiChartData = [];
           oiSorted.forEach(o => {
              const time = Math.floor(Number(o.timestamp) / 1000);
              const val = Number(o.openInterest);
              oiChartData.push({ time, value: val });
           });
           
           oiSeries.setData(oiChartData);
           oiChartRef.current.timeScale().fitContent();
        } else {
           setHasOI(false);
        }
      }
      setLoading(false);
    };

    loadData();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
      if (oiChartRef.current && oiChartContainerRef.current) {
        oiChartRef.current.applyOptions({ width: oiChartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      if (oiChartRef.current) {
        oiChartRef.current.remove();
        oiChartRef.current = null;
      }
      if (toolTipRef.current && toolTipRef.current.parentNode) {
        toolTipRef.current.parentNode.removeChild(toolTipRef.current);
        toolTipRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 10 }}>
          <span style={{ fontWeight: 900, color: '#6a0dad', fontSize: '0.8rem', letterSpacing: 2, animation: 'pulse 1.5s infinite' }}>SYNCING...</span>
        </div>
      )}
      
      {/* Main Chart */}
      <div ref={chartContainerRef} style={{ width: '100%', height: hasOI ? '300px' : '450px' }} />
      
      {/* OI Chart (Independent) */}
      <div 
        ref={oiChartContainerRef} 
        style={{ 
          width: '100%', 
          height: hasOI ? '150px' : '0px', 
          marginTop: hasOI ? '10px' : '0px',
          display: hasOI ? 'block' : 'none'
        }} 
      />
    </div>
  );
};


// --- DAILY FOOTPRINT PROFILE COMPONENT ---
const DailyFootprintProfile = ({ symbol }) => {
  const [nodes, setNodes] = useState([]);
  const [candles, setCandles] = useState([]);
  const [dailyStats, setDailyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maxVolume, setMaxVolume] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Fetch 96 candles of 15m (24 hours)
      const data = await fetchBybitData(symbol, '15', 96);
      if (data && data.length > 0) {
        let dailyHigh = 0;
        let dailyLow = Infinity;
        
        data.forEach(k => {
           const high = Number(k[2]);
           const low = Number(k[3]);
           if (high > dailyHigh) dailyHigh = high;
           if (low < dailyLow) dailyLow = low;
        });

        const binCount = 20;
        const binSize = (dailyHigh - dailyLow) / binCount || 0.0001;
        
        const bins = Array.from({ length: binCount }).map((_, i) => {
           const priceStart = dailyLow + (i * binSize);
           const priceEnd = priceStart + binSize;
           const priceCenter = (priceStart + priceEnd) / 2;
           return {
              id: i,
              price: priceCenter,
              inflow: 0,
              outflow: 0,
              total: 0
           };
        });

        data.forEach(k => {
           const open = Number(k[1]);
           const high = Number(k[2]);
           const low = Number(k[3]);
           const close = Number(k[4]);
           const turnover = Number(k[6]);
           
           let flow = 0;
           if (open > 0) {
             flow = turnover * ((close - open) / open);
           }

           let binIndex = Math.floor((close - dailyLow) / binSize);
           if (binIndex >= binCount) binIndex = binCount - 1;
           if (binIndex < 0) binIndex = 0;

           if (flow > 0) {
              bins[binIndex].inflow += flow;
           } else {
              bins[binIndex].outflow += Math.abs(flow);
           }
           bins[binIndex].total += Math.abs(flow);
        });

        bins.reverse();
        const mVol = Math.max(...bins.map(b => b.total));
        
        const chronCandles = [...data].reverse().map(k => ({
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4])
        }));

        setDailyStats({
          open: chronCandles[0].open,
          close: chronCandles[chronCandles.length - 1].close,
          high: dailyHigh,
          low: dailyLow
        });

        setCandles(chronCandles);
        setMaxVolume(mVol);
        setNodes(bins);
      }
      setLoading(false);
    };
    
    load();
    const interval = setInterval(load, 60000); // Dynamic update every 60s
    return () => clearInterval(interval);
  }, [symbol]);

  if (loading) return <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#6a0dad', fontWeight: 900, animation: 'pulse 1.5s infinite' }}>ANALYZING ORDER FLOW...</div>;

  // SVG dimensions
  const svgW = 600;
  const svgH = 500;
  const getY = (price) => {
    if (!dailyStats || dailyStats.high === dailyStats.low) return svgH / 2;
    return svgH - ((price - dailyStats.low) / (dailyStats.high - dailyStats.low)) * svgH;
  };

  const isDailyGreen = dailyStats && dailyStats.close >= dailyStats.open;
  const dailyColor = isDailyGreen ? '#00e676' : '#ff3b30';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      
      {/* COLUMN 1: THE FOOTPRINT TABLE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 0', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', marginBottom: '8px', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', fontFamily: 'Inter' }}>
           <div style={{ width: '80px' }}>PRICE</div>
           <div style={{ flex: 1, textAlign: 'right', paddingRight: '10px' }}>OUTFLOW (RED)</div>
           <div style={{ flex: 1, paddingLeft: '10px' }}>INFLOW (GREEN)</div>
           <div style={{ width: '80px', textAlign: 'right' }}>DELTA</div>
        </div>
        {nodes.map(n => {
          const outPct = maxVolume > 0 ? (n.outflow / maxVolume) * 100 : 0;
          const inPct = maxVolume > 0 ? (n.inflow / maxVolume) * 100 : 0;
          const delta = n.inflow - n.outflow;
          const isPOC = n.total === maxVolume && maxVolume > 0;

          return (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', height: '22px', background: isPOC ? 'rgba(245,158,11,0.1)' : 'transparent', border: isPOC ? '1px dashed #f59e0b' : 'none', boxSizing: 'border-box' }}>
              <div style={{ width: '80px', fontWeight: isPOC ? 900 : 600, color: isPOC ? '#f59e0b' : '#64748b' }}>
                 {n.price.toFixed(4)}
              </div>
              
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: '10px' }}>
                 <div style={{ width: `${outPct}%`, height: '14px', background: '#ff3b30', opacity: 0.8, borderRadius: '4px 0 0 4px', transition: 'width 0.5s', position: 'relative' }}>
                    {n.outflow > 0 && <span style={{ position: 'absolute', right: '100%', marginRight: '4px', color: '#ff3b30', fontSize: '0.65rem', lineHeight: '14px' }}>${formatMoney(n.outflow)}</span>}
                 </div>
              </div>
              
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', paddingLeft: '10px' }}>
                 <div style={{ width: `${inPct}%`, height: '14px', background: '#00e676', opacity: 0.8, borderRadius: '0 4px 4px 0', transition: 'width 0.5s', position: 'relative' }}>
                    {n.inflow > 0 && <span style={{ position: 'absolute', left: '100%', marginLeft: '4px', color: '#00e676', fontSize: '0.65rem', lineHeight: '14px' }}>${formatMoney(n.inflow)}</span>}
                 </div>
              </div>
              
              <div style={{ width: '80px', textAlign: 'right', fontWeight: 800, color: delta >= 0 ? '#00e676' : '#ff3b30' }}>
                 {delta >= 0 ? '+' : '-'}${formatMoney(Math.abs(delta))}
              </div>
            </div>
          );
        })}
      </div>

      {/* COLUMN 2: THE ANATOMY SVG */}
      <div style={{ position: 'relative', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', height: svgH }}>
         <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
            {/* 1. Background Nodes (Volume Profile) */}
            {nodes.map(n => {
              const yPos = getY(n.price);
              const nodeH = svgH / nodes.length;
              const isPOC = n.total === maxVolume && maxVolume > 0;
              const widthPct = maxVolume > 0 ? (n.total / maxVolume) * 100 : 0;
              const nodeWidth = (widthPct / 100) * svgW;
              
              return (
                <g key={`bg-${n.id}`}>
                  {/* Highlight bar from left */}
                  <rect x={0} y={yPos - nodeH/2} width={nodeWidth} height={nodeH} fill={isPOC ? '#f59e0b' : '#cbd5e1'} opacity={isPOC ? 0.3 : 0.15} />
                  {isPOC && <line x1={0} y1={yPos} x2={svgW} y2={yPos} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" opacity={0.6} />}
                </g>
              );
            })}

            {/* 2. Big Daily Candle (Macro) */}
            {dailyStats && (
              <g opacity={0.3}>
                <line 
                  x1={50} y1={getY(dailyStats.high)} 
                  x2={50} y2={getY(dailyStats.low)} 
                  stroke={dailyColor} strokeWidth="4" 
                />
                <rect 
                  x={20} 
                  y={Math.min(getY(dailyStats.open), getY(dailyStats.close))} 
                  width={60} 
                  height={Math.max(1, Math.abs(getY(dailyStats.open) - getY(dailyStats.close)))} 
                  fill={dailyColor} 
                />
              </g>
            )}

            {/* 3. The 15m Candles (Micro) */}
            {candles.map((c, i) => {
               const xPos = 120 + (i * ((svgW - 140) / candles.length));
               const cGreen = c.close >= c.open;
               const cColor = cGreen ? '#00e676' : '#ff3b30';
               return (
                 <g key={i}>
                   <line 
                     x1={xPos} y1={getY(c.high)} 
                     x2={xPos} y2={getY(c.low)} 
                     stroke={cColor} strokeWidth="1" 
                   />
                   <rect 
                     x={xPos - 2} 
                     y={Math.min(getY(c.open), getY(c.close))} 
                     width={4} 
                     height={Math.max(1, Math.abs(getY(c.open) - getY(c.close)))} 
                     fill={cColor} 
                   />
                 </g>
               );
            })}
         </svg>
         
         <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', border: '1px solid #e2e8f0', backdropFilter: 'blur(4px)' }}>
            1D ANATOMY (15m Candles + Footprint Nodes)
         </div>
      </div>
      
    </div>
  );
};


// --- DIRECTION ESTIMATOR CHART COMPONENT ---
const DirectionEstimatorChart = ({ symbol, timeframe }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#f1f5f9', style: 1 }, horzLines: { color: '#f1f5f9', style: 1 } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, rightOffset: 5 },
      crosshair: { mode: 1 },
      handleScroll: { vertTouchDrag: false },
    });

    const oscillatorSeries = chartRef.current.addHistogramSeries({
      priceFormat: { type: 'volume' },
      base: 0,
    });

    const loadData = async () => {
      setLoading(true);
      const [klineData, oiData] = await Promise.all([
        fetchBybitData(symbol, timeframe, 300),
        fetchOpenInterest(symbol, timeframe)
      ]);

      if (!klineData || klineData.length === 0) {
        setLoading(false);
        return;
      }

      if (!oiData || oiData.length === 0) {
        // No futures data available
        chartRef.current.applyOptions({ watermark: { color: 'rgba(239, 68, 68, 0.5)', visible: true, text: 'NO FUTURES DATA FOR DIRECTION ESTIMATOR', fontSize: 16, horzAlign: 'center', vertAlign: 'center' } });
        setLoading(false);
        return;
      }

      const sorted = [...klineData].reverse();
      const oiSorted = [...oiData].reverse();

      const oscData = [];
      let prevClose = null;
      let prevOI = null;

      sorted.forEach(k => {
        const kTimeMs = Number(k[0]);
        const time = Math.floor(kTimeMs / 1000);
        const open = Number(k[1]);
        const high = Number(k[2]);
        const low = Number(k[3]);
        const close = Number(k[4]);
        const turnover = Number(k[6]);
        
        let flow = 0;
        if (open > 0) {
          flow = turnover * ((close - open) / open);
        }

        // Find the closest OI reading for this candle (within 1 hour max diff)
        let closestOI = null;
        let minDiff = Infinity;
        oiSorted.forEach(o => {
           const oTimeMs = Number(o.timestamp);
           const diff = Math.abs(oTimeMs - kTimeMs);
           if (diff < minDiff && diff <= 60 * 60 * 1000) { // max 1h diff
               minDiff = diff;
               closestOI = Number(o.openInterest);
           }
        });

        const currentOI = closestOI !== null ? closestOI : prevOI;

        if (prevClose !== null && currentOI !== null && prevOI !== null) {
           const deltaPrice = close - prevClose;
           const deltaOI = currentOI - prevOI;
           
           let score = 0;
           let color = '#cbd5e1';
           
           // The Confluence Logic
           if (deltaPrice > 0 && deltaOI > 0 && flow > 0) {
               score = 100; color = '#00e676'; // STRONG LONG
           } else if (deltaPrice > 0 && deltaOI > 0 && flow < 0) {
               score = -100; color = '#ff3b30'; // BULL TRAP (Lev Buying, Spot Selling)
           } else if (deltaPrice < 0 && deltaOI > 0 && flow < 0) {
               score = -100; color = '#ff3b30'; // STRONG SHORT
           } else if (deltaPrice < 0 && deltaOI > 0 && flow > 0) {
               score = 100; color = '#00e676'; // BEAR TRAP (Lev Selling, Spot Buying)
           } else if (deltaPrice > 0 && deltaOI < 0 && flow > 0) {
               score = 60; color = '#00b8cc'; // SHORT SQUEEZE
           } else if (deltaPrice < 0 && deltaOI < 0 && flow < 0) {
               score = -60; color = '#f59e0b'; // LONG LIQUIDATION
           } else {
               score = flow > 0 ? 20 : -20;
               color = flow > 0 ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 59, 48, 0.4)';
           }

           oscData.push({ time, value: score, color });
        } else {
           // First candle or missing OI
           oscData.push({ time, value: 0, color: 'transparent' });
        }

        prevClose = close;
        if (currentOI !== null) prevOI = currentOI;
      });

      oscillatorSeries.setData(oscData);
      chartRef.current.timeScale().fitContent();
      
      setLoading(false);
    };

    loadData();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
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
  }, [symbol, timeframe]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 10 }}>
          <span style={{ fontWeight: 900, color: '#6a0dad', fontSize: '0.8rem', letterSpacing: 2, animation: 'pulse 1.5s infinite' }}>SYNCING...</span>
        </div>
      )}
      <div ref={chartContainerRef} style={{ width: '100%', height: '200px' }} />
    </div>
  );
};


// --- MINI CHART SUB-COMPONENT FOR LIGHT-THEMED CARDS ---
const EcoMiniChart = ({ symbol }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 180,
      layout: {
        background: { color: '#f8fafc' },
        textColor: '#64748b',
        fontSize: 9,
      },
      grid: {
        vertLines: { color: '#f1f5f9', style: 1 },
        horzLines: { color: '#f1f5f9', style: 1 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        autoScale: true,
        visible: true,
      },
      crosshair: {
        mode: 1, // Simple crosshair
      }
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00e676',
      downColor: '#ff3b30',
      borderVisible: false,
      wickUpColor: '#00e676',
      wickDownColor: '#ff3b30',
    });

    const loadChartData = async () => {
      try {
        setLoading(true);
        const data = await fetchBybitData(symbol, 'D', 30);
        if (data && data.length > 0) {
          const sorted = [...data].reverse();
          const chartData = sorted.map(k => {
            const date = new Date(Number(k[0]));
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return {
              time: `${year}-${month}-${day}`,
              open: Number(k[1]),
              high: Number(k[2]),
              low: Number(k[3]),
              close: Number(k[4]),
            };
          });

          const uniqueChartData = [];
          const seenTimes = new Set();
          for (const d of chartData) {
            if (!seenTimes.has(d.time)) {
              seenTimes.add(d.time);
              uniqueChartData.push(d);
            }
          }

          candlestickSeries.setData(uniqueChartData);
          chart.timeScale().fitContent();
        }
      } catch (err) {
        console.error("Failed to load daily mini-chart", err);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();

    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '180px', marginTop: '10px' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(248, 250, 252, 0.8)', zIndex: 5, borderRadius: '8px' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#6a0dad', letterSpacing: '1px' }}>SYNCING...</span>
        </div>
      )}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '180px', 
          background: '#f8fafc', 
          borderRadius: '8px', 
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }} 
      />
    </div>
  );
};


export const HypeScalper = () => {
  const [timeframe, setTimeframe] = React.useState('15');
  const [currentPrice, setCurrentPrice] = React.useState(0);
  const [priceChangePercent, setPriceChangePercent] = React.useState(0);
  const [volume24h, setVolume24h] = React.useState(0);
  const [spotTurnover, setSpotTurnover] = React.useState(0);
  const [futuresData, setFuturesData] = React.useState({ volume: 0, oi: 0, funding: 0 });
  const symbol = 'HYPEUSDT';
  const displaySymbol = 'MONAD';
  
  const circSupply = 310000000; // 310M
  const totalSupply = 1000000000; // 1B
  
  const marketCap = currentPrice * circSupply;
  const fdv = currentPrice * totalSupply;
  const mcapFdvRatio = fdv > 0 ? (marketCap / fdv * 100) : 0;
  
  const formatCurrency = (val) => {
    if (!val) return '$0.00';
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(2)}K`;
    return `${val.toFixed(2)}`;
  };

  // Fetch 24h Ticker Stats
  const fetchTickerStats = async () => {
    try {
      const [spotRes, linearRes] = await Promise.all([
        fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=' + symbol).then(r=>r.json()).catch(()=>null),
        fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=' + symbol).then(r=>r.json()).catch(()=>null)
      ]);
      
      const spotTicker = spotRes?.result?.list?.[0];
      if (spotTicker) {
        setCurrentPrice(parseFloat(spotTicker.lastPrice));
        setPriceChangePercent(parseFloat(spotTicker.price24hPcnt) * 100);
        setVolume24h(parseFloat(spotTicker.volume24h));
        setSpotTurnover(parseFloat(spotTicker.turnover24h));
      }
      
      const linTicker = linearRes?.result?.list?.[0];
      if (linTicker) {
        let oiVal = parseFloat(linTicker.openInterestValue || 0);
        if (!oiVal && linTicker.openInterest) {
           oiVal = parseFloat(linTicker.openInterest) * parseFloat(spotTicker?.lastPrice || linTicker.lastPrice || 0);
        }
        setFuturesData({
           volume: parseFloat(linTicker.turnover24h || 0),
           oi: oiVal,
           funding: parseFloat(linTicker.fundingRate || 0) * 100
        });
      }
    } catch (err) {
      console.error('Error fetching ticker stats:', err);
    }
  };

  React.useEffect(() => {
    fetchTickerStats();
    const tickerInterval = setInterval(fetchTickerStats, 5000);
    return () => clearInterval(tickerInterval);
  }, []);

  const isPositive = priceChangePercent >= 0;
  const badgeBg = isPositive ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 59, 48, 0.1)';
  const badgeColor = isPositive ? '#00e676' : '#ff3b30';

  return (
    <div className="analytics-dashboard">
      <div className="dash-grid">
        
        {/* HEADER SECTION */}
        <div style={{ gridColumn: 'span 12', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', border: '1px solid #1e293b', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          <div>
            <h1 style={{ color: '#f8fafc', fontSize: '2rem', fontWeight: 900, margin: 0, letterSpacing: '-1px' }}>{displaySymbol} TERMINAL</h1>
            <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontWeight: 600 }}>Exclusive Liquidity Flow & Whale Tracker for {displaySymbol}</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#f8fafc', fontFamily: 'monospace' }}>
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>
                24H Vol: {(volume24h / 1e6).toFixed(2)}M MON
              </span>
            </div>
            
            <div style={{ 
              background: badgeBg, 
              color: badgeColor, 
              padding: '10px 20px', 
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '1.2rem', 
              fontWeight: '900',
              border: `1px solid ${badgeColor}40`
            }}>
              <span>{isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
              <span style={{ fontSize: '1rem' }}>{isPositive ? '▲' : '▼'}</span>
            </div>
          </div>
        </div>

        {/* FUNDAMENTALS & METRICS ROW */}
        <div className="dash-card" style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="card-title" style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>HYPE Metrics</div>
          
          {/* Top 4 Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>Spot Volume (24H) ⓘ</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 900 }}>{formatCurrency(spotTurnover)}</span>
                <span style={{ fontSize: '0.75rem', color: '#ff3b30', fontWeight: 700 }}>{priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
              </div>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>Marketcap ⓘ</div>
              <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 900 }}>{formatCurrency(marketCap)}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>FDV ⓘ</div>
              <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 900 }}>{formatCurrency(fdv)}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>Mindshare ⓘ</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                 <span style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 900 }}>High</span>
                 <span style={{ color: '#38bdf8', fontSize: '0.8rem' }}>📊</span>
              </div>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>𝕏 Metrics (24H) ⓘ</div>
                <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 900 }}>26 Notable Posts</div>
            </div>
          </div>
          
          <hr style={{ borderColor: '#e2e8f0', margin: '10px 0' }} />
          
          {/* Detailed Lists */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Circ. Supply ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>310M</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  العرض المتداول: عدد العملات المتاحة للتداول في السوق حالياً
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Max Supply ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>-</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  الحد الأقصى للعرض: الحد الأقصى المطلق لعدد العملات التي سيتم إنشاؤها على الإطلاق
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Total Supply ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>1B</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  إجمالي العرض: إجمالي عدد العملات التي تم إنشاؤها مطروحاً منها العملات المحروقة
                </div>
              </div>
              <hr style={{ borderColor: '#e2e8f0', margin: '5px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Futures Volume ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>{formatCurrency(futuresData.volume)}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  حجم تداول العقود الآجلة: إجمالي حجم التداول للعقود الآجلة خلال 24 ساعة
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Funding Rate ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>{futuresData.funding.toFixed(4)}%</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  معدل التمويل: الرسوم الدورية المدفوعة بين المتداولين للحفاظ على سعر العقد قريباً من السعر الفوري
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Sentiment ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>24H <span style={{color:'#00e676'}}>↗</span> 7D <span style={{color:'#00e676'}}>↗</span></span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  معنويات السوق: المزاج العام أو شعور المستثمرين تجاه الأصل
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Mcap/FDV ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>{mcapFdvRatio.toFixed(2)}%</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  القيمة السوقية / التقييم المخفف بالكامل: نسبة القيمة السوقية الحالية إلى التقييم في حال تداول جميع العملات
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Sector Ranking ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>#50</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  تصنيف القطاع: ترتيب العملة مقارنة بالعملات الأخرى في نفس القطاع
                </div>
              </div>
              <hr style={{ borderColor: '#e2e8f0', margin: '5px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Open Interest ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>{formatCurrency(futuresData.oi)}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  الفائدة المفتوحة: إجمالي القيمة بالدولار للعقود الآجلة غير المغلقة
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Volatility (30D) ⓘ</span>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>82.81%</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }} dir="rtl">
                  التقلب لمدة 30 يوم: مقياس لمدى تذبذب السعر خلال آخر 30 يوماً
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* UNLOCKS CARD */}
        <div className="dash-card" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title" style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>HYPE Unlocks ⓘ</div>
            <button style={{ background: '#e2e8f0', border: '1px solid #334155', color: '#0f172a', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Explore Unlocks</button>
          </div>
          
          <div style={{ marginTop: '5px' }}>
            <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 800, marginBottom: '6px' }}>46.5% Completed</div>
            <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ height: '100%', width: '30%', background: '#6366f1' }}></div>
              <div style={{ height: '100%', width: '10%', background: '#d97757' }}></div>
              <div style={{ height: '100%', width: '6.5%', background: '#c026d3' }}></div>
            </div>
          </div>
          
          <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 700, marginTop: '5px' }}>Next Unlock</div>
          
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
              In 186 days
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 800 }}>Nov</div>
                <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 900 }}>24</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900 }}>{formatCurrency(1400000000 * currentPrice)} (310M HYPE)</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>31% of Total Supply</div>
              </div>
            </div>
            
            <button style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '8px 12px', borderRadius: '6px', color: '#0f172a', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              <span>🚀 Access Token Unlocks and more</span>
              <span style={{ background: '#0284c7', padding: '2px 8px', borderRadius: '4px' }}>Upgrade</span>
            </button>
          </div>
        </div>

        {/* SCALPING NET FLOW & PRICE (Full width) */}
        <div className="dash-card" style={{ gridColumn: 'span 12', minHeight: 500 }}>
          <div className="card-title">
             <div style={{ display: 'flex', gap: 10 }}>
                <span>SCALPING NET FLOW & HISTORICAL PRICE</span>
             </div>
             
             {/* TIMEFRAME SELECTOR */}
             <div style={{ display: 'flex', gap: 6 }}>
               {[
                 { val: '5', lbl: '5m' },
                 { val: '15', lbl: '15m' },
                 { val: '60', lbl: '1H' },
                 { val: '240', lbl: '4H' },
                 { val: 'D', lbl: '1D' },
                 { val: 'W', lbl: '1W' },
                 { val: 'M', lbl: '1M' }
               ].map(tf => (
                 <button 
                   key={tf.val} 
                   className={`tf-btn ${timeframe === tf.val ? 'active' : ''}`}
                   onClick={() => setTimeframe(tf.val)}
                 >
                   {tf.lbl}
                 </button>
               ))}
             </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem' }}>
             <div style={{ display: 'flex', gap: 15, fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, background: '#00e676', borderRadius: 2 }}/> Inflow
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, background: '#ff3b30', borderRadius: 2 }}/> Outflow
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 2, background: '#00e5ff' }}/> Net Flow
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 2, background: '#6a0dad' }}/> Price
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 2, background: '#f59e0b' }}/> Open Interest
                </span>
             </div>
          </div>
          
          <FlowChart symbol={symbol} timeframe={timeframe} />
        </div>

        {/* WHALE MAGNET ZONES */}
        <div className="dash-card" style={{ gridColumn: 'span 12', minHeight: 450 }}>
          <div className="card-title">
             <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>WHALE LIQUIDITY MAGNETS (LIQUIDITY MEMORY)</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Top 3 Historical Inflow & Outflow Nodes</span>
             </div>
          </div>
          <MagnetChart symbol={symbol} timeframe={timeframe} />
        </div>

        {/* DAILY FOOTPRINT */}
        <div className="dash-card" style={{ gridColumn: 'span 12', minHeight: 450 }}>
          <div className="card-title">
             <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>DAILY FOOTPRINT PROFILE (ORDER FLOW)</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Last 24 Hours Decomposed (20 Nodes)</span>
             </div>
          </div>
          <DailyFootprintProfile symbol={symbol} />
        </div>

        {/* DIRECTION ESTIMATOR */}
        <div className="dash-card" style={{ gridColumn: 'span 12', minHeight: 300 }}>
          <div className="card-title">
             <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>DIRECTION ESTIMATOR (CONFLUENCE ENGINE)</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>AI-driven confluence score (Price x OI x Net Flow)</span>
             </div>
          </div>
          <DirectionEstimatorChart symbol={symbol} timeframe={timeframe} />
        </div>

        {/* INFLATION ESTIMATION */}
        <div className="dash-card" style={{ gridColumn: 'span 12', minHeight: 400 }}>
          <div className="card-title">
             <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>ESTIMATION DU PRIX FUTUR (AJUSTÉ À L'INFLATION)</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Scénario à 1 an par paliers (MarketCap constant = Prix en baisse vs Supply en hausse)</span>
             </div>
          </div>
          <div style={{ height: '320px', position: 'relative' }}>
            <InflationProjectionChart currentPrice={currentPrice} />
          </div>
          <div style={{ marginTop: '1.5rem', padding: '1.2rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
             <h4 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '0.9rem', fontWeight: 800 }}>💡 Comment interpréter ce modèle d'inflation ?</h4>
             <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#475569', lineHeight: '1.5' }}>
               Ce graphique estime le <strong>Prix Futur</strong> en supposant que la demande et l'argent total investi (Marketcap) restent constants.
             </p>
             <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#475569', lineHeight: '1.5' }}>
                <li style={{ marginBottom: '4px' }}><strong>Ligne Bleue (Circulating Supply) :</strong> Représente le nombre de jetons en circulation. Elle monte en "escalier" à chaque déblocage prévu (Unlock).</li>
                <li style={{ marginBottom: '4px' }}><strong>Ligne Rouge (Prix Projeté) :</strong> Représente le prix estimé. À chaque déblocage, le prix subit une "dilution" et chute mécaniquement.</li>
                <li><strong>Ce qu'il va se passer :</strong> Pour que le prix réel résiste à ces chutes, il faut que de nouveaux capitaux massifs entrent sur le marché. Sans nouvelle demande agressive, l'inflation structurelle de l'offre fera chuter le prix à long terme. C'est le principal risque des tokens à faible offre initiale ("Low Float / High FDV").</li>
             </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HypeScalper;
