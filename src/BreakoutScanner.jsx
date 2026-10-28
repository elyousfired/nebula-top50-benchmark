import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchTop200Symbols, fetchBybitData } from './logic/scanner';
import { createChart } from 'lightweight-charts';
import { Search, Target, Info, ArrowUpRight } from 'lucide-react';

// --- ALGORITHM: BREAKOUT RESISTANCE DETECTION ---
export const detectBreakoutResistance = (klines) => {
  if (!klines || klines.length < 30) return null;

  // Bybit V5 returns list in reverse chronological order: [0] is newest.
  const sorted = [...klines].reverse();
  const PIVOT_STRENGTH = 2; // Needs 2 lower highs on each side
  
  const formattedKlines = sorted.map(k => ({
    time: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    turnover: Number(k[6]),
  }));

  const currentPrice = formattedKlines[formattedKlines.length - 1].close;

  // 1. Find all pivot highs
  const pivotHighs = [];
  for (let i = PIVOT_STRENGTH; i < formattedKlines.length - PIVOT_STRENGTH; i++) {
    let isPivotHigh = true;
    for (let j = 1; j <= PIVOT_STRENGTH; j++) {
      if (
        formattedKlines[i - j].high >= formattedKlines[i].high || 
        formattedKlines[i + j].high >= formattedKlines[i].high
      ) {
        isPivotHigh = false;
        break;
      }
    }

    if (isPivotHigh) {
      pivotHighs.push({
        index: i,
        time: formattedKlines[i].time,
        value: formattedKlines[i].high
      });
    }
  }

  // 2. Filter out broken pivots
  // A pivot is broken if ANY candle after it closes ABOVE the pivot high value
  const unbrokenPivots = [];
  for (const pivot of pivotHighs) {
    let isBroken = false;
    for (let k = pivot.index + 1; k < formattedKlines.length; k++) {
      if (formattedKlines[k].close > pivot.value) {
        isBroken = true;
        break;
      }
    }
    
    // Also, the resistance must be ABOVE the current price to be a valid future breakout
    if (!isBroken && pivot.value > currentPrice) {
      unbrokenPivots.push(pivot);
    }
  }

  if (unbrokenPivots.length === 0) return null;

  // 3. Group pivots within 2% margin
  const clusters = [];
  
  unbrokenPivots.forEach(p => {
    let added = false;
    for (const cluster of clusters) {
      const clusterAvg = cluster.pivots.reduce((sum, cp) => sum + cp.value, 0) / cluster.pivots.length;
      // if within 2% of the cluster average
      if (Math.abs(p.value - clusterAvg) / clusterAvg <= 0.02) {
        cluster.pivots.push(p);
        added = true;
        break;
      }
    }
    
    if (!added) {
      clusters.push({ pivots: [p] });
    }
  });

  const validResistances = clusters.map(cluster => {
    // Use the maximum value of the cluster as the true resistance level to break
    const maxValue = Math.max(...cluster.pivots.map(p => p.value));
    const distance = ((maxValue - currentPrice) / currentPrice) * 100;
    
    return {
      level: maxValue,
      touches: cluster.pivots.length,
      pivots: cluster.pivots,
      distance: distance
    };
  });

  // 4. Filter by <= 5% distance
  const closeResistances = validResistances.filter(r => r.distance > 0 && r.distance <= 5);

  if (closeResistances.length === 0) return null;

  // 5. Pick the closest one
  closeResistances.sort((a, b) => a.distance - b.distance);
  const closestResistance = closeResistances[0];

  // Calculate Net Flow strictly for the last 24 hours
  let netFlow = 0;
  if (formattedKlines.length > 0) {
    const latestTime = formattedKlines[formattedKlines.length - 1].time;
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    formattedKlines.forEach(k => {
      if (k.open > 0 && (latestTime - k.time) < oneDayMs) {
        netFlow += k.turnover * ((k.close - k.open) / k.open);
      }
    });
  }

  return {
    currentPrice,
    resistance: closestResistance,
    formattedKlines,
    netFlow
  };
};

const formatMoney = (val) => {
  if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
  if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
  return val.toFixed(2);
};

