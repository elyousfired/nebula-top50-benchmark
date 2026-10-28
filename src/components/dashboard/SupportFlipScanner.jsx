import React, { useState, useEffect } from 'react';
import { fetchTop500Symbols, fetchBybitData, fetchDepth } from '../../logic/scanner';
import { ShieldCheck, Play, Activity } from 'lucide-react';
import { SupportFlipChartCard } from './SupportFlipChartCard';

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

export const SupportFlipScanner = () => {
  const [detectedTokens, setDetectedTokens] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const startScan = async () => {
    setScanning(true);
    setProgress(0);
    setDetectedTokens([]);

    try {
      // 1. Fetch Top Symbols
      const allSymbols = await fetchTop500Symbols(false, 500);
      
      // 2. Filter tokens that are pumping (e.g., > 2% 24h change)
      const pumpingTokens = allSymbols.filter(t => parseFloat(t.priceChangePercent) >= 2.0);
      
      const found = [];

      for (let i = 0; i < pumpingTokens.length; i++) {
        const token = pumpingTokens[i];
        setProgress(Math.round(((i + 1) / pumpingTokens.length) * 100));

        try {
          // Fetch Order Book Depth
          const depth = await fetchDepth(token.symbol);
          if (!depth || (!depth.b && !depth.bids)) continue;

          const bids = depth.b || depth.bids;
          if (!bids || bids.length === 0) continue;

          let largestWall = { price: 0, qty: 0, value: 0 };
          let totalBidsValue = 0;

          bids.forEach(b => {
            const p = parseFloat(b[0]);
            const q = parseFloat(b[1]);
            const val = p * q;
            totalBidsValue += val;
            
            if (val > largestWall.value) {
              largestWall = { price: p, qty: q, value: val };
            }
          });

          // Conditions for a "Support Flip" Buy Wall
          // 1. Minimum value (e.g. $5000)
          if (largestWall.value < 5000) continue;

          const currentPrice = parseFloat(token.lastPrice);
          const priceDiffPct = ((currentPrice - largestWall.price) / currentPrice) * 100;

          // 2. Wall must be below current price but within 5% distance
          if (largestWall.price < currentPrice && priceDiffPct > 0 && priceDiffPct <= 5) {
            
            // Fetch Klines to display the chart
            const rawKlines = await fetchBybitData(token.symbol, '60', 100);
            if (!rawKlines || rawKlines.length < 50) continue;
            
            const klines = parseCandles(rawKlines);

            found.push({
              symbol: token.symbol,
              priceChangePct: parseFloat(token.priceChangePercent),
              currentPrice,
              wallPrice: largestWall.price,
              wallValue: largestWall.value,
              wallQty: largestWall.qty,
              priceDiffPct,
              klines,
              totalBidsValue
            });

            // Update UI dynamically
            setDetectedTokens([...found].sort((a,b) => b.wallValue - a.wallValue));
          }
        } catch (err) {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  return (
    <div style={{ padding: '20px', color: '#fff', background: '#090915', borderRadius: '16px', border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck color="#00ff88" size={28} />
            ORDER BOOK SUPPORT FLIP DETECTOR
          </h2>
          <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '0.9rem' }}>
            Scans pumping tokens for massive Buy Walls defending the breakout level.
          </p>
        </div>
        
        <button 
          onClick={startScan} 
          disabled={scanning}
          style={{
            background: scanning ? '#1e293b' : '#00ff88',
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
            <><Activity className="animate-spin" size={18} /> SCANNING {progress}%</>
          ) : (
            <><Play size={18} /> START SCAN</>
          )}
        </button>
      </div>

      {scanning && (
        <div style={{ width: '100%', height: '4px', background: '#1e293b', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#00ff88', transition: 'width 0.3s' }} />
        </div>
      )}

      {detectedTokens.length === 0 && !scanning && progress === 100 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          No support walls detected in the current conditions.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {detectedTokens.map(token => (
          <SupportFlipChartCard key={token.symbol} token={token} />
        ))}
      </div>
    </div>
  );
};
