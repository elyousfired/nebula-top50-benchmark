import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

const BtcCorrelationScanner = () => {
  const [timeframe, setTimeframe] = useState('15m');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const fetchWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.retCode !== 0) throw new Error(data.retMsg);
        return data;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };

  const calculateCVD = (klines) => {
    // klines format: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
    // Returns array of objects { time, cvd }
    let cumulativeFlow = 0;
    const cvdArray = [];
    
    // Bybit returns newest first, so we reverse it
    const sortedKlines = [...klines].reverse();
    
    for (const k of sortedKlines) {
      const timeMs = parseInt(k[0]);
      const open = parseFloat(k[1]);
      const close = parseFloat(k[4]);
      const turnover = parseFloat(k[6]);
      
      if (open > 0) {
        const flow = turnover * ((close - open) / open);
        cumulativeFlow += flow;
      }
      cvdArray.push({ time: timeMs, cvd: cumulativeFlow });
    }
    return cvdArray;
  };

  const calculatePearson = (x, y) => {
    if (x.length === 0 || y.length === 0 || x.length !== y.length) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    if (denominator === 0) return 0;
    return numerator / denominator;
  };

  const runScan = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setResults([]);

    try {
      // 1. Fetch Top 100 Coins
      setProgress(5);
      const tickersData = await fetchWithRetry('https://api.bybit.com/v5/market/tickers?category=spot');
      let symbols = tickersData.result.list
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
        .map(t => t.symbol);
        
      symbols = symbols.slice(0, 100); // Top 100

      // Map timeframe
      let intervalParam = '15';
      if (timeframe === '15m') intervalParam = '15';
      else if (timeframe === '1h') intervalParam = '60';
      else if (timeframe === '4H') intervalParam = '240';
      else if (timeframe === '1D') intervalParam = 'D';

      // 2. Fetch BTC CVD
      setProgress(10);
      const btcKlines = await fetchWithRetry(`https://api.bybit.com/v5/market/kline?category=spot&symbol=BTCUSDT&interval=${intervalParam}&limit=100`);
      const btcCvd = calculateCVD(btcKlines.result.list);
      
      if (btcCvd.length === 0) throw new Error("Impossible de charger le flux du BTC");
      
      const btcTimeMap = new Map();
      btcCvd.forEach((item, index) => {
        btcTimeMap.set(item.time, { index, cvd: item.cvd });
      });

      // 3. Fetch Altcoins CVD in batches
      const batchSize = 10;
      const correlations = [];
      let completed = 0;

      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const promises = batch.map(async (symbol) => {
          if (symbol === 'BTCUSDT') return null;
          
          try {
            const klines = await fetchWithRetry(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${intervalParam}&limit=100`, 2);
            const altCvd = calculateCVD(klines.result.list);
            
            // Align data by time
            const alignedBtc = [];
            const alignedAlt = [];
            
            for (const item of altCvd) {
              if (btcTimeMap.has(item.time)) {
                alignedBtc.push(btcTimeMap.get(item.time).cvd);
                alignedAlt.push(item.cvd);
              }
            }
            
            if (alignedBtc.length > 30) { // Require at least 30 matching periods for meaningful correlation
              const correlation = calculatePearson(alignedBtc, alignedAlt);
              
              // Determine current trend visually
              const firstAlt = alignedAlt[0];
              const lastAlt = alignedAlt[alignedAlt.length - 1];
              const altTrend = lastAlt > firstAlt ? 'UP' : 'DOWN';
              
              return {
                symbol,
                correlation: correlation * 100, // Percentage
                altTrend,
                candlesCount: alignedBtc.length
              };
            }
          } catch (e) {
            console.log(`Failed to fetch ${symbol}`);
          }
          return null;
        });

        const batchResults = await Promise.all(promises);
        batchResults.forEach(r => {
          if (r) correlations.push(r);
        });
        
        completed += batch.length;
        setProgress(10 + Math.floor((completed / symbols.length) * 90));
        
        // Small delay to respect rate limit
        await new Promise(r => setTimeout(r, 200));
      }

      // Sort by correlation descending
      correlations.sort((a, b) => b.correlation - a.correlation);
      setResults(correlations);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  useEffect(() => {
    runScan();
  }, [timeframe]);

  return (
    <div className="btc-corr-container">
      <div className="btc-corr-header">
        <div>
          <h2>
            <Activity color="#3b82f6" size={24} style={{ marginRight: '10px' }} />
            BTC Net Flow Correlation
          </h2>
          <p>Find altcoins following or ignoring Bitcoin's institutional flow.</p>
        </div>
        
        <div className="timeframe-selector">
          {['15m', '1h', '4H', '1D'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
              disabled={loading}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="loading-text">
            <span>Scanning Top 100 coins...</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="table-container">
          <table className="corr-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Coin</th>
                <th>Net Flow Correlation (BTC)</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res, index) => {
                let color = "#cbd5e1";
                let bgColor = "transparent";
                let classification = "Neutral";
                let borderColor = "#334155";
                
                if (res.correlation >= 75) {
                  color = "#4ade80"; // green
                  bgColor = "rgba(20, 83, 45, 0.3)";
                  borderColor = "rgba(21, 128, 61, 0.5)";
                  classification = "Highly Correlated (Follows BTC)";
                } else if (res.correlation <= -50) {
                  color = "#f87171"; // red
                  bgColor = "rgba(127, 29, 29, 0.3)";
                  borderColor = "rgba(185, 28, 28, 0.5)";
                  classification = "Inverse (Fights BTC)";
                } else if (res.correlation > -20 && res.correlation < 20) {
                  color = "#facc15"; // yellow
                  bgColor = "rgba(113, 63, 18, 0.3)";
                  borderColor = "rgba(161, 98, 7, 0.5)";
                  classification = "Uncorrelated (Own Flow)";
                }

                return (
                  <tr key={res.symbol}>
                    <td style={{ color: '#94a3b8' }}>#{index + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>{res.symbol.replace('USDT', '')}</span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/USDT</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'bold', color: color, fontSize: '1.1rem' }}>
                        {res.correlation.toFixed(1)}%
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 12px', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        border: `1px solid ${borderColor}`, 
                        background: bgColor, 
                        color: color 
                      }}>
                        {classification}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .btc-corr-container { padding: 24px; background: #0f172a; min-height: 100vh; color: #e2e8f0; font-family: 'Inter', sans-serif; }
        .btc-corr-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
        @media(min-width: 640px) { .btc-corr-header { flex-direction: row; justify-content: space-between; align-items: center; } }
        .btc-corr-header h2 { display: flex; align-items: center; font-size: 1.5rem; font-weight: bold; color: #fff; margin: 0 0 8px 0; }
        .btc-corr-header p { color: #94a3b8; margin: 0; }
        .timeframe-selector { display: flex; gap: 8px; background: #1e293b; padding: 4px; border-radius: 8px; }
        .tf-btn { padding: 8px 16px; border-radius: 6px; font-weight: 500; border: none; background: transparent; color: #94a3b8; cursor: pointer; transition: all 0.2s; }
        .tf-btn:hover { color: #fff; background: #334155; }
        .tf-btn.active { background: #2563eb; color: #fff; }
        .loading-container { margin-bottom: 24px; }
        .loading-text { display: flex; justify-content: space-between; font-size: 0.875rem; color: #94a3b8; margin-bottom: 8px; }
        .progress-bar-bg { width: 100%; background: #1e293b; border-radius: 9999px; height: 8px; }
        .progress-bar-fill { background: #3b82f6; height: 8px; border-radius: 9999px; transition: width 0.3s ease; }
        .error-box { padding: 16px; background: rgba(127, 29, 29, 0.5); border: 1px solid #ef4444; border-radius: 8px; color: #fecaca; margin-bottom: 24px; }
        .table-container { background: #1e293b; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); border: 1px solid #334155; overflow: hidden; }
        .corr-table { width: 100%; text-align: left; border-collapse: collapse; }
        .corr-table th { padding: 16px; font-weight: 600; background: rgba(15, 23, 42, 0.5); color: #94a3b8; font-size: 0.875rem; border-bottom: 1px solid #334155; }
        .corr-table td { padding: 16px; border-bottom: 1px solid rgba(51, 65, 85, 0.5); transition: background-color 0.2s; }
        .corr-table tbody tr:hover td { background: rgba(51, 65, 85, 0.3); }
        `
      }} />
    </div>
  );
};

export default BtcCorrelationScanner;
