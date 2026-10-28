import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchTop200Symbols, fetchBybitData } from './logic/scanner';
import { createChart } from 'lightweight-charts';
import { Activity, ArrowUpRight } from 'lucide-react';

const formatMoney = (num) => {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

const IntensityChartItem = ({ data, timeframe }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || !data.chartData) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 240,
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0.03)' },
        horzLines: { color: 'rgba(0,0,0,0.03)' },
      },
      timeScale: {
        borderColor: 'rgba(0,0,0,0.05)',
        timeVisible: true,
      },
      leftPriceScale: {
        visible: true,
        borderColor: 'rgba(0,0,0,0.05)',
      },
      rightPriceScale: {
        visible: true,
        borderColor: 'rgba(0,0,0,0.05)',
      },
      crosshair: {
        mode: 1,
      }
    });

    chartRef.current = chart;

    // OPTION B: RAW RATIO (Histogram)
    const rawSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'left',
    });

    // OPTION A: CUMULATIVE RATIO (Area/Line)
    const cumSeries = chart.addAreaSeries({
      topColor: 'rgba(255, 179, 0, 0.3)',
      bottomColor: 'rgba(255, 179, 0, 0.05)',
      lineColor: '#ffb300',
      lineWidth: 2,
      priceScaleId: 'right',
    });

    const rawData = [];
    const cumData = [];

    data.chartData.forEach(d => {
      rawData.push({
        time: d.time,
        value: d.rawRatio,
        color: d.rawRatio >= 0 ? 'rgba(0, 230, 118, 0.5)' : 'rgba(255, 59, 48, 0.5)'
      });
      cumData.push({
        time: d.time,
        value: d.cumulativeRatio
      });
    });

    rawSeries.setData(rawData);
    cumSeries.setData(cumData);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              {data.symbol.replace('USDT', '')}
              <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', color: '#64748b' }}>
                {timeframe}
              </span>
            </h3>
            {data.divergenceLabel === '🔥 ACCUMULATION SECRÈTE' && (
              <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '4px 8px', borderRadius: '4px', background: 'rgba(0, 230, 118, 0.15)', color: '#00c853', border: '1px solid rgba(0, 230, 118, 0.3)' }}>
                🔥 ACCUMULATION
              </span>
            )}
            {data.divergenceLabel === '💀 FAKE PUMP (DISTRIBUTION)' && (
              <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '4px 8px', borderRadius: '4px', background: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)' }}>
                💀 DISTRIBUTION
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              ${data.currentPrice?.toFixed(4)}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            background: data.latestCumRatio >= 0 ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 59, 48, 0.1)',
            color: data.latestCumRatio >= 0 ? '#00e676' : '#ff3b30',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 900,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}>
            <Activity size={14} />
            {data.latestCumRatio >= 0 ? '+' : ''}{data.latestCumRatio.toFixed(2)}%
          </div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 4, fontWeight: 700 }}>
            CUMULATIVE INTENSITY
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '240px' }}>
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

