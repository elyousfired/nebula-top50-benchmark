import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const BASE_TOKENS = ['BTCUSDT', 'SOLUSDT', 'SUIUSDT', 'ETHUSDT', 'BNBUSDT'];
const BASE_COLORS = {
  BTCUSDT: '#F7931A',
  SOLUSDT: '#9945FF',
  SUIUSDT: '#4DA2FF',
  ETHUSDT: '#627EEA',
  BNBUSDT: '#F0B90B',
};

const TIMEFRAMES = [
  { label: '5m',  value: '5'   },
  { label: '15m', value: '15'  },
  { label: '1h',  value: '60'  },
  { label: '4h',  value: '240' },
  { label: '1d',  value: 'D'   },
];

// Build volatility candles: open=close=1, high=H/L, low=L/H
// Each candle wick shows how wide the token swung in that period
function buildVolatilityCandles(rawKlines) {
  return rawKlines.map(k => {
    const h = parseFloat(k[2]);
    const l = parseFloat(k[3]);
    const ratio    = l > 0 ? h / l : 1;
    const invRatio = h > 0 ? l / h : 1;
    return {
      time:  Math.floor(parseInt(k[0]) / 1000),
      open:  1,
      high:  Math.max(ratio, 1),
      low:   Math.min(invRatio, 1),
      close: 1,
    };
  });
}

