import React, { useState, useEffect, useRef } from 'react';
import { Activity, Flame, LayoutGrid, Target, TrendingUp, BarChart2, RefreshCw, X } from 'lucide-react';
import { createChart } from 'lightweight-charts';
import { fetchMomentumData, analyzeMomentumProfile, buildSyntheticCandles } from './logic/momentumScanner';
import { fetchTop500Symbols, fetchBybitData, fetchBinanceData } from './logic/scanner';
import { detectChannel } from './logic/channelDetector';
import { findBestToken } from './logic/aiAutoPickEngine';
import { generateExplosionStory } from './logic/evolutionEngine';

const MiniChart = ({ data, height = 60, width = 150, color = "#00ff88" }) => {
  const chartRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#d1d5db' },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      width, height,
      timeScale: { visible: false }, rightPriceScale: { visible: false },
      handleScroll: false, handleScale: false
    });
    const series = chart.addAreaSeries({
      lineColor: color, topColor: color + '80', bottomColor: 'transparent', lineWidth: 2
    });
    series.setData(data.map(c => ({ time: c.time, value: c.close })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, width, height, color]);
  return <div ref={chartRef} style={{ width: `${width}px`, height: `${height}px` }} />;
};

const ExplosionTimeline = ({ story }) => {
  if (!story || story.length === 0) return null;
  return (
    <div style={{ marginTop: '24px', background: 'rgba(5, 5, 7, 0.95)', padding: '20px', borderRadius: '16px', border: '1px solid #1F2937' }}>
      <h4 style={{ margin: '0 0 20px 0', color: '#facc15', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🧬</span> TIMELINE D'EXPLOSION (Token vs SOL)
      </h4>
      <div style={{ position: 'relative', paddingLeft: '20px' }}>
        <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '29px', width: '2px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
        {story.map((step, idx) => (
          <div key={idx} style={{ position: 'relative', marginBottom: idx === story.length - 1 ? '0' : '24px', display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <div style={{ position: 'relative', zIndex: 2, width: '20px', height: '20px', borderRadius: '50%', background: idx === story.length - 1 ? '#00ff88' : '#374151', border: '4px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
              {idx === story.length - 1 && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px #00ff88' }}></div>}
            </div>
            <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '12px', border: idx === story.length - 1 ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: idx === story.length - 1 ? '#00ff88' : '#9ca3af', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '1px' }}>{step.label}</span>
                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', color: '#6b7280' }}>{step.state}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>{step.icon}</span> <span style={{ color: '#e5e7eb' }}>{step.trendDesc}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: '#a855f7' }}>📍</span> <span style={{ color: '#e5e7eb' }}>{step.vwapDesc}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: '#3b82f6' }}>🌊</span> <span style={{ color: '#e5e7eb' }}>{step.flowDesc}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>{step.volIcon}</span> <span style={{ color: '#e5e7eb' }}>{step.volumeDesc}</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FourChartsModal = ({ symbol, exchange = 'bybit', baseAsset = 'SOL', tfs, onClose }) => {
  const [showMarkers, setShowMarkers] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showHighs, setShowHighs] = useState(false);
  const [showVwaps, setShowVwaps] = useState(false);
  const refD   = useRef(null);
  const ref240 = useRef(null);
  const ref60  = useRef(null);
  const ref15  = useRef(null);
  const chartRefs = { D: refD, '240': ref240, '60': ref60, '15': ref15 };

  // Store chart series for live updates (never triggers re-render)
  const seriesRefs = useRef({});   // tf → { candle, ema20, ema50 }
  const [explosionStory, setExplosionStory] = useState(null);
  const fetchSymbol = `${symbol}USDT`;

  useEffect(() => {
    if (!tfs) return;
    const instances = [];

    const drawChart = (tf) => {
      const el = chartRefs[tf].current;
      const tfData = tfs[tf];
      if (!el || !tfData || !tfData.candles || tfData.candles.length === 0) return;

      el.innerHTML = '';

      const chart = createChart(el, {
        layout: { background: { type: 'solid', color: '#0a0f1a' }, textColor: '#9ca3af' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        width: el.clientWidth,
        height: el.clientHeight,
        timeScale: { timeVisible: true, borderColor: 'rgba(255,255,255,0.1)', secondsVisible: false },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      });

      const validCandles = tfData.candles
        .filter(c => c.time && isFinite(c.open) && isFinite(c.close))
        .map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));

      if (validCandles.length === 0) return;

      // Determine appropriate precision for small numbers (like BTC pairs)
      const minVal = Math.min(...validCandles.map(c => c.low));
      const maxVal = Math.max(...validCandles.map(c => c.high));
      const val = (maxVal + minVal) / 2;
      
      let precision = 2;
      let minMove = 0.01;
      if (val < 0.000000001) { precision = 12; minMove = 0.000000000001; }
      else if (val < 0.00000001) { precision = 11; minMove = 0.00000000001; }
      else if (val < 0.0000001) { precision = 10; minMove = 0.0000000001; }
      else if (val < 0.000001) { precision = 9; minMove = 0.000000001; }
      else if (val < 0.00001) { precision = 8; minMove = 0.00000001; }
      else if (val < 0.0001) { precision = 7; minMove = 0.0000001; }
      else if (val < 0.001) { precision = 6; minMove = 0.000001; }
      else if (val < 0.01) { precision = 5; minMove = 0.00001; }
      else if (val < 0.1) { precision = 4; minMove = 0.0001; }
      else if (val < 1) { precision = 3; minMove = 0.001; }

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#00ff88', downColor: '#ff3b30',
        borderVisible: false,
        wickUpColor: '#00ff88', wickDownColor: '#ff3b30',
        priceFormat: {
          type: 'price',
          precision: precision,
          minMove: minMove,
        }
      });

      candleSeries.setData(validCandles);

      // Add HH / HL markers based on structure pivots
      let markers = [];
      if (tfData.structure?.pivots) {
        let lastH = null;
        let lastL = null;
        
        const sortedPivots = [...tfData.structure.pivots].sort((a, b) => a.time - b.time);
        for (const p of sortedPivots) {
          if (p.type === 'H') {
            const isHH = lastH !== null && p.value > lastH;
            const text = lastH === null ? 'H' : (isHH ? 'HH' : 'LH');
            const color = isHH ? '#00ff88' : '#ff3b30';
            markers.push({
              time: p.time,
              position: 'aboveBar',
              color: color,
              shape: 'arrowDown',
              text: text
            });
            lastH = p.value;
          } else {
            const isHL = lastL !== null && p.value > lastL;
            const text = lastL === null ? 'L' : (isHL ? 'HL' : 'LL');
            const color = isHL ? '#00ff88' : '#ff3b30';
            markers.push({
              time: p.time,
              position: 'belowBar',
              color: color,
              shape: 'arrowUp',
              text: text
            });
            lastL = p.value;
          }
        }
        
        if (markers.length > 0 && showMarkers) {
          candleSeries.setMarkers(markers);
        }
      }

      // EMA overlays
      const closes = tfData.candles.filter(c => isFinite(c.close)).map(c => c.close);
      const times  = tfData.candles.filter(c => isFinite(c.close)).map(c => c.time);
      const calcEma = (period) => {
        const k = 2 / (period + 1);
        let ema = closes[0];
        return closes.map((c, i) => {
          ema = i === 0 ? c : c * k + ema * (1 - k);
          return { time: times[i], value: ema };
        });
      };

      const ema20Series = chart.addLineSeries({ color: '#00d0ff', lineWidth: 1, priceLineVisible: false });
      const ema50Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false });
      ema20Series.setData(calcEma(20));
      ema50Series.setData(calcEma(50));

      // Channels
      const channelData = detectChannel(validCandles);
      const upperSeries = chart.addLineSeries({ color: 'rgba(255, 59, 48, 0.8)', lineWidth: 2, lineStyle: 2, priceLineVisible: false });
      const lowerSeries = chart.addLineSeries({ color: 'rgba(0, 255, 136, 0.8)', lineWidth: 2, lineStyle: 2, priceLineVisible: false });
      const midSeries = chart.addLineSeries({ color: 'rgba(200, 200, 200, 0.4)', lineWidth: 1, lineStyle: 3, priceLineVisible: false });
      
      const upperLineData = [];
      const lowerLineData = [];
      const midLineData = [];

      if (channelData && channelData.slope !== undefined) {
         const N = channelData.candles.length;
         const { slope, b_upper, b_lower, b_mid } = channelData;
         for (let i = 0; i < N; i++) {
           upperLineData.push({ time: channelData.candles[i].time, value: slope * i + b_upper });
           lowerLineData.push({ time: channelData.candles[i].time, value: slope * i + b_lower });
           midLineData.push({ time: channelData.candles[i].time, value: slope * i + b_mid });
         }
         
         if (showChannels) {
           upperSeries.setData(upperLineData);
           lowerSeries.setData(lowerLineData);
           midSeries.setData(midLineData);
         }
      }

      // Zone A and Zone B lines
      const zoneASeries = chart.addLineSeries({ color: 'rgba(0, 255, 136, 1)', lineWidth: 1, lineStyle: 3, priceLineVisible: false });
      const zoneBSeries = chart.addLineSeries({ color: 'rgba(255, 204, 0, 1)', lineWidth: 1, lineStyle: 3, priceLineVisible: false });
      
      const zoneAData = [];
      const zoneBData = [];
      
      if (tfData.structure && tfData.structure.previousHigh && tfData.structure.lastLow) {
         for (let i = 0; i < validCandles.length; i++) {
           zoneAData.push({ time: validCandles[i].time, value: tfData.structure.previousHigh.value });
           zoneBData.push({ time: validCandles[i].time, value: tfData.structure.lastLow.value });
         }
         if (showZones) {
           zoneASeries.setData(zoneAData);
           zoneBSeries.setData(zoneBData);
         }
      }

      // fitContent ONLY once at init — never on updates so zoom stays put
      chart.timeScale().fitContent();
      instances.push(chart);

      if (tf === '60') {
        const story = generateExplosionStory(validCandles);
        if (story) setExplosionStory(story);
      }

      // Store refs for live updates
      seriesRefs.current[tf] = { 
        candle: candleSeries, 
        ema20: ema20Series, 
        ema50: ema50Series, 
        upper: upperSeries, lower: lowerSeries, mid: midSeries,
        upperData: upperLineData, lowerData: lowerLineData, midData: midLineData,
        zoneA: zoneASeries, zoneB: zoneBSeries,
        zoneAData, zoneBData,
        lastEma20: calcEma(20).at(-1)?.value, 
        lastEma50: calcEma(50).at(-1)?.value, 
        markers,
        priceLinesData: (() => {
          const gl = tfs.globalLevels;
          if (!gl) return {};
          return {
            pdh: gl.PDH ? { price: gl.PDH, color: '#facc15', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'PDH' } : null,
            pwh: gl.PWH ? { price: gl.PWH, color: '#fb923c', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'PWH' } : null,
            pmh: gl.PMH ? { price: gl.PMH, color: '#ef4444', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: 'PMH' } : null,
            pvwap_d: gl.PVWAP_D ? { price: gl.PVWAP_D, color: '#c084fc', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'PVWAP-D' } : null,
            pvwap_w: gl.PVWAP_W ? { price: gl.PVWAP_W, color: '#a855f7', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'PVWAP-W' } : null,
            pvwap_m: gl.PVWAP_M ? { price: gl.PVWAP_M, color: '#9333ea', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: 'PVWAP-M' } : null,
          };
        })(),
        activePriceLines: []
      };
    };

    const timer = setTimeout(() => {
      ['D', '240', '60', '15'].forEach(tf => drawChart(tf));

      // ── LIVE UPDATE every 5 seconds ──
      const liveInterval = setInterval(async () => {
        try {
          const TF_MAP = { D: 'D', '240': '240', '60': '60', '15': '15' };
          await Promise.all(Object.keys(TF_MAP).map(async (tf) => {
            const ref = seriesRefs.current[tf];
            if (!ref) return;

            // Fetch last 2 klines for token and SOL in parallel
            const binanceInterval = TF_MAP[tf] === 'D' ? '1d' : TF_MAP[tf] === '240' ? '4h' : TF_MAP[tf] === '60' ? '1h' : '15m';
            const tokFetch = exchange === 'binance' 
              ? fetch(`https://api.binance.com/api/v3/klines?symbol=${fetchSymbol}&interval=${binanceInterval}&limit=2&_t=${Date.now()}`).then(r => r.json())
              : fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${fetchSymbol}&interval=${TF_MAP[tf]}&limit=2&_t=${Date.now()}`).then(r => r.json());

            let baseFetch;
            if (baseAsset === 'USDT') {
              baseFetch = Promise.resolve(null);
            } else {
              const bSymbol = `${baseAsset}USDT`;
              baseFetch = exchange === 'binance'
                ? fetch(`https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=${binanceInterval}&limit=2&_t=${Date.now()}`).then(r => r.json())
                : fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${bSymbol}&interval=${TF_MAP[tf]}&limit=2&_t=${Date.now()}`).then(r => r.json());
            }

            const [tokRes, baseRes] = await Promise.all([tokFetch, baseFetch]);

            let tk, sl = [0, 1, 1, 1, 1, 0, 0];
            if (exchange === 'binance') {
              if (!tokRes?.length) return;
              // Binance returns oldest first, so newest is the last element
              tk = tokRes[tokRes.length - 1];
              if (baseAsset !== 'USDT') {
                if (!baseRes?.length) return;
                sl = baseRes[baseRes.length - 1];
              }
            } else {
              const tokList = tokRes?.result?.list;
              if (!tokList?.length) return;
              // Bybit returns newest first, so newest is index 0
              tk = tokList[0];
              if (baseAsset !== 'USDT') {
                const baseList = baseRes?.result?.list;
                if (!baseList?.length) return;
                sl = baseList[0];
              }
            }

            const synth = {
              time:  Math.floor(Number(tk[0]) / 1000),
              open:  Number(tk[1]) / (Number(sl[1]) || 1),
              high:  Number(tk[2]) / (Number(sl[3]) || 1), // cross-division
              low:   Number(tk[3]) / (Number(sl[2]) || 1),
              close: Number(tk[4]) / (Number(sl[4]) || 1),
            };
            synth.high = Math.max(synth.high, synth.open, synth.close);
            synth.low  = Math.min(synth.low,  synth.open, synth.close);

            if (!isFinite(synth.close) || synth.close <= 0) return;

            // Update candle WITHOUT resetting zoom
            ref.candle.update(synth);

            // Update EMA20 (fast update: blend last value)
            const k20 = 2 / 21, k50 = 2 / 51;
            ref.lastEma20 = synth.close * k20 + (ref.lastEma20 || synth.close) * (1 - k20);
            ref.lastEma50 = synth.close * k50 + (ref.lastEma50 || synth.close) * (1 - k50);
            ref.ema20.update({ time: synth.time, value: ref.lastEma20 });
            ref.ema50.update({ time: synth.time, value: ref.lastEma50 });
          }));
        } catch (_) { /* silent — live update failure is non-critical */ }
      }, 5000);

      instances._liveInterval = liveInterval;
    }, 150);

    return () => {
      clearTimeout(timer);
      if (instances._liveInterval) clearInterval(instances._liveInterval);
      instances.forEach(c => { try { c.remove(); } catch(_) {} });
      seriesRefs.current = {};
    };
  }, [tfs]);

  useEffect(() => {
    Object.keys(seriesRefs.current).forEach(tf => {
      const ref = seriesRefs.current[tf];
      if (ref && ref.candle && ref.markers) {
        ref.candle.setMarkers(showMarkers ? ref.markers : []);
      }
    });
  }, [showMarkers]);

  useEffect(() => {
    Object.keys(seriesRefs.current).forEach(tf => {
      const ref = seriesRefs.current[tf];
      if (ref && ref.upper && ref.lower && ref.mid) {
        ref.upper.setData(showChannels ? ref.upperData : []);
        ref.lower.setData(showChannels ? ref.lowerData : []);
        ref.mid.setData(showChannels ? ref.midData : []);
      }
    });
  }, [showChannels]);

  useEffect(() => {
    Object.keys(seriesRefs.current).forEach(tf => {
      const ref = seriesRefs.current[tf];
      if (ref && ref.zoneA && ref.zoneB) {
        ref.zoneA.setData(showZones ? ref.zoneAData : []);
        ref.zoneB.setData(showZones ? ref.zoneBData : []);
      }
    });
  }, [showZones]);

  useEffect(() => {
    Object.keys(seriesRefs.current).forEach(tf => {
      const ref = seriesRefs.current[tf];
      if (ref && ref.candle && ref.priceLinesData) {
        ref.activePriceLines.forEach(l => ref.candle.removePriceLine(l));
        ref.activePriceLines = [];

        if (showHighs) {
          if (ref.priceLinesData.pdh) ref.activePriceLines.push(ref.candle.createPriceLine(ref.priceLinesData.pdh));
          if (ref.priceLinesData.pwh) ref.activePriceLines.push(ref.candle.createPriceLine(ref.priceLinesData.pwh));
          if (ref.priceLinesData.pmh) ref.activePriceLines.push(ref.candle.createPriceLine(ref.priceLinesData.pmh));
        }
        if (showVwaps) {
          if (ref.priceLinesData.pvwap_d) ref.activePriceLines.push(ref.candle.createPriceLine(ref.priceLinesData.pvwap_d));
          if (ref.priceLinesData.pvwap_w) ref.activePriceLines.push(ref.candle.createPriceLine(ref.priceLinesData.pvwap_w));
          if (ref.priceLinesData.pvwap_m) ref.activePriceLines.push(ref.candle.createPriceLine(ref.priceLinesData.pvwap_m));
        }
      }
    });
  }, [showHighs, showVwaps]);

  const tfKeys = ['D', '240', '60', '15'];
  const tfLabels = { D: '1D Macro', '240': '4H Swing', '60': '1H Confirmation', '15': '15M Execution' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#e2e8f0' }}>
            <span style={{ color: '#00ff88' }}>{symbol}</span>/{baseAsset} — 4 Timeframes
          </h2>
          <button
            onClick={() => setShowMarkers(!showMarkers)}
            style={{ marginLeft: '15px', background: showMarkers ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${showMarkers ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.12)'}`, color: showMarkers ? '#00ff88' : '#9ca3af', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', transition: 'all 0.2s' }}
          >
            {showMarkers ? 'Hide HH/HL' : 'Show HH/HL'}
          </button>
          <button
            onClick={() => setShowChannels(!showChannels)}
            style={{ marginLeft: '10px', background: showChannels ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${showChannels ? 'rgba(255,59,48,0.4)' : 'rgba(255,255,255,0.12)'}`, color: showChannels ? '#ff3b30' : '#9ca3af', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', transition: 'all 0.2s' }}
          >
            {showChannels ? 'Hide Channels' : 'Show Channels'}
          </button>
          <button
            onClick={() => setShowZones(!showZones)}
            style={{ marginLeft: '10px', background: showZones ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${showZones ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255,255,255,0.12)'}`, color: showZones ? '#00ff88' : '#9ca3af', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', transition: 'all 0.2s' }}
          >
            {showZones ? 'Hide Zones A/B' : 'Show Zones A/B'}
          </button>
          <button
            onClick={() => setShowHighs(!showHighs)}
            style={{ marginLeft: '10px', background: showHighs ? 'rgba(250, 204, 21, 0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${showHighs ? 'rgba(250, 204, 21, 0.4)' : 'rgba(255,255,255,0.12)'}`, color: showHighs ? '#facc15' : '#9ca3af', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', transition: 'all 0.2s' }}
          >
            {showHighs ? 'Hide PDH/PWH/PMH' : 'Show PDH/PWH/PMH'}
          </button>
          <button
            onClick={() => setShowVwaps(!showVwaps)}
            style={{ marginLeft: '10px', background: showVwaps ? 'rgba(192, 132, 252, 0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${showVwaps ? 'rgba(192, 132, 252, 0.4)' : 'rgba(255,255,255,0.12)'}`, color: showVwaps ? '#c084fc' : '#9ca3af', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', transition: 'all 0.2s' }}
          >
            {showVwaps ? 'Hide Prev VWAPs' : 'Show Prev VWAPs'}
          </button>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
        >
          ✕ Close
        </button>
      </div>

      {/* 2×2 Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '12px', flex: 1, minHeight: 0 }}>
        {tfKeys.map(tf => (
          <div key={tf} style={{ background: '#0a0f1a', borderRadius: '10px', border: '1px solid rgba(0,255,136,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', letterSpacing: '0.8px' }}>{tfLabels[tf]}</span>
              {tfs[tf]?.score != null && (
                <span style={{ marginLeft: '10px', fontSize: '0.7rem', color: tfs[tf].score >= 60 ? '#00ff88' : '#f59e0b', fontWeight: '700' }}>
                  Score {tfs[tf].score}
                </span>
              )}
            </div>
            <div ref={chartRefs[tf]} style={{ flex: 1, width: '100%', minHeight: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
};


const MomentumStreaksScanner = ({ tokens, goldenTokens, setGoldenTokens, handleTokenClick }) => {
  const clearGoldenTokens = () => {
    if (setGoldenTokens) setGoldenTokens([]);
  };
  const [baseAsset, setBaseAsset] = useState('SOL');
  const baseAssetRef = useRef('SOL');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [expandedRow, setExpandedRow] = useState(null);
  const [fourChartsModal, setFourChartsModal] = useState(null);
  const [solError, setSolError] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Click "Start Scan" to begin');
  const [tradeModal, setTradeModal] = useState(null); // { symbol, exchange, entrySolPriceUsdt, entryTokenPriceUsdt }
  const [tradeAmount, setTradeAmount] = useState(1);
  const [aiWinner, setAiWinner] = useState(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiDetailsModal, setAiDetailsModal] = useState(false);
  const scanIdRef = useRef(0);
  const tokenListRef = useRef([]); 
  const hasStarted = useRef(false);
  const isScanningRef = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const init = async () => {
      setStatusMsg('Loading top 500 tokens...');
      setLoading(true);
      try {
        const top500 = await fetchTop500Symbols(true);
        tokenListRef.current = top500.filter(t => !t.symbol.includes('SOL')).map(t => ({ symbol: t.symbol, exchange: t.exchange || 'bybit' }));
        setStatusMsg(`Ready. ${tokenListRef.current.length} tokens loaded. Click Refresh to scan.`);
      } catch(e) {
        setStatusMsg('Failed to load token list. Please refresh.');
      }
      setLoading(false);
      performScan(); 
      setInterval(() => {
        if (!isScanningRef.current) {
          performScan();
        }
      }, 120000); // Scan automatiquement chaque 2 minutes
    };
    init();
  }, []); 

  const performScan = async (targetBaseAsset = baseAssetRef.current) => {
    const myTokens = tokenListRef.current;
    if (!myTokens || myTokens.length === 0) {
      setStatusMsg('Token list not ready yet.');
      return;
    }
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    try {
      const currentScanId = ++scanIdRef.current;
      setLoading(true);
      setSolError(false);
      setResults([]);
      setAiWinner(null);
      setProgress({ done: 0, total: myTokens.length });
      setStatusMsg(`Pre-loading ${targetBaseAsset} data...`);

      let baseLoaded = false;
      if (targetBaseAsset === 'USDT') {
        baseLoaded = true;
      } else {
        try {
          const baseData = await fetchMomentumData(`${targetBaseAsset}USDT`);
          if (baseData && baseData['240'] && !baseData['240'].invalid) {
            baseLoaded = true;
          }
        } catch (e) {
          console.error(`Failed to pre-fetch ${targetBaseAsset} data`, e);
        }
      }

      if (!baseLoaded) {
        setSolError(true);
        setLoading(false);
        return;
      }

      const BATCH_SIZE = 10;
      const allRes = [];
      let completedCount = 0;

      for (let i = 0; i < myTokens.length; i += BATCH_SIZE) {
        if (scanIdRef.current !== currentScanId) return; 
        const batch = myTokens.slice(i, i + BATCH_SIZE);

        const promises = batch.map(async (tok) => {
          try {
            const targetSuffix = targetBaseAsset === 'USDT' ? 'USDT' : `${targetBaseAsset}USDT`;
            const data = await fetchMomentumData(tok.symbol, tok.exchange, targetSuffix);
            if (!data || !data['240'] || data['240'].invalid) {
              return null;
            }
            const profile = analyzeMomentumProfile(data);
            return { symbol: tok.symbol, exchange: tok.exchange, data, profile };
          } catch(e) {
            return null;
          } finally {
            completedCount++;
            setProgress(prev => ({ ...prev, done: completedCount }));
          }
        });

        const batchResults = await Promise.all(promises);
        batchResults.forEach(r => { if(r) allRes.push(r); });

        if (i + BATCH_SIZE < myTokens.length) await new Promise(res => setTimeout(res, 150));
      }

      const sortedRes = allRes.sort((a, b) => b.profile.overallScore - a.profile.overallScore).slice(0, 50);
      setResults(sortedRes);
      
      // Auto-save to GOLDEN TOKENS if score >= 80 and net flow > 0
      if (setGoldenTokens) {
        setGoldenTokens(prev => {
          let newGolden = [...(prev || [])];
          let updated = false;
          sortedRes.forEach(item => {
            const score = item.profile.overallScore;
            let netFlow24h = 0;
            const candles60 = item.data['60'];
            if (candles60 && !candles60.invalid && candles60.size > 0) {
              const nowTime = Date.now() / 1000;
              for (const k of candles60.values()) {
                if (nowTime - k.time <= 86400) {
                  const move = (k.close - k.open) / k.open;
                  // Handle synthetic turnover if volume is already in SOL or USDT
                  const turnover = k.turnover || (k.volume * k.close);
                  netFlow24h += turnover * move;
                }
              }
            }

            if (score >= 80 && netFlow24h > 0) {
               const exists = newGolden.find(g => g.symbol === item.symbol && (Date.now() - g.timestamp < 3600000));
               if (!exists) {
                 newGolden.unshift({ symbol: item.symbol, score: score, netFlow: netFlow24h, timestamp: Date.now() });
                 updated = true;
               }
            }
          });
          if (updated) {
            newGolden = newGolden.sort((a,b) => b.score - a.score).slice(0, 50);
            localStorage.setItem('nebula_golden_tokens', JSON.stringify(newGolden));
            return newGolden;
          }
          return prev;
        });
      }

      setStatusMsg(`Scan complete. ${allRes.length} tokens found.`);
      setLoading(false);
    } catch (e) {
      console.error('Scan failed:', e);
      setStatusMsg('Scan error occurred.');
      setLoading(false);
    } finally {
      isScanningRef.current = false;
    }
  };

  useEffect(() => {
    if (!loading && results.length > 0 && !aiWinner && !isAnalyzingAI) {
      const runAI = async () => {
        setIsAnalyzingAI(true);
        setStatusMsg("AI Analyzing Top 10 for best setup...");
        const top10 = results.slice(0, 10).map(r => ({ ...r, score: r.profile.overallScore }));
        const winner = await findBestToken(top10);
        setAiWinner(winner);
        setIsAnalyzingAI(false);
        setStatusMsg(`Scan complete. AI selected ${winner ? winner.symbol : 'none'}.`);
      };
      runAI();
    }
  }, [loading, results, aiWinner, isAnalyzingAI]);


  const getStateColor = (state) => {
    switch (state) {
      case 'STRONG': return '#00ff88';
      case 'BUILDING': return '#00d0ff';
      case 'EARLY': return '#3b82f6';
      case 'NEUTRAL': return '#888';
      case 'FADING': return '#f59e0b';
      case 'BEARISH': return '#ff3b30';
      default: return '#555';
    }
  };

  const getScoreGradient = (score) => {
    if (score >= 75) return 'linear-gradient(135deg, #00ff88, #00d0aa)';
    if (score >= 60) return 'linear-gradient(135deg, #00d0ff, #0080ff)';
    if (score >= 45) return 'linear-gradient(135deg, #f59e0b, #f97316)';
    return 'linear-gradient(135deg, #6b7280, #4b5563)';
  };

  const getActionStyle = (action) => {
    if (action === 'WATCH_FOR_ENTRY') return { color: '#00ff88', bg: 'rgba(0,255,136,0.12)', border: 'rgba(0,255,136,0.3)' };
    if (action.includes('ZONE')) return { color: '#00d0ff', bg: 'rgba(0,208,255,0.12)', border: 'rgba(0,208,255,0.3)' };
    if (action === 'WAIT_FOR_PULLBACK') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
    if (action === 'AVOID') return { color: '#ff3b30', bg: 'rgba(255,59,48,0.12)', border: 'rgba(255,59,48,0.3)' };
    return { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' };
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ background: 'linear-gradient(180deg, #050d12 0%, #080f15 100%)', minHeight: '100vh', padding: '0 0 40px 0', fontFamily: "'Inter', sans-serif" }}>

      {/* ─── HEADER ─── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.08) 0%, rgba(0,160,255,0.06) 100%)', borderBottom: '1px solid rgba(0,255,136,0.15)', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #00ff88, #00d0aa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={20} color="#000" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', background: 'linear-gradient(90deg, #00ff88, #00d0ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Momentum Streaks VS {baseAsset}
              </h2>
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>
              {loading ? statusMsg : results.length > 0 ? `${results.length} tokens ranked by relative strength against ${baseAsset}` : statusMsg}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
              <button
                onClick={() => {
                  setBaseAsset('SOL');
                  baseAssetRef.current = 'SOL';
                  performScan('SOL');
                }}
                style={{
                  background: baseAsset === 'SOL' ? 'rgba(0,255,136,0.15)' : 'transparent',
                  color: baseAsset === 'SOL' ? '#00ff88' : '#9ca3af',
                  border: 'none', padding: '6px 12px', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                ⚡ VS SOL
              </button>
              <button
                onClick={() => {
                  setBaseAsset('USDT');
                  baseAssetRef.current = 'USDT';
                  performScan('USDT');
                }}
                style={{
                  background: baseAsset === 'USDT' ? 'rgba(0,208,255,0.15)' : 'transparent',
                  color: baseAsset === 'USDT' ? '#00d0ff' : '#9ca3af',
                  border: 'none', padding: '6px 12px', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                💵 VS USDT
              </button>
              <button
                onClick={() => {
                  setBaseAsset('BTC');
                  baseAssetRef.current = 'BTC';
                  performScan('BTC');
                }}
                style={{
                  background: baseAsset === 'BTC' ? 'rgba(247,147,26,0.15)' : 'transparent',
                  color: baseAsset === 'BTC' ? '#f7931a' : '#9ca3af',
                  border: 'none', padding: '6px 12px', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                ₿ VS BTC
              </button>
            </div>
            <button
              onClick={() => performScan()}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.85rem', background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00ff88, #00c070)', color: loading ? '#555' : '#000', transition: 'all 0.2s' }}
            >
              <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? `${progress.done} / ${progress.total}` : 'Refresh Scan'}
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #00ff88, #00d0ff)', borderRadius: '99px', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#4b5563' }}>{pct}% complete</div>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 32px' }}>
        
        {/* GOLDEN TOKENS TABLE */}
        <div className="momentum-table" style={{ background: 'rgba(255, 184, 0, 0.05)', borderRadius: '16px', border: '1px solid rgba(255,184,0,0.3)', padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: '#FFB800', fontWeight: '900', letterSpacing: '1px' }}>🏆 GOLDEN SIGNALS (SCORE 80+)</h4>
            <button onClick={clearGoldenTokens} style={{ background: 'transparent', border: '1px solid rgba(255,184,0,0.5)', color: '#FFB800', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>CLEAR</button>
          </div>
          
          {(!goldenTokens || goldenTokens.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#888', fontStyle: 'italic', fontSize: '0.9rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
              ⏳ SCAN AUTOMATIQUE EN ARRIÈRE-PLAN EN COURS...<br/>
              <span style={{ fontSize: '0.8rem' }}>Aucun token avec Score &gt;= 80 et Net Flow positif n'a été détecté pour le moment.</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.5rem' }}>
              {[...goldenTokens].sort((a, b) => b.score - a.score).map((t, i) => (
                <div key={`${t.symbol}_${t.timestamp}`} onClick={() => handleTokenClick && handleTokenClick(t.symbol)} style={{
                  background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.3)',
                  borderRadius: '12px', padding: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px',
                  boxShadow: '0 4px 15px rgba(255,184,0,0.1)', transition: 'all 0.2s'
                }} onMouseOver={e => e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform='none'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: '900', color: '#fff' }}>{t.symbol.replace('USDT', '')}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '900', color: '#FFB800' }}>{t.score} PTS</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Flow: {t.netFlow > 0 ? '+' : ''}{(t.netFlow / 1000).toFixed(1)}k</span>
                    <span>{new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {solError ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#ff3b30' }}>
            <Activity size={36} style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>API Rate Limit — Please wait 5 minutes</div>
          </div>
        ) : loading && results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#4b5563' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚡</div>
            <div style={{ color: '#00ff88', fontWeight: '600' }}>Building Synthetic VS {baseAsset} candles...</div>
            <div style={{ marginTop: '6px', fontSize: '0.8rem' }}>{progress.done} / {progress.total} tokens</div>
          </div>
        ) : !loading && results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
            <div style={{ color: '#6b7280', marginBottom: '16px' }}>{statusMsg}</div>
            <button onClick={performScan} style={{ padding: '12px 28px', borderRadius: '10px', background: 'linear-gradient(135deg,#00ff88,#00c070)', color: '#000', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>▶ Start Scan</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['RANK', 'PAIR', 'SCORE', '15M', '1H', '4H', '1D', 'STREAK (4H)', 'STATE', 'SIGNAL'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#4b5563', fontWeight: '700', fontSize: '0.7rem', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => {
                  const actionStyle = getActionStyle(r.profile.action);
                  const isExpanded = expandedRow === r.symbol;
                  const score = r.profile.overallScore;
                  return (
                    <React.Fragment key={r.symbol}>
                        <tr
                          onClick={() => {
                            setExpandedRow(isExpanded ? null : r.symbol);
                            if (aiWinner && aiWinner.symbol === r.symbol && !isExpanded) {
                              setAiDetailsModal(aiWinner);
                            }
                          }}
                          style={{ 
                            cursor: 'pointer', 
                            borderBottom: '1px solid rgba(255,255,255,0.04)', 
                            border: aiWinner && aiWinner.symbol === r.symbol ? '2px solid #fbbf24' : undefined,
                            boxShadow: aiWinner && aiWinner.symbol === r.symbol ? '0 0 15px rgba(251,191,36,0.2)' : 'none',
                            background: isExpanded || (aiWinner && aiWinner.symbol === r.symbol) ? 'rgba(251,191,36,0.05)' : 'transparent', 
                            transition: 'all 0.15s' 
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.background = isExpanded || (aiWinner && aiWinner.symbol === r.symbol) ? 'rgba(251,191,36,0.05)' : 'transparent'}
                        >
                        <td style={{ padding: '14px', color: '#4b5563', fontWeight: '700', fontSize: '0.75rem' }}>#{idx + 1}</td>
                        <td style={{ padding: '14px', fontWeight: '800', color: '#e2e8f0', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                          {r.symbol.replace('USDT', '')}<span style={{ color: '#00ff88' }}>{baseAsset === 'USDT' ? '' : `/${baseAsset}`}</span>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', background: getScoreGradient(score), fontWeight: '900', fontSize: '1rem', color: '#000' }}>
                            {score}
                          </div>
                        </td>
                        {['15', '60', '240', 'D'].map(tf => {
                          const s = r.data[tf]?.score || 0;
                          const c = s >= 65 ? '#00ff88' : s >= 50 ? '#00d0ff' : s >= 35 ? '#f59e0b' : '#4b5563';
                          return (
                            <td key={tf} style={{ padding: '14px' }}>
                              <span style={{ color: c, fontWeight: '700' }}>{s}</span>
                            </td>
                          );
                        })}
                        <td style={{ padding: '14px' }}>
                          {r.data['240']?.streakDuration?.candles > 0 ? (
                            <span style={{ background: 'rgba(0,255,136,0.12)', color: '#00ff88', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', border: '1px solid rgba(0,255,136,0.2)' }}>
                              🔥 {r.data['240'].streakDuration.candles}
                            </span>
                          ) : <span style={{ color: '#374151' }}>—</span>}
                        </td>
                        <td style={{ padding: '14px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', color: getStateColor(r.data['240']?.state), background: `${getStateColor(r.data['240']?.state)}18`, border: `1px solid ${getStateColor(r.data['240']?.state)}40` }}>
                            {r.data['240']?.state || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', color: actionStyle.color, background: actionStyle.bg, border: `1px solid ${actionStyle.border}`, whiteSpace: 'nowrap' }}>
                            {r.profile.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="10" style={{ padding: '0', background: 'rgba(0,0,0,0.4)' }}>
                            <div style={{ padding: '20px 28px', display: 'flex', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid rgba(0,255,136,0.1)' }}>
                              <div style={{ flex: 1, minWidth: '260px' }}>
                                <div style={{ fontSize: '0.7rem', color: '#4b5563', fontWeight: '700', letterSpacing: '0.8px', marginBottom: '8px' }}>AI ANALYSIS (RELATIVE TO {baseAsset})</div>
                                <div style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: '1.6', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  {r.profile.reason || 'No reason provided.'}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '12px' }}>
                                  {[
                                    { label: '4H Vol Ratio', value: `${r.data['240']?.volRatio?.toFixed(2)}x` },
                                    { label: `4H RSI vs ${baseAsset}`, value: r.data['240']?.rsi?.toFixed(1) },
                                    { label: '4H Structure', value: r.data['240']?.structureBullish ? '✅ BULLISH' : r.data['240']?.structureBearish ? '❌ BEARISH' : '⚡ MIXED' },
                                  ].map(({ label, value }) => (
                                    <div key={label} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                      <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
                                      <div style={{ fontSize: '1rem', fontWeight: '700', color: '#e2e8f0' }}>{value}</div>
                                    </div>
                                  ))}
                                </div>

                                {(() => {
                                   if (!r.data['60']?.candles) {
                                     return <div style={{ color: 'red', marginTop: '10px' }}>No 60m candles available for {r.symbol}</div>;
                                   }
                                   const story = generateExplosionStory(r.data['60'].candles);
                                   if (!story) {
                                     return <div style={{ color: 'orange', marginTop: '10px' }}>Not enough data to generate story for {r.symbol} (Candles: {r.data['60'].candles.length})</div>;
                                   }
                                   return <ExplosionTimeline story={story} />;
                                })()}
                              </div>
                              <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '0.7rem', color: '#4b5563', fontWeight: '700', letterSpacing: '0.8px' }}>4H TREND VS {baseAsset}</div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  <MiniChart data={r.data['240']?.candles?.slice(-40)} height={80} width={196} color={r.data['240']?.score >= 50 ? '#00ff88' : '#ff3b30'} />
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setFourChartsModal(r); }}
                                  style={{ padding: '10px', background: 'linear-gradient(135deg, #00d0ff, #0070ff)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem' }}
                                >
                                  <LayoutGrid size={14} /> View 4 Charts
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setTradeModal(r); }}
                                  style={{ padding: '10px', background: 'linear-gradient(135deg, #00ff88, #00c070)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem' }}
                                >
                                  <Target size={14} /> Demo Trade
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {fourChartsModal && (
        <FourChartsModal
          symbol={fourChartsModal.symbol.replace('USDT', '')}
          exchange={fourChartsModal.exchange}
          baseAsset={baseAsset}
          tfs={fourChartsModal.data}
          onClose={() => setFourChartsModal(null)}
        />
      )}
      
      {/* ─── AI DETAILS MODAL ─── */}
      {aiDetailsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111827', border: '1px solid #fbbf24', borderRadius: '16px', padding: '2rem', width: '500px', maxWidth: '100%', color: '#fff', boxShadow: '0 20px 50px rgba(251,191,36,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(251,191,36,0.2)', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Target size={24} /> AI Top Pick: {aiDetailsModal.symbol.replace('USDT', '')}
              </h3>
              <button onClick={() => setAiDetailsModal(null)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '8px' }}>Raison du choix de l'IA :</div>
              <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', padding: '15px', borderRadius: '8px', color: '#fcd34d', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                {aiDetailsModal.reason}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '4px' }}>Point d'Entrée (Prix Actuel)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{aiDetailsModal.entryPrice?.toPrecision(5)} SOL</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '4px' }}>Risk/Reward Ratio</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24' }}>{aiDetailsModal.rr}x</div>
              </div>
              <div style={{ background: 'rgba(255,59,48,0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,59,48,0.2)' }}>
                <div style={{ fontSize: '0.75rem', color: '#ff3b30', marginBottom: '4px' }}>Stop Loss (Support)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ff3b30' }}>{aiDetailsModal.stopLoss?.toPrecision(5)} SOL</div>
              </div>
              <div style={{ background: 'rgba(0,255,136,0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.2)' }}>
                <div style={{ fontSize: '0.75rem', color: '#00ff88', marginBottom: '4px' }}>Take Profit (Résistance)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#00ff88' }}>{aiDetailsModal.takeProfit?.toPrecision(5)} SOL</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => setAiDetailsModal(null)} 
                style={{ flex: 1, padding: '12px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Fermer
              </button>
              <button 
                onClick={() => {
                  setAiDetailsModal(null);
                  setTradeModal(aiDetailsModal);
                }}
                style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #00ff88, #00c070)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Target size={18} /> Ouvrir Demo Trade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TRADE ENTRY MODAL ─── */}
      {tradeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0a0f1a', border: '1px solid rgba(0,208,255,0.3)', borderRadius: '16px', padding: '2rem', width: '400px', maxWidth: '90%', color: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', color: '#00d0ff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Target size={24} /> Demo Trade: {tradeModal.symbol}
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '0.8rem', marginBottom: '8px' }}>Montant à investir (en SOL)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="number" 
                  min="0.1" max="10" step="0.1"
                  value={tradeAmount} 
                  onChange={e => setTradeAmount(Math.min(10, Math.max(0.1, parseFloat(e.target.value) || 0)))}
                  style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '1.2rem', textAlign: 'center' }}
                />
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#14F195' }}>SOL</span>
              </div>
              <div style={{ color: '#555', fontSize: '0.7rem', marginTop: '5px', textAlign: 'right' }}>Maximum: 10 SOL</div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '2rem' }}>
              <button 
                onClick={() => setTradeModal(null)}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  try {
                    // Fetch real-time prices for entry
                    const solRes = await fetchBybitData('SOLUSDT', '15', 1);
                    const currentSolPrice = solRes && solRes.length > 0 ? parseFloat(solRes[0][4]) : 0;
                    
                    const fetchSymbol = tradeModal.symbol.includes('USDT') ? tradeModal.symbol : `${tradeModal.symbol}USDT`;
                    const tokRes = tradeModal.exchange === 'binance'
                      ? await fetchBinanceData(fetchSymbol, '15', 1)
                      : await fetchBybitData(fetchSymbol, '15', 1);
                    
                    let currentTokenPrice = 0;
                    if (tokRes && tokRes.length > 0) {
                      // Binance and Bybit data from these wrappers usually return [time, open, high, low, close, volume]
                      // but we take the last one or first one based on how scanner.js formats it. 
                      // Actually scanner.js returns data where res[0] is often the oldest or newest. 
                      // For 1 limit, res[0] is the only candle.
                      currentTokenPrice = parseFloat(tokRes[0][4]);
                    }

                    if (currentSolPrice > 0 && currentTokenPrice > 0) {
                      const valueUsdt = tradeAmount * currentSolPrice;
                      const tokensAcquired = valueUsdt / currentTokenPrice;
                      
                      const newTrade = {
                        id: Date.now().toString(),
                        symbol: tradeModal.symbol,
                        exchange: tradeModal.exchange,
                        entryTime: Date.now(),
                        solAmount: tradeAmount,
                        entrySolPriceUsdt: currentSolPrice,
                        entryTokenPriceUsdt: currentTokenPrice,
                        tokensAcquired,
                        status: 'OPEN'
                      };

                      let existing = [];
                      try {
                        const parsed = JSON.parse(localStorage.getItem('nebula_demo_portfolio'));
                        if (Array.isArray(parsed)) existing = parsed;
                      } catch (e) {}
                      localStorage.setItem('nebula_demo_portfolio', JSON.stringify([newTrade, ...existing]));
                      
                      alert(`✅ Trade ouvert avec succès !\n${tokensAcquired.toLocaleString()} ${tradeModal.symbol} obtenus.`);
                      setTradeModal(null);
                    } else {
                      alert("Erreur lors de la récupération des prix en direct.");
                    }
                  } catch (e) {
                    alert("Erreur de connexion à l'API.");
                  }
                }}
                style={{ flex: 1, background: '#00d0ff', border: 'none', color: '#000', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '900' }}
              >
                Ouvrir Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MomentumStreaksScanner;
