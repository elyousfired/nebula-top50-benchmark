import React from 'react';
import { Maximize } from 'lucide-react';

// Generates a simple SVG sparkline based on an array of values
const Sparkline = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 20;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

export const CompactAlertRow = ({ alert, hovered, setHovered, onClick, onZoom }) => {
  // Extract data based on alert type
  let price = 0;
  let percentChange = 0;
  let conf = 0;
  let sparklineData = [];
  
  if (alert.type === 'HORIZONTAL_BREAKOUT') {
    price = alert.breakoutData.currentPrice || 0;
    percentChange = alert.breakoutData.resistance ? -alert.breakoutData.resistance.distance : 0;
    conf = 78; // Dummy confidence
    sparklineData = [1, 2, 3, 2, 4, 5, 8]; // Dummy sparkline
  } else if (alert.type === 'MACRO_PARABOLIC') {
    price = alert.patternData.currentPrice || 0;
    percentChange = alert.patternData.breakoutPercent || 0;
    conf = 85;
    sparklineData = [8, 7, 5, 4, 2, 1, 0];
  } else if (alert.type === 'VWAP_BREAKOUT') {
    price = alert.vwapToken?.price || 0;
    percentChange = parseFloat(alert.message) || 0;
    conf = 88;
    sparklineData = [2, 3, 4, 3, 5, 6, 9];
  } else if (alert.type === 'POC_PROXIMITY') {
    price = alert.vpData?.currentPrice || 0;
    percentChange = alert.vpData?.distancePoc || 0;
    conf = 84;
    sparklineData = [4, 4, 5, 4, 6, 5, 6];
  }

  const isPositive = percentChange >= 0;
  const changeColor = isPositive ? '#00FF88' : '#FF3B30';

  return (
    <div 
      onMouseEnter={() => setHovered(alert.id)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => onClick && onClick(alert.symbol)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto auto',
        gap: '12px',
        alignItems: 'center',
        padding: '12px',
        background: hovered === alert.id ? 'rgba(255,255,255,0.05)' : 'transparent',
        borderBottom: '1px solid #1A202C',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }}
    >
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${alert.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {React.cloneElement(alert.icon, { size: 16 })}
      </div>
      
      <div>
        <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{alert.symbol}</div>
        <div style={{ color: '#64748B', fontSize: '0.7rem' }}>${alert.symbol.replace('USDT', '')}</div>
      </div>
      
      <div>
        <div style={{ color: '#fff', fontSize: '0.85rem' }}>${price > 10 ? price.toFixed(2) : price.toFixed(4)}</div>
        <div style={{ color: changeColor, fontSize: '0.75rem' }}>{isPositive ? '+' : ''}{percentChange.toFixed(2)}%</div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <div style={{ color: '#fff', fontSize: '0.8rem' }}>{conf}%</div>
        <div style={{ width: '40px', height: '4px', background: '#1A202C', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${conf}%`, height: '100%', background: alert.color }}></div>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{alert.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <button 
            onClick={(e) => { e.stopPropagation(); onZoom && onZoom(); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            title="Agrandir le graphique"
          >
            <Maximize size={14} color={alert.color} style={{ opacity: 0.7 }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0.7} />
          </button>
        </div>
        <Sparkline data={sparklineData} color={alert.color} />
      </div>
    </div>
  );
};
