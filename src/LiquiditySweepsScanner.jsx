import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchTop500Symbols, fetchBybitData } from './logic/scanner';
import { createChart } from 'lightweight-charts';
import { Search, Droplet, List, Grid, Info } from 'lucide-react';

// --- ALGORITHM: LIQUIDITY SWEEP DETECTION ---
const detectSweeps = (klines) => {
  if (!klines || klines.length < 30) return null;

  // Bybit V5 returns list in reverse chronological order: [0] is newest.
  // We want oldest to newest for the algorithm
  const sorted = [...klines].reverse();
  const PIVOT_STRENGTH = 2; // Needs 2 lower highs/higher lows on each side
  
  // Format klines for easier access
  const formattedKlines = sorted.map(k => ({
    time: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    turnover: Number(k[6]),
  }));

  let netFlow = 0;
  if (formattedKlines.length > 0) {
    const latestTime = formattedKlines[formattedKlines.length - 1].time;
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    formattedKlines.forEach(k => {
      // Calculate Net Flow strictly for the last 24 hours
      if (k.open > 0 && (latestTime - k.time) < oneDayMs) {
        netFlow += k.turnover * ((k.close - k.open) / k.open);
      }
    });
  }

  const sweeps = [];

  // Find Pivot Highs & Bearish Sweeps
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
      const pivotHighValue = formattedKlines[i].high;
      let sweepCount = 0;
      let lastSweepIndex = -1;
      let lastSweepTime = null;

      // Look for candles that break this pivot high
      for (let k = i + PIVOT_STRENGTH + 1; k < formattedKlines.length; k++) {
        if (formattedKlines[k].high > pivotHighValue) {
          // It broke the pivot high. Did it sweep? (Close and Open both below the pivot)
          if (Math.max(formattedKlines[k].open, formattedKlines[k].close) < pivotHighValue) {
            sweepCount++;
            lastSweepIndex = k;
            lastSweepTime = formattedKlines[k].time;
          } else {
            // Clean breakout (candle closed above pivot). Pivot is invalidated.
            break; 
          }
        }
      }

      if (sweepCount > 0) {
        sweeps.push({
          type: 'BEARISH_SWEEP',
          pivotIndex: i,
          pivotTime: formattedKlines[i].time,
          pivotValue: pivotHighValue,
          sweepIndex: lastSweepIndex,
          sweepTime: lastSweepTime,
          sweepCount: sweepCount,
          distanceToCurrent: ((formattedKlines[formattedKlines.length - 1].close / pivotHighValue) - 1) * 100
        });
      }
    }
  }

  // Find Pivot Lows & Bullish Sweeps
  for (let i = PIVOT_STRENGTH; i < formattedKlines.length - PIVOT_STRENGTH; i++) {
    let isPivotLow = true;
    for (let j = 1; j <= PIVOT_STRENGTH; j++) {
      if (
        formattedKlines[i - j].low <= formattedKlines[i].low || 
        formattedKlines[i + j].low <= formattedKlines[i].low
      ) {
        isPivotLow = false;
        break;
      }
    }

    if (isPivotLow) {
      const pivotLowValue = formattedKlines[i].low;
      let sweepCount = 0;
      let lastSweepIndex = -1;
      let lastSweepTime = null;

      for (let k = i + PIVOT_STRENGTH + 1; k < formattedKlines.length; k++) {
        if (formattedKlines[k].low < pivotLowValue) {
          // It broke the pivot low. Did it sweep? (Close and Open both above the pivot)
          if (Math.min(formattedKlines[k].open, formattedKlines[k].close) > pivotLowValue) {
            sweepCount++;
            lastSweepIndex = k;
            lastSweepTime = formattedKlines[k].time;
          } else {
            // Clean breakdown (candle closed below pivot). Pivot is invalidated.
            break;
          }
        }
      }

      if (sweepCount > 0) {
        sweeps.push({
          type: 'BULLISH_SWEEP',
          pivotIndex: i,
          pivotTime: formattedKlines[i].time,
          pivotValue: pivotLowValue,
          sweepIndex: lastSweepIndex,
          sweepTime: lastSweepTime,
          sweepCount: sweepCount,
          distanceToCurrent: ((formattedKlines[formattedKlines.length - 1].close / pivotLowValue) - 1) * 100
        });
      }
    }
  }

  // Sort sweeps by most recent sweep index
  sweeps.sort((a, b) => b.sweepIndex - a.sweepIndex);
  
  // Return the most recent sweep if exists, else null
  const mostRecentSweep = sweeps.length > 0 ? sweeps[0] : null;

  return {
    currentPrice: formattedKlines[formattedKlines.length - 1].close,
    sweep: mostRecentSweep,
    allSweeps: sweeps,
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

// --- MAIN COMPONENT ---
export const LiquiditySweepsScanner = ({ initialSearch }) => {
  const [loading, setLoading] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [tokensData, setTokensData] = useState({});
  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [selectedSymbol, setSelectedSymbol] = useState(initialSearch || null);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'BULLISH', 'BEARISH'
  const [layoutMode, setLayoutMode] = useState('TABLE'); // For future grid expansion
  const [timeframe, setTimeframe] = useState('D');

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const lineRef = useRef(null);
  const markerRef = useRef(null);

  // Progressive background scan of Top 100 assets on mount
  const scanTokens = async () => {
    setLoading(true);
    setScanningProgress(0);
    setTokensData({});

    let symbolsList = [];
    try {
      const top500 = await fetchTop500Symbols();
      symbolsList = top500;
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

    let firstSweepSymbol = null;

    for (let i = 0; i < listKeys.length; i += batchSize) {
      const chunk = listKeys.slice(i, i + batchSize);

      await Promise.all(chunk.map(async (sym) => {
        try {
          // Fetch enough candles for the chosen timeframe
          const klines = await fetchBybitData(sym, timeframe, 200); 
          if (klines && klines.length >= 15) {
            const analysis = detectSweeps(klines);
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

              if (analysis.sweep && !firstSweepSymbol) {
                firstSweepSymbol = sym;
              }
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
    
    if (firstSweepSymbol && !selectedSymbol) {
      setSelectedSymbol(firstSweepSymbol);
    } else if (symbolsList.length > 0 && !selectedSymbol) {
      setSelectedSymbol(symbolsList[0].symbol);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (initialSearch) {
       handleSearchSubmit({ preventDefault: () => {} }, initialSearch);
    } else {
       scanTokens();
    }
  }, [timeframe, initialSearch]);

  // Update chart options when Selection Mode toggles
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        handleScroll: !isSelectionMode,
        handleScale: !isSelectionMode,
        crosshair: {
          mode: isSelectionMode ? 0 : 1, // hidden during selection, or normal
        }
      });
    }
  }, [isSelectionMode]);

  // Selection Mouse Handlers
  const handleMouseDown = (e) => {
    if (!isSelectionMode || !chartRef.current || !chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const logical = chartRef.current.timeScale().coordinateToLogical(x);
    if (logical === null) return;
    
    setIsDragging(true);
    setSelectionBox({
      startX: x,
      currentX: x,
      startLogical: Math.round(logical),
      endLogical: Math.round(logical),
      netFlow: 0
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !isSelectionMode || !chartRef.current || !chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    
    const logical = chartRef.current.timeScale().coordinateToLogical(x);
    if (logical === null) return;

    setSelectionBox(prev => {
      if (!prev) return null;
      
      const startLogical = prev.startLogical;
      const endLogical = Math.round(logical);
      
      const klines = selectedSymbolData?.formattedKlines;
      let flow = 0;
      
      if (klines) {
        const minIdx = Math.max(0, Math.min(startLogical, endLogical));
        const maxIdx = Math.min(klines.length - 1, Math.max(startLogical, endLogical));
        
        for (let i = minIdx; i <= maxIdx; i++) {
           const k = klines[i];
           if (k && k.open > 0) {
              flow += k.turnover * ((k.close - k.open) / k.open);
           }
        }
      }
      
      return {
        ...prev,
        currentX: x,
        endLogical,
        netFlow: flow
      };
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleSearchSubmit = async (e, tokenOverride = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetToken = tokenOverride || searchQuery;
    if (!targetToken) return;
    const formatted = targetToken.toUpperCase().endsWith('USDT') ? targetToken.toUpperCase() : `${targetToken.toUpperCase()}USDT`;
    
    setLoading(true);
    try {
      const klines = await fetchBybitData(formatted, timeframe, 200);
      if (klines && klines.length >= 30) {
        const analysis = detectSweeps(klines);
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
          setSelectedSymbol(formatted);
        }
      }
    } catch (e) {
      alert("Error searching symbol.");
    }
    setLoading(false);
  };

  const selectedSymbolData = useMemo(() => {
    if (!selectedSymbol) return null;
    return tokensData[selectedSymbol] || null;
  }, [selectedSymbol, tokensData]);

  // Render Chart
  useEffect(() => {
    if (!chartContainerRef.current || !selectedSymbolData || !selectedSymbolData.formattedKlines) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#090915' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.02)' },
        horzLines: { color: 'rgba(255,255,255,0.02)' },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.05)',
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

    const chartData = selectedSymbolData.formattedKlines.map(k => {
      return {
        // lightweight-charts accepts UNIX timestamps in seconds for all timeframes
        time: Math.floor(k.time / 1000),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        originalTime: k.time
      };
    });

    candlestickSeries.setData(chartData);

    // Draw Sweep Line and Markers
    if (selectedSymbolData.sweep) {
      const s = selectedSymbolData.sweep;
      
      const isBullish = s.type === 'BULLISH_SWEEP';
      const color = isBullish ? '#00ff88' : '#ff3b30';
      const label = isBullish ? 'BULLISH SWEEP (SELL-SIDE LIQUIDITY)' : 'BEARISH SWEEP (BUY-SIDE LIQUIDITY)';
      
      lineRef.current = candlestickSeries.createPriceLine({
        price: s.pivotValue,
        color: color,
        lineWidth: 2,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: `${label} (x${s.sweepCount})`,
      });

      // Add a marker on the sweeping candle
      const sweepingCandleData = chartData.find(c => c.originalTime === s.sweepTime);
      if (sweepingCandleData) {
        candlestickSeries.setMarkers([
          {
            time: sweepingCandleData.time,
            position: isBullish ? 'belowBar' : 'aboveBar',
            color: color,
            shape: isBullish ? 'arrowUp' : 'arrowDown',
            text: `SWEEP (x${s.sweepCount})`,
          }
        ]);
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [selectedSymbol, selectedSymbolData]);

  // Filter List
  const filteredList = useMemo(() => {
    return Object.values(tokensData)
      .filter(item => {
        // Exclude tokens with negative or zero Net Flow
        if (item.netFlow === undefined || item.netFlow <= 0) return false;

        if (!item.sweep && filterType !== 'ALL') return false;
        if (filterType === 'BULLISH') return item.sweep?.type === 'BULLISH_SWEEP';
        if (filterType === 'BEARISH') return item.sweep?.type === 'BEARISH_SWEEP';
        return true;
      })
      .sort((a, b) => {
        return (b.netFlow || 0) - (a.netFlow || 0);
      });
  }, [tokensData, filterType]);

  return (
    <div style={{ background: '#090915', minHeight: '80vh', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, background: 'linear-gradient(90deg, #00e5ff, #00ff88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Droplet size={32} style={{ color: '#00e5ff' }} /> LIQUIDITY SWEEPS SCANNER
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
            Identify institutional liquidity sweeps (Turtle Soup) on a 1-Month Daily (1D) window across Top 100 Bybit assets.
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
          <button type="submit" style={{ background: '#00e5ff', color: '#090915', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>
            ANALYZE
          </button>
        </form>
      </div>

      {/* FILTER BUTTONS & TIMEFRAME */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'ALL', label: '📊 TOUT' },
            { id: 'BULLISH', label: '🟢 BULLISH SWEEPS' },
            { id: 'BEARISH', label: '🔴 BEARISH SWEEPS' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              style={{
                background: filterType === f.id ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                color: filterType === f.id ? '#00e5ff' : '#94a3b8',
                border: `1px solid ${filterType === f.id ? '#00e5ff' : 'rgba(255,255,255,0.05)'}`,
                padding: '8px 20px',
                borderRadius: '30px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

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
                background: timeframe === tf.id ? '#00e5ff' : 'rgba(255,255,255,0.05)',
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
        <div style={{ background: 'rgba(0, 229, 255, 0.1)', padding: '12px 20px', borderRadius: '12px', color: '#00e5ff', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', fontWeight: 600 }}>
          <span>Scanning the market for liquidity sweeps...</span>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', flex: 1, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#00e5ff', width: `${scanningProgress}%`, transition: 'width 0.3s ease' }} />
          </div>
          <span>{scanningProgress}%</span>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN: TABLE */}
        <div style={{ flex: '0 0 450px', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '700px', overflowY: 'auto', paddingRight: '10px' }}>
          {filteredList.map(item => {
            const isSelected = selectedSymbol === item.symbol;
            return (
              <div 
                key={item.symbol}
                onClick={() => setSelectedSymbol(item.symbol)}
                style={{
                  background: isSelected ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${isSelected ? '#00e5ff' : 'rgba(255,255,255,0.02)'}`,
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{item.symbol.replace('USDT', '')}</h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      ${item.currentPrice?.toFixed(4)}
                    </div>
                    {item.netFlow !== undefined && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: item.netFlow >= 0 ? '#00e676' : '#ff3b30' }}>
                        NF: {item.netFlow >= 0 ? '+' : '-'}${formatMoney(Math.abs(item.netFlow))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {item.sweep ? (
                    <>
                      <div style={{ 
                        background: item.sweep.type === 'BULLISH_SWEEP' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 59, 48, 0.15)',
                        color: item.sweep.type === 'BULLISH_SWEEP' ? '#00ff88' : '#ff3b30',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        {item.sweep.type === 'BULLISH_SWEEP' ? '🟢 BULLISH SWEEP' : '🔴 BEARISH SWEEP'} (x{item.sweep.sweepCount})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6 }}>
                        Level: ${item.sweep.pivotValue.toFixed(4)}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No recent sweep</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: CHART */}
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '24px', padding: '1.5rem' }}>
          {selectedSymbolData ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedSymbol.replace('USDT', '')} 
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px' }}>
                    {timeframe === 'M' ? '1 Month' : timeframe === 'W' ? '1 Week' : timeframe === 'D' ? '1 Day' : timeframe === '240' ? '4 Hours' : timeframe === '60' ? '1 Hour' : '15 Minutes'} Timeframe
                  </span>
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {selectedSymbolData.sweep && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: '0.85rem' }}>
                      <Info size={16} />
                      {selectedSymbolData.sweep.type === 'BULLISH_SWEEP' 
                        ? 'Sell-side liquidity swept. Potential reversal.' 
                        : 'Buy-side liquidity swept. Potential reversal.'}
                    </div>
                  )}

                  <button 
                    onClick={() => {
                      const newMode = !isSelectionMode;
                      setIsSelectionMode(newMode);
                      if (!newMode) setSelectionBox(null);
                    }}
                    style={{
                      background: isSelectionMode ? '#00e5ff' : 'rgba(255,255,255,0.05)',
                      color: isSelectionMode ? '#090915' : '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s',
                      marginLeft: 10
                    }}
                  >
                    🔲 {isSelectionMode ? 'Zone Selection Active' : 'Select Zone (Net Flow)'}
                  </button>
                </div>
              </div>

              <div style={{ position: 'relative', width: '100%', height: '450px' }}>
                <div 
                  ref={chartContainerRef} 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }} 
                />
                
                {isSelectionMode && (
                  <div 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, cursor: 'crosshair' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {selectionBox && Math.abs(selectionBox.currentX - selectionBox.startX) > 5 && (
                      <div style={{ 
                        position: 'absolute', 
                        left: Math.min(selectionBox.startX, selectionBox.currentX), 
                        width: Math.abs(selectionBox.currentX - selectionBox.startX), 
                        height: '100%', 
                        background: 'rgba(0, 229, 255, 0.1)', 
                        borderLeft: '1px solid #00e5ff',
                        borderRight: '1px solid #00e5ff',
                        pointerEvents: 'none'
                      }}>
                         <div style={{ 
                           position: 'absolute', 
                           top: 10, 
                           left: '50%', 
                           transform: 'translateX(-50%)', 
                           background: '#090915', 
                           border: '1px solid #00e5ff',
                           padding: '6px 12px', 
                           borderRadius: 8, 
                           color: selectionBox.netFlow >= 0 ? '#00e676' : '#ff3b30', 
                           fontWeight: 900,
                           whiteSpace: 'nowrap',
                           boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                         }}>
                            Zone NF: {selectionBox.netFlow >= 0 ? '+' : '-'}${formatMoney(Math.abs(selectionBox.netFlow))}
                         </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Select an asset to view the liquidity sweep chart.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
