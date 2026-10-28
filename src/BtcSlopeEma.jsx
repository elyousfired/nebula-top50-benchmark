import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';

// ─── Constants ───────────────────────────────────────────────────────────────
const CACHE_KEY = 'nebula_btcusd_weekly_v2'; // v2 = source hybride (CoinGecko + Bybit)
const EMA_OPTIONS = [
  { period: 20,  color: '#14F195', label: 'EMA 20' },
  { period: 50,  color: '#FFB800', label: 'EMA 50' },
  { period: 100, color: '#00d0ff', label: 'EMA 100' },
  { period: 200, color: '#9945FF', label: 'EMA 200' },
  { period: 500, color: '#ff3b30', label: 'EMA 500' },
];

// ─── Halving Cycles ───────────────────────────────────────────────────────────
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const HALVINGS = [
  { date: '2012-11-28', ts: 1354060800000, label: '₿ 2012', color: '#FF8C00' },
  { date: '2016-07-09', ts: 1468022400000, label: '₿ 2016', color: '#FFD700' },
  { date: '2020-05-11', ts: 1589155200000, label: '₿ 2020', color: '#00d0ff' },
  { date: '2024-04-19', ts: 1713484800000, label: '₿ 2024', color: '#9945FF' },
];

// Phases from Pine script: P1=0-20w, P2=20-60w, P3=60-95w, P4=95-140w
const CYCLE_PHASES = [
  { name: 'Phase 1 · Recovery',     startW: 0,   endW: 20,  color: 'rgba(0, 200, 200, 0.07)'  },
  { name: 'Phase 2 · Bull Run',     startW: 20,  endW: 60,  color: 'rgba(0, 255, 100, 0.07)'  },
  { name: 'Phase 3 · Distribution', startW: 60,  endW: 95,  color: 'rgba(255, 180, 0, 0.07)'  },
  { name: 'Phase 4 · Bear/DCA',     startW: 95,  endW: 140, color: 'rgba(100, 50, 200, 0.07)' },
];

// For each candle, returns { phase, weeksSince, halvingIndex }
const getHalvingInfo = (candleTime) => {
  const ts = new Date(candleTime).getTime();
  let lastHalving = null;
  let halvingIdx = -1;
  for (let i = 0; i < HALVINGS.length; i++) {
    if (HALVINGS[i].ts <= ts) { lastHalving = HALVINGS[i]; halvingIdx = i; }
  }
  if (!lastHalving) return null;
  const weeksSince = (ts - lastHalving.ts) / WEEK_MS;
  const phase = CYCLE_PHASES.find(p => weeksSince >= p.startW && weeksSince < p.endW) || null;
  return { weeksSince, phase, halvingIdx, halving: lastHalving };
};


// ─── EMA Calculation ─────────────────────────────────────────────────────────
const calculateEMA = (data, period) => {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  let ema = data[0];
  const results = [ema];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    results.push(ema);
  }
  return results;
};

const computeSlope = (emaValues, candles) => {
  const out = [];
  for (let i = 1; i < candles.length; i++) {
    if (emaValues[i - 1] !== 0) {
      const slope = ((emaValues[i] - emaValues[i - 1]) / emaValues[i - 1]) * 100;
      out.push({ time: candles[i].time, value: parseFloat(slope.toFixed(5)) });
    }
  }
  return out;
};

// ─── Cache helpers ────────────────────────────────────────────────────────────
const loadCache = () => {
  try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
};
const saveCache = (c) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {} };

// ─── Proxy helpers ────────────────────────────────────────────────────────────
const PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const fetchViaProxy = async (url, transform) => {
  for (const proxy of PROXIES) {
    try {
      const res = await axios.get(proxy(url), { timeout: 12000 });
      const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const result = transform(parsed);
      if (result && result.length > 0) return result;
    } catch {}
  }
  return null;
};