export const BreakoutChartItem = ({ data, timeframe, chartHeight = '220px' }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || !data.formattedKlines) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 220,
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0.05)' },
        horzLines: { color: 'rgba(0,0,0,0.05)' },
      },
      timeScale: {
        borderColor: 'rgba(0,0,0,0.05)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(0,0,0,0.05)',
        autoScale: true,
      },
      crosshair: {
        mode: 1,
      }
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff3b30',
      borderDownColor: '#ff3b30',
      borderUpColor: '#00ff88',
      wickDownColor: '#ff3b30',
      wickUpColor: '#00ff88',
    });

    const chartData = data.formattedKlines.map(k => {
      return {
        time: Math.floor(k.time / 1000),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close
      };
    });

    candlestickSeries.setData(chartData);

    // Draw Unbroken Resistance Line
    if (data.resistance) {
      const r = data.resistance;
      
      lineRef.current = candlestickSeries.createPriceLine({
        price: r.level,
        color: '#ffb300', // Yellow/Gold for resistance
        lineWidth: 2,
        lineStyle: 0, // Solid line
        axisLabelVisible: true,
        title: `RESISTANCE`,
      });
      
      const markers = r.pivots.map((p, index) => ({
        time: Math.floor(p.time / 1000),
        position: 'aboveBar',
        color: '#ffb300',
        shape: 'arrowDown',
        text: `Touch`
      }));
      
      markers.sort((a, b) => a.time - b.time);
      candlestickSeries.setMarkers(markers);
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data]);

  return (
    <div 
      style={{ 
        height: '100%',
        background: '#ffffff', 
        borderRadius: '16px', 
        padding: '1.2rem', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 0.2s, background 0.2s',
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.background = '#f8fafc';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = '#ffffff';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            {data.symbol.replace('USDT', '')}
            <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', color: '#64748b' }}>
              {timeframe}
            </span>
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              ${data.currentPrice?.toFixed(4)}
            </div>
            {data.netFlow !== undefined && (
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: data.netFlow >= 0 ? '#00e676' : '#ff3b30' }}>
                {data.netFlow >= 0 ? '+' : '-'}${formatMoney(Math.abs(data.netFlow))}
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          {data.resistance && (
            <>
              <div style={{ 
                background: 'rgba(255, 179, 0, 0.1)',
                color: '#ffb300',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <ArrowUpRight size={14} />
                {(data.resistance.distance).toFixed(2)}%
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 6, fontWeight: 600 }}>
                Res: ${data.resistance.level.toFixed(4)} <br/>
                Touches: {data.resistance.touches}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: chartHeight }}>
        <div 
          ref={chartContainerRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.04)'
          }} 
        />
      </div>
    </div>
  );
};

