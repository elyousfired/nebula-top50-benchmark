import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const SCORE_TIMEFRAMES = [
  { label: '1Y',  value: 'Y',   weight: 0.35 },
  { label: '1M',  value: 'M',   weight: 0.30 },
  { label: '1w',  value: 'W',   weight: 0.20 },
  { label: '1d',  value: 'D',   weight: 0.10 },
  { label: '4h',  value: '240', weight: 0.05 },
  { label: '1h',  value: '60',  weight: 0.00 },
  { label: '15m', value: '15',  weight: 0.00 },
];

const STABLECOIN_KEYWORDS = ['USDC','USDT','BUSD','TUSD','DAI','USDE','USD1','RLUSD','PYUSD','XUSD','USDS','USAT','USDTB','SOL'];

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

// Fetch klines from Bybit Spot
async function fetchBybitKlines(symbol, interval, limit = 100) {
  const res = await fetch(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Error fetching ${symbol}`);
  const json = await res.json();
  if (!json.result?.list?.length) throw new Error(`No data for ${symbol}`);
  return json.result.list.slice().reverse();
}

// Compute synthetic TOKEN / SOL ratio candles
function buildSolRatioSeries(tokenKlines, solKlines) {
  const solMap = {};
  for (const k of solKlines) solMap[parseInt(k[0])] = k;

  const synth = [];
  for (const tk of tokenKlines) {
    const ts = parseInt(tk[0]);
    const sl = solMap[ts];
    if (!sl) continue;

    const open  = parseFloat(tk[1]) / (parseFloat(sl[1]) || 1);
    const high  = parseFloat(tk[2]) / (parseFloat(sl[3]) || 1);
    const low   = parseFloat(tk[3]) / (parseFloat(sl[2]) || 1);
    const close = parseFloat(tk[4]) / (parseFloat(sl[4]) || 1);

    if (!isFinite(close) || close <= 0) continue;

    synth.push({
      time: Math.floor(ts / 1000),
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
    });
  }
  return synth;
}

// Batch helper for parallel fetching
async function mapConcurrent(items, concurrency, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        const res = await fn(items[currentIndex], currentIndex);
        if (res) results.push(res);
      } catch (_) {}
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Single Ratio Chart Card
const RatioChartCard = ({ symbol, ratioData }) => {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  const base = symbol.replace('USDT', '');
  const accentColor = ratioData?.score >= 0 ? '#00ff88' : '#ff3366';

  const candles = ratioData?.candles || [];
  const firstClose = candles[0]?.close || 1;
  const lastClose  = candles[candles.length - 1]?.close || 1;
  const perfPct    = ((lastClose - firstClose) / firstClose) * 100;

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });

    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !containerRef.current || !candles.length) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
    }

    const { precision, minMove } = getPrecision(lastClose);

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: 'transparent' }, textColor: '#9ca3af' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true, secondsVisible: false },
    });

    const series = chart.addCandlestickSeries({
      upColor: accentColor,
      downColor: '#ff3366',
      borderVisible: false,
      wickUpColor: accentColor,
      wickDownColor: '#ff3366',
      priceFormat: { type: 'price', precision, minMove },
    });

    series.setData(candles);

    series.createPriceLine({
      price: firstClose,
      color: 'rgba(255,255,255,0.25)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
    });

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, [isVisible, candles, lastClose, firstClose, accentColor]);

  return (
    <div
      ref={wrapperRef}
      style={{
        background: 'rgba(10, 15, 25, 0.85)',
        border: `1px solid ${accentColor}40`,
        borderRadius: '14px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '270px',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{
        padding: '10px 14px',
        background: `${accentColor}10`,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <span style={{ color: '#fff', fontWeight: '900', fontSize: '1.05rem' }}>{base}</span>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '4px' }}>/SOL</span>
        </div>
        <div style={{
          background: perfPct >= 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)',
          color: perfPct >= 0 ? '#00ff88' : '#ff3366',
          padding: '4px 10px',
          borderRadius: '6px',
          fontWeight: '900',
          fontSize: '0.85rem',
        }}>
          {perfPct >= 0 ? '+' : ''}{perfPct.toFixed(2)}%
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{
        padding: '6px 14px',
        background: 'rgba(0,0,0,0.4)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.72rem',
        color: '#6b7280',
      }}>
        <span>Ratio: {lastClose.toFixed(6)}</span>
        <span style={{ color: accentColor, fontWeight: 'bold' }}>
          Score Total: {ratioData?.score?.toFixed(1)} pts
        </span>
      </div>
    </div>
  );
};

// Main Multi-Timeframe Relative Strength Score Scanner
export const SolPairDivergenceScanner = () => {
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [progressMsg, setProgressMsg] = useState('Récupération de tous les tickers Bybit Spot...');
  const [rankedTokens, setRankedTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [totalScannedCount, setTotalScannedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const runScan = async () => {
      setLoading(true);
      setError(null);
      setProgressMsg('Récupération de l\'intégralité des tickers Bybit Spot...');

      try {
        const tickersRes = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
        const tickersJson = await tickersRes.json();
        const rawList = tickersJson.result?.list || [];

        // Exact Top 500 Spot pairs (excl. stablecoins and SOL)
        const candidateSymbols = rawList
          .filter(t => t.symbol.endsWith('USDT'))
          .filter(t => {
            const base = t.symbol.replace('USDT', '');
            if (STABLECOIN_KEYWORDS.some(k => base.includes(k))) return false;
            const price = parseFloat(t.lastPrice);
            if (price < 0.000001) return false;
            if (price >= 0.97 && price <= 1.03) return false;
            return true;
          })
          .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
          .slice(0, 500)
          .map(t => t.symbol);

        setTotalScannedCount(candidateSymbols.length);

        if (cancelled) return;

        // Fetch SOL klines for all 5 timeframes (1w, 1d, 4h, 1h, 15m)
        setProgressMsg(`Récupération des klines SOL/USDT pour les 5 timeframes (1w, 1d, 4h, 1h, 15m)...`);
        const solKlinesMap = {};
        for (const tf of SCORE_TIMEFRAMES) {
          solKlinesMap[tf.label] = await fetchBybitKlines('SOLUSDT', tf.value, 100);
        }

        if (cancelled) return;

        let completed = 0;
        const total = candidateSymbols.length;

        const results = await mapConcurrent(candidateSymbols, 25, async (symbol) => {
          if (cancelled) return null;
          completed++;
          if (completed % 25 === 0 || completed === total) {
            setProgressMsg(`Scan & Scoring Multi-Timeframes des ${total} Tokens Spot (${completed}/${total})...`);
          }

          try {
            const perfs = {};
            let bullishCount = 0;
            let totalWeightedPerf = 0;
            let defaultCandles = [];

            for (const tf of SCORE_TIMEFRAMES) {
              const tokKlines = await fetchBybitKlines(symbol, tf.value, 100);
              const ratioCandles = buildSolRatioSeries(tokKlines, solKlinesMap[tf.label]);

              if (ratioCandles.length < 2) {
                perfs[tf.label] = 0;
                continue;
              }

              if (tf.label === '1d') defaultCandles = ratioCandles;

              const firstClose = ratioCandles[0].close;
              const lastClose  = ratioCandles[ratioCandles.length - 1].close;
              const perf       = ((lastClose - firstClose) / firstClose) * 100;

              perfs[tf.label] = perf;
              if (perf > 0) bullishCount++;
              totalWeightedPerf += perf * tf.weight;
            }

            // Calculate total multi-timeframe score (No token is excluded!)
            const totalScore = (bullishCount * 20) + totalWeightedPerf;

            return {
              symbol,
              score: totalScore,
              bullishCount,
              perfs,
              candles: defaultCandles,
            };
          } catch (_) {
            return null;
          }
        });

        if (cancelled) return;

        // Sort ALL scanned tokens from HIGHEST SCORE to LOWEST SCORE
        const sorted = results.filter(Boolean).sort((a, b) => b.score - a.score);
        setRankedTokens(sorted);
        if (sorted.length > 0) setSelectedToken(sorted[0]);

      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    runScan();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: '2rem', background: '#050508', minHeight: '100vh', color: '#fff' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h2 style={{
          color: '#00ff88',
          fontSize: '2.2rem',
          fontWeight: '900',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '2px',
          textShadow: '0 0 30px rgba(0,255,136,0.3)',
        }}>
          SOL MULTI-TIMEFRAME RELATIVE STRENGTH SCORE 🏆
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '1rem', marginTop: '8px' }}>
          Analyse Complète de <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{totalScannedCount || 500} Tokens Spot Bybit</span> · Score sur <span style={{ color: '#facc15', fontWeight: 'bold' }}>1w, 1d, 4h, 1h, 15m</span> vs SOL · Classement du Haut vers le Bas
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '6rem', color: '#00ff88', fontSize: '1.3rem', fontWeight: 'bold' }}>
          <div style={{ marginBottom: '1rem', fontSize: '2.5rem' }}>⚡</div>
          {progressMsg}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: '#ff3366', fontSize: '1.2rem' }}>
          Erreur: {error}
        </div>
      ) : (
        <div>
          {/* Active Selected Token Chart View */}
          {selectedToken && (
            <div style={{
              marginBottom: '2.5rem',
              background: 'rgba(15, 23, 42, 0.95)',
              border: `1px solid ${selectedToken.score >= 0 ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 51, 102, 0.3)'}`,
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <span style={{
                    background: selectedToken.score >= 0 ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)',
                    color: selectedToken.score >= 0 ? '#00ff88' : '#ff3366',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                  }}>
                    🎯 TOKEN SÉLECTIONNÉ · RANG #{rankedTokens.findIndex(t => t.symbol === selectedToken.symbol) + 1} SUR {rankedTokens.length}
                  </span>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: '1.6rem', fontWeight: '900', color: '#fff' }}>
                    {selectedToken.symbol.replace('USDT','')} / SOL
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {SCORE_TIMEFRAMES.map(tf => {
                    const p = selectedToken.perfs[tf.label] || 0;
                    return (
                      <div key={tf.label} style={{
                        background: p >= 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)',
                        border: `1px solid ${p >= 0 ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`,
                        padding: '6px 12px',
                        borderRadius: '8px',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{tf.label} vs SOL</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: p >= 0 ? '#00ff88' : '#ff3366' }}>
                          {p >= 0 ? '+' : ''}{p.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}

                  <div style={{
                    background: selectedToken.score >= 0 ? 'linear-gradient(135deg, #00ff88 0%, #00d2ff 100%)' : 'linear-gradient(135deg, #ff3366 0%, #e11d48 100%)',
                    color: '#000',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>SCORE TOTAL</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '900' }}>{selectedToken.score.toFixed(1)}</div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <RatioChartCard symbol={selectedToken.symbol} ratioData={selectedToken} />
              </div>
            </div>
          )}

          {/* Full Ranking Table of ALL Scanned Tokens */}
          <div style={{ background: 'rgba(10,15,25,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <div style={{ width: '4px', height: '24px', background: '#00ff88', borderRadius: '2px' }} />
              <h3 style={{ color: '#00ff88', fontSize: '1.3rem', fontWeight: '900', margin: 0 }}>
                📋 CLASSEMENT INTÉGRAL DES {rankedTokens.length} TOKENS SPOT BYBIT (DU TOP AU BAS SCORE)
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                    <th style={{ padding: '14px' }}>Rang</th>
                    <th style={{ padding: '14px' }}>Token Spot</th>
                    <th style={{ padding: '14px' }}>Score Total</th>
                    <th style={{ padding: '14px' }}>Confluence</th>
                    <th style={{ padding: '14px' }}>1w vs SOL</th>
                    <th style={{ padding: '14px' }}>1d vs SOL</th>
                    <th style={{ padding: '14px' }}>4h vs SOL</th>
                    <th style={{ padding: '14px' }}>1h vs SOL</th>
                    <th style={{ padding: '14px' }}>15m vs SOL</th>
                    <th style={{ padding: '14px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedTokens.map((item, idx) => (
                    <tr
                      key={item.symbol}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: selectedToken?.symbol === item.symbol ? 'rgba(0,255,136,0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedToken(item)}
                    >
                      <td style={{ padding: '14px', fontWeight: '900', color: idx < 3 ? '#facc15' : '#9ca3af' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '14px', fontWeight: '900', color: '#fff', fontSize: '1rem' }}>
                        {item.symbol.replace('USDT','')}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          background: item.score >= 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)',
                          color: item.score >= 0 ? '#00ff88' : '#ff3366',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontWeight: '900',
                          border: `1px solid ${item.score >= 0 ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`,
                        }}>
                          {item.score.toFixed(1)} pts
                        </span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          color: item.bullishCount === 5 ? '#00ff88' : item.bullishCount >= 3 ? '#00d2ff' : item.bullishCount >= 1 ? '#facc15' : '#ff3366',
                          fontWeight: 'bold',
                        }}>
                          {item.bullishCount}/5 TFs 🟢
                        </span>
                      </td>
                      <td style={{ padding: '14px', color: item.perfs['1w'] >= 0 ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {item.perfs['1w'] >= 0 ? '+' : ''}{item.perfs['1w'].toFixed(1)}%
                      </td>
                      <td style={{ padding: '14px', color: item.perfs['1d'] >= 0 ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {item.perfs['1d'] >= 0 ? '+' : ''}{item.perfs['1d'].toFixed(1)}%
                      </td>
                      <td style={{ padding: '14px', color: item.perfs['4h'] >= 0 ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {item.perfs['4h'] >= 0 ? '+' : ''}{item.perfs['4h'].toFixed(1)}%
                      </td>
                      <td style={{ padding: '14px', color: item.perfs['1h'] >= 0 ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {item.perfs['1h'] >= 0 ? '+' : ''}{item.perfs['1h'].toFixed(1)}%
                      </td>
                      <td style={{ padding: '14px', color: item.perfs['15m'] >= 0 ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {item.perfs['15m'] >= 0 ? '+' : ''}{item.perfs['15m'].toFixed(1)}%
                      </td>
                      <td style={{ padding: '14px' }}>
                        <button
                          onClick={() => setSelectedToken(item)}
                          style={{
                            background: selectedToken?.symbol === item.symbol ? '#00ff88' : 'rgba(255,255,255,0.08)',
                            color: selectedToken?.symbol === item.symbol ? '#000' : '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                          }}
                        >
                          {selectedToken?.symbol === item.symbol ? 'AFFICHÉ' : 'VOIR CHART'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolPairDivergenceScanner;
