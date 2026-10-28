import React, { useState } from 'react';
import { fetchTop500Symbols, fetchTrades } from '../../logic/scanner';
import { Activity, Play, ArrowUpRight, ArrowDownRight, Droplet } from 'lucide-react';

export const SurgicalCvdScanner = () => {
  const [inflows, setInflows] = useState([]);
  const [outflows, setOutflows] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);

  const startScan = async () => {
    setScanning(true);
    setProgress(0);
    setAnalyzedCount(0);
    setInflows([]);

    try {
      // 1. Fetch Top Symbols (Limit to 500)
      const allSymbols = await fetchTop500Symbols(false, 500);
      
      const results = [];

      // Chunking the requests into batches of 20 to respect Bybit rate limits (120 req/sec) and avoid proxy fallback stall
      for (let i = 0; i < allSymbols.length; i += 20) {
        const batch = allSymbols.slice(i, i + 20);
        
        await Promise.all(batch.map(async (token) => {
          try {
            const trades = await fetchTrades(token.symbol);
            
            if (trades && trades.length > 0) {
              let buyFlow = 0;
              let sellFlow = 0;
              let tradeCount = trades.length;

              trades.forEach(trade => {
                const vol = parseFloat(trade.size || trade.v); // Fallback if proxy returns Binance format
                const price = parseFloat(trade.price || trade.p);
                const value = vol * price;

                const side = trade.side || trade.S; // Bybit REST uses 'side', WS uses 'S'
                if (side === 'Buy') {
                  buyFlow += value;
                } else if (side === 'Sell') {
                  sellFlow += value;
                }
              });

              const netFlow = buyFlow - sellFlow;
              const totalFlow = buyFlow + sellFlow;
              const buyerDominance = totalFlow > 0 ? (buyFlow / totalFlow) * 100 : 50;

              if (totalFlow > 0) {
                results.push({
                  symbol: token.symbol,
                  price: parseFloat(token.lastPrice),
                  buyFlow,
                  sellFlow,
                  netFlow,
                  totalFlow,
                  buyerDominance,
                  tradeCount
                });
              }
            }
          } catch (err) {}
        }));

        setAnalyzedCount(Math.min(i + 20, allSymbols.length));
        setProgress(Math.round((Math.min(i + 20, allSymbols.length) / allSymbols.length) * 100));

        // Update UI dynamically
        const sorted = [...results].sort((a, b) => b.netFlow - a.netFlow);
        setInflows(sorted.filter(r => r.netFlow > 0).slice(0, 50));
        
        // Small delay between batches
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  const formatMoney = (val) => {
    if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return Math.abs(val).toFixed(0);
  };

  const FlowRow = ({ token, isBuy }) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '12px 16px', 
      background: 'rgba(255,255,255,0.02)', 
      borderRadius: '8px',
      marginBottom: '8px',
      borderLeft: `4px solid ${isBuy ? '#00ff88' : '#ff3b30'}`
    }}>
      <div style={{ width: '25%' }}>
        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>{token.symbol.replace('USDT', '')}</div>
        <div style={{ fontSize: '0.7rem', color: '#888' }}>${token.price.toFixed(4)}</div>
      </div>
      
      <div style={{ width: '40%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
          <span style={{ color: '#00ff88' }}>Buy: ${formatMoney(token.buyFlow)}</span>
          <span style={{ color: '#ff3b30' }}>Sell: ${formatMoney(token.sellFlow)}</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: '#ff3b30', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${token.buyerDominance}%`, height: '100%', background: '#00ff88' }} />
        </div>
      </div>

      <div style={{ width: '25%', textAlign: 'right' }}>
        <div style={{ fontWeight: 'bold', color: isBuy ? '#00ff88' : '#ff3b30', fontSize: '1.1rem' }}>
          {isBuy ? '+' : '-'}${formatMoney(token.netFlow)}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#888' }}>CVD (last {token.tradeCount} trades)</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px', color: '#fff', background: '#090915', borderRadius: '16px', border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Droplet color="#00d0ff" size={28} />
            SURGICAL CVD SCANNER
          </h2>
          <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '0.9rem' }}>
            Analyse tick-par-tick des Taker Trades. Identifie l'argent frais réel injecté au marché (Buy vs Sell).
          </p>
        </div>
        
        <button 
          onClick={startScan} 
          disabled={scanning}
          style={{
            background: scanning ? '#1e293b' : '#00d0ff',
            color: scanning ? '#888' : '#090915',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: scanning ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {scanning ? (
            <><Activity className="animate-spin" size={18} /> SCANNING {analyzedCount}/500</>
          ) : (
            <><Play size={18} /> START SURGICAL SCAN</>
          )}
        </button>
      </div>

      {scanning && (
        <div style={{ width: '100%', height: '4px', background: '#1e293b', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#00d0ff', transition: 'width 0.3s' }} />
        </div>
      )}

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* INFLOWS */}
        <div style={{ background: 'rgba(0, 255, 136, 0.02)', border: '1px solid rgba(0, 255, 136, 0.1)', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ color: '#00ff88', display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0, borderBottom: '1px solid rgba(0,255,136,0.1)', paddingBottom: '12px' }}>
            <ArrowUpRight size={20} /> TOP INFLOWS (Acheteurs Agressifs)
          </h3>
          {inflows.length === 0 && !scanning ? (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Aucune donnée</div>
          ) : (
            inflows.map(token => <FlowRow key={token.symbol} token={token} isBuy={true} />)
          )}
        </div>
      </div>
    </div>
  );
};