// Fetch klines from Bybit Spot, returns oldest-first
async function fetchBybitKlines(symbol, interval, limit = 200) {
  const res = await fetch(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Bybit error for ${symbol}`);
  const json = await res.json();
  if (!json.result?.list?.length) throw new Error(`No data for ${symbol}`);
  return json.result.list.slice().reverse(); // oldest first
}

// ── Single volatility chart ───────────────────────────────────────────────────
const VolatilityChart = ({ symbol, timeframe, accentColor }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [avgVol, setAvgVol]       = useState(null); // average volatility %

  const wrapperRef = useRef(null);
  const chartRef   = useRef(null);
  const containerRef = useRef(null);

  // Lazy load
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { rootMargin: '400px' });
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch + render
  useEffect(() => {
    if (!isVisible || !containerRef.current) return;
    let cancelled = false;

    const run = async () => {
      setIsLoading(true); setError(null);
      try {
        const rawKlines = await fetchBybitKlines(symbol, timeframe.value, 200);
        if (cancelled) return;

        const candles = buildVolatilityCandles(rawKlines);

        // Compute average volatility (avg high/low ratio - 1)
        const avgRatio = candles.reduce((s, c) => s + (c.high - 1), 0) / candles.length;
        if (!cancelled) setAvgVol((avgRatio * 100).toFixed(2));

        // Destroy old chart
        if (chartRef.current) { try { chartRef.current.remove(); } catch(_) {} chartRef.current = null; }

        const chart = createChart(containerRef.current, {
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
          layout: { background: { color: 'transparent' }, textColor: '#b2b5be' },
          grid: {
            vertLines: { color: 'rgba(42,46,57,0.15)' },
            horzLines: { color: 'rgba(42,46,57,0.15)' },
          },
          crosshair: { mode: 0 },
          rightPriceScale: { borderColor: 'rgba(42,46,57,0.4)' },
          timeScale: { borderColor: 'rgba(42,46,57,0.4)', timeVisible: true, secondsVisible: false },
        });

        const series = chart.addCandlestickSeries({
          upColor:      accentColor || '#00ff88',
          downColor:    accentColor || '#00ff88',
          borderVisible: false,
          wickUpColor:   accentColor || '#00ff88',
          wickDownColor: accentColor || '#ff3366',
          priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        });
        series.setData(candles);

        // Baseline at 1.0
        series.createPriceLine({
          price: 1,
          color: 'rgba(255,255,255,0.3)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '1.0',
        });

        chart.timeScale().fitContent();
        chartRef.current = chart;

        const onResize = () => {
          if (containerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width:  containerRef.current.clientWidth,
              height: containerRef.current.clientHeight,
            });
          }
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
  const color = accentColor || '#00ff88';

  return (
    <div ref={wrapperRef} style={{
      background: 'rgba(12,16,22,0.9)',
      border: `1px solid ${color}22`,
      borderRadius: '14px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '280px',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px',
        borderBottom: `1px solid ${color}18`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: `${color}08`,
        flexShrink: 0,
      }}>
        <span style={{ color, fontWeight: '900', fontSize: '0.95rem' }}>
          {base}
          <span style={{ color: '#444', fontSize: '0.65rem', marginLeft: '4px' }}>/ volatility</span>
        </span>
        {avgVol !== null && (
          <span style={{
            background: `${color}18`,
            color,
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
          }}>
            avg {avgVol}%
          </span>
        )}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 5 }}>
            <span style={{ color, fontWeight: 'bold', fontSize: '0.8rem' }}>…</span>
          </div>
        )}
        {error && !isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff3366', fontSize: '0.7rem', padding: '1rem', textAlign: 'center' }}>
            {error}
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const VolatilityScanner = () => {
  const [timeframe, setTimeframe]   = useState(TIMEFRAMES[2]); // 1h default
  const [top100,    setTop100]      = useState([]);
  const [loading,   setLoading]     = useState(true);

  // Fetch top 100 Bybit Spot tokens (excl. stablecoins & base tokens)
  useEffect(() => {
    const STABLE = ['USDC','USDT','BUSD','TUSD','DAI','USDE','USD1','RLUSD','PYUSD','XUSD','USDS','USAT','USDTB'];
    const fetchTop100 = async () => {
      try {
        const res  = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
        const json = await res.json();
        const list = json.result?.list || [];
        const filtered = list
          .filter(t => t.symbol.endsWith('USDT'))
          .filter(t => {
            const base = t.symbol.replace('USDT', '');
            if (STABLE.some(s => base.includes(s))) return false;
            if (BASE_TOKENS.includes(t.symbol)) return false; // shown separately
            const price = parseFloat(t.lastPrice);
            if (price < 0.000001) return false;
            if (price >= 0.97 && price <= 1.03) return false;
            if (parseFloat(t.turnover24h) < 500000) return false;
            return true;
          })
          .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
          .slice(0, 100)
          .map(t => t.symbol);
        setTop100(filtered);
      } catch (e) {
        console.error('Failed to fetch top 100', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTop100();
  }, []);

  return (
    <div style={{ padding: '2rem', background: '#050505', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#00d2ff', fontSize: '2.2rem', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          VOLATILITY SCANNER
        </h2>
        <p style={{ color: '#555', fontSize: '0.95rem', marginTop: '8px' }}>
          Chaque bougie = <span style={{ color: '#fff' }}>High / Low</span> de la période · Plus la mèche est courte, plus le token est stable
        </p>

        {/* Timeframe selector */}
        <div style={{ display: 'inline-flex', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '10px', marginTop: '16px' }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf.value} onClick={() => setTimeframe(tf)} style={{
              background: timeframe.value === tf.value ? 'rgba(0,210,255,0.2)' : 'transparent',
              color:      timeframe.value === tf.value ? '#00d2ff' : '#555',
              border: 'none', padding: '6px 16px', borderRadius: '7px',
              cursor: 'pointer', fontSize: '0.8rem',
              fontWeight: timeframe.value === tf.value ? '900' : 'bold',
              transition: 'all 0.15s',
            }}>{tf.label}</button>
          ))}
        </div>
      </div>

      {/* ── Section: 5 Reference tokens ── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <div style={{ width: '4px', height: '20px', background: '#00d2ff', borderRadius: '2px' }} />
          <span style={{ color: '#00d2ff', fontWeight: '900', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Références du marché
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          {BASE_TOKENS.map(sym => (
            <VolatilityChart key={sym} symbol={sym} timeframe={timeframe} accentColor={BASE_COLORS[sym]} />
          ))}
        </div>
      </div>

      {/* ── Section: Top 100 tokens ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <div style={{ width: '4px', height: '20px', background: '#ffaa00', borderRadius: '2px' }} />
          <span style={{ color: '#ffaa00', fontWeight: '900', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Top 100 Bybit Spot
          </span>
          {!loading && (
            <span style={{ color: '#555', fontSize: '0.8rem' }}>{top100.length} tokens</span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#555' }}>Chargement du top 100…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {top100.map(sym => (
              <VolatilityChart key={sym} symbol={sym} timeframe={timeframe} accentColor={null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VolatilityScanner;
