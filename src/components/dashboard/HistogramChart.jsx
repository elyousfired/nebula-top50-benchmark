import React from 'react';

export const HistogramChart = ({ data, title, height = 150 }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: `${height}px`, background: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', borderRadius: '4px' }}>
        No Data
      </div>
    );
  }

  // data is an array of { time: timestamp, strength: number }
  const minStrength = Math.min(...data.map(d => d.strength));
  const maxStrength = Math.max(...data.map(d => d.strength));
  const absMax = Math.max(Math.abs(minStrength), Math.abs(maxStrength), 0.1);
  
  return (
    <div style={{ background: '#080B10', borderRadius: '4px', border: '1px solid #1A202C', padding: '10px', height: `${height}px`, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ color: '#F7931A', fontSize: '0.75rem', fontWeight: 'bold' }}>{title}</span>
        {data.length > 0 && (
          <span style={{ background: data[data.length - 1].strength >= 0 ? '#00FF88' : '#FF3B30', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '900' }}>
            {data[data.length - 1].strength > 0 ? '+' : ''}{data[data.length - 1].strength.toFixed(2)}%
          </span>
        )}
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Zero Line */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', borderTop: '1px dashed #1A202C', zIndex: 1 }}></div>
        
        {/* Bars Container */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', zIndex: 2 }}>
          {data.map((d, i) => {
            const isPositive = d.strength >= 0;
            const heightPct = (Math.abs(d.strength) / absMax) * 50; 
            
            return (
              <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '0 1px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  {isPositive && (
                    <div style={{ width: '100%', height: `${heightPct}%`, background: '#00FF88' }}></div>
                  )}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                  {!isPositive && (
                    <div style={{ width: '100%', height: `${heightPct}%`, background: '#FF3B30' }}></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', color: '#475569', fontSize: '0.65rem' }}>
         <span>{new Date(data[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
         <span>{new Date(data[Math.floor(data.length/2)].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
         <span>{new Date(data[data.length - 1].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
};
