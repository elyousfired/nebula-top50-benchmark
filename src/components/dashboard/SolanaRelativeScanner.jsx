import React, { useState, useEffect } from 'react';
import { Activity, Play, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { fetchBybitData, fetchTop500Symbols } from '../../logic/scanner';

const parseCandles = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(k => ({
    time: Number(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  })).sort((a, b) => a.time - b.time);
};

export const SolanaRelativeScanner = () => {
  const [solCandle, setSolCandle] = useState(null);
  const [solPct, setSolPct] = useState(0);
  const [isSolGreen, setIsSolGreen] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const startScan = async () => {
    setScanning(true);
    setProgress(0);
    setTokens([]);

    try {
      // 1. Fetch SOL 4H Data
      const rawSolData = await fetchBybitData('SOLUSDT', '240', 10);
      if (!rawSolData || rawSolData.length < 2) {
        setScanning(false);
        return;
      }
      const solData = parseCandles(rawSolData);
      
      // Get the PREVIOUS 4H candle (the one that just closed)
      const prevSolCandle = solData[solData.length - 2];
      const solPerf = ((prevSolCandle.close - prevSolCandle.open) / prevSolCandle.open) * 100;
      const isGreen = solPerf >= 0;
      
      setSolCandle(prevSolCandle);
      setSolPct(solPerf);
      setIsSolGreen(isGreen);

      // 2. Fetch all Bybit Spot symbols
      const allSymbols = await fetchTop500Symbols(false, 1500);
      
      const matchedTokens = [];
      
      // 3. Scan each token
      for (let i = 0; i < allSymbols.length; i++) {
        const token = allSymbols[i];
        setProgress(Math.round(((i + 1) / allSymbols.length) * 100));
        
        try {
          const rawTokenData = await fetchBybitData(token.symbol, '240', 10);
          if (!rawTokenData || rawTokenData.length < 2) continue;
          
          const tokenData = parseCandles(rawTokenData);
          
          // Match the exact same candle time as SOL
          const matchingCandle = tokenData.find(k => k.time === prevSolCandle.time);
          if (!matchingCandle) continue;
          
          const tokenPerf = ((matchingCandle.close - matchingCandle.open) / matchingCandle.open) * 100;
          
          // Logic requested by user
          let isMatch = false;
          if (isGreen) {
            // SOL is GREEN: Token must be GREEN and perform BETTER than SOL
            if (tokenPerf > 0 && tokenPerf > solPerf) {
              isMatch = true;
            }
          } else {
            // SOL is RED: Token must be GREEN (pumped despite SOL dropping)
            if (tokenPerf > 0) {
              isMatch = true;
            }
          }
          
          if (isMatch) {
            matchedTokens.push({
              symbol: token.symbol,
              perf: tokenPerf,
              vsSol: tokenPerf - solPerf,
              close: matchingCandle.close
            });
          }
        } catch (e) {
          console.error(`Error fetching ${token.symbol}`, e);
        }
      }
      
      // Sort by performance vs SOL
      matchedTokens.sort((a, b) => b.vsSol - a.vsSol);
      setTokens(matchedTokens);
      
    } catch (e) {
      console.error("Error in Solana Relative Scan", e);
    }
    
    setScanning(false);
  };

  return (
    <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: '#0a101d', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b' }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} color="#00ff88" />
            SOLANA RELATIVE STRENGTH (4H)
          </h2>
          <p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
            Analyse la dernière bougie 4H clôturée de SOL. Si SOL est vert, trouve les tokens qui l'ont surperformé. Si SOL est rouge, trouve les tokens qui sont restés verts.
          </p>
        </div>
        <button 
          onClick={startScan}
          disabled={scanning}
          style={{ 
            background: scanning ? '#1e293b' : 'linear-gradient(135deg, #00ff88, #00d0ff)',
            color: scanning ? '#888' : '#000',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: scanning ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s'
          }}
        >
          {scanning ? <Activity className="spin" size={20} /> : <Play size={20} />}
          {scanning ? `SCANNING (${progress}%)` : 'START SCAN'}
        </button>
      </div>

      {solCandle && (
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          <div style={{ background: '#0a101d', padding: '20px', borderRadius: '12px', border: `1px solid ${isSolGreen ? 'rgba(0,255,136,0.3)' : 'rgba(255,59,48,0.3)'}`, minWidth: '250px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>DERNIÈRE BOUGIE SOL (4H)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '2rem', fontWeight: 'bold', color: isSolGreen ? '#00ff88' : '#ff3b30' }}>
                {solPct > 0 ? '+' : ''}{solPct.toFixed(2)}%
              </span>
              {isSolGreen ? <TrendingUp size={24} color="#00ff88" /> : <AlertTriangle size={24} color="#ff3b30" />}
            </div>
            <span style={{ color: '#888', fontSize: '0.7rem', display: 'block', marginTop: '10px' }}>
              Time: {new Date(solCandle.time).toLocaleString()}
            </span>
          </div>
          
          <div style={{ background: '#0a101d', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>CONDITION DE DÉTECTION ACTUELLE :</span>
            <span style={{ color: '#fff', fontSize: '1.2rem', marginTop: '5px' }}>
              {isSolGreen 
                ? "🚀 SOL est Vert. Recherche de tokens qui ont fait MIEUX que SOL." 
                : "🛡️ SOL est Rouge. Recherche de tokens qui sont restés VERTS malgré la chute."}
            </span>
          </div>
        </div>
      )}

      {tokens.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
          {tokens.map((t, idx) => (
            <div key={idx} style={{ background: '#0a101d', border: '1px solid #1e293b', borderRadius: '12px', padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{t.symbol.replace('USDT', '')}</h3>
                <span style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                  +{t.perf.toFixed(2)}%
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>vs SOL:</span>
                <span style={{ color: '#00d0ff', fontWeight: 'bold', fontSize: '0.8rem' }}>
                  +{t.vsSol.toFixed(2)}% d'écart
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                 <span style={{ color: '#888', fontSize: '0.8rem' }}>Price:</span>
                 <span style={{ color: '#fff', fontSize: '0.8rem' }}>${t.close}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!scanning && solCandle && tokens.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Aucun token n'a rempli les critères sur cette bougie 4H.
        </div>
      )}
    </div>
  );
};
