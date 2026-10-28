import React, { useState, useEffect, useRef } from 'react';
import { Search, Activity, ShieldAlert, Crosshair, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Layers, Database, Star } from 'lucide-react';
import axios from 'axios';
import { HyperliquidLeaderboard } from './HyperliquidLeaderboard';
import { HyperliquidTokenScreener } from './HyperliquidTokenScreener';
import { fetchHyperliquidMeta, fetchHyperliquidUserState, fetchHyperliquidCandles } from './logic/hyperliquid';
import { fetchBinanceData, fetchBinanceOpenInterest } from './logic/binance';
import { createChart } from 'lightweight-charts';
import { fetchBybitData, fetchOpenInterest } from './logic/scanner';
// --- DIRECTION ESTIMATOR CHART COMPONENT ---
// (Réutilisé et adapté pour l'esthétique Pro)
const ConfluenceOscillator = ({ symbol, exchange }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.05)', style: 1 }, horzLines: { color: 'rgba(255,255,255,0.05)', style: 1 } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { mode: 1 },
      handleScroll: { vertTouchDrag: false },
    });

    const oscillatorSeries = chartRef.current.addHistogramSeries({
      priceFormat: { type: 'volume' },
      base: 0,
    });

    const loadData = async () => {
      setLoading(true);
      let klineData = [];
      let oiData = [];

      try {
        if (exchange === 'BINANCE') {
          [klineData, oiData] = await Promise.all([
            fetchBinanceData(symbol + 'USDT', '15m', 300),
            fetchBinanceOpenInterest(symbol + 'USDT', '15m', 300)
          ]);
        } else if (exchange === 'HYPERLIQUID') {
          // Hyperliquid API expects base coin (e.g. BTC)
          const baseSymbol = symbol.replace('USDT', '');
          klineData = await fetchHyperliquidCandles(baseSymbol, '15m');
          oiData = []; // No historical OI available easily, will approximate
        } else { // BYBIT default
          [klineData, oiData] = await Promise.all([
            fetchBybitData(symbol + 'USDT', '15', 300),
            fetchOpenInterest(symbol + 'USDT', '15')
          ]);
        }
      } catch (err) {
        console.error("Error fetching data for oscillator", err);
      }

      if (!klineData || klineData.length === 0) {
        chartRef.current.applyOptions({ watermark: { color: 'rgba(239, 68, 68, 0.5)', visible: true, text: 'NO FUTURES DATA', fontSize: 16, horzAlign: 'center', vertAlign: 'center' } });
        setLoading(false);
        return;
      }

      // Clear watermark on success
      chartRef.current.applyOptions({ watermark: { visible: false } });

      let sorted = [];
      if (!exchange || exchange === 'BYBIT') {
          sorted = [...klineData].reverse();
      } else {
          sorted = [...klineData]; // Binance and Hyperliquid are already oldest-to-newest
      }
      
      let oiSorted = [];
      if (oiData && oiData.length > 0) {
          if (!exchange || exchange === 'BYBIT') {
              oiSorted = [...oiData].reverse(); // Bybit returns newest-to-oldest
          } else {
              oiSorted = [...oiData]; // Binance returns oldest-to-newest
          }
      }

      const oscData = [];
      let prevClose = null;
      let prevOI = null;

      sorted.forEach(k => {
        const kTimeMs = Number(k[0]);
        const time = Math.floor(kTimeMs / 1000);
        const open = Number(k[1]);
        const close = Number(k[4]);
        const turnover = Number(k[6]);
        
        let flow = open > 0 ? turnover * ((close - open) / open) : 0;

        let closestOI = null;
        if (oiSorted.length > 0) {
          let minDiff = Infinity;
          oiSorted.forEach(o => {
             const oTimeMs = Number(o.timestamp);
             const diff = Math.abs(oTimeMs - kTimeMs);
             if (diff < minDiff && diff <= 60 * 60 * 1000) {
                 minDiff = diff;
                 closestOI = Number(o.openInterest);
             }
          });
        }

        const currentOI = closestOI !== null ? closestOI : prevOI;

        if (prevClose !== null) {
           const deltaPrice = close - prevClose;
           let score = 0;
           let color = '#cbd5e1';
           
           if (oiSorted.length > 0 && currentOI !== null && prevOI !== null) {
               // Full Confluence with Open Interest
               const deltaOI = currentOI - prevOI;
               if (deltaPrice > 0 && deltaOI > 0 && flow > 0) { score = 100; color = '#00e676'; } // STRONG LONG
               else if (deltaPrice > 0 && deltaOI > 0 && flow < 0) { score = -100; color = '#ff3b30'; } // BULL TRAP
               else if (deltaPrice < 0 && deltaOI > 0 && flow < 0) { score = -100; color = '#ff3b30'; } // STRONG SHORT
               else if (deltaPrice < 0 && deltaOI > 0 && flow > 0) { score = 100; color = '#00e676'; } // BEAR TRAP
               else if (deltaPrice > 0 && deltaOI < 0 && flow > 0) { score = 60; color = '#00b8cc'; } // SHORT SQUEEZE
               else if (deltaPrice < 0 && deltaOI < 0 && flow < 0) { score = -60; color = '#f59e0b'; } // LONG LIQUIDATION
               else { score = flow > 0 ? 20 : -20; color = flow > 0 ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 59, 48, 0.4)'; }
           } else {
               // Approximation without OI (Hyperliquid) based purely on price delta and volume flow
               if (deltaPrice > 0 && flow > 0) { score = 100; color = '#00e676'; } // STRONG LONG (Approx)
               else if (deltaPrice < 0 && flow < 0) { score = -100; color = '#ff3b30'; } // STRONG SHORT (Approx)
               else if (deltaPrice > 0 && flow < 0) { score = 60; color = '#00b8cc'; } // DIVERGENCE UP
               else if (deltaPrice < 0 && flow > 0) { score = -60; color = '#f59e0b'; } // DIVERGENCE DOWN
               else { score = flow > 0 ? 20 : -20; color = flow > 0 ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 59, 48, 0.4)'; }
           }

           oscData.push({ time, value: score, color });
        } else {
           oscData.push({ time, value: 0, color: 'transparent' });
        }
        prevClose = close;
        if (currentOI !== null) prevOI = currentOI;
      });

      oscillatorSeries.setData(oscData);
      chartRef.current.timeScale().fitContent();
      setLoading(false);
    };

    loadData();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, exchange]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <span style={{ fontWeight: 900, color: '#00e676', animation: 'pulse 1.5s infinite' }}>SYNCING OSCILLATOR...</span>
        </div>
      )}
      <div ref={chartContainerRef} style={{ width: '100%', height: '180px' }} />
    </div>
  );
};

