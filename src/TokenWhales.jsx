import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from 'lucide-react';

const formatMoney = (val) => {
  if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
  return val.toFixed(2);
};

const TokenWhales = ({ symbol }) => {
  const [whales, setWhales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);

  // Extract base coin (e.g., BTCUSDT -> BTC, 1000PEPEUSDT -> PEPE)
  const coin = symbol.replace(/USDT$/, '').replace(/^1000/, '');

  useEffect(() => {
    let isMounted = true;
    
    const fetchWhales = async () => {
      setLoading(true);
      try {
        const vaultRes = await axios.get('https://stats-data.hyperliquid.xyz/Mainnet/vaults');
        let activeVaults = vaultRes.data.filter(v => v.summary && !v.summary.isClosed);
        activeVaults.sort((a, b) => parseFloat(b.summary.tvl || 0) - parseFloat(a.summary.tvl || 0));
        
        const top100 = activeVaults.slice(0, 100);
        let foundWhales = [];
        let rateLimitHit = false;
        
        const batchSize = 10;
        for (let i = 0; i < top100.length; i += batchSize) {
          if (!isMounted) break;
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
                 });
              }
              const totalTrades = wins + losses;
              const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
              
              const assetPositions = stateRes.data?.assetPositions;
              if (assetPositions && Array.isArray(assetPositions)) {
                assetPositions.forEach(ap => {
                  const pos = ap.position;
                  // Hyperliquid might use variations like "PEPE" instead of "1000PEPE"
                  if (pos.coin === coin || pos.coin === `1000${coin}` || pos.coin === symbol.replace(/USDT$/, '')) {
                    const szi = parseFloat(pos.szi);
                    if (szi !== 0) {
                      const isLong = szi > 0;
                      foundWhales.push({
                        name: vault.summary.name,
                        address,
                        side: isLong ? 'LONG' : 'SHORT',
                        szi: Math.abs(szi),
                        notional: parseFloat(pos.positionValue),
                        winRate
                      });
                    }
                  }
                });
              }
            } catch(e) {
              console.error("Vault fetch error for address", address, e);
              if (e.response && e.response.status === 429) {
                 rateLimitHit = true;
              }
            }
          }));
          
          // Add a small delay between batches to avoid Hyperliquid rate limits
          if (i + batchSize < top100.length) {
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        }
        
        if (isMounted) {
          if (rateLimitHit && foundWhales.length === 0) {
            setRateLimited(true);
          } else {
            console.log("TokenWhales finished scanning. Found whales:", foundWhales.length, "for coin:", coin);
            foundWhales.sort((a, b) => b.notional - a.notional);
            setWhales(foundWhales);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching whales:", err);
        if (isMounted) setLoading(false);
      }
    };
    
    fetchWhales();
    
    return () => {
      isMounted = false;
    };
  }, [symbol]);

  return (
    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', fontSize: '1.2rem' }}>
          <User size={20} /> Positions des Whales (Hyperliquid) : {coin}
        </h3>
      </div>
      
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 10px auto', width: '24px', height: '24px', border: '3px solid rgba(245, 158, 11, 0.3)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Recherche des positions sur {coin} dans le Top 100 Whales...
        </div>
      ) : rateLimited ? (
        <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>
          L'API Hyperliquid a limité les requêtes (trop d'analyses consécutives). Veuillez patienter une minute.
        </div>
      ) : whales.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
           {whales.map((w, wIdx) => (
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
      ) : (
        <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Aucune Whale n'a de position ouverte sur {coin} en ce moment.</div>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TokenWhales;
