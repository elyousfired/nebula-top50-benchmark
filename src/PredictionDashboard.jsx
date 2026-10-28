import React, { useState, useEffect, useRef } from 'react';
import { Activity, Target, Navigation, Map, Compass, AlertTriangle, CheckCircle, Crosshair } from 'lucide-react';
import { createChart } from 'lightweight-charts';
import { fetchBybitData } from './logic/scanner';
import { calculateWeeklyOBs } from './logic/weeklyOBLogic';
import { buildRoadmap } from './logic/roadmapEngine';

const RoadmapChart = ({ roadmapData, klinesBase }) => {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !roadmapData || !klinesBase) return;

    const currentPrice = roadmapData.currentPrice;
    let minMove = 0.01;
    let precision = 2;
    if (currentPrice < 0.0001) { precision = 7; minMove = 0.0000001; }
    else if (currentPrice < 0.001) { precision = 6; minMove = 0.000001; }
    else if (currentPrice < 0.1) { precision = 5; minMove = 0.00001; }
    else if (currentPrice < 1) { precision = 4; minMove = 0.0001; }
    else if (currentPrice < 10) { precision = 3; minMove = 0.001; }

    if (!chartInstance.current) {
      const chart = createChart(chartContainerRef.current, {
        height: 600,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
        timeScale: { timeVisible: true, borderVisible: false },
        rightPriceScale: { borderVisible: false },
        localization: {
          priceFormatter: price => price.toFixed(precision)
        }
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
      });

      chartInstance.current = { chart, candleSeries, lineSeriesArr: [], pathSeries: null, pathData: [], pathMarkers: [], precision: 2 };
    }

    chartInstance.current.precision = precision;
    const { chart, candleSeries, lineSeriesArr } = chartInstance.current;
    
    // Dynamically update localization precision on token switch
    chart.applyOptions({
      localization: { priceFormatter: price => price.toFixed(precision) }
    });
    
    // Clear old lines
    lineSeriesArr.forEach(s => chart.removeSeries(s));
    lineSeriesArr.length = 0;

    // Load Candles
    let data = klinesBase.map(k => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4])
    }));
    
    // Lightweight Charts REQUIRES strictly ascending time and no duplicates
    data.sort((a, b) => a.time - b.time);
    data = data.filter((item, pos, ary) => !pos || item.time > ary[pos - 1].time);
    
    // Calculate EMAs
    const calculateEMA = (period) => {
      if (data.length === 0) return [];
      const k = 2 / (period + 1);
      let ema = data[0].close;
      const res = [{ time: data[0].time, value: ema }];
      for (let i = 1; i < data.length; i++) {
        ema = data[i].close * k + ema * (1 - k);
        res.push({ time: data[i].time, value: ema });
      }
      return res;
    };

    const ema20Data = calculateEMA(20);
    const ema50Data = calculateEMA(50);
    
    try {
      candleSeries.setData(data);
      
      const ema20Series = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, crosshairMarkerVisible: false });
      ema20Series.setData(ema20Data);
      
      const ema50Series = chart.addLineSeries({ color: '#f97316', lineWidth: 2, crosshairMarkerVisible: false });
      ema50Series.setData(ema50Data);
      
      lineSeriesArr.push(ema20Series, ema50Series);
    } catch (e) {
      console.error("CandleSeries/EMA setData error:", e);
    }

    // Draw OB Zones
    const { poweredZones } = roadmapData;
    
    const tfColors = {
      '1W': { bull: 'rgba(16, 185, 129, 0.8)', bear: 'rgba(239, 68, 68, 0.8)', width: 3 },
      '1D': { bull: 'rgba(16, 185, 129, 0.5)', bear: 'rgba(239, 68, 68, 0.5)', width: 2 },
      '4H': { bull: 'rgba(16, 185, 129, 0.3)', bear: 'rgba(239, 68, 68, 0.3)', width: 1 },
      '1H': { bull: 'rgba(16, 185, 129, 0.15)', bear: 'rgba(239, 68, 68, 0.15)', width: 1 },
      '15m': { bull: 'rgba(16, 185, 129, 0.05)', bear: 'rgba(239, 68, 68, 0.05)', width: 1 }
    };

    const latestTime = data[data.length - 1].time;

    for (const ob of poweredZones) {
      const style = tfColors[ob.timeframe] || tfColors['4H'];
      const color = ob.type === 'BULLISH' ? style.bull : style.bear;
      
      const topSeries = chart.addLineSeries({ color, lineWidth: style.width, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
      const bottomSeries = chart.addLineSeries({ color, lineWidth: style.width, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
      
      const lineData = data.filter(d => d.time >= Math.floor(ob.startTime / 1000));
      // Extend to future
      const futureData = [...lineData, { time: latestTime + 86400 * 5, value: ob.top }];
      
      topSeries.setData(futureData.map(d => ({ time: d.time, value: ob.top })));
      bottomSeries.setData(futureData.map(d => ({ time: d.time, value: ob.bottom })));
      
      lineSeriesArr.push(topSeries, bottomSeries);
    }

    // Draw Main Path
    if (roadmapData.mainPath && roadmapData.mainPath.length > 0) {
      const pathSeries = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 3,
        lineStyle: 0,
        crosshairMarkerVisible: true,
        lastValueVisible: true,
      });

      let secondsPerCandle = 4 * 3600;
      if (roadmapData.chartTimeframe === '1H') secondsPerCandle = 3600;
      else if (roadmapData.chartTimeframe === '15m') secondsPerCandle = 900;

      const pathData = roadmapData.mainPath.map(p => {
        return {
          time: Math.floor(latestTime + (p.offsetCandles * secondsPerCandle)), 
          value: p.price
        };
      });
      pathSeries.setData(pathData);

      // Add Markers
      const markers = roadmapData.mainPath.map(p => ({
        time: Math.floor(latestTime + (p.offsetCandles * secondsPerCandle)),
        position: 'aboveBar',
        color: '#f59e0b',
        shape: 'circle',
        text: `${p.label} (${p.price.toFixed(precision)})`
      }));
      pathSeries.setMarkers(markers);
      lineSeriesArr.push(pathSeries);

      chartInstance.current.pathSeries = pathSeries;
      chartInstance.current.pathData = pathData;
      chartInstance.current.pathMarkers = markers;
    } else {
      chartInstance.current.pathSeries = null;
      chartInstance.current.pathData = [];
      chartInstance.current.pathMarkers = [];
    }

    // Draw Invalidation Line
    if (roadmapData.invalidation && roadmapData.invalidation.level > 0) {
      const invSeries = chart.addLineSeries({
        color: '#ff3366',
        lineWidth: 2,
        lineStyle: 1, // Dotted
        crosshairMarkerVisible: false,
        lastValueVisible: true,
      });
      invSeries.setData([
        { time: data[data.length - 20]?.time || data[0].time, value: roadmapData.invalidation.level },
        { time: latestTime + 86400 * 5, value: roadmapData.invalidation.level }
      ]);
      lineSeriesArr.push(invSeries);
    }

    chart.timeScale().fitContent();

  }, [roadmapData, klinesBase]);

  // WebSocket Live Updates
  useEffect(() => {
    if (!roadmapData || !roadmapData.symbol || !chartInstance.current) return;
    
    let interval = '240';
    if (roadmapData.chartTimeframe === '1H') interval = '60';
    else if (roadmapData.chartTimeframe === '15m') interval = '15';

    const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [`kline.${interval}.${roadmapData.symbol}`] }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.topic === `kline.${interval}.${roadmapData.symbol}` && msg.data && msg.data.length > 0) {
        const k = msg.data[0];
        const candle = {
          time: Math.floor(Number(k.start) / 1000),
          open: Number(k.open),
          high: Number(k.high),
          low: Number(k.low),
          close: Number(k.close)
        };
        
        try {
          if (chartInstance.current && chartInstance.current.candleSeries) {
            chartInstance.current.candleSeries.update(candle);
            
            // Live Prediction Tracker
            const { pathSeries, pathData, pathMarkers, precision } = chartInstance.current;
            if (pathSeries && pathData && pathData.length > 0) {
              const newData = [...pathData];
              newData[0] = { ...newData[0], value: candle.close };
              pathSeries.setData(newData);
              chartInstance.current.pathData = newData;

              if (pathMarkers && pathMarkers.length > 0) {
                const newMarkers = [...pathMarkers];
                newMarkers[0] = { 
                  ...newMarkers[0], 
                  text: `current (${candle.close.toFixed(precision)})` 
                };
                pathSeries.setMarkers(newMarkers);
                chartInstance.current.pathMarkers = newMarkers;
              }
            }
          }
        } catch (e) {
          console.error("Live update error", e);
        }
      }
    };

    return () => {
      if (ws.readyState === 1) ws.close();
    };
  }, [roadmapData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      
      {roadmapData && (
        <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '400px', zIndex: 10 }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={20} color="#f59e0b" /> 
            {roadmapData.symbol} {roadmapData.chartTimeframe} ROADMAP
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px' }}>Scenario</div>
              <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '0.9rem' }}>{roadmapData.mainScenario.replace(/_/g, ' ').toUpperCase()}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px' }}>Confidence</div>
              <div style={{ color: roadmapData.confidence >= 60 ? '#10b981' : roadmapData.confidence >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 'bold', fontSize: '1.2rem' }}>
                {roadmapData.confidence}%
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#10b981', fontSize: '0.85rem' }}>Support Force: {roadmapData.supportForce.toFixed(1)}</span>
              <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>Resist Force: {roadmapData.resistanceForce.toFixed(1)}</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(roadmapData.supportForce / (roadmapData.supportForce + roadmapData.resistanceForce)) * 100}%`, background: '#10b981' }} />
              <div style={{ width: `${(roadmapData.resistanceForce / (roadmapData.supportForce + roadmapData.resistanceForce)) * 100}%`, background: '#ef4444' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
              <Target size={14} color="#38bdf8" /> Target: {roadmapData.targetZone ? `${roadmapData.targetZone.type} ${roadmapData.targetZone.timeframe || 'Zone'} @ ${roadmapData.targetZone.top.toFixed(4)}` : 'N/A'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
              <AlertTriangle size={14} color="#ff3366" /> Invalidation: {roadmapData.invalidation.rule || 'None'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
              <CheckCircle size={14} color="#10b981" /> Quality: <span style={{ color: '#fff' }}>{roadmapData.quality}</span>
            </div>
          </div>

          <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '8px' }}>Reasons:</div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {roadmapData.reason.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export const PredictionDashboard = () => {
  const [symbol, setSymbol] = useState('SOLUSDT');
  const [baseTf, setBaseTf] = useState('4H');
  const [analyzing, setAnalyzing] = useState(false);
  const [roadmapData, setRoadmapData] = useState(null);
  const [klinesBase, setKlinesBase] = useState(null);

  const analyzeToken = async () => {
    if (!symbol) return;
    setAnalyzing(true);
    setRoadmapData(null);
    setKlinesBase(null);

    try {
      // Fetch multi-timeframe data
      const tfs = [
        { code: 'W', label: '1W' },
        { code: 'D', label: '1D' },
        { code: '240', label: '4H' },
        { code: '60', label: '1H' },
        { code: '15', label: '15m' }
      ];

      const allActiveZones = [];
      let klBase = null;

      for (const tf of tfs) {
        const klines = await fetchBybitData(symbol, tf.code, 500);
        if (!klines || klines.length < 50) continue;

        if (tf.label === baseTf) {
          klBase = klines;
        }

        const obData = calculateWeeklyOBs(klines, tf.label);
        allActiveZones.push(...obData.activeOBs);
      }

      if (klBase && allActiveZones.length > 0) {
        const roadmap = buildRoadmap(symbol, klBase, allActiveZones, baseTf);
        setKlinesBase(klBase);
        setRoadmapData(roadmap);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    analyzeToken();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3rem', margin: 0, background: 'linear-gradient(90deg, #f59e0b, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
          <Map size={40} color="#f59e0b" /> 4H OB ROADMAP ENGINE
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginTop: '10px' }}>
          Probabilistic price routing based on Multi-Timeframe Order Blocks (1W, 1D, 4H, 1H, 15m).
        </p>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '24px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', backdropFilter: 'blur(10px)', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Ex: SOLUSDT"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 20px', borderRadius: '12px', fontSize: '1.1rem', outline: 'none', width: '200px', textAlign: 'center' }}
        />
        
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '4px' }}>
          <button 
            onClick={() => setBaseTf('4H')}
            style={{ background: baseTf === '4H' ? '#f59e0b' : 'transparent', color: baseTf === '4H' ? '#000' : '#888', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            4H
          </button>
          <button 
            onClick={() => setBaseTf('1H')}
            style={{ background: baseTf === '1H' ? '#f59e0b' : 'transparent', color: baseTf === '1H' ? '#000' : '#888', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            1H
          </button>
          <button 
            onClick={() => setBaseTf('15m')}
            style={{ background: baseTf === '15m' ? '#f59e0b' : 'transparent', color: baseTf === '15m' ? '#000' : '#888', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            15m
          </button>
        </div>

        <button 
          onClick={analyzeToken} 
          disabled={analyzing}
          style={{
            background: analyzing ? '#334155' : 'linear-gradient(45deg, #f59e0b, #ec4899)',
            border: 'none', color: '#fff', padding: '12px 30px', borderRadius: '12px',
            fontSize: '1.1rem', fontWeight: 'bold', cursor: analyzing ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.3s'
          }}
        >
          {analyzing ? <Activity className="spin" size={20} /> : <Navigation size={20} />}
          {analyzing ? 'BUILDING ROADMAP...' : 'GENERATE ROADMAP'}
        </button>
      </div>

      {!analyzing && roadmapData && (
        <RoadmapChart roadmapData={roadmapData} klinesBase={klinesBase} />
      )}

      {!analyzing && !roadmapData && klinesBase && (
        <div style={{ textAlign: 'center', color: '#ef4444', marginTop: '2rem' }}>
          Erreur lors du calcul de la roadmap. Vérifiez le token.
        </div>
      )}
    </div>
  );
};

export default PredictionDashboard;
