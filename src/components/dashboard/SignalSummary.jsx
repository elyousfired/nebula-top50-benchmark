import React from 'react';

export const SignalSummary = ({ notifications }) => {
  const breakoutCount = notifications.filter(n => n.type === 'HORIZONTAL_BREAKOUT').length;
  const parabolicCount = notifications.filter(n => n.type === 'MACRO_PARABOLIC').length;
  const vwapCount = notifications.filter(n => n.type === 'VWAP_BREAKOUT').length;
  const pocCount = notifications.filter(n => n.type === 'POC_PROXIMITY').length;

  const totalSignals = breakoutCount + parabolicCount + vwapCount + pocCount;

  return (
    <div style={{ background: '#080B10', borderRadius: '8px', border: '1px solid #1A202C', padding: '15px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h3 style={{ color: '#fff', fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>AI Signal Distribution</h3>
        <span style={{ color: '#00d0ff', fontSize: '0.75rem', background: '#00d0ff20', padding: '2px 8px', borderRadius: '4px' }}>LIVE</span>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '40px', color: '#00d0ff', fontSize: '1.2rem', fontWeight: 'bold' }}>{breakoutCount}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>
              <span>Resistance Breakout</span>
              <span>{Math.round((breakoutCount / Math.max(totalSignals, 1)) * 100)}%</span>
            </div>
            <div style={{ height: '4px', background: '#1A202C', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${(breakoutCount / Math.max(totalSignals, 1)) * 100}%`, background: '#00d0ff', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '40px', color: '#ffb800', fontSize: '1.2rem', fontWeight: 'bold' }}>{parabolicCount}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>
              <span>Macro Parabolic</span>
              <span>{Math.round((parabolicCount / Math.max(totalSignals, 1)) * 100)}%</span>
            </div>
            <div style={{ height: '4px', background: '#1A202C', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${(parabolicCount / Math.max(totalSignals, 1)) * 100}%`, background: '#ffb800', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '40px', color: '#00d0ff', fontSize: '1.2rem', fontWeight: 'bold' }}>{vwapCount}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>
              <span>VWAP Radar</span>
              <span>{Math.round((vwapCount / Math.max(totalSignals, 1)) * 100)}%</span>
            </div>
            <div style={{ height: '4px', background: '#1A202C', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${(vwapCount / Math.max(totalSignals, 1)) * 100}%`, background: '#00d0ff', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '40px', color: '#F7931A', fontSize: '1.2rem', fontWeight: 'bold' }}>{pocCount}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>
              <span>POC Proximity</span>
              <span>{Math.round((pocCount / Math.max(totalSignals, 1)) * 100)}%</span>
            </div>
            <div style={{ height: '4px', background: '#1A202C', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${(pocCount / Math.max(totalSignals, 1)) * 100}%`, background: '#F7931A', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
