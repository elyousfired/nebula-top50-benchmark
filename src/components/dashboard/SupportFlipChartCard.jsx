import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { ArrowUpToLine, ArrowDownToLine, ShieldCheck } from 'lucide-react';

export const SupportFlipChartCard = ({ token }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  
  const { symbol, klines, wallPrice, wallValue, wallQty, currentPrice, priceDiffPct, priceChangePct } = token;

  useEffect(() => {
    if (!chartContainerRef.current || !klines || klines.length === 0) return;

    const chartOptions = {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderVisible: false, timeVisible: true, rightOffset: 5 },
      crosshair: { mode: 0 },
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: false }
    };

    chartRef.current = createChart(chartContainerRef.current, chartOptions);
    
    seriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    seriesRef.current.setData(klines.map(k => ({
      time: k.time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close
    })));

    // Draw the massive Buy Wall (Support) Line
    seriesRef.current.createPriceLine({
      price: wallPrice,
      color: '#00ff88',
      lineWidth: 2,
      lineStyle: 0, // Solid line
      axisLabelVisible: true,
      title: 'BUY WALL',
    });

    chartRef.current.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
      const newRect = entries[0].contentRect;
      chartRef.current.applyOptions({ width: newRect.width });
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chartRef.current.remove();
    };
  }, [klines, wallPrice]);

  return (
    <div style={{ background: '#0a101d', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="#00ff88" /> {symbol.replace('USDT', '')}
        </h3>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: priceChangePct > 0 ? '#00ff88' : '#ff3b30', fontWeight: 'bold' }}>
            {priceChangePct > 0 ? '+' : ''}{priceChangePct.toFixed(2)}% (24H)
          </div>
          <div style={{ color: '#888', fontSize: '0.7rem' }}>Pumping</div>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} style={{ width: '100%', height: '200px' }} />

      {/* Stats Footer */}
      <div style={{ padding: '15px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>CURRENT PRICE:</span>
          <span style={{ color: '#fff', fontWeight: 'bold' }}>${currentPrice.toFixed(4)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>BUY WALL LEVEL:</span>
          <span style={{ color: '#00ff88', fontWeight: 'bold' }}>${wallPrice.toFixed(4)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>WALL DISTANCE:</span>
          <span style={{ color: priceDiffPct < 2 ? '#00ff88' : '#f59e0b', fontWeight: 'bold' }}>{priceDiffPct.toFixed(2)}% below price</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>WALL SIZE (USD):</span>
          <span style={{ color: '#00d0ff', fontWeight: 'bold' }}>${wallValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
        </div>

        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          textAlign: 'center',
          background: 'rgba(0, 255, 136, 0.1)',
          color: '#00ff88',
          border: '1px solid rgba(0, 255, 136, 0.2)',
          borderRadius: '6px',
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          STATUS: SUPPORT DEFENDED
        </div>
      </div>
    </div>
  );
};