export const NetFlowIntensityScanner = ({ initialSearch }) => {
  const [loading, setLoading] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [tokensData, setTokensData] = useState({});
  const [timeframe, setTimeframe] = useState('240'); // default 4H

  const analyzeIntensity = (klines) => {
    if (klines.length < 2) return null;
    
    let cumulativeNetFlow = 0;
    let cumulativeTurnover = 0;
    
    const chartData = [];
    
    // Bybit returns newest first, so we reverse it to chronological
    const sorted = [...klines].reverse();
    
    sorted.forEach(k => {
      const time = Math.floor(k[0] / 1000);
      const open = Number(k[1]) || 0.00000001; // Protect against 0
      const close = Number(k[4]) || open;
      const turnover = Number(k[6]) || 0; // Volume in USDT
      
      const netFlow = turnover * ((close - open) / open);
      const rawRatio = turnover > 0 ? (netFlow / turnover) * 100 : 0;
      
      cumulativeNetFlow += netFlow;
      cumulativeTurnover += turnover;
      
      const cumulativeRatio = cumulativeTurnover > 0 ? (cumulativeNetFlow / cumulativeTurnover) * 100 : 0;
      
      chartData.push({
        time,
        rawRatio: isNaN(rawRatio) ? 0 : rawRatio,
        cumulativeRatio: isNaN(cumulativeRatio) ? 0 : cumulativeRatio
      });
    });
    
    const latestCumRatio = chartData[chartData.length - 1].cumulativeRatio;
    
    // Divergence Detection (Secret Accumulation / Distribution)
    const lookback = Math.min(20, chartData.length);
    let divergenceLabel = null;
    
    if (lookback >= 5) {
      const pastPrice = Number(sorted[sorted.length - lookback][4]);
      const currentPrice = Number(sorted[sorted.length - 1][4]);
      const priceChangePercent = ((currentPrice - pastPrice) / pastPrice) * 100;
      
      const pastCumRatio = chartData[chartData.length - lookback].cumulativeRatio;
      const currentCumRatio = chartData[chartData.length - 1].cumulativeRatio;
      const cumRatioChange = currentCumRatio - pastCumRatio;
      
      // Accumulation: Price goes down or flat (< 1%), but Net Flow goes up strongly (> 3%)
      if (priceChangePercent <= 1 && cumRatioChange >= 3) {
        divergenceLabel = '🔥 ACCUMULATION SECRÈTE';
      }
      // Distribution: Price goes up (> 1%), but Net Flow goes down strongly (< -3%)
      else if (priceChangePercent >= 1 && cumRatioChange <= -3) {
        divergenceLabel = '💀 FAKE PUMP (DISTRIBUTION)';
      }
    }
    
    return {
      chartData,
      latestCumRatio,
      divergenceLabel,
      currentPrice: Number(sorted[sorted.length - 1][4])
    };
  };

  const scanTokens = async () => {
    setLoading(true);
    setScanningProgress(0);
    setTokensData({});

    let listKeys = [];
    if (initialSearch) {
      listKeys = [initialSearch];
    } else {
      try {
        const topSymbolsList = await fetchTop200Symbols();
        listKeys = topSymbolsList.slice(0, 100).map(t => typeof t === 'string' ? t : t.symbol);
      } catch (e) {
        console.error("Error fetching top symbols", e);
        setLoading(false);
        return;
      }
    }

    const initialData = {};
    listKeys.forEach(sym => {
      initialData[sym] = { symbol: sym, loading: true, failed: false };
    });
    setTokensData(initialData);

    const batchSize = 10;
    for (let i = 0; i < listKeys.length; i += batchSize) {
      const batch = listKeys.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (sym) => {
        try {
          const klines = await fetchBybitData(sym, timeframe, 150);
          if (klines && klines.length >= 10) {
            const analysis = analyzeIntensity(klines);
            if (analysis) {
              setTokensData(prev => ({
                ...prev,
                [sym]: {
                  ...prev[sym],
                  ...analysis,
                  loading: false
                }
              }));
            } else {
              setTokensData(prev => ({ ...prev, [sym]: { ...prev[sym], loading: false, failed: true } }));
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
  }, [timeframe, initialSearch]);

  // Filter and sort by highest positive cumulative ratio first
  const filteredList = Object.values(tokensData)
    .filter(t => !t.loading && !t.failed && t.chartData && !isNaN(t.latestCumRatio))
    .sort((a, b) => b.latestCumRatio - a.latestCumRatio);

  return (
    <div style={{ background: '#090915', minHeight: '80vh', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, background: 'linear-gradient(90deg, #00e676, #00b0ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Activity size={32} style={{ color: '#00e676' }} /> NET FLOW INTENSITY
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
            Cumulative Net Flow Ratio (Net Flow / Volume) across the Top 100 Assets. Detect secret accumulation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select 
            value={timeframe} 
            onChange={e => setTimeframe(e.target.value)}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              color: '#fff', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '12px', 
              padding: '10px 16px',
              outline: 'none',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <option value="15">15m</option>
            <option value="60">1H</option>
            <option value="240">4H</option>
            <option value="D">1D</option>
          </select>
        </div>
      </div>

      {/* PROGRESS BAR */}
      {loading && (
        <div style={{ marginBottom: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>
            <span>Scanning Top 100 Assets...</span>
            <span>{scanningProgress}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${scanningProgress}%`, height: '100%', background: 'linear-gradient(90deg, #00e676, #00b0ff)', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* GRID LAYOUT */}
      {!loading && filteredList.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <Activity size={48} style={{ color: '#00e676', opacity: 0.5, marginBottom: '1rem' }} />
          <h3>No assets analyzed</h3>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
            Symbols Found: {Object.keys(tokensData).length} <br/>
            Failed to Fetch Data: {Object.values(tokensData).filter(t => t.failed).length} <br/>
            Valid Data: {Object.values(tokensData).filter(t => t.chartData).length}
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {filteredList.map(item => (
            <IntensityChartItem key={item.symbol} data={item} timeframe={timeframe} />
          ))}
        </div>
      )}
    </div>
  );
};
