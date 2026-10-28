import React from 'react';
import { TradingViewChart } from '../../App'; // Assuming TradingViewChart can be imported from App.jsx

export const MarketOverview = () => {
  return (
    <div style={{ background: '#080B10', borderRadius: '8px', border: '1px solid #1A202C', padding: '15px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h3 style={{ color: '#fff', fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Market Overview</h3>
        <span style={{ color: '#64748B', fontSize: '0.75rem', background: '#12161F', padding: '2px 8px', borderRadius: '4px' }}>BTC.D</span>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', flex: 1 }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: '4px' }}>
            {/* Using an iframe to TradingView as a placeholder for the mini chart, or our existing component if it works small */}
            <TradingViewChart symbol="BTCUSDT" initialTimeframe="15" hideControls={true} />
        </div>
        
        <div style={{ width: '100px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>57.32%</div>
            <div style={{ color: '#64748B', fontSize: '0.65rem' }}>Dominance</div>
            <div style={{ color: '#00FF88', fontSize: '0.7rem' }}>+1.35% (24h)</div>
          </div>
          <div>
            <div style={{ color: '#64748B', fontSize: '0.65rem', textTransform: 'uppercase' }}>Total M. Cap</div>
            <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>$2.41T</div>
            <div style={{ color: '#00FF88', fontSize: '0.7rem' }}>+1.82% (24h)</div>
          </div>
          <div>
            <div style={{ color: '#64748B', fontSize: '0.65rem', textTransform: 'uppercase' }}>24h Volume</div>
            <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>$89.47B</div>
            <div style={{ color: '#00FF88', fontSize: '0.7rem' }}>+4.21% (24h)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
