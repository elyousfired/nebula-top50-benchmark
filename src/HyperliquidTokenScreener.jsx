import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Coins, BarChart2, ChevronDown, ChevronUp, User, TrendingUp, X } from 'lucide-react';
import { MarketSentimentChart } from './MarketSentimentChart';

export const HyperliquidTokenScreener = () => {
  const [rawTokens, setRawTokens] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoSync, setAutoSync] = useState(true);
  const [expandedToken, setExpandedToken] = useState(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(100); // Top 100 Vaults
  const [sortBy, setSortBy] = useState('volume'); // 'volume', 'most_long', 'most_short'
  const [filterWinRate, setFilterWinRate] = useState(false); // filter by winRate > 55%
  const [rawSentimentFills, setRawSentimentFills] = useState([]);
  const [sentimentTimeframe, setSentimentTimeframe] = useState('1D'); // '1H', '1D', '1W'
  const [showSentimentModal, setShowSentimentModal] = useState(false);

  const fetchScreenerData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      else setIsSyncing(true);
      
      const vaultRes = await axios.get('https://stats-data.hyperliquid.xyz/Mainnet/vaults');
      let activeVaults = vaultRes.data.filter(v => v.summary && !v.summary.isClosed);
      activeVaults.sort((a, b) => parseFloat(b.summary.tvl || 0) - parseFloat(a.summary.tvl || 0));
      
      const top100 = activeVaults.slice(0, 100);
      if (!isBackground) setTotalCount(top100.length);
      
      let tokenPositions = {};
      let currentScanned = 0;
      let tempSentimentFills = [];

      const batchSize = 10;
      for (let i = 0; i < top100.length; i += batchSize) {
        const batch = top100.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (vault) => {
          const address = vault.summary.vaultAddress;
          try {
            const [stateRes, fillsRes] = await Promise.all([
              axios.post('https://api.hyperliquid.xyz/info', { type: 'clearinghouseState', user: address }),
              axios.post('https://api.hyperliquid.xyz/info', { type: 'userFills', user: address })
            ]);
            
            let wins = 0, losses = 0;
            if (fillsRes.data && Array.isArray(fillsRes.data)) {
               fillsRes.data.forEach(f => {
                  const pnl = parseFloat(f.closedPnl || "0");
                  if (pnl > 0) wins++;
                  else if (pnl < 0) losses++;

                  // Collect raw fills for Sentiment Analysis
                  const isLiq = f.dir === 'Liquidated' || f.isLiquidation || f.type === 'liquidation' || f.liquidation || (f.dir && f.dir.toLowerCase().includes('liquidat'));
                  if (pnl !== 0 || isLiq) {
                    tempSentimentFills.push({
                      time: f.time,
                      pnl: pnl,
                      isLiq: isLiq
                    });
                  }
               });
            }
            const totalTrades = wins + losses;
            const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
            
            const assetPositions = stateRes.data?.assetPositions;
            if (assetPositions && Array.isArray(assetPositions)) {
              assetPositions.forEach(ap => {
                const pos = ap.position;
                const szi = parseFloat(pos.szi);
                if (szi !== 0) {
                  if (!tokenPositions[pos.coin]) {
                    tokenPositions[pos.coin] = { coin: pos.coin, whales: [] };
                  }
                  const isLong = szi > 0;
                  tokenPositions[pos.coin].whales.push({
                    name: vault.summary.name,
                    address,
                    side: isLong ? 'LONG' : 'SHORT',
                    szi: Math.abs(szi),
                    notional: parseFloat(pos.positionValue),
                    winRate
                  });
                }
              });
            }
          } catch(e) {
            console.warn("Could not fetch state for", address);
          }
          
          currentScanned++;
          if (!isBackground) setScannedCount(currentScanned);
        }));
      }

      setRawSentimentFills(tempSentimentFills);
      setRawTokens(tokenPositions);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching screener data:", err);
    } finally {
      if (!isBackground) setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchScreenerData(false);
  }, []);

  useEffect(() => {
    let interval;
    fetchScreenerData();
    interval = setInterval(() => {
      if (autoSync) fetchScreenerData(true);
    }, 300000);
    return () => clearInterval(interval);
  }, [autoSync]);

  // Aggregate sentiment data dynamically based on selected timeframe
  const aggregatedSentimentData = React.useMemo(() => {
    if (!rawSentimentFills || rawSentimentFills.length === 0) return [];
    
    let stats = {};
    rawSentimentFills.forEach(f => {
      const dateObj = new Date(f.time);
      let key;
      let timeVal;

      if (sentimentTimeframe === '1H') {
        dateObj.setMinutes(0, 0, 0);
        key = dateObj.getTime() / 1000; // UNIX timestamp
        timeVal = key;
      } else if (sentimentTimeframe === '1W') {
        // Find the Monday of this week
        const day = dateObj.getUTCDay() || 7;
        dateObj.setUTCDate(dateObj.getUTCDate() + 1 - day);
        key = dateObj.toISOString().split('T')[0];
        timeVal = key;
      } else {
        // 1D (default)
        key = dateObj.toISOString().split('T')[0];
        timeVal = key;
      }

      if (!stats[key]) {
        stats[key] = { time: timeVal, gains: 0, losses: 0, liquidations: 0 };
      }

      if (f.pnl > 0) stats[key].gains++;
      else if (f.pnl < 0) stats[key].losses++;
      if (f.isLiq) stats[key].liquidations++;
    });

    return Object.values(stats).map(s => ({
      time: s.time,
      gains: s.gains,
      losses: s.losses,
      liquidations: s.liquidations,
      netScore: s.gains - s.losses - s.liquidations
    })).sort((a, b) => {
      const timeA = typeof a.time === 'number' ? a.time : new Date(a.time).getTime();
      const timeB = typeof b.time === 'number' ? b.time : new Date(b.time).getTime();
      return timeA - timeB;
    });
  }, [rawSentimentFills, sentimentTimeframe]);

  const sortedTokens = React.useMemo(() => {
    // 1. Filter and Aggregate
    const aggregated = [];
    Object.values(rawTokens).forEach(t => {
       // Filter whales if filterWinRate is true (keep only winRate >= 55%)
       const validWhales = filterWinRate ? t.whales.filter(w => w.winRate >= 55) : t.whales;
       
       if (validWhales.length > 0) {
           let longVol = 0, shortVol = 0, longs = 0, shorts = 0;
           validWhales.forEach(w => {
               if (w.side === 'LONG') { longVol += w.notional; longs++; }
               else { shortVol += w.notional; shorts++; }
           });
           
           // sort whales by notional size for the details view
           validWhales.sort((a,b) => b.notional - a.notional);

           aggregated.push({
               coin: t.coin,
               longVol, shortVol, longs, shorts, whales: validWhales
           });
       }
    });

    // 2. Sort
    if (sortBy === 'volume') {
      aggregated.sort((a, b) => (b.longVol + b.shortVol) - (a.longVol + a.shortVol));
    } else if (sortBy === 'most_long') {
      aggregated.sort((a, b) => {
         const percentA = (a.longVol + a.shortVol) > 0 ? (a.longVol / (a.longVol + a.shortVol)) : 0;
         const percentB = (b.longVol + b.shortVol) > 0 ? (b.longVol / (b.longVol + b.shortVol)) : 0;
         if (percentB === percentA) return (b.longVol + b.shortVol) - (a.longVol + a.shortVol);
         return percentB - percentA;
      });
    } else if (sortBy === 'most_short') {
      aggregated.sort((a, b) => {
         const percentA = (a.longVol + a.shortVol) > 0 ? (a.shortVol / (a.longVol + a.shortVol)) : 0;
         const percentB = (b.longVol + b.shortVol) > 0 ? (b.shortVol / (b.longVol + b.shortVol)) : 0;
         if (percentB === percentA) return (b.longVol + b.shortVol) - (a.longVol + a.shortVol);
         return percentB - percentA;
      });
    }
    
    return aggregated;
  }, [rawTokens, sortBy, filterWinRate]);

  const formatMoney = (val) => {
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return val.toFixed(2);
  };

  const toggleExpand = (coin) => {
    if (expandedToken === coin) {
      setExpandedToken(null);
    } else {
      setExpandedToken(coin);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#00e676' }}>
        <Activity size={50} className="spin-slow" style={{ marginBottom: '20px' }} />
        <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>ANALYSE DES POSITIONS SMART MONEY...</span>
        <span style={{ color: '#94a3b8', marginTop: '10px' }}>Analyse des portefeuilles : {scannedCount} / {totalCount}</span>
        <style dangerouslySetInnerHTML={{__html: `
          .spin-slow { animation: spin 2s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '2rem', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <BarChart2 size={32} color="#00e676" />
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>Analyse par Token (Smart Money)</h2>
            <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Agrége les positions ouvertes des {totalCount} plus grosses Whales mondiales pour dévoiler la direction du marché.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={() => setShowSentimentModal(true)}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              color: '#3b82f6',
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = '#3b82f6'; }}
          >
            <TrendingUp size={16} /> Statistiques de Clôture (Courbes)
          </button>

          {/* Auto Sync Indicator & Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
            <button 
              onClick={() => setAutoSync(!autoSync)}
              style={{
                background: autoSync ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${autoSync ? 'rgba(0, 230, 118, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: autoSync ? '#00e676' : '#94a3b8',
                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: autoSync ? '#00e676' : '#94a3b8', boxShadow: autoSync ? '0 0 8px #00e676' : 'none' }}></div>
              Auto-Sync (5 min)
            </button>
            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
              Dernière M.À.J : {lastUpdated.toLocaleTimeString()}
              {isSyncing && <span style={{ color: '#00e676', fontStyle: 'italic' }}> - Synchronisation...</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
        <button 
          onClick={() => setSortBy('volume')}
          style={{
            background: sortBy === 'volume' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${sortBy === 'volume' ? '#00e676' : 'rgba(255,255,255,0.1)'}`,
            color: sortBy === 'volume' ? '#00e676' : '#94a3b8',
            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>
          📊 Trier par Volume
        </button>
        <button 
          onClick={() => setSortBy('most_long')}
          style={{
            background: sortBy === 'most_long' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${sortBy === 'most_long' ? '#00e676' : 'rgba(255,255,255,0.1)'}`,
            color: sortBy === 'most_long' ? '#00e676' : '#94a3b8',
            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>
          🟢 Plus de Longs
        </button>
        <button 
          onClick={() => setSortBy('most_short')}
          style={{
            background: sortBy === 'most_short' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${sortBy === 'most_short' ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
            color: sortBy === 'most_short' ? '#ef4444' : '#94a3b8',
            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>
          🔴 Plus de Shorts
        </button>
        
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 10px' }}></div>
        
        <button 
          onClick={() => setFilterWinRate(!filterWinRate)}
          style={{
            background: filterWinRate ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${filterWinRate ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
            color: filterWinRate ? '#f59e0b' : '#94a3b8',
            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
          🏆 Traders Rentables Uniquement ({">"}55% Win Rate)
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>
            <th style={{ padding: '15px 10px', width: '60px', textAlign: 'center' }}>#</th>
            <th style={{ padding: '15px 10px' }}>Token</th>
            <th style={{ padding: '15px 10px', textAlign: 'right' }}>Total Volume ($)</th>
            <th style={{ padding: '15px 10px', textAlign: 'center', width: '250px' }}>Sentiment (Long vs Short)</th>
            <th style={{ padding: '15px 10px', textAlign: 'center' }}>Whales Engagées</th>
            <th style={{ padding: '15px 10px', textAlign: 'center' }}>Détails</th>
          </tr>
        </thead>
        <tbody>
          {sortedTokens.map((t, idx) => {
            const totalVol = t.longVol + t.shortVol;
            const longPercent = totalVol > 0 ? (t.longVol / totalVol) * 100 : 0;
            const shortPercent = totalVol > 0 ? (t.shortVol / totalVol) * 100 : 0;
            const isExpanded = expandedToken === t.coin;
            
            return (
              <React.Fragment key={t.coin}>
                <tr 
                  onClick={() => toggleExpand(t.coin)}
                  style={{ 
                    borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.05)', 
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '15px 10px', fontWeight: 900, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Coins size={16} color="#00b8cc" /> {t.coin}
                  </td>
                  <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                    ${formatMoney(totalVol)}
                  </td>
                  
                  <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                    {/* Sentiment Bar */}
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', display: 'flex', overflow: 'hidden' }}>
                       <div style={{ width: `${longPercent}%`, background: '#00e676' }} title={`Long: ${longPercent.toFixed(1)}%`}></div>
                       <div style={{ width: `${shortPercent}%`, background: '#ef4444' }} title={`Short: ${shortPercent.toFixed(1)}%`}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>
                       <span style={{ color: '#00e676' }}>{longPercent.toFixed(0)}% L</span>
                       <span style={{ color: '#ef4444' }}>{shortPercent.toFixed(0)}% S</span>
                    </div>
                  </td>
                  
                  <td style={{ padding: '15px 10px', textAlign: 'center', fontSize: '0.85rem' }}>
                     <span style={{ color: '#00e676', fontWeight: 'bold' }}>{t.longs}</span> / <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{t.shorts}</span>
                  </td>
                  
                  <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                    <button 
                      style={{ 
                        background: isExpanded ? 'rgba(255,255,255,0.1)' : 'transparent', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: '#fff', 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        cursor: 'pointer'
                      }}
                    >
                      {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                  </td>
                </tr>
                
                {isExpanded && (
                  <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td colSpan="6" style={{ padding: '1.5rem 2rem' }}>
                      <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <User size={14} color="#f59e0b" /> Détail des Whales sur {t.coin}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                         {t.whales.map((w, wIdx) => (
                           <div key={wIdx} style={{ 
                             background: 'rgba(255,255,255,0.03)', 
                             border: `1px solid ${w.side === 'LONG' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, 
                             borderRadius: '8px', 
                             padding: '10px',
                             borderLeft: `4px solid ${w.side === 'LONG' ? '#00e676' : '#ef4444'}`
                           }}>
                             <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.8rem', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                               <span>{w.name}</span>
                               <span style={{ color: w.winRate >= 55 ? '#00e676' : '#94a3b8', fontSize: '0.7rem' }}>
                                 WR: {w.winRate}%
                               </span>
                             </div>
                             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                               <span style={{ color: w.side === 'LONG' ? '#00e676' : '#ef4444', fontWeight: 'bold' }}>{w.side}</span>
                               <span>${formatMoney(w.notional)}</span>
                             </div>
                           </div>
                         ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {sortedTokens.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucune position détectée.</div>
      )}

      {/* Sentiment Modal */}
      {showSentimentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '1000px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp color="#3b82f6" /> Sentiment de Marché & Comportement des Whales
              </h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
                  {['1H', '1D', '1W'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setSentimentTimeframe(tf)}
                      style={{
                        background: sentimentTimeframe === tf ? '#3b82f6' : 'transparent',
                        color: sentimentTimeframe === tf ? '#fff' : '#94a3b8',
                        border: 'none', padding: '4px 12px', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s'
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowSentimentModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: '10px' }}>
                  <X size={24} />
                </button>
              </div>
            </div>
            <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '0.9rem' }}>
              Ce graphique agrège les liquidations et clôtures de positions (Gains/Pertes) des Top 100 Traders sur Hyperliquid pour mesurer avec précision la santé du marché.
            </p>
            {aggregatedSentimentData.length > 0 ? (
              <MarketSentimentChart data={aggregatedSentimentData} />
            ) : (
              <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Collecte des données historiques en cours...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
