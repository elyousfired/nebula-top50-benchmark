import React from 'react';
import { LayoutDashboard, Activity, Target, Crosshair, Map, Brain, Star, FileText, Settings } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { icon: <LayoutDashboard size={18} />, label: 'Dashboard', active: true },
    { icon: <Activity size={18} />, label: 'Alerts Live' },
    { icon: <Target size={18} />, label: 'Breakouts' },
    { icon: <Crosshair size={18} />, label: 'POC Proximity' },
    { icon: <Map size={18} />, label: 'Market Map' },
    { icon: <Brain size={18} />, label: 'AI Insights' },
    { icon: <Star size={18} />, label: 'Watchlist' },
    { icon: <FileText size={18} />, label: 'Reports' },
    { icon: <Settings size={18} />, label: 'Settings' },
  ];

  return (
    <div style={{
      width: '240px',
      height: '100vh',
      background: '#080B10',
      borderRight: '1px solid #1A202C',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      boxSizing: 'border-box'
    }}>
      <div style={{ padding: '0 20px', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '40px', height: '40px', background: 'rgba(0, 208, 255, 0.1)', borderRadius: '8px', border: '1px solid #00d0ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#00d0ff', fontWeight: '900', fontSize: '1.2rem' }}>AI</span>
        </div>
        <div>
          <h1 style={{ color: '#fff', fontSize: '1.2rem', margin: 0, letterSpacing: '1px' }}>GLOBAL ALERTS</h1>
          <p style={{ color: '#00d0ff', fontSize: '0.7rem', margin: 0 }}>AI Market Intelligence</p>
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {navItems.map((item, idx) => (
          <div key={idx} style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            color: item.active ? '#00d0ff' : '#64748B',
            background: item.active ? 'rgba(0, 208, 255, 0.05)' : 'transparent',
            borderLeft: item.active ? '3px solid #00d0ff' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontWeight: item.active ? 'bold' : 'normal'
          }}
          onMouseEnter={(e) => { if (!item.active) e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { if (!item.active) e.currentTarget.style.color = '#64748B' }}
          >
            {item.icon}
            <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
          </div>
        ))}
      </nav>

      <div style={{ padding: '20px', marginTop: 'auto', borderTop: '1px solid #1A202C' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Brain size={32} color="#00FF88" />
          <div>
            <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>AI Engine</div>
            <div style={{ color: '#00FF88', fontSize: '0.75rem' }}>Operational <span style={{ color: '#64748B', marginLeft: '5px' }}>v2.4.1</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
