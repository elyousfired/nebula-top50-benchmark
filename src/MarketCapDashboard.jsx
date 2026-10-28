import React, { useState, useEffect } from 'react';
import { Activity, Globe, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { fetchCoinGeckoTop100, buildMacroIndex } from './logic/macroIndexEngine';

const Sparkline = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 30;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export default function MarketCapDashboard() {
  const [loading, setLoading] = useState(true);
  const [indexData, setIndexData] = useState(null);
  const [solToday, setSolToday] = useState(0);
  const [timeframe, setTimeframe] = useState('6M');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const data = await fetchCoinGeckoTop100();
      if (!isMounted) return;
      if (data && data.length > 0) {
        const solToken = data.find(c => c.symbol.toLowerCase() === 'sol');
        if (solToken) setSolToday(solToken.price_change_percentage_24h || 0);

        const macro = await buildMacroIndex(data, 180);
        if (isMounted) setIndexData(macro);
      }
      setLoading(false);
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const formatMC = (num) => {
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
    return '$' + num.toLocaleString();
  };

  const getTimeframeMetrics = (c) => {
    switch(timeframe) {
       case 'Today': return { growth: c.price_change_percentage_24h, solGrowth: solToday, out: (c.price_change_percentage_24h || 0) - solToday };
       case '1D': return { growth: c.growth1D, solGrowth: indexData.solGrowth.g1D, out: c.outperformance1D };
       case '1W': return { growth: c.growth1W, solGrowth: indexData.solGrowth.g1W, out: c.outperformance1W };
       case '1M': return { growth: c.growth1M, solGrowth: indexData.solGrowth.g1M, out: c.outperformance1M };
       case '6M': default: return { growth: c.growth6M, solGrowth: indexData.solGrowth.g6M, out: c.outperformance6M };
    }
  };

  const sortedTokens = indexData ? [...indexData.rankedTokens].sort((a, b) => {
     return getTimeframeMetrics(b).out - getTimeframeMetrics(a).out;
  }) : [];

  const renderTimeframeButton = (label) => {
     const active = timeframe === label;
     return (
       <button 
         onClick={() => setTimeframe(label)}
         style={{
           padding: '6px 16px', background: active ? '#00d0ff' : 'rgba(30,41,59,0.5)',
           color: active ? '#000' : '#94a3b8', border: 'none', borderRadius: '8px',
           fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
         }}>
         {label}
       </button>
     );
  };

  let currentSolGrowth = 0;
  if (indexData) {
     if (timeframe === 'Today') currentSolGrowth = solToday;
     else if (timeframe === '1D') currentSolGrowth = indexData.solGrowth.g1D;
     else if (timeframe === '1W') currentSolGrowth = indexData.solGrowth.g1W;
     else if (timeframe === '1M') currentSolGrowth = indexData.solGrowth.g1M;
     else currentSolGrowth = indexData.solGrowth.g6M;
  }

  return (
    <div style={{ padding: '2rem', color: '#fff', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#00d0ff', margin: 0, fontSize: '2.5rem' }}>
          <Target size={36} /> OUTPERFORMANCE SCANNER (vs SOL)
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginTop: '8px' }}>
          Classement des {indexData?.rankedTokens?.length || '...'} plus gros altcoins selon leur accélération face à Solana.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '500px', background: '#0a0f1c', borderRadius: '16px', border: '1px solid #1e293b' }}>
          <Activity size={48} color="#00ff88" className="spin" style={{ marginBottom: '24px' }} />
          <h3 style={{ margin: 0, color: '#fff' }}>Calcul des Deltas de Surperformance...</h3>
          <p style={{ color: '#94a3b8', maxWidth: '600px', textAlign: 'center', marginTop: '12px' }}>
            L'algorithme analyse l'évolution de chaque token du Top 100 sur 180 jours et la compare à celle du SOL.
          </p>
        </div>
      ) : (
        <div style={{ background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(0, 208, 255, 0.3)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Classement d'Accélération</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                 {renderTimeframeButton('Today')}
                 {renderTimeframeButton('1D')}
                 {renderTimeframeButton('1W')}
                 {renderTimeframeButton('1M')}
                 {renderTimeframeButton('6M')}
              </div>
            </div>
            <div style={{ background: 'rgba(0, 208, 255, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(0, 208, 255, 0.3)', fontSize: '0.9rem' }}>
              Croissance SOL ({timeframe}) : <strong style={{ color: '#00d0ff' }}>{currentSolGrowth > 0 ? '+' : ''}{(currentSolGrowth || 0).toFixed(2)}%</strong>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px' }}>Rang Local</th>
                  <th style={{ padding: '12px 16px' }}>Token</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Prix Actuel</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Market Cap</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Croissance Token ({timeframe})</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', background: 'rgba(0,255,136,0.05)', color: '#00ff88' }}>⚡ SURPERFORMANCE vs SOL</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Sparkline (7J)</th>
                </tr>
              </thead>
              <tbody>
                {sortedTokens.map((c, i) => {
                  const metrics = getTimeframeMetrics(c);
                  const isOutperforming = metrics.out > 0;
                  return (
                    <tr key={c.cgId} style={{ borderBottom: '1px solid #1e293b', transition: 'background 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = '#1e293b'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '16px', color: '#64748b', fontWeight: 'bold' }}>#{i + 1}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img src={c.image} alt={c.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                          <div>
                            <div style={{ fontWeight: 'bold', color: '#fff' }}>{c.symbol.replace('USDT','')}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                        ${c.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold', color: '#cbd5e1' }}>
                        {formatMC(c.market_cap)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold', color: metrics.growth >= 0 ? '#14F195' : '#ef4444' }}>
                        {metrics.growth > 0 ? '+' : ''}{(metrics.growth || 0).toFixed(2)}%
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontWeight: '900', fontSize: '1.1rem', background: isOutperforming ? 'rgba(0,255,136,0.05)' : 'rgba(239,68,68,0.05)', color: isOutperforming ? '#00ff88' : '#ef4444' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {isOutperforming ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                          {isOutperforming ? '+' : ''}{(metrics.out || 0).toFixed(2)}%
                        </div>
                      </td>
                      <td style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
                        <Sparkline data={c.sparkline_in_7d?.price} color={c.price_change_percentage_24h >= 0 ? '#14F195' : '#ef4444'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
