import React from 'react';

const HEATMAP_DATA = [
  { symbol: 'PEPE', change: 12.5 },
  { symbol: 'SOL', change: 8.2 },
  { symbol: 'WIF', change: 15.4 },
  { symbol: 'RENDER', change: 6.1 },
  { symbol: 'ONDO', change: -4.2 },
  { symbol: 'TIA', change: -8.5 },
  { symbol: 'AVAX', change: 2.1 },
  { symbol: 'INJ', change: -1.5 },
  { symbol: 'FET', change: 5.5 },
  { symbol: 'LINK', change: 1.2 },
  { symbol: 'AR', change: 10.2 },
  { symbol: 'NEAR', change: -2.3 },
];

export const MarketHeatmap = () => {
  return (
    <div style={{ background: '#080B10', borderRadius: '8px', border: '1px solid #1A202C', padding: '15px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h3 style={{ color: '#fff', fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Volatility Heatmap</h3>
        <span style={{ color: '#64748B', fontSize: '0.75rem', background: '#12161F', padding: '2px 8px', borderRadius: '4px' }}>Top 12</span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', flex: 1 }}>
        {HEATMAP_DATA.map((coin, idx) => {
          const isPositive = coin.change >= 0;
          // Calculate opacity based on absolute change (max 20%)
          const intensity = Math.min(Math.abs(coin.change) / 20, 1);
          // Base colors: Green (#00FF88) and Red (#FF3B30)
          const bgColor = isPositive 
            ? `rgba(0, 255, 136, ${0.1 + intensity * 0.4})` 
            : `rgba(255, 59, 48, ${0.1 + intensity * 0.4})`;
            
          return (
            <div key={idx} style={{ 
              background: bgColor, 
              borderRadius: '4px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '8px 4px',
              border: `1px solid ${isPositive ? 'rgba(0,255,136,0.2)' : 'rgba(255,59,48,0.2)'}`
            }}>
              <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>{coin.symbol}</span>
              <span style={{ color: isPositive ? '#00FF88' : '#FF3B30', fontSize: '0.65rem' }}>
                {isPositive ? '+' : ''}{coin.change}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
