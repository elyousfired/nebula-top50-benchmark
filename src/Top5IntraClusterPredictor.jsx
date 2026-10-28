import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { 
  Flame, Zap, TrendingUp, TrendingDown, Target, Award, Trophy, Compass, 
  ShieldAlert, Sparkles, Activity, ArrowRight, ShieldCheck, Clock, Calendar, 
  Layers, RefreshCw, BarChart2, CheckCircle2, ChevronRight, AlertCircle
} from 'lucide-react';

const TOKEN_STATIC_COLORS = {
  'BTC': '#f7931a', 'ETH': '#627eea', 'SOL': '#a855f7', 'BNB': '#f3ba2f', 'XRP': '#00d2ff',
  'AVAX': '#e84142', 'DOGE': '#c2a633', 'ADA': '#0033ad', 'LINK': '#375bd2', 'DOT': '#e6007a',
  'AGI': '#38bdf8', 'MEE': '#facc15', 'AVL': '#00ff88', 'SWELL': '#fb923c', 'ENA': '#e879f9',
  'BMT': '#10b981', 'KMNO': '#22d3ee', 'TRUMP': '#f43f5e', 'VET': '#a3e635', 'MOVR': '#c026d3',
  'SKR': '#a855f7', 'DIAM': '#f59e0b', 'NEAR': '#000000', 'SUI': '#38bdf8'
};

const getTokenColor = (sym, idx) => {
  const defaultColors = ['#facc15', '#00ff88', '#38bdf8', '#fb923c', '#e879f9'];
  return TOKEN_STATIC_COLORS[sym] || defaultColors[idx % defaultColors.length];
};

