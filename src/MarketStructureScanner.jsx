import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchTop200Symbols, fetchBybitData } from './logic/scanner';
import { createChart } from 'lightweight-charts';
import { Search, Zap, Loader2, Grid, List } from 'lucide-react';

const calculateLevels = (klines) => {
  if (!klines || klines.length < 30) return null;

  // Bybit V5 returns list in reverse chronological order: [0] is newest.
  // Sort oldest to newest
  const sorted = [...klines].reverse();

  // Price points
  const latestKline = sorted[sorted.length - 1];
  const currentPrice = Number(latestKline[4]); // close of latest kline

  // 1. Calculate Previous Month High (PMH) & Previous Month Low (PML)
  const now = new Date();
  let prevMonth = now.getUTCMonth() - 1;
  let prevMonthYear = now.getUTCFullYear();
  if (prevMonth < 0) {
    prevMonth = 11;
    prevMonthYear -= 1;
  }

  const prevMonthKlines = sorted.filter(k => {
    const d = new Date(Number(k[0]));
    return d.getUTCMonth() === prevMonth && d.getUTCFullYear() === prevMonthYear;
  });

  let PMH = 0;
  let PML = Infinity;
  if (prevMonthKlines.length > 0) {
    PMH = Math.max(...prevMonthKlines.map(k => Number(k[2])));
    PML = Math.min(...prevMonthKlines.map(k => Number(k[3])));
  } else {
    // Fallback: search for last completed month in the dataset
    const currentMonthNum = now.getUTCMonth();
    const otherMonthKlines = sorted.filter(k => {
      const d = new Date(Number(k[0]));
      return d.getUTCMonth() !== currentMonthNum;
    });
    if (otherMonthKlines.length > 0) {
      const lastMonthNum = new Date(Number(otherMonthKlines[otherMonthKlines.length - 1][0])).getUTCMonth();
      const lastMonthYear = new Date(Number(otherMonthKlines[otherMonthKlines.length - 1][0])).getUTCFullYear();
      const targetKlines = otherMonthKlines.filter(k => {
        const d = new Date(Number(k[0]));
        return d.getUTCMonth() === lastMonthNum && d.getUTCFullYear() === lastMonthYear;
      });
      PMH = Math.max(...targetKlines.map(k => Number(k[2])));
      PML = Math.min(...targetKlines.map(k => Number(k[3])));
    }
  }

  // 2. Calculate Previous Weekly High (PWH) & Previous Weekly Low (PWL)
  const dayOfWeek = now.getUTCDay();
  const distanceToPrevMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7;
  
  const prevMonday = new Date(now);
  prevMonday.setUTCDate(now.getUTCDate() - distanceToPrevMonday);
  prevMonday.setUTCHours(0, 0, 0, 0);

  const prevSunday = new Date(prevMonday);
  prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);
  prevSunday.setUTCHours(23, 59, 59, 999);

  const prevMondayTs = prevMonday.getTime();
  const prevSundayTs = prevSunday.getTime();

  const prevWeekKlines = sorted.filter(k => {
    const ts = Number(k[0]);
    return ts >= prevMondayTs && ts <= prevSundayTs;
  });

  let PWH = 0;
  let PWL = Infinity;
  if (prevWeekKlines.length > 0) {
    PWH = Math.max(...prevWeekKlines.map(k => Number(k[2])));
    PWL = Math.min(...prevWeekKlines.map(k => Number(k[3])));
  } else {
    // Fallback: last 7 days excluding current week
    const currentWeekStart = new Date(now);
    currentWeekStart.setUTCDate(now.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    currentWeekStart.setUTCHours(0, 0, 0, 0);
    const fallbackKlines = sorted.filter(k => Number(k[0]) < currentWeekStart.getTime()).slice(-7);
    if (fallbackKlines.length > 0) {
      PWH = Math.max(...fallbackKlines.map(k => Number(k[2])));
      PWL = Math.min(...fallbackKlines.map(k => Number(k[3])));
    }
  }

  if (PML === Infinity) PML = currentPrice * 0.9;
  if (PWL === Infinity) PWL = currentPrice * 0.95;
  if (PMH === 0) PMH = currentPrice * 1.1;
  if (PWH === 0) PWH = currentPrice * 1.05;

  // 3. Detect Equal Highs (EQH) & Equal Lows (EQL) in the last 30 daily candles
  const last30 = sorted.slice(-30);
  const swingHighs = [];
  const swingLows = [];

  for (let i = 1; i < last30.length - 1; i++) {
    const prevH = Number(last30[i - 1][2]);
    const currH = Number(last30[i][2]);
    const nextH = Number(last30[i + 1][2]);

    const prevL = Number(last30[i - 1][3]);
    const currL = Number(last30[i][3]);
    const nextL = Number(last30[i + 1][3]);

    // Local peak detection
    if (currH > prevH && currH > nextH) {
      swingHighs.push({ price: currH, time: Number(last30[i][0]) });
    }
    if (currL < prevL && currL < nextL) {
      swingLows.push({ price: currL, time: Number(last30[i][0]) });
    }
  }

  let EQH = null;
  let EQHCount = 0;
  let EQL = null;
  let EQLCount = 0;
  const tolerance = 0.02; // 2% tolerance

  // Check for Equal Highs (within 2% of each other)
  for (let i = 0; i < swingHighs.length; i++) {
    const h1 = swingHighs[i].price;
    const matches = swingHighs.filter(sh => Math.abs(sh.price - h1) / h1 <= tolerance);
    if (matches.length >= 2) {
      EQH = Math.max(...matches.map(m => m.price));
      EQHCount = matches.length;
      break;
    }
  }

  // Check for Equal Lows (within 2% of each other)
  for (let i = 0; i < swingLows.length; i++) {
    const l1 = swingLows[i].price;
    const matches = swingLows.filter(sl => Math.abs(sl.price - l1) / l1 <= tolerance);
    if (matches.length >= 2) {
      EQL = Math.min(...matches.map(m => m.price));
      EQLCount = matches.length;
      break;
    }
  }

  // Determine Status
  let status = 'INSIDE WEEKLY RANGE';
  let color = '#ffea00'; // yellow/amber
  
  if (currentPrice > PMH) {
    status = '🔥 PMH BREAKOUT';
    color = '#00ff88'; // green
  } else if (currentPrice > PWH) {
    status = '⚡ PWH BREAKOUT';
    color = '#00e5ff'; // cyan
  } else if (currentPrice < PML) {
    status = '💀 PML BREAKDOWN';
    color = '#ff3b30'; // red
  } else if (currentPrice < PWL) {
    status = '🧊 PWL BREAKDOWN';
    color = '#ff9100'; // orange
  }

  // Determine Liquidity Zone Alert (price within 2% of EQH/EQL)
  let liquidityAlert = null;
  if (EQH) {
    const distToEQH = ((EQH / currentPrice) - 1) * 100;
    if (Math.abs(distToEQH) <= 2) {
      liquidityAlert = { type: 'EQH', level: EQH, distance: distToEQH, count: EQHCount, label: `🎯 EQH TARGET (${EQHCount}x)` };
    }
  }
  if (EQL && !liquidityAlert) {
    const distToEQL = ((currentPrice / EQL) - 1) * 100;
    if (Math.abs(distToEQL) <= 2) {
      liquidityAlert = { type: 'EQL', level: EQL, distance: distToEQL, count: EQLCount, label: `🎯 EQL TARGET (${EQLCount}x)` };
    }
  }

  return {
    currentPrice,
    PMH,
    PML,
    PWH,
    PWL,
    EQH,
    EQL,
    EQHCount,
    EQLCount,
    liquidityAlert,
    status,
    color,
    rawKlines: klines
  };
};