export const HyperliquidPro = () => {
  const [addressInput, setAddressInput] = useState('0x92ea19eceb7a8de0f50978a1583a5d8b018050e9');
  const [currentAddress, setCurrentAddress] = useState('0x92ea19eceb7a8de0f50978a1583a5d8b018050e9');
  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [exchangeSource, setExchangeSource] = useState('BYBIT');
  const [topWhales, setTopWhales] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [sortPositionsByToken, setSortPositionsByToken] = useState(false);

  useEffect(() => {
    // Fetch Top Whales (Vault Leaders) from Hyperliquid
    const fetchWhales = async () => {
      try {
        const res = await axios.get('https://stats-data.hyperliquid.xyz/Mainnet/vaults');
        if (res.data && Array.isArray(res.data)) {
           const activeVaults = res.data.filter(v => 
             v.summary && 
             !v.summary.isClosed &&
             !v.summary.name.includes('HLP')
           );
           activeVaults.sort((a, b) => parseFloat(b.summary.tvl || 0) - parseFloat(a.summary.tvl || 0));
           const top = activeVaults.slice(0, 5).map(v => ({
              address: v.summary.vaultAddress,
              name: v.summary.name
           }));
           setTopWhales(top);
        }
      } catch(e) { console.error("Could not fetch top whales", e); }
    };
    fetchWhales();
  }, []);

  // Load User State
  useEffect(() => {
    const loadUser = async () => {
      if (!currentAddress) return;
      setLoadingUser(true);
      const data = await fetchHyperliquidUserState(currentAddress);
      setUserData(data);
      if (data && data.positions.length > 0) {
          // Default selection to the first coin in their portfolio
          setSelectedAsset(data.positions[0].coin);
      }
      setLoadingUser(false);
    };
    loadUser();
  }, [currentAddress]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (addressInput.startsWith('0x') && addressInput.length === 42) {
      setCurrentAddress(addressInput);
    } else {
      alert("Format d'adresse invalide.");
    }
  };

  const formatMoney = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: '#e2e8f0', fontFamily: '"JetBrains Mono", monospace' }}>
      
      {/* HEADER & SEARCH */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="https://app.hyperliquid.xyz/hyperliquid.png" alt="HL" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            HYPERLIQUID PRO
          </h1>
          <p style={{ color: '#94a3b8', margin: '5px 0 0 0', fontSize: '1.1rem' }}>Tracker de Smart Money & Futures (Long/Short)</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <input 
              type="text" 
              value={addressInput}
              onChange={e => setAddressInput(e.target.value)}
              placeholder="0x..." 
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', padding: '10px 15px', width: '350px', fontFamily: '"JetBrains Mono", monospace' }}
            />
            <button type="submit" style={{ background: '#00e676', border: 'none', borderRadius: '8px', padding: '0 20px', color: '#000', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Search size={18} /> TRACK WALLET
            </button>
          </form>
          {topWhales.length > 0 && (
             <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: '0.75rem' }}>
                <span style={{ color: '#94a3b8', marginRight: '5px', alignSelf: 'center' }}>Top Whales:</span>
                {topWhales.map((whale, idx) => (
                   <button 
                     key={idx}
                     onClick={() => { setAddressInput(whale.address); setCurrentAddress(whale.address); setActiveTab('tracker'); }}
                     style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                     onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                     onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                   >
                     <Star size={12} color="#f59e0b" /> {whale.name.substring(0, 15)}{whale.name.length > 15 ? '...' : ''}
                   </button>
                ))}
             </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', paddingBottom: '5px' }}>
        <button 
          onClick={() => setActiveTab('leaderboard')}
          style={{ 
            background: 'transparent', border: 'none', 
            color: activeTab === 'leaderboard' ? '#00e676' : '#94a3b8', 
            borderBottom: activeTab === 'leaderboard' ? '3px solid #00e676' : '3px solid transparent',
            padding: '10px 0', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s'
          }}>
          Top Traders (Leaderboard)
        </button>
        <button 
          onClick={() => setActiveTab('tracker')}
          style={{ 
            background: 'transparent', border: 'none', 
            color: activeTab === 'tracker' ? '#00e676' : '#94a3b8', 
            borderBottom: activeTab === 'tracker' ? '3px solid #00e676' : '3px solid transparent',
            padding: '10px 0', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s'
          }}>
          Tracker de Portefeuilles
        </button>
        <button 
          onClick={() => setActiveTab('screener')}
          style={{ 
            background: 'transparent', border: 'none', 
            color: activeTab === 'screener' ? '#00e676' : '#94a3b8', 
            borderBottom: activeTab === 'screener' ? '3px solid #00e676' : '3px solid transparent',
            padding: '10px 0', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s'
          }}>
          Analyse par Token (Smart Money)
        </button>
      </div>

      {activeTab === 'leaderboard' ? (
        <HyperliquidLeaderboard onAnalyze={(address) => { setActiveTab('tracker'); setAddressInput(address); setCurrentAddress(address); }} />
      ) : activeTab === 'screener' ? (
        <HyperliquidTokenScreener />
      ) : (
        <>
          {loadingUser ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: '#00e676' }}>
          <Activity size={50} className="spin-slow" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>EXTRACTION DES POSITIONS DE LA WHALE...</p>
        </div>
      ) : userData ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
          
          {/* STATS OVERVIEW */}
          <div style={{ gridColumn: 'span 12', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}><Wallet size={16}/> ACCOUNT VALUE</div>
               <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>${formatMoney(userData.accountValue)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={16}/> TOTAL NOTIONAL POSITION</div>
               <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#00b8cc' }}>${formatMoney(userData.totalNtlPos)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={16}/> MARGIN USED</div>
               <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b' }}>${formatMoney(userData.totalMarginUsed)}</div>
            </div>
          </div>

          {/* POSITIONS LIST */}
          <div style={{ gridColumn: 'span 7', background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1.5rem 0' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Crosshair size={20} color="#00e676" /> OPEN POSITIONS (LONG/SHORT)
              </h2>
              {userData.positions.length > 0 && (
                 <button 
                   onClick={() => setSortPositionsByToken(!sortPositionsByToken)}
                   style={{
                     background: sortPositionsByToken ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255,255,255,0.05)',
                     border: sortPositionsByToken ? '1px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
                     color: sortPositionsByToken ? '#00e676' : '#94a3b8',
                     padding: '6px 12px',
                     borderRadius: '8px',
                     cursor: 'pointer',
                     fontSize: '0.8rem',
                     fontWeight: 'bold',
                     transition: 'all 0.2s'
                   }}
                 >
                   Trier par Token (A-Z)
                 </button>
              )}
            </div>
            
            {userData.positions.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', marginTop: '3rem' }}>Aucune position ouverte sur ce compte.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 0' }}>COIN</th>
                    <th style={{ padding: '10px 0' }}>SIDE</th>
                    <th style={{ padding: '10px 0' }}>SIZE</th>
                    <th style={{ padding: '10px 0' }}>ENTRY PX</th>
                    <th style={{ padding: '10px 0', textAlign: 'right' }}>UNREALIZED PNL</th>
                  </tr>
                </thead>
                <tbody>
                  {(sortPositionsByToken ? [...userData.positions].sort((a,b) => a.coin.localeCompare(b.coin)) : userData.positions).map((pos, i) => {
                    const isLong = pos.type === 'LONG';
                    const color = isLong ? '#00e676' : '#ff3b30';
                    const pnlColor = pos.unrealizedPnl >= 0 ? '#00e676' : '#ff3b30';
                    const isSelected = selectedAsset === pos.coin;
                    
                    return (
                      <tr 
                        key={i} 
                        onClick={() => setSelectedAsset(pos.coin)}
                        style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.02)', 
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '15px 0', fontWeight: 'bold' }}>{pos.coin} <span style={{ fontSize: '0.7rem', color: '#64748b', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{pos.leverage}x</span></td>
                        <td style={{ padding: '15px 0', color: color, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {isLong ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>} {pos.type}
                        </td>
                        <td style={{ padding: '15px 0' }}>{pos.size}</td>
                        <td style={{ padding: '15px 0' }}>${pos.entryPrice.toFixed(4)}</td>
                        <td style={{ padding: '15px 0', textAlign: 'right', color: pnlColor, fontWeight: 'bold' }}>
                          {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnl.toFixed(2)} ({pos.returnOnEquity.toFixed(2)}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* DIRECTION ESTIMATOR FOR SELECTED ASSET */}
          <div style={{ gridColumn: 'span 5', background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Activity size={20} color="#00b8cc" /> LIVE ESTIMATOR
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                  Confluence Flow
                </p>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {['BYBIT', 'BINANCE', 'HYPERLIQUID'].map(ex => (
                  <button 
                    key={ex}
                    onClick={() => setExchangeSource(ex)}
                    style={{
                      background: exchangeSource === ex ? 'rgba(0, 230, 118, 0.2)' : 'transparent',
                      border: `1px solid ${exchangeSource === ex ? '#00e676' : 'rgba(255,255,255,0.1)'}`,
                      color: exchangeSource === ex ? '#00e676' : '#94a3b8',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <Database size={16} color="#94a3b8"/>
               <input 
                 type="text" 
                 value={selectedAsset}
                 onChange={(e) => setSelectedAsset(e.target.value.toUpperCase())}
                 style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '5px 10px', borderRadius: '6px', width: '100px', fontWeight: 'bold' }}
               />
               <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Data Source: {exchangeSource}</span>
            </div>
            
            {exchangeSource !== 'HYPERLIQUID' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.7rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '1.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, background: '#00e676', borderRadius: 2 }}/> Strong Long (+100)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, background: '#ff3b30', borderRadius: 2 }}/> Strong Short (-100)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, background: '#00b8cc', borderRadius: 2 }}/> Short Squeeze (+60)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }}/> Long Liquidation (-60)</span>
              </div>
            )}

            <div style={{ flex: 1, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
              {exchangeSource === 'HYPERLIQUID' ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                   <ShieldAlert size={40} color="#f59e0b" style={{ marginBottom: '1rem' }} />
                   <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b' }}>Confluence Indisponible</h3>
                   <p style={{ fontSize: '0.85rem', maxWidth: '400px', lineHeight: '1.5' }}>
                     L'API de Hyperliquid ne fournit pas d'historique d'Open Interest. 
                     Pour garantir des <strong>données 100% réelles et strictes</strong>, l'Oscillateur est désactivé ici.
                     <br/><br/>
                     Veuillez sélectionner <strong>BYBIT</strong> ou <strong>BINANCE</strong> pour analyser le véritable Order Flow.
                   </p>
                </div>
              ) : (
                <ConfluenceOscillator symbol={selectedAsset} exchange={exchangeSource} />
              )}
            </div>
            
            <div style={{ marginTop: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '1rem', fontSize: '0.8rem', color: '#fca5a5' }}>
              <ShieldAlert size={16} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
              <strong>Attention :</strong> Copier les positions d'une Whale comporte des risques. Vérifiez toujours la Confluence avant de prendre un trade.
            </div>
          </div>

        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: '#64748b' }}>
          Adresse non valide ou erreur de chargement.
        </div>
      )}
        </>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
        }
        .spin-slow {
            animation: spin 3s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};
