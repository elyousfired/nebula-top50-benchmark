import React, { useState, useEffect, useMemo } from 'react';
import { fetchBybitData, fetchDepth, fetchTop500Symbols } from './logic/scanner';
import { TrendingUp, BarChart2, Activity, Info, ShieldAlert, Award, Search, Compass, Eye, Filter } from 'lucide-react';

const VolumeProfileScanner = ({ initialSearch }) => {
  // Navigation tabs: 'chart' (Single Token Interactive View) or 'scanner' (Top 100 POC Scanner)
  const [activeTab, setActiveTab] = useState('chart');

  // Single Chart States
  const [selectedSymbol, setSelectedSymbol] = useState(initialSearch || 'BTCUSDT');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [candles15m, setCandles15m] = useState([]);
  const [depthData, setDepthData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [chartError, setChartError] = useState(null);
  const [hoveredElement, setHoveredElement] = useState(null); // { type, data, x, y }
  const [numBins, setNumBins] = useState(40);

  // Scanner States
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState([]);
  const [livePrices, setLivePrices] = useState({}); // symbol -> live price
  const [lastScanTime, setLastScanTime] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [proximityLimit, setProximityLimit] = useState(0.8); // Default 0.8% threshold
  const [scannerError, setScannerError] = useState(null);

  // Quick select symbols for the chart tab
  const quickSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT', 'AVAXUSDT', 'NEARUSDT'];

  useEffect(() => {
    if (initialSearch) {
      setSelectedSymbol(initialSearch);
      setActiveTab('chart');
    }
  }, [initialSearch]);

  // Load single market data for chart
  const loadChartData = async (symbol) => {
    setLoadingChart(true);
    setChartError(null);
    try {
      const klines = await fetchBybitData(symbol, '15', 180);
      if (!klines || klines.length === 0) {
        throw new Error('Failed to retrieve 15m candlestick data.');
      }
      setCandles15m(klines);

      const depth = await fetchDepth(symbol);
      if (depth) {
        setDepthData(depth);
      }
    } catch (err) {
      console.error(err);
      setChartError(err.message || 'Error fetching market data.');
    } finally {
      setLoadingChart(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chart') {
      loadChartData(selectedSymbol);
      const interval = setInterval(() => {
        loadChartData(selectedSymbol);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [selectedSymbol, activeTab]);

  // Run the Top 100 POC Proximity Scanner
  const runPocScanner = async () => {
    setIsScanningAll(true);
    setScanProgress(0);
    setScanResults([]);
    setScannerError(null);

    try {
      const top500 = await fetchTop500Symbols();
      if (!top500 || top500.length === 0) {
        throw new Error('Failed to fetch Top Bybit tickers.');
      }
      const targets = top500;
      const results = [];
      const batchSize = 10;
      
      const now = new Date();
      const startOfTodayTs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const startOfPrevDayTs = startOfTodayTs - 24 * 60 * 60 * 1000; // minuit J-1

      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (tokenObj) => {
          const sym = tokenObj.symbol;
          try {
            const klines = await fetchBybitData(sym, '15', 200);
            if (klines && klines.length > 0) {
              const candlesChron = [...klines].reverse().map(c => ({
                time: Number(c[0]),
                open: Number(c[1]),
                high: Number(c[2]),
                low: Number(c[3]),
                close: Number(c[4]),
                volume: Number(c[5])
              }));

              // Previous day candles: from midnight J-1 to midnight J
              let todayCandles = candlesChron.filter(c => c.time >= startOfPrevDayTs && c.time < startOfTodayTs);
              if (todayCandles.length < 12) {
                // Fallback: take the 96 candles just before today (last full day available)
                todayCandles = candlesChron.filter(c => c.time < startOfTodayTs).slice(-96);
              }

              const highs = todayCandles.map(c => c.high);
              const lows = todayCandles.map(c => c.low);
              const dayHigh = Math.max(...highs);
              const dayLow = Math.min(...lows);
              // Current live price = last candle overall (today's price)
              const currentPrice = candlesChron[candlesChron.length - 1].close;

              // Calculate daily volume profile bins
              const binsCount = 30;
              const binSize = (dayHigh - dayLow) / binsCount;
              const bins = Array.from({ length: binsCount }, (_, idx) => ({
                idx,
                low: dayLow + idx * binSize,
                high: dayLow + idx * binSize + binSize,
                volume: 0
              }));

              todayCandles.forEach(c => {
                const { high, low, volume } = c;
                if (high === low) {
                  const binIdx = Math.min(Math.floor((high - dayLow) / binSize), binsCount - 1);
                  if (binIdx >= 0 && binIdx < binsCount) bins[binIdx].volume += volume;
                } else {
                  const overlapping = bins.filter(b => high >= b.low && low <= b.high);
                  if (overlapping.length > 0) {
                    const volPerBin = volume / overlapping.length;
                    overlapping.forEach(b => { b.volume += volPerBin; });
                  }
                }
              });

              let maxVol = 0;
              let pocPrice = (dayHigh + dayLow) / 2;
              let pocBinIdx = 0;
              bins.forEach((b, idx) => {
                if (b.volume > maxVol) {
                  maxVol = b.volume;
                  pocPrice = (b.low + b.high) / 2;
                  pocBinIdx = idx;
                }
              });

              const dayVolume = todayCandles.reduce((acc, c) => acc + c.volume, 0);
              const targetVaVol = dayVolume * 0.70;
              let vaMinIdx = pocBinIdx;
              let vaMaxIdx = pocBinIdx;
              let currentVaVol = bins[pocBinIdx]?.volume || 0;

              while (currentVaVol < targetVaVol && (vaMinIdx > 0 || vaMaxIdx < binsCount - 1)) {
                let prevVol = 0;
                if (vaMinIdx > 0) prevVol = bins[vaMinIdx - 1].volume + (bins[vaMinIdx - 2]?.volume || 0);
                let nextVol = 0;
                if (vaMaxIdx < binsCount - 1) nextVol = bins[vaMaxIdx + 1].volume + (bins[vaMaxIdx + 2]?.volume || 0);

                if (vaMinIdx > 0 && (vaMaxIdx === binsCount - 1 || prevVol >= nextVol)) {
                  currentVaVol += bins[vaMinIdx - 1].volume;
                  vaMinIdx--;
                } else if (vaMaxIdx < binsCount - 1) {
                  currentVaVol += bins[vaMaxIdx + 1].volume;
                  vaMaxIdx++;
                } else {
                  break;
                }
              }

              const vah = bins[vaMaxIdx]?.high || dayHigh;
              const val = bins[vaMinIdx]?.low || dayLow;

              // Proximity to POC, VAH, VAL in percentage
              const distancePoc = ((currentPrice - pocPrice) / pocPrice) * 100;
              const distanceVah = ((currentPrice - vah) / vah) * 100;
              const distanceVal = ((currentPrice - val) / val) * 100;
              
              results.push({
                symbol: sym,
                currentPrice,
                pocPrice,
                distancePoc,
                distanceVah,
                distanceVal,
                vah,
                val,
                turnover24h: Number(tokenObj.turnover24h),
                dayVolume
              });
            }
          } catch (e) {
            console.error(`Failed to scan Volume Profile for ${sym}:`, e);
          }
        }));

        setScanProgress(Math.min(i + batchSize, targets.length));
        // Anti-rate limit pause
        await new Promise(r => setTimeout(r, 250));
      }

      setScanResults(results);
      setLastScanTime(new Date());
      setLastRefreshTime(new Date());
      // Init live prices from scan results
      const initPrices = {};
      results.forEach(r => { initPrices[r.symbol] = r.currentPrice; });
      setLivePrices(initPrices);
    } catch (err) {
      console.error(err);
      setScannerError(err.message || 'Error executing POC scan.');
    } finally {
      setIsScanningAll(false);
    }
  };

  // Auto-refresh live prices every 30s (without re-scanning VP)
  const refreshLivePrices = async () => {
    if (scanResults.length === 0 || isScanningAll) return;
    try {
      const symbols = scanResults.map(r => r.symbol);
      const updated = {};
      // Fetch in small batches to avoid rate limits
      for (let i = 0; i < symbols.length; i += 10) {
        const batch = symbols.slice(i, i + 10);
        await Promise.all(batch.map(async (sym) => {
          try {
            const klines = await fetchBybitData(sym, '15', 2);
            if (klines && klines.length > 0) {
              updated[sym] = Number(klines[0][4]); // latest close
            }
          } catch (_) {}
        }));
        await new Promise(r => setTimeout(r, 150));
      }
      setLivePrices(prev => ({ ...prev, ...updated }));
      setLastRefreshTime(new Date());
    } catch (_) {}
  };

  useEffect(() => {
    if (scanResults.length === 0) return;
    const interval = setInterval(refreshLivePrices, 30000);
    return () => clearInterval(interval);
  }, [scanResults, isScanningAll]);

  // Merge live prices and recalculate distances with live price
  const withLivePrice = (r) => {
    const livePrice = livePrices[r.symbol] ?? r.currentPrice;
    return {
      ...r,
      currentPrice: livePrice,
      distancePoc: ((livePrice - r.pocPrice) / r.pocPrice) * 100,
      distanceVah: ((livePrice - r.vah) / r.vah) * 100,
      distanceVal: ((livePrice - r.val) / r.val) * 100,
    };
  };

  // Filter and sort scanner results dynamically by proximity to key levels
  const pocResults = useMemo(() => {
    return scanResults
      .map(r => { const lr = withLivePrice(r); return { ...lr, activeDistance: lr.distancePoc }; })
      .filter(r => Math.abs(r.activeDistance) <= proximityLimit)
      .sort((a, b) => Math.abs(a.activeDistance) - Math.abs(b.activeDistance))
      .slice(0, 15);
  }, [scanResults, proximityLimit, livePrices]);

  const vahResults = useMemo(() => {
    return scanResults
      .map(r => { const lr = withLivePrice(r); return { ...lr, activeDistance: lr.distanceVah }; })
      .filter(r => Math.abs(r.activeDistance) <= proximityLimit)
      .sort((a, b) => Math.abs(a.activeDistance) - Math.abs(b.activeDistance))
      .slice(0, 15);
  }, [scanResults, proximityLimit, livePrices]);

  const valResults = useMemo(() => {
    return scanResults
      .map(r => { const lr = withLivePrice(r); return { ...lr, activeDistance: lr.distanceVal }; })
      .filter(r => Math.abs(r.activeDistance) <= proximityLimit)
      .sort((a, b) => Math.abs(a.activeDistance) - Math.abs(b.activeDistance))
      .slice(0, 15);
  }, [scanResults, proximityLimit, livePrices]);

  const renderTable = (results, categoryTitle, targetField, targetColor) => {
    if (results.length === 0) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0a0f', border: '1px solid #14141c', borderRadius: '12px', color: '#444', marginBottom: '2rem' }}>
          <Compass size={30} style={{ marginBottom: '10px', opacity: 0.3 }} />
          <p style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
            No tokens found within {proximityLimit.toFixed(1)}% of {categoryTitle} at this moment.
          </p>
        </div>
      );
    }
    return (
      <div style={{ background: '#0a0a0f', border: '1px solid #14141c', borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem' }}>
        <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid #14141c', fontWeight: 'bold', color: targetColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {categoryTitle} ({results.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #14141c', background: 'rgba(255,255,255,0.01)' }}>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#555', fontWeight: 'bold', width: '50px' }}>RANK</th>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#555', fontWeight: 'bold' }}>TOKEN</th>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#555', fontWeight: 'bold' }}>CURRENT PRICE</th>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#555', fontWeight: 'bold' }}>TARGET ({targetField})</th>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#555', fontWeight: 'bold' }}>DISTANCE</th>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#FFB800', fontWeight: 'bold' }}>⚡ SIGNAL</th>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#555', fontWeight: 'bold' }}>POSITION</th>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#555', fontWeight: 'bold', textAlign: 'right' }}>24H VOL</th>
              <th style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#555', fontWeight: 'bold', width: '110px', textAlign: 'center' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {results.map((t, idx) => {
              const isOverTarget = t.activeDistance >= 0;
              const distColor = Math.abs(t.activeDistance) <= 0.25 ? '#FFB800' : isOverTarget ? '#00ff88' : '#ff3b30';

              // ── Session Area Position ──
              let areaLabel = 'Inside Value Area';
              let areaCol = '#888';
              if (t.currentPrice > t.vah) {
                areaLabel = 'Above VAH (Breakout)';
                areaCol = '#00ff88';
              } else if (t.currentPrice < t.val) {
                areaLabel = 'Below VAL (Breakdown)';
                areaCol = '#ff3b30';
              } else if (Math.abs((t.currentPrice - t.vah)/t.vah) < 0.003) {
                areaLabel = 'Testing VAH Border';
                areaCol = '#00d0ff';
              } else if (Math.abs((t.currentPrice - t.val)/t.val) < 0.003) {
                areaLabel = 'Testing VAL Border';
                areaCol = '#9945FF';
              }

              // ── Directional Arrow Signal ──
              // arrow, label, sublabel, color, bg, border, animate
              let signal = { arrow: '↔', label: 'NEUTRE', sublabel: 'Compression POC', color: '#FFB800', bg: 'rgba(255,184,0,0.08)', border: '#FFB800', animate: false };

              const distToPocPct = Math.abs((t.currentPrice - t.pocPrice) / t.pocPrice) * 100;

              if (t.currentPrice > t.vah) {
                signal = { arrow: '↑↑', label: 'HAUSSIER', sublabel: 'Breakout VAH', color: '#00ff88', bg: 'rgba(0,255,136,0.12)', border: '#00ff88', animate: true };
              } else if (t.currentPrice < t.val) {
                signal = { arrow: '↓↓', label: 'BAISSIER', sublabel: 'Breakdown VAL', color: '#ff3b30', bg: 'rgba(255,59,48,0.12)', border: '#ff3b30', animate: true };
              } else if (Math.abs((t.currentPrice - t.vah)/t.vah) < 0.005) {
                signal = { arrow: '↗', label: 'TEST VAH', sublabel: 'Breakout imminent ?', color: '#00d0ff', bg: 'rgba(0,208,255,0.1)', border: '#00d0ff', animate: false };
              } else if (Math.abs((t.currentPrice - t.val)/t.val) < 0.005) {
                signal = { arrow: '↘', label: 'TEST VAL', sublabel: 'Rebond ou breakdown ?', color: '#9945FF', bg: 'rgba(153,69,255,0.1)', border: '#9945FF', animate: false };
              } else if (distToPocPct <= 0.3) {
                signal = { arrow: '↔', label: 'NEUTRE', sublabel: 'Compression POC', color: '#FFB800', bg: 'rgba(255,184,0,0.08)', border: '#FFB800', animate: false };
              } else if (t.currentPrice > t.pocPrice) {
                signal = { arrow: '↑', label: 'BIAIS BULL', sublabel: 'POC = Support', color: '#00ff88', bg: 'rgba(0,255,136,0.06)', border: 'rgba(0,255,136,0.4)', animate: false };
              } else {
                signal = { arrow: '↓', label: 'BIAIS BEAR', sublabel: 'POC = Résistance', color: '#ff3b30', bg: 'rgba(255,59,48,0.06)', border: 'rgba(255,59,48,0.4)', animate: false };
              }

              let targetPrice = t.pocPrice;
              if (targetField === 'VAH') targetPrice = t.vah;
              if (targetField === 'VAL') targetPrice = t.val;

              return (
                <tr
                  key={t.symbol}
                  style={{ borderBottom: '1px solid #101016', transition: 'all 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => handleViewChart(t.symbol)}
                >
                  <td style={{ padding: '14px 16px', fontSize: '0.75rem', color: '#444', fontWeight: 'bold' }}>#{idx + 1}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#fff' }}>{t.symbol.replace('USDT', '')}</span>
                    <span style={{ fontSize: '0.55rem', color: '#444', marginLeft: '5px' }}>USDT</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>
                    ${t.currentPrice.toLocaleString(undefined, { minimumFractionDigits: t.currentPrice < 1 ? 4 : 2, maximumFractionDigits: t.currentPrice < 1 ? 4 : 2 })}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 'bold', color: targetColor, fontFamily: 'monospace' }}>
                    ${targetPrice.toLocaleString(undefined, { minimumFractionDigits: targetPrice < 1 ? 4 : 2, maximumFractionDigits: targetPrice < 1 ? 4 : 2 })}
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace' }}>
                    <span style={{ color: distColor, fontWeight: '950', fontSize: '0.8rem' }}>
                      {isOverTarget ? '+' : ''}{t.activeDistance.toFixed(3)}%
                    </span>
                  </td>
                  {/* SIGNAL COLUMN — Directional Arrow */}
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      background: signal.bg,
                      border: `1px solid ${signal.border}`,
                      borderRadius: '10px', padding: '6px 12px', minWidth: '90px',
                      boxShadow: signal.animate ? `0 0 12px ${signal.color}55` : 'none',
                      transition: 'all 0.3s'
                    }}>
                      <span style={{
                        fontSize: '1.6rem', fontWeight: '900', color: signal.color,
                        lineHeight: 1,
                        textShadow: `0 0 10px ${signal.color}99`,
                        animation: signal.animate ? 'pulse-arrow 1.2s ease-in-out infinite' : 'none'
                      }}>
                        {signal.arrow}
                      </span>
                      <span style={{ fontSize: '0.6rem', fontWeight: '900', color: signal.color, letterSpacing: '0.05em' }}>
                        {signal.label}
                      </span>
                      <span style={{ fontSize: '0.5rem', color: '#555', marginTop: '1px' }}>
                        {signal.sublabel}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                    <span style={{ color: areaCol, background: `${areaCol}10`, border: `1px solid ${areaCol}20`, padding: '2px 8px', borderRadius: '4px' }}>
                      {areaLabel}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace' }}>
                    ${Math.round(t.turnover24h).toLocaleString()}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleViewChart(t.symbol); }}
                      style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid #222', color: '#fff', padding: '4px 10px',
                        borderRadius: '6px', fontSize: '0.6rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex',
                        alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#00d0ff'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
                    >
                      <Eye size={10} /> VIEW CHART
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };


  // Navigate to single chart from scanner list
  const handleViewChart = (symbol) => {
    setSelectedSymbol(symbol);
    setActiveTab('chart');
  };

  // Single Chart calculations
  const profileResults = useMemo(() => {
    if (candles15m.length === 0) return null;

    const candlesChron = [...candles15m].reverse().map(c => ({
      time: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5])
    }));

    const now = new Date();
    const startOfTodayTs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const startOfPrevDayTs = startOfTodayTs - 24 * 60 * 60 * 1000; // minuit J-1

    // Use previous day's candles (J-1: midnight J-1 to midnight J)
    let todayCandles = candlesChron.filter(c => c.time >= startOfPrevDayTs && c.time < startOfTodayTs);
    let usingFallback = false;
    if (todayCandles.length < 12) {
      // Fallback: 96 candles before today
      todayCandles = candlesChron.filter(c => c.time < startOfTodayTs).slice(-96);
      usingFallback = true;
    }

    const currentLivePrice = candlesChron[candlesChron.length - 1].close;

    const dayHigh = Math.max(...todayCandles.map(c => c.high));
    const dayLow = Math.min(...todayCandles.map(c => c.low));
    const dayOpen = todayCandles[0].open;
    const dayClose = todayCandles[todayCandles.length - 1].close;
    const dayVolume = todayCandles.reduce((acc, c) => acc + c.volume, 0);

    const binSize = (dayHigh - dayLow) / numBins;
    const bins = Array.from({ length: numBins }, (_, idx) => {
      const low = dayLow + idx * binSize;
      const high = low + binSize;
      return { idx, low, high, volume: 0 };
    });

    todayCandles.forEach(c => {
      const { high, low, volume } = c;
      if (high === low) {
        const binIdx = Math.min(Math.floor((high - dayLow) / binSize), numBins - 1);
        if (binIdx >= 0 && binIdx < numBins) {
          bins[binIdx].volume += volume;
        }
      } else {
        const overlapping = bins.filter(b => high >= b.low && low <= b.high);
        if (overlapping.length > 0) {
          const volPerBin = volume / overlapping.length;
          overlapping.forEach(b => {
            b.volume += volPerBin;
          });
        }
      }
    });

    let maxVol = 0;
    let pocPrice = (dayHigh + dayLow) / 2;
    let pocBinIdx = 0;

    bins.forEach((bin, idx) => {
      if (bin.volume > maxVol) {
        maxVol = bin.volume;
        pocPrice = (bin.low + bin.high) / 2;
        pocBinIdx = idx;
      }
    });

    const targetVaVol = dayVolume * 0.70;
    let vaMinIdx = pocBinIdx;
    let vaMaxIdx = pocBinIdx;
    let currentVaVol = bins[pocBinIdx]?.volume || 0;

    while (currentVaVol < targetVaVol && (vaMinIdx > 0 || vaMaxIdx < numBins - 1)) {
      let prevVol = 0;
      if (vaMinIdx > 0) {
        prevVol = bins[vaMinIdx - 1].volume + (bins[vaMinIdx - 2]?.volume || 0);
      }
      let nextVol = 0;
      if (vaMaxIdx < numBins - 1) {
        nextVol = bins[vaMaxIdx + 1].volume + (bins[vaMaxIdx + 2]?.volume || 0);
      }

      if (vaMinIdx > 0 && (vaMaxIdx === numBins - 1 || prevVol >= nextVol)) {
        currentVaVol += bins[vaMinIdx - 1].volume;
        vaMinIdx--;
      } else if (vaMaxIdx < numBins - 1) {
        currentVaVol += bins[vaMaxIdx + 1].volume;
        vaMaxIdx++;
      } else {
        break;
      }
    }

    const vah = bins[vaMaxIdx]?.high || dayHigh;
    const val = bins[vaMinIdx]?.low || dayLow;

    return {
      bins,
      dayHigh,
      dayLow,
      dayOpen,
      dayClose,
      dayVolume,
      pocPrice,
      vah,
      val,
      maxVol,
      todayCandles,
      allCandles: candlesChron,
      usingFallback,
      startOfDayTs: usingFallback ? todayCandles[0].time : startOfPrevDayTs
    };
  }, [candles15m, numBins]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchSymbol) return;
    const formatted = searchSymbol.toUpperCase().trim();
    const symbol = formatted.endsWith('USDT') ? formatted : formatted + 'USDT';
    setSelectedSymbol(symbol);
    setSearchSymbol('');
  };

  // Diagnostic
  const marketState = useMemo(() => {
    if (!profileResults) return null;
    const { dayClose, pocPrice, vah, val } = profileResults;

    let state = 'CONSOLIDATION';
    let color = '#FFB800';
    let description = 'Price is holding within the Value Area. Normal consolidation revolving around the POC.';

    if (dayClose > vah) {
      state = 'BULLISH BREAKOUT';
      color = '#00ff88';
      description = 'Price has broken above the Value Area High (VAH). High probability of continuation upwards.';
    } else if (dayClose < val) {
      state = 'BEARISH BREAKDOWN';
      color = '#ff3b30';
      description = 'Price has broken below the Value Area Low (VAL). Strong bearish momentum is active.';
    } else if (dayClose > pocPrice && dayClose <= vah) {
      state = 'ACCUMULATION ZONE';
      color = '#00d0ff';
      description = 'Price is trading between the POC and VAH. Buyers are attempting a breakout.';
    } else if (dayClose < pocPrice && dayClose >= val) {
      state = 'DISTRIBUTION ZONE';
      color = '#9945FF';
      description = 'Price is trading between the POC and VAL. Sellers are pushing lower.';
    }

    return { state, color, description };
  }, [profileResults]);

  // Custom SVG Chart Renders
  const renderChart = () => {
    if (!profileResults) return null;

    const {
      bins,
      dayHigh,
      dayLow,
      dayOpen,
      dayClose,
      pocPrice,
      vah,
      val,
      maxVol,
      allCandles,
      startOfDayTs
    } = profileResults;

    const width = 850;
    const height = 480;
    const padding = { top: 25, right: 80, bottom: 35, left: 10 };

    const visibleCandles = allCandles;
    const maxVal = Math.max(...visibleCandles.map(c => c.high));
    const minVal = Math.min(...visibleCandles.map(c => c.low));
    const priceRange = maxVal - minVal;
    
    const yMax = maxVal + priceRange * 0.07;
    const yMin = minVal - priceRange * 0.07;

    const getY = (price) => {
      const chartHeight = height - padding.top - padding.bottom;
      return padding.top + (1 - (price - yMin) / (yMax - yMin)) * chartHeight;
    };

    const profileXStart = padding.left;
    const profileWidth = 140;
    
    const chartXStart = padding.left + 160;
    const chartWidth = width - padding.right - chartXStart;

    const getX = (index) => {
      const denom = Math.max(1, visibleCandles.length - 1);
      return chartXStart + (index / denom) * chartWidth;
    };

    const candleWidth = Math.max(2, (chartWidth / visibleCandles.length) * 0.7);

    const gridCount = 6;
    const gridPrices = Array.from({ length: gridCount }, (_, i) => {
      return yMin + (i / (gridCount - 1)) * (yMax - yMin);
    });

    const dailyIsBullish = dayClose >= dayOpen;
    const dailyColor = dailyIsBullish ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 59, 48, 0.12)';
    const dailyBorder = dailyIsBullish ? '#00ff88' : '#ff3b30';

    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ background: '#050505', userSelect: 'none', overflow: 'visible' }}
        onMouseLeave={() => setHoveredElement(null)}
      >
        {/* Grid lines */}
        {gridPrices.map((p, i) => (
          <g key={i}>
            <line
              x1={profileXStart}
              y1={getY(p)}
              x2={width - padding.right}
              y2={getY(p)}
              stroke="#111"
              strokeWidth="1"
            />
            <text
              x={width - padding.right + 8}
              y={getY(p) + 4}
              fill="#555"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              ${p.toLocaleString(undefined, { minimumFractionDigits: p < 1 ? 5 : 2, maximumFractionDigits: p < 1 ? 5 : 2 })}
            </text>
          </g>
        ))}

        {/* Vertical Separation */}
        <line
          x1={chartXStart - 10}
          y1={padding.top}
          x2={chartXStart - 10}
          y2={height - padding.bottom}
          stroke="#1a1a1a"
          strokeDasharray="4,4"
        />

        {/* Daily Open Divider */}
        {(() => {
          const todayStartIndex = visibleCandles.findIndex(c => c.time >= startOfDayTs);
          if (todayStartIndex !== -1) {
            const openX = getX(todayStartIndex);
            return (
              <g>
                <line
                  x1={openX}
                  y1={padding.top}
                  x2={openX}
                  y2={height - padding.bottom}
                  stroke="rgba(0, 208, 255, 0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="5,5"
                />
                <text
                  x={openX + 5}
                  y={padding.top + 10}
                  fill="#00d0ff"
                  fontSize="8"
                  fontWeight="bold"
                  opacity="0.8"
                >
                  DAILY OPEN (00:00 UTC)
                </text>
              </g>
            );
          }
          return null;
        })()}

        {/* Volume Profile Bars (Left overlay) */}
        {bins.map((bin) => {
          const binYHigh = getY(bin.high);
          const binYLow = getY(bin.low);
          const binHeight = Math.max(1, binYLow - binYHigh);
          const barWidth = maxVol > 0 ? (bin.volume / maxVol) * profileWidth : 0;
          
          const isInValueArea = bin.high <= vah && bin.low >= val;
          const barColor = isInValueArea 
            ? 'rgba(255, 255, 255, 0.08)' 
            : 'rgba(255, 255, 255, 0.025)';

          const isHovered = hoveredElement?.type === 'bin' && hoveredElement.data.idx === bin.idx;

          return (
            <rect
              key={bin.idx}
              x={profileXStart}
              y={binYHigh}
              width={barWidth}
              height={binHeight - 0.5}
              fill={isHovered ? 'rgba(0, 208, 255, 0.25)' : barColor}
              stroke={isHovered ? '#00d0ff' : 'none'}
              strokeWidth="0.5"
              style={{ transition: 'fill 0.15s ease, width 0.3s ease' }}
              onMouseEnter={() => {
                setHoveredElement({
                  type: 'bin',
                  data: bin,
                  x: profileXStart + barWidth + 10,
                  y: binYHigh + binHeight / 2
                });
              }}
            />
          );
        })}

        {/* Daily Candlestick (Left Overlay) */}
        {(() => {
          const candleX = profileXStart + profileWidth / 2;
          const yOpen = getY(dayOpen);
          const yClose = getY(dayClose);
          const yHigh = getY(dayHigh);
          const yLow = getY(dayLow);

          const bodyY = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));

          const isHovered = hoveredElement?.type === 'daily';

          return (
            <g
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredElement({
                  type: 'daily',
                  data: { dayOpen, dayHigh, dayLow, dayClose, dayVolume: profileResults.dayVolume },
                  x: candleX + 40,
                  y: bodyY + bodyHeight / 2
                });
              }}
            >
              <line
                x1={candleX}
                y1={yHigh}
                x2={candleX}
                y2={yLow}
                stroke={dailyBorder}
                strokeWidth={isHovered ? 3 : 2}
                opacity="0.8"
              />
              <rect
                x={candleX - 25}
                y={bodyY}
                width="50"
                height={bodyHeight}
                fill={dailyColor}
                stroke={dailyBorder}
                strokeWidth={isHovered ? 2.5 : 1.5}
                rx="4"
                style={{ transition: 'stroke-width 0.15s ease' }}
              />
            </g>
          );
        })()}

        {/* POC Horizontal Highlight & Line */}
        {(() => {
          const yPoc = getY(pocPrice);
          const isHovered = hoveredElement?.type === 'poc';
          
          return (
            <g>
              <rect
                x={profileXStart}
                y={yPoc - 4}
                width={width - padding.right - profileXStart}
                height="8"
                fill="rgba(247, 147, 26, 0.08)"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHoveredElement({
                    type: 'poc',
                    data: { price: pocPrice },
                    x: width / 2,
                    y: yPoc
                  });
                }}
              />
              <line
                x1={profileXStart}
                y1={yPoc}
                x2={width - padding.right}
                y2={yPoc}
                stroke="#F7931A"
                strokeWidth={isHovered ? 2.5 : 1.5}
                strokeDasharray="4,3"
                style={{ filter: 'drop-shadow(0 0 3px rgba(247, 147, 26, 0.5))' }}
              />
              <rect
                x={width - padding.right + 2}
                y={yPoc - 8}
                width="72"
                height="16"
                fill="#F7931A"
                rx="3"
              />
              <text
                x={width - padding.right + 38}
                y={yPoc + 4}
                fill="#000"
                fontSize="8"
                fontWeight="900"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                POC: ${pocPrice.toLocaleString(undefined, { minimumFractionDigits: pocPrice < 1 ? 4 : 2, maximumFractionDigits: pocPrice < 1 ? 4 : 2 })}
              </text>
            </g>
          );
        })()}

        {/* VAH/VAL Bounds */}
        <line
          x1={profileXStart}
          y1={getY(vah)}
          x2={width - padding.right}
          y2={getY(vah)}
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
        <text
          x={profileXStart + 5}
          y={getY(vah) - 5}
          fill="rgba(255, 255, 255, 0.5)"
          fontSize="7"
          fontWeight="bold"
        >
          VAH: ${vah.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </text>

        <line
          x1={profileXStart}
          y1={getY(val)}
          x2={width - padding.right}
          y2={getY(val)}
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
        <text
          x={profileXStart + 5}
          y={getY(val) + 12}
          fill="rgba(255, 255, 255, 0.5)"
          fontSize="7"
          fontWeight="bold"
        >
          VAL: ${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </text>

        {/* 15m Candlestick series */}
        {visibleCandles.map((c, idx) => {
          const cX = getX(idx);
          const cOpen = getY(c.open);
          const cClose = getY(c.close);
          const cHigh = getY(c.high);
          const cLow = getY(c.low);

          const isToday = c.time >= startOfDayTs;
          const baseColor = c.close >= c.open ? '#00ff88' : '#ff3b30';
          
          const opacity = isToday ? '1' : '0.25';

          const bodyY = Math.min(cOpen, cClose);
          const bodyHeight = Math.max(1.5, Math.abs(cOpen - cClose));

          const isHovered = hoveredElement?.type === 'candle' && hoveredElement.data.time === c.time;

          return (
            <g
              key={c.time}
              opacity={opacity}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredElement({
                  type: 'candle',
                  data: c,
                  x: cX,
                  y: bodyY
                });
              }}
            >
              <line
                x1={cX}
                y1={cHigh}
                x2={cX}
                y2={cLow}
                stroke={baseColor}
                strokeWidth={isHovered ? 2 : 1}
              />
              <rect
                x={cX - candleWidth / 2}
                y={bodyY}
                width={candleWidth}
                height={bodyHeight}
                fill={baseColor}
                stroke={isHovered ? '#fff' : 'none'}
                strokeWidth="0.5"
              />
            </g>
          );
        })}

        {/* Interactive hover tooltip popup */}
        {hoveredElement && (() => {
          const { type, data, x, y } = hoveredElement;
          const tooltipWidth = type === 'daily' ? 180 : 150;
          const tooltipHeight = type === 'daily' ? 110 : 80;
          
          let tx = x + 15;
          let ty = y - tooltipHeight / 2;

          if (tx + tooltipWidth > width) {
            tx = x - tooltipWidth - 15;
          }
          if (ty < 10) ty = 10;
          if (ty + tooltipHeight > height - 10) ty = height - tooltipHeight - 10;

          return (
            <g>
              <rect
                x={tx}
                y={ty}
                width={tooltipWidth}
                height={tooltipHeight}
                fill="rgba(10, 10, 10, 0.95)"
                stroke="#333"
                strokeWidth="1.5"
                rx="8"
                style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.8))' }}
              />
              
              {type === 'candle' && (
                <g transform={`translate(${tx + 12}, ${ty + 15})`}>
                  <text fill="#888" fontSize="8" fontWeight="bold">15m CANDLE DETAIL</text>
                  <text fill="#444" fontSize="7" y="10" fontFamily="monospace">
                    {new Date(data.time).toLocaleTimeString()}
                  </text>
                  <text fill="#aaa" fontSize="8" y="24">O: <tspan fill="#fff" fontWeight="bold">${data.open.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="36">H: <tspan fill="#00ff88" fontWeight="bold">${data.high.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="48">L: <tspan fill="#ff3b30" fontWeight="bold">${data.low.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="60">C: <tspan fill="#fff" fontWeight="bold">${data.close.toLocaleString()}</tspan></text>
                </g>
              )}

              {type === 'bin' && (
                <g transform={`translate(${tx + 12}, ${ty + 15})`}>
                  <text fill="#00d0ff" fontSize="8" fontWeight="900" letterSpacing="0.5">VOLUME PROFILE ROW</text>
                  <text fill="#aaa" fontSize="8" y="20">Min Price: <tspan fill="#fff" fontWeight="bold">${data.low.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="32">Max Price: <tspan fill="#fff" fontWeight="bold">${data.high.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="48">Volume: <tspan fill="#00d0ff" fontWeight="bold">{Math.round(data.volume).toLocaleString()}</tspan></text>
                  <text fill="#666" fontSize="7" y="60">Percent: <tspan fill="#888">{((data.volume / maxVol) * 100).toFixed(1)}% of Peak</tspan></text>
                </g>
              )}

              {type === 'daily' && (
                <g transform={`translate(${tx + 12}, ${ty + 15})`}>
                  <text fill="#00ff88" fontSize="9" fontWeight="950" letterSpacing="1">DAILY CANDLE STATS</text>
                  <text fill="#444" fontSize="7" y="10" fontFamily="monospace">
                    TODAY (00:00 UTC - NOW)
                  </text>
                  <text fill="#aaa" fontSize="8" y="26">Open: <tspan fill="#fff" fontWeight="bold">${data.dayOpen.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="38">High: <tspan fill="#00ff88" fontWeight="bold">${data.dayHigh.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="50">Low: <tspan fill="#ff3b30" fontWeight="bold">${data.dayLow.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="62">Close: <tspan fill="#fff" fontWeight="bold">${data.dayClose.toLocaleString()}</tspan></text>
                  <text fill="#aaa" fontSize="8" y="78">Total Vol: <tspan fill="#00e676" fontWeight="bold">{Math.round(data.dayVolume).toLocaleString()}</tspan></text>
                </g>
              )}

              {type === 'poc' && (
                <g transform={`translate(${tx + 12}, ${ty + 15})`}>
                  <text fill="#F7931A" fontSize="9" fontWeight="950" letterSpacing="1">POINT OF CONTROL (POC)</text>
                  <text fill="#aaa" fontSize="8" y="24">Level: <tspan fill="#fff" fontWeight="bold">${data.price.toLocaleString()}</tspan></text>
                  <text fill="#777" fontSize="7.5" y="42">Highest traded volume level</text>
                  <text fill="#777" fontSize="7.5" y="52">acts as solid market anchor.</text>
                </g>
              )}
            </g>
          );
        })()}
      </svg>
    );
  };

  // Depth walls integration
  const orderBookWalls = useMemo(() => {
    if (!depthData || !profileResults) return [];
    const { pocPrice } = profileResults;
    const allWalls = [];

    if (depthData.b) {
      depthData.b.forEach(b => {
        const price = parseFloat(b[0]);
        const size = parseFloat(b[1]);
        const distancePercent = ((price - pocPrice) / pocPrice) * 100;
        if (Math.abs(distancePercent) < 2.5) {
          allWalls.push({ side: 'BID', price, size, distancePercent });
        }
      });
    }

    if (depthData.a) {
      depthData.a.forEach(a => {
        const price = parseFloat(a[0]);
        const size = parseFloat(a[1]);
        const distancePercent = ((price - pocPrice) / pocPrice) * 100;
        if (Math.abs(distancePercent) < 2.5) {
          allWalls.push({ side: 'ASK', price, size, distancePercent });
        }
      });
    }

    return allWalls.sort((a, b) => b.size - a.size).slice(0, 5);
  }, [depthData, profileResults]);

  return (
    <div style={{ background: '#08080c', border: '1px solid #14141c', borderRadius: '16px', padding: '1.5rem', marginTop: '2rem', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Tab Navigation header */}
      <div style={{ display: 'flex', borderBottom: '1px solid #14141c', paddingBottom: '1rem', marginBottom: '1.5rem', gap: '15px' }}>
        <button
          onClick={() => setActiveTab('chart')}
          style={{
            background: activeTab === 'chart' ? 'rgba(247, 147, 26, 0.15)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${activeTab === 'chart' ? '#F7931A' : '#222'}`,
            color: activeTab === 'chart' ? '#F7931A' : '#888',
            borderRadius: '8px',
            padding: '8px 20px',
            fontSize: '0.75rem',
            fontWeight: '900',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.3s ease'
          }}
        >
          <BarChart2 size={14} />
          📈 GRAPHIC & VOLUME PROFILE
        </button>
        <button
          onClick={() => {
            setActiveTab('scanner');
            if (scanResults.length === 0 && !isScanningAll) {
              runPocScanner();
            }
          }}
          style={{
            background: activeTab === 'scanner' ? 'rgba(0, 208, 255, 0.15)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${activeTab === 'scanner' ? '#00d0ff' : '#222'}`,
            color: activeTab === 'scanner' ? '#00d0ff' : '#888',
            borderRadius: '8px',
            padding: '8px 20px',
            fontSize: '0.75rem',
            fontWeight: '900',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.3s ease'
          }}
        >
          <Compass size={14} />
          🔍 TOP 100 POC PROXIMITY SCANNER
        </button>
      </div>

      {/* ====================================================================== */}
      {/* ===================== TAB 1: SINGLE TOKEN GRAPHIC ==================== */}
      {/* ====================================================================== */}
      {activeTab === 'chart' && (
        <>
          {/* Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(247, 147, 26, 0.1)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(247, 147, 26, 0.2)' }}>
                <BarChart2 size={24} color="#F7931A" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: '900', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedSymbol.replace('USDT', '')} PROFILE
                </h3>
                <span style={{ fontSize: '0.6rem', color: '#555' }}>INTRADAY CANDLES OVERLAID BY SESSION VOLUME PROFILE</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '5px', background: '#0e0e14', padding: '3px', borderRadius: '8px', border: '1px solid #191924' }}>
                {quickSymbols.map(sym => (
                  <button
                    key={sym}
                    onClick={() => setSelectedSymbol(sym)}
                    style={{
                      background: selectedSymbol === sym ? '#F7931A' : 'transparent',
                      color: selectedSymbol === sym ? '#000' : '#888',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {sym.replace('USDT', '')}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '5px' }}>
                <input
                  type="text"
                  value={searchSymbol}
                  onChange={e => setSearchSymbol(e.target.value)}
                  placeholder="Ex: XRP, BNB..."
                  style={{
                    background: '#0e0e14',
                    border: '1px solid #191924',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    width: '120px'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#F7931A',
                    color: '#000',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: '900',
                    cursor: 'pointer'
                  }}
                >
                  SEARCH
                </button>
              </form>
            </div>
          </div>

          {loadingChart && candles15m.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '350px', color: '#444' }}>
              <Activity size={40} style={{ color: '#F7931A', marginBottom: '15px' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '2px' }}>CALCULATING MARKET VOLUME PROFILE...</span>
            </div>
          ) : chartError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '350px', color: '#ff3b30' }}>
              <ShieldAlert size={40} style={{ marginBottom: '15px' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{chartError}</span>
              <button onClick={() => loadChartData(selectedSymbol)} style={{ marginTop: '15px', background: '#222', border: 'none', color: '#fff', padding: '6px 15px', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '3.2fr 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#050505', border: '1px solid #14141c', borderRadius: '12px', padding: '10px', position: 'relative', overflow: 'hidden' }}>
                {profileResults?.usingFallback && (
                  <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(255, 184, 0, 0.1)', border: '1px solid rgba(255, 184, 0, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.55rem', color: '#FFB800', fontWeight: 'bold', zIndex: 10 }}>
                    ⚠️ Early session fallback: Showing rolling 24H data
                  </div>
                )}
                
                <div style={{ height: '480px', width: '100%' }}>
                  {renderChart()}
                </div>
              </div>

              {/* Sidebar Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {marketState && (
                  <div style={{ background: `linear-gradient(135deg, ${marketState.color}15, #08080c)`, border: `1px solid ${marketState.color}30`, borderRadius: '12px', padding: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Award size={16} color={marketState.color} />
                      <span style={{ color: marketState.color, fontSize: '0.75rem', fontWeight: '950', letterSpacing: '0.5px' }}>STRUCTURE DIAGNOSTIC</span>
                    </div>
                    <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '900', margin: '0 0 8px 0' }}>{marketState.state}</h4>
                    <p style={{ color: '#888', fontSize: '0.65rem', lineHeight: '1.4', margin: 0 }}>{marketState.description}</p>
                  </div>
                )}

                {profileResults && (
                  <div style={{ background: '#0a0a0f', border: '1px solid #14141c', borderRadius: '12px', padding: '1.2rem' }}>
                    <h4 style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', margin: '0 0 12px 0', letterSpacing: '0.5px' }}>VP SESSION METRICS</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#050508', borderRadius: '6px', border: '1px solid #101016' }}>
                        <span style={{ color: '#555', fontSize: '0.6rem', fontWeight: 'bold' }}>POINT OF CONTROL</span>
                        <span style={{ color: '#F7931A', fontSize: '0.75rem', fontWeight: '900' }}>
                          ${profileResults.pocPrice.toLocaleString(undefined, { minimumFractionDigits: profileResults.pocPrice < 1 ? 4 : 2 })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#050508', borderRadius: '6px', border: '1px solid #101016' }}>
                        <span style={{ color: '#555', fontSize: '0.6rem', fontWeight: 'bold' }}>VALUE AREA HIGH (VAH)</span>
                        <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: '900' }}>
                          ${profileResults.vah.toLocaleString(undefined, { minimumFractionDigits: profileResults.vah < 1 ? 4 : 2 })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#050508', borderRadius: '6px', border: '1px solid #101016' }}>
                        <span style={{ color: '#555', fontSize: '0.6rem', fontWeight: 'bold' }}>VALUE AREA LOW (VAL)</span>
                        <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: '900' }}>
                          ${profileResults.val.toLocaleString(undefined, { minimumFractionDigits: profileResults.val < 1 ? 4 : 2 })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#050508', borderRadius: '6px', border: '1px solid #101016' }}>
                        <span style={{ color: '#555', fontSize: '0.6rem', fontWeight: 'bold' }}>TOTAL INTRADAY VOLUME</span>
                        <span style={{ color: '#00e676', fontSize: '0.75rem', fontWeight: '900' }}>
                          {Math.round(profileResults.dayVolume).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {orderBookWalls.length > 0 && (
                  <div style={{ background: '#0a0a0f', border: '1px solid #14141c', borderRadius: '12px', padding: '1.2rem' }}>
                    <h4 style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', margin: '0 0 10px 0', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={12} color="#00d0ff" />
                      DEPTH WALLS NEAR POC (±2.5%)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {orderBookWalls.map((wall, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            background: 'rgba(255, 255, 255, 0.01)',
                            borderRadius: '6px',
                            borderLeft: `3px solid ${wall.side === 'BID' ? '#00ff88' : '#ff3b30'}`,
                            fontSize: '0.65rem'
                          }}
                        >
                          <span style={{ color: '#fff', fontWeight: 'bold' }}>${wall.price.toLocaleString()}</span>
                          <span style={{ color: wall.side === 'BID' ? '#00ff88' : '#ff3b30', fontWeight: '900' }}>
                            {wall.size.toLocaleString(undefined, { maximumFractionDigits: 1 })} ({wall.distancePercent >= 0 ? '+' : ''}{wall.distancePercent.toFixed(2)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ====================================================================== */}
      {/* ===================== TAB 2: POC ALIGNMENT SCANNER =================== */}
      {/* ====================================================================== */}
      {activeTab === 'scanner' && (
        <div>
          {/* Header & Scanning state */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: '900', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={20} color="#00d0ff" />
                TOP 100 POC PROXIMITY ENGINE
              </h3>
              <span style={{ fontSize: '0.6rem', color: '#555' }}>
                SCANS THE TOP 100 BYBIT TOKENS BY VOLUME AND DETECTS COILING NEAR THEIR POINT OF CONTROL
              </span>
            </div>

            <button
              onClick={runPocScanner}
              disabled={isScanningAll}
              style={{
                background: '#00d0ff',
                color: '#000',
                border: 'none',
                padding: '8px 24px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: '900',
                cursor: 'pointer',
                opacity: isScanningAll ? 0.6 : 1,
                boxShadow: '0 0 15px rgba(0, 208, 255, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              {isScanningAll ? `SCANNING (${scanProgress}/100)...` : '🔄 RE-SCAN TOP 100'}
            </button>
          </div>

          {/* Scanner Error Alert */}
          {scannerError && (
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.2)', borderRadius: '8px', padding: '12px', color: '#ff3b30', fontSize: '0.75rem', marginBottom: '1.5rem' }}>
              <ShieldAlert size={16} />
              <span>{scannerError}</span>
            </div>
          )}

          {/* Scanning Progress bar */}
          {isScanningAll && (
            <div style={{ background: '#0e0e14', padding: '1.5rem', borderRadius: '12px', border: '1px solid #191924', marginBottom: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#888', marginBottom: '8px' }}>
                Analyzing Daily Volume Profiles of Top Traded Coins...
              </div>
              <div style={{ background: '#222', height: '6px', borderRadius: '3px', width: '100%', overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    background: '#00d0ff',
                    height: '100%',
                    width: `${scanProgress}%`,
                    transition: 'width 0.2s ease',
                    boxShadow: '0 0 10px #00d0ff'
                  }}
                ></div>
              </div>
              <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '8px' }}>
                Fetched {scanProgress} of 100 markets • Safe API throttling enabled
              </div>
            </div>
          )}

          {/* Results dashboard */}
          {scanResults.length > 0 && (
            <div>
              {/* Dynamic Filtering Panel */}
              <div style={{ background: '#0a0a0f', border: '1px solid #14141c', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ background: 'rgba(0, 208, 255, 0.1)', padding: '8px', borderRadius: '8px' }}>
                    <Filter size={18} color="#00d0ff" />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.55rem', color: '#555', display: 'block', fontWeight: 'bold' }}>PROXIMITY THRESHOLD</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min="0.1"
                        max="3.0"
                        step="0.1"
                        value={proximityLimit}
                        onChange={e => setProximityLimit(parseFloat(e.target.value))}
                        style={{ accentColor: '#00d0ff', cursor: 'pointer', width: '180px' }}
                      />
                      <span style={{ color: '#00d0ff', fontSize: '0.85rem', fontWeight: '900' }}>
                        {proximityLimit.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', textAlign: 'right' }}>
                  <div>
                    <span style={{ fontSize: '0.55rem', color: '#555', display: 'block', fontWeight: 'bold' }}>TOTAL SCANNED</span>
                    <span style={{ color: '#fff', fontSize: '1rem', fontWeight: '900' }}>{scanResults.length} Tokens</span>
                  </div>
                </div>
              </div>

              {/* Render Three Tables */}
              {renderTable(pocResults, '🎯 TOKENS PROCHES DU POC (POINT OF CONTROL)', 'POC', '#F7931A')}
              {renderTable(vahResults, '📈 TOKENS PROCHES DE LA VAH (RÉSISTANCE / BREAKOUT)', 'VAH', '#00ff88')}
              {renderTable(valResults, '📉 TOKENS PROCHES DE LA VAL (SUPPORT / REBOND)', 'VAL', '#ff3b30')}
            </div>
          )}

          {/* Call to action when results are empty and not scanning */}
          {scanResults.length === 0 && !isScanningAll && (
            <div style={{ padding: '5rem 2rem', textAlign: 'center', background: '#0a0a0f', border: '1px solid #14141c', borderRadius: '12px', color: '#444' }}>
              <Activity size={40} style={{ color: '#00d0ff', marginBottom: '15px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                POC Proximity database is currently empty.
              </p>
              <p style={{ fontSize: '0.7rem', color: '#555', marginTop: '5px', marginBottom: '20px' }}>
                Launch the scanner now to discover which of the top 100 assets are accumulating right on their daily Point of Control.
              </p>
              <button
                onClick={runPocScanner}
                style={{
                  background: '#00d0ff',
                  color: '#000',
                  border: 'none',
                  padding: '8px 24px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(0, 208, 255, 0.2)'
                }}
              >
                START SCANNING NOW
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default VolumeProfileScanner;