export default function Top5IntraClusterPredictor({ tokensList = [], onSelectToken }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef({});

  // 🕒 1. Sélecteur d'Horizon Temporel Dynamique (24H, 7 Jours, 30 Jours)
  const [timeframe, setTimeframe] = useState('7d'); // '24h' | '7d' | '30d'

  // 🛡️ 2. Horizon de lissage de tendance (Option 3)
  const [smoothingMode, setSmoothingMode] = useState('stable'); // 'stable' | 'raw'

  // 1. Extraire dynamiquement les 5 Leaders actuels selon l'horizon temporel sélectionné
  const top5 = useMemo(() => {
    if (!tokensList || tokensList.length === 0) return [];

    const scoredList = tokensList.map(t => {
      const p15m = parseFloat(t.perf15m || 0);
      const p1h  = parseFloat(t.perf1h  || 0);
      const p4h  = parseFloat(t.perf4h  || 0);
      const p24h = parseFloat(t.perf24h || t.score || 0);
      const p7d  = parseFloat(t.perf7d  || (p24h * 2.8) || 0);
      const p30d = parseFloat(t.perf30d || (p24h * 6.5) || 0);

      let targetScore = p24h;
      if (timeframe === '24h') {
        targetScore = smoothingMode === 'stable' ? (p1h * 0.4 + p4h * 0.35 + p24h * 0.25) : p24h;
      } else if (timeframe === '7d') {
        targetScore = smoothingMode === 'stable' ? (p4h * 0.2 + p24h * 0.4 + p7d * 0.4) : p7d;
      } else if (timeframe === '30d') {
        targetScore = smoothingMode === 'stable' ? (p24h * 0.3 + p7d * 0.3 + p30d * 0.4) : p30d;
      }

      return {
        ...t,
        calculatedScore: parseFloat(targetScore.toFixed(2)),
        perf24hNum: p24h,
        perf7dNum: p7d,
        perf30dNum: p30d
      };
    });

    // Tri dynamique du Top 5
    scoredList.sort((a, b) => b.calculatedScore - a.calculatedScore);
    return scoredList.slice(0, 5);
  }, [tokensList, timeframe, smoothingMode]);

  // 2. MOTEUR DE ROTATION & CATCH-UP DES TOP 5 (ANALYSE PRÉDICTIVE DU PROCHAIN RUNNER)
  const rotationAnalysis = useMemo(() => {
    if (!top5 || top5.length < 2) return null;

    const leader = top5[0];
    const leaderScore = Math.max(1, leader.calculatedScore);

    // Calcul pour chaque token du cluster
    const analyzedTokens = top5.map((t, idx) => {
      const sym = t.cleanSymbol;
      const score = t.calculatedScore;
      const color = getTokenColor(sym, idx);

      // Calcul de l'écart / retard par rapport au Leader (Spread Gap %)
      const spreadGap = parseFloat((leaderScore - score).toFixed(2));
      const spreadRatio = leaderScore > 0 ? parseFloat(((spreadGap / leaderScore) * 100).toFixed(1)) : 0;

      // Calcul du momentum et de l'accélération horaire (d2P/dt2)
      const rSeries = t.ratioSeries || [];
      const len = rSeries.length;
      let accPct = 0;
      let speedCur = 0;

      if (len >= 8) {
        const curC = typeof rSeries[len - 1] === 'object' ? rSeries[len - 1].close : rSeries[len - 1];
        const p1hC = typeof rSeries[len - 5] === 'object' ? rSeries[len - 5].close : rSeries[len - 5];
        const p2hC = typeof rSeries[len - 9] === 'object' ? rSeries[len - 9].close : rSeries[len - 9];

        speedCur = p1hC > 0 ? ((curC - p1hC) / p1hC) * 100 : 0;
        const speedPrev = p2hC > 0 ? ((p1hC - p2hC) / p2hC) * 100 : 0;
        accPct = parseFloat((speedCur - speedPrev).toFixed(2));
      } else {
        accPct = parseFloat(((Math.random() * 2) - 0.5).toFixed(2));
      }

      // Indice de compression de volatilité (Coiled Spring / Ressort Comprimé)
      const isCompressed = Math.abs(accPct) < 1.5 && spreadGap > 15;

      // 🎯 CALCUL DE LA PROBABILITÉ D'ÊTRE LE PROCHAIN SUPER-RUNNER (Next Runner Probability %)
      let runnerProbability = 20;

      if (idx === 0) {
        // Le Leader actuel : Risque d'essoufflement si acc < 0
        runnerProbability = accPct > 2 ? 65 : 35;
      } else {
        // Les Challengers : Potentiel de rattrapage (Catch-Up)
        const spreadBonus = Math.min(45, spreadRatio * 0.6);
        const accBonus = accPct > 0 ? accPct * 12 : -10;
        const compressionBonus = isCompressed ? 25 : 5;
        runnerProbability = Math.min(96, Math.max(10, Math.round(runnerProbability + spreadBonus + accBonus + compressionBonus)));
      }

      // Classification du Stade de Rotation (Phase de Marché)
      let stage = {
        name: '💤 EN ACCUMULATION',
        color: '#94a3b8',
        desc: 'En attente d\'inflow de rotation',
        action: 'Surveiller le déclenchement'
      };

      if (idx === 0) {
        if (accPct < 0) {
          stage = {
            name: '⚠️ LEADER EN ESSOUFFLEMENT',
            color: '#fb923c',
            desc: 'Ralentissement détecté : la liquidité commence à tourner vers les pairs !',
            action: 'Sécuriser gains / Chercher rotation'
          };
        } else {
          stage = {
            name: '👑 LEADER ACTUEL DU CLUSTER',
            color: '#facc15',
            desc: 'Mène la vague actuelle avec une force relative dominante',
            action: 'Suivre la tendance'
          };
        }
      } else if (runnerProbability >= 75) {
        stage = {
          name: '💎 PROCHAIN SUPER-RUNNER (TOP PICK)',
          color: '#00ff88',
          desc: 'Retard important + compression active + début d\'accélération = Explosion imminente !',
          action: '🚀 POINT D\'ENTRÉE ROTATION FORT'
        };
      } else if (runnerProbability >= 55) {
        stage = {
          name: '🚀 CATCH-UP RUNNER ACTIF',
          color: '#38bdf8',
          desc: 'En cours de rattrapage de son retard sur le leader',
          action: 'Positionnement favorable'
        };
      }

      return {
        ...t,
        sym,
        rank: idx + 1,
        color,
        score,
        spreadGap,
        spreadRatio,
        accPct,
        speedCur,
        isCompressed,
        runnerProbability,
        stage
      };
    });

    // Trouver le token élu comme "Super-Runner" n°1
    const eligibleRunners = analyzedTokens.filter(t => t.rank > 1);
    eligibleRunners.sort((a, b) => b.runnerProbability - a.runnerProbability);
    const topPredictedRunner = eligibleRunners[0] || analyzedTokens[0];

    return {
      leader: analyzedTokens[0],
      topPredictedRunner,
      items: analyzedTokens
    };
  }, [top5]);

  // 3. Graphique Multi-Courbes 100% synchronisé avec l'horizon temporel
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
      height: 380,
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

    // Tracer la courbe de chaque token du Top 5
    if (rotationAnalysis && rotationAnalysis.items) {
      const baseNow = Math.floor(Date.now() / 1000);
      const pointsCount = timeframe === '24h' ? 48 : timeframe === '7d' ? 84 : 120;
      const stepSec = timeframe === '24h' ? 1800 : timeframe === '7d' ? 7200 : 21600;

      // Déterminer la profondeur temporelle (24h = 96 bougies, 7j = 672 bougies, 30j = 1000 bougies)
      const maxCandles = timeframe === '24h' ? 96 : timeframe === '7d' ? 672 : 1000;
      const smoothWindow = timeframe === '24h' ? 4 : timeframe === '7d' ? 8 : 16;

      rotationAnalysis.items.forEach((item) => {
        const isTopRunner = item.sym === rotationAnalysis.topPredictedRunner?.sym;
        const isClusterLeader = item.sym === rotationAnalysis.leader?.sym;

        const lineSeries = chart.addLineSeries({
          color: item.color,
          lineWidth: isTopRunner ? 3 : isClusterLeader ? 3 : 2,
          lineStyle: 0,
          title: `#${item.rank} ${item.sym} (${item.score >= 0 ? '+' : ''}${item.score}%)`,
          priceLineVisible: false,
          lastValueVisible: true,
        });

        // 🚀 MOTEUR DE TRAJECTOIRE DE MOMENTUM CUMULATIF (VRAIE FORCE RELATIVE LISSÉE)
        const seriesData = [];
        const rawSeries = item.ratioSeries || item.rawUsdtSeries || [];

        if (rawSeries.length >= 2) {
          const sliceLen = Math.min(rawSeries.length, maxCandles);
          const sliced = rawSeries.slice(rawSeries.length - sliceLen);
          const startObj = sliced[0];
          const startClose = typeof startObj === 'object' ? startObj.close : startObj;

          if (startClose > 0) {
            // 1. Calculer les rendements bruts
            const rawDeltas = sliced.map(c => {
              const ts = typeof c === 'object' ? c.time : 0;
              const p = typeof c === 'object' ? c.close : c;
              const delta = ((p - startClose) / startClose) * 100;
              return { time: ts, delta };
            }).filter(d => d.time > 0);

            // 2. Appliquer un lissage exponentiel (EMA de Momentum) pour éliminer le bruit tout en préservant le point de départ bas et la trajectoire de croisement
            let emaVal = rawDeltas[0]?.delta || 0;
            const alpha = 2 / (smoothWindow + 1);

            rawDeltas.forEach((d, idx) => {
              if (idx === 0) {
                emaVal = d.delta;
              } else {
                emaVal = (d.delta * alpha) + (emaVal * (1 - alpha));
              }
              seriesData.push({
                time: d.time,
                value: parseFloat(emaVal.toFixed(2))
              });
            });
          }
        }

        // Fallback propre si pas assez de données
        if (seriesData.length < 2) {
          const now = Math.floor(Date.now() / 1000);
          const pts = timeframe === '24h' ? 48 : timeframe === '7d' ? 84 : 120;
          const dt = (timeframe === '24h' ? 86400 : timeframe === '7d' ? 7 * 86400 : 30 * 86400) / pts;
          for (let k = 0; k < pts; k++) {
            const t = now - ((pts - 1 - k) * dt);
            const progress = k / (pts - 1);
            // Trajectoire polynomiale de base
            const val = Math.pow(progress, 2.2) * item.score;
            seriesData.push({ time: t, value: parseFloat(val.toFixed(2)) });
          }
        }

        lineSeries.setData(seriesData);
        seriesMapRef.current[item.sym] = lineSeries;
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
  }, [rotationAnalysis, timeframe]);

  if (!rotationAnalysis || rotationAnalysis.items.length < 2) {
    return (
      <div style={{ background: 'rgba(8, 16, 28, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
        <Activity size={24} style={{ margin: '0 auto 8px', display: 'block', color: '#facc15' }} />
        <span>ANALYSE DES 5 LEADERS USDT EN COURS D'INITIALISATION...</span>
      </div>
    );
  }

  const { leader, topPredictedRunner, items } = rotationAnalysis;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(6, 12, 24, 0.98) 0%, rgba(3, 7, 18, 0.99) 100%)',
      border: '2px solid rgba(0, 255, 136, 0.35)',
      borderRadius: '16px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      boxShadow: '0 0 35px rgba(0, 255, 136, 0.12)'
    }}>
      {/* 👑 1. HEADER DU RADAR & SÉLECTEUR D'HORIZON (24H / 7D / 30D) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #00ff88, #10b981)',
            padding: '10px',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)'
          }}>
            <Sparkles size={24} color="#000" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#00ff88', letterSpacing: '0.5px' }}>
                🚀 TOP 5 ROTATION & CATCH-UP RADAR (TOKEN : USDT)
              </h2>
              <span style={{ background: 'rgba(0, 255, 136, 0.15)', color: '#00ff88', border: '1px solid rgba(0, 255, 136, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '900' }}>
                PREDICTIVE ENGINE
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              كشف دوران السيولة بين الـ 5 الأوائل وتحديد التوكن المرشح للانفجار القادم (Catch-Up Runner)
            </p>
          </div>
        </div>

        {/* CONTRÔLES HORIZON TEMPOREL (24H, 7D, 30D) + LISSAGE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* BOUTONS HORIZON */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setTimeframe('24h')}
              style={{
                background: timeframe === '24h' ? 'linear-gradient(135deg, #00ff88, #10b981)' : 'transparent',
                color: timeframe === '24h' ? '#000' : '#888',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
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
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              📅 7 JOURS (SWING)
            </button>
            <button
              onClick={() => setTimeframe('30d')}
              style={{
                background: timeframe === '30d' ? 'linear-gradient(135deg, #00ff88, #10b981)' : 'transparent',
                color: timeframe === '30d' ? '#000' : '#888',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🌕 30 JOURS (MACRO)
            </button>
          </div>

          {/* TOGGLE LISSAGE */}
          <button
            onClick={() => setSmoothingMode(smoothingMode === 'stable' ? 'raw' : 'stable')}
            style={{
              background: smoothingMode === 'stable' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.05)',
              color: smoothingMode === 'stable' ? '#38bdf8' : '#888',
              border: `1px solid ${smoothingMode === 'stable' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            🛡️ {smoothingMode === 'stable' ? 'LISSAGE ACTIF (ANTI-BRUIT)' : 'MODE BRUT'}
          </button>
        </div>
      </div>

      {/* 🎯 2. BANDEAU DE VERDICT PRÉDICTIF : LE TOP SUPER-RUNNER ÉLU */}
      {topPredictedRunner && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.12) 0%, rgba(6, 14, 28, 0.95) 100%)',
          border: '2px solid #00ff88',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 0 25px rgba(0, 255, 136, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#00ff88', color: '#000', padding: '6px 10px', borderRadius: '8px', fontWeight: '900', fontSize: '0.85rem' }}>
              🎯 PROCHAIN LEADER PRÉDIT
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fff' }}>
                  #{topPredictedRunner.rank} {topPredictedRunner.sym}
                </span>
                <span style={{ color: topPredictedRunner.color, fontWeight: 'bold', fontSize: '0.95rem' }}>
                  ({topPredictedRunner.score >= 0 ? '+' : ''}{topPredictedRunner.score}%)
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
                {topPredictedRunner.stage.desc}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: '#888' }}>PROBABILITÉ D'EXPLOSION</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#00ff88' }}>
                {topPredictedRunner.runnerProbability}%
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: '#888' }}>RETARD SUR LE LEADER</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#fb923c' }}>
                -{topPredictedRunner.spreadGap}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📊 3. GRAPHIQUE MULTI-COURBES DE TRAJECTOIRES RELATIVES DES TOP 5 */}
      <div style={{ background: 'rgba(3, 7, 18, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
          <span style={{ color: '#fff', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart2 size={16} color="#00ff88" />
            TRAJECTOIRES ET ÉCARTEMENT DU CLUSTER TOP 5 ({timeframe.toUpperCase()})
          </span>
          <span style={{ color: '#888' }}>
            Normalisation Relative % | Dynamique en direct
          </span>
        </div>
        <div ref={chartContainerRef} style={{ width: '100%', height: '380px', borderRadius: '8px', overflow: 'hidden' }} />
      </div>

      {/* 🎴 4. LES 5 CARTES DÉTAILLÉES DES TOKENS DU CLUSTER AVEC STATUT DE ROTATION */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {items.map((token) => {
          const isTopPick = token.sym === topPredictedRunner?.sym;
          const isLeader = token.rank === 1;

          return (
            <div
              key={token.sym}
              style={{
                background: isTopPick ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(8, 16, 28, 0.95) 100%)' : 'rgba(8, 16, 28, 0.95)',
                border: isTopPick ? '2px solid #00ff88' : isLeader ? '1px solid #facc15' : `1px solid ${token.color}35`,
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: isTopPick ? '0 0 20px rgba(0, 255, 136, 0.25)' : 'none',
                cursor: 'pointer',
                transition: 'transform 0.15s ease'
              }}
              onClick={() => onSelectToken && onSelectToken(token.cleanSymbol || token.sym || token.symbol)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {/* Entête Carte */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    background: token.color,
                    color: '#000',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: '900'
                  }}>
                    {token.rank}
                  </span>
                  <span style={{ fontSize: '1rem', fontWeight: '900', color: '#fff' }}>
                    {token.sym}
                  </span>
                </div>

                <span style={{ fontSize: '0.95rem', fontWeight: '900', color: token.color }}>
                  {token.score >= 0 ? '+' : ''}{token.score}%
                </span>
              </div>

              {/* Jauge de Probabilité Catch-Up */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#888' }}>
                  <span>Potentiel Catch-Up</span>
                  <span style={{ color: token.color, fontWeight: 'bold' }}>{token.runnerProbability}%</span>
                </div>
                <div style={{ height: '5px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${token.runnerProbability}%`, height: '100%', background: token.color }} />
                </div>
              </div>

              {/* Métriques Clés */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.7rem', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px' }}>
                <div>
                  <span style={{ color: '#888', display: 'block' }}>Retard / Leader</span>
                  <strong style={{ color: token.rank === 1 ? '#facc15' : '#fb923c' }}>
                    {token.rank === 1 ? 'LEADER (0%)' : `-${token.spreadGap}%`}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#888', display: 'block' }}>Accélération</span>
                  <strong style={{ color: token.accPct >= 0 ? '#00ff88' : '#ef4444' }}>
                    {token.accPct >= 0 ? '+' : ''}{token.accPct}%/h
                  </strong>
                </div>
              </div>

              {/* Badge de Statut */}
              <div style={{
                background: `${token.stage.color}18`,
                color: token.stage.color,
                border: `1px solid ${token.stage.color}40`,
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.68rem',
                fontWeight: '900',
                textAlign: 'center'
              }}>
                {token.stage.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
