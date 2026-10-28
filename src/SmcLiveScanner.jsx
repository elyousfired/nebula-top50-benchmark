import React, { useState, useEffect, useRef } from 'react';
import { Target, Activity, Zap, RefreshCw, Layers } from 'lucide-react';
import { fetchBybitData, fetchTop500Symbols } from './logic/scanner';
import { calculateSMC } from './logic/smc';

export const SmcLiveScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState([]);
  const [timeframe, setTimeframe] = useState('15'); // 5m or 15m or 60m
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  const scanRef = useRef(false);

  const startScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    scanRef.current = true;
    setResults([]);
    
    try {
      const symbols = await fetchTop500Symbols();
      const topSymbols = symbols.slice(0, 150); // limit to top 150 to be fast
      setProgress({ current: 0, total: topSymbols.length });
      
      let foundSignals = [];
      const now = Date.now();
      
      // Batch processing to respect rate limits
      for (let i = 0; i < topSymbols.length; i += 20) {
        if (!scanRef.current) break;
        
        const batch = topSymbols.slice(i, i + 20);
        const promises = batch.map(async (sym) => {
          try {
            const klines = await fetchBybitData(sym, timeframe, 150);
            if (!klines || klines.length < 50) return null;
            
            const smcData = calculateSMC(klines);
            if (!smcData) return null;
            
            const { lastSignals, currentPrice, activeBullOBs, activeBearOBs } = smcData;
            
            // Check if OB was formed very recently (last 3 candles)
            const candleMs = parseInt(timeframe) * 60000;
            const isFreshBullOB = lastSignals.bullOB && (now - lastSignals.bullOB.triggeredAt) <= candleMs * 3;
            const isFreshBearOB = lastSignals.bearOB && (now - lastSignals.bearOB.triggeredAt) <= candleMs * 3;
            
            const isStrongBull = lastSignals.strongBull && (now - lastSignals.strongBull.time) <= candleMs * 3;
            const isStrongBear = lastSignals.strongBear && (now - lastSignals.strongBear.time) <= candleMs * 3;

            // Also check for 'Pre-BOS' Engulfing + Volume anomaly on latest candle
            const currentCandle = klines[klines.length - 1];
            const prevCandle = klines[klines.length - 2];
            const volMva = klines.slice(-10).reduce((acc, k) => acc + parseFloat(k[6]), 0) / 10;
            
            const curOpen = parseFloat(currentCandle[1]);
            const curClose = parseFloat(currentCandle[4]);
            const curVol = parseFloat(currentCandle[6]);
            
            const prevOpen = parseFloat(prevCandle[1]);
            const prevClose = parseFloat(prevCandle[4]);
            
            const isBullEngulfing = curClose > curOpen && prevClose < prevOpen && curOpen <= prevClose && curClose >= prevOpen;
            const isBearEngulfing = curClose < curOpen && prevClose > prevOpen && curOpen >= prevClose && curClose <= prevOpen;
            const isHighVol = curVol > volMva * 2;
            
            const potentialBullOB = isBullEngulfing && isHighVol;
            const potentialBearOB = isBearEngulfing && isHighVol;

            if (isFreshBullOB || isFreshBearOB || isStrongBull || isStrongBear || potentialBullOB || potentialBearOB) {
              return {
                symbol: sym,
                price: currentPrice,
                isFreshBullOB,
                isFreshBearOB,
                isStrongBull,
                isStrongBear,
                potentialBullOB,
                potentialBearOB,
                bullOBData: lastSignals.bullOB,
                bearOBData: lastSignals.bearOB
              };
            }
          } catch(e) {}
          return null;
        });

        const batchResults = await Promise.all(promises);
        batchResults.forEach(r => {
          if (r) foundSignals.push(r);
        });
        
        setProgress(p => ({ ...p, current: Math.min(i + 20, topSymbols.length) }));
        // Sleep slightly
        await new Promise(res => setTimeout(res, 300));
      }
      
      setResults(foundSignals);
      
    } catch(err) {
      console.error(err);
    }
    
    setIsScanning(false);
    scanRef.current = false;
  };

  const stopScan = () => {
    scanRef.current = false;
    setIsScanning(false);
  };

  return (
    <div style={{ padding: '20px', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={28} color="#facc15" /> SMC LIVE SCANNER
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Real-time Institutional Order Block & Break of Structure (BOS) Detection
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #334155', padding: '8px 12px', borderRadius: '6px' }}
            disabled={isScanning}
          >
            <option value="5">5 Min</option>
            <option value="15">15 Min</option>
            <option value="60">1 Hour</option>
          </select>
          
          {!isScanning ? (
            <button 
              onClick={startScan}
              style={{ background: '#facc15', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Zap size={16} /> START LIVE SCAN
            </button>
          ) : (
            <button 
              onClick={stopScan}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> STOP SCANNING
            </button>
          )}
        </div>
      </div>

      {isScanning && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Scanning Market Data...</span>
            <span>{progress.current} / {progress.total} Pairs</span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: '#facc15', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
        {results.map((res, i) => (
          <div key={i} style={{ background: 'rgba(25, 30, 40, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
            
            {/* Color Accent Line based on signal type */}
            <div style={{ 
              position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', 
              background: (res.isStrongBull || res.isFreshBullOB || res.potentialBullOB) ? '#10b981' : '#ef4444' 
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingLeft: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{res.symbol.replace('USDT', '')}</h3>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>${res.price >= 0.01 ? res.price.toFixed(3) : res.price.toFixed(5)}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '10px' }}>
              {res.isFreshBullOB && (
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '6px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ✅ NEW BULL OB (BOS UP)
                  <div style={{ fontSize: '0.7rem', marginTop: '2px', opacity: 0.8 }}>Zone: ${res.bullOBData?.bot.toFixed(4)} - ${res.bullOBData?.top.toFixed(4)}</div>
                </div>
              )}
              {res.isFreshBearOB && (
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '6px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  ❌ NEW BEAR OB (BOS DN)
                  <div style={{ fontSize: '0.7rem', marginTop: '2px', opacity: 0.8 }}>Zone: ${res.bearOBData?.bot.toFixed(4)} - ${res.bearOBData?.top.toFixed(4)}</div>
                </div>
              )}
              {res.isStrongBull && (
                <div style={{ background: 'rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '6px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Activity size={14} /> STRONG BULL CONFIRMATION
                </div>
              )}
              {res.isStrongBear && (
                <div style={{ background: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Activity size={14} /> STRONG BEAR CONFIRMATION
                </div>
              )}
              {res.potentialBullOB && !res.isFreshBullOB && (
                <div style={{ background: 'rgba(250, 204, 21, 0.2)', color: '#facc15', padding: '6px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                  ⚠️ POTENTIAL BULL OB FORMING (PRE-BOS)
                </div>
              )}
              {res.potentialBearOB && !res.isFreshBearOB && (
                <div style={{ background: 'rgba(250, 204, 21, 0.2)', color: '#facc15', padding: '6px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                  ⚠️ POTENTIAL BEAR OB FORMING (PRE-BOS)
                </div>
              )}
            </div>

          </div>
        ))}

        {!isScanning && results.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: '#64748b' }}>
            <Layers size={48} style={{ opacity: 0.5, marginBottom: '15px' }} />
            <h3>No Live SMC Signals Right Now</h3>
            <p>Click "Start Live Scan" to poll Bybit for new Break of Structures.</p>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default SmcLiveScanner;
