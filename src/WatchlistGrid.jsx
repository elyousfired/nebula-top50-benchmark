import React, { useState, useEffect } from 'react';
import { TradingViewChart } from './App';

export const WatchlistGrid = () => {
  const [tokens, setTokens] = useState(() => {
    try {
      const saved = localStorage.getItem('nebula_watchlist_20');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return Array(20).fill('');
  });

  const handleTokenChange = (index, value) => {
    const newTokens = [...tokens];
    newTokens[index] = value.toUpperCase().trim();
    setTokens(newTokens);
    localStorage.setItem('nebula_watchlist_20', JSON.stringify(newTokens));
  };

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>📊 Multi-Charts (Token / SOL)</h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', 
        gap: '30px',
        width: '100%'
      }}>
        {tokens.map((token, idx) => (
          <div key={idx} style={{ 
            background: '#131722', 
            borderRadius: '8px', 
            border: '1px solid #2a2e39',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '600px'
          }}>
            <div style={{ padding: '10px', background: '#1e222d', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#888', marginRight: '10px', fontWeight: 'bold' }}>#{idx + 1}</span>
              <input 
                type="text" 
                value={token}
                onChange={(e) => handleTokenChange(idx, e.target.value)}
                placeholder="Ex: JUP"
                style={{
                  background: '#2a2e39',
                  border: '1px solid #434651',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  width: '100px',
                  fontWeight: 'bold',
                  outline: 'none'
                }}
              />
              {token && <span style={{ color: '#00d2ff', marginLeft: '10px', fontWeight: 'bold' }}>/ SOL</span>}
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {token && token.length > 1 ? (
                <TradingViewChart 
                  symbol={`${token}/SOL`} 
                  hideControls={false} 
                  showMiniCharts={false} 
                  initialTimeframe="60"
                  minimalToolbar={true}
                />
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#434651', fontWeight: 'bold' }}>
                  SAISIR UN TOKEN POUR AFFICHER LE GRAPHIQUE
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
