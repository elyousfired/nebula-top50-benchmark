import React, { useState, useEffect } from 'react';
import { Activity, Flame, Droplet, ExternalLink, Zap, TrendingUp, Target, AlertTriangle } from 'lucide-react';
import { fetchTop500Symbols } from './logic/scanner';

export const DexPoolsScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [scanLimit, setScanLimit] = useState(100);

  const scanDexPools = async () => {
    setScanning(true);
    setError('');
    setResults([]);
    setProgress(0);

    try {
      const topSymbols = await fetchTop500Symbols();
      const targets = topSymbols.slice(0, scanLimit).map(s => s.symbol.replace('USDT', ''));
      
      const batchSize = 5;
      const allResults = [];

      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        
        const promises = batch.map(async (symbol) => {
          try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
            const data = await res.json();
            
            if (data.pairs && data.pairs.length > 0) {
              // Filtrer pour trouver la vraie pool du token (highest liquidity)
              const validPairs = data.pairs.filter(p => 
                (p.baseToken.symbol.toUpperCase() === symbol.toUpperCase() || 
                 p.quoteToken.symbol.toUpperCase() === symbol.toUpperCase()) &&
                p.liquidity && p.liquidity.usd > 10000 // min 10k liq
              ).sort((a, b) => b.liquidity.usd - a.liquidity.usd);

              if (validPairs.length > 0) {
                const mainPair = validPairs[0];
                const vol24h = mainPair.volume?.h24 || 0;
                const liqUsd = mainPair.liquidity?.usd || 1;
                const ratio = vol24h / liqUsd;

                return {
                  symbol,
                  chainId: mainPair.chainId,
                  dexId: mainPair.dexId,
                  priceUsd: mainPair.priceUsd,
                  liquidity: liqUsd,
                  volume24h: vol24h,
                  ratio: ratio,
                  priceChange24h: mainPair.priceChange?.h24 || 0,
                  buys: mainPair.txns?.h24?.buys || 0,
                  sells: mainPair.txns?.h24?.sells || 0,
                  url: mainPair.url,
                  pairAddress: mainPair.pairAddress
                };
              }
            }
          } catch (e) {
            console.warn(`Error fetching ${symbol}:`, e);
          }
          return null;
        });

        const batchResults = await Promise.all(promises);
        const validBatchResults = batchResults.filter(r => r !== null);
        allResults.push(...validBatchResults);
        
        setProgress(Math.floor(((i + batchSize) / targets.length) * 100));
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }

      // Sort by highest ratio and keep top 50
      allResults.sort((a, b) => b.ratio - a.ratio);
      setResults(allResults.slice(0, 50));

    } catch (err) {
      console.error(err);
      setError('Erreur lors du scan: ' + err.message);
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  const formatMoney = (val) => {
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return val.toFixed(2);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', margin: 0, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
          <Droplet size={40} color="#3b82f6" /> DEX POOLS AWAKENING
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginTop: '10px' }}>
          Détection d'injection de liquidité et de volume anormal On-Chain (Smart Money Accumulation).
        </p>
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '24px', padding: '2rem', marginBottom: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[100, 200, 300].map(limit => (
            <button
              key={limit}
              onClick={() => setScanLimit(limit)}
              style={{
                background: scanLimit === limit ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: `1px solid ${scanLimit === limit ? '#3b82f6' : '#334155'}`,
                color: scanLimit === limit ? '#3b82f6' : '#94a3b8',
                padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
              }}
            >
              TOP {limit}
            </button>
          ))}
        </div>
        
        <button 
          onClick={scanDexPools} 
          disabled={scanning}
          style={{
            background: scanning ? '#334155' : 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
            border: 'none', color: '#fff', padding: '15px 40px', borderRadius: '30px',
            fontSize: '1.2rem', fontWeight: 'bold', cursor: scanning ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '10px', boxShadow: scanning ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.4)', transition: 'all 0.3s'
          }}
        >
          {scanning ? <Activity className="spin" size={24} /> : <Target size={24} />}
          {scanning ? `ANALYSE DEX (${progress}%)` : 'LANCER LE RADAR ON-CHAIN'}
        </button>
        {error && <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> {error}</div>}
      </div>

      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {results.map((r, i) => (
            <div key={i} style={{ 
              background: 'rgba(15, 23, 42, 0.8)', border: `1px solid ${r.ratio > 2 ? '#ec4899' : r.ratio > 1 ? '#8b5cf6' : '#334155'}`, 
              borderRadius: '20px', padding: '1.5rem', position: 'relative', overflow: 'hidden',
              boxShadow: r.ratio > 2 ? '0 0 20px rgba(236, 72, 153, 0.15)' : 'none',
              transition: 'transform 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            onClick={() => window.open(r.url, '_blank')}
            >
              {r.ratio > 2 && (
                <div style={{ position: 'absolute', top: 0, right: 0, background: 'linear-gradient(45deg, #ec4899, #f43f5e)', color: '#fff', padding: '5px 15px', borderBottomLeftRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Flame size={14} /> HOT POOL
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <img src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${r.symbol === 'BTC' ? '1' : r.symbol === 'ETH' ? '1027' : '825'}.png`} 
                     alt="icon" style={{ width: '40px', height: '40px', borderRadius: '50%' }} 
                     onError={(e) => { e.target.src = 'https://cryptologos.cc/logos/solana-sol-logo.png'; }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {r.symbol} <span style={{ fontSize: '0.8rem', background: '#334155', padding: '2px 8px', borderRadius: '10px', color: '#cbd5e1' }}>{r.chainId.toUpperCase()}</span>
                  </h3>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{r.dexId.toUpperCase()}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '12px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}><Droplet size={14} /> LIQUIDITY</div>
                  <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>${formatMoney(r.liquidity)}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '12px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}><Activity size={14} /> VOLUME 24H</div>
                  <div style={{ color: '#3b82f6', fontSize: '1.2rem', fontWeight: 'bold' }}>${formatMoney(r.volume24h)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: r.ratio > 2 ? 'rgba(236, 72, 153, 0.1)' : 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', marginBottom: '1rem' }}>
                <div>
                  <div style={{ color: r.ratio > 2 ? '#ec4899' : '#3b82f6', fontSize: '0.8rem', fontWeight: 'bold' }}>VOL/LIQ RATIO</div>
                  <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '900' }}>{r.ratio.toFixed(2)}x</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '2px' }}>PRICE 24H</div>
                  <div style={{ color: r.priceChange24h >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {r.priceChange24h >= 0 ? '+' : ''}{r.priceChange24h.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>🟢 {r.buys} Buys</span>
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>🔴 {r.sells} Sells</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !scanning && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: '4rem' }}>
          <TrendingUp size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
          <p>Cliquez sur "Lancer le radar On-Chain" pour scanner les DEX.</p>
        </div>
      )}
    </div>
  );
};

export default DexPoolsScanner;
