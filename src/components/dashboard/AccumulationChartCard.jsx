import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { ArrowUpToLine, ArrowDownToLine } from 'lucide-react';

export const AccumulationChartCard = ({ token }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  
  const { accumData, symbol, klines } = token;
  const { boxHigh, boxLow, rangePct, resistanceTouches, supportTouches, currentPrice, status, preRangeTrend, priceLocation, structure, pressure, accumulationLength } = accumData;

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

    // Mark the start of the accumulation
    if (accumulationLength && klines.length >= accumulationLength) {
      const accumStartKline = klines[klines.length - accumulationLength];
      if (accumStartKline) {
        seriesRef.current.setMarkers([
          {
            time: accumStartKline.time,
            position: 'belowBar',
            color: '#00d0ff',
            shape: 'arrowUp',
            text: 'ACCUM START',
            size: 1
          }
        ]);
      }
    }

    // Draw Resistance (Equal Highs) Line
    seriesRef.current.createPriceLine({
      price: boxHigh,
      color: '#ff3b30',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'RES',
    });

    // Draw Support (Equal Lows) Line
    seriesRef.current.createPriceLine({
      price: boxLow,
      color: '#00ff88',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'SUP',
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
  }, [klines, boxHigh, boxLow]);

  return (
    <div style={{ background: '#0a101d', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {symbol.replace('USDT', '')}
        </h3>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#00d0ff', fontWeight: 'bold' }}>{rangePct.toFixed(1)}% RANGE</div>
          <div style={{ color: '#888', fontSize: '0.7rem' }}>{accumulationLength}H ACCUM</div>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} style={{ width: '100%', height: '200px' }} />

      {/* Stats Footer */}
      <div style={{ padding: '15px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>PRE-RANGE:</span>
          <span style={{ color: preRangeTrend.includes('PUMP') ? '#00ff88' : preRangeTrend.includes('DROP') ? '#ff3b30' : '#888', fontWeight: 'bold' }}>{preRangeTrend}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>STRUCTURE:</span>
          <span style={{ color: structure === 'HIGHER LOWS' ? '#00ff88' : structure === 'LOWER HIGHS' ? '#ff3b30' : '#888', fontWeight: 'bold' }}>{structure}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>PRICE LOCATION:</span>
          <span style={{ color: priceLocation === 'UPPER THIRD' ? '#00ff88' : priceLocation === 'LOWER THIRD' ? '#ff3b30' : '#888', fontWeight: 'bold' }}>{priceLocation}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>PRESSURE:</span>
          <span style={{ color: pressure === 'BUYERS' ? '#00ff88' : pressure === 'SELLERS' ? '#ff3b30' : '#888', fontWeight: 'bold' }}>{pressure}</span>
        </div>

        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          textAlign: 'center',
          background: status.includes('BULLISH') || status.includes('PRE-BREAKOUT') ? 'rgba(0, 255, 136, 0.1)' : status.includes('BEARISH') || status.includes('PRE-BREAKDOWN') ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255,255,255,0.05)',
          color: status.includes('BULLISH') || status.includes('PRE-BREAKOUT') ? '#00ff88' : status.includes('BEARISH') || status.includes('PRE-BREAKDOWN') ? '#ff3b30' : '#888',
          border: `1px solid ${status.includes('BULLISH') || status.includes('PRE-BREAKOUT') ? 'rgba(0, 255, 136, 0.2)' : status.includes('BEARISH') || status.includes('PRE-BREAKDOWN') ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '6px',
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          STATUS: {status}
        </div>
      </div>
    </div>
  );
};
