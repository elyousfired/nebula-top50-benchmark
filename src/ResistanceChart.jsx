import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { fetchBybitData, calculateEMA } from './logic/scanner';
import { fetchSolData, fetchBtcData } from './logic/sol-scanner';
import { syntheticRatio } from './logic/solSwitchEngine';

export const ResistanceChart = ({ symbol, analyzeAgainst = 'USDT', setAnalyzeAgainst, demandZone, onChartData }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  
  const [timeframe, setTimeframe] = useState('60'); // default 1H
  const [mode, setMode] = useState('price'); // 'price' or 'vwap'
  const [showEma, setShowEma] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showDemandZone, setShowDemandZone] = useState(true);
  
  const [resistances, setResistances] = useState(null);
  
  // Fetch PDH, PWH, PMH and VWAPs
  useEffect(() => {
    let isMounted = true;
    const fetchRes = async () => {
      try {
        const dData = await fetchBybitData(symbol, 'D', 3);
        const wData = await fetchBybitData(symbol, 'W', 3);
        const mData = await fetchBybitData(symbol, 'M', 3);
        
        if (!isMounted) return;
        
        const parseRaw = (data) => {
          if (!data || !Array.isArray(data)) return [];
          return data.map(k => ({
            time: Number(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            turnover: parseFloat(k[6] || 0)
          }));
        };

        const processData = async (tokenData, tf) => {
           let parsed = parseRaw(tokenData);
           if (analyzeAgainst === 'SOL') {
              const solData = await fetchSolData(tf, 3);
              parsed = syntheticRatio(parsed, parseRaw(solData));
           } else if (analyzeAgainst === 'BTC') {
              const btcData = await fetchBtcData(tf, 3);
              parsed = syntheticRatio(parsed, parseRaw(btcData));
           }
           return parsed;
        };
        
        let pdh = 0, dVwap = 0;
        let pwh = 0, wVwap = 0;
        let pmh = 0, mVwap = 0;
        
        const dParsed = await processData(dData, 'D');
        if (dParsed && dParsed.length >= 2) {
           pdh = dParsed[1].high;
           const vol = dParsed[1].volume;
           const turn = (analyzeAgainst === 'SOL' || analyzeAgainst === 'BTC') ? (dParsed[1].close * vol) : dParsed[1].turnover;
           if (vol > 0) dVwap = turn / vol;
         }
         
         const wParsed = await processData(wData, 'W');
         if (wParsed && wParsed.length >= 2) {
            pwh = wParsed[1].high; 
            const vol = wParsed[1].volume;
            const turn = (analyzeAgainst === 'SOL' || analyzeAgainst === 'BTC') ? (wParsed[1].close * vol) : wParsed[1].turnover;
            if (vol > 0) wVwap = turn / vol;
         }
         
         const mParsed = await processData(mData, 'M');
         if (mParsed && mParsed.length >= 2) {
            pmh = mParsed[1].high; 
            const vol = mParsed[1].volume;
            const turn = (analyzeAgainst === 'SOL' || analyzeAgainst === 'BTC') ? (mParsed[1].close * vol) : mParsed[1].turnover;
            if (vol > 0) mVwap = turn / vol;
         }
         
         setResistances({ pdh, pwh, pmh, dVwap, wVwap, mVwap });
      } catch (e) {
        console.error(e);
      }
    };
    fetchRes();
    return () => { isMounted = false; };
  }, [symbol]);
  // Stringify to avoid recreating the chart when references change but values don't
  const demandZoneStr = JSON.stringify(demandZone);
  const resistancesStr = JSON.stringify(resistances);

  // Chart rendering
  useEffect(() => {
    let isMounted = true;
    if (!chartContainerRef.current) return;
    
    const parsedDemand = demandZoneStr ? JSON.parse(demandZoneStr) : null;
    const parsedResistances = resistancesStr ? JSON.parse(resistancesStr) : null;
    
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(30, 41, 59, 0.5)', style: 1 }, horzLines: { color: 'rgba(30, 41, 59, 0.5)', style: 1 } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { mode: 1 },
      height: 400,
      localization: {
        priceFormatter: p => {
          if (p < 0.000001) return p.toFixed(9);
          if (p < 0.0001) return p.toFixed(7);
          if (p < 0.01) return p.toFixed(5);
          if (p < 1) return p.toFixed(4);
          return p.toFixed(2);
        }
      }
    });
    chartRef.current = chart;
    
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
    });
    
    const loadData = async () => {
      const data = await fetchBybitData(symbol, timeframe, 300);
      if (!isMounted || !data) return;
      
      let formatted = [...data].reverse().map(k => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        turnover: parseFloat(k[6])
      }));

      if (analyzeAgainst === 'SOL' || analyzeAgainst === 'BTC') {
         const baseData = analyzeAgainst === 'BTC' 
            ? await fetchBtcData(timeframe, 300)
            : await fetchSolData(timeframe, 300);
         if (baseData) {
            const formattedBase = [...baseData].reverse().map(k => ({
               time: Math.floor(Number(k[0]) / 1000),
               open: parseFloat(k[1]),
               high: parseFloat(k[2]),
               low: parseFloat(k[3]),
               close: parseFloat(k[4]),
               volume: parseFloat(k[5]),
               turnover: parseFloat(k[6])
            }));
            // Provide correctly formatted millisecond timestamps for syntheticRatio
            formatted = syntheticRatio(
              formatted.map(c => ({...c, time: c.time * 1000})), 
              formattedBase.map(c => ({...c, time: c.time * 1000}))
            ).map(c => ({...c, time: Math.floor(c.time / 1000)}));
         }
      }
      
      candleSeries.setData(formatted);

      // Add EMA 20 & 50
      if (showEma) {
        const closePrices = formatted.map(k => k.close);
        const ema20Values = calculateEMA(closePrices, 20);
        const ema50Values = calculateEMA(closePrices, 50);

        const ema20Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'EMA 20', crosshairMarkerVisible: false });
        const ema50Series = chart.addLineSeries({ color: '#ec4899', lineWidth: 2, title: 'EMA 50', crosshairMarkerVisible: false });

        ema20Series.setData(formatted.map((k, i) => ({ time: k.time, value: ema20Values[i] })));
        ema50Series.setData(formatted.map((k, i) => ({ time: k.time, value: ema50Values[i] })));
      }

      // Add Anchored Daily VWAP
      if (showVwap) {
        let currentDay = -1;
        let cumTurnover = 0;
        let cumVolume = 0;
        const vwapData = formatted.map(k => {
          const date = new Date(k.time * 1000);
          const day = date.getUTCDate();
          if (day !== currentDay) {
            currentDay = day;
            cumTurnover = 0;
            cumVolume = 0;
          }
          const candleTurnover = (analyzeAgainst === 'SOL' || analyzeAgainst === 'BTC') ? (k.close * k.volume) : k.turnover;
          cumTurnover += candleTurnover;
          cumVolume += k.volume;
          return {
            time: k.time,
            value: cumVolume > 0 ? cumTurnover / cumVolume : k.close
          };
        });

        const vwapSeries = chart.addLineSeries({ color: '#0ea5e9', lineWidth: 2, lineStyle: 0, title: 'VWAP D', crosshairMarkerVisible: false });
        vwapSeries.setData(vwapData);
      }
      
      // Add lines
      if (parsedResistances) {
        if (mode === 'price') {
           if (parsedResistances.pdh > 0) candleSeries.createPriceLine({ price: parsedResistances.pdh, color: '#f43f5e', lineWidth: 2, lineStyle: 2, title: 'PDH' });
           if (parsedResistances.pwh > 0) candleSeries.createPriceLine({ price: parsedResistances.pwh, color: '#a855f7', lineWidth: 2, lineStyle: 2, title: 'PWH' });
           if (parsedResistances.pmh > 0) candleSeries.createPriceLine({ price: parsedResistances.pmh, color: '#eab308', lineWidth: 2, lineStyle: 2, title: 'PMH' });
        } else {
           if (parsedResistances.dVwap > 0) candleSeries.createPriceLine({ price: parsedResistances.dVwap, color: '#38bdf8', lineWidth: 2, lineStyle: 2, title: 'Prev D VWAP' });
           if (parsedResistances.wVwap > 0) candleSeries.createPriceLine({ price: parsedResistances.wVwap, color: '#10b981', lineWidth: 2, lineStyle: 2, title: 'Prev W VWAP' });
           if (parsedResistances.mVwap > 0) candleSeries.createPriceLine({ price: parsedResistances.mVwap, color: '#f59e0b', lineWidth: 2, lineStyle: 2, title: 'Prev M VWAP' });
        }
      }
      
      if (parsedDemand && analyzeAgainst === 'USDT' && showDemandZone) {
        candleSeries.createPriceLine({ price: parsedDemand.top, color: '#10b981', lineWidth: 2, lineStyle: 0, title: 'Demand Zone Top' });
        candleSeries.createPriceLine({ price: parsedDemand.bottom, color: '#10b981', lineWidth: 2, lineStyle: 0, title: 'Demand Zone Bottom' });
      }
      
      chart.timeScale().fitContent();

      // Pass data to parent if callback is provided
      if (onChartData && formatted.length > 0) {
        const lastCandle = formatted[formatted.length - 1];
        
        let lastVwap = null;
        if (showVwap) {
          let cumTurnover = 0;
          let cumVolume = 0;
          let currentDay = -1;
          for (let i = 0; i < formatted.length; i++) {
            const k = formatted[i];
            const date = new Date(k.time * 1000);
            const day = date.getUTCDate();
            if (day !== currentDay) {
              currentDay = day;
              cumTurnover = 0;
              cumVolume = 0;
            }
            const candleTurnover = (analyzeAgainst === 'SOL' || analyzeAgainst === 'BTC') ? (k.close * k.volume) : k.turnover;
            cumTurnover += candleTurnover;
            cumVolume += k.volume;
            if (i === formatted.length - 1) {
               lastVwap = cumVolume > 0 ? cumTurnover / cumVolume : k.close;
            }
          }
        }

        onChartData({
          currentPrice: lastCandle.close,
          ema20: showEma && formatted.length >= 20 ? calculateEMA(formatted.map(k => k.close), 20).pop() : null,
          vwapD: lastVwap,
          pdh: parsedResistances ? parsedResistances.pdh : null
        });
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
      chart.remove();
    };
  }, [symbol, timeframe, mode, resistancesStr, showEma, showVwap, analyzeAgainst, demandZoneStr, showDemandZone]);

  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.8)', borderRadius: '16px', padding: '1.5rem', marginTop: '1.5rem', border: '1px solid rgba(59, 130, 246, 0.2)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
         <div style={{ display: 'flex', gap: 12 }}>
           <button onClick={() => setMode('price')} style={{ background: mode === 'price' ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)', color: mode === 'price' ? '#fff' : '#94a3b8', border: '1px solid ' + (mode === 'price' ? '#3b82f6' : '#334155'), padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.2s' }}>
             PRICE (PDH, PWH, PMH)
           </button>
           <button onClick={() => setMode('vwap')} style={{ background: mode === 'vwap' ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)', color: mode === 'vwap' ? '#fff' : '#94a3b8', border: '1px solid ' + (mode === 'vwap' ? '#3b82f6' : '#334155'), padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.2s' }}>
             VWAP (D, W, M)
           </button>
           <button onClick={() => setShowEma(!showEma)} style={{ background: showEma ? '#f59e0b' : 'rgba(30, 41, 59, 0.8)', color: showEma ? '#fff' : '#94a3b8', border: '1px solid ' + (showEma ? '#f59e0b' : '#334155'), padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.2s' }}>
             EMA 20/50
           </button>
           <button onClick={() => setShowVwap(!showVwap)} style={{ background: showVwap ? '#0ea5e9' : 'rgba(30, 41, 59, 0.8)', color: showVwap ? '#fff' : '#94a3b8', border: '1px solid ' + (showVwap ? '#0ea5e9' : '#334155'), padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.2s' }}>
             VWAP D
           </button>
           <button onClick={() => setShowDemandZone(!showDemandZone)} style={{ background: showDemandZone ? '#10b981' : 'rgba(30, 41, 59, 0.8)', color: showDemandZone ? '#fff' : '#94a3b8', border: '1px solid ' + (showDemandZone ? '#10b981' : '#334155'), padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.2s' }}>
             DEMAND ZONE
           </button>
         </div>
         
         <div style={{ display: 'flex', gap: 6 }}>
            {['USDT', 'SOL', 'BTC'].map(asset => (
              <button 
                key={asset} 
                onClick={() => setAnalyzeAgainst && setAnalyzeAgainst(asset)}
                style={{
                  background: analyzeAgainst === asset ? (asset === 'SOL' ? '#14F195' : asset === 'BTC' ? '#F7931A' : '#3b82f6') : 'rgba(30, 41, 59, 0.8)',
                  color: analyzeAgainst === asset ? '#000' : '#94a3b8', 
                  border: '1px solid ' + (analyzeAgainst === asset ? (asset === 'SOL' ? '#14F195' : asset === 'BTC' ? '#F7931A' : '#3b82f6') : '#334155'), 
                  padding: '4px 12px', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontSize: '0.75rem', 
                  fontWeight: 800, 
                  transition: 'all 0.2s',
                  marginRight: asset === 'BTC' ? '12px' : '0'
                }}>
                VS {asset}
              </button>
            ))}
             {['15', '60', '240', 'D', 'W'].map(tf => (
              <button 
                key={tf} 
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#6a0dad' : '#1e293b',
                  color: timeframe === tf ? '#fff' : '#64748b', border: 'none', padding: '4px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, transition: 'all 0.2s'
                }}>
                {tf === '15' ? '15m' : tf === '60' ? '1H' : tf === '240' ? '4H' : tf === 'D' ? '1D' : '1W'}
              </button>
            ))}
         </div>
       </div>
       <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
    </div>
  );
};
