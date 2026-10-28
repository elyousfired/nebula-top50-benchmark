import React, { useState, useEffect } from 'react';
import { fetchTop500Symbols, fetchBinanceData, fetchBybitData } from '../../logic/scanner';
import { RelativeStrengthCard } from './RelativeStrengthCard';
import { Activity, Target } from 'lucide-react';
import { syntheticRatio } from '../../logic/solSwitchEngine';
import { calculateRollingStrength } from '../../MultiPackCharts';
import { detectCompressionStages, detectMultiTimeframeAlignment } from '../../logic/patternMatcher';
import { saveSignal, getSignalHistory, clearSignalHistory } from '../../logic/signalHistory';

const parseCandles = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(k => ({
    time: Number(k[0]) / 1000, 
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  })).sort((a,b) => a.time - b.time);
};

export const CompressionScanner = () => {
  const [armedTokens, setArmedTokens] = useState([]);
  const [btcKlines, setBtcKlines] = useState(null);
  const [solKlines, setSolKlines] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('scanner');
  const [signalHistory, setSignalHistory] = useState([]);
  const [livePrices, setLivePrices] = useState({});

  const refreshHistory = async () => {
    const hist = getSignalHistory();
    setSignalHistory(hist);
    if (hist.length > 0) {
      // Fetch current prices to calc PnL
      const tickers = await fetch('https://api.bybit.com/v5/market/tickers?category=spot').then(res => res.json());
      if (tickers?.result?.list) {
        const pMap = {};
        tickers.result.list.forEach(t => {
          pMap[t.symbol] = parseFloat(t.lastPrice);
        });
        setLivePrices(pMap);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      refreshHistory();
      const interval = setInterval(refreshHistory, 10000); // refresh every 10s
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;

    const scanMarket = async () => {
      setScanning(true);
      setProgress(0);
      setArmedTokens([]);
      
      const btc60 = await fetchBybitData('BTCUSDT', '60', 500);
      const sol60 = await fetchBybitData('SOLUSDT', '60', 500);
      const btc240 = await fetchBybitData('BTCUSDT', '240', 500);
      const sol240 = await fetchBybitData('SOLUSDT', '240', 500);
      const btc15 = await fetchBybitData('BTCUSDT', '15', 500);
      const sol15 = await fetchBybitData('SOLUSDT', '15', 500);
      
      if (!mounted) return;
      setBtcKlines(btc60); // Default to 1H for the card visual
      setSolKlines(sol60);
      
      const parsedSol60 = parseCandles(sol60);
      const parsedSol240 = parseCandles(sol240);
      const parsedSol15 = parseCandles(sol15);
      
      const allSymbols = await fetchTop500Symbols(true);
      const topTokens = allSymbols
        .sort((a, b) => b.turnover24h - a.turnover24h)
        .slice(0, 500); // Scan top 500 by volume

      const matched = [];

      for (let i = 0; i < topTokens.length; i++) {
        if (!mounted) break;
        setProgress(Math.round(((i + 1) / topTokens.length) * 100));

        const token = topTokens[i];
        const fetchFunc = token.exchange === 'binance' ? fetchBinanceData : fetchBybitData;
        
        try {
          const raw240 = await fetchFunc(token.symbol, '240', 250);
          const raw60 = await fetchFunc(token.symbol, '60', 250);
          const raw15 = await fetchFunc(token.symbol, '15', 250);
          
          if (!raw240 || raw240.length < 50 || !raw60 || raw60.length < 50 || !raw15 || raw15.length < 50) continue;
          
          const parsed240 = parseCandles(raw240);
          const parsed60 = parseCandles(raw60);
          const parsed15 = parseCandles(raw15);
          
          // Calculate Rolling Strengths
          // 240 is 4H, period = 6
          const strUsdt240 = calculateRollingStrength(parsed240, 6);
          const strSol240 = calculateRollingStrength(syntheticRatio(parsed240, parsedSol240), 6);
          
          // 60 is 1H, period = 24
          const strUsdt60 = calculateRollingStrength(parsed60, 24);
          const strSol60 = calculateRollingStrength(syntheticRatio(parsed60, parsedSol60), 24);
          
          // 15 is 15m, period = 96
          const strUsdt15 = calculateRollingStrength(parsed15, 96);
          const strSol15 = calculateRollingStrength(syntheticRatio(parsed15, parsedSol15), 96);
          
          const isUsdtAligned = detectMultiTimeframeAlignment(strUsdt240, strUsdt60, strUsdt15);
          const isSolAligned = detectMultiTimeframeAlignment(strSol240, strSol60, strSol15);

          // We require alignment on BOTH USDT and SOL simultaneously
          if (isUsdtAligned && isSolAligned) {
            matched.push(token);
            
            // Get current price (the close of the last 15m candle)
            const currentPrice = parsed15[parsed15.length - 1]?.close || parseFloat(token.lastPrice) || 0;
            saveSignal(token.symbol, currentPrice);
            
            const sortedMatched = [...matched].sort((a, b) => {
              const valA = parseFloat(a.priceChangePercent) || 0;
              const valB = parseFloat(b.priceChangePercent) || 0;
              return valB - valA;
            });
            
            setArmedTokens(sortedMatched);
          }
        } catch (e) {
          console.error("Scan error for", token.symbol, e);
        }
      }

      if (mounted) {
        setScanning(false);
      }
    };

    scanMarket();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={32} color="#00ff88" /> 
            Golden Compression Scanner
          </h1>
          <p style={{ margin: '10px 0 0 0', color: '#94a3b8' }}>
            Scanning Top 500 tokens for the Multi-Timeframe Alignment (4H Deep Red → 1H Armed → 15m Zero Cross)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', background: '#0a0a0a', padding: '5px', borderRadius: '8px', border: '1px solid #222' }}>
          <button 
            onClick={() => setActiveTab('scanner')} 
            style={{ background: activeTab === 'scanner' ? '#00ff88' : 'transparent', color: activeTab === 'scanner' ? '#000' : '#888', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Live Scanner
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            style={{ background: activeTab === 'history' ? '#00ff88' : 'transparent', color: activeTab === 'history' ? '#000' : '#888', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Signal History
          </button>
        </div>
      </div>

      {activeTab === 'history' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', fontSize: '1.2rem', margin: 0 }}>Recorded Signals</h2>
            <button onClick={() => { clearSignalHistory(); refreshHistory(); }} style={{ background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.2)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Clear History</button>
          </div>
          {signalHistory.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px' }}>
              <p>No signals recorded yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                <thead>
                  <tr style={{ background: '#0f172a', textAlign: 'left' }}>
                    <th style={{ padding: '12px', borderBottom: '1px solid #1e293b' }}>Symbol</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #1e293b' }}>Time</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #1e293b' }}>Signal Price</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #1e293b' }}>Current Price</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #1e293b' }}>PnL %</th>
                  </tr>
                </thead>
                <tbody>
                  {signalHistory.map(sig => {
                    const currentPrice = livePrices[sig.symbol] || sig.price;
                    const pnl = ((currentPrice / sig.price) - 1) * 100;
                    return (
                      <tr key={sig.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{sig.symbol}</td>
                        <td style={{ padding: '12px', color: '#94a3b8' }}>{new Date(sig.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '12px' }}>${sig.price.toFixed(4)}</td>
                        <td style={{ padding: '12px' }}>${currentPrice.toFixed(4)}</td>
                        <td style={{ padding: '12px', color: pnl >= 0 ? '#00ff88' : '#ff3b30', fontWeight: 'bold' }}>
                          {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {scanning && (
            <div style={{ marginBottom: '20px', padding: '20px', background: 'rgba(0, 255, 136, 0.1)', borderRadius: '12px', border: '1px solid rgba(0, 255, 136, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#00ff88', fontWeight: 'bold' }}>Scanning Market...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#00ff88', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          )}

          {!scanning && armedTokens.length === 0 && (
             <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid rgba(30, 41, 59, 0.5)' }}>
               <Target size={48} color="#64748B" style={{ margin: '0 auto 10px auto' }} />
               <h2>No Armed Tokens Found</h2>
               <p>The market conditions currently do not present any perfect Multi-Timeframe Alignment (4H/1H/15m) in the top 500 tokens.</p>
             </div>
          )}

          {armedTokens.map((token, index) => (
            <RelativeStrengthCard 
              key={token.symbol} 
              token={token} 
              index={index}
              btcKlines={btcKlines}
              solKlines={solKlines}
              timeframe="60"
            />
          ))}
        </>
      )}
    </div>
  );
};
