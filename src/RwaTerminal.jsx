import React, { useState, useEffect } from 'react';
import './rwa-index.css';

// Données simulées pour l'étude initiale
const INITIAL_ASSETS = [
  {
    ticker: 'NVDA',
    name: 'Nvidia Corporation',
    tradfiPrice: 903.45,
    sector: 'Tech',
    exchanges: [
      { id: 'kraken', name: 'Kraken', price: 905.12, liquid: 'High' },
      { id: 'bybit', name: 'Bybit', price: 904.80, liquid: 'Medium' },
      { id: 'okx', name: 'OKX (Perp)', price: 902.90, liquid: 'High' }
    ]
  },
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    tradfiPrice: 182.63,
    sector: 'Tech',
    exchanges: [
      { id: 'kraken', name: 'Kraken', price: 182.95, liquid: 'High' },
      { id: 'bybit', name: 'Bybit', price: 182.40, liquid: 'Medium' },
      { id: 'bitget', name: 'Bitget', price: 182.10, liquid: 'Low' }
    ]
  },
  {
    ticker: 'TSLA',
    name: 'Tesla, Inc.',
    tradfiPrice: 175.20,
    sector: 'Automotive',
    exchanges: [
      { id: 'kraken', name: 'Kraken', price: 176.05, liquid: 'Medium' },
      { id: 'okx', name: 'OKX (Perp)', price: 174.80, liquid: 'High' }
    ]
  },
  {
    ticker: 'XAU',
    name: 'Gold (Tokenized)',
    tradfiPrice: 2345.10,
    sector: 'Commodities',
    exchanges: [
      { id: 'paxg', name: 'Pax Gold', price: 2348.50, liquid: 'Extreme' },
      { id: 'bybit', name: 'Bybit', price: 2344.00, liquid: 'High' }
    ]
  }
];

const RwaTerminal = () => {
  const [assets, setAssets] = useState(INITIAL_ASSETS);
  const [marketStatus, setMarketStatus] = useState('Nasdaq: OPEN');

  // Simulation de mise à jour des prix pour l'arbitrage
  useEffect(() => {
    const interval = setInterval(() => {
      setAssets(prev => prev.map(asset => ({
        ...asset,
        exchanges: asset.exchanges.map(ex => ({
          ...ex,
          price: ex.price + (Math.random() - 0.5) * 0.5
        }))
      })));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const calculateSpread = (tradfi, crypto) => {
    const diff = ((crypto - tradfi) / tradfi) * 100;
    return diff.toFixed(2);
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2 style={{ color: 'var(--accent-gold)', marginBottom: '2rem', fontSize: '1.2rem' }}>RWA INTELLIGENCE</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>• Dashboard</div>
          <div style={{ color: 'var(--text-secondary)' }}>• Arbitrage Matrix</div>
          <div style={{ color: 'var(--text-secondary)' }}>• Asset Explorer</div>
          <div style={{ color: 'var(--text-secondary)' }}>• Portfolio</div>
          <div style={{ color: 'var(--text-secondary)' }}>• Settings</div>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--success)' }}>{marketStatus}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px' }}>
            RWA <span style={{ color: 'var(--accent-gold)' }}>Terminal</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Surveillance globale des actifs du monde réel tokenisés.</p>
        </header>

        {/* Top Stats */}
        <div className="header-stats">
          <div className="glass-card">
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Global RWA MCAP</div>
            <div className="stat-value">$14.2B</div>
            <div style={{ color: 'var(--success)', fontSize: '0.8rem' }}>+2.4% (24h)</div>
          </div>
          <div className="glass-card">
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Max Arbitrage Opportunity</div>
            <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>0.82%</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>NVDA (Kraken / OKX)</div>
          </div>
          <div className="glass-card">
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>TradFi Volatility</div>
            <div className="stat-value">Low</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>VIX: 12.45</div>
          </div>
        </div>

        {/* Arbitrage Matrix */}
        <section className="glass-card" style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-gold)', paddingLeft: '1rem' }}>Arbitrage Matrix (Bourse vs CEX)</h3>
          <table className="arbitrage-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Nasdaq Price</th>
                <th>CEX Platform</th>
                <th>CEX Price</th>
                <th>Spread (%)</th>
                <th>Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => (
                <React.Fragment key={asset.ticker}>
                  {asset.exchanges.map((ex, index) => {
                    const spread = calculateSpread(asset.tradfiPrice, ex.price);
                    return (
                      <tr key={`${asset.ticker}-${ex.id}`}>
                        {index === 0 && (
                          <td rowSpan={asset.exchanges.length} style={{ fontWeight: '700' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{asset.ticker}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '400' }}>{asset.name}</span>
                            </div>
                          </td>
                        )}
                        {index === 0 && (
                          <td rowSpan={asset.exchanges.length} style={{ color: 'var(--text-secondary)' }}>
                            ${asset.tradfiPrice.toLocaleString()}
                          </td>
                        )}
                        <td style={{ color: 'var(--accent-cyan)' }}>{ex.name}</td>
                        <td style={{ fontWeight: '600' }}>${ex.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                          <span className={`spread-tag ${parseFloat(spread) >= 0 ? 'spread-positive' : 'spread-negative'}`}>
                            {spread > 0 ? '+' : ''}{spread}%
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[1, 2, 3].map(i => (
                              <div key={i} style={{ 
                                width: '12px', 
                                height: '4px', 
                                background: i <= (ex.liquid === 'High' ? 3 : ex.liquid === 'Medium' ? 2 : 1) ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)',
                                borderRadius: '2px'
                              }}></div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
};

export default RwaTerminal;
