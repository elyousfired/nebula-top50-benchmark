import React from 'react';
import { RefreshCcw } from 'lucide-react';

const HeaderStat = ({ title, value, subValue, subColor, chartColor }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
    <div>
      <div style={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>{value}</span>
      </div>
      {subValue && (
        <div style={{ color: subColor || '#00FF88', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: subColor || '#00FF88', display: 'inline-block' }}></span>
          {subValue}
        </div>
      )}
    </div>
    {/* Simple dummy sparkline for header stats */}
    <div style={{ width: '60px', height: '24px', position: 'relative' }}>
      <svg viewBox="0 0 100 30" width="100%" height="100%" preserveAspectRatio="none">
        <path d="M0,25 Q10,20 20,25 T40,15 T60,20 T80,5 T100,10" fill="none" stroke={chartColor || "#00FF88"} strokeWidth="2" strokeOpacity="0.8" />
        <path d="M0,25 Q10,20 20,25 T40,15 T60,20 T80,5 T100,10 L100,30 L0,30 Z" fill={`url(#gradient-${chartColor})`} opacity="0.2" />
        <defs>
          <linearGradient id={`gradient-${chartColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor || "#00FF88"} stopOpacity="1" />
            <stop offset="100%" stopColor={chartColor || "#00FF88"} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
);

const Header = () => {
  return (
    <div style={{ 
      height: '80px', 
      background: '#0B0E14', 
      borderBottom: '1px solid #1A202C',
      display: 'flex',
      alignItems: 'center',
      padding: '0 30px',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', gap: '50px' }}>
        <HeaderStat title="Total Alerts" value="48" subValue="LIVE" chartColor="#00FF88" />
        <HeaderStat title="Breakouts" value="23" subValue="+8 (24h)" chartColor="#00FF88" />
        <HeaderStat title="VWAP Breakouts" value="16" subValue="+5 (24h)" chartColor="#00FF88" />
        <HeaderStat title="POC Proximity" value="31" subValue="+7 (24h)" chartColor="#00FF88" />
        
        <div style={{ width: '1px', height: '40px', background: '#1A202C', margin: '0 10px' }}></div>
        
        <HeaderStat title="Market Sentiment" value="72/100" subValue="Bullish" subColor="#00FF88" chartColor="#00FF88" />
        <HeaderStat title="Market Volatility" value="23.4" subValue="Medium" subColor="#FFB800" chartColor="#FFB800" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '8px', borderRadius: '50%' }}>
            <RefreshCcw size={16} color="#00FF88" />
          </div>
          <div>
            <div style={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 'bold' }}>SYNC STATUS</div>
            <div style={{ color: '#00FF88', fontSize: '0.8rem', fontWeight: 'bold' }}>Synced <span style={{ color: '#64748B', fontWeight: 'normal', fontSize: '0.7rem' }}>1.2s ago</span></div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} UTC +0</div>
        </div>
      </div>
    </div>
  );
};

export default Header;
