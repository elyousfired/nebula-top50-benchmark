import React, { useState, useEffect, useRef, useCallback } from 'react';
import { History, Maximize2 } from 'lucide-react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';
import { fetchBaseAssetCandles, buildSyntheticCandles } from '../../logic/momentumScanner';

const SIGNALS = [
  { id: 1, token: "LAZIO", date: "14/07/2026", time: "22:24" },
  { id: 2, token: "DODO", date: "14/07/2026", time: "23:42" },
  { id: 3, token: "PORTO", date: "14/07/2026", time: "23:42" },
  { id: 4, token: "ZEC", date: "14/07/2026", time: "23:47" },
  { id: 5, token: "T", date: "15/07/2026", time: "01:27" },
  { id: 6, token: "PUMP", date: "15/07/2026", time: "01:37" },
  { id: 7, token: "EIGEN", date: "15/07/2026", time: "01:47" },
  { id: 8, token: "PYTH", date: "15/07/2026", time: "02:37" },
  { id: 9, token: "XEC", date: "15/07/2026", time: "03:32" },
  { id: 10, token: "VANA", date: "15/07/2026", time: "03:52" },
  { id: 11, token: "ALLO", date: "15/07/2026", time: "04:32" },
  { id: 12, token: "VANRY", date: "15/07/2026", time: "06:07" },
  { id: 13, token: "ALPINE", date: "15/07/2026", time: "06:27" },
  { id: 14, token: "INTCB", date: "15/07/2026", time: "06:57" },
  { id: 15, token: "0G", date: "15/07/2026", time: "07:42" },
  { id: 16, token: "ETHFI", date: "15/07/2026", time: "10:22" },
  { id: 17, token: "TLM", date: "15/07/2026", time: "11:12" },
  { id: 18, token: "DASH", date: "15/07/2026", time: "12:37" },
  { id: 19, token: "ONDO", date: "15/07/2026", time: "12:47" },
  { id: 20, token: "TOWNS", date: "15/07/2026", time: "12:57" },
  { id: 21, "token": "CRCLB", date: "15/07/2026", time: "13:37" },
  { id: 22, "token": "PEPE", date: "15/07/2026", time: "13:37" },
  { id: 23, token: "FF", date: "15/07/2026", time: "14:12" },
  { id: 24, "token": "EPIC", date: "15/07/2026", time: "14:27" },
  { id: 25, token: "HOME", date: "15/07/2026", time: "16:47" },
  { id: 26, "token": "VIRTUAL", date: "15/07/2026", time: "16:57" },
  { id: 27, "token": "SKL", date: "15/07/2026", time: "17:47" },
  { id: 28, "token": "LDO", date: "15/07/2026", time: "17:52" },
  { id: 29, "token": "ORDI", date: "15/07/2026", time: "18:12" },
  { id: 30, "token": "KITE", date: "15/07/2026", time: "19:07" },
  { id: 31, "token": "RIF", date: "15/07/2026", time: "23:57" },
  { id: 32, "token": "MEGA", "date": "16/07/2026", "time": "00:12" },
  { id: 33, "token": "HEI", "date": "16/07/2026", "time": "00:27" },
  { id: 34, "token": "UNI", "date": "16/07/2026", "time": "01:57" },
  { id: 35, "token": "SXT", "date": "16/07/2026", "time": "03:52" },
  { id: 36, "token": "OPN", "date": "16/07/2026", "time": "07:07" },
  { id: 37, "token": "RE", "date": "16/07/2026", "time": "07:42" },
  { id: 38, "token": "BANK", "date": "16/07/2026", "time": "09:27" },
  { id: 39, "token": "KAT", "date": "16/07/2026", "time": "09:32" },
  { id: 40, "token": "BAR", "date": "16/07/2026", "time": "10:33" },
  { id: 41, "token": "AIGENSYN", "date": "16/07/2026", "time": "11:33" },
  { id: 42, "token": "KAITO", "date": "16/07/2026", "time": "13:28" },
  { id: 43, "token": "HMSTR", "date": "16/07/2026", "time": "13:53" },
  { id: 44, "token": "MANTRA", "date": "16/07/2026", "time": "14:38" },
  { id: 45, "token": "DGB", "date": "16/07/2026", "time": "16:53" },
  { id: 46, "token": "PARTI", "date": "16/07/2026", "time": "16:53" },
  { id: 47, "token": "LUMIA", "date": "16/07/2026", "time": "17:43" },
  { id: 48, "token": "RESOLV", "date": "16/07/2026", "time": "19:58" },
  { id: 49, "token": "TREE", "date": "17/07/2026", "time": "02:39" },
  { id: 50, "token": "PENGU", "date": "17/07/2026", "time": "03:19" }
];

