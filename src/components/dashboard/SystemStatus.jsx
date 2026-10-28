import React from 'react';
import { Activity, Shield, Cpu, Database, Wifi } from 'lucide-react';

export const SystemStatus = () => {
  return (
    <div style={{ background: '#080B10', borderRadius: '8px', border: '1px solid #1A202C', padding: '15px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h3 style={{ color: '#fff', fontSize: '0.85rem', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>System Status</h3>
        <span style={{ color: '#00FF88', fontSize: '0.75rem', background: '#00FF8820', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF88' }}></div>
          OPTIMAL
        </span>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.75rem' }}>
            <Activity size={14} /> Scanner Engine
          </div>
          <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>Running</div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.75rem' }}>
            <Wifi size={14} /> API Latency
          </div>
          <div style={{ color: '#00FF88', fontSize: '0.75rem', fontWeight: 'bold' }}>24ms</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.75rem' }}>
            <Database size={14} /> Data Stream
          </div>
          <div style={{ color: '#00FF88', fontSize: '0.75rem', fontWeight: 'bold' }}>Synced</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.75rem' }}>
            <Cpu size={14} /> CPU Load
          </div>
          <div style={{ width: '80px', height: '4px', background: '#1A202C', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: '32%', background: '#00d0ff', borderRadius: '2px' }}></div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '0.75rem' }}>
            <Shield size={14} /> Risk Guard
          </div>
          <div style={{ color: '#00FF88', fontSize: '0.75rem', fontWeight: 'bold' }}>Active</div>
        </div>
      </div>
    </div>
  );
};
