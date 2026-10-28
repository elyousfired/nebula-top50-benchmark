import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { fetchSyntheticChartData, calculateEMA } from './logic/advancedChartEngine';
import { BarChart2, TrendingUp, RefreshCw } from 'lucide-react';

const timeframes = ['1m', '15m', '1h', '4H', '1d', '1W'];
const defaultTokens = ['HYPE', 'MON', 'ASTER'];

const AdvancedSwitchCharts = () => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const emaSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  
  const [symbol, setSymbol] = useState('HYPE');
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize Chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear any existing children to prevent double chart mounting
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#888',
        fontFamily: 'Inter, sans-serif'
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#333', style: 2, labelBackgroundColor: '#111' },
        horzLine: { color: '#333', style: 2, labelBackgroundColor: '#111' }
      },
      timeScale: {
        borderColor: '#1a1a1a',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1a1a1a',
        autoScale: true
      },
      width: chartContainerRef.current.clientWidth,
      height: 500
    });

    chartRef.current = chart;

    // Candlesticks for synthetic ratio
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff3b30',
      borderVisible: false,
      wickUpColor: '#00ff88',
      wickDownColor: '#ff3b30',
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      }
    });

    // EMA 20
    emaSeriesRef.current = chart.addLineSeries({
      color: '#facc15',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      }
    });

    // Volume histogram
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: 'rgba(0, 255, 136, 0.2)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume-scale', // Separate hidden scale
    });
    
    chart.priceScale('volume-scale').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false, // Hide the volume scale axis numbers
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Fetch and update data
  const loadChart = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSyntheticChartData(symbol, timeframe);
      
      if (!data || data.length === 0) {
        setError(`No data found for ${symbol}/SOL on ${timeframe}.`);
        candleSeriesRef.current?.setData([]);
        emaSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        setLoading(false);
        return;
      }

      // Filter out weird spikes or extreme outliers occasionally caused by synthetic math artifacts at open
      const median = data.map(d => d.close).sort((a,b) => a-b)[Math.floor(data.length/2)];
      const filtered = data.filter(d => d.close > 0 && d.close < median * 10);

      // Candles
      candleSeriesRef.current?.setData(filtered);

      // Volume (color based on candle close)
      const volumeData = filtered.map(d => ({
        time: d.time,
        value: d.value,
        color: d.close >= d.open ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 59, 48, 0.3)'
      }));
      volumeSeriesRef.current?.setData(volumeData);

      // EMA
      const ema = calculateEMA(filtered, 20);
      emaSeriesRef.current?.setData(ema);

      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      console.error(err);
      setError("Failed to load chart data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChart();
  }, [symbol, timeframe]);

  return (
    <div className="adv-charts-container">
      <div className="adv-header">
        <div className="header-title">
          <h2><TrendingUp color="#00ff88" /> PRO SWITCH CHARTS</h2>
          <p>Institutional grade synthetic charts for TOKEN/SOL relative strength.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Pair:</span>
          {defaultTokens.map(t => (
            <button 
              key={t} 
              className={`tool-btn ${symbol === t ? 'active' : ''}`}
              onClick={() => setSymbol(t)}
            >
              {t}/SOL
            </button>
          ))}
          <input 
            type="text" 
            placeholder="Custom" 
            className="custom-input"
            onKeyDown={(e) => {
              if(e.key === 'Enter') {
                setSymbol(e.target.value.toUpperCase());
                e.target.value = '';
              }
            }}
          />
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Timeframe:</span>
          {timeframes.map(tf => (
            <button 
              key={tf} 
              className={`tool-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
        
        <button className="tool-btn refresh" onClick={loadChart} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="chart-wrapper">
        {error && <div className="error-overlay">{error}</div>}
        <div ref={chartContainerRef} className="chart-container" />
      </div>

      <div className="legend">
        <span className="legend-item"><div className="legend-box" style={{ background: '#00ff88' }} /> {symbol}/SOL Price</span>
        <span className="legend-item"><div className="legend-box" style={{ background: '#facc15', height: '2px' }} /> EMA 20</span>
        <span className="legend-item"><div className="legend-box" style={{ background: 'rgba(0,255,136,0.3)' }} /> Volume</span>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .adv-charts-container { padding: 24px; color: #eee; font-family: 'Inter', sans-serif; background: #050505; min-height: 100vh; }
        .adv-header { margin-bottom: 24px; }
        .header-title h2 { margin: 0 0 8px 0; font-size: 1.8rem; display: flex; align-items: center; gap: 8px; }
        .header-title p { margin: 0; color: #888; }
        
        .toolbar { display: flex; gap: 24px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; background: #0a0a0a; padding: 12px 20px; border-radius: 12px; border: 1px solid #1a1a1a; }
        .toolbar-group { display: flex; gap: 8px; align-items: center; }
        .toolbar-label { font-size: 0.8rem; color: #666; font-weight: bold; text-transform: uppercase; margin-right: 8px; }
        
        .tool-btn { background: #111; border: 1px solid #333; color: #aaa; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .tool-btn:hover { background: #222; color: #fff; }
        .tool-btn.active { background: rgba(0,255,136,0.1); border-color: #00ff88; color: #00ff88; }
        .tool-btn.refresh { margin-left: auto; background: rgba(0,210,255,0.1); border-color: rgba(0,210,255,0.3); color: #00d2ff; }
        
        .custom-input { background: #111; border: 1px solid #333; color: #fff; padding: 6px 12px; border-radius: 6px; width: 80px; outline: none; font-weight: bold; }
        .custom-input:focus { border-color: #facc15; }
        
        .chart-wrapper { position: relative; border: 1px solid #1a1a1a; border-radius: 12px; overflow: hidden; background: #050505; }
        .chart-container { width: 100%; height: 500px; }
        
        .error-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(5,5,5,0.8); z-index: 10; font-weight: bold; color: #ff3b30; }
        
        .legend { display: flex; gap: 20px; margin-top: 12px; justify-content: flex-end; font-size: 0.8rem; color: #888; }
        .legend-item { display: flex; align-items: center; gap: 6px; }
        .legend-box { width: 12px; height: 12px; border-radius: 2px; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default AdvancedSwitchCharts;