const parseDateTime = (dateStr, timeStr) => {
  const [day, month, year] = dateStr.split('/');
  const [hours, minutes] = timeStr.split(':');
  // Create UTC timestamp directly
  return Math.floor(Date.UTC(year, month - 1, day, hours, minutes) / 1000);
};

const calculateEMA = (data, period) => {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  let ema = data[0].close;
  const results = [];
  results.push({ time: data[0].time, value: ema });
  for (let i = 1; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    results.push({ time: data[i].time, value: ema });
  }
  return results;
};

const calculateRolling24h = (data) => {
  const period = 96; // 24h in 15m candles
  const hist = [];
  const line = [];
  if (data.length <= period) return { hist, line };
  
  for (let i = period; i < data.length; i++) {
    const pastClose = data[i - period].close;
    if (!pastClose || pastClose === 0) continue;
    const val = ((data[i].close - pastClose) / pastClose) * 100;
    hist.push({ time: data[i].time, value: val, color: val >= 0 ? '#10b981' : '#ef4444' });
    line.push({ time: data[i].time, value: val });
  }
  return { hist, line };
};

const SignalChart = ({ data, filters, onStatusChange }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const solChartContainerRef = useRef(null);
  const solChartRef = useRef(null);
  const solSeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const solEma20SeriesRef = useRef(null);
  const solEma50SeriesRef = useRef(null);
  
  const usdtRollingContainerRef = useRef(null);
  const solRollingContainerRef = useRef(null);
  const btcRollingContainerRef = useRef(null);
  
  const usdtRollingChartRef = useRef(null);
  const solRollingChartRef = useRef(null);
  const btcRollingChartRef = useRef(null);

  const usdtRollingHistRef = useRef(null);
  const usdtRollingLineRef = useRef(null);
  const solRollingHistRef = useRef(null);
  const solRollingLineRef = useRef(null);
  const btcRollingHistRef = useRef(null);
  const btcRollingLineRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!chartContainerRef.current || !solChartContainerRef.current) return;
    
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 250,
      layout: { background: { type: 'solid', color: 'rgba(15, 23, 42, 0.8)' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,0.1)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' }
    });
    
    chartRef.current = chart;
    const series = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderVisible: false,
      wickUpColor: '#10b981', wickDownColor: '#ef4444'
    });
    seriesRef.current = series;

    const ema20 = chart.addLineSeries({
      color: '#3b82f6', // blue
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false
    });
    ema20SeriesRef.current = ema20;

    const ema50 = chart.addLineSeries({
      color: '#f59e0b', // orange/amber
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false
    });
    ema50SeriesRef.current = ema50;

    const solChart = createChart(solChartContainerRef.current, {
      width: solChartContainerRef.current.clientWidth,
      height: 250,
      layout: { background: { type: 'solid', color: 'rgba(15, 23, 42, 0.8)' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,0.1)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' }
    });
    
    solChartRef.current = solChart;
    const solSeries = solChart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderVisible: false,
      wickUpColor: '#10b981', wickDownColor: '#ef4444'
    });
    solSeriesRef.current = solSeries;

    const solEma20 = solChart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false
    });
    solEma20SeriesRef.current = solEma20;

    const solEma50 = solChart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false
    });
    solEma50SeriesRef.current = solEma50;

    const initRollingChart = (container) => {
      if (!container) return null;
      const rChart = createChart(container, {
        width: container.clientWidth,
        height: 120,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,0.1)' },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' }
      });
      const hist = rChart.addHistogramSeries({
        priceFormat: { type: 'volume' }
      });
      const line = rChart.addLineSeries({
        color: '#ffffff',
        lineWidth: 1,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false
      });
      return { chart: rChart, hist, line };
    };

    if (usdtRollingContainerRef.current) {
      const { chart: rC, hist, line } = initRollingChart(usdtRollingContainerRef.current);
      usdtRollingChartRef.current = rC;
      usdtRollingHistRef.current = hist;
      usdtRollingLineRef.current = line;
    }
    if (solRollingContainerRef.current) {
      const { chart: rC, hist, line } = initRollingChart(solRollingContainerRef.current);
      solRollingChartRef.current = rC;
      solRollingHistRef.current = hist;
      solRollingLineRef.current = line;
    }
    if (btcRollingContainerRef.current) {
      const { chart: rC, hist, line } = initRollingChart(btcRollingContainerRef.current);
      btcRollingChartRef.current = rC;
      btcRollingHistRef.current = hist;
      btcRollingLineRef.current = line;
    }

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      if (solChartContainerRef.current) solChart.applyOptions({ width: solChartContainerRef.current.clientWidth });
      if (usdtRollingChartRef.current && usdtRollingContainerRef.current) usdtRollingChartRef.current.applyOptions({ width: usdtRollingContainerRef.current.clientWidth });
      if (solRollingChartRef.current && solRollingContainerRef.current) solRollingChartRef.current.applyOptions({ width: solRollingContainerRef.current.clientWidth });
      if (btcRollingChartRef.current && btcRollingContainerRef.current) btcRollingChartRef.current.applyOptions({ width: btcRollingContainerRef.current.clientWidth });
    };

    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (!range) return;
        try { if (solChartRef.current) solChartRef.current.timeScale().setVisibleRange(range); } catch(e){}
        try { if (usdtRollingChartRef.current) usdtRollingChartRef.current.timeScale().setVisibleRange(range); } catch(e){}
        try { if (solRollingChartRef.current) solRollingChartRef.current.timeScale().setVisibleRange(range); } catch(e){}
        try { if (btcRollingChartRef.current) btcRollingChartRef.current.timeScale().setVisibleRange(range); } catch(e){}
    });

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      solChart.remove();
      if (usdtRollingChartRef.current) usdtRollingChartRef.current.remove();
      if (solRollingChartRef.current) solRollingChartRef.current.remove();
      if (btcRollingChartRef.current) btcRollingChartRef.current.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const urlSpot = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${data.token}USDT&interval=15&limit=1000`;
      const urlLinear = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${data.token}USDT&interval=15&limit=1000`;
      const urlBinance = `https://api.binance.com/api/v3/klines?symbol=${data.token}USDT&interval=15m&limit=1000`;
      
      try {
        let klinesRaw = [];
        let isBinance = false;

        try {
          const res = await axios.get(urlSpot, { timeout: 4000 });
          klinesRaw = res.data?.result?.list || [];
        } catch(e) {}

        if (klinesRaw.length === 0) {
           try {
             const res = await axios.get(urlLinear, { timeout: 4000 });
             klinesRaw = res.data?.result?.list || [];
           } catch(e) {}
        }
        
        // Si Bybit n'a rien donné, on tente Binance
        if (klinesRaw.length === 0) {
           try {
             const res = await axios.get(urlBinance, { timeout: 4000 });
             if (res.data && Array.isArray(res.data)) {
               klinesRaw = res.data;
               isBinance = true;
             }
           } catch(e) {}
        }
        
        if (klinesRaw.length > 0 && isMounted) {
          // Bybit renvoie de l'anti-chronologique (récent -> ancien), Binance renvoie chronologique (ancien -> récent)
          const dataToMap = isBinance ? klinesRaw : [...klinesRaw].reverse();
          
          const formatted = dataToMap.map(k => ({
            time: Math.floor(Number(k[0]) / 1000),
            open: Number(k[1]),
            high: Number(k[2]),
            low: Number(k[3]),
            close: Number(k[4]),
            volume: Number(k[5]) || 0
          })).filter(c => Number.isFinite(c.time) && Number.isFinite(c.close) && c.time > 0);

          // Deduplicate timestamps (keep last occurrence)
          const seenTimes = new Set();
          const deduped = [];
          for (let i = formatted.length - 1; i >= 0; i--) {
            if (!seenTimes.has(formatted[i].time)) {
              seenTimes.add(formatted[i].time);
              deduped.unshift(formatted[i]);
            }
          }

          // Safe wrapper for all lightweight-charts operations
          const safeOp = (fn) => { try { fn(); } catch(e) { console.warn('Chart op failed:', e.message); } };

          if (seriesRef.current && deduped.length > 0) {
            safeOp(() => seriesRef.current.setData(deduped));

            if (ema20SeriesRef.current) {
               const ema20Data = calculateEMA(deduped, 20);
               if (ema20Data.length > 0) safeOp(() => ema20SeriesRef.current.setData(ema20Data));
            }
            if (ema50SeriesRef.current) {
               const ema50Data = calculateEMA(deduped, 50);
               if (ema50Data.length > 0) safeOp(() => ema50SeriesRef.current.setData(ema50Data));
            }

            // Calculate SOL synthetic chart
            let synthetic = [];
            try {
              const solMap = await fetchBaseAssetCandles('SOLUSDT', '15', 'bybit');
              synthetic = buildSyntheticCandles(deduped, solMap)
                .filter(c => Number.isFinite(c.open) && Number.isFinite(c.close) && Number.isFinite(c.high) && Number.isFinite(c.low));
              if (solSeriesRef.current && synthetic.length > 0) {
                safeOp(() => solSeriesRef.current.setData(synthetic));
                
                if (solEma20SeriesRef.current) {
                   const sEma20 = calculateEMA(synthetic, 20);
                   if (sEma20.length > 0) safeOp(() => solEma20SeriesRef.current.setData(sEma20));
                }
                if (solEma50SeriesRef.current) {
                   const sEma50 = calculateEMA(synthetic, 50);
                   if (sEma50.length > 0) safeOp(() => solEma50SeriesRef.current.setData(sEma50));
                }
              }
            } catch (err) {
              console.log("Failed to build synthetic SOL candles", err);
            }

            // Rolling 24h USDT
            let usdtRollingData = { hist: [], line: [] };
            try {
              if (usdtRollingHistRef.current && usdtRollingLineRef.current) {
                 usdtRollingData = calculateRolling24h(deduped);
                 if (usdtRollingData.hist.length > 0) safeOp(() => usdtRollingHistRef.current.setData(usdtRollingData.hist));
                 if (usdtRollingData.line.length > 0) safeOp(() => usdtRollingLineRef.current.setData(usdtRollingData.line));
              }
            } catch(e) { console.warn('Rolling USDT failed:', e.message); }

            // Rolling 24h SOL
            let solRollingData = { hist: [], line: [] };
            try {
              if (solRollingHistRef.current && solRollingLineRef.current && synthetic.length > 0) {
                 solRollingData = calculateRolling24h(synthetic);
                 if (solRollingData.hist.length > 0) safeOp(() => solRollingHistRef.current.setData(solRollingData.hist));
                 if (solRollingData.line.length > 0) safeOp(() => solRollingLineRef.current.setData(solRollingData.line));
              }
            } catch(e) { console.warn('Rolling SOL failed:', e.message); }

            // Calculate BTC synthetic chart & Rolling
            let btcSynthetic = [];
            let btcRollingData = { hist: [], line: [] };
            try {
               const btcMap = await fetchBaseAssetCandles('BTCUSDT', '15', 'bybit');
               btcSynthetic = buildSyntheticCandles(deduped, btcMap)
                 .filter(c => Number.isFinite(c.open) && Number.isFinite(c.close) && Number.isFinite(c.high) && Number.isFinite(c.low));
               if (btcRollingHistRef.current && btcRollingLineRef.current && btcSynthetic.length > 0) {
                  btcRollingData = calculateRolling24h(btcSynthetic);
                  if (btcRollingData.hist.length > 0) safeOp(() => btcRollingHistRef.current.setData(btcRollingData.hist));
                  if (btcRollingData.line.length > 0) safeOp(() => btcRollingLineRef.current.setData(btcRollingData.line));
               }
            } catch (err) {
               console.log("Failed to build synthetic BTC candles", err);
            }

            // Set Marker at exact signal time
            const signalTime = parseDateTime(data.date, data.time);
            
            // Find closest point in data
            let closestPoint = null;
            let minDiff = Infinity;
            for (let i = 0; i < deduped.length; i++) {
              const diff = Math.abs(deduped[i].time - signalTime);
              if (diff < minDiff) {
                minDiff = diff;
                closestPoint = deduped[i];
              }
            }

            if (closestPoint) {
              safeOp(() => seriesRef.current.setMarkers([
                {
                  time: closestPoint.time,
                  position: 'belowBar',
                  color: '#f59e0b',
                  shape: 'arrowUp',
                  text: 'SIGNAL',
                  size: 2
                }
              ]));
              
              if (solSeriesRef.current && synthetic.length > 0) {
                 const synthPoint = synthetic.find(s => s.time === closestPoint.time);
                 if (synthPoint) {
                    safeOp(() => solSeriesRef.current.setMarkers([
                      {
                        time: synthPoint.time,
                        position: 'belowBar',
                        color: '#00d0ff',
                        shape: 'arrowUp',
                        text: 'VS SOL',
                        size: 2
                      }
                    ]));
                 }
              }

              // Add marker to rolling charts
              const rollingMarker = { time: closestPoint.time, position: 'belowBar', color: '#f59e0b', shape: 'arrowUp', size: 2 };
              if (usdtRollingLineRef.current && usdtRollingData.line.some(d => d.time === closestPoint.time)) {
                 safeOp(() => usdtRollingLineRef.current.setMarkers([{ ...rollingMarker }]));
              }
              if (solRollingLineRef.current && solRollingData.line.some(d => d.time === closestPoint.time)) {
                 safeOp(() => solRollingLineRef.current.setMarkers([{ ...rollingMarker }]));
              }
              if (btcRollingLineRef.current && btcRollingData.line.some(d => d.time === closestPoint.time)) {
                 safeOp(() => btcRollingLineRef.current.setMarkers([{ ...rollingMarker }]));
              }

              setTimeout(() => {
                safeOp(() => { if (chartRef.current) chartRef.current.timeScale().fitContent(); });
                safeOp(() => { if (solChartRef.current) solChartRef.current.timeScale().fitContent(); });
                safeOp(() => { if (usdtRollingChartRef.current) usdtRollingChartRef.current.timeScale().fitContent(); });
                safeOp(() => { if (solRollingChartRef.current) solRollingChartRef.current.timeScale().fitContent(); });
                safeOp(() => { if (btcRollingChartRef.current) btcRollingChartRef.current.timeScale().fitContent(); });
              }, 100);

              // Calcul des métriques pour les filtres
              const index = deduped.findIndex(f => f.time === closestPoint.time);
              if (index >= 20) {
                const c = deduped[index];
                const cMinus10 = deduped[index - 10];
                const trend10 = ((c.close - cMinus10.close) / cMinus10.close) * 100;
                
                let sumVol = 0;
                for(let i = index - 20; i < index; i++) sumVol += deduped[i].volume;
                const avgVol = sumVol / 20;
                const volMult = avgVol > 0 ? c.volume / avgVol : 1;

                let solTrend = 0;
                if (synthetic.length > 0) {
                   const solIndex = synthetic.findIndex(s => s.time === closestPoint.time);
                   if (solIndex >= 10) {
                      const solC = synthetic[solIndex];
                      const solCMinus10 = synthetic[solIndex - 10];
                      if (solC && solCMinus10) {
                         solTrend = ((solC.close - solCMinus10.close) / solCMinus10.close) * 100;
                      }
                   }
                }

                let distanceFromEma20 = 0;
                const ema20Data = calculateEMA(deduped, 20);
                const signalEma = ema20Data.find(e => e.time === closestPoint.time);
                if (signalEma) {
                    distanceFromEma20 = ((c.close - signalEma.value) / signalEma.value) * 100;
                }
                
                let solRelativeWeakness = false;
                if (synthetic.length > 0) {
                    const solEma50Data = calculateEMA(synthetic, 50);
                    const signalSolEma50 = solEma50Data.find(e => e.time === closestPoint.time);
                    const solIndex = synthetic.findIndex(s => s.time === closestPoint.time);
                    if (signalSolEma50 && solIndex !== -1) {
                        const solPrice = synthetic[solIndex].close;
                        if (solPrice < signalSolEma50.value) {
                            solRelativeWeakness = true;
                        }
                    }
                }
                
                let signalUsdt24h = 0;
                let signalSol24h = 0;
                let signalBtc24h = 0;
                if (usdtRollingData && usdtRollingData.line) {
                   const pt = usdtRollingData.line.find(d => d.time === closestPoint.time);
                   if (pt) signalUsdt24h = pt.value;
                }
                if (solRollingData && solRollingData.line) {
                   const pt = solRollingData.line.find(d => d.time === closestPoint.time);
                   if (pt) signalSol24h = pt.value;
                }
                if (btcRollingData && btcRollingData.line) {
                   const pt = btcRollingData.line.find(d => d.time === closestPoint.time);
                   if (pt) signalBtc24h = pt.value;
                }
                
                if (isMounted) {
                  setMetrics({ trend10, volMult, solTrend, distanceFromEma20, solRelativeWeakness, signalUsdt24h, signalSol24h, signalBtc24h });
                }
              }
            }
          }
          if (isMounted) setLoading(false);
        } else if (isMounted) {
          setLoading('Non listé sur Bybit ni Binance');
        }
      } catch (err) {
         console.log("Failed to fetch data for", data.token, err);
         if (isMounted) setLoading(`Erreur: ${err.message || 'réseau'}`);
      }
    };

    // Small delay based on ID to avoid rate limits
    setTimeout(() => {
      loadData();
    }, data.id * 80);

    return () => { isMounted = false; };
  }, [data]);

  useEffect(() => {
    const violations = [];
    if (metrics) {
      if (metrics.trend10 > 10) violations.push('prePump');
      if (metrics.volMult > 15) violations.push('volAnomaly');
      if (metrics.solTrend > 1) violations.push('fakeSol');
      if (metrics.distanceFromEma20 > 3) violations.push('emaOver');
      if (metrics.solRelativeWeakness) violations.push('solWeakness');
      
      const isHealthyUsdt = metrics.signalUsdt24h >= 2 && metrics.signalUsdt24h <= 15;
      const isBeatingSol = metrics.signalSol24h > 0;
      const isBeatingBtc = metrics.signalBtc24h > 0;
      const solIsUp = (metrics.signalUsdt24h - metrics.signalSol24h) > 1.5;
      if (!(isHealthyUsdt && isBeatingSol && isBeatingBtc && solIsUp)) {
         violations.push('rollingOptimal');
      }
    }
    if (onStatusChange) {
      onStatusChange(data.id, data.token, violations);
    }
  }, [metrics, data.id, data.token, onStatusChange]);

  const isHidden = filters && metrics ? (
    (filters.prePump && metrics.trend10 > 10) ||
    (filters.volAnomaly && metrics.volMult > 15) ||
    (filters.fakeSol && metrics.solTrend > 1) ||
    (filters.emaOver && metrics.distanceFromEma20 > 3) ||
    (filters.solWeakness && metrics.solRelativeWeakness) ||
    (filters.rollingOptimal && !(metrics.signalUsdt24h >= 2 && metrics.signalUsdt24h <= 15 && metrics.signalSol24h > 0 && metrics.signalBtc24h > 0 && (metrics.signalUsdt24h - metrics.signalSol24h) > 1.5))
  ) : false;

  return (
    <div style={{ display: isHidden ? 'none' : 'block', background: 'rgba(25, 30, 40, 0.6)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)', overflow: 'hidden', padding: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, color: '#f59e0b', fontSize: '1.1rem', fontWeight: 'bold' }}>{data.token}/USDT &amp; /SOL</h3>
        <span style={{ color: '#94a3b8', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
          {data.date} {data.time}
        </span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '250px', display: 'flex', gap: '15px' }}>
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: loading === true ? '#64748b' : '#ef4444', zIndex: 10, background: 'rgba(15, 23, 42, 0.5)', fontWeight: 'bold' }}>
            {loading === true ? 'Chargement...' : loading}
          </div>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 5, fontSize: '0.7rem', color: '#888', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}>{data.token}/USDT</div>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 5, fontSize: '0.7rem', color: '#00d0ff', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}>{data.token}/SOL</div>
          <div ref={solChartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
      
      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '0.9rem', textTransform: 'uppercase' }}>
           Force 24H Roulante (Rolling 24H Strength)
        </h4>
        <div style={{ display: 'flex', gap: '10px', height: '120px' }}>
           <div style={{ flex: 1, position: 'relative', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 5, fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}>VS USDT</div>
              <div ref={usdtRollingContainerRef} style={{ width: '100%', height: '100%' }} />
           </div>
           <div style={{ flex: 1, position: 'relative', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 5, fontSize: '0.7rem', color: '#00d0ff', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}>VS SOL</div>
              <div ref={solRollingContainerRef} style={{ width: '100%', height: '100%' }} />
           </div>
           <div style={{ flex: 1, position: 'relative', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 5, fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}>VS BTC</div>
              <div ref={btcRollingContainerRef} style={{ width: '100%', height: '100%' }} />
           </div>
        </div>
      </div>
    </div>
  );
};

const SignalHistoryViewer = () => {
  const [filters, setFilters] = useState({
    prePump: false,
    volAnomaly: false,
    fakeSol: false,
    emaOver: false,
    solWeakness: false,
    rollingOptimal: true
  });
  
  const [tokenStatuses, setTokenStatuses] = useState({});

  const handleStatusChange = useCallback((id, token, violations) => {
    setTokenStatuses(prev => {
      // prevent unnecessary renders
      if (prev[id] && JSON.stringify(prev[id].violations) === JSON.stringify(violations)) {
        return prev;
      }
      return { ...prev, [id]: { token, violations } };
    });
  }, []);

  // Compute lists of filtered tokens
  const deletedPrePump = Object.values(tokenStatuses).filter(s => s.violations.includes('prePump')).map(s => s.token);
  const deletedVolAnomaly = Object.values(tokenStatuses).filter(s => s.violations.includes('volAnomaly')).map(s => s.token);
  const deletedFakeSol = Object.values(tokenStatuses).filter(s => s.violations.includes('fakeSol')).map(s => s.token);
  const deletedEmaOver = Object.values(tokenStatuses).filter(s => s.violations.includes('emaOver')).map(s => s.token);
  const deletedSolWeakness = Object.values(tokenStatuses).filter(s => s.violations.includes('solWeakness')).map(s => s.token);
  const deletedRollingOptimal = Object.values(tokenStatuses).filter(s => s.violations.includes('rollingOptimal')).map(s => s.token);

  return (
    <div style={{ padding: '20px', color: '#fff', minHeight: '100vh', background: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={28} color="#f59e0b" /> BACKTEST SIGNAUX
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Visualisation des 43 signaux passés. Bougies en 15 minutes avec marqueur sur l'heure du signal.
          </p>
        </div>
        
        {/* BOUTONS DE FILTRES */}
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
           <button 
             onClick={() => setFilters(f => ({ ...f, prePump: !f.prePump }))}
             style={{ background: filters.prePump ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filters.prePump ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontWeight: 'bold', transition: 'all 0.2s' }}
           >
             {filters.prePump ? '🔴 Actif :' : '⭕ OFF :'} Anti Pre-Pump (&gt;10% trend)
           </button>
           <button 
             onClick={() => setFilters(f => ({ ...f, volAnomaly: !f.volAnomaly }))}
             style={{ background: filters.volAnomaly ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filters.volAnomaly ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontWeight: 'bold', transition: 'all 0.2s' }}
           >
             {filters.volAnomaly ? '🔴 Actif :' : '⭕ OFF :'} Anti Volume Anormal (&gt;15x vol)
           </button>
           <button 
             onClick={() => setFilters(f => ({ ...f, fakeSol: !f.fakeSol }))}
             style={{ background: filters.fakeSol ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filters.fakeSol ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontWeight: 'bold', transition: 'all 0.2s' }}
           >
             {filters.fakeSol ? '🔴 Actif :' : '⭕ OFF :'} Anti Fake Strength (SOL &gt; 1%)
           </button>
           <button 
             onClick={() => setFilters(f => ({ ...f, emaOver: !f.emaOver }))}
             style={{ background: filters.emaOver ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filters.emaOver ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontWeight: 'bold', transition: 'all 0.2s' }}
           >
             {filters.emaOver ? '🔴 Actif :' : '⭕ OFF :'} Anti Sur-Extension EMA (&gt; 3%)
           </button>
           <button 
             onClick={() => setFilters(f => ({ ...f, solWeakness: !f.solWeakness }))}
             style={{ background: filters.solWeakness ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filters.solWeakness ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontWeight: 'bold', transition: 'all 0.2s' }}
           >
             {filters.solWeakness ? '🔴 Actif :' : '⭕ OFF :'} Anti Faiblesse Relative (SOL &lt; EMA 50)
           </button>
           <button 
             onClick={() => setFilters(f => ({ ...f, rollingOptimal: !f.rollingOptimal }))}
             style={{ background: filters.rollingOptimal ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filters.rollingOptimal ? '#10b981' : 'rgba(255,255,255,0.1)'}`, padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', color: '#10b981', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: filters.rollingOptimal ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none' }}
           >
             {filters.rollingOptimal ? '⭐ ACTIF :' : '⭕ OFF :'} Golden Filter (Rolling 24H)
           </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(800px, 1fr))', gap: '20px', maxWidth: '1800px', margin: '0 auto', paddingBottom: '40px' }}>
        {SIGNALS.map(signal => (
          <SignalChart key={signal.id} data={signal} filters={filters} onStatusChange={handleStatusChange} />
        ))}
      </div>

      {/* RENDER DELETED TOKENS */}
      <div style={{ maxWidth: '1800px', margin: '0 auto', background: 'rgba(15, 23, 42, 0.8)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#f59e0b', marginBottom: '15px' }}>Tokens Supprimés par les Filtres (Mathématiquement Validés)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
           <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <h4 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>Anti Pre-Pump (&gt;10% trend)</h4>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                 {deletedPrePump.length > 0 ? deletedPrePump.join(', ') : 'Aucun'}
              </p>
           </div>
           <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <h4 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>Anti Volume Anormal (&gt;15x vol)</h4>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                 {deletedVolAnomaly.length > 0 ? deletedVolAnomaly.join(', ') : 'Aucun'}
              </p>
           </div>
           <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <h4 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>Anti Fake Strength (SOL &gt; 1%)</h4>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                 {deletedFakeSol.length > 0 ? deletedFakeSol.join(', ') : 'Aucun'}
              </p>
           </div>
           <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <h4 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>Anti Sur-Extension (&gt; 3% EMA 20)</h4>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                 {deletedEmaOver.length > 0 ? deletedEmaOver.join(', ') : 'Aucun'}
              </p>
           </div>
           <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <h4 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>Anti Faiblesse Relative (SOL &lt; EMA 50)</h4>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                 {deletedSolWeakness.length > 0 ? deletedSolWeakness.join(', ') : 'Aucun'}
              </p>
           </div>
           <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', gridColumn: '1 / -1' }}>
              <h4 style={{ color: '#10b981', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>⭐ Golden Filter (Force 24H Optimale)</h4>
              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                 {deletedRollingOptimal.length > 0 ? deletedRollingOptimal.join(', ') : 'Aucun'}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SignalHistoryViewer;
