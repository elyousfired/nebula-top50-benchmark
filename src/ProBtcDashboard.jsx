import React, { useState, useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';
import { runMultiTimeframeScan } from './logic/btcScannerEngine';
import { fetchSyntheticBtcChartData, fetchStandardChartData, detectSupportResistance, calculateSlopeEMA } from './logic/btcChartEngine';
import { loadSimulation, saveSimulation, resetSimulation, processSimulationCycle, getTotalBtc } from './logic/simulationEngine';
import BtcMiniChart from './BtcMiniChart';
import './pro-btc-theme.css';

const timeframes = ['5m', '15m', '1h', '4h', '1d', '1W', '1M'];

function formatMoney(num) {
  if (Math.abs(num) >= 1e9) return (Math.abs(num) / 1e9).toFixed(2) + 'B';
  if (Math.abs(num) >= 1e6) return (Math.abs(num) / 1e6).toFixed(2) + 'M';
  if (Math.abs(num) >= 1e3) return (Math.abs(num) / 1e3).toFixed(2) + 'K';
  return Math.abs(num).toFixed(2);
}

function formatAge(candleTime) {
  if (!candleTime) return '';
  const nowSec = Math.floor(Date.now() / 1000);
  const diffMin = Math.round((nowSec - candleTime) / 60);
  if (diffMin < 1) return '< 1 min ✅';
  if (diffMin < 60) return `${diffMin} min ago`;
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hrs}h${mins > 0 ? mins + 'm' : ''} ago`;
}

function signalFreshness(candleTime) {
  if (!candleTime) return 'old';
  const diffMin = Math.round((Date.now() / 1000 - candleTime) / 60);
  if (diffMin <= 5) return 'hot';   // < 5 min = ultra frais
  if (diffMin <= 30) return 'warm'; // 5-30 min = frais
  return 'old';                     // > 30 min = vieux
}

const ProBtcDashboard = () => {
  // Navigation & Symbols State
  const [topTokens, setTopTokens] = useState([]);
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [chartPair, setChartPair] = useState('BTC'); // 'BTC' or 'USDT'
  
  // Market & Analysis Data
  const [radarLoading, setRadarLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [sidebarTab, setSidebarTab] = useState('TOP100'); // 'TOP100' or 'SIGNALS'
  const [layoutMode, setLayoutMode] = useState('DASHBOARD'); // 'DASHBOARD' or 'GRID'
  
  // Scan Progress
  const [scanMessage, setScanMessage] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  // Paper Trading Simulation
  const [simulation, setSimulation] = useState(() => loadSimulation());
  const [currentPrices, setCurrentPrices] = useState({});
  const [simEvents, setSimEvents] = useState([]); // recent events for notifications

  // Chart References
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const cvdSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const isDrawingModeRef = useRef(false);
  const customLinesRef = useRef([]);

  const toggleDrawingMode = () => {
    const newState = !isDrawingMode;
    setIsDrawingMode(newState);
    isDrawingModeRef.current = newState;
  };

  const clearCustomLines = () => {
    if (candleSeriesRef.current) {
      customLinesRef.current.forEach(line => candleSeriesRef.current.removePriceLine(line));
      customLinesRef.current = [];
    }
  };

  // Fetch Top 100 List with MTF Scan
  const loadRadarData = async (showRefIndicator = false) => {
    if (showRefIndicator) setRefreshing(true);
    setRadarLoading(true);
    try {
      const { tokens, currentPrices: prices } = await runMultiTimeframeScan((msg, prog) => {
        setScanMessage(msg);
        setScanProgress(prog);
      });
      setTopTokens(tokens);
      setCurrentPrices(prices);
      if (tokens.length > 0 && !activeSymbol) {
        setActiveSymbol(tokens[0].symbol);
      }
      // Run simulation cycle
      const signalTokens = tokens.filter(t => t.signals && t.signals.length > 0);
      const { simulation: updatedSim, events } = processSimulationCycle(simulation, signalTokens, prices);
      setSimulation(updatedSim);
      if (events.length > 0) setSimEvents(events);
    } catch (e) {
      console.error("Failed loading top 100", e);
    } finally {
      setRefreshing(false);
      setRadarLoading(false);
      setScanMessage('');
      setScanProgress(0);
    }
  };

  useEffect(() => {
    loadRadarData();
    const interval = setInterval(() => loadRadarData(), 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Initialize chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
        fontFamily: 'Inter, sans-serif'
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#888', style: 2, labelBackgroundColor: '#333' },
        horzLine: { color: '#888', style: 2, labelBackgroundColor: '#333' }
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        autoScale: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: 600
    });

    chartRef.current = chart;

    // Synthetic Candles Series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      }
    });

    // SLOPE EMA 9 Line Series
    ema9SeriesRef.current = chart.addLineSeries({
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      }
    });

    // SLOPE EMA 20 Line Series
    ema20SeriesRef.current = chart.addLineSeries({
      lineWidth: 3,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      }
    });

    // SLOPE EMA 50 Line Series
    ema50SeriesRef.current = chart.addLineSeries({
      lineWidth: 4,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      }
    });

    // Volume Overlay Series
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: 'rgba(0, 255, 136, 0.15)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume-scale', // Separate hidden scale
      lastValueVisible: false,
    });

    // Net Flow (CVD) Series
    cvdSeriesRef.current = chart.addLineSeries({
      color: '#00e5ff',
      lineWidth: 2,
      priceScaleId: 'left', // Use left scale so it doesn't squish price
      priceFormat: { type: 'volume' }
    });
    
    chart.priceScale('volume-scale').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
    });

    chart.subscribeClick((param) => {
      if (!isDrawingModeRef.current || !param.point || !candleSeriesRef.current) return;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (price !== null) {
        const line = candleSeriesRef.current.createPriceLine({
          price: price,
          color: '#2962FF',
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: 'User',
        });
        customLinesRef.current.push(line);
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Fetch and Load Candlestick Charts
  const loadChartData = async (showLoading = true) => {
    if (showLoading) {
      setChartLoading(true);
      setChartError(null);
    }
    
    try {
      let data = [];
      if (chartPair === 'BTC') {
        data = await fetchSyntheticBtcChartData(activeSymbol, timeframe);
      } else {
        data = await fetchStandardChartData(activeSymbol, timeframe);
      }
      
      if (!data || data.length === 0) {
        if (showLoading) {
          setChartError(`Pas de données de bougies pour ${activeSymbol}/${chartPair} en ${timeframe}.`);
        }
        candleSeriesRef.current?.setData([]);
        ema9SeriesRef.current?.setData([]);
        ema20SeriesRef.current?.setData([]);
        ema50SeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        cvdSeriesRef.current?.setData([]);
        return;
      }

      // Filter extreme outliers for BTC pairs (sometimes bad API data)
      const median = data.map(d => d.close).sort((a,b) => a-b)[Math.floor(data.length/2)];
      const filtered = data.filter(d => d.close > 0 && d.close < median * 10);

      // Populate Candle Chart
      candleSeriesRef.current?.setData(filtered);

      // Populate Volume Histogram
      const volumeData = filtered.map(d => ({
        time: d.time,
        value: d.value,
        color: d.close >= d.open ? 'rgba(0, 255, 136, 0.25)' : 'rgba(255, 59, 48, 0.25)'
      }));
      volumeSeriesRef.current?.setData(volumeData);

      // Populate CVD (Net Flow)
      let cumulativeFlow = 0;
      let prevFlow = 0;
      const cvdData = filtered.map(d => {
        const o = d.tokenOpen;
        const c = d.tokenClose;
        const turnover = d.value;
        if (o > 0) {
          cumulativeFlow += turnover * ((c - o) / o);
        }
        
        let color = cumulativeFlow >= prevFlow ? '#ffffff' : '#000000';
        prevFlow = cumulativeFlow;
        
        return { time: d.time, value: cumulativeFlow, color };
      });
      cvdSeriesRef.current?.setData(cvdData);

      // Populate Slope EMA 9
      const ema9 = calculateSlopeEMA(filtered, 9, '#ef5350'); // Red
      ema9SeriesRef.current?.setData(ema9);

      // Populate Slope EMA 20
      const ema20 = calculateSlopeEMA(filtered, 20, '#facc15'); // Yellow
      ema20SeriesRef.current?.setData(ema20);

      // Populate Slope EMA 50
      const ema50 = calculateSlopeEMA(filtered, 50, '#2962FF'); // Blue
      ema50SeriesRef.current?.setData(ema50);

      // Remove old price lines
      if (candleSeriesRef.current) {
        priceLinesRef.current.forEach(pl => candleSeriesRef.current.removePriceLine(pl));
        priceLinesRef.current = [];

        // Detect and draw Supports/Resistances based on the CURRENT timeframe (LTF or HTF)
        const livePrice = filtered.length > 0 ? filtered[filtered.length - 1].close : null;
        const { supports, resistances } = detectSupportResistance(filtered, 15, 10, livePrice);
        
        supports.forEach(s => {
          const line = candleSeriesRef.current.createPriceLine({
            price: s.price,
            color: '#00ff88',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Sup',
          });
          priceLinesRef.current.push(line);
        });

        resistances.forEach(r => {
          const line = candleSeriesRef.current.createPriceLine({
            price: r.price,
            color: '#ff3b30',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Res',
          });
          priceLinesRef.current.push(line);
        });
      }

      chartRef.current?.priceScale('right').applyOptions({
        autoScale: true,
      });

      if (showLoading) {
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error(err);
      if (showLoading) {
        setChartError("Échec du chargement du graphique.");
      }
    } finally {
      if (showLoading) {
        setChartLoading(false);
      }
    }
  };

  useEffect(() => {
    loadChartData(true);
    const interval = setInterval(() => {
      loadChartData(false);
    }, 15000); // 15 seconds silent refresh
    return () => clearInterval(interval);
  }, [activeSymbol, timeframe, chartPair]);

  // Handle resize when switching back to DASHBOARD view
  useEffect(() => {
    if (layoutMode === 'DASHBOARD' && chartRef.current && chartContainerRef.current) {
      setTimeout(() => {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }, 50); // slight delay to allow flex layout to compute
    }
  }, [layoutMode]);

  return (
    <div className="pro-dashboard btc-theme-wrapper">


      {/* TOP CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '10px' }}>
        <button
          className="tf-btn"
          style={layoutMode === 'DASHBOARD' ? { borderColor: '#facc15', color: '#facc15' } : {}}
          onClick={() => setLayoutMode('DASHBOARD')}
        >
          📄 VUE DÉTAILLÉE
        </button>
        <button
          className="tf-btn"
          style={layoutMode === 'GRID' ? { borderColor: '#facc15', color: '#000', background: '#facc15' } : {}}
          onClick={() => setLayoutMode('GRID')}
        >
          🔲 GRILLE DE CHARTS
        </button>
      </div>

      {/* VUE DÉTAILLÉE */}
      <div className="workstation-layout" style={{ display: layoutMode === 'DASHBOARD' ? 'flex' : 'none' }}>
        {/* Main Center: Chart */}
        <div className="chart-panel">
          <div className="panel-header-toolbar">
            <div className="header-meta">
              <span className="pair-title">
                <TrendingUp size={18} color={chartPair === 'BTC' ? "#facc15" : "#00ff88"} /> 
                {activeSymbol}/{chartPair}
              </span>
              <span className="live-badge">PRO ALPHA</span>
            </div>
            <div className="timeframe-toolbar">
              {timeframes.map(tf => (
                <button 
                  key={tf} 
                  className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
              <div style={{ width: '1px', height: '20px', background: '#333', margin: '0 10px' }} />
              <button 
                className={`tf-btn ${chartPair === 'BTC' ? 'active' : ''}`}
                style={chartPair === 'BTC' ? { borderColor: '#facc15', color: '#facc15' } : {}}
                onClick={() => setChartPair('BTC')}
              >
                /BTC
              </button>
              <button 
                className={`tf-btn ${chartPair === 'USDT' ? 'active' : ''}`}
                style={chartPair === 'USDT' ? { borderColor: '#00ff88', color: '#00ff88' } : {}}
                onClick={() => setChartPair('USDT')}
              >
                /USDT
              </button>
              <div style={{ width: '1px', height: '20px', background: '#333', margin: '0 10px' }} />
              <button 
                className={`tf-btn ${isDrawingMode ? 'active' : ''}`}
                style={isDrawingMode ? { borderColor: '#2962FF', color: '#2962FF' } : {}}
                onClick={toggleDrawingMode}
                title="Dessiner une ligne horizontale"
              >
                ✏️ LIGNE
              </button>
              <button 
                className="tf-btn"
                onClick={clearCustomLines}
                title="Effacer les lignes"
              >
                🗑️
              </button>
            </div>
            <button onClick={() => loadRadarData(true)} disabled={refreshing} className="btn-refresh">
              <RefreshCw size={13} className={refreshing ? "spin" : ""} /> {refreshing ? "Actualisation..." : "Rafraîchir"}
            </button>
          </div>

          <div className="chart-wrapper">
            {chartError && <div className="error-overlay">{chartError}</div>}
            {chartLoading && <div className="loading-overlay">Calcul des chandelles {activeSymbol}/BTC...</div>}
            <div ref={chartContainerRef} className="chart-container" style={{height: '600px'}} />
          </div>

          <div className="legend-toolbar">
            <div className="legend-items">
              <span className="legend-dot green">Bougies {activeSymbol}/{chartPair}</span>
              <span className="legend-dot yellow">EMA 20</span>
              <span className="legend-dot" style={{backgroundColor: '#00ff88'}}>Support (Proche)</span>
              <span className="legend-dot" style={{backgroundColor: '#ff3b30'}}>Résistance (Proche)</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Top 100 Radar */}
        <div className="sidebar-panel">
          <div className="panel-title" style={{display: 'flex', gap: '10px', paddingBottom: '10px'}}>
            <button 
              className={`tf-btn ${sidebarTab === 'TOP100' ? 'active' : ''}`} 
              onClick={() => setSidebarTab('TOP100')}
              style={sidebarTab === 'TOP100' ? {borderColor: '#facc15', color: '#facc15'} : {}}
            >
              TOP 100
            </button>
            <button 
              className={`tf-btn ${sidebarTab === 'SIGNALS' ? 'active' : ''}`} 
              onClick={() => setSidebarTab('SIGNALS')}
              style={sidebarTab === 'SIGNALS' ? {borderColor: '#00ff88', color: '#00ff88'} : {}}
            >
              LIVE SIGNALS 🔥
            </button>
          </div>
          
          <div className="radar-ticker-list">
            {topTokens.length === 0 && radarLoading ? (
              <div className="sidebar-loading" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                <div style={{marginBottom: '10px'}}>{scanMessage || "Premier scan du marché..."}</div>
                <div style={{width: '80%', height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden'}}>
                  <div style={{width: `${scanProgress}%`, height: '100%', background: '#00ff88', transition: 'width 0.3s'}} />
                </div>
              </div>
            ) : topTokens.length === 0 ? (
              <div className="sidebar-loading">Aucun token trouvé.</div>
            ) : (
              <table className="ticker-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    {sidebarTab === 'TOP100' ? (
                      <th>MAGNET (NET FLOW)</th>
                    ) : (
                      <th>MTF SIGNALS</th>
                    )}
                    <th>RS 1M</th>
                    <th>RS 1W</th>
                    <th>RS 24H</th>
                    <th>RS 4H</th>
                    <th>RS 1H</th>
                    <th>RS 15m</th>
                    <th>RS 5m</th>
                  </tr>
                </thead>
                <tbody>
                  {topTokens.map((t, index) => {
                    const isSelected = activeSymbol === t.symbol;
                    return (
                      <tr 
                        key={t.symbol} 
                        className={`ticker-row ${isSelected ? 'active' : ''}`}
                        onClick={() => setActiveSymbol(t.symbol)}
                      >
                        <td className="symbol-cell">
                          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                            <div><span className="rank-number">#{index + 1}</span> {t.symbol}</div>
                            {sidebarTab === 'SIGNALS' && t.signals && t.signals.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {t.signals.map(sig => {
                                  const fresh = signalFreshness(sig.candleTime);
                                  const bgColor = fresh === 'hot' ? 'rgba(255,200,0,0.15)' : fresh === 'warm' ? 'rgba(0,255,136,0.1)' : 'rgba(100,100,100,0.1)';
                                  const borderColor = fresh === 'hot' ? '#facc15' : fresh === 'warm' ? '#00ff88' : '#555';
                                  const textColor = fresh === 'hot' ? '#facc15' : fresh === 'warm' ? '#00ff88' : '#888';
                                  const icon = fresh === 'hot' ? '🔥' : fresh === 'warm' ? '✅' : '⏳';
                                  return (
                                    <div key={sig.tf} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: bgColor, color: textColor, borderRadius: '4px', border: `1px solid ${borderColor}`, fontWeight: 'bold' }}>
                                        {icon} {sig.tf}
                                      </span>
                                      <span style={{ fontSize: '0.6rem', color: textColor, opacity: 0.8 }}>
                                        {formatAge(sig.candleTime)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="score-cell">
                          <span style={{ fontWeight: 800, color: t.netFlow24h >= 0 ? '#00e676' : '#ff3b30', fontSize: '0.85rem' }}>
                            {t.netFlow24h >= 0 ? '+' : '-'}${formatMoney(t.netFlow24h)}
                          </span>
                        </td>
                        <td className="score-cell">
                          <span className={`signal-badge ${t.rsChange1M >= 0 ? 'green' : 'red'}`}>
                            {t.rsChange1M >= 0 ? '+' : ''}{(t.rsChange1M || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="score-cell">
                          <span className={`signal-badge ${t.rsChange1w >= 0 ? 'green' : 'red'}`}>
                            {t.rsChange1w >= 0 ? '+' : ''}{(t.rsChange1w || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="score-cell">
                          <span className={`signal-badge ${t.rsChange24h >= 0 ? 'green' : 'red'}`}>
                            {t.rsChange24h >= 0 ? '+' : ''}{(t.rsChange24h || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="score-cell">
                          <span className={`signal-badge ${t.rsChange4h >= 0 ? 'green' : 'red'}`}>
                            {t.rsChange4h >= 0 ? '+' : ''}{(t.rsChange4h || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="score-cell">
                          <span className={`signal-badge ${t.rsChange1h >= 0 ? 'green' : 'red'}`}>
                            {t.rsChange1h >= 0 ? '+' : ''}{(t.rsChange1h || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="score-cell">
                          <span className={`signal-badge ${t.rsChange15m >= 0 ? 'green' : 'red'}`}>
                            {t.rsChange15m >= 0 ? '+' : ''}{(t.rsChange15m || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="score-cell">
                          <span className={`signal-badge ${t.rsChange5m >= 0 ? 'green' : 'red'}`}>
                            {t.rsChange5m >= 0 ? '+' : ''}{(t.rsChange5m || 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* GRILLE DE CHARTS */}
      {layoutMode === 'GRID' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.5rem' }}>
          {topTokens.slice(0, 50).map(t => {
            const isGreen = t.rsChange24h >= 0;
            return (
              <div 
                key={t.symbol} 
                onClick={() => {
                  setActiveSymbol(t.symbol);
                }}
                className="dash-card"
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
                {/* CARD HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>{t.symbol}</span>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>/BTC Ratio</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>RS 24H:</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: isGreen ? '#00e676' : '#ff3b30' }}>
                        {isGreen ? '+' : ''}{(t.rsChange24h || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>NET FLOW:</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: t.netFlow24h >= 0 ? '#00e676' : '#ff3b30' }}>
                        {t.netFlow24h >= 0 ? '+' : '-'}${formatMoney(t.netFlow24h)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MINI CHART */}
                <BtcMiniChart symbol={t.symbol} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProBtcDashboard;