// ─── Source 1: CryptoCompare — BTC weekly OHLC depuis 2010 ───────────────────
// aggregate=7 → 7-day candles. limit=2000 → ~38 years en un seul appel
const fetchCryptoCompareHistory = async (onProgress) => {
  onProgress?.('📡 CryptoCompare — chargement historique BTC depuis 2010...');
  const url = 'https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=2000&aggregate=7&allData=true';

  const result = await fetchViaProxy(url, (data) => {
    const list = data?.Data?.Data || data?.Data;
    if (!list || list.length === 0) return null;
    return list
      .filter(k => k.open > 0)
      .map(k => ({
        ts: k.time * 1000,
        time: new Date(k.time * 1000).toISOString().split('T')[0],
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        src: 'cc',
      }));
  });

  if (result && result.length > 0) return result;

  // Fallback: try without allData param (some proxies strip it)
  const url2 = 'https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=2000&aggregate=7';
  const result2 = await fetchViaProxy(url2, (data) => {
    const list = data?.Data?.Data || data?.Data;
    if (!list || list.length === 0) return null;
    return list
      .filter(k => k.open > 0)
      .map(k => ({
        ts: k.time * 1000,
        time: new Date(k.time * 1000).toISOString().split('T')[0],
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        src: 'cc',
      }));
  });
  return result2 || [];
};

// ─── Source 2: Bybit — OHLC précis depuis 2019 ───────────────────────────────
const fetchBybitHistory = async (onProgress) => {
  onProgress?.('📡 Bybit — chargement OHLC précis depuis 2019...');
  for (const cat of ['inverse', 'linear']) {
    const url = `https://api.bybit.com/v5/market/kline?category=${cat}&symbol=BTCUSD&interval=W&limit=1000&t=${Date.now()}`;
    const raw = await fetchViaProxy(url, (data) => data?.result?.list || data?.list);
    if (!raw || raw.length === 0) continue;
    return raw
      .map(k => ({
        ts: parseInt(k[0]),
        time: new Date(parseInt(k[0])).toISOString().split('T')[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        src: 'bybit',
      }))
      .sort((a, b) => a.ts - b.ts);
  }
  return [];
};

// ─── Merge: Bybit overrides CryptoCompare for same week ──────────────────────
const mergeCandles = (cc, bybit) => {
  const map = new Map();
  for (const c of cc) map.set(c.time, c);
  for (const c of bybit) map.set(c.time, c); // Bybit = meilleure précision OHLC
  return [...map.values()].sort((a, b) => (a.time > b.time ? 1 : -1));
};


// ─── Main fetch (cache + delta) ───────────────────────────────────────────────
const fetchAndMerge = async (onProgress) => {
  // Purge old v1 cache if present
  try { localStorage.removeItem('nebula_btcusd_weekly_v1'); } catch {}

  const cached = loadCache();

  // Warm cache (has full history already): just delta from Bybit
  if (cached.length > 200) {
    onProgress?.('💾 Cache actif — mise à jour delta...');
    const recent = await fetchBybitHistory(onProgress);
    const existingDates = new Set(cached.map(c => c.time));
    const newOnes = recent.filter(c => !existingDates.has(c.time));
    if (newOnes.length > 0) {
      const merged = mergeCandles(cached, newOnes);
      saveCache(merged);
      return merged;
    }
    return cached;
  }

  // Cold cache: fetch full history from CryptoCompare (since 2010) + Bybit (precise OHLC)
  const ccData = await fetchCryptoCompareHistory(onProgress);
  const bybitData = await fetchBybitHistory(onProgress);

  if (ccData.length === 0 && bybitData.length === 0) return null;

  const merged = mergeCandles(ccData, bybitData);
  saveCache(merged);
  return merged;
};

// ─── Main Chart (Candles + selected EMAs) ─────────────────────────────────────
const MainChart = ({ candles, activeEmas }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!candles || !containerRef.current) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth, height: 480,
      layout: { background: { color: '#050505' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#0d0d0d' }, horzLines: { color: '#0d0d0d' } },
      timeScale: { borderColor: '#1a1a1a', timeVisible: false },
      rightPriceScale: { borderColor: '#1a1a1a' },
    });

    const closes = candles.map(d => d.close);

    // ── Phase background (histogram, hidden scale) ────────────────────────────
    const phaseSeries = chart.addHistogramSeries({
      priceScaleId: 'phase', lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale('phase').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
    phaseSeries.setData(candles.map(c => {
      const info = getHalvingInfo(c.time);
      return { time: c.time, value: 1, color: info?.phase?.color ?? 'rgba(0,0,0,0)' };
    }));

    // ── Candlesticks ──────────────────────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff88', downColor: '#ff3b30', borderVisible: false,
      wickUpColor: '#00ff88', wickDownColor: '#ff3b30', priceScaleId: 'right',
    });
    candleSeries.setData(candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));

    // ── Halving markers on candle series ─────────────────────────────────────
    const halvingMarkers = HALVINGS
      .filter(h => {
        const hDate = h.date;
        return candles.some(c => c.time >= hDate);
      })
      .map(h => ({
        time: h.date,
        position: 'aboveBar',
        color: h.color,
        shape: 'arrowDown',
        text: h.label,
        size: 2,
      }));
    if (halvingMarkers.length > 0) {
      candleSeries.setMarkers(halvingMarkers);
    }

    // ── All selected EMAs ─────────────────────────────────────────────────────
    activeEmas.forEach(period => {
      const opt = EMA_OPTIONS.find(e => e.period === period);
      const emaVals = calculateEMA(closes, period);
      const series = chart.addLineSeries({ color: opt.color, lineWidth: period > 100 ? 2 : 1.5, priceScaleId: 'right', title: opt.label });
      series.setData(candles.map((c, i) => ({ time: c.time, value: parseFloat(emaVals[i].toFixed(2)) })));
    });


    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => { if (chartRef.current && container) chartRef.current.applyOptions({ width: container.clientWidth }); };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [candles, activeEmas]);

  return <div ref={containerRef} style={{ width: '100%', height: '480px', background: '#050505', borderRadius: '16px', border: '1px solid #1a1a1a', overflow: 'hidden' }} />;
};

