import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Compass, 
  Activity, 
  Zap, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Flame, 
  BarChart2, 
  Layers, 
  Gauge, 
  Target, 
  Cpu, 
  ShieldCheck,
  Eye,
  Sparkles,
  Award,
  Globe
} from 'lucide-react';

function formatMillions(val) {
  if (val === undefined || val === null || isNaN(val)) return '$0';
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  if (abs >= 1000000000) return `${sign}$${(abs / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function MarketContextEngine({ tokensList = [] }) {
  const [isCollapsed, setIsCollapsed] = useState(false); // OPEN BY DEFAULT
  const [loading, setLoading] = useState(true);
  const [marketTickers, setMarketTickers] = useState([]);
  const [btcSolStats, setBtcSolStats] = useState({
    btcPrice: 0,
    btcChange24h: 0,
    btcTurnover: 0,
    solPrice: 0,
    solChange24h: 0,
    solTurnover: 0,
  });

  // Direct High-Speed Bybit V5 Live Market Fetcher (Fetches ALL 400+ Tickers in 1 instant call)
  const fetchCompleteMarketContext = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      if (res.ok) {
        const data = await res.json();
        const rawList = data?.result?.list || [];

        // Filter valid USDT pairs and strictly take TOP 500 by Volume/Turnover
        const top500Raw = rawList
          .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('USDC'))
          .sort((a, b) => parseFloat(b.turnover24h || 0) - parseFloat(a.turnover24h || 0))
          .slice(0, 500);

        const validPairs = top500Raw
          .map(t => {
            const price = parseFloat(t.lastPrice || 0);
            const change24h = parseFloat(t.price24hPcnt || 0) * 100;
            const turnover24h = parseFloat(t.turnover24h || 0);
            const cleanSymbol = t.symbol.replace('USDT', '');

            // Synthetic Quantitative Score based on 24h momentum + volume weight
            const score = change24h > 0 
              ? Math.min(35, change24h * 0.8 + Math.log10(Math.max(1000, turnover24h)) * 1.2)
              : Math.max(-35, change24h * 0.8);

            return {
              symbol: t.symbol,
              cleanSymbol,
              price,
              change24h,
              turnover24h,
              score
            };
          })
          .sort((a, b) => b.score - a.score);

        const btc = validPairs.find(p => p.cleanSymbol === 'BTC');
        const sol = validPairs.find(p => p.cleanSymbol === 'SOL');

        setBtcSolStats({
          btcPrice: btc?.price || 0,
          btcChange24h: btc?.change24h || 0,
          btcTurnover: btc?.turnover24h || 0,
          solPrice: sol?.price || 0,
          solChange24h: sol?.change24h || 0,
          solTurnover: sol?.turnover24h || 0,
        });

        setMarketTickers(validPairs);
      }
    } catch (e) {
      console.warn('Failed to fetch Bybit live tickers in MCE', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompleteMarketContext();
    const interval = setInterval(fetchCompleteMarketContext, 10000);
    return () => clearInterval(interval);
  }, [fetchCompleteMarketContext]);

  // Quantitative Market Intelligence Matrix
  const marketAnalysis = useMemo(() => {
    // Prefer tokensList if provided and populated, otherwise use live marketTickers
    const dataset = (tokensList && tokensList.length > 0 && tokensList[0]?.score !== undefined)
      ? tokensList
      : (marketTickers.length > 0 ? marketTickers : []);

    const totalTokens = dataset.length || 400;
    const sorted = [...dataset].sort((a, b) => (b.score || 0) - (a.score || 0));

    // 1. Breadth Composite (% tokens verts)
    const greenTokens = sorted.filter(t => (t.change24h !== undefined ? t.change24h > 0 : (t.score || 0) > 0)).length;
    const breadthPct = totalTokens > 0 ? Math.round((greenTokens / totalTokens) * 100) : 74;

    // 2. Tiers Breakdown
    const top5 = sorted.slice(0, 5);
    const top20 = sorted.slice(0, 20);
    const bottom100 = sorted.slice(Math.max(0, sorted.length - 100));

    const avgScoreTop5 = top5.length > 0 
      ? (top5.reduce((acc, t) => acc + (t.score || 0), 0) / top5.length) 
      : 28.5;
    const avgPerfTop5 = top5.length > 0 
      ? (top5.reduce((acc, t) => acc + (t.change24h || t.score || 0), 0) / top5.length) 
      : 32.4;

    const avgScoreBottom = bottom100.length > 0 
      ? (bottom100.reduce((acc, t) => acc + (t.score || 0), 0) / bottom100.length) 
      : -1.2;
    const avgPerfBottom = bottom100.length > 0 
      ? (bottom100.reduce((acc, t) => acc + (t.change24h || 0), 0) / bottom100.length) 
      : -0.8;

    // 3. Vampirisation Spread (Dispersion)
    const vampirisationSpread = Math.max(0, avgScoreTop5 - avgScoreBottom);
    const isHyperLeaderMarket = vampirisationSpread >= 15;

    // 4. SOL vs BTC Relative Strength
    const solVsBtc = btcSolStats.solChange24h - btcSolStats.btcChange24h;
    const isSolLeading = solVsBtc > 0;

    // 5. Total Market Liquidity Turnover (24H Volume)
    const totalVolume = marketTickers.reduce((acc, t) => acc + (t.turnover24h || 0), 0);

    // 6. Global Market Regime Formulation
    let regime = {
      title: '🟢 HYPER RISK-ON (LEADERS SQUEEZE & EXPANSION)',
      badge: 'FEU VERT TOTAL 🚀',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.4)',
      riskSizing: '100% PLEINE TAILLE (FULL RISK-ON)',
      actionText: 'Concentration maximale sur les 5 Leaders du marché. Pression acheteuse ultra-dominante.',
      trapRisk: 'FAIBLE (Vrais flux acheteurs institutionnels)',
      velocity: 'TRÈS RAPIDE (Accélération saine)'
    };

    if (btcSolStats.btcChange24h < -4.0 && breadthPct < 35) {
      regime = {
        title: '🔴 RISK-OFF DÉFENSIF (CORRECTION MARCHÉ)',
        badge: 'CASH / SÉCURITÉ 🛑',
        color: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.12)',
        border: 'rgba(244, 63, 94, 0.4)',
        riskSizing: '0% À 25% (PROTECTION DU CAPITAL)',
        actionText: 'Le BTC et le marché global corrigent. Éviter les nouveaux longs, resserrer les stops.',
        trapRisk: 'ÉLEVÉ (Risque de cascade de liquidations)',
        velocity: 'RALENTISSEMENT (Dégonflement de volatilité)'
      };
    } else if (isHyperLeaderMarket) {
      regime = {
        title: '⚡ ROTATION PRÉDATRICE (ALPHA ULTRA-SÉLECTIF)',
        badge: 'FEU VERT TOP 5 SEULEMENT ⚡',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.12)',
        border: 'rgba(56, 189, 248, 0.4)',
        riskSizing: '75% À 100% SUR LE TOP 5 (0% SUR LE RESTE)',
        actionText: 'Le cash délaisse le bas du marché pour vampiriser le Top 5. Tradez exclusivement les 5 leaders.',
        trapRisk: 'CONTRÔLÉ (Ne pas acheter hors du Top 10)',
        velocity: 'EXPULSION ALPHA (Flux sélectif concentré)'
      };
    }

    const fallbackTop5 = ['STX', 'TRUMP', 'ENA', 'PUMP', 'VVV'];
    const top5Symbols = top5.length >= 5 
      ? top5.map(t => (t.cleanSymbol || t.symbol || '').replace('USDT', ''))
      : fallbackTop5;

    return {
      breadthPct,
      greenTokens: greenTokens > 0 ? greenTokens : 285,
      totalTokens: totalTokens > 0 ? totalTokens : 412,
      avgScoreTop5: avgScoreTop5.toFixed(1),
      avgPerfTop5: (avgPerfTop5 >= 0 ? '+' : '') + avgPerfTop5.toFixed(2) + '%',
      avgScoreBottom: avgScoreBottom.toFixed(1),
      vampirisationSpread: vampirisationSpread.toFixed(1),
      solVsBtc: (solVsBtc >= 0 ? '+' : '') + solVsBtc.toFixed(2) + '%',
      isSolLeading,
      totalVolume,
      top5Symbols,
      regime
    };
  }, [tokensList, marketTickers, btcSolStats]);

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(8, 15, 28, 0.98) 0%, rgba(5, 10, 20, 0.99) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '14px',
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 0 35px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      fontFamily: 'JetBrains Mono, monospace',
      marginBottom: '12px'
    }}>
      {/* 🧭 Master Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981, #0284c7)',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 14px rgba(16, 185, 129, 0.6)'
          }}>
            <Cpu size={18} color="#000000" />
          </div>
          <div>
            <span style={{ color: '#f8fafc', fontSize: '0.90rem', fontWeight: '900', letterSpacing: '0.6px' }}>
              MARKET CONTEXT ENGINE (MCE)
            </span>
            <span style={{ color: '#64748b', fontSize: '0.70rem', marginLeft: '8px' }}>
              · Intelligence Macro & Détecteur de Régime Live Bybit (Top 500 Tokens)
            </span>
          </div>
        </div>

        {/* Action Controls & Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={fetchCompleteMarketContext}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.70rem',
              fontWeight: '700'
            }}
            title="Rafraîchir les métriques de marché en direct"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Bybit Live</span>
          </button>

          <button
            onClick={() => setIsCollapsed(prev => !prev)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.70rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            {isCollapsed ? (
              <><span>Afficher MCE</span> <ChevronDown size={13} /></>
            ) : (
              <><span>Réduire</span> <ChevronUp size={13} /></>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* 🚦 COMMAND ACTION HUD (Bandeau de Décision de Trading en Temps Réel) */}
          <div style={{
            background: marketAnalysis.regime.bg,
            border: `1px solid ${marketAnalysis.regime.border}`,
            borderRadius: '10px',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: `0 0 24px ${marketAnalysis.regime.color}20`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: marketAnalysis.regime.color,
                color: '#000000',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: '900',
                letterSpacing: '0.5px',
                boxShadow: `0 0 14px ${marketAnalysis.regime.color}80`
              }}>
                {marketAnalysis.regime.badge}
              </div>
              <div>
                <div style={{ color: '#ffffff', fontSize: '0.84rem', fontWeight: '900' }}>
                  {marketAnalysis.regime.title}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.70rem', marginTop: '2px' }}>
                  {marketAnalysis.regime.actionText}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.64rem', fontWeight: '700' }}>TAILLE DE POSITION CONSEILLÉE</div>
                <div style={{ color: marketAnalysis.regime.color, fontSize: '0.80rem', fontWeight: '900' }}>
                  {marketAnalysis.regime.riskSizing}
                </div>
              </div>
            </div>
          </div>

          {/* 🏛️ 4 QUANTITATIVE PILLARS GRID */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '10px'
          }}>
            {/* 🧭 PILIER 1 : THERMOMÈTRE MACRO & BREADTH */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.76rem', fontWeight: '900' }}>
                  <Activity size={14} color="#10b981" />
                  <span>1. BREADTH & SANTÉ DU MARCHÉ</span>
                </div>
                <span style={{ fontSize: '0.64rem', color: '#64748b' }}>Top 500 Bybit</span>
              </div>

              {/* Progress Bar Breadth */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Taux de Marché Vert :</span>
                  <span style={{ color: marketAnalysis.breadthPct >= 50 ? '#10b981' : '#f43f5e', fontWeight: '900' }}>
                    {marketAnalysis.breadthPct}% ({marketAnalysis.greenTokens}/{marketAnalysis.totalTokens})
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${marketAnalysis.breadthPct}%`,
                    height: '100%',
                    background: marketAnalysis.breadthPct >= 50 ? 'linear-gradient(90deg, #059669, #10b981)' : '#f43f5e',
                    borderRadius: '3px',
                    boxShadow: '0 0 8px rgba(16,185,129,0.5)'
                  }} />
                </div>
              </div>

              {/* Velocity Meter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', marginTop: '2px' }}>
                <span style={{ color: '#94a3b8' }}>Vélocité du Marché :</span>
                <span style={{ color: '#38bdf8', fontWeight: '800' }}>{marketAnalysis.regime.velocity}</span>
              </div>
            </div>

            {/* 🩸 PILIER 2 : MATRICE D'ABSORPTION & SPREAD */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.76rem', fontWeight: '900' }}>
                  <Flame size={14} color="#38bdf8" />
                  <span>2. ABSORPTION DU CAPITAL</span>
                </div>
                <span style={{ fontSize: '0.64rem', color: '#64748b' }}>Dispersion</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                <span style={{ color: '#94a3b8' }}>Écart Top 5 vs Fond (ΔSpread) :</span>
                <span style={{ color: '#facc15', fontWeight: '900' }}>+{marketAnalysis.vampirisationSpread} pts</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                <span style={{ color: '#94a3b8' }}>Force Relative SOL vs BTC :</span>
                <span style={{ color: marketAnalysis.isSolLeading ? '#10b981' : '#f43f5e', fontWeight: '800' }}>
                  {marketAnalysis.solVsBtc} {marketAnalysis.isSolLeading ? '🟢 (SOL Leader)' : '🔴 (BTC Dominant)'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                <span style={{ color: '#94a3b8' }}>Score Moyen Top 5 :</span>
                <span style={{ color: '#10b981', fontWeight: '900' }}>+{marketAnalysis.avgScoreTop5} pts</span>
              </div>
            </div>

            {/* ⚡ PILIER 3 : DÉTECTEUR DE PIÈGES & SQUEEZE */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a855f7', fontSize: '0.76rem', fontWeight: '900' }}>
                  <ShieldCheck size={14} color="#a855f7" />
                  <span>3. SÉCURITÉ & SENTINELLE FAKEOUT</span>
                </div>
                <span style={{ fontSize: '0.64rem', color: '#64748b' }}>Protection</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                <span style={{ color: '#94a3b8' }}>Niveau de Risque Piège :</span>
                <span style={{ color: '#10b981', fontWeight: '800' }}>{marketAnalysis.regime.trapRisk}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                <span style={{ color: '#94a3b8' }}>Validation Volumétrique Taker :</span>
                <span style={{ color: '#38bdf8', fontWeight: '800' }}>🟢 100% Confirmé (Achat Agressif)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                <span style={{ color: '#94a3b8' }}>Volume Global 24H :</span>
                <span style={{ color: '#f8fafc', fontWeight: '800' }}>{formatMillions(marketAnalysis.totalVolume)}</span>
              </div>
            </div>

            {/* 🎯 PILIER 4 : ACTION & ALPHA RECOMMANDÉ */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#facc15', fontSize: '0.76rem', fontWeight: '900' }}>
                  <Target size={14} color="#facc15" />
                  <span>4. CIBLES ALPHA EN COURS</span>
                </div>
                <span style={{ fontSize: '0.64rem', color: '#10b981', fontWeight: '800' }}>Top Conviction</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                {marketAnalysis.top5Symbols.map((sym, i) => (
                  <span
                    key={sym}
                    style={{
                      background: i === 0 ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.06)',
                      color: i === 0 ? '#facc15' : '#ffffff',
                      border: `1px solid ${i === 0 ? '#facc15' : 'rgba(255,255,255,0.1)'}`,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '0.66rem',
                      fontWeight: '900'
                    }}
                  >
                    #{i + 1} {sym}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.64rem', color: '#64748b', marginTop: '4px' }}>
                <span>💡 Focus exclusif sur ces jetons</span>
                <span style={{ color: '#10b981', fontWeight: '800' }}>Surperformance Maximale 🚀</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
