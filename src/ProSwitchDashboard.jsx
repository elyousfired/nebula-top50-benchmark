import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { 
  Activity, ShieldAlert, Plus, RefreshCw, BarChart2, TrendingUp, 
  Calculator, History, BellRing, BellPlus, BookOpen, AlertTriangle, 
  ArrowRightLeft, Percent, Wallet, CheckCircle, XCircle, Info
} from 'lucide-react';
import { fetchSolSwitchSnapshot, analyzeSnapshot } from './logic/monadSwitchEngine';
import { fetchSyntheticChartData, calculateEMA, fetchSyntheticCvdChartData } from './logic/monadChartEngine';

const timeframes = ['1m', '15m', '1h', '4H', '1d', '1W'];
const alertTypes = [
  "TOKEN/MONAD broke resistance", 
  "TOKEN/MONAD lost support", 
  "Liquidity inflow detected", 
  "Liquidity leaving", 
  "Fakeout risk rising", 
  "Retest confirmed", 
  "MONAD becoming strong again"
];

const ProSwitchDashboard = () => {
  // Navigation & Symbols State
  const [symbols, setSymbols] = useState(['ASTER', 'SOL', 'HYPE']);
  const [newSymbol, setNewSymbol] = useState('');
  const [activeSymbol, setActiveSymbol] = useState('ASTER');
  const [timeframe, setTimeframe] = useState('1h');
  
  // Market & Analysis Data
  const [analyses, setAnalyses] = useState([]);
  const [radarLoading, setRadarLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Chart References
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const emaSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  
  const cvdChartContainerRef = useRef(null);
  const cvdChartRef = useRef(null);
  const cvdSeriesRef = useRef(null);

  // UI Panels / Tab Dock
  const [activeTab, setActiveTab] = useState('trade'); // 'trade', 'journal', 'alerts', 'backtest'
  
  // Simulated Paper Trading State
  const [walletMon, setWalletMon] = useState(100.0);
  const [positions, setPositions] = useState([]);
  const [simulatorSizePct, setSimulatorSizePct] = useState(25);
  const [customSlippage, setCustomSlippage] = useState(0.35);
  const [customFees, setCustomFees] = useState(0.2);

  // Journal State
  const [journal, setJournal] = useState([
    { 
      token: "ASTER", 
      result: "Win", 
      reason: "ASTER/MONAD breakout 1h confirmed.", 
      notes: "Switched at ratio 0.124500, rotated back to MONAD at 0.130200. Final gain: +0.92 MON (+4.58%)." 
    }
  ]);
  const [manualJournal, setManualJournal] = useState({ token: '', result: 'Win', reason: '', notes: '' });

  // Alerts State
  const [alerts, setAlerts] = useState([
    { token: "HYPE", type: "TOKEN/SOL broke resistance", priority: "High" },
    { token: "ASTER", type: "TOKEN/SOL lost support", priority: "Critical" }
  ]);
  const [newAlertToken, setNewAlertToken] = useState('HYPE');
  const [newAlertType, setNewAlertType] = useState('TOKEN/SOL broke resistance');
  const [newAlertPriority, setNewAlertPriority] = useState('High');

  // Backtest State
  const [backtestData, setBacktestData] = useState([]);
  const [backtestLoading, setBacktestLoading] = useState(true);

  // 1. Fetch Radar Snapshot Data
  const loadRadarData = async (showRefIndicator = false) => {
    if (showRefIndicator) setRefreshing(true);
    try {
      const results = await Promise.all(symbols.map(async (sym) => {
        const snap = await fetchSolSwitchSnapshot(sym);
        return analyzeSnapshot(snap);
      }));
      setAnalyses(results);
      setRadarLoading(false);
    } catch (e) {
      console.error("Failed loading radar snapshots", e);
    } finally {
      setRefreshing(false);
    }
  };

  const runOneWeekBacktests = async () => {
    setBacktestLoading(true);
    try {
      const stats = await Promise.all(symbols.map(async (symbol) => {
        try {
          const fullData = await fetchSyntheticChartData(symbol, '1h');
          if (!fullData || fullData.length === 0) {
            return { symbol, trades: 0, winRate: 0, avgGain: 0, avgLoss: 0, maxDd: 0 };
          }
          // Take the last 168 hours (1 week)
          const data = fullData.slice(-168);
          if (data.length < 30) {
            return { symbol, trades: 0, winRate: 0, avgGain: 0, avgLoss: 0, maxDd: 0 };
          }

          let inPosition = false;
          let entryPrice = 0;
          let trades = [];
          const lookback = 20;

          for (let i = lookback; i < data.length; i++) {
            const windowCandles = data.slice(i - lookback, i);
            const resistance = Math.max(...windowCandles.map(c => c.high));
            const support = Math.min(...windowCandles.map(c => c.low));

            if (!inPosition) {
              if (data[i].close > resistance) {
                inPosition = true;
                entryPrice = data[i].close;
              }
            } else {
              if (data[i].close < support || i === data.length - 1) {
                inPosition = false;
                const exitPrice = data[i].close;
                const pnl = ((exitPrice / entryPrice) - 1) * 100 - 0.55;
                trades.push(pnl);
              }
            }
          }

          const tradesCount = trades.length;
          const wins = trades.filter(p => p > 0);
          const losses = trades.filter(p => p < 0);
          const winRate = tradesCount > 0 ? Math.round((wins.length / tradesCount) * 100) : 0;
          const avgGain = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
          const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

          let peak = 100;
          let balance = 100;
          let maxDd = 0;
          for (const pnl of trades) {
            balance = balance * (1 + pnl / 100);
            if (balance > peak) peak = balance;
            const dd = ((peak - balance) / peak) * 100;
            if (dd > maxDd) maxDd = dd;
          }

          return {
            symbol,
            trades: tradesCount,
            winRate,
            avgGain: Number(avgGain.toFixed(2)),
            avgLoss: Number(avgLoss.toFixed(2)),
            maxDd: Number((-maxDd).toFixed(2))
          };
        } catch (e) {
          console.error(`Backtest failed for ${symbol}`, e);
          return { symbol, trades: 0, winRate: 0, avgGain: 0, avgLoss: 0, maxDd: 0 };
        }
      }));
      setBacktestData(stats);
    } catch (err) {
      console.error("Failed running backtests", err);
    } finally {
      setBacktestLoading(false);
    }
  };

  useEffect(() => {
    loadRadarData();
    const interval = setInterval(() => loadRadarData(false), 15000);
    return () => clearInterval(interval);
  }, [symbols]);

  useEffect(() => {
    runOneWeekBacktests();
  }, [symbols]);

  // Add symbol to list
  const addSymbol = () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym || symbols.includes(sym)) return;
    setSymbols([...symbols, sym]);
    setActiveSymbol(sym);
    setNewSymbol('');
  };

  // Find active symbol's radar analysis
  const activeAnalysis = useMemo(() => {
    return analyses.find(a => a.profile.symbol === activeSymbol);
  }, [analyses, activeSymbol]);

  // Derived Info for Header HUD
  const bestTokenCandidate = useMemo(() => {
    if (!analyses.length) return null;
    const sorted = [...analyses]
      .filter(a => a.snapshot.listed)
      .sort((a, b) => b.recommendation.score - a.recommendation.score);
    return sorted[0];
  }, [analyses]);

  const bestActionClean = bestTokenCandidate?.recommendation.approved && bestTokenCandidate.recommendation.score >= 65;
  const globalSuggestedAction = bestActionClean ? bestTokenCandidate.recommendation.action : "Stay in MONAD";

  // 2. Fetch and Load Candlestick Charts
  const loadChartData = async (showLoading = true) => {
    if (showLoading) {
      setChartLoading(true);
      setChartError(null);
    }
    try {
      const [data, cvdData] = await Promise.all([
        fetchSyntheticChartData(activeSymbol, timeframe),
        fetchSyntheticCvdChartData(activeSymbol, timeframe)
      ]);
      
      if (!data || data.length === 0) {
        if (showLoading) {
          setChartError(`Pas de données de bougies synthétiques pour ${activeSymbol}/MONAD en ${timeframe}.`);
        }
        candleSeriesRef.current?.setData([]);
        emaSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        cvdSeriesRef.current?.setData([]);
        return;
      }

      // Filter outliers
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

      // Populate EMA 20 line
      const ema = calculateEMA(filtered, 20);
      emaSeriesRef.current?.setData(ema);

      // Populate CVD Chart
      if (cvdData && cvdData.length > 0) {
        cvdSeriesRef.current?.setData(cvdData);
      } else {
        cvdSeriesRef.current?.setData([]);
      }

      // Explicitly reset Y-axis auto-scaling to prevent the chart from getting stuck on another token's price range
      chartRef.current?.priceScale('right').applyOptions({
        autoScale: true,
      });
      cvdChartRef.current?.priceScale('right').applyOptions({
        autoScale: true,
      });

      if (showLoading) {
        chartRef.current?.timeScale().fitContent();
        cvdChartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error(err);
      if (showLoading) {
        setChartError("Échec du chargement du graphique synthétique.");
      }
    } finally {
      if (showLoading) {
        setChartLoading(false);
      }
    }
  };

  // Initialize chart once
  useEffect(() => {
    if (!chartContainerRef.current || !cvdChartContainerRef.current) return;

    // Clear any existing children to prevent double chart mounting
    chartContainerRef.current.innerHTML = '';
    cvdChartContainerRef.current.innerHTML = '';

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#050505' },
        textColor: '#888',
        fontFamily: 'Inter, sans-serif'
      },
      grid: {
        vertLines: { color: '#111' },
        horzLines: { color: '#111' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#444', style: 2, labelBackgroundColor: '#111' },
        horzLine: { color: '#444', style: 2, labelBackgroundColor: '#111' }
      },
      timeScale: {
        borderColor: '#1a1a1a',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#1a1a1a',
        autoScale: true,
      }
    };

    const chart = createChart(chartContainerRef.current, {
      ...chartOptions,
      width: chartContainerRef.current.clientWidth,
      height: 350
    });

    const cvdChart = createChart(cvdChartContainerRef.current, {
      ...chartOptions,
      width: cvdChartContainerRef.current.clientWidth,
      height: 150
    });

    chartRef.current = chart;
    cvdChartRef.current = cvdChart;

    // Synthetic Candles Series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff3b30',
      borderVisible: false,
      wickUpColor: '#00ff88',
      wickDownColor: '#ff3b30',
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      }
    });

    // EMA 20 Line Series
    emaSeriesRef.current = chart.addLineSeries({
      color: '#facc15',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      }
    });

    // Volume Overlay Series
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: 'rgba(0, 255, 136, 0.15)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume-scale', // Separate hidden scale
      lastValueVisible: false, // Prevent last volume value label from showing on price Y-axis
    });
    
    chart.priceScale('volume-scale').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false, // Hide the volume axis scale numbers
    });

    // CVD Candles Series
    cvdSeriesRef.current = cvdChart.addCandlestickSeries({
      upColor: '#0ea5e9', // Cyan color for positive flow
      downColor: '#f97316', // Orange color for negative flow
      borderVisible: false,
      wickUpColor: '#0ea5e9',
      wickDownColor: '#f97316',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      }
    });

    // Sync Crosshairs
    chart.subscribeCrosshairMove(param => {
      if (param.time) {
        cvdChart.setCrosshairPosition(param.point?.value, param.time, cvdSeriesRef.current);
      }
    });
    cvdChart.subscribeCrosshairMove(param => {
      if (param.time) {
        chart.setCrosshairPosition(param.point?.value, param.time, candleSeriesRef.current);
      }
    });

    // Sync Timescales
    const timeScale1 = chart.timeScale();
    const timeScale2 = cvdChart.timeScale();
    
    timeScale1.subscribeVisibleTimeRangeChange((logicalRange) => {
      timeScale2.setVisibleLogicalRange(logicalRange);
    });
    timeScale2.subscribeVisibleTimeRangeChange((logicalRange) => {
      timeScale1.setVisibleLogicalRange(logicalRange);
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
      if (cvdChartContainerRef.current && cvdChartRef.current) {
        cvdChartRef.current.applyOptions({ width: cvdChartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      cvdChart.remove();
    };
  }, []);

  // Reload chart on symbol or timeframe swap, and establish live ticker updates
  useEffect(() => {
    if (chartRef.current) {
      loadChartData(true);
    }

    const interval = setInterval(() => {
      if (chartRef.current) {
        loadChartData(false);
      }
    }, 15000); // Silent refresh every 15s to update the last candle

    return () => clearInterval(interval);
  }, [activeSymbol, timeframe]);

  // 3. Live PnL Tracking Calculations for Paper Positions
  const livePositionsStats = useMemo(() => {
    return positions.map(pos => {
      const match = analyses.find(a => a.profile.symbol === pos.token);
      if (!match) {
        return {
          ...pos,
          currentRatio: pos.entryRatio,
          currentMonValue: pos.monAllocated,
          pnlMon: 0,
          pnlPct: 0,
          tokenPriceNow: pos.tokenPriceAtEntry,
          monPriceNow: pos.monPriceAtEntry
        };
      }
      const tokenPriceNow = match.snapshot.price;
      const monPriceNow = match.snapshot.monCandles["1h"]?.at(-1)?.close || pos.monPriceAtEntry;
      const currentRatio = tokenPriceNow / monPriceNow;
      const currentMonValue = pos.monAllocated * (currentRatio / pos.entryRatio);
      
      const totalCostsPct = (pos.feesPct + pos.slippagePct) / 100;
      const pnlMon = currentMonValue * (1 - totalCostsPct) - pos.monAllocated;
      const pnlPct = (pnlMon / pos.monAllocated) * 100;

      return {
        ...pos,
        currentRatio,
        currentMonValue,
        pnlMon,
        pnlPct,
        tokenPriceNow,
        monPriceNow
      };
    });
  }, [positions, analyses]);

  // Total Portfolio Value in MON (Wallet MON + Positions Current MON Values)
  const totalMonBalance = useMemo(() => {
    const posValue = livePositionsStats.reduce((sum, pos) => sum + pos.currentMonValue, 0);
    return walletMon + posValue;
  }, [walletMon, livePositionsStats]);

  // 4. Trading Actions (Swapping & Portfolio management)
  const executeSwitch = () => {
    if (!activeAnalysis) return;
    
    const tokenPrice = activeAnalysis.snapshot.price;
    const monPrice = activeAnalysis.snapshot.monCandles["1h"]?.at(-1)?.close || 0.025;
    const ratio = tokenPrice / monPrice;

    if (tokenPrice <= 0 || monPrice <= 0) {
      alert("Erreur de données de prix Bybit. Impossible d'entrer en position.");
      return;
    }

    const monAllocated = walletMon * (simulatorSizePct / 100);
    if (monAllocated < 0.05) {
      alert("Solde MONAD insuffisant ou montant d'allocation trop bas.");
      return;
    }

    const tokenAmount = monAllocated / ratio;

    const newPos = {
      id: Date.now(),
      token: activeSymbol,
      entryTime: new Date().toLocaleTimeString(),
      monPriceAtEntry: monPrice,
      tokenPriceAtEntry: tokenPrice,
      entryRatio: ratio,
      monAllocated: monAllocated,
      tokenAmount: tokenAmount,
      feesPct: customFees,
      slippagePct: customSlippage
    };

    setWalletMon(curr => curr - monAllocated);
    setPositions(curr => [...curr, newPos]);
  };

  const closePosition = (posId) => {
    const target = livePositionsStats.find(p => p.id === posId);
    if (!target) return;

    // Add back liquidated MON net of costs
    const totalCostsPct = (target.feesPct + target.slippagePct) / 100;
    const exitValMon = target.currentMonValue * (1 - totalCostsPct);
    
    setWalletMon(curr => curr + exitValMon);
    setPositions(curr => curr.filter(p => p.id !== posId));

    // Automated Journal Entry creation
    const autoLog = {
      token: target.token,
      result: target.pnlMon >= 0 ? "Win" : "Loss",
      reason: `Switch simulé à un ratio de ${target.entryRatio.toFixed(6)}`,
      notes: `Retourné en MONAD au ratio ${target.currentRatio.toFixed(6)}. P&L: ${target.pnlMon > 0 ? '+' : ''}${target.pnlMon.toFixed(3)} MON (${target.pnlPct > 0 ? '+' : ''}${target.pnlPct.toFixed(2)}%). Prix d'entrée: Token $${target.tokenPriceAtEntry.toFixed(4)}, MONAD $${target.monPriceAtEntry.toFixed(4)}. Prix de sortie: Token $${target.tokenPriceNow.toFixed(4)}, MONAD $${target.monPriceNow.toFixed(4)}.`
    };
    
    setJournal(curr => [autoLog, ...curr]);
  };

  // Add customized manual journal entry
  const addManualJournal = () => {
    if (!manualJournal.token.trim()) return;
    setJournal(curr => [
      {
        token: manualJournal.token.toUpperCase(),
        result: manualJournal.result,
        reason: manualJournal.reason,
        notes: manualJournal.notes || "Entrée rédigée manuellement."
      },
      ...curr
    ]);
    setManualJournal({ token: '', result: 'Win', reason: '', notes: '' });
  };

  // Add customized alert rule
  const addAlertRule = () => {
    if (!newAlertToken.trim()) return;
    setAlerts(curr => [
      ...curr,
      {
        token: newAlertToken.toUpperCase(),
        type: newAlertType,
        priority: newAlertPriority
      }
    ]);
    setNewAlertToken('');
  };

  // Helper formatting utilities
  const formatPercent = (val) => {
    if (val === null || val === undefined) return "N/A";
    const color = val > 0 ? '#00ff88' : val < 0 ? '#ff3b30' : '#888';
    return <span style={{ color, fontWeight: 'bold' }}>{val > 0 ? '+' : ''}{val.toFixed(2)}%</span>;
  };

  return (
    <div className="pro-dashboard">
      
      {/* 1. TOP DYNAMIC HUD BAR */}
      <div className="pro-hud-grid">
        <div className="hud-card glow-green">
          <div className="hud-label">Meilleure Action Globale</div>
          <div className="hud-val color-green">{radarLoading ? "Scanning..." : globalSuggestedAction}</div>
          <div className="hud-desc">{bestActionClean ? "Validation critique confirmée par le radar." : "Filtres de risque non validés pour le switch."}</div>
        </div>

        <div className="hud-card">
          <div className="hud-label">Meilleur Candidat</div>
          <div className="hud-val">{radarLoading ? "..." : (bestTokenCandidate?.profile.symbol ?? "MONAD")}</div>
          <div className="hud-desc">{radarLoading ? "Recherche en cours" : `Score de Switch : ${bestTokenCandidate?.recommendation.score ?? 0}/100`}</div>
        </div>

        <div className="hud-card">
          <div className="hud-label">Seuil Invalidation ({activeSymbol})</div>
          <div className="hud-val color-orange">
            {activeAnalysis?.breakout.invalidationLevel 
              ? (activeAnalysis.breakout.invalidationLevel / (activeAnalysis.snapshot.monCandles["1h"]?.at(-1)?.close || 0.025)).toFixed(6) 
              : "Calcul..."}
          </div>
          <div className="hud-desc">Ratio TOKEN/MONAD sous lequel couper la rotation.</div>
        </div>

        <div className="hud-card glow-blue">
          <div className="hud-label">MONAD Balance (Simulée)</div>
          <div className="hud-val color-cyan">{totalMonBalance.toFixed(2)} MON</div>
          <div className="hud-desc">Portefeuille Total (Disponible: {walletMon.toFixed(2)} MON)</div>
        </div>
      </div>

      {/* 2. MAIN SPLIT SECTION (CHART & RADAR TABLE) */}
      <div className="workstation-layout">
        
         <div className="chart-panel">
          <div className="panel-header-toolbar">
            <div className="header-meta">
              <span className="pair-title"><ArrowRightLeft size={18} color="#00ff88" /> {activeSymbol}/MONAD</span>
              <span className="live-badge">SPOT BYBIT</span>
            </div>
            
            {/* Timeframe selector toolbar */}
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
            </div>

            <button onClick={() => loadRadarData(true)} disabled={refreshing} className="btn-refresh">
              <RefreshCw size={13} className={refreshing ? "spin" : ""} /> {refreshing ? "Actualisation..." : "Rafraîchir"}
            </button>
          </div>

          <div className="chart-wrapper">
            {chartError && <div className="error-overlay">{chartError}</div>}
            {chartLoading && <div className="loading-overlay">Calcul des chandelles synthétiques...</div>}
            <div ref={chartContainerRef} className="chart-container" />
            
            <div className="cvd-header">
              <span style={{ fontSize: '11px', color: '#888', padding: '4px 8px', display: 'block', borderTop: '1px solid #1a1a1a', marginTop: '4px' }}>
                NET Flow (CVD) - Pression Acheteuse/Vendeuse Nette
              </span>
            </div>
            <div ref={cvdChartContainerRef} className="chart-container" style={{ height: '150px' }} />
          </div>

          <div className="legend-toolbar">
            <div className="legend-items">
              <span className="legend-dot green">Bougies Synthétiques</span>
              <span className="legend-dot yellow">EMA 20</span>
              <span className="legend-dot dim-green">Volume Relatif</span>
            </div>
            <div className="pair-details">
              <span>MONAD: ${(activeAnalysis?.snapshot.monCandles["1h"]?.at(-1)?.close ?? 0.025).toFixed(4)}</span>
              <span style={{ marginLeft: '12px' }}>{activeSymbol}: ${activeAnalysis?.snapshot.price.toFixed(4)}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Radar Tickers and Imbalance Bar */}
        <div className="sidebar-panel">
          <div className="panel-title">
            <h3><Activity size={16} color="#00ff88" /> Tickers de Rotation</h3>
          </div>
          
          <div className="radar-ticker-list">
            {radarLoading ? (
              <div className="sidebar-loading">Récupération des carnets d'ordres...</div>
            ) : (
              <table className="ticker-table">
                <thead>
                  <tr>
                    <th>Paire</th>
                    <th>Score</th>
                    <th>P&L 1h</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {symbols.map(sym => {
                    const match = analyses.find(a => a.profile.symbol === sym);
                    const isSelected = activeSymbol === sym;
                    if (!match) return null;
                    const pnl1h = match.relative.performance["1h"] || 0;
                    return (
                      <tr 
                        key={sym} 
                        className={`ticker-row ${isSelected ? 'active' : ''}`}
                        onClick={() => setActiveSymbol(sym)}
                      >
                        <td className="symbol-cell">{sym}/MONAD</td>
                        <td className="score-cell">{match.recommendation.score}</td>
                        <td>{formatPercent(pnl1h)}</td>
                        <td className="action-cell">
                          <span className={`signal-badge ${match.recommendation.approved ? 'green' : 'gray'}`}>
                            {match.recommendation.approved ? 'APPROB' : 'MONAD'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Dynamic Order Book Imbalance Gauge */}
          <div className="imbalance-gauge-card">
            <div className="gauge-header">
              <span>Pression du Carnet (Bybit)</span>
              <span className="color-green">
                {activeAnalysis ? (activeAnalysis.liquidity.spreadPct ? `Spread: ${activeAnalysis.liquidity.spreadPct.toFixed(2)}%` : "0.05%") : "Calcul..."}
              </span>
            </div>
            
            {/* Horizontal balance bar */}
            <div className="gauge-bar-wrapper">
              <div className="gauge-side buy-side" style={{ width: activeAnalysis ? `${activeAnalysis.liquidity.score}%` : '50%' }}>
                <span>{activeAnalysis ? activeAnalysis.liquidity.score : 50}%</span>
              </div>
              <div className="gauge-side sell-side" style={{ width: activeAnalysis ? `${100 - activeAnalysis.liquidity.score}%` : '50%' }}>
                <span>{activeAnalysis ? 100 - activeAnalysis.liquidity.score : 50}%</span>
              </div>
            </div>
            <div className="gauge-labels">
              <span>Bids (MONAD)</span>
              <span>Asks (Token)</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. RULES CHECKLIST HUD PANEL */}
      <div className="checklist-hud-panel">
        <div className="checklist-section">
          <h4>Vérification Pré-Rotation ({activeSymbol})</h4>
          <div className="rules-grid">
            {activeAnalysis?.recommendation.checklist ? (
              activeAnalysis.recommendation.checklist.map((item, idx) => (
                <div key={idx} className="rule-item">
                  {item.passed ? (
                    <CheckCircle size={14} color="#00ff88" className="rule-icon" />
                  ) : (
                    <XCircle size={14} color="#ff3b30" className="rule-icon" />
                  )}
                  <span className={`rule-text ${item.passed ? 'passed' : 'failed'}`}>{item.label}</span>
                </div>
              ))
            ) : (
              <div className="sidebar-loading">Sélectionnez un token pour charger les règles.</div>
            )}
          </div>
        </div>

        <div className="narrative-section">
          <h4>Analyse Technique Relative</h4>
          {activeAnalysis ? (
            <div className="analysis-summary-box">
              <div className="summary-row">
                <span className="summary-label">Statut Breakout :</span>
                <span className={`badge-text ${activeAnalysis.breakout.status.includes('Confirmed') ? 'bullish' : 'bearish'}`}>
                  {activeAnalysis.breakout.status}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Force Cassure :</span>
                <span>{activeAnalysis.breakout.strength}/100</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Rapport Risk/Reward :</span>
                <span>{activeAnalysis.risk.rewardRiskRatio?.toFixed(2) || "2.10"}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Coûts de Swap estimé :</span>
                <span>{(activeAnalysis.risk.feesAndSlippagePct || 0.55).toFixed(2)}%</span>
              </div>
              <div className="narrative-description-text">
                <strong>Synthèse :</strong> {activeAnalysis.recommendation.mainReason}
              </div>
            </div>
          ) : (
            <div className="sidebar-loading">Chargement des indicateurs en cours...</div>
          )}
        </div>
      </div>

      {/* 4. UTILITY DOCK TABS PANEL */}
      <div className="utility-dock-panel">
        <div className="dock-tabs">
          <button 
            className={`dock-tab-btn ${activeTab === 'trade' ? 'active' : ''}`}
            onClick={() => setActiveTab('trade')}
          >
            <Calculator size={14} /> Trade & Positions ({positions.length})
          </button>
          <button 
            className={`dock-tab-btn ${activeTab === 'journal' ? 'active' : ''}`}
            onClick={() => setActiveTab('journal')}
          >
            <BookOpen size={14} /> Journal ({journal.length})
          </button>
          <button 
            className={`dock-tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <BellRing size={14} /> Configuration Alertes ({alerts.length})
          </button>
          <button 
            className={`dock-tab-btn ${activeTab === 'backtest' ? 'active' : ''}`}
            onClick={() => setActiveTab('backtest')}
          >
            <History size={14} /> Backtest Historique
          </button>
        </div>

        <div className="dock-content">
          
          {/* TAB 1: SIMULATED TRADE & OPEN POSITIONS VIEW */}
          {activeTab === 'trade' && (
            <div className="trade-dock-grid">
              
              {/* Simulator Execution Form */}
              <div className="swap-execution-card">
                <h5>Lancer un Switch de Rotation</h5>
                
                <div className="input-group-row">
                  <div className="input-field">
                    <label>Taille du Switch (% du solde MONAD)</label>
                    <div className="slider-wrapper">
                      <input 
                        type="range" 
                        min="5" 
                        max="100" 
                        step="5"
                        value={simulatorSizePct} 
                        onChange={(e) => setSimulatorSizePct(Number(e.target.value))}
                      />
                      <span>{simulatorSizePct}% ({ (walletMon * (simulatorSizePct / 100)).toFixed(2) } MON)</span>
                    </div>
                  </div>
                </div>

                <div className="input-group-row-triple">
                  <div className="input-field">
                    <label>Frais simulés %</label>
                    <input 
                      type="number" 
                      value={customFees} 
                      step="0.05"
                      onChange={(e) => setCustomFees(Number(e.target.value))}
                    />
                  </div>
                  <div className="input-field">
                    <label>Glissement (Slippage) %</label>
                    <input 
                      type="number" 
                      value={customSlippage} 
                      step="0.05"
                      onChange={(e) => setCustomSlippage(Number(e.target.value))}
                    />
                  </div>
                </div>

                <button 
                  className="btn-execute-swap"
                  onClick={executeSwitch}
                  disabled={!activeAnalysis}
                >
                  Allouer vers {activeSymbol}
                </button>
              </div>

              {/* Live Positions Manager */}
              <div className="positions-manager-card">
                <h5>Positions Synthétiques Actives</h5>
                
                {livePositionsStats.length === 0 ? (
                  <div className="empty-positions-message">
                    Aucune position ouverte. Utilisez le panneau de gauche pour allouer des MONAD sur {activeSymbol}.
                  </div>
                ) : (
                  <div className="positions-table-wrapper">
                    <table className="positions-table">
                      <thead>
                        <tr>
                          <th>Jeton</th>
                          <th>Allocation MONAD</th>
                          <th>Montant Reçu</th>
                          <th>Ratio Entrée</th>
                          <th>Ratio Actuel</th>
                          <th>Live P&L (MON)</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {livePositionsStats.map(pos => {
                          const pnlColor = pos.pnlMon >= 0 ? '#00ff88' : '#ff3b30';
                          return (
                            <tr key={pos.id}>
                              <td style={{ fontWeight: 'bold' }}>{pos.token}</td>
                              <td>{pos.monAllocated.toFixed(2)} MON</td>
                              <td>{pos.tokenAmount.toFixed(2)} {pos.token}</td>
                              <td>{pos.entryRatio.toFixed(6)}</td>
                              <td>{pos.currentRatio.toFixed(6)}</td>
                              <td style={{ color: pnlColor, fontWeight: 'bold' }}>
                                {pos.pnlMon > 0 ? '+' : ''}{pos.pnlMon.toFixed(3)} ({pos.pnlPct > 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%)
                              </td>
                              <td>
                                <button 
                                  className="btn-exit-position"
                                  onClick={() => closePosition(pos.id)}
                                >
                                  Clôturer (MONAD)
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: TRADING JOURNAL */}
          {activeTab === 'journal' && (
            <div className="journal-dock-grid">
              
              {/* Add Custom Entry Form */}
              <div className="journal-form-card">
                <h5>Ajouter une Note Journalière</h5>
                <div className="journal-form-fields">
                  <div className="form-row">
                    <input 
                      type="text" 
                      placeholder="Jeton (ex: HYPE)" 
                      value={manualJournal.token}
                      onChange={(e) => setManualJournal({...manualJournal, token: e.target.value})}
                    />
                    <select 
                      value={manualJournal.result}
                      onChange={(e) => setManualJournal({...manualJournal, result: e.target.value})}
                    >
                      <option>Win</option>
                      <option>Loss</option>
                      <option>Breakeven</option>
                    </select>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Raison du trade relative à MONAD..." 
                    value={manualJournal.reason}
                    onChange={(e) => setManualJournal({...manualJournal, reason: e.target.value})}
                  />
                  <textarea 
                    placeholder="Erreurs commises ou observations..." 
                    value={manualJournal.notes}
                    onChange={(e) => setManualJournal({...manualJournal, notes: e.target.value})}
                  />
                  <button className="btn-add-journal" onClick={addManualJournal}>
                    Enregistrer Note
                  </button>
                </div>
              </div>

              {/* Journal Logs Lists */}
              <div className="journal-list-card">
                <h5>Historique des Allocations Récentes</h5>
                <div className="journal-scroll-box">
                  {journal.length === 0 ? (
                    <div className="empty-positions-message">Le journal est vide.</div>
                  ) : (
                    journal.map((entry, idx) => (
                      <div key={idx} className="journal-card-item">
                        <div className="j-header">
                          <span className="j-tok">{entry.token}/MONAD</span>
                          <span className={`j-badge ${entry.result.toLowerCase()}`}>{entry.result}</span>
                        </div>
                        <div className="j-body">
                          <div><strong>Raison :</strong> {entry.reason}</div>
                          <div style={{ marginTop: '4px', color: '#888' }}><strong>Notes :</strong> {entry.notes}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: ALERTS RULES MANAGER */}
          {activeTab === 'alerts' && (
            <div className="alerts-dock-grid">
              
              {/* Configure Alerts Rules */}
              <div className="alerts-form-card">
                <h5>Créer une Condition de Notification</h5>
                <div className="alert-fields">
                  <div className="input-field">
                    <label>Jeton Cible</label>
                    <select 
                      value={newAlertToken}
                      onChange={(e) => setNewAlertToken(e.target.value)}
                    >
                      {symbols.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="input-field">
                    <label>Condition de Signal</label>
                    <select 
                      value={newAlertType}
                      onChange={(e) => setNewAlertType(e.target.value)}
                    >
                      {alertTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="input-field">
                    <label>Priorité</label>
                    <select 
                      value={newAlertPriority}
                      onChange={(e) => setNewAlertPriority(e.target.value)}
                    >
                      {["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <button className="btn-add-alert" onClick={addAlertRule}>
                    <BellPlus size={14} /> Activer Alerte
                  </button>
                </div>
              </div>

              {/* Active Rules Grid */}
              <div className="alerts-list-card">
                <h5>Règles Actives sur le Moteur</h5>
                <div className="alerts-scroll-box">
                  {alerts.map((al, idx) => (
                    <div key={idx} className="alert-card-item">
                      <div>
                        <strong>{al.token}</strong> - <span style={{ color: '#aaa' }}>{al.type}</span>
                      </div>
                      <span className={`priority-badge-label ${al.priority.toLowerCase()}`}>
                        {al.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: STRATEGY BACKTEST RESULTS */}
          {activeTab === 'backtest' && (
            <div className="backtest-dock-panel">
              <div className="backtest-summary-header">
                <div>
                  <h5 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Analyse de Backtest Réel Bybit (7 derniers jours)
                    <button 
                      onClick={runOneWeekBacktests} 
                      disabled={backtestLoading}
                      className="btn-refresh"
                      style={{ padding: '2px 8px', fontSize: '0.65rem', marginLeft: '12px' }}
                    >
                      <RefreshCw size={10} className={backtestLoading ? "spin" : ""} /> Rafraîchir
                    </button>
                  </h5>
                  <p className="b-desc">Application en temps réel de la stratégie de cassure (Lookback 20h) et d'invalidation sur les bougies 1h.</p>
                </div>
                {!backtestLoading && backtestData.length > 0 && (
                  <div className="best-performers-badges">
                    <span>Meilleur Jeton : <strong>
                      {(() => {
                        const sorted = [...backtestData].sort((a,b) => b.winRate - a.winRate);
                        return sorted[0]?.trades > 0 ? `${sorted[0].symbol} (${sorted[0].winRate}% Win)` : "N/A";
                      })()}
                    </strong></span>
                    <span>Plus bas Drawdown : <strong>
                      {(() => {
                        const sorted = [...backtestData].sort((a,b) => b.maxDd - a.maxDd); // Closer to 0 is higher
                        return sorted[0]?.trades > 0 ? `${sorted[0].symbol} (${sorted[0].maxDd}%)` : "N/A";
                      })()}
                    </strong></span>
                  </div>
                )}
              </div>

              {backtestLoading ? (
                <div className="sidebar-loading" style={{ padding: '40px' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '12px', color: '#00ff88' }} />
                  <div>Calcul en cours des performances historiques réelles sur 7 jours depuis l'API Bybit...</div>
                </div>
              ) : (
                <div className="backtest-table-wrapper">
                  <table className="backtest-table">
                    <thead>
                      <tr>
                        <th>Jeton</th>
                        <th>Trades Détectés</th>
                        <th>Taux de Win %</th>
                        <th>Gain Moyen (MONAD)</th>
                        <th>Perte Moyenne (MONAD)</th>
                        <th>Max Drawdown</th>
                        <th>Timeframe / Stratégie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtestData.map(row => (
                        <tr key={row.symbol}>
                          <td style={{ fontWeight: 'bold' }}>{row.symbol}/MONAD</td>
                          <td>{row.trades}</td>
                          <td>{row.trades > 0 ? `${row.winRate}%` : 'N/A'}</td>
                          <td className="color-green">
                            {row.trades > 0 && row.avgGain > 0 ? `+${row.avgGain.toFixed(2)}%` : '0.00%'}
                          </td>
                          <td className="color-red">
                            {row.trades > 0 && row.avgLoss < 0 ? `${row.avgLoss.toFixed(2)}%` : '0.00%'}
                          </td>
                          <td style={{ color: row.maxDd < 0 ? '#ff3b30' : '#888' }}>
                            {row.trades > 0 ? `${row.maxDd.toFixed(2)}%` : '0.00%'}
                          </td>
                          <td style={{ color: '#00d2ff' }}>1h (Lookback 20h)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* 5. NATIVE CSS STYLING SHEET */}
      <style dangerouslySetInnerHTML={{__html: `
        .pro-dashboard {
          padding: 24px;
          color: #eee;
          font-family: 'Inter', sans-serif;
          background: #050505;
          min-height: 100vh;
        }

        /* HUD CSS */
        .pro-hud-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .hud-card {
          background: #0a0a0a;
          border: 1px solid #1a1a1a;
          padding: 16px;
          border-radius: 12px;
          transition: all 0.3s;
        }
        .hud-card:hover {
          border-color: #333;
        }
        .hud-card.glow-green {
          border-color: rgba(0, 255, 136, 0.2);
          box-shadow: 0 0 10px rgba(0, 255, 136, 0.05);
        }
        .hud-card.glow-blue {
          border-color: rgba(0, 210, 255, 0.2);
          box-shadow: 0 0 10px rgba(0, 210, 255, 0.05);
        }
        .hud-label {
          font-size: 0.75rem;
          color: #666;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .hud-val {
          font-size: 1.5rem;
          font-weight: 900;
          margin-bottom: 6px;
        }
        .hud-desc {
          font-size: 0.72rem;
          color: #555;
          line-height: 1.3;
        }
        .color-green { color: #00ff88; }
        .color-orange { color: #facc15; }
        .color-cyan { color: #00d2ff; }

        /* WORKSTATION LAYOUT CSS */
        .workstation-layout {
          display: grid;
          grid-template-columns: 8fr 4fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media(max-width: 1024px) {
          .workstation-layout {
            grid-template-columns: 1fr;
          }
        }
        .chart-panel {
          background: #0a0a0a;
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }
        .panel-header-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .header-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pair-title {
          font-size: 1.2rem;
          font-weight: 900;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .live-badge {
          font-size: 0.6rem;
          font-weight: 800;
          color: #00ff88;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .timeframe-toolbar {
          display: flex;
          gap: 4px;
          background: #111;
          padding: 4px;
          border-radius: 6px;
          border: 1px solid #222;
        }
        .tf-btn {
          background: transparent;
          border: none;
          color: #777;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tf-btn:hover {
          color: #fff;
        }
        .tf-btn.active {
          color: #00ff88;
          background: rgba(0, 255, 136, 0.1);
        }
        .btn-refresh {
          background: #111;
          border: 1px solid #222;
          color: #aaa;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .btn-refresh:hover {
          background: #222;
          color: #fff;
        }
        .chart-wrapper {
          position: relative;
          min-height: 400px;
          border: 1px solid #111;
          border-radius: 8px;
          background: #050505;
          overflow: hidden;
        }
        .chart-container {
          width: 100%;
          height: 400px;
        }
        .error-overlay, .loading-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          z-index: 10;
        }
        .error-overlay {
          background: rgba(5,5,5,0.9);
          color: #ff3b30;
        }
        .loading-overlay {
          background: rgba(5,5,5,0.85);
          color: #00ff88;
        }
        .legend-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          font-size: 0.75rem;
          color: #666;
        }
        .legend-items {
          display: flex;
          gap: 16px;
        }
        .legend-dot {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .legend-dot::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .legend-dot.green::before { background: #00ff88; }
        .legend-dot.yellow::before { background: #facc15; }
        .legend-dot.dim-green::before { background: rgba(0, 255, 136, 0.25); }

        /* SIDEBAR RADAR CSS */
        .sidebar-panel {
          background: #0a0a0a;
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }
        .panel-title h3 {
          margin: 0 0 16px 0;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .radar-ticker-list {
          flex-grow: 1;
          overflow-y: auto;
          max-height: 250px;
          border: 1px solid #1a1a1a;
          border-radius: 8px;
          background: #050505;
          margin-bottom: 16px;
        }
        .sidebar-loading {
          padding: 24px;
          text-align: center;
          color: #666;
          font-size: 0.8rem;
        }
        .ticker-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .ticker-table th {
          padding: 8px 12px;
          font-size: 0.7rem;
          text-transform: uppercase;
          color: #555;
          border-bottom: 1px solid #1a1a1a;
          background: #080808;
        }
        .ticker-table td {
          padding: 10px 12px;
          font-size: 0.8rem;
          border-bottom: 1px solid #111;
        }
        .ticker-row {
          cursor: pointer;
          transition: all 0.2s;
        }
        .ticker-row:hover td {
          background: rgba(255, 255, 255, 0.02);
        }
        .ticker-row.active td {
          background: rgba(0, 255, 136, 0.05);
        }
        .ticker-row.active .symbol-cell {
          color: #00ff88;
          font-weight: bold;
        }
        .score-cell {
          font-weight: 800;
          color: #00ff88;
        }
        .signal-badge {
          font-size: 0.6rem;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .signal-badge.green {
          background: rgba(0,255,136,0.1);
          color: #00ff88;
          border: 1px solid rgba(0,255,136,0.2);
        }
        .signal-badge.gray {
          background: rgba(255,255,255,0.04);
          color: #888;
          border: 1px solid rgba(255,255,255,0.06);
        }

        /* IMBALANCE GAUGE */
        .imbalance-gauge-card {
          background: #111;
          border: 1px solid #222;
          padding: 12px;
          border-radius: 8px;
        }
        .gauge-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          margin-bottom: 8px;
          font-weight: bold;
        }
        .gauge-bar-wrapper {
          display: flex;
          height: 16px;
          border-radius: 8px;
          overflow: hidden;
          background: #222;
        }
        .gauge-side {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 900;
          color: #000;
          transition: width 0.5s ease-in-out;
        }
        .gauge-side.buy-side {
          background: #00ff88;
        }
        .gauge-side.sell-side {
          background: #ff3b30;
        }
        .gauge-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.65rem;
          color: #555;
          margin-top: 6px;
        }

        /* CHECKLIST HUD CSS */
        .checklist-hud-panel {
          display: grid;
          grid-template-columns: 7fr 5fr;
          gap: 20px;
          background: #0a0a0a;
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }
        @media(max-width: 800px) {
          .checklist-hud-panel {
            grid-template-columns: 1fr;
          }
        }
        .checklist-hud-panel h4 {
          margin: 0 0 12px 0;
          font-size: 0.85rem;
          text-transform: uppercase;
          color: #fff;
          border-bottom: 1px solid #1a1a1a;
          padding-bottom: 8px;
        }
        .rules-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
        }
        .rule-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rule-text {
          font-size: 0.78rem;
        }
        .rule-text.passed {
          color: #bbb;
        }
        .rule-text.failed {
          color: #666;
          text-decoration: line-through;
        }
        .analysis-summary-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.8rem;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding-bottom: 4px;
          border-bottom: 1px dashed #151515;
        }
        .summary-label {
          color: #666;
        }
        .badge-text.bullish { color: #00ff88; font-weight: bold; }
        .badge-text.bearish { color: #ff3b30; font-weight: bold; }
        .narrative-description-text {
          margin-top: 6px;
          font-size: 0.75rem;
          color: #aaa;
          line-height: 1.4;
        }

        /* UTILITY DOCK TABS CSS */
        .utility-dock-panel {
          background: #0a0a0a;
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          overflow: hidden;
        }
        .dock-tabs {
          display: flex;
          background: #080808;
          border-bottom: 1px solid #111;
          overflow-x: auto;
        }
        .dock-tab-btn {
          background: transparent;
          border: none;
          border-right: 1px solid #111;
          color: #666;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 12px 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .dock-tab-btn:hover {
          color: #eee;
          background: rgba(255,255,255,0.01);
        }
        .dock-tab-btn.active {
          color: #00ff88;
          background: #0a0a0a;
          box-shadow: inset 0 2px 0 #00ff88;
        }
        .dock-content {
          padding: 20px;
          min-height: 200px;
        }

        /* TAB 1: SWAP SIMULATOR */
        .trade-dock-grid {
          display: grid;
          grid-template-columns: 4fr 8fr;
          gap: 20px;
        }
        @media(max-width: 900px) {
          .trade-dock-grid {
            grid-template-columns: 1fr;
          }
        }
        .swap-execution-card, .positions-manager-card, .journal-form-card, .journal-list-card, .alerts-form-card, .alerts-list-card {
          background: rgba(255,255,255,0.01);
          border: 1px solid #1a1a1a;
          border-radius: 8px;
          padding: 16px;
        }
        .swap-execution-card h5, .positions-manager-card h5, .journal-form-card h5, .journal-list-card h5, .alerts-form-card h5, .alerts-list-card h5 {
          margin: 0 0 16px 0;
          font-size: 0.85rem;
          text-transform: uppercase;
          color: #fff;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          padding-bottom: 8px;
        }
        .input-group-row {
          margin-bottom: 12px;
        }
        .input-group-row-triple {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        .input-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .input-field label {
          font-size: 0.7rem;
          color: #777;
          text-transform: uppercase;
        }
        .slider-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .slider-wrapper input[type="range"] {
          flex-grow: 1;
          accent-color: #00ff88;
        }
        .slider-wrapper span {
          font-size: 0.8rem;
          font-weight: bold;
          color: #00ff88;
          min-width: 100px;
          text-align: right;
        }
        .input-field input, .input-field select {
          background: #050505;
          border: 1px solid #222;
          color: #fff;
          padding: 8px 12px;
          border-radius: 6px;
          outline: none;
        }
        .input-field input:focus, .input-field select:focus {
          border-color: #00ff88;
        }
        .btn-execute-swap {
          width: 100%;
          background: rgba(0, 255, 136, 0.1);
          color: #00ff88;
          border: 1px solid rgba(0, 255, 136, 0.3);
          padding: 10px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-execute-swap:hover {
          background: rgba(0, 255, 136, 0.2);
        }
        .btn-execute-swap:disabled {
          background: rgba(255,255,255,0.02);
          border-color: #111;
          color: #444;
          cursor: not-allowed;
        }
        .empty-positions-message {
          padding: 32px;
          text-align: center;
          color: #555;
          font-size: 0.8rem;
        }
        .positions-table-wrapper {
          overflow-x: auto;
        }
        .positions-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .positions-table th {
          padding: 8px;
          font-size: 0.7rem;
          text-transform: uppercase;
          color: #555;
          border-bottom: 1px solid #1a1a1a;
        }
        .positions-table td {
          padding: 10px 8px;
          font-size: 0.78rem;
          border-bottom: 1px solid #151515;
        }
        .btn-exit-position {
          background: rgba(255, 59, 48, 0.1);
          color: #ff3b30;
          border: 1px solid rgba(255, 59, 48, 0.2);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-exit-position:hover {
          background: rgba(255, 59, 48, 0.2);
        }

        /* TAB 2: JOURNAL */
        .journal-dock-grid {
          display: grid;
          grid-template-columns: 5fr 7fr;
          gap: 20px;
        }
        @media(max-width: 900px) {
          .journal-dock-grid {
            grid-template-columns: 1fr;
          }
        }
        .journal-form-fields {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .journal-form-fields .form-row {
          display: grid;
          grid-template-columns: 7fr 3fr;
          gap: 10px;
        }
        .journal-form-fields input, .journal-form-fields select, .journal-form-fields textarea {
          background: #050505;
          border: 1px solid #222;
          color: #fff;
          padding: 8px 12px;
          border-radius: 6px;
          outline: none;
          font-family: inherit;
        }
        .journal-form-fields textarea {
          min-height: 60px;
          resize: vertical;
        }
        .journal-form-fields input:focus, .journal-form-fields select:focus, .journal-form-fields textarea:focus {
          border-color: #00d2ff;
        }
        .btn-add-journal {
          background: rgba(0, 210, 255, 0.1);
          color: #00d2ff;
          border: 1px solid rgba(0, 210, 255, 0.3);
          padding: 10px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-add-journal:hover {
          background: rgba(0, 210, 255, 0.2);
        }
        .journal-scroll-box {
          max-height: 220px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .journal-card-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid #151515;
          border-radius: 6px;
          padding: 12px;
        }
        .j-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .j-tok {
          font-weight: 800;
          color: #fff;
          font-size: 0.85rem;
        }
        .j-badge {
          font-size: 0.65rem;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .j-badge.win { background: rgba(0, 255, 136, 0.15); color: #00ff88; }
        .j-badge.loss { background: rgba(255, 59, 48, 0.15); color: #ff3b30; }
        .j-badge.breakeven { background: rgba(255, 255, 255, 0.1); color: #aaa; }
        .j-body {
          font-size: 0.76rem;
          line-height: 1.4;
          color: #bbb;
        }

        /* TAB 3: ALERTS */
        .alerts-dock-grid {
          display: grid;
          grid-template-columns: 5fr 7fr;
          gap: 20px;
        }
        @media(max-width: 900px) {
          .alerts-dock-grid {
            grid-template-columns: 1fr;
          }
        }
        .alert-fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .btn-add-alert {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 10px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .btn-add-alert:hover {
          background: rgba(245, 158, 11, 0.2);
        }
        .alerts-scroll-box {
          max-height: 220px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .alert-card-item {
          background: rgba(255,255,255,0.02);
          border: 1px solid #151515;
          padding: 10px 12px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
        }
        .priority-badge-label {
          font-size: 0.65rem;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .priority-badge-label.critical { background: rgba(255, 59, 48, 0.2); color: #ff3b30; }
        .priority-badge-label.high { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .priority-badge-label.medium { background: rgba(0, 255, 136, 0.2); color: #00ff88; }
        .priority-badge-label.low { background: rgba(255, 255, 255, 0.1); color: #888; }

        /* TAB 4: BACKTEST */
        .backtest-summary-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          padding-bottom: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .backtest-summary-header h5 {
          margin: 0 0 4px 0;
          font-size: 0.9rem;
          color: #fff;
        }
        .b-desc {
          font-size: 0.75rem;
          color: #666;
          margin: 0;
        }
        .best-performers-badges {
          display: flex;
          gap: 12px;
          font-size: 0.75rem;
        }
        .best-performers-badges span {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid #222;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .backtest-table-wrapper {
          overflow-x: auto;
        }
        .backtest-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .backtest-table th {
          padding: 8px 12px;
          font-size: 0.7rem;
          text-transform: uppercase;
          color: #555;
          border-bottom: 1px solid #1a1a1a;
          background: #080808;
        }
        .backtest-table td {
          padding: 12px;
          font-size: 0.78rem;
          border-bottom: 1px solid #151515;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />

    </div>
  );
};

export default ProSwitchDashboard;
