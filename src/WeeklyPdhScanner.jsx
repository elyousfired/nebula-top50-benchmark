import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import pdhData from './data/pdh_scan.json';

const TIMEFRAMES = [
  { label: '5m',  value: '5'   },
  { label: '15m', value: '15'  },
  { label: '1h',  value: '60'  },
  { label: '4h',  value: '240' },
  { label: '1d',  value: 'D'   },
];

// ── Precision helper ──────────────────────────────────────────────────────────
function getPrecision(p) {
  if (p < 0.000001) return { precision: 9, minMove: 0.000000001 };
  if (p < 0.00001)  return { precision: 8, minMove: 0.00000001 };
  if (p < 0.0001)   return { precision: 7, minMove: 0.0000001 };
  if (p < 0.001)    return { precision: 6, minMove: 0.000001 };
  if (p < 0.01)     return { precision: 5, minMove: 0.00001 };
  if (p < 0.1)      return { precision: 4, minMove: 0.0001 };
  if (p < 1)        return { precision: 3, minMove: 0.001 };
  if (p < 10)       return { precision: 3, minMove: 0.001 };
  return { precision: 2, minMove: 0.01 };
}

// ── Fetch klines from Bybit Spot ─────────────────────────────────────────────
async function fetchBybitSpot(symbol, interval, startTime) {
  const res = await fetch(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=1000&start=${startTime}`
  );
  if (!res.ok) throw new Error(`Bybit error ${symbol}`);
  const json = await res.json();
  if (!json.result?.list?.length) throw new Error(`No data for ${symbol}`);
  return json.result.list.slice().reverse(); // oldest first
}

// ── Build candles + VWAP max/min ─────────────────────────────────────────────
function buildCandles(rawKlines) {
  let cumVol = 0, cumQuote = 0, currentDayTs = null;
  let weekMax = 0, weekMin = Infinity;
  const candles = [];

  for (const k of rawKlines) {
    const ts      = parseInt(k[0]);
    const volume   = parseFloat(k[5]);
    const quoteVol = parseFloat(k[6]);

    const d = new Date(ts); d.setUTCHours(0, 0, 0, 0);
    const dayTs = d.getTime();
    if (dayTs !== currentDayTs) { cumVol = 0; cumQuote = 0; currentDayTs = dayTs; }
    cumVol += volume; cumQuote += quoteVol;
    const vwap = cumVol > 0 ? cumQuote / cumVol : parseFloat(k[4]);
    if (vwap > weekMax) weekMax = vwap;
    if (vwap < weekMin) weekMin = vwap;

    candles.push({
      time:  Math.floor(ts / 1000),
      open:  parseFloat(k[1]),
      high:  parseFloat(k[2]),
      low:   parseFloat(k[3]),
      close: parseFloat(k[4]),
    });
  }
  return { candles, weekMax: weekMax > 0 ? weekMax : null, weekMin: weekMin < Infinity ? weekMin : null };
}

// ── Build synthetic token/SOL candles + VWAP ────────────────────────────────
function buildSolRatio(tokenKlines, solKlines) {
  const solMap = {};
  for (const k of solKlines) solMap[parseInt(k[0])] = k;

  let cumVol = 0, cumQuote = 0, currentDayTs = null;
  let weekMax = 0, weekMin = Infinity;
  const synth = [];

  for (const tk of tokenKlines) {
    const sl = solMap[parseInt(tk[0])];
    if (!sl) continue;
    const open  = parseFloat(tk[1]) / (parseFloat(sl[1]) || 1);
    const high  = parseFloat(tk[2]) / (parseFloat(sl[3]) || 1);
    const low   = parseFloat(tk[3]) / (parseFloat(sl[2]) || 1);
    const close = parseFloat(tk[4]) / (parseFloat(sl[4]) || 1);
    if (!isFinite(close) || close <= 0) continue;

    const finalHigh = Math.max(high, open, close);
    const finalLow  = Math.min(low,  open, close);
    const typical   = (finalHigh + finalLow + close) / 3;
    const volume    = parseFloat(tk[5]);

    // Reset VWAP at each new UTC day
    const ts = parseInt(tk[0]);
    const d  = new Date(ts); d.setUTCHours(0, 0, 0, 0);
    const dayTs = d.getTime();
    if (dayTs !== currentDayTs) { cumVol = 0; cumQuote = 0; currentDayTs = dayTs; }
    cumVol   += volume;
    cumQuote += typical * volume;
    const vwap = cumVol > 0 ? cumQuote / cumVol : typical;

    if (vwap > weekMax) weekMax = vwap;
    if (vwap < weekMin) weekMin = vwap;

    synth.push({ time: Math.floor(ts / 1000), open, close, high: finalHigh, low: finalLow });
  }

  return {
    candles: synth,
    weekMax: weekMax > 0 ? weekMax : null,
    weekMin: weekMin < Infinity ? weekMin : null,
  };
}

// ── Single chart renderer ────────────────────────────────────────────────────
function renderChart(container, candles, weekMax, weekMin) {
  if (!container || !candles.length) return null;
  container.innerHTML = '';

  const mid = (candles[0].close + candles[candles.length - 1].close) / 2;
  const { precision, minMove } = getPrecision(mid);

  const chart = createChart(container, {
    width:  container.clientWidth,
    height: container.clientHeight,
    layout: { background: { color: 'transparent' }, textColor: '#b2b5be' },
    grid: { vertLines: { color: 'rgba(42,46,57,0.2)' }, horzLines: { color: 'rgba(42,46,57,0.2)' } },
    crosshair: { mode: 0 },
    rightPriceScale: { borderColor: 'rgba(42,46,57,0.4)' },
    timeScale: { borderColor: 'rgba(42,46,57,0.4)', timeVisible: true, secondsVisible: false },
  });

  const series = chart.addCandlestickSeries({
    upColor: '#00ff88', downColor: '#ff3366',
    borderVisible: false,
    wickUpColor: '#00ff88', wickDownColor: '#ff3366',
    priceFormat: { type: 'price', precision, minMove },
  });
  series.setData(candles);

  if (weekMax) {
    series.createPriceLine({ price: weekMax, color: '#9945FF', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: 'MAX' });
  }
  if (weekMin) {
    series.createPriceLine({ price: weekMin, color: '#00ff88', lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: 'MIN' });
  }

  chart.timeScale().fitContent();
  return chart;
}

// ─── Chart pair component ─────────────────────────────────────────────────────
const PdhChart = ({ tokenInfo }) => {
  const symbol = tokenInfo.symbol;

  const [timeframe,    setTimeframe]    = useState(TIMEFRAMES[2]);
  const [weeklyMaxVwap, setWeeklyMaxVwap] = useState(null);
  const [weeklyMinVwap, setWeeklyMinVwap] = useState(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);
  const [isVisible,    setIsVisible]    = useState(false);

  const wrapperRef   = useRef(null);
  const usdtRef      = useRef(null);   // token/USDT container
  const solRef       = useRef(null);   // token/SOL container
  const chartUsdtRef = useRef(null);
  const chartSolRef  = useRef(null);

  // ── Lazy loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { rootMargin: '400px' });
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Fetch + render ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    const run = async () => {
      setIsLoading(true); setError(null);
      try {
        // Monday 00:00 UTC
        const now  = new Date();
        const diff = (now.getUTCDay() + 6) % 7;
        const monday = new Date(now);
        monday.setUTCDate(now.getUTCDate() - diff);
        monday.setUTCHours(0, 0, 0, 0);
        const mondayTs = monday.getTime();

        // Fetch token + SOL klines in parallel
        const [tokenKlines, solKlines] = await Promise.all([
          fetchBybitSpot(symbol,     timeframe.value, mondayTs),
          fetchBybitSpot('SOLUSDT',  timeframe.value, mondayTs),
        ]);
        if (cancelled) return;

        // Build token/USDT candles + VWAP stats
        const { candles: usdtCandles, weekMax, weekMin } = buildCandles(tokenKlines);

        // Build token/SOL synthetic ratio + its VWAP
        const { candles: solCandles, weekMax: solWeekMax, weekMin: solWeekMin } = buildSolRatio(tokenKlines, solKlines);

        if (!cancelled) {
          setWeeklyMaxVwap(weekMax);
          setWeeklyMinVwap(weekMin);
        }

        // Destroy old charts
        if (chartUsdtRef.current) { try { chartUsdtRef.current.remove(); } catch(_) {} chartUsdtRef.current = null; }
        if (chartSolRef.current)  { try { chartSolRef.current.remove();  } catch(_) {} chartSolRef.current  = null; }

        if (usdtRef.current && usdtCandles.length)
          chartUsdtRef.current = renderChart(usdtRef.current, usdtCandles, weekMax, weekMin);

        if (solRef.current && solCandles.length)
          chartSolRef.current = renderChart(solRef.current, solCandles, solWeekMax, solWeekMin);

        // Resize handler
        const onResize = () => {
          [chartUsdtRef, chartSolRef].forEach((ref, i) => {
            const cont = i === 0 ? usdtRef.current : solRef.current;
            if (ref.current && cont) {
              ref.current.applyOptions({ width: cont.clientWidth, height: cont.clientHeight });
            }
          });
        };
        window.addEventListener('resize', onResize);

      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [symbol, timeframe, isVisible]);

  const base = symbol.replace('USDT', '');

  return (
    <div ref={wrapperRef} style={{
      background: 'rgba(15,20,25,0.85)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{
        height: '52px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        background: 'rgba(10,15,20,0.7)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
            {base}<span style={{ color: '#555', fontSize: '0.75rem' }}>/USDT</span>
          </h3>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#9ca3af' }}>
            {base}<span style={{ color: '#555', fontSize: '0.75rem' }}>/SOL</span>
          </h3>
        </div>

        {/* Timeframe buttons */}
        <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: '8px' }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf.value} onClick={() => setTimeframe(tf)} style={{
              background: timeframe.value === tf.value ? 'rgba(153,69,255,0.25)' : 'transparent',
              color:      timeframe.value === tf.value ? '#9945FF' : '#666',
              border: 'none', padding: '4px 11px', borderRadius: '5px',
              cursor: 'pointer', fontSize: '0.72rem',
              fontWeight: timeframe.value === tf.value ? '900' : 'bold',
              transition: 'all 0.15s',
            }}>{tf.label}</button>
          ))}
        </div>
      </div>

      {/* ── Two charts side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative' }}>
        {/* Token / USDT */}
        <div style={{ height: '420px', position: 'relative', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ position: 'absolute', top: '8px', left: '12px', zIndex: 5, fontSize: '0.65rem', fontWeight: 'bold', color: 'rgba(153,69,255,0.8)', pointerEvents: 'none' }}>
            {base}/USDT
          </div>
          {isLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', zIndex: 10 }}>
              <span style={{ color: '#9945FF', fontWeight: 'bold', fontSize: '0.85rem' }}>Chargement…</span>
            </div>
          )}
          {error && !isLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,0,0,0.07)', color: '#ff3366', fontWeight: 'bold', zIndex: 10, fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>
              {error}
            </div>
          )}
          <div ref={usdtRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Token / SOL */}
        <div style={{ height: '420px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '8px', left: '12px', zIndex: 5, fontSize: '0.65rem', fontWeight: 'bold', color: 'rgba(0,255,136,0.8)', pointerEvents: 'none' }}>
            {base}/SOL
          </div>
          {isLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', zIndex: 10 }}>
              <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '0.85rem' }}>Calcul ratio…</span>
            </div>
          )}
          <div ref={solRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      {/* ── Footer legend ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '7px 20px',
        background: 'rgba(10,15,20,0.9)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.67rem', color: '#888' }}>
          <span style={{ color: '#9945FF', fontWeight: 'bold' }}>━</span> VWAP MAX :
          <span style={{ color: '#9945FF', fontWeight: 'bold', marginLeft: '4px' }}>
            {weeklyMaxVwap ? weeklyMaxVwap.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
          </span>
        </span>
        <span style={{ fontSize: '0.67rem', color: '#888' }}>
          <span style={{ color: '#00ff88', fontWeight: 'bold' }}>━</span> VWAP MIN :
          <span style={{ color: '#00ff88', fontWeight: 'bold', marginLeft: '4px' }}>
            {weeklyMinVwap ? weeklyMinVwap.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
          </span>
        </span>
        <span style={{ fontSize: '0.67rem', color: '#555' }}>
          {tokenInfo.daysConsolidating} jours · ${(tokenInfo.volume24h / 1e6).toFixed(1)}M vol
        </span>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const WeeklyPdhScanner = () => {
  const [tokens] = useState(pdhData);

  return (
    <div style={{ padding: '2rem', background: '#050505', minHeight: '100vh', color: '#fff' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#9945FF', fontSize: '2.2rem', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          WEEKLY VWAP CONSOLIDATION
        </h2>
        <p style={{ color: '#666', fontSize: '1rem', marginTop: '10px' }}>
          Tokens dont le pic VWAP journalier reste dans un tunnel <span style={{ color: '#ffaa00', fontWeight: 'bold' }}>±2%</span> depuis Lundi · Spot Bybit
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '10px', fontSize: '0.73rem', color: '#555' }}>
          <span>Gauche : <span style={{ color: '#9945FF' }}>TOKEN / USDT</span></span>
          <span>Droite : <span style={{ color: '#00ff88' }}>TOKEN / SOL</span> (ratio synthétique)</span>
        </div>
      </div>

      {tokens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: '#555', fontSize: '1.5rem' }}>
          Aucun token en consolidation VWAP cette semaine.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {tokens.map(t => <PdhChart key={t.symbol} tokenInfo={t} />)}
        </div>
      )}
    </div>
  );
};
