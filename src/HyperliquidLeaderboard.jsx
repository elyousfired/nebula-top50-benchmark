import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, TrendingUp, DollarSign, Activity, ChevronRight, AlertTriangle } from 'lucide-react';

export const HyperliquidLeaderboard = ({ onAnalyze }) => {
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get('https://stats-data.hyperliquid.xyz/Mainnet/vaults');
        if (res.data && Array.isArray(res.data)) {
          // Filter out closed vaults and system vaults (HLP, Liquidator)
          let activeVaults = res.data.filter(v => 
            v.summary && 
            !v.summary.isClosed &&
            !v.summary.name.includes('HLP')
          );
          
          // Sort by TVL descending
          activeVaults.sort((a, b) => parseFloat(b.summary.tvl || 0) - parseFloat(a.summary.tvl || 0));
          
          // Take Top 100
          const top100 = activeVaults.slice(0, 100);

          // Fetch Win Rates for Top 100
          const batchSize = 10;
          for (let i = 0; i < top100.length; i += batchSize) {
            const batch = top100.slice(i, i + batchSize);
            await Promise.all(batch.map(async (vault) => {
               try {
                  const fillsRes = await axios.post('https://api.hyperliquid.xyz/info', { 
                    type: 'userFills', 
                    user: vault.summary.vaultAddress 
                  });
                  let wins = 0, losses = 0;
                  if (fillsRes.data && Array.isArray(fillsRes.data)) {
                     fillsRes.data.forEach(f => {
                        const pnl = parseFloat(f.closedPnl || "0");
                        if (pnl > 0) wins++;
                        else if (pnl < 0) losses++;
                     });
                  }
                  const totalTrades = wins + losses;
                  vault.winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
               } catch (e) {
                  vault.winRate = 0;
               }
            }));
          }
          
          setVaults(top100);
        }
      } catch (err) {
        console.error("Error fetching vaults:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const getPnl = (vault) => {
    if (!vault.pnls) return 0;
    const allTimeData = vault.pnls.find(p => p[0] === 'allTime');
    if (allTimeData && allTimeData[1] && allTimeData[1].length > 0) {
      return parseFloat(allTimeData[1][allTimeData[1].length - 1]);
    }
    return 0;
  };

  const formatMoney = (val) => {
    if (Math.abs(val) >= 1e6) {
      return (val / 1e6).toFixed(2) + 'M';
    } else if (Math.abs(val) >= 1e3) {
      return (val / 1e3).toFixed(2) + 'K';
    }
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#00e676' }}>
        <Activity size={48} style={{ animation: 'pulse 1.5s infinite', marginBottom: '20px' }} />
        <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>SYNCHRONISATION DU LEADERBOARD...</span>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '2rem', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
        <Trophy size={32} color="#f59e0b" />
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>Top 100 Traders Mondiaux (Hyperliquid)</h2>
          <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
            Classement strict et en temps réel basé sur les capitaux gérés (TVL). Données on-chain certifiées.
          </p>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>
            <th style={{ padding: '15px 10px', width: '60px', textAlign: 'center' }}>Rang</th>
            <th style={{ padding: '15px 10px' }}>Nom du Vault</th>
            <th style={{ padding: '15px 10px', textAlign: 'right' }}>TVL (Capitaux)</th>
            <th style={{ padding: '15px 10px', textAlign: 'right' }}>APR (Rendement)</th>
            <th style={{ padding: '15px 10px', textAlign: 'right' }}>PnL All-Time</th>
            <th style={{ padding: '15px 10px', textAlign: 'center' }}>Win Rate</th>
            <th style={{ padding: '15px 10px', textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {vaults.map((v, idx) => {
            const pnl = getPnl(v);
            const tvl = parseFloat(v.summary.tvl || 0);
            const apr = (v.apr || 0) * 100;
            const winRate = v.winRate || 0;
            const isTop3 = idx < 3;
            
            return (
              <tr 
                key={v.summary.vaultAddress} 
                style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.05)', 
                  transition: 'background 0.2s',
                  background: isTop3 ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                }}
                onMouseOver={e => e.currentTarget.style.background = isTop3 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = isTop3 ? 'rgba(245, 158, 11, 0.05)' : 'transparent'}
              >
                <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: idx === 0 ? '#f59e0b' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#b45309' : '#64748b' }}>
                  #{idx + 1}
                </td>
                <td style={{ padding: '15px 10px', fontWeight: 600, color: '#e2e8f0' }}>
                  {v.summary.name}
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'normal', marginTop: '4px' }}>
                    {v.summary.vaultAddress.substring(0,6)}...{v.summary.vaultAddress.substring(38)}
                  </div>
                </td>
                <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                  ${formatMoney(tvl)}
                </td>
                <td style={{ padding: '15px 10px', textAlign: 'right', color: apr >= 0 ? '#00e676' : '#ef4444' }}>
                  {apr > 0 ? '+' : ''}{apr.toFixed(2)}%
                </td>
                <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 'bold', color: pnl >= 0 ? '#00e676' : '#ef4444' }}>
                  {pnl > 0 ? '+' : ''}${formatMoney(pnl)}
                </td>
                <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: winRate >= 55 ? '#00e676' : winRate > 0 ? '#f59e0b' : '#64748b' }}>
                  {winRate > 0 ? `${winRate}%` : 'N/A'}
                </td>
                <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                  <button 
                    onClick={() => onAnalyze(v.summary.vaultAddress)}
                    style={{ 
                      background: 'rgba(0, 230, 118, 0.1)', 
                      border: '1px solid #00e676', 
                      color: '#00e676', 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.8rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#00e676'; e.currentTarget.style.color = '#000'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(0, 230, 118, 0.1)'; e.currentTarget.style.color = '#00e676'; }}
                  >
                    Analyser <ChevronRight size={14} />
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