const getRelativePercent = (val, min, max) => {
  if (max === min) return 50;
  const pct = ((val - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
};

// MINI CHART SUB-COMPONENT FOR GRID VIEW
const TokenMiniChart = ({ item }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !item || !item.rawKlines) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 180,
      layout: {
        background: { color: '#090915' },
        textColor: '#64748b',
        fontSize: 9,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.01)' },
        horzLines: { color: 'rgba(255,255,255,0.01)' },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.03)',
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.03)',
        autoScale: true,
        visible: true,
      },
      crosshair: {
        mode: 1, // Simple crosshair
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

    const raw = item.rawKlines;
    const chartData = [...raw].reverse().map(k => {
      const date = new Date(Number(k[0]));
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return {
        time: `${year}-${month}-${day}`,
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
      };
    });

    const uniqueChartData = [];
    const seenTimes = new Set();
    for (const d of chartData) {
      if (!seenTimes.has(d.time)) {
        seenTimes.add(d.time);
        uniqueChartData.push(d);
      }
    }

    candlestickSeries.setData(uniqueChartData);

    const { PMH, PML, PWH, PWL, EQH, EQL } = item;

    // Draw key levels on the miniature chart
    if (PMH) {
      candlestickSeries.createPriceLine({
        price: PMH,
        color: 'rgba(255, 61, 0, 0.4)',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: false,
      });
    }
    if (PML) {
      candlestickSeries.createPriceLine({
        price: PML,
        color: 'rgba(41, 121, 255, 0.4)',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: false,
      });
    }
    if (EQH) {
      candlestickSeries.createPriceLine({
        price: EQH,
        color: '#d946ef',
        lineWidth: 1.5,
        lineStyle: 2, // Dotted
        axisLabelVisible: true,
      });
    }
    if (EQL) {
      candlestickSeries.createPriceLine({
        price: EQL,
        color: '#eab308',
        lineWidth: 1.5,
        lineStyle: 2, // Dotted
        axisLabelVisible: true,
      });
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [item]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '180px', 
        background: '#090915', 
        borderRadius: '8px', 
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.03)',
        marginTop: '10px'
      }} 
    />
  );
};

