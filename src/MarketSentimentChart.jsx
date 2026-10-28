import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export const MarketSentimentChart = ({ data }) => {
  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Create the chart instance
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      timeScale: {
        timeVisible: true,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      height: 400,
    });

    // 1. Net Score Area Series (Market Force)
    const netSeries = chart.addAreaSeries({
      topColor: 'rgba(59, 130, 246, 0.4)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
      lineColor: '#3b82f6',
      lineWidth: 2,
      priceFormat: { type: 'volume' }
    });

    // 2. Gains Line Series (Green)
    const gainsSeries = chart.addLineSeries({
      color: '#00e676',
      lineWidth: 2,
    });

    // 3. Losses Line Series (Red)
    const lossesSeries = chart.addLineSeries({
      color: '#ef4444',
      lineWidth: 2,
    });

    // 4. Liquidations Histogram (Yellow/Orange)
    const liqSeries = chart.addHistogramSeries({
      color: '#f59e0b',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // set as an overlay
      scaleMargins: {
        top: 0.8, // highest point of the series will be at 80% of the chart height
        bottom: 0,
      },
    });

    // Format data
    const sortedData = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    netSeries.setData(sortedData.map(d => ({ time: d.time, value: d.netScore })));
    gainsSeries.setData(sortedData.map(d => ({ time: d.time, value: d.gains })));
    lossesSeries.setData(sortedData.map(d => ({ time: d.time, value: d.losses })));
    liqSeries.setData(sortedData.map(d => ({ time: d.time, value: d.liquidations })));

    chart.timeScale().fitContent();

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
  }, [data]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
        <div style={{ color: '#00e676' }}>● Gains</div>
        <div style={{ color: '#ef4444' }}>● Pertes</div>
        <div style={{ color: '#f59e0b' }}>■ Liquidations</div>
        <div style={{ color: '#3b82f6' }}>🌊 Force du Marché (Net Score)</div>
      </div>
      <div ref={chartContainerRef} style={{ width: '100%' }} />
    </div>
  );
};
