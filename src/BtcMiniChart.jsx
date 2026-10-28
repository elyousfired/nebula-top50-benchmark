import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { fetchSyntheticBtcChartData } from './logic/btcChartEngine';

const BtcMiniChart = ({ symbol }) => {
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
        const data = await fetchSyntheticBtcChartData(symbol, '1d', 1000);
        if (data && data.length > 0) {
          // Filter data starting from October 1st, 2025 (timestamp 1759276800)
          const filteredData = data.filter(k => k.time >= 1759276800);
          
          const chartData = filteredData.map(k => {
            return {
              time: k.time,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
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
        console.error(`Failed to load daily btc mini-chart for ${symbol}`, err);
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
          <div style={{ width: '20px', height: '20px', border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default BtcMiniChart;
