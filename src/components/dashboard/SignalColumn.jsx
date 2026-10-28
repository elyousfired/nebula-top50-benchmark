import React from 'react';
import { CompactAlertRow } from './CompactAlertRow';

export const SignalColumn = ({ title, icon, color, count, alerts, type, hoveredAlert, setHoveredAlert, onZoom, renderHoverChart }) => {
  return (
    <div style={{ background: '#080B10', borderRadius: '8px', border: '1px solid #1A202C', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '15px 20px', borderBottom: '1px solid #1A202C', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: color, margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {React.cloneElement(icon, { size: 18 })}
          {title}
        </h2>
        <div style={{ background: '#12161F', color: color, padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
          {count}
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '12px', padding: '10px 12px', background: '#0B0E14', borderBottom: '1px solid #1A202C', color: '#64748B', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
        <div style={{ width: '32px' }}></div> {/* Spacer for icon */}
        <div>COIN / PAIR</div>
        <div style={{ textAlign: 'right', paddingRight: '10px' }}>PRICE</div>
        <div style={{ textAlign: 'right', paddingRight: '10px' }}>CONF.</div>
        <div style={{ textAlign: 'right' }}>TIME</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {alerts.length === 0 && (
          <div style={{ padding: '20px', color: '#64748B', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
            Aucune alerte en attente.
          </div>
        )}
        {alerts.map((alert) => (
          <div key={`${alert.id}-${alert.time.getTime()}`} style={{ display: 'flex', flexDirection: 'column' }}>
            <CompactAlertRow 
              alert={alert} 
              hovered={hoveredAlert} 
              setHovered={setHoveredAlert} 
              onClick={() => {}}
              onZoom={() => onZoom(alert)}
            />
            {hoveredAlert === alert.id && renderHoverChart && (
              <div style={{ height: '280px', width: '100%', borderBottom: '1px solid #1A202C', background: '#050508', overflow: 'hidden' }}>
                {renderHoverChart(alert)}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div style={{ padding: '10px', textAlign: 'center', borderTop: '1px solid #1A202C', color: '#64748B', fontSize: '0.75rem', cursor: 'pointer', background: '#080B10' }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#64748B'}
      >
        View all ({count}) &gt;
      </div>
    </div>
  );
};
