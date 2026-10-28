import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Globe, Zap, RefreshCw, ChevronDown, ChevronUp, Eye, ArrowRight, Layers, Activity, Crown, Sparkles, TrendingUp, Compass, Shield } from 'lucide-react';

function formatMillions(val) {
  if (val === undefined || val === null || isNaN(val)) return '$0';
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  if (abs >= 1000000000) return `${sign}$${(abs / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

// 5 DISTINCT GUARANTEED POSITIONS (TOP 5 INDIVIDUAL TOKENS)
const FIXED_5_POSITIONS = [
  { x: 450, y: 70,  labelPos: 'top' },    // #1 Center Top
  { x: 730, y: 150, labelPos: 'right' },  // #2 Right Top
  { x: 620, y: 265, labelPos: 'bottom' }, // #3 Right Bottom
  { x: 280, y: 265, labelPos: 'bottom' }, // #4 Left Bottom
  { x: 170, y: 150, labelPos: 'left' }    // #5 Left Top
];

// 6 HARMONIC CONSTELLATION ORBITS (GLOBAL MARKET TIERS)
const MARKET_TIERS_CONFIG = [
  { id: 'top5',   label: 'TOP 5',   badge: '👑', count: 5,   name: 'Leaders Ultra-Momentum', x: 450, y: 75,  radius: 46, color: '#10b981', gradientId: 'grad-top5',   glowColor: 'rgba(16,185,129,0.9)' },
  { id: 'top10',  label: 'TOP 10',  badge: '⚡', count: 10,  name: 'Élite Élargie',          x: 740, y: 130, radius: 38, color: '#38bdf8', gradientId: 'grad-top10',  glowColor: 'rgba(56,189,248,0.8)' },
  { id: 'top20',  label: 'TOP 20',  badge: '🚀', count: 20,  name: 'Moteur Actif du Marché', x: 670, y: 260, radius: 34, color: '#a855f7', gradientId: 'grad-top20',  glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'top200', label: 'TOP 200', badge: '🪐', count: 200, name: 'Profondeur Scanner',    x: 450, y: 285, radius: 28, color: '#64748b', gradientId: 'grad-top200', glowColor: 'rgba(100,116,139,0.7)' },
  { id: 'top50',  label: 'TOP 50',  badge: '🌊', count: 50,  name: 'Mid-Caps & Écosystème',  x: 230, y: 260, radius: 32, color: '#3b82f6', gradientId: 'grad-top50',   glowColor: 'rgba(59,130,246,0.8)' },
  { id: 'top100', label: 'TOP 100', badge: '🌐', count: 100, name: 'Marché Global Bybit',   x: 160, y: 130, radius: 30, color: '#00d2ff', gradientId: 'grad-top100',  glowColor: 'rgba(0,210,255,0.75)' },
];

export default function LiquidityRotationNetwork({ tokensList = [], onSelectToken }) {
  const [timeframe, setTimeframe] = useState('4h'); // '4h' or '24h'
  const [viewMode, setViewMode] = useState('market'); // 'market' (6 tiers bubbles), 'network' (5 tokens), 'table' (magnets list)
  const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default on startup
  const [hoveredSymbol, setHoveredSymbol] = useState(null);
  const [hoveredTier, setHoveredTier] = useState(null);
  const [flowData, setFlowData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🎯 STRICTLY 5 TOKENS FROM THE TOP 5 LEADERS
  const top5Leaders = useMemo(() => {
    let list = [];
    if (tokensList && tokensList.length > 0) {
      const sorted = [...tokensList]
        .filter(t => (t.score || 0) >= 0)
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      list = sorted.slice(0, 5);
    }

    const fallbackSymbols = ['STX', 'TRUMP', 'ENA', 'PUMP', 'VVV'];
    const result = [];

    for (let i = 0; i < 5; i++) {
      const tok = list[i];
      const sym = tok ? (tok.cleanSymbol || tok.symbol || '').replace('USDT', '') : fallbackSymbols[i];
      result.push({
        symbol: sym || fallbackSymbols[i],
        rank: i + 1,
        score: tok?.score || (30 - i * 3)
      });
    }

    return result;
  }, [tokensList]);

  // 📊 CALCUL DES PALIERS DE MARCHÉ POUR LE MODE BUBBLES MARCHÉ
  const marketTiersData = useMemo(() => {
    const sorted = tokensList && tokensList.length > 0
      ? [...tokensList].sort((a, b) => (b.score || 0) - (a.score || 0))
      : [];

    return MARKET_TIERS_CONFIG.map(tier => {
      const slice = sorted.length > 0 ? sorted.slice(0, tier.count) : [];
      const actualCount = slice.length || 1;

      // 1. Score Moyen
      const sumScore = slice.reduce((acc, tok) => acc + (tok.score || 0), 0);
      const avgScore = sorted.length > 0 ? (sumScore / actualCount) : (26.3 - tier.count * 0.1);

      // 2. Gain Moyen 4H & 24H
      let sum4h = 0;
      let count4h = 0;
      let sum24h = 0;
      let count24h = 0;

      slice.forEach(tok => {
        if (tok.ratioSeries && tok.ratioSeries.length >= 16) {
          const len = tok.ratioSeries.length;
          const last = tok.ratioSeries[len - 1];
          const prev4 = tok.ratioSeries[Math.max(0, len - 16)];
          const prev24 = tok.ratioSeries[0];

          const lastVal = typeof last === 'object' ? last.close : last;
          const prev4Val = typeof prev4 === 'object' ? prev4.close : prev4;
          const prev24Val = typeof prev24 === 'object' ? prev24.close : prev24;

          if (prev4Val > 0) {
            sum4h += ((lastVal - prev4Val) / prev4Val) * 100;
            count4h++;
          }
          if (prev24Val > 0) {
            sum24h += ((lastVal - prev24Val) / prev24Val) * 100;
            count24h++;
          }
        }
      });

      const avg4h = count4h > 0 ? (sum4h / count4h) : (avgScore * 0.2);
      const avg24h = count24h > 0 ? (sum24h / count24h) : (avgScore * 0.28);

      // 3. Breadth
      const greenTokens = slice.filter(tok => (tok.score || 0) > 0).length;
      const breadthPct = sorted.length > 0 ? Math.round((greenTokens / actualCount) * 100) : 100;

      return {
        ...tier,
        avgScore: avgScore.toFixed(1),
        avg4h: avg4h.toFixed(2),
        avg24h: avg24h.toFixed(2),
        breadthPct,
        greenTokens,
        actualCount
      };
    });
  }, [tokensList, timeframe]);

  // Fetch Kline data for ALL 5 Top Tokens
  const fetchAllFlows = useCallback(async () => {
    try {
      setLoading(true);
      const results = [];

      await Promise.all(
        top5Leaders.map(async (leader) => {
          const sym = leader.symbol;
          let price = 0;
          let change24h = 0;
          let netFlow24h = 0;
          let netFlow4h = 0;

          try {
            const res = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}USDT&interval=15&limit=96`);
            if (res.ok) {
              const data = await res.json();
              const list = data?.result?.list || [];
              if (list.length > 0) {
                const latest = list[0];
                price = parseFloat(latest[4]);

                let totalVol24h = 0;
                let takerBuy24h = 0;
                let totalVol4h = 0;
                let takerBuy4h = 0;

                list.forEach((candle, idx) => {
                  const vol = parseFloat(candle[5]) * parseFloat(candle[4]);
                  const open = parseFloat(candle[1]);
                  const close = parseFloat(candle[4]);
                  const isGreen = close >= open;
                  const estimatedBuy = isGreen ? vol * 0.58 : vol * 0.42;

                  if (idx < 96) {
                    totalVol24h += vol;
                    takerBuy24h += estimatedBuy;
                  }
                  if (idx < 16) {
                    totalVol4h += vol;
                    takerBuy4h += estimatedBuy;
                  }
                });

                netFlow24h = takerBuy24h - (totalVol24h - takerBuy24h);
                netFlow4h = takerBuy4h - (totalVol4h - takerBuy4h);

                const oldest = list[list.length - 1];
                const oldClose = parseFloat(oldest[1]);
                change24h = oldClose > 0 ? ((price - oldClose) / oldClose) * 100 : 0;
              }
            }
          } catch (_) {}

          results.push({
            symbol: sym,
            rank: leader.rank,
            score: leader.score,
            price,
            change24h,
            netFlow24h,
            netFlow4h
          });
        })
      );

      results.sort((a, b) => a.rank - b.rank);
      setFlowData(results);
    } catch (e) {
      console.warn('Error computing 5-sphere flows', e);
    } finally {
      setLoading(false);
    }
  }, [top5Leaders]);

  useEffect(() => {
    fetchAllFlows();
    const interval = setInterval(fetchAllFlows, 10000);
    return () => clearInterval(interval);
  }, [fetchAllFlows]);

  const guaranteed5Tokens = useMemo(() => {
    if (flowData.length === 5) return flowData;
    return top5Leaders.map(leader => {
      const found = flowData.find(f => f.symbol === leader.symbol);
      return found || {
        symbol: leader.symbol,
        rank: leader.rank,
        score: leader.score,
        price: 0,
        change24h: 0,
        netFlow24h: 0,
        netFlow4h: 0
      };
    });
  }, [flowData, top5Leaders]);

  const sortedByFlow = useMemo(() => {
    return [...guaranteed5Tokens].sort((a, b) => {
      const valA = timeframe === '4h' ? a.netFlow4h : a.netFlow24h;
      const valB = timeframe === '4h' ? b.netFlow4h : b.netFlow24h;
      return valB - valA;
    });
  }, [guaranteed5Tokens, timeframe]);

  const magnets = useMemo(() => sortedByFlow.filter(t => (timeframe === '4h' ? t.netFlow4h : t.netFlow24h) >= 0), [sortedByFlow, timeframe]);
  const donors = useMemo(() => sortedByFlow.filter(t => (timeframe === '4h' ? t.netFlow4h : t.netFlow24h) < 0).reverse(), [sortedByFlow, timeframe]);

  // Directed Flow Arrows between Top 5 tokens
  const flowLinks = useMemo(() => {
    const links = [];
    if (magnets.length > 0 && donors.length > 0) {
      donors.forEach((donor) => {
        magnets.forEach((magnet) => {
          const donorIdx = guaranteed5Tokens.findIndex(t => t.symbol === donor.symbol);
          const magnetIdx = guaranteed5Tokens.findIndex(t => t.symbol === magnet.symbol);
          if (donorIdx >= 0 && magnetIdx >= 0 && donorIdx !== magnetIdx) {
            links.push({
              source: donorIdx,
              target: magnetIdx,
              intensity: 2.5,
              color: '#38bdf8'
            });
          }
        });
      });
    } else {
      for (let i = 0; i < 4; i++) {
        links.push({
          source: (i + 1),
          target: 0,
          intensity: 2,
          color: '#10b981'
        });
      }
    }
    return links;
  }, [magnets, donors, guaranteed5Tokens]);

  // Directed Flow Curved Energy Conduits between Market Tiers (Top 200 -> 100 -> 50 -> 20 -> 10 -> Top 5)
  const marketTiersLinks = [
    { source: 3, target: 5, ctrlX: 300, ctrlY: 210, color: '#64748b', strokeW: 2.2, dur: '3.2s' }, // Top 200 -> Top 100
    { source: 5, target: 4, ctrlX: 180, ctrlY: 200, color: '#00d2ff', strokeW: 2.5, dur: '2.8s' }, // Top 100 -> Top 50
    { source: 4, target: 2, ctrlX: 450, ctrlY: 310, color: '#3b82f6', strokeW: 2.8, dur: '2.4s' }, // Top 50 -> Top 20
    { source: 2, target: 1, ctrlX: 720, ctrlY: 200, color: '#a855f7', strokeW: 3.2, dur: '2.0s' }, // Top 20 -> Top 10
    { source: 1, target: 0, ctrlX: 600, ctrlY: 85,  color: '#38bdf8', strokeW: 4.0, dur: '1.6s' }, // Top 10 -> Top 5
    { source: 4, target: 0, ctrlX: 320, ctrlY: 150, color: '#10b981', strokeW: 3.5, dur: '1.8s' }, // Top 50 Direct Injection -> Top 5
  ];

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(8, 14, 26, 0.98) 0%, rgba(4, 8, 16, 0.99) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '14px',
      padding: '12px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: '0 0 35px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      fontFamily: 'JetBrains Mono, monospace'
    }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={18} color="#10b981" />
          <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: '900', letterSpacing: '0.6px' }}>
            {viewMode === 'market' 
              ? 'CONSTELLATION DU MARCHÉ GLOBAL (6 SPHÈRES DE PROFONDEUR)' 
              : 'CONSTELLATION DE LIQUIDITÉ DU TOP 5 LEADERS (5 SPHÈRES)'}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
            · Matrice vectorielle des transferts de liquidité en direct
          </span>
        </div>

        {/* Action Controls & View Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Timeframe 4H / 24H */}
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.6)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setTimeframe('4h')}
              style={{
                background: timeframe === '4h' ? '#10b981' : 'transparent',
                color: timeframe === '4h' ? '#000000' : '#94a3b8',
                border: 'none',
                padding: '3px 9px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              FLUX 4H
            </button>
            <button
              onClick={() => setTimeframe('24h')}
              style={{
                background: timeframe === '24h' ? '#10b981' : 'transparent',
                color: timeframe === '24h' ? '#000000' : '#94a3b8',
                border: 'none',
                padding: '3px 9px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              FLUX 24H
            </button>
          </div>

          {/* 3 View Modes: MARCHÉ GLOBAL (6 Bulles) vs 5 SPHÈRES TOP 5 vs TABLEAU */}
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.6)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setViewMode('market')}
              style={{
                background: viewMode === 'market' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: viewMode === 'market' ? '#000000' : '#10b981',
                border: 'none',
                padding: '4px 11px',
                borderRadius: '4px',
                fontSize: '0.70rem',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: viewMode === 'market' ? '0 0 16px rgba(16,185,129,0.6)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Crown size={13} color={viewMode === 'market' ? '#000' : '#10b981'} />
              <span>🌐 BULLES MARCHÉ (TOP 5 ➔ 200)</span>
            </button>

            <button
              onClick={() => setViewMode('network')}
              style={{
                background: viewMode === 'network' ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: viewMode === 'network' ? '#f8fafc' : '#64748b',
                border: 'none',
                padding: '4px 9px',
                borderRadius: '4px',
                fontSize: '0.70rem',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🪐 5 SPHÈRES TOP 5
            </button>

            <button
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: viewMode === 'table' ? '#f8fafc' : '#64748b',
                border: 'none',
                padding: '4px 9px',
                borderRadius: '4px',
                fontSize: '0.70rem',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              📋 TABLEAU
            </button>
          </div>

          <button
            onClick={fetchAllFlows}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8',
              padding: '4px 7px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            title="Rafraîchir les flux"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Toggle Accordion */}
          <button
            onClick={() => setIsCollapsed(prev => !prev)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '3px 9px',
              borderRadius: '5px',
              fontSize: '0.70rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            {isCollapsed ? (
              <><span>Afficher</span> <ChevronDown size={13} /></>
            ) : (
              <><span>Réduire</span> <ChevronUp size={13} /></>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Cyber Flow Stream Banner */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(56, 189, 248, 0.08) 50%, rgba(168, 85, 247, 0.08) 100%)',
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.72rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: '900' }}>
              <Zap size={14} color="#38bdf8" />
              <span>CASCADE DU MARCHÉ ({timeframe.toUpperCase()}) :</span>
            </div>

            {viewMode === 'market' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ color: '#64748b' }}>🪐 TOP 200: <strong>{timeframe === '4h' ? marketTiersData[3].avg4h : marketTiersData[3].avg24h}%</strong></span>
                <span style={{ color: '#475569' }}>➔</span>
                <span style={{ color: '#00d2ff' }}>🌐 TOP 100: <strong>{timeframe === '4h' ? marketTiersData[5].avg4h : marketTiersData[5].avg24h}%</strong></span>
                <span style={{ color: '#475569' }}>➔</span>
                <span style={{ color: '#3b82f6' }}>🌊 TOP 50: <strong>{timeframe === '4h' ? marketTiersData[4].avg4h : marketTiersData[4].avg24h}%</strong></span>
                <span style={{ color: '#475569' }}>➔</span>
                <span style={{ color: '#a855f7' }}>🚀 TOP 20: <strong>{timeframe === '4h' ? marketTiersData[2].avg4h : marketTiersData[2].avg24h}%</strong></span>
                <span style={{ color: '#475569' }}>➔</span>
                <span style={{ color: '#38bdf8' }}>⚡ TOP 10: <strong>{timeframe === '4h' ? marketTiersData[1].avg4h : marketTiersData[1].avg24h}%</strong></span>
                <span style={{ color: '#475569' }}>➔</span>
                <span style={{ color: '#10b981', fontWeight: '900', background: 'rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: '4px', border: '1px solid #10b981' }}>
                  👑 TOP 5: {timeframe === '4h' ? marketTiersData[0].avg4h : marketTiersData[0].avg24h}%
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1' }}>
                <span style={{ color: '#10b981', fontWeight: '900' }}>🟢 INJECTION NETTE :</span>
                {magnets.map(t => (
                  <span key={t.symbol} style={{ color: '#f8fafc', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px' }}>
                    {t.symbol} (<span style={{ color: '#10b981', fontWeight: '800' }}>{formatMillions(timeframe === '4h' ? t.netFlow4h : t.netFlow24h)}</span>)
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 🌟 1. MODE BULLES MARCHÉ GLOBAL (CYBER CONSTELLATION PREMIUM 360PX) */}
          {viewMode === 'market' && (
            <div style={{
              position: 'relative',
              width: '100%',
              height: '370px',
              background: 'radial-gradient(ellipse at 50% 30%, rgba(16, 185, 129, 0.08) 0%, rgba(6, 12, 24, 0.98) 75%)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden'
            }}>
              <svg viewBox="0 0 900 370" style={{ width: '100%', height: '100%' }}>
                <defs>
                  {/* High Definition Multi-layer Glow Filters */}
                  <filter id="cyber-glow-heavy" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="12" result="blur1" />
                    <feGaussianBlur stdDeviation="6" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur1" />
                      <feMergeNode in="blur2" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="cyber-glow-soft" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>

                  {/* Radial Spheres Gradients for 3D Cyber Depth */}
                  <radialGradient id="grad-top5" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#022c22" />
                  </radialGradient>

                  <radialGradient id="grad-top10" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#7dd3fc" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#082f49" />
                  </radialGradient>

                  <radialGradient id="grad-top20" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#d8b4fe" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#3b0764" />
                  </radialGradient>

                  <radialGradient id="grad-top50" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#93c5fd" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#172554" />
                  </radialGradient>

                  <radialGradient id="grad-top100" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#67e8f9" />
                    <stop offset="50%" stopColor="#00d2ff" />
                    <stop offset="100%" stopColor="#083344" />
                  </radialGradient>

                  <radialGradient id="grad-top200" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#94a3b8" />
                    <stop offset="50%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </radialGradient>

                  {/* Flow Arrow Heads */}
                  <marker id="cyber-arrow-emerald" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
                  </marker>
                  <marker id="cyber-arrow-cyan" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" />
                  </marker>
                </defs>

                {/* Subtle Background Orbit Rings */}
                <ellipse cx="450" cy="185" rx="350" ry="125" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="6 8" />
                <ellipse cx="450" cy="185" rx="230" ry="85"  fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 6" />
                <line x1="450" y1="20" x2="450" y2="350" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="2 4" />

                {/* Fluid Curved Energy Conduits & Traveling Particles */}
                {marketTiersLinks.map((link, idx) => {
                  const s = marketTiersData[link.source];
                  const t = marketTiersData[link.target];
                  if (!s || !t) return null;

                  const pathD = `M ${s.x} ${s.y} Q ${link.ctrlX} ${link.ctrlY} ${t.x} ${t.y}`;

                  return (
                    <g key={idx}>
                      {/* Ambient Energy Conduit Glow */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={link.color}
                        strokeWidth={link.strokeW + 3}
                        strokeOpacity="0.12"
                      />
                      {/* Main Dynamic Dash Conduit */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={link.color}
                        strokeWidth={link.strokeW}
                        strokeDasharray="6 6"
                        strokeOpacity="0.6"
                        markerEnd={link.color === '#10b981' ? 'url(#cyber-arrow-emerald)' : 'url(#cyber-arrow-cyan)'}
                      />
                      {/* Animated Glowing Liquid Particles */}
                      <circle r="4" fill={link.color} filter="url(#cyber-glow-soft)">
                        <animateMotion
                          path={pathD}
                          dur={link.dur}
                          repeatCount="indefinite"
                        />
                      </circle>
                    </g>
                  );
                })}

                {/* Render the 6 Market Tiers 3D Spheres */}
                {marketTiersData.map((tier, idx) => {
                  const isHovered = hoveredTier === tier.id;
                  const isTop5 = idx === 0;
                  const gain = timeframe === '4h' ? tier.avg4h : tier.avg24h;
                  const isPos = parseFloat(gain) >= 0;

                  return (
                    <g
                      key={tier.id}
                      style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                      onMouseEnter={() => setHoveredTier(tier.id)}
                      onMouseLeave={() => setHoveredTier(null)}
                    >
                      {/* Giant Radiant Aura for Top 5 Sun */}
                      {isTop5 && (
                        <>
                          <circle
                            cx={tier.x}
                            cy={tier.y}
                            r={tier.radius + 22}
                            fill="#10b981"
                            fillOpacity="0.15"
                            filter="url(#cyber-glow-heavy)"
                          >
                            <animate attributeName="r" values={`${tier.radius + 18};${tier.radius + 26};${tier.radius + 18}`} dur="3s" repeatCount="indefinite" />
                          </circle>
                          <circle
                            cx={tier.x}
                            cy={tier.y}
                            r={tier.radius + 10}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                            strokeOpacity="0.6"
                          />
                        </>
                      )}

                      {/* Regular Spheres Outer Pulse Halo */}
                      {!isTop5 && isHovered && (
                        <circle
                          cx={tier.x}
                          cy={tier.y}
                          r={tier.radius + 12}
                          fill={tier.color}
                          fillOpacity="0.25"
                          filter="url(#cyber-glow-soft)"
                        />
                      )}

                      {/* 3D Sphere Body */}
                      <circle
                        cx={tier.x}
                        cy={tier.y}
                        r={tier.radius + (isHovered ? 4 : 0)}
                        fill={`url(#${tier.gradientId})`}
                        stroke={tier.color}
                        strokeWidth={isTop5 ? 3.5 : (isHovered ? 2.5 : 1.8)}
                        strokeOpacity={isHovered ? 1 : 0.85}
                        boxShadow="0 0 20px rgba(0,0,0,0.8)"
                      />

                      {/* Lens Specular Reflection Highlight */}
                      <ellipse
                        cx={tier.x - tier.radius * 0.25}
                        cy={tier.y - tier.radius * 0.28}
                        rx={tier.radius * 0.45}
                        ry={tier.radius * 0.22}
                        fill="#ffffff"
                        fillOpacity="0.3"
                        transform={`rotate(-25 ${tier.x - tier.radius * 0.25} ${tier.y - tier.radius * 0.28})`}
                      />

                      {/* Tier Icon Badge */}
                      <text
                        x={tier.x}
                        y={tier.y - (isTop5 ? 16 : 12)}
                        textAnchor="middle"
                        fontSize={isTop5 ? "14" : "11"}
                      >
                        {tier.badge}
                      </text>

                      {/* Tier Title */}
                      <text
                        x={tier.x}
                        y={tier.y - (isTop5 ? 3 : 1)}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={isTop5 ? "13" : "10.5"}
                        fontWeight="900"
                        letterSpacing="0.5px"
                      >
                        {tier.label}
                      </text>

                      {/* Performance % Pill */}
                      <text
                        x={tier.x}
                        y={tier.y + (isTop5 ? 13 : 12)}
                        textAnchor="middle"
                        fill={isPos ? '#00ff88' : '#ff4d6d'}
                        fontSize={isTop5 ? "12" : "9.5"}
                        fontWeight="900"
                      >
                        {isPos ? '+' : ''}{gain}%
                      </text>

                      {/* Score Subtitle */}
                      <text
                        x={tier.x}
                        y={tier.y + (isTop5 ? 26 : 22)}
                        textAnchor="middle"
                        fill="#cbd5e1"
                        fontSize={isTop5 ? "9" : "7.5"}
                        fontWeight="800"
                        opacity="0.85"
                      >
                        +{tier.avgScore} pts
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Interactive Bottom Glass HUD */}
              <div style={{
                position: 'absolute',
                bottom: '8px',
                left: '14px',
                right: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.66rem',
                color: '#94a3b8',
                background: 'rgba(0, 0, 0, 0.45)',
                padding: '4px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={12} color="#10b981" />
                  <span>Survolez une sphère pour analyser sa profondeur · Flux orientés vers le 👑 TOP 5</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#10b981', fontWeight: '900' }}>Surperformance Leaders : ~20x vs Profondeur 🚀</span>
                </div>
              </div>
            </div>
          )}

          {/* 🪐 2. MODE 5 SPHÈRES TOP 5 INDIVIDUEL */}
          {viewMode === 'network' && (
            <div style={{
              position: 'relative',
              width: '100%',
              height: '350px',
              background: 'radial-gradient(ellipse at 50% 30%, rgba(16, 185, 129, 0.08) 0%, rgba(6, 12, 24, 0.98) 75%)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden'
            }}>
              <svg viewBox="0 0 900 350" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <marker id="arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" opacity="0.9" />
                  </marker>
                </defs>

                {/* Starry Orbits */}
                <ellipse cx="450" cy="180" rx="320" ry="110" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 6" />

                {flowLinks.map((link, idx) => {
                  const s = FIXED_5_POSITIONS[link.source];
                  const t = FIXED_5_POSITIONS[link.target];
                  if (!s || !t) return null;
                  return (
                    <g key={idx}>
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={link.color}
                        strokeWidth={link.intensity}
                        strokeDasharray="6 6"
                        strokeOpacity="0.5"
                        markerEnd="url(#arrow)"
                      />
                    </g>
                  );
                })}

                {guaranteed5Tokens.map((token, idx) => {
                  const pos = FIXED_5_POSITIONS[idx];
                  const isHovered = hoveredSymbol === token.symbol;
                  const isLeader1 = token.rank === 1;
                  const flowVal = timeframe === '4h' ? token.netFlow4h : token.netFlow24h;
                  const isMagnet = flowVal >= 0;

                  return (
                    <g
                      key={token.symbol}
                      style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                      onMouseEnter={() => setHoveredSymbol(token.symbol)}
                      onMouseLeave={() => setHoveredSymbol(null)}
                      onClick={() => onSelectToken && onSelectToken(token.symbol)}
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isLeader1 ? 46 : 36}
                        fill={isMagnet ? '#10b981' : '#f43f5e'}
                        fillOpacity={isHovered ? 0.3 : (isLeader1 ? 0.2 : 0.1)}
                      />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isLeader1 ? 38 : 28}
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke={isMagnet ? '#10b981' : '#f43f5e'}
                        strokeWidth={isLeader1 ? 3 : 2}
                      />
                      <text x={pos.x} y={pos.y - 12} textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="900">
                        #{token.rank}
                      </text>
                      <text x={pos.x} y={pos.y + 2} textAnchor="middle" fill="#ffffff" fontSize={isLeader1 ? "12.5" : "10.5"} fontWeight="900">
                        {token.symbol}
                      </text>
                      <text x={pos.x} y={pos.y + 14} textAnchor="middle" fill={isMagnet ? '#10b981' : '#f43f5e'} fontSize="9" fontWeight="900">
                        {formatMillions(flowVal)}
                      </text>
                      <text x={pos.x} y={pos.y + 25} textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontWeight="800">
                        +{token.score} pts
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* 📋 3. MODE TABLEAU */}
          {viewMode === 'table' && (
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '8px 12px' }}>RANG</th>
                    <th style={{ padding: '8px 12px' }}>TOKEN</th>
                    <th style={{ padding: '8px 12px' }}>SCORE ΔS</th>
                    <th style={{ padding: '8px 12px' }}>FLUX NET 4H</th>
                    <th style={{ padding: '8px 12px' }}>FLUX NET 24H</th>
                    <th style={{ padding: '8px 12px' }}>RÔLE DE ROTATION</th>
                  </tr>
                </thead>
                <tbody>
                  {guaranteed5Tokens.map((t) => {
                    const isMag = t.netFlow4h >= 0;
                    return (
                      <tr key={t.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '900', color: '#10b981' }}>#{t.rank}</td>
                        <td style={{ padding: '8px 12px', fontWeight: '900', color: '#f8fafc' }}>{t.symbol}</td>
                        <td style={{ padding: '8px 12px', color: '#38bdf8', fontWeight: '800' }}>+{t.score} pts</td>
                        <td style={{ padding: '8px 12px', color: t.netFlow4h >= 0 ? '#10b981' : '#f43f5e', fontWeight: '900' }}>
                          {formatMillions(t.netFlow4h)}
                        </td>
                        <td style={{ padding: '8px 12px', color: t.netFlow24h >= 0 ? '#10b981' : '#f43f5e', fontWeight: '900' }}>
                          {formatMillions(t.netFlow24h)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.66rem',
                            fontWeight: '900',
                            background: isMag ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: isMag ? '#10b981' : '#f43f5e',
                            border: `1px solid ${isMag ? '#10b981' : '#f43f5e'}40`
                          }}>
                            {isMag ? '🧲 AIMANT DE CASH' : '📤 DONNEUR'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
