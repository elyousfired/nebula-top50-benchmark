import React, { useState, useEffect } from 'react';
import { fetchTop500Symbols, fetchBybitData, fetchBinanceData } from '../../logic/scanner';
import { detectAccumulation } from '../../logic/accumulationDetector';
import { Box, Target, Crosshair, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { AccumulationChartCard } from './AccumulationChartCard';

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

export const AccumulationScanner = () => {
  const [accumulatingTokens, setAccumulatingTokens] = useState([]);
  const [scanning, setScanning] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;

    const scanMarket = async () => {
      setScanning(true);
      setProgress(0);
      setAccumulatingTokens([]);
      
      const allSymbols = await fetchTop500Symbols(false, 1500); // 1500 to cover all Bybit tokens
      const topTokens = allSymbols.sort((a, b) => b.turnover24h - a.turnover24h);

      const matched = [];

      for (let i = 0; i < topTokens.length; i++) {
        if (!mounted) break;
        setProgress(Math.round(((i + 1) / topTokens.length) * 100));

        const token = topTokens[i];
        const fetchFunc = token.exchange === 'binance' ? fetchBinanceData : fetchBybitData;
        
        const stablecoins = ['FDUSD', 'BFUSD', 'PYUSD', 'USDD', 'USDE', 'DAI', 'TUSD', 'XAUT', 'PAXG'];
        
        try {
          const baseAsset = token.symbol.replace('USDT', '').replace('USDC', '');
          if (stablecoins.includes(baseAsset)) continue;

          // Fetch 1H timeframe for macro accumulation
          const raw60 = await fetchFunc(token.symbol, '60', 250);
          if (!raw60 || raw60.length < 50) continue;
          
          const parsed60 = parseCandles(raw60);
          
          const windowSizes = [200, 150, 100, 80, 50];
          let accumData = null;
          
          for (let size of windowSizes) {
            if (parsed60.length < size + 20) continue;
            // Max range 7%, margin 0.5%
            accumData = detectAccumulation(parsed60, 7.0, 0.5, size);
            if (accumData) {
              break; // Found the largest valid accumulation window
            }
          }
          
          if (accumData) {
            matched.push({
              ...token,
              klines: parsed60,
              accumData
            });
            
            // Sort by tightest range first
            const sortedMatched = [...matched].sort((a, b) => a.accumData.rangePct - b.accumData.rangePct);
            setAccumulatingTokens(sortedMatched);
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
            <Box size={32} color="#00d0ff" /> 
            Accumulation Scanner (1H)
          </h1>
          <p style={{ margin: '10px 0 0 0', color: '#94a3b8' }}>
            Scanning for sideways consolidation boxes with Equal Highs (Resistance) and Equal Lows (Support).
          </p>
        </div>
      </div>

      {scanning && (
        <div style={{ marginBottom: '20px', padding: '20px', background: 'rgba(0, 208, 255, 0.1)', borderRadius: '12px', border: '1px solid rgba(0, 208, 255, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#00d0ff', fontWeight: 'bold' }}>Scanning Market...</span>
            <span>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#00d0ff', transition: 'width 0.3s' }}></div>
          </div>
        </div>
      )}

      {!scanning && accumulatingTokens.length === 0 && (
         <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid rgba(30, 41, 59, 0.5)' }}>
           <Box size={48} color="#64748B" style={{ margin: '0 auto 10px auto' }} />
           <h2>No Accumulations Found</h2>
           <p>Could not find any clear boxes with multiple equal highs and lows right now.</p>
         </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {accumulatingTokens.map((token) => (
          <AccumulationChartCard key={token.symbol} token={token} />
        ))}
      </div>
    </div>
  );
};