// ─── Slope-only Chart ─────────────────────────────────────────────────────────
const SlopeChart = ({ candles, activeEmas }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!candles || !containerRef.current || activeEmas.length === 0) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth, height: 380,
      layout: { background: { color: '#050505' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#0d0d0d' }, horzLines: { color: '#111' } },
      timeScale: { borderColor: '#1a1a1a', timeVisible: false },
      rightPriceScale: { borderColor: '#1a1a1a' },
    });

    // ── Zero line — blanche et visible ──────────────────────────────────────
    const zeroSeries = chart.addLineSeries({
      color: 'rgba(255, 255, 255, 0.55)',
      lineWidth: 1, lineStyle: 0,
      priceScaleId: 'right',
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    });
    zeroSeries.setData(candles.slice(1).map(c => ({ time: c.time, value: 0 })));

    // ── Phase background ─────────────────────────────────────────────────────
    const phaseSeries = chart.addHistogramSeries({
      priceScaleId: 'phase', lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale('phase').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
    phaseSeries.setData(candles.slice(1).map(c => {
      const info = getHalvingInfo(c.time);
      return { time: c.time, value: 1, color: info?.phase?.color ?? 'rgba(0,0,0,0)' };
    }));

    // ── Halving markers on zero line ─────────────────────────────────────────
    const halvingMarkers = HALVINGS
      .filter(h => candles.some(c => c.time >= h.date))
      .map(h => ({ time: h.date, position: 'aboveBar', color: h.color, shape: 'arrowDown', text: h.label, size: 2 }));
    if (halvingMarkers.length > 0) zeroSeries.setMarkers(halvingMarkers);

    // ── Slope per EMA ────────────────────────────────────────────────────────

    const closes = candles.map(d => d.close);
    activeEmas.forEach(period => {
      const opt = EMA_OPTIONS.find(e => e.period === period);
      const emaVals = calculateEMA(closes, period);
      const slopeData = computeSlope(emaVals, candles);

      const series = chart.addBaselineSeries({
        priceScaleId: 'right',
        title: `Slope ${opt.label}`,
        lastValueVisible: true,
        baseValue: { type: 'price', price: 0 },
        // Above 0 → EMA's own color
        topLineColor: opt.color,
        topFillColor1: `${opt.color}00`, // no fill = cleaner when multiple EMAs
        topFillColor2: `${opt.color}00`,
        // Below 0 → red
        bottomLineColor: '#ff3b30',
        bottomFillColor1: 'rgba(255, 59, 48, 0.00)',
        bottomFillColor2: 'rgba(255, 59, 48, 0.00)',
        lineWidth: 2,
      });
      series.setData(slopeData);
    });


    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => { if (chartRef.current && container) chartRef.current.applyOptions({ width: container.clientWidth }); };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [candles, activeEmas]);

  return <div ref={containerRef} style={{ width: '100%', height: '380px', background: '#050505', borderRadius: '16px', border: '1px solid #1a1a1a', overflow: 'hidden' }} />;
};

