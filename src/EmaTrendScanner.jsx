import React, { useState, useEffect, useRef } from 'react';
import { Activity, Play, RefreshCw, BarChart2, TrendingUp, ShieldCheck } from 'lucide-react';
import { fetchTop500Symbols, fetchMaxHistory, calculateEMA } from './logic/scanner';

const TIMEFRAMES = [
  { label: '1W', value: 'W' },
  { label: '1D', value: 'D' },
  { label: '4H', value: '240' },
  { label: '1H', value: '60' },
  { label: '15m', value: '15' }
];

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 1000;

const delay = ms => new Promise(res => setTimeout(res, ms));

const EmaTrendScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [results, setResults] = useState([]);

  const isScanningRef = useRef(false);

  const startScan = async () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);
    setProgress(0);
    setResults([]);

    try {
      const topTokens = await fetchTop500Symbols();
      const tokensToScan = topTokens.slice(0, 100);
      setTotalTokens(tokensToScan.length);

      const allResults = [];

      for (let i = 0; i < tokensToScan.length; i += BATCH_SIZE) {
        const batch = tokensToScan.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (tokenObj) => {
          const symbol = tokenObj.symbol;
          const tokenResult = {
            symbol,
            score: 0,
            tfStatus: {}
          };

          try {
            // We fetch the 5 timeframes concurrently for this token
            await Promise.all(TIMEFRAMES.map(async (tf) => {
              const klines = await fetchMaxHistory(symbol, tf.value, 200); // 200 candles is enough for EMA50
              
              if (!klines || klines.length < 50) {
                tokenResult.tfStatus[tf.value] = false;
                return;
              }

              const closes = klines.map(k => parseFloat(k[4]));
              const currentPrice = closes[closes.length - 1];

              const ema20 = calculateEMA(closes, 20);
              const ema50 = calculateEMA(closes, 50);

              const currentEma20 = ema20[ema20.length - 1];
              const currentEma50 = ema50[ema50.length - 1];

              // Professional EMA Bullish Trend Condition
              const isBullish = currentPrice > currentEma20 && currentEma20 > currentEma50;
              
              tokenResult.tfStatus[tf.value] = isBullish;
              if (isBullish) {
                tokenResult.score += 1;
              }
            }));

            allResults.push(tokenResult);

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

      // Sort by score descending
      allResults.sort((a, b) => b.score - a.score);
      setResults(allResults);

    } catch (e) {
      console.error("Scan failed", e);
    }

    setIsScanning(false);
    isScanningRef.current = false;
  };

  const renderStatus = (isBullish) => {
    if (isBullish) {
      return <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block', minWidth: '40px', textAlign: 'center' }}>V</div>;
    }
    return <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 12px', borderRadius: '4px', display: 'inline-block', minWidth: '40px', textAlign: 'center' }}>X</div>;
  };

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#10b981', margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={24} /> EMA Trend Matrix (Top 100)
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Détection d'alignement de tendance haussière (Prix &gt; EMA 20 &gt; EMA 50)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={startScan}
            disabled={isScanning}
            style={{
              background: isScanning ? 'transparent' : '#10b981',
              color: isScanning ? '#10b981' : '#000',
              border: isScanning ? '1px solid #10b981' : 'none',
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
                Calculs en cours ({progress}/{totalTokens})
              </>
            ) : (
              <>
                <Play size={18} /> Générer la Matrice
              </>
            )}
          </button>
        </div>
      </div>

      {isScanning && (
        <div style={{ width: '100%', height: '4px', background: '#0a1a21', borderRadius: '2px', marginBottom: '2rem', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${totalTokens > 0 ? (progress / totalTokens) * 100 : 0}%`, 
            background: '#10b981',
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      {results.length > 0 && (
        <div style={{ background: 'rgba(10, 26, 33, 0.5)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Symbole</th>
                  <th style={{ padding: '12px' }}>Score</th>
                  {TIMEFRAMES.map(tf => (
                    <th key={tf.value} style={{ padding: '12px' }}>{tf.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((item, idx) => {
                  const isPerfect = item.score === 5;
                  return (
                    <tr key={idx} style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: isPerfect ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                    }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: isPerfect ? '#10b981' : '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.symbol.replace('USDT', '')}
                        {isPerfect && <ShieldCheck size={16} color="#10b981" />}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ 
                          background: item.score >= 4 ? 'rgba(16, 185, 129, 0.2)' : item.score >= 2 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)', 
                          color: item.score >= 4 ? '#10b981' : item.score >= 2 ? '#eab308' : '#ef4444',
                          padding: '4px 8px', borderRadius: '4px', fontWeight: '900'
                        }}>
                          {item.score} / 5
                        </span>
                      </td>
                      {TIMEFRAMES.map(tf => (
                        <td key={tf.value} style={{ padding: '12px', textAlign: 'center' }}>
                          {renderStatus(item.tfStatus[tf.value])}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length === 0 && !isScanning && (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '4rem 0', background: 'rgba(10, 26, 33, 0.5)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <BarChart2 size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <div>Cliquez sur "Générer la Matrice" pour analyser les 100 tokens.</div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
};

export default EmaTrendScanner;
