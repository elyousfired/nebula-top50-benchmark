import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { 
  RotateCw, Zap, Sparkles, TrendingUp, TrendingDown, Target, Award, Trophy, 
  Compass, ShieldAlert, Activity, ArrowRight, ShieldCheck, Clock, Calendar, 
  Layers, RefreshCw, BarChart2, CheckCircle2, ChevronRight, AlertCircle, Play,
  MousePointerClick
} from 'lucide-react';

const PHASE_COLORS = {
  compression: '#38bdf8', // 🔵 Bleu : Phase 1 Compression
  ignition: '#00ff88',    // 🟢 Vert : Phase 2 Ignition (Point d'entrée)
  climax: '#facc15',      // 🟡 Jaune : Phase 3 Sommet / Climax
  exhaustion: '#f43f5e'   // 🔴 Rouge : Phase 4 Sortie de liquidité
};

const DISTINCT_COLORS = ['#00ff88', '#facc15', '#38bdf8', '#f43f5e', '#a855f7', '#fb923c', '#e879f9', '#22d3ee', '#a3e635'];

export default function MarketRotationCycleWheel({ tokensList = [], onSelectToken }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef({});

  // Horizon d'analyse : '24h' | '7d'
  const [timeframe, setTimeframe] = useState('24h');

  // Mode d'affichage du graphique : 'ignition' | 'climax' | 'compression' | 'custom'
  const [chartMode, setChartMode] = useState('ignition');

  // Liste des symboles personnalisés sélectionnés par clic
  const [selectedSymbols, setSelectedSymbols] = useState([]);

  // 1. MOTEUR DE DÉTECTION DES 4 PHASES DE CYCLE POUR CHAQUE TOKEN
  const cycleAnalysis = useMemo(() => {
    if (!tokensList || tokensList.length === 0) return null;

    const maxCandles = timeframe === '24h' ? 96 : 672;
    const validTokens = tokensList.filter(t => (t.ratioSeries && t.ratioSeries.length >= 12) || (t.rawUsdtSeries && t.rawUsdtSeries.length >= 12));
    if (validTokens.length === 0) return null;

    const analyzed = validTokens.slice(0, 40).map((t, idx) => {
      // Filtrer les symboles actions synthétiques
      const isStockSynthetic = t.cleanSymbol.endsWith('X') && ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'GOOGL', 'META'].some(s => t.cleanSymbol.startsWith(s));
      if (isStockSynthetic) return null;

      const raw = t.ratioSeries || t.rawUsdtSeries || [];
      const sliced = raw.slice(Math.max(0, raw.length - maxCandles));
      const len = sliced.length;
      if (len < 8) return null;

      const startClose = typeof sliced[0] === 'object' ? sliced[0].close : sliced[0];
      const curClose = typeof sliced[len - 1] === 'object' ? sliced[len - 1].close : sliced[len - 1];
      const p1hClose = typeof sliced[len - 5] === 'object' ? sliced[len - 5].close : sliced[len - 5];
      const p2hClose = typeof sliced[len - 9] === 'object' ? sliced[len - 9].close : sliced[len - 9];

      const totalPerfPct = startClose > 0 ? ((curClose - startClose) / startClose) * 100 : 0;
      const speedCur = p1hClose > 0 ? ((curClose - p1hClose) / p1hClose) * 100 : 0;
      const speedPrev = p2hClose > 0 ? ((p1hClose - p2hClose) / p2hClose) * 100 : 0;
      const accPct = parseFloat((speedCur - speedPrev).toFixed(2));

      const recentCloses = sliced.slice(len - 16).map(c => typeof c === 'object' ? c.close : c);
      const minRecent = Math.min(...recentCloses);
      const maxRecent = Math.max(...recentCloses);
      const rangePct = minRecent > 0 ? ((maxRecent - minRecent) / minRecent) * 100 : 0;

      let phase = 'compression';
      let phaseDetails = {
        name: '🔵 PHASE 1 : COMPRESSION',
        badge: 'TENSION D\'ACCUMULATION',
        color: PHASE_COLORS.compression,
        desc: 'Volatilité serrée, volume en accumulation silencieuse.',
        action: 'Surveiller'
      };

      if (accPct < -1.0 && (totalPerfPct > 5 || speedPrev > 3)) {
        phase = 'exhaustion';
        phaseDetails = {
          name: '🔴 PHASE 4 : SORTIE LIQUIDITÉ',
          badge: 'FIN DE CYCLE / ROTATION OUT',
          color: PHASE_COLORS.exhaustion,
          desc: 'Décélération active : la liquidité quitte ce token.',
          action: 'Prendre profits'
        };
      } else if (totalPerfPct >= 10 && accPct >= -1.0 && accPct <= 2.0) {
        phase = 'climax';
        phaseDetails = {
          name: '🟡 PHASE 3 : SOMMET DU CYCLE',
          badge: 'CLIMAX & DOMINANCE',
          color: PHASE_COLORS.climax,
          desc: 'En pleine phase de domination maximale.',
          action: 'Sécuriser gains'
        };
      } else if (accPct > 1.5 && (speedCur > 1.0 || totalPerfPct > 1)) {
        phase = 'ignition';
        phaseDetails = {
          name: '🟢 PHASE 2 : DÉCLENCHEMENT',
          badge: '🚀 IGNITION BUY (ACHAT)',
          color: PHASE_COLORS.ignition,
          desc: 'Accélération positive explosive ! Début de la vague !',
          action: '🎯 ENTRÉE STRATÉGIQUE'
        };
      }

      return {
        symbol: t.cleanSymbol,
        price: curClose,
        totalPerfPct: parseFloat(totalPerfPct.toFixed(2)),
        accPct,
        rangePct: parseFloat(rangePct.toFixed(2)),
        speedCur: parseFloat(speedCur.toFixed(2)),
        phase,
        phaseDetails,
        candles: sliced
      };
    }).filter(Boolean);

    const grouped = {
      ignition: analyzed.filter(t => t.phase === 'ignition'),
      climax: analyzed.filter(t => t.phase === 'climax'),
      exhaustion: analyzed.filter(t => t.phase === 'exhaustion'),
      compression: analyzed.filter(t => t.phase === 'compression')
    };

    grouped.ignition.sort((a, b) => b.accPct - a.accPct);
    grouped.climax.sort((a, b) => b.totalPerfPct - a.totalPerfPct);
    grouped.compression.sort((a, b) => a.rangePct - b.rangePct);

    // Déterminer les tokens à tracer sur le graphique selon le mode actif
    let activeChartTokens = [];
    if (chartMode === 'ignition') {
      activeChartTokens = grouped.ignition.slice(0, 6);
    } else if (chartMode === 'climax') {
      activeChartTokens = [...grouped.climax.slice(0, 3), ...grouped.exhaustion.slice(0, 3)];
    } else if (chartMode === 'compression') {
      activeChartTokens = grouped.compression.slice(0, 6);
    } else if (chartMode === 'custom') {
      activeChartTokens = analyzed.filter(t => selectedSymbols.includes(t.symbol));
    }

    // Fallback si vide
    if (activeChartTokens.length === 0) {
      activeChartTokens = grouped.ignition.slice(0, 4);
    }

    return {
      analyzed,
      grouped,
      activeChartTokens,
      topIgnitionTarget: grouped.ignition[0] || null,
      activeLeader: grouped.climax[0] || analyzed[0]
    };
  }, [tokensList, timeframe, chartMode, selectedSymbols]);

  // Toggle symbole personnalisé par clic sur carte
  const handleToggleSymbol = (sym) => {
    setChartMode('custom');
    setSelectedSymbols(prev => {
      if (prev.includes(sym)) {
        const filtered = prev.filter(s => s !== sym);
        return filtered.length > 0 ? filtered : [sym];
      } else {
        return [...prev.slice(-5), sym]; // Max 6 tokens sélectionnés
      }
    });
  };

  // 2. Graphique Cyclique Dynamique
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
      seriesMapRef.current = {};
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 360,
      layout: { background: { color: 'rgba(3, 7, 18, 0.98)' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.04)' }, horzLines: { color: 'rgba(255, 255, 255, 0.04)' } },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        autoScale: true,
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
    });

    if (cycleAnalysis && cycleAnalysis.activeChartTokens) {
      const alpha = 2 / (8 + 1);

      cycleAnalysis.activeChartTokens.forEach((item, idx) => {
        const color = chartMode === 'custom' ? DISTINCT_COLORS[idx % DISTINCT_COLORS.length] : item.phaseDetails.color;

        const lineSeries = chart.addLineSeries({
          color: color,
          lineWidth: 2,
          lineStyle: 0,
          title: `${item.symbol} (Acc: ${item.accPct >= 0 ? '+' : ''}${item.accPct}%/h | ${item.totalPerfPct}%)`,
          priceLineVisible: false,
          lastValueVisible: true,
        });

        const raw = item.candles;
        const startClose = typeof raw[0] === 'object' ? raw[0].close : raw[0];
        const cleanData = [];
        let ema = 0;

        raw.forEach((c, cIdx) => {
          const t = typeof c === 'object' ? c.time : 0;
          const p = typeof c === 'object' ? c.close : c;
          const perf = startClose > 0 ? ((p - startClose) / startClose) * 100 : 0;

          if (cIdx === 0) {
            ema = perf;
          } else {
            ema = (perf * alpha) + (ema * (1 - alpha));
          }

          cleanData.push({ time: t, value: parseFloat(ema.toFixed(2)) });
        });

        lineSeries.setData(cleanData);
        seriesMapRef.current[item.symbol] = lineSeries;
      });
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({ width: container.clientWidth });
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
  }, [cycleAnalysis, timeframe, chartMode, selectedSymbols]);

  if (!cycleAnalysis) return null;

  const { grouped, topIgnitionTarget, activeLeader } = cycleAnalysis;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(6, 12, 26, 0.98) 0%, rgba(3, 7, 18, 0.99) 100%)',
      border: '2px solid rgba(0, 255, 136, 0.35)',
      borderRadius: '16px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      boxShadow: '0 0 35px rgba(0, 255, 136, 0.12)'
    }}>
      {/* 🔄 1. HEADER DE LA ROUE DES CYCLES & HORIZON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #00ff88, #10b981)',
            padding: '10px',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)'
          }}>
            <RotateCw size={24} color="#000" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#00ff88', letterSpacing: '0.5px' }}>
                🔄 ROUE DU CYCLE DE LIQUIDITÉ (ROTATION ENGINE)
              </h2>
              <span style={{ background: 'rgba(0, 255, 136, 0.15)', color: '#00ff88', border: '1px solid rgba(0, 255, 136, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '900' }}>
                FOCUSED CYCLE
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              تتبع مسار انطلاق التوكنات فـ Phase 2 (Ignition) مع إمكانية عرض أي مرحلة بالضغط عليها
            </p>
          </div>
        </div>

        {/* SÉLECTEUR D'HORIZON */}
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setTimeframe('24h')}
            style={{
              background: timeframe === '24h' ? 'linear-gradient(135deg, #00ff88, #10b981)' : 'transparent',
              color: timeframe === '24h' ? '#000' : '#888',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            🕒 24 HEURES
          </button>
          <button
            onClick={() => setTimeframe('7d')}
            style={{
              background: timeframe === '7d' ? 'linear-gradient(135deg, #00ff88, #10b981)' : 'transparent',
              color: timeframe === '7d' ? '#000' : '#888',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            📅 7 JOURS
          </button>
        </div>
      </div>

      {/* 🎯 2. SÉLECTEUR DU MODE D'AFFICHAGE DU CHARTE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setChartMode('ignition')}
            style={{
              background: chartMode === 'ignition' ? '#00ff88' : 'rgba(0, 255, 136, 0.1)',
              color: chartMode === 'ignition' ? '#000' : '#00ff88',
              border: '1px solid rgba(0, 255, 136, 0.4)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🚀 TOUS LES TOKENS EN IGNITION (PHASE 2 - ACHAT)
          </button>
          <button
            onClick={() => setChartMode('climax')}
            style={{
              background: chartMode === 'climax' ? '#facc15' : 'rgba(250, 204, 21, 0.1)',
              color: chartMode === 'climax' ? '#000' : '#facc15',
              border: '1px solid rgba(250, 204, 21, 0.4)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            👑 LEADERS AU SOMMET (PHASE 3 & 4)
          </button>
          <button
            onClick={() => setChartMode('compression')}
            style={{
              background: chartMode === 'compression' ? '#38bdf8' : 'rgba(56, 189, 248, 0.1)',
              color: chartMode === 'compression' ? '#000' : '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            🔵 TOKENS EN COMPRESSION (PHASE 1)
          </button>
        </div>

        {chartMode === 'custom' && (
          <span style={{ fontSize: '0.74rem', color: '#00ff88', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MousePointerClick size={14} /> {selectedSymbols.length} Tokens Sélectionnés par clic
          </span>
        )}
      </div>

      {/* 📊 3. GRAPHIQUE DES TRAJECTOIRES DE CYCLE */}
      <div style={{ background: 'rgba(3, 7, 18, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ color: '#fff', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={16} color="#00ff88" />
            {chartMode === 'ignition' ? 'TRAJECTOIRES DES CANDIDATS EN PHASE 2 (IGNITION ACTIF)' :
             chartMode === 'climax' ? 'TRAJECTOIRES DES LEADERS AU SOMMET & SORTIE' :
             chartMode === 'compression' ? 'TRAJECTOIRES DE COMPRESSION (PHASE 1)' :
             'TRAJECTOIRES SÉLECTIONNÉES SUR MESURE'} ({timeframe.toUpperCase()})
          </span>
          <span style={{ color: '#888' }}>
            Cliquez sur n'importe quelle carte ci-dessous pour l'afficher sur le graphique
          </span>
        </div>
        <div ref={chartContainerRef} style={{ width: '100%', height: '360px', borderRadius: '8px', overflow: 'hidden' }} />
      </div>

      {/* 🎴 4. LES 4 CADRANS DE LA ROUE DU MARCHÉ (CLIQUABLES) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        {/* CADRAN 2 : IGNITION (LE PLUS IMPORTANT POUR LE TRADING) */}
        <div style={{
          background: 'rgba(0, 255, 136, 0.05)',
          border: '1px solid rgba(0, 255, 136, 0.3)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.82rem' }}>
              🟢 PHASE 2 : IGNITION (ACHAT)
            </span>
            <span style={{ background: '#00ff88', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: '900' }}>
              {grouped.ignition.length} TOKENS
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {grouped.ignition.length > 0 ? (
              grouped.ignition.map(t => {
                const isSelected = selectedSymbols.includes(t.symbol);
                return (
                  <div
                    key={t.symbol}
                    onClick={() => handleToggleSymbol(t.symbol)}
                    style={{
                      background: isSelected ? 'rgba(0, 255, 136, 0.25)' : 'rgba(0,0,0,0.4)',
                      border: isSelected ? '1px solid #00ff88' : '1px solid transparent',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{t.symbol}</strong>
                      <div style={{ fontSize: '0.66rem', color: '#00ff88' }}>Acc: +{t.accPct}%/h</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '0.82rem' }}>+{t.totalPerfPct}%</div>
                      <div style={{ fontSize: '0.66rem', color: '#888' }}>${t.price.toFixed(t.price < 0.01 ? 6 : 4)}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: '0.72rem', color: '#888', textAlign: 'center', padding: '10px' }}>
                Aucun token en ignition immédiate
              </div>
            )}
          </div>
        </div>

        {/* CADRAN 1 : COMPRESSION */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#38bdf8', fontWeight: '900', fontSize: '0.82rem' }}>
              🔵 PHASE 1 : COMPRESSION
            </span>
            <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: '900' }}>
              {grouped.compression.length} TOKENS
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {grouped.compression.slice(0, 10).map(t => {
              const isSelected = selectedSymbols.includes(t.symbol);
              return (
                <div
                  key={t.symbol}
                  onClick={() => handleToggleSymbol(t.symbol)}
                  style={{
                    background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0,0,0,0.4)',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{t.symbol}</strong>
                    <div style={{ fontSize: '0.66rem', color: '#888' }}>Range: {t.rangePct}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '0.82rem' }}>{t.totalPerfPct}%</div>
                    <div style={{ fontSize: '0.66rem', color: '#888' }}>${t.price.toFixed(t.price < 0.01 ? 6 : 4)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CADRAN 3 : SOMMET (CLIMAX) */}
        <div style={{
          background: 'rgba(250, 204, 21, 0.05)',
          border: '1px solid rgba(250, 204, 21, 0.25)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#facc15', fontWeight: '900', fontSize: '0.82rem' }}>
              🟡 PHASE 3 : SOMMET (CLIMAX)
            </span>
            <span style={{ background: 'rgba(250, 204, 21, 0.2)', color: '#facc15', padding: '2px 6px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: '900' }}>
              {grouped.climax.length} TOKENS
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {grouped.climax.map(t => {
              const isSelected = selectedSymbols.includes(t.symbol);
              return (
                <div
                  key={t.symbol}
                  onClick={() => handleToggleSymbol(t.symbol)}
                  style={{
                    background: isSelected ? 'rgba(250, 204, 21, 0.25)' : 'rgba(0,0,0,0.4)',
                    border: isSelected ? '1px solid #facc15' : '1px solid transparent',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>👑 {t.symbol}</strong>
                    <div style={{ fontSize: '0.66rem', color: '#facc15' }}>Acc: {t.accPct >= 0 ? '+' : ''}{t.accPct}%/h</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#facc15', fontWeight: 'bold', fontSize: '0.82rem' }}>+{t.totalPerfPct}%</div>
                    <div style={{ fontSize: '0.66rem', color: '#888' }}>${t.price.toFixed(t.price < 0.01 ? 6 : 4)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CADRAN 4 : SORTIE DE LIQUIDITÉ */}
        <div style={{
          background: 'rgba(244, 63, 94, 0.05)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#f43f5e', fontWeight: '900', fontSize: '0.82rem' }}>
              🔴 PHASE 4 : SORTIE LIQUIDITÉ
            </span>
            <span style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', padding: '2px 6px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: '900' }}>
              {grouped.exhaustion.length} TOKENS
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {grouped.exhaustion.map(t => {
              const isSelected = selectedSymbols.includes(t.symbol);
              return (
                <div
                  key={t.symbol}
                  onClick={() => handleToggleSymbol(t.symbol)}
                  style={{
                    background: isSelected ? 'rgba(244, 63, 94, 0.25)' : 'rgba(0,0,0,0.4)',
                    border: isSelected ? '1px solid #f43f5e' : '1px solid transparent',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{t.symbol}</strong>
                    <div style={{ fontSize: '0.66rem', color: '#f43f5e' }}>Acc: {t.accPct}%/h</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#f43f5e', fontWeight: 'bold', fontSize: '0.82rem' }}>+{t.totalPerfPct}%</div>
                    <div style={{ fontSize: '0.66rem', color: '#888' }}>${t.price.toFixed(t.price < 0.01 ? 6 : 4)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
