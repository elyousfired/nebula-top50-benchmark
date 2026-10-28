import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const MiniSyntheticChart = ({ data, title }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8b9bb4',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: {
        borderVisible: false,
        autoScale: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          width: 1,
          style: 1,
          labelBackgroundColor: '#1e222d',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          width: 1,
          style: 1,
          labelBackgroundColor: '#1e222d',
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    const lineSeries = chart.addLineSeries({
      color: '#00d2ff',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lineType: 0,
    });

    if (data && data.length > 0) {
      lineSeries.setData(data);
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Add small timeout to ensure container is fully rendered before calculating size
    setTimeout(handleResize, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      height: '300px',
      width: '100%',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 10,
        background: 'rgba(0,0,0,0.5)',
        padding: '4px 8px',
        borderRadius: '4px',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: '14px',
        pointerEvents: 'none'
      }}>
        {title}
      </div>
      <div ref={chartContainerRef} style={{ flex: 1, width: '100%' }} />
    </div>
  );
};

export default MiniSyntheticChart;
