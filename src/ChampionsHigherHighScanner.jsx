import React, { useState, useMemo } from 'react';
import { 
  Trophy, Target, Flame, Zap, ArrowUpRight, TrendingUp, ChevronRight, 
  Sparkles, AlertCircle, CheckCircle2, ShieldCheck, Clock, Calendar, ListOrdered
} from 'lucide-react';

export default function ChampionsHigherHighScanner({ tokensList = [], onSelectToken }) {
  const [activeTab, setActiveTab] = useState('30d'); // 'all' | '30d' | '7d' | '24h'
  const [limitCount, setLimitCount] = useState(10);  // 10 par défaut ou 5

  // Calcul du Top 10 pour chaque horizon (30D, 7D, 24H) avec détection du Higher High (HH)
  const horizonsData = useMemo(() => {
    if (!tokensList || tokensList.length === 0) return null;

    const validTokens = tokensList.filter(t => (t.ratioSeries && t.ratioSeries.length >= 10) || (t.rawUsdtSeries && t.rawUsdtSeries.length >= 10));
    if (validTokens.length === 0) return null;

    // Fonction d'analyse d'un token pour un horizon donné
    const analyzeTokenForHorizon = (t, candleCount, label) => {
      // Filtrer les symboles actions synthétiques
      const isStockSynthetic = t.cleanSymbol.endsWith('X') && ['AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'GOOGL', 'META'].some(s => t.cleanSymbol.startsWith(s));
      if (isStockSynthetic) return null;

      const raw = t.ratioSeries || t.rawUsdtSeries || [];
      const sliced = raw.slice(Math.max(0, raw.length - candleCount));
      const len = sliced.length;
      if (len < 4) return null;

      const startClose = typeof sliced[0] === 'object' ? sliced[0].close : sliced[0];
      const curClose = typeof sliced[len - 1] === 'object' ? sliced[len - 1].close : sliced[len - 1];
      const perfPct = startClose > 0 ? ((curClose - startClose) / startClose) * 100 : 0;

      // Trouver le Higher High (HH) absolu sur la période
      let hhPrice = startClose;
      let hhCandleIdx = 0;

      sliced.forEach((c, idx) => {
        const high = typeof c === 'object' ? (c.high || c.close) : c;
        if (high > hhPrice) {
          hhPrice = high;
          hhCandleIdx = idx;
        }
      });

      // Distance au HH en pourcentage
      const distToHhPct = hhPrice > 0 ? parseFloat((((curClose - hhPrice) / hhPrice) * 100).toFixed(2)) : 0;

      // Détection de l'alerte Signal HH
      let hhSignal = {
        label: '💤 EN REPLI SAIN',
        badge: 'CONSOLIDATION',
        color: '#94a3b8',
        isBreakout: false
      };

      if (distToHhPct >= -0.5) {
        hhSignal = {
          label: '🚨 BREAKOUT DU HH EN DIRECT !',
          badge: 'NOUVEAU SOMMET (ATH/HH)',
          color: '#00ff88',
          isBreakout: true
        };
      } else if (distToHhPct >= -5.0) {
        hhSignal = {
          label: '⚡ ATTAQUE IMMINENTE DU HH',
          badge: 'TEST DE LA RÉSISTANCE (<5%)',
          color: '#facc15',
          isBreakout: false
        };
      }

      return {
        symbol: t.cleanSymbol,
        token: t,
        price: curClose,
        perfPct: parseFloat(perfPct.toFixed(2)),
        score: t.score || 0,
        hhPrice: parseFloat(hhPrice.toFixed(hhPrice < 0.01 ? 6 : 4)),
        distToHhPct,
        hhSignal,
        candlesCount: len
      };
    };

    // 1. TOP 10 DU MOIS (30 JOURS = 1000 BOUGIES 15M)
    const list30d = validTokens
      .map(t => analyzeTokenForHorizon(t, 1000, '30D'))
      .filter(Boolean)
      .sort((a, b) => b.perfPct - a.perfPct)
      .slice(0, limitCount);

    // 2. TOP 10 DE LA SEMAINE (7 JOURS = 672 BOUGIES 15M)
    const list7d = validTokens
      .map(t => analyzeTokenForHorizon(t, 672, '7D'))
      .filter(Boolean)
      .sort((a, b) => b.perfPct - a.perfPct)
      .slice(0, limitCount);

    // 3. TOP 10 DES DERNIÈRES 24 HEURES (24H = 96 BOUGIES 15M)
    const list24h = validTokens
      .map(t => analyzeTokenForHorizon(t, 96, '24H'))
      .filter(Boolean)
      .sort((a, b) => b.perfPct - a.perfPct)
      .slice(0, limitCount);

    return {
      top30d: list30d,
      top7d: list7d,
      top24h: list24h
    };
  }, [tokensList, limitCount]);

  if (!horizonsData) return null;

  const { top30d, top7d, top24h } = horizonsData;

  const renderTableForHorizon = (title, icon, list, horizonBadge) => (
    <div style={{
      background: 'rgba(3, 7, 18, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <strong style={{ color: '#fff', fontSize: '0.96rem' }}>{title}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: 'rgba(255,255,255,0.06)',
            color: '#cbd5e1',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.68rem',
            fontWeight: '900'
          }}>
            {horizonBadge} ({list.length} TOKENS)
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ padding: '8px 10px' }}>#</th>
              <th style={{ padding: '8px 10px' }}>TOKEN</th>
              <th style={{ padding: '8px 10px' }}>GAIN %</th>
              <th style={{ padding: '8px 10px' }}>PRIX ACTUEL</th>
              <th style={{ padding: '8px 10px' }}>DERNIER HH</th>
              <th style={{ padding: '8px 10px' }}>ÉCART AU HH</th>
              <th style={{ padding: '8px 10px' }}>SIGNAL</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item, idx) => (
              <tr
                key={item.symbol}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: item.distToHhPct >= -0.5 ? 'rgba(0, 255, 136, 0.08)' : idx < 3 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  transition: 'background 0.2s ease'
                }}
              >
                <td style={{ padding: '10px', color: idx === 0 ? '#facc15' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#fb923c' : '#888', fontWeight: '900' }}>
                  {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                </td>
                <td style={{ padding: '10px' }}>
                  <strong style={{ color: '#fff', fontSize: '0.90rem' }}>{item.symbol}</strong>
                </td>
                <td style={{ padding: '10px', color: item.perfPct >= 0 ? '#00ff88' : '#ef4444', fontWeight: 'bold' }}>
                  {item.perfPct >= 0 ? '+' : ''}{item.perfPct}%
                </td>
                <td style={{ padding: '10px', color: '#cbd5e1' }}>
                  ${item.price.toFixed(item.price < 0.01 ? 6 : 4)}
                </td>
                <td style={{ padding: '10px', color: '#facc15', fontWeight: 'bold' }}>
                  ${item.hhPrice}
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{
                    color: item.distToHhPct >= -0.5 ? '#00ff88' : item.distToHhPct >= -5.0 ? '#facc15' : '#fb923c',
                    fontWeight: '900'
                  }}>
                    {item.distToHhPct >= 0 ? '0.0%' : `${item.distToHhPct}%`}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{
                    background: `${item.hhSignal.color}15`,
                    color: item.hhSignal.color,
                    border: `1px solid ${item.hhSignal.color}40`,
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontSize: '0.66rem',
                    fontWeight: '900'
                  }}>
                    {item.hhSignal.label}
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  <button
                    onClick={() => onSelectToken && onSelectToken(item.symbol)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.70rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    CHARTE ➔
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(8, 14, 28, 0.98) 0%, rgba(3, 7, 18, 0.99) 100%)',
      border: '2px solid rgba(0, 210, 255, 0.35)',
      borderRadius: '16px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      boxShadow: '0 0 35px rgba(0, 210, 255, 0.12)'
    }}>
      {/* 👑 1. HEADER DU SCANNER HH */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #00d2ff, #0077ff)',
            padding: '10px',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(0, 210, 255, 0.5)'
          }}>
            <Target size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#00d2ff', letterSpacing: '0.5px' }}>
                🎯 SCANNER DES CHAMPIONS TOP {limitCount} & BREAKOUT DU HIGHER HIGH (HH)
              </h2>
              <span style={{ background: 'rgba(0, 210, 255, 0.15)', color: '#00d2ff', border: '1px solid rgba(0, 210, 255, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '900' }}>
                MACRO & SWING LEADERBOARD
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              رصد توب 10 الشهر والأسبوع واليوم مع قياس المسافة الفاصلة عن كسر القمة السابقة (HH Breakout Signal)
            </p>
          </div>
        </div>

        {/* ONGLETS HORIZONS & SELECTEUR TOP 10 / TOP 5 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('30d')}
              style={{
                background: activeTab === '30d' ? 'linear-gradient(135deg, #00d2ff, #0077ff)' : 'transparent',
                color: activeTab === '30d' ? '#fff' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              🌕 TOP {limitCount} MOIS (30D)
            </button>
            <button
              onClick={() => setActiveTab('7d')}
              style={{
                background: activeTab === '7d' ? 'linear-gradient(135deg, #00d2ff, #0077ff)' : 'transparent',
                color: activeTab === '7d' ? '#fff' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              📅 TOP {limitCount} SEMAINE (7D)
            </button>
            <button
              onClick={() => setActiveTab('24h')}
              style={{
                background: activeTab === '24h' ? 'linear-gradient(135deg, #00d2ff, #0077ff)' : 'transparent',
                color: activeTab === '24h' ? '#fff' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              🕒 TOP {limitCount} 24 HEURES
            </button>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                background: activeTab === 'all' ? 'linear-gradient(135deg, #00d2ff, #0077ff)' : 'transparent',
                color: activeTab === 'all' ? '#fff' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              👑 VUE 3 HORIZONS
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setLimitCount(10)}
              style={{
                background: limitCount === 10 ? '#00d2ff' : 'transparent',
                color: limitCount === 10 ? '#000' : '#888',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              TOP 10
            </button>
            <button
              onClick={() => setLimitCount(5)}
              style={{
                background: limitCount === 5 ? '#00d2ff' : 'transparent',
                color: limitCount === 5 ? '#000' : '#888',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              TOP 5
            </button>
          </div>
        </div>
      </div>

      {/* 🎴 2. AFFICHAGE DES TABLEAUX */}
      {activeTab === 'all' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {renderTableForHorizon(`TOP ${limitCount} DU DERNIER MOIS (MACRO CHAMPIONS)`, <Trophy size={18} color="#00d2ff" />, top30d, '🌕 30 JOURS')}
          {renderTableForHorizon(`TOP ${limitCount} DE LA DERNIÈRE SEMAINE (SWING RE-BREAKOUT)`, <Calendar size={18} color="#facc15" />, top7d, '📅 7 JOURS')}
          {renderTableForHorizon(`TOP ${limitCount} DES DERNIÈRES 24 HEURES (INTRADAY BREAKOUT)`, <Zap size={18} color="#00ff88" />, top24h, '🕒 24 HEURES')}
        </div>
      ) : activeTab === '30d' ? (
        renderTableForHorizon(`TOP ${limitCount} DU DERNIER MOIS (MACRO CHAMPIONS)`, <Trophy size={18} color="#00d2ff" />, top30d, '🌕 30 JOURS')
      ) : activeTab === '7d' ? (
        renderTableForHorizon(`TOP ${limitCount} DE LA DERNIÈRE SEMAINE (SWING RE-BREAKOUT)`, <Calendar size={18} color="#facc15" />, top7d, '📅 7 JOURS')
      ) : (
        renderTableForHorizon(`TOP ${limitCount} DES DERNIÈRES 24 HEURES (INTRADAY BREAKOUT)`, <Zap size={18} color="#00ff88" />, top24h, '🕒 24 HEURES')
      )}
    </div>
  );
}
