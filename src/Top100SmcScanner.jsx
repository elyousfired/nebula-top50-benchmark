import React, { useState, useEffect, useRef } from 'react';
import { Activity, Play, RefreshCw, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { fetchTop500Symbols, fetchMaxHistory } from './logic/scanner';
import { calculateSMC } from './logic/smc';

const TIMEFRAMES = [
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' }
];

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 1000;

const delay = ms => new Promise(res => setTimeout(res, ms));

const Top100SmcScanner = () => {
  const [activeTimeframe, setActiveTimeframe] = useState('15');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  
  const [bullishResults, setBullishResults] = useState([]);
  const [bearishResults, setBearishResults] = useState([]);

  const [isAutoScan, setIsAutoScan] = useState(false);
  const knownOBsRef = useRef(new Set());
  const isFirstScanRef = useRef(true);
  const isScanningRef = useRef(false);

  useEffect(() => {
    knownOBsRef.current.clear();
    isFirstScanRef.current = true;
  }, [activeTimeframe]);

  useEffect(() => {
    let timeoutId;
    const loop = async () => {
      if (isAutoScan && !isScanningRef.current) {
        await startScan();
      }
      if (isAutoScan) {
        timeoutId = setTimeout(loop, 60000);
      }
    };
    if (isAutoScan) {
      loop();
    }
    return () => clearTimeout(timeoutId);
  }, [isAutoScan, activeTimeframe]);

  const startScan = async () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);
    setProgress(0);
    setBullishResults([]);
    setBearishResults([]);

    try {
      const topTokens = await fetchTop500Symbols();
      const tokensToScan = topTokens.slice(0, 100);
      setTotalTokens(tokensToScan.length);

      const allBullish = [];
      const allBearish = [];

      for (let i = 0; i < tokensToScan.length; i += BATCH_SIZE) {
        const batch = tokensToScan.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (tokenObj) => {
          const symbol = tokenObj.symbol;
          try {
            // Fetch 1000 candles to ensure enough history for OB calculation
            const klines = await fetchMaxHistory(symbol, activeTimeframe, 1000);
            if (!klines || klines.length === 0) return;

            const chronKlines = [...klines].reverse();
            const currentPrice = parseFloat(chronKlines[chronKlines.length - 1][4]);
            
            const smcData = calculateSMC(chronKlines);
            if (!smcData) return;

            // Find closest Bullish OB (must be below current price)
            let closestBull = null;
            let minBullDist = Infinity;
            if (smcData.activeBullOBs) {
              smcData.activeBullOBs.forEach(ob => {
                const obId = `${symbol}-${activeTimeframe}-BULL-${ob.top}-${ob.bot}`;
                if (!knownOBsRef.current.has(obId)) {
                  ob.isNew = !isFirstScanRef.current;
                  knownOBsRef.current.add(obId);
                }

                if (currentPrice > ob.top) { // Price is above the OB
                  const dist = ((currentPrice - ob.top) / currentPrice) * 100;
                  if (dist < minBullDist) {
                    minBullDist = dist;
                    closestBull = { ...ob, distance: dist };
                  }
                }
              });
            }

            // Find closest Bearish OB (must be above current price)
            let closestBear = null;
            let minBearDist = Infinity;
            if (smcData.activeBearOBs) {
              smcData.activeBearOBs.forEach(ob => {
                const obId = `${symbol}-${activeTimeframe}-BEAR-${ob.top}-${ob.bot}`;
                if (!knownOBsRef.current.has(obId)) {
                  ob.isNew = !isFirstScanRef.current;
                  knownOBsRef.current.add(obId);
                }

                if (currentPrice < ob.bot) { // Price is below the OB
                  const dist = ((ob.bot - currentPrice) / currentPrice) * 100;
                  if (dist < minBearDist) {
                    minBearDist = dist;
                    closestBear = { ...ob, distance: dist };
                  }
                }
              });
            }

            if (closestBull && closestBull.distance < 15) { // Filter out things too far
              allBullish.push({
                symbol,
                price: currentPrice,
                obTop: closestBull.top,
                obBot: closestBull.bot,
                distance: closestBull.distance,
                isNew: closestBull.isNew
              });
            }

            if (closestBear && closestBear.distance < 15) {
              allBearish.push({
                symbol,
                price: currentPrice,
                obBot: closestBear.bot,
                obTop: closestBear.top,
                distance: closestBear.distance,
                isNew: closestBear.isNew
              });
            }

          } catch (e) {
            console.error(`Error scanning ${symbol}:`, e);
          }
        }));

        setProgress(prev => Math.min(prev + BATCH_SIZE, tokensToScan.length));
        
        // Wait before next batch to prevent rate limiting
        if (i + BATCH_SIZE < tokensToScan.length) {
          await delay(DELAY_BETWEEN_BATCHES);
        }
      }

      // Sort by proximity
      allBullish.sort((a, b) => a.distance - b.distance);
      allBearish.sort((a, b) => a.distance - b.distance);

      setBullishResults(allBullish);
      setBearishResults(allBearish);

    } catch (e) {
      console.error("Scan failed", e);
    }

    setIsScanning(false);
    isScanningRef.current = false;
    isFirstScanRef.current = false;
  };

  const renderTable = (data, type) => {
    const isBull = type === 'BULL';
    return (
      <div style={{ flex: 1, minWidth: '300px', background: 'rgba(10, 26, 33, 0.5)', borderRadius: '12px', padding: '1rem', border: `1px solid ${isBull ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isBull ? '#10b981' : '#ef4444', marginTop: 0 }}>
          {isBull ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          Opportunités {type}
        </h3>
        
        {data.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>Aucune zone proche détectée.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px' }}>Symbole</th>
                  <th style={{ padding: '8px 4px' }}>Prix</th>
                  <th style={{ padding: '8px 4px' }}>Zone OB</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Distance</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 4px', fontWeight: 'bold', color: '#fff' }}>
                      {item.symbol.replace('USDT', '')}
                      {item.isNew && <span style={{ marginLeft: '8px', background: '#ff3b30', color: '#fff', fontSize: '0.6rem', padding: '2px 4px', borderRadius: '4px', animation: 'pulse 2s infinite' }}>NEW 🚨</span>}
                    </td>
                    <td style={{ padding: '10px 4px', color: '#f8fafc' }}>${item.price.toFixed(4)}</td>
                    <td style={{ padding: '10px 4px', color: isBull ? '#10b981' : '#ef4444' }}>
                      {item.obTop.toFixed(4)} - {item.obBot.toFixed(4)}
                    </td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 'bold', color: item.distance < 2 ? '#00f0ff' : '#94a3b8' }}>
                      {item.distance.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ color: '#00f0ff', margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={24} /> Top 100 SMC Scanner
        </h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#0a1a21', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => !isScanning && setActiveTimeframe(tf.value)}
                disabled={isScanning}
                style={{
                  background: activeTimeframe === tf.value ? '#00f0ff' : 'transparent',
                  color: activeTimeframe === tf.value ? '#000' : '#64748b',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                  opacity: isScanning && activeTimeframe !== tf.value ? 0.5 : 1
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button 
            onClick={startScan}
            disabled={isScanning}
            style={{
              background: isScanning ? 'transparent' : '#00f0ff',
              color: isScanning ? '#00f0ff' : '#000',
              border: isScanning ? '1px solid #00f0ff' : 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            {isScanning ? (
              <>
                <RefreshCw size={18} className="spin" /> 
                Scan en cours ({progress}/{totalTokens})
              </>
            ) : (
              <>
                <Play size={18} /> Lancer le Scan
              </>
            )}
          </button>
          
          <button 
            onClick={() => setIsAutoScan(!isAutoScan)}
            style={{
              background: isAutoScan ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
              color: isAutoScan ? '#00f0ff' : '#64748b',
              border: `1px solid ${isAutoScan ? '#00f0ff' : 'rgba(255,255,255,0.2)'}`,
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={18} />
            Auto-Scan 1m {isAutoScan ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {isScanning && (
        <div style={{ width: '100%', height: '4px', background: '#0a1a21', borderRadius: '2px', marginBottom: '2rem', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${totalTokens > 0 ? (progress / totalTokens) * 100 : 0}%`, 
            background: '#00f0ff',
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {renderTable(bullishResults, 'BULL')}
        {renderTable(bearishResults, 'BEAR')}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
};

export default Top100SmcScanner;
