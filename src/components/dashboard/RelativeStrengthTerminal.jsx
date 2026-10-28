import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { fetchTop500Symbols, fetchBinanceData, fetchBybitData } from '../../logic/scanner';
import { RelativeStrengthCard } from './RelativeStrengthCard';
import { RefreshCw, Play, Pause } from 'lucide-react';

export const RelativeStrengthTerminal = () => {
  const [tokens, setTokens] = useState([]);
  const [btcKlines, setBtcKlines] = useState(null);
  const [solKlines, setSolKlines] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('60');

  const timeframes = [
    { label: '15MIN', value: '15' },
    { label: '1H', value: '60' },
    { label: '4H', value: '240' },
    { label: '1d', value: 'D' },
    { label: '3D', value: '3D' },
    { label: '1W', value: 'W' }
  ];

  // Fetch benchmark klines and top gainers
  useEffect(() => {
    let mounted = true;
    
    const initData = async () => {
      try {
        setLoading(true);
        // Bybit interval mapping: 3D will fetch 'D' under the hood
        const fetchTf = timeframe === '3D' ? 'D' : timeframe;
        const btc = await fetchBybitData('BTCUSDT', fetchTf, 200);
        const sol = await fetchBybitData('SOLUSDT', fetchTf, 200);
        
        if (!mounted) return;
        setBtcKlines(btc);
        setSolKlines(sol);
        
        const allSymbols = await fetchTop500Symbols(true);
        const topGainers = allSymbols
          .filter(t => t.priceChangePercent !== undefined)
          .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
          .slice(0, 50); 
          
        if (mounted) {
          setTokens(topGainers);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error initializing RS Terminal:", err);
        if (mounted) setLoading(false);
      }
    };
    
    initData();
    
    let interval;
    if (scanning) {
        interval = setInterval(initData, 60000 * 15); 
    }
    
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [scanning, timeframe]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#fff' }}>
        <div style={{ background: '#0B0E14', padding: '15px 20px', borderBottom: '1px solid #1A202C', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#F7931A' }}>ROLLING STRENGTH SCANNER</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ background: '#1A202C', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem' }}>TOP 50 GAINERS</span>
                  <span style={{ background: '#1A202C', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem' }}>BYBIT + BINANCE</span>
              </div>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ display: 'flex', background: '#1A202C', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                {timeframes.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    style={{
                      background: timeframe === tf.value ? '#3B82F6' : 'transparent',
                      color: timeframe === tf.value ? '#fff' : '#64748B',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setScanning(!scanning)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: scanning ? '#FF3B3020' : '#00FF8820', color: scanning ? '#FF3B30' : '#00FF88', border: `1px solid ${scanning ? '#FF3B3050' : '#00FF8850'}`, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {scanning ? <Pause size={16} /> : <Play size={16} />}
                {scanning ? 'PAUSE SCAN' : 'RESUME SCAN'}
              </button>
           </div>
        </div>
        
        {/* Main Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
             <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
                <RefreshCw size={40} color="#F7931A" style={{ animation: 'spin 2s linear infinite' }} />
                <span style={{ color: '#64748B', fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px' }}>ANALYZING RELATIVE STRENGTH...</span>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
             </div>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               {tokens.map((token, index) => (
                 <RelativeStrengthCard 
                   key={`${token.symbol}-${index}`} 
                   token={token} 
                   index={index}
                   btcKlines={btcKlines} 
                   solKlines={solKlines} 
                   timeframe={timeframe}
                 />
               ))}
             </div>
          )}
        </div>
    </div>
  );
};
