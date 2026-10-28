import React, { useState, useEffect } from 'react';
import { TrendingUp, RotateCcw, Zap, BarChart3, ShieldCheck } from 'lucide-react';
import { fetchMarketData, calculateRotationHeat } from './logic/sol-engine';
import './index.css';

const AccumulationCard = ({ token, sol }) => {
  const isOutperforming = token.relativeChange > 0;
  const heatmapClass = calculateRotationHeat(token, sol);
  
  // Simple SVG Line Chart for Ratio
  const points = token.klines.map((k, i) => {
    const min = Math.min(...token.klines.map(x => x.close));
    const max = Math.max(...token.klines.map(x => x.close));
    const range = max - min || 1;
    const x = (i / (token.klines.length - 1)) * 260;
    const y = 100 - ((k.close - min) / range) * 80;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="accumulation-card">
      <div className="card-header">
        <div className="token-info">
          <h2>{token.symbol}</h2>
          <p>Ratio: {token.ratio.toFixed(6)} SOL</p>
        </div>
        <div className={`relative-badge ${isOutperforming ? 'positive' : 'negative'}`}>
          {isOutperforming ? '+' : ''}{token.relativeChange.toFixed(2)}% vs SOL
        </div>
      </div>

      <div className="chart-container">
        <svg width="100%" height="100%" viewBox="0 0 260 100" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke={isOutperforming ? '#14F195' : '#ff3b30'}
            strokeWidth="3"
            points={points}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="metric-row">
        <span className="metric-label">USDT PERFORMANCE</span>
        <span className={`metric-value ${token.changeUSDT >= 0 ? 'positive-text' : 'negative-text'}`}>
          {token.changeUSDT > 0 ? '+' : ''}{token.changeUSDT}%
        </span>
      </div>
      
      <div className="metric-row">
        <span className="metric-label">SOL ACCUMULATION EDGE</span>
        <span className="metric-value" style={{ color: isOutperforming ? '#14F195' : '#888' }}>
          {isOutperforming ? 'ACCUMULATING' : 'DILUTING'}
        </span>
      </div>

      <div className={`rotation-tag ${heatmapClass === 'HOT' ? 'tag-hot' : heatmapClass === 'WARM' ? 'tag-warm' : 'tag-cool'}`}>
        Rotation: {heatmapClass}
      </div>
    </div>
  );
};

const AppSOL = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const result = await fetchMarketData();
    if (result) {
      setData(result);
      setLastUpdate(new Date().toLocaleTimeString());
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="sol-app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="logo-text" style={{ fontSize: '2rem', animation: 'pulse 2s infinite' }}>NEBULA SOL...</div>
      </div>
    );
  }

  return (
    <div className="sol-app-container">
      <header className="sol-header">
        <div className="logo-section">
          <div className="logo-text">NEBULA SOL ACCUMULATOR</div>
          <div className="bench-badge">BENCHMARK: SOLANA</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="scanning-indicator" title="Live Scanning"></div>
          <span style={{ color: '#888', fontSize: '0.75rem', fontWeight: '700' }}>SYNC: {lastUpdate}</span>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">SOL PRICE (BENCHMARK)</div>
          <div className="stat-value" style={{ color: '#fff' }}>${data?.sol.price.toFixed(2)}</div>
          <div style={{ color: data?.sol.change >= 0 ? '#14F195' : '#ff3b30', fontSize: '0.8rem', fontWeight: '800', marginTop: '5px' }}>
            {data?.sol.change > 0 ? '+' : ''}{data?.sol.change}% (24H)
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">MARKET DOMINANCE</div>
          <div className="stat-value" style={{ color: 'var(--solana-cyan)' }}>SOLANA</div>
          <div style={{ color: '#888', fontSize: '0.8rem', fontWeight: '800', marginTop: '5px' }}>ECOSYSTEM ROTATION ACTIVE</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">STRATEGY MODE</div>
          <div className="stat-value" style={{ color: 'var(--solana-green)' }}>ACCUMULATION</div>
          <div style={{ color: '#888', fontSize: '0.8rem', fontWeight: '800', marginTop: '5px' }}>FOCUS: MAXIMIZE SOL QUANTITY</div>
        </div>
      </div>

      <div className="grid-layout">
        {data?.tokens.map((token) => (
          <AccumulationCard key={token.symbol} token={token} sol={data.sol} />
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .positive-text { color: #14F195; }
        .negative-text { color: #ff3b30; }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}} />
    </div>
  );
};

export default AppSOL;