// ─── Root Component ───────────────────────────────────────────────────────────
export const BtcSlopeEma = () => {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('Initialisation...');
  const [error, setError] = useState(null);
  const [candles, setCandles] = useState(null);
  const [activeEmas, setActiveEmas] = useState([20, 50, 100, 200, 500]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Force clear stale v2 cache that only has Bybit data (< 700 candles)
    // Full history (CryptoCompare from 2010) should have 700+ candles
    try {
      const cached = loadCache();
      if (cached.length > 0 && cached.length < 700) {
        // Cache too short = only Bybit data, purge to force full refetch
        localStorage.removeItem(CACHE_KEY);
      }
    } catch {}
    fetchAndMerge((msg) => { if (!cancelled) setProgress(msg); }).then(data => {
      if (cancelled) return;
      if (!data || data.length === 0) { setError('Impossible de récupérer les données BTC.'); setLoading(false); return; }
      setCandles(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const toggleEma = (period) => {
    setActiveEmas(prev =>
      prev.includes(period)
        ? prev.length > 1 ? prev.filter(p => p !== period) : prev
        : [...prev, period].sort((a, b) => a - b)
    );
  };
  const selectAll = () => setActiveEmas(EMA_OPTIONS.map(e => e.period));
  const selectOnly = (period) => setActiveEmas([period]);

  const resetAndRefetch = () => {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    setCandles(null);
    setError(null);
    setLoading(true);
    setProgress('🔄 Cache vidé — rechargement complet...');
    fetchAndMerge((msg) => setProgress(msg)).then(data => {
      if (!data || data.length === 0) { setError('Impossible de récupérer les données BTC.'); setLoading(false); return; }
      setCandles(data);
      setLoading(false);
    });
  };

  const slopeStats = candles
    ? activeEmas.map(period => {
        const opt = EMA_OPTIONS.find(e => e.period === period);
        const emaVals = calculateEMA(candles.map(c => c.close), period);
        const lastEma = emaVals[emaVals.length - 1];
        const prevEma = emaVals[emaVals.length - 2];
        const slope = prevEma ? ((lastEma - prevEma) / prevEma) * 100 : 0;
        return { ...opt, ema: lastEma, slope };
      })
    : [];

  const firstDate = candles?.[0]?.time;
  const lastDate = candles?.[candles.length - 1]?.time;

  return (
    <div style={{ padding: '2rem', fontFamily: "'Inter', sans-serif" }}>
      {/* ── Title ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#FFB800', margin: 0, fontSize: '1.8rem', fontWeight: 900, letterSpacing: '1px' }}>
          BTC MACRO SLOPE EMA
        </h2>
        <p style={{ color: '#444', margin: '6px 0 0 0', fontSize: '0.72rem', fontWeight: 'bold' }}>
          {candles
            ? `${candles.length} BOUGIES WEEKLY · ${firstDate} → ${lastDate} · CryptoCompare (2010+) + Bybit OHLC 💾`
            : progress}
        </p>
      </div>

      {/* ── EMA Selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        <span style={{ color: '#444', fontSize: '0.65rem', fontWeight: 'bold', marginRight: '4px' }}>SÉLECTION EMA :</span>
        {EMA_OPTIONS.map(opt => {
          const active = activeEmas.includes(opt.period);
          return (
            <button
              key={opt.period}
              onClick={() => toggleEma(opt.period)}
              onDoubleClick={() => selectOnly(opt.period)}
              title="Clic = toggle · Double-clic = isoler"
              style={{
                background: active ? opt.color : '#0d0d0d',
                color: active ? '#000' : opt.color,
                border: `1px solid ${opt.color}`,
                padding: '5px 16px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: '900', transition: 'all 0.18s ease',
                boxShadow: active ? `0 0 14px ${opt.color}66` : 'none',
                opacity: active ? 1 : 0.45,
              }}
            >
              {opt.label}
            </button>
          );
        })}
        <button onClick={selectAll} style={{ background: 'transparent', color: '#555', border: '1px solid #222', padding: '5px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold', marginLeft: '4px' }}>
          TOUT SÉLECTIONNER
        </button>
        <button
          onClick={resetAndRefetch}
          title="Vider le cache et recharger depuis CryptoCompare (2010) + Bybit"
          style={{ background: 'transparent', color: '#333', border: '1px solid #1a1a1a', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 'bold', marginLeft: 'auto' }}
        >
          🔄 RESET CACHE
        </button>
      </div>

      {/* ── Live slope stats ── */}
      {slopeStats.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {slopeStats.map(s => (
            <div key={s.period} style={{ background: '#0a0a0a', padding: '10px 14px', borderRadius: '12px', border: `1px solid ${s.color}33`, minWidth: '120px' }}>
              <span style={{ fontSize: '0.55rem', color: s.color, display: 'block', marginBottom: '3px', fontWeight: '900' }}>{s.label}</span>
              <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: '900', display: 'block' }}>${Math.round(s.ema).toLocaleString()}</span>
              <span style={{ fontSize: '0.75rem', color: s.slope >= 0 ? '#00ff88' : '#ff3b30', fontWeight: '900' }}>
                {s.slope >= 0 ? '▲' : '▼'} {Math.abs(s.slope).toFixed(4)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ height: '480px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a', borderRadius: '16px', border: '1px dashed #1a1a1a' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📡</div>
            <div style={{ color: '#888', fontWeight: 'bold', fontSize: '0.9rem' }}>CHARGEMENT DE L'HISTORIQUE BTC COMPLET</div>
            <div style={{ color: '#00ff88', fontSize: '0.75rem', marginTop: '10px', fontWeight: 'bold' }}>{progress}</div>
            <div style={{ color: '#333', fontSize: '0.65rem', marginTop: '8px' }}>Sources : CoinGecko (2013+) → Bybit (2019+, OHLC précis)</div>
          </div>
        </div>
      )}
      {error && (
        <div style={{ height: '480px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a', borderRadius: '16px', border: '1px solid rgba(255,59,48,0.2)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
            <div style={{ color: '#ff3b30', fontWeight: 'bold' }}>{error}</div>
          </div>
        </div>
      )}

      {candles && !error && (
        <>
          {/* Chart 1: Bougies + EMAs */}
          <div style={{ marginBottom: '0.8rem' }}>
            <span style={{ color: '#555', fontSize: '0.65rem', fontWeight: '900', letterSpacing: '1px' }}>
              📊 PRIX BTC + EMA — Depuis {firstDate}
            </span>
          </div>
          <MainChart candles={candles} activeEmas={activeEmas} />

          {/* Chart 2: Slopes only */}
          <div style={{ marginTop: '2rem', marginBottom: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#555', fontSize: '0.65rem', fontWeight: '900', letterSpacing: '1px' }}>
              📈 ÉVOLUTION DES SLOPES EMA — Sans bougies
            </span>
            <span style={{ color: '#222', fontSize: '0.6rem', fontWeight: 'bold' }}>
              0 = EMA plate (range) · + = momentum haussier · - = momentum baissier
            </span>
          </div>
          <SlopeChart candles={candles} activeEmas={activeEmas} />

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '1rem', padding: '0 0.2rem', flexWrap: 'wrap' }}>
            {EMA_OPTIONS.filter(e => activeEmas.includes(e.period)).map(opt => (
              <div key={opt.period} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '22px', height: '2px', background: opt.color, borderRadius: '1px' }} />
                <span style={{ color: '#555', fontSize: '0.62rem', fontWeight: 'bold' }}>Slope {opt.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