export const BreakoutScanner = () => {
  const [loading, setLoading] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [tokensData, setTokensData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState('D');

  const scanTokens = async () => {
    setLoading(true);
    setScanningProgress(0);
    setTokensData({});

    let symbolsList = [];
    try {
      const top200 = await fetchTop200Symbols();
      symbolsList = top200.slice(0, 100);
    } catch (err) {
      console.error("Failed to fetch top symbols", err);
      return;
    }

    const initial = {};
    symbolsList.forEach(s => {
      initial[s.symbol] = {
        symbol: s.symbol,
        currentPrice: parseFloat(s.lastPrice),
        changePercent: s.priceChangePercent,
        turnover: s.turnover24h,
        loading: true
      };
    });
    setTokensData(initial);

    const batchSize = 10;
    const listKeys = symbolsList.map(s => s.symbol);

    let firstBreakoutSymbol = null;

    for (let i = 0; i < listKeys.length; i += batchSize) {
      const chunk = listKeys.slice(i, i + batchSize);

      await Promise.all(chunk.map(async (sym) => {
        try {
          const klines = await fetchBybitData(sym, timeframe, 200); 
          if (klines && klines.length >= 15) {
            const analysis = detectBreakoutResistance(klines);
            if (analysis) {
              setTokensData(prev => {
                const newData = {
                  ...prev,
                  [sym]: {
                    ...prev[sym],
                    ...analysis,
                    loading: false
                  }
                };
                return newData;
              });

              if (analysis.resistance && !firstBreakoutSymbol) {
                firstBreakoutSymbol = sym;
              }
            } else {
              setTokensData(prev => ({ ...prev, [sym]: { ...prev[sym], loading: false } }));
            }
          } else {
            setTokensData(prev => ({ ...prev, [sym]: { ...prev[sym], loading: false, failed: true } }));
          }
        } catch (err) {
          setTokensData(prev => ({ ...prev, [sym]: { ...prev[sym], loading: false, failed: true } }));
        }
      }));

      const completed = Math.min(i + batchSize, listKeys.length);
      setScanningProgress(Math.floor((completed / listKeys.length) * 100));
      await new Promise(r => setTimeout(r, 200));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    scanTokens();
  }, [timeframe]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    const formatted = searchQuery.toUpperCase().endsWith('USDT') ? searchQuery.toUpperCase() : `${searchQuery.toUpperCase()}USDT`;
    
    setLoading(true);
    try {
      const klines = await fetchBybitData(formatted, timeframe, 200);
      if (klines && klines.length >= 15) {
        const analysis = detectBreakoutResistance(klines);
        if (analysis) {
          setTokensData(prev => {
            const newData = {
              ...prev,
              [formatted]: {
                symbol: formatted,
                currentPrice: analysis.currentPrice,
                changePercent: 0,
                turnover: 0,
                ...analysis,
                loading: false
              }
            };
            return newData;
          });
        } else {
          alert("No close unbroken resistance found for this token.");
        }
      }
    } catch (e) {
      alert("Error searching symbol.");
    }
    setLoading(false);
  };

  // Filter only tokens that have a valid close resistance
  const filteredList = Object.values(tokensData)
    .filter(t => !t.loading && !t.failed && t.resistance)
    .sort((a, b) => a.resistance.distance - b.resistance.distance); // Sort by closest distance

  return (
    <div style={{ background: '#090915', minHeight: '80vh', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, background: 'linear-gradient(90deg, #ffb300, #ff6b00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Target size={32} style={{ color: '#ffb300' }} /> BREAKOUT SCANNER
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
            Detect Top 100 assets approaching an unbroken horizontal resistance (within 5%).
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ex: SUI, SOL, BTC..." 
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px 12px 40px', borderRadius: '12px', fontSize: '0.85rem', width: '220px' }}
            />
          </div>
          <button type="submit" style={{ background: '#ffb300', color: '#090915', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>
            ANALYZE
          </button>
        </form>
      </div>

      {/* TIMEFRAME SELECTOR */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700, alignSelf: 'center', marginRight: 10 }}>TIMEFRAME:</span>
          {[
            { id: 'M', label: '1M' },
            { id: 'W', label: '1W' },
            { id: 'D', label: '1D' },
            { id: '240', label: '4H' },
            { id: '60', label: '1H' },
            { id: '15', label: '15m' },
          ].map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              style={{
                background: timeframe === tf.id ? '#ffb300' : 'rgba(255,255,255,0.05)',
                color: timeframe === tf.id ? '#090915' : '#94a3b8',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {loading && scanningProgress < 100 && (
        <div style={{ background: 'rgba(255, 179, 0, 0.1)', padding: '12px 20px', borderRadius: '12px', color: '#ffb300', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', fontWeight: 600 }}>
          <span>Scanning the market for imminent breakouts...</span>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', flex: 1, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#ffb300', width: `${scanningProgress}%`, transition: 'width 0.3s ease' }} />
          </div>
          <span>{scanningProgress}%</span>
        </div>
      )}

      {/* GRID LAYOUT */}
      {!loading && filteredList.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <Target size={48} style={{ color: '#ffb300', opacity: 0.5, marginBottom: '1rem' }} />
          <h3>No setups found</h3>
          <p>We couldn't find any tokens approaching a valid horizontal resistance within 5%.</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {filteredList.map(item => (
            <BreakoutChartItem key={item.symbol} data={item} timeframe={timeframe} />
          ))}
        </div>
      )}
    </div>
  );
};