export const MarketStructureScanner = ({ initialSearch }) => {
  const [loading, setLoading] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [tokensData, setTokensData] = useState({});
  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [selectedSymbol, setSelectedSymbol] = useState(initialSearch || null);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'BREAKOUT', 'CONSOLIDATION', 'BREAKDOWN', 'LIQUIDITY'
  const [layoutMode, setLayoutMode] = useState('TABLE'); // 'TABLE', 'GRID'
  const [visibleCount, setVisibleCount] = useState(16); // Paginated display limit for Grid Mode

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  // Reset pagination limit on filter changes
  useEffect(() => {
    setVisibleCount(16);
  }, [filterType]);

  // Progressive background scan of Top 100 assets on mount
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
      symbolsList = [
        { symbol: 'BTCUSDT', lastPrice: '0', priceChangePercent: 0, turnover24h: 0 },
        { symbol: 'ETHUSDT', lastPrice: '0', priceChangePercent: 0, turnover24h: 0 },
        { symbol: 'SOLUSDT', lastPrice: '0', priceChangePercent: 0, turnover24h: 0 }
      ];
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

    if (symbolsList.length > 0 && !selectedSymbol) {
      setSelectedSymbol(symbolsList[0].symbol);
    }

    const batchSize = 10;
    const listKeys = symbolsList.map(s => s.symbol);

    for (let i = 0; i < listKeys.length; i += batchSize) {
      const chunk = listKeys.slice(i, i + batchSize);

      await Promise.all(chunk.map(async (sym) => {
        try {
          const klines = await fetchBybitData(sym, 'D', 90);
          if (klines && klines.length >= 20) {
            const analysis = calculateLevels(klines);
            if (analysis) {
              setTokensData(prev => ({
                ...prev,
                [sym]: {
                  ...prev[sym],
                  ...analysis,
                  loading: false
                }
              }));
            }
          } else {
            setTokensData(prev => ({
              ...prev,
              [sym]: { ...prev[sym], loading: false, failed: true }
            }));
          }
        } catch (err) {
          console.error(`Failed to scan levels for ${sym}`, err);
          setTokensData(prev => ({
            ...prev,
            [sym]: { ...prev[sym], loading: false, failed: true }
          }));
        }
      }));

      const completed = Math.min(i + batchSize, listKeys.length);
      setScanningProgress(Math.floor((completed / listKeys.length) * 100));
      await new Promise(r => setTimeout(r, 200));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (initialSearch) {
       // If initialSearch is provided, trigger the search function manually for that token
       handleSearchSubmit({ preventDefault: () => {} }, initialSearch);
    } else {
       scanTokens();
    }
  }, [initialSearch]);

  const handleSelectSymbol = async (sym) => {
    setSelectedSymbol(sym);

    if (!tokensData[sym] || tokensData[sym].loading || !tokensData[sym].rawKlines) {
      try {
        setTokensData(prev => ({
          ...prev,
          [sym]: { ...prev[sym], loading: true }
        }));
        const klines = await fetchBybitData(sym, 'D', 90);
        if (klines && klines.length >= 20) {
          const analysis = calculateLevels(klines);
          if (analysis) {
            setTokensData(prev => ({
              ...prev,
              [sym]: {
                ...prev[sym],
                ...analysis,
                loading: false
              }
            }));
          }
        }
      } catch (err) {
        console.error("Error prioritizing symbol scan", err);
      }
    }
  };

  const handleSearchSubmit = async (e, tokenOverride = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetToken = tokenOverride || searchQuery;
    if (!targetToken) return;

    const formatted = targetToken.toUpperCase().endsWith('USDT') 
      ? targetToken.toUpperCase() 
      : `${targetToken.toUpperCase()}USDT`;

    setLoading(true);
    try {
      const klines = await fetchBybitData(formatted, 'D', 90);
      if (klines && klines.length >= 20) {
        const analysis = calculateLevels(klines);
        if (analysis) {
          setTokensData(prev => ({
            ...prev,
            [formatted]: {
              symbol: formatted,
              currentPrice: analysis.currentPrice,
              changePercent: 0,
              turnover: 0,
              ...analysis,
              loading: false
            }
          }));
          setSelectedSymbol(formatted);
        }
      } else {
        alert("Symbol not found or insufficient history.");
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

  // Render main chart for single view
  useEffect(() => {
    if (layoutMode !== 'TABLE') return; // Only render main chart in table view
    if (!chartContainerRef.current || !selectedSymbolData || !selectedSymbolData.rawKlines) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 380,
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
        mode: 0,
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

    const raw = selectedSymbolData.rawKlines;
    const chartData = [...raw].reverse().map(k => {
      const date = new Date(Number(k[0]));
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return {
        time: `${year}-${month}-${day}`,
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
      };
    });

    const uniqueChartData = [];
    const seenTimes = new Set();
    for (const d of chartData) {
      if (!seenTimes.has(d.time)) {
        seenTimes.add(d.time);
        uniqueChartData.push(d);
      }
    }

    candlestickSeries.setData(uniqueChartData);

    const { PMH, PML, PWH, PWL, EQH, EQL } = selectedSymbolData;

    // Macro Structure Lines
    candlestickSeries.createPriceLine({
      price: PMH,
      color: '#ff3d00',
      lineWidth: 2,
      lineStyle: 1,
      axisLabelVisible: true,
      title: 'PMH',
    });

    candlestickSeries.createPriceLine({
      price: PML,
      color: '#2979ff',
      lineWidth: 2,
      lineStyle: 1,
      axisLabelVisible: true,
      title: 'PML',
    });

    candlestickSeries.createPriceLine({
      price: PWH,
      color: '#00e5ff',
      lineWidth: 1.5,
      lineStyle: 1,
      axisLabelVisible: true,
      title: 'PWH',
    });

    candlestickSeries.createPriceLine({
      price: PWL,
      color: '#ff9100',
      lineWidth: 1.5,
      lineStyle: 1,
      axisLabelVisible: true,
      title: 'PWL',
    });

    // Equal Highs / Equal Lows SMC Target Lines
    if (EQH) {
      candlestickSeries.createPriceLine({
        price: EQH,
        color: '#d946ef',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'EQH (Equal Highs)',
      });
    }

    if (EQL) {
      candlestickSeries.createPriceLine({
        price: EQL,
        color: '#eab308',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'EQL (Equal Lows)',
      });
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
  }, [selectedSymbol, selectedSymbolData, layoutMode]);

  // Filtered List with EQH/EQL sorting
  const filteredList = useMemo(() => {
    return Object.values(tokensData)
      .filter(item => {
        if (filterType === 'ALL') return true;
        if (filterType === 'BREAKOUT') return item.status?.includes('BREAKOUT');
        if (filterType === 'CONSOLIDATION') return item.status?.includes('INSIDE');
        if (filterType === 'BREAKDOWN') return item.status?.includes('BREAKDOWN');
        if (filterType === 'LIQUIDITY') return !!item.EQH || !!item.EQL;
        return true;
      })
      .sort((a, b) => {
        if (filterType === 'LIQUIDITY') {
          const aDist = a.EQH ? Math.abs((a.EQH / a.currentPrice - 1) * 100) : (a.EQL ? Math.abs((a.currentPrice / a.EQL - 1) * 100) : 999);
          const bDist = b.EQH ? Math.abs((b.EQH / b.currentPrice - 1) * 100) : (b.EQL ? Math.abs((b.currentPrice / b.EQL - 1) * 100) : 999);
          return aDist - bDist;
        }
        if (!a.PMH || !b.PMH) return 0;
        const aDist = ((a.currentPrice / a.PMH - 1) * 100);
        const bDist = ((b.currentPrice / b.PMH - 1) * 100);
        return bDist - aDist;
      });
  }, [tokensData, filterType]);

  const visibleList = useMemo(() => {
    if (layoutMode === 'GRID') {
      return filteredList.slice(0, visibleCount);
    }
    return filteredList;
  }, [filteredList, layoutMode, visibleCount]);

  return (
    <div style={{ background: '#090915', minHeight: '80vh', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, background: 'linear-gradient(90deg, #ff3d00, #ffea00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Zap size={32} style={{ color: '#ffea00' }} /> MARKET STRUCTURE SCANNER
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
            Track levels relative to Previous Month High (PMH), Previous Month Low (PML), Previous Weekly High (PWH), and Previous Weekly Low (PWL) across Top 100 Bybit assets.
          </p>
        </div>

        {/* SEARCH BAR */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ex: SUI, SOL, BTC..." 
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px 12px 40px', borderRadius: '12px', fontSize: '0.85rem', width: '220px', transition: 'all 0.3s' }}
            />
          </div>
          <button type="submit" style={{ background: '#ffea00', color: '#090915', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            ANALYZE
          </button>
        </form>
      </div>

      {/* FILTER, VIEW SWITCHER & SCAN STATUS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: '📊 TOUT' },
            { id: 'BREAKOUT', label: '🔥 BREAKOUTS (PMH/PWH)' },
            { id: 'CONSOLIDATION', label: '⚖️ RANGE (INSIDE WEEK)' },
            { id: 'BREAKDOWN', label: '💀 BREAKDOWNS (PWL/PML)' },
            { id: 'LIQUIDITY', label: '🎯 LIQUIDITY (EQH/EQL)' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              style={{
                background: filterType === f.id ? '#ff3d00' : 'rgba(255,255,255,0.02)',
                color: filterType === f.id ? '#fff' : '#94a3b8',
                border: '1px solid rgba(255,255,255,0.05)',
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

        {/* LAYOUT SWITCHER */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => setLayoutMode('TABLE')}
              style={{
                background: layoutMode === 'TABLE' ? '#ffea00' : 'transparent',
                color: layoutMode === 'TABLE' ? '#090915' : '#94a3b8',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.3s'
              }}
            >
              <List size={14} /> TABLEAU
            </button>
            <button
              onClick={() => setLayoutMode('GRID')}
              style={{
                background: layoutMode === 'GRID' ? '#ffea00' : 'transparent',
                color: layoutMode === 'GRID' ? '#090915' : '#94a3b8',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.3s'
              }}
            >
              <Grid size={14} /> GRILLE CHARTS
            </button>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255, 61, 0, 0.1)', border: '1px solid rgba(255, 61, 0, 0.2)', padding: '8px 16px', borderRadius: '12px' }}>
              <Loader2 size={16} style={{ color: '#ffea00', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffea00' }}>SCANNING: {scanningProgress}%</span>
            </div>
          )}
        </div>
      </div>

      {/* RENDER DYNAMIC LAYOUT */}
      {layoutMode === 'TABLE' ? (
        
        /* ==================== TABLE LAYOUT ==================== */
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: LIST TABLE */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem', overflowX: 'auto' }}>
            <style>{`
              .structure-row:hover {
                background: rgba(255,255,255,0.02) !important;
                cursor: pointer;
              }
              .selected-row {
                background: rgba(255, 234, 0, 0.05) !important;
                border-left: 4px solid #ffea00;
              }
            `}</style>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: '#64748b', fontWeight: 900, letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 8px' }}>ASSET</th>
                  <th style={{ padding: '12px 8px' }}>PRICE</th>
                  <th style={{ padding: '12px 8px' }}>24H CHG</th>
                  <th style={{ padding: '12px 8px', minWidth: '160px' }}>LEVELS GAUGE (PML ... PWL ... PWH ... PMH)</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>STATUS / LIQUIDITY</th>
                </tr>
              </thead>
              <tbody>
                {visibleList.map(item => {
                  const isSelected = selectedSymbol === item.symbol;
                  const pwlPct = getRelativePercent(item.PWL, item.PML, item.PMH);
                  const pwhPct = getRelativePercent(item.PWH, item.PML, item.PMH);
                  const pricePct = getRelativePercent(item.currentPrice, item.PML, item.PMH);

                  return (
                    <tr 
                      key={item.symbol}
                      onClick={() => handleSelectSymbol(item.symbol)}
                      className={`structure-row ${isSelected ? 'selected-row' : ''}`}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.82rem', transition: 'all 0.2s' }}
                    >
                      <td style={{ padding: '16px 8px', fontWeight: 800 }}>
                        <span style={{ color: '#fff', fontSize: '0.9rem' }}>{item.symbol.replace('USDT', '')}</span>
                        {item.loading && <Loader2 size={10} style={{ display: 'inline', marginLeft: 6, animation: 'spin 1s linear infinite', color: '#ffea00' }} />}
                      </td>
                      
                      <td style={{ padding: '16px 8px', fontWeight: 700, color: '#e2e8f0' }}>
                        ${item.currentPrice ? item.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'N/A'}
                      </td>
                      
                      <td style={{ padding: '16px 8px', fontWeight: 800, color: (item.changePercent || 0) >= 0 ? '#00ff88' : '#ff3b30' }}>
                        {item.changePercent ? `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%` : '0.00%'}
                      </td>
                      
                      <td style={{ padding: '16px 8px', verticalAlign: 'middle' }}>
                        {item.loading ? (
                          <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>Calculating levels...</span>
                        ) : item.failed ? (
                          <span style={{ color: '#ff3b30', fontSize: '0.7rem' }}>API error</span>
                        ) : (
                          <div style={{ position: 'relative', width: '100%', height: '14px', display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
                              <div style={{ position: 'absolute', left: '0%', width: '4px', height: '8px', background: '#2979ff', top: '-2px', borderRadius: '1px' }} title={`PML: ${item.PML}`} />
                              <div style={{ position: 'absolute', left: `${pwlPct}%`, width: '4px', height: '8px', background: '#ff9100', top: '-2px', borderRadius: '1px' }} title={`PWL: ${item.PWL}`} />
                              <div style={{ position: 'absolute', left: `${pwhPct}%`, width: '4px', height: '8px', background: '#00e5ff', top: '-2px', borderRadius: '1px' }} title={`PWH: ${item.PWH}`} />
                              <div style={{ position: 'absolute', right: '0%', width: '4px', height: '8px', background: '#ff3d00', top: '-2px', borderRadius: '1px' }} title={`PMH: ${item.PMH}`} />
                              
                              <div style={{ 
                                position: 'absolute', 
                                left: `${pricePct}%`, 
                                width: '10px', 
                                height: '10px', 
                                background: item.color || '#fff', 
                                borderRadius: '50%', 
                                top: '-3px', 
                                transform: 'translateX(-50%)',
                                boxShadow: `0 0 8px ${item.color || '#fff'}`,
                                zIndex: 5
                              }} title={`Price: ${item.currentPrice}`} />
                            </div>
                          </div>
                        )}
                      </td>
                      
                      <td style={{ padding: '16px 8px', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', justifyContent: 'center' }}>
                        {item.loading ? (
                          <span style={{ fontSize: '0.65rem', background: '#1e293b', color: '#94a3b8', padding: '4px 8px', borderRadius: '6px' }}>SCANNING</span>
                        ) : (
                          <>
                            <span style={{ 
                              fontSize: '0.68rem', 
                              fontWeight: 900, 
                              color: item.color, 
                              background: `${item.color}15`, 
                              border: `1px solid ${item.color}30`,
                              padding: '4px 8px', 
                              borderRadius: '6px',
                              letterSpacing: '0.2px',
                              whiteSpace: 'nowrap'
                            }}>
                              {item.status}
                            </span>
                            
                            {item.liquidityAlert ? (
                              <span style={{ 
                                fontSize: '0.62rem', 
                                fontWeight: 900, 
                                color: '#d946ef', 
                                background: 'rgba(217, 70, 239, 0.1)', 
                                border: '1px solid rgba(217, 70, 239, 0.3)',
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                letterSpacing: '0.2px',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.liquidityAlert.label} ({item.liquidityAlert.distance >= 0 ? '+' : ''}{item.liquidityAlert.distance.toFixed(1)}%)
                              </span>
                            ) : (item.EQH ? (
                              <span style={{ fontSize: '0.62rem', color: 'rgba(217, 70, 239, 0.7)', fontWeight: 700 }}>
                                EQH: ${item.EQH.toLocaleString(undefined, { maximumSignificantDigits: 4 })} ({item.EQHCount}x)
                              </span>
                            ) : null)}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* RIGHT COLUMN: CHART & DETAIL SIDE PANEL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {selectedSymbolData ? (
              <div style={{ background: '#090915', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '1.5rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#fff' }}>
                      {selectedSymbol.replace('USDT', '')} STRUCTURE
                    </h2>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Bybit Spot Live Chart (1D)</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: selectedSymbolData.color }}>
                      ${selectedSymbolData.currentPrice ? selectedSymbolData.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'N/A'}
                    </span>
                    <div style={{ fontSize: '0.68rem', color: selectedSymbolData.color, background: `${selectedSymbolData.color}15`, border: `1px solid ${selectedSymbolData.color}30`, padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: 4, fontWeight: 900 }}>
                      {selectedSymbolData.status}
                    </div>
                  </div>
                </div>

                {!selectedSymbolData.loading && !selectedSymbolData.failed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#ff3d00', fontWeight: 800 }}>🔴 PMH:</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>${selectedSymbolData.PMH?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#00e5ff', fontWeight: 800 }}>🔵 PWH:</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>${selectedSymbolData.PWH?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#ff9100', fontWeight: 800 }}>🟠 PWL:</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>${selectedSymbolData.PWL?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#2979ff', fontWeight: 800 }}>🔵 PML:</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>${selectedSymbolData.PML?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        </div>
                      </div>
                    </div>

                    {(selectedSymbolData.EQH || selectedSymbolData.EQL) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: 'rgba(217, 70, 239, 0.03)', border: '1px solid rgba(217, 70, 239, 0.1)', padding: '12px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.65rem', color: '#a21caf', fontWeight: 800 }}>
                            🎯 EQUAL HIGHS ({selectedSymbolData.EQHCount}x peaks)
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#d946ef' }}>
                            {selectedSymbolData.EQH ? `$${selectedSymbolData.EQH.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : 'NONE'}
                          </span>
                          {selectedSymbolData.EQH && (
                            <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                              Distance: {(((selectedSymbolData.EQH / selectedSymbolData.currentPrice) - 1) * 100).toFixed(2)}%
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.65rem', color: '#a16207', fontWeight: 800 }}>
                            🎯 EQUAL LOWS ({selectedSymbolData.EQLCount}x valleys)
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#eab308' }}>
                            {selectedSymbolData.EQL ? `$${selectedSymbolData.EQL.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : 'NONE'}
                          </span>
                          {selectedSymbolData.EQL && (
                            <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                              Distance: {(((selectedSymbolData.currentPrice / selectedSymbolData.EQL) - 1) * 100).toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div 
                  ref={chartContainerRef} 
                  style={{ 
                    width: '100%', 
                    height: '380px', 
                    background: '#090915', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    border: '1px solid rgba(255,255,255,0.03)' 
                  }} 
                />
                
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '20px', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                Select an asset from the table to view its candlestick structure chart.
              </div>
            )}

          </div>

        </div>
      ) : (
        
        /* ==================== GRID LAYOUT (MULTI-CHARTS) ==================== */
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {visibleList.map(item => (
              <div 
                key={item.symbol} 
                onClick={() => {
                  handleSelectSymbol(item.symbol);
                  setLayoutMode('TABLE'); // Switch to table view on click to analyze closely
                }}
                style={{ 
                  background: 'rgba(255,255,255,0.01)', 
                  border: '1px solid rgba(255,255,255,0.03)', 
                  borderRadius: '16px', 
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, background 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                }}
              >
                {/* CARD HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{item.symbol.replace('USDT', '')}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: (item.changePercent || 0) >= 0 ? '#00ff88' : '#ff3b30', marginLeft: '8px' }}>
                      {item.changePercent ? `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%` : '0.00%'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#e2e8f0' }}>
                    ${item.currentPrice ? item.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : 'N/A'}
                  </span>
                </div>

                {/* BADGE / STATUS */}
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ 
                    fontSize: '0.62rem', 
                    fontWeight: 900, 
                    color: item.color, 
                    background: `${item.color}15`, 
                    border: `1px solid ${item.color}30`,
                    padding: '3px 6px', 
                    borderRadius: '4px'
                  }}>
                    {item.status}
                  </span>

                  {item.liquidityAlert && (
                    <span style={{ 
                      fontSize: '0.62rem', 
                      fontWeight: 900, 
                      color: '#d946ef', 
                      background: 'rgba(217, 70, 239, 0.1)', 
                      border: '1px solid rgba(217, 70, 239, 0.3)',
                      padding: '3px 6px', 
                      borderRadius: '4px'
                    }}>
                      {item.liquidityAlert.label} ({item.liquidityAlert.distance >= 0 ? '+' : ''}{item.liquidityAlert.distance.toFixed(1)}%)
                    </span>
                  )}
                </div>

                {/* MINI CHART CONTAINER */}
                {item.loading ? (
                  <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', marginTop: '10px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                    <Loader2 size={24} style={{ color: '#ffea00', animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Scanning historical candles...</span>
                  </div>
                ) : item.failed ? (
                  <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', marginTop: '10px', color: '#ff3b30', fontSize: '0.75rem', fontWeight: 600 }}>
                    Failed to fetch data
                  </div>
                ) : (
                  <TokenMiniChart item={item} />
                )}

                {/* BOTTOM METRICS */}
                {!item.loading && !item.failed && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', fontSize: '0.65rem', color: '#64748b', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '8px' }}>
                    <div>
                      <span style={{ display: 'block' }}>EQH (BSL): <strong style={{ color: item.EQH ? '#d946ef' : '#475569' }}>{item.EQH ? `$${item.EQH.toLocaleString(undefined, { maximumFractionDigits: 3 })} (${item.EQHCount}x)` : 'None'}</strong></span>
                    </div>
                    <div>
                      <span style={{ display: 'block' }}>EQL (SSL): <strong style={{ color: item.EQL ? '#eab308' : '#475569' }}>{item.EQL ? `$${item.EQL.toLocaleString(undefined, { maximumFractionDigits: 3 })} (${item.EQLCount}x)` : 'None'}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* SHOW MORE BUTTON */}
          {filteredList.length > visibleCount && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
              <button 
                onClick={() => setVisibleCount(prev => prev + 12)}
                style={{ 
                  background: 'transparent', 
                  border: '1px solid #ffea00', 
                  color: '#ffea00', 
                  padding: '12px 36px', 
                  borderRadius: '30px', 
                  fontWeight: 900, 
                  fontSize: '0.8rem', 
                  cursor: 'pointer', 
                  letterSpacing: '0.5px',
                  transition: 'all 0.3s' 
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#ffea00';
                  e.currentTarget.style.color = '#090915';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#ffea00';
                }}
              >
                LOAD MORE CHARTS (+12)
              </button>
            </div>
          )}

          {filteredList.length === 0 && (
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '20px', padding: '5rem', textAlign: 'center', color: '#64748b' }}>
              No assets match the active filter mode.
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default MarketStructureScanner;
