import React, { useState, useEffect } from 'react';
import { TrendingUp, Scale, Target, Trophy, Zap, Globe, LayoutGrid, Flame } from 'lucide-react';
import MonthlyTop50BenchmarkComparator from './MonthlyTop50BenchmarkComparator';
import Top50PdhRadar from './Top50PdhRadar';

export default function App() {
  const [theme, setTheme] = useState('classic');
  const [viewMode, setViewMode] = useState('benchmark'); // 'benchmark' | 'pdh_radar'
  const [listFilter, setListFilter] = useState('TOP_100');
  const [liveTime, setLiveTime] = useState('');
  const [top50MonthTokens, setTop50MonthTokens] = useState([]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTop50Loaded = (tokens) => {
    if (Array.isArray(tokens) && tokens.length > 0) {
      setTop50MonthTokens(tokens);
    }
  };

  return (
    <div className={`app-container ${theme}-theme`} style={{ background: theme === 'classic' ? '#0a1a21' : '#12122b', color: '#fff', minHeight: '100vh', fontFamily: "'Inter', sans-serif", transition: 'all 0.5s ease' }}>
      <header style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme === 'classic' ? '#0d212b' : 'rgba(18, 18, 43, 0.8)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="logo"><TrendingUp size={24} /> NEBULA RADAR</div>
          <button
            onClick={() => setTheme(theme === 'classic' ? 'midnight' : 'classic')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#888',
              fontSize: '0.6rem',
              padding: '4px 10px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {theme === 'classic' ? '🌙 TEST MIDNIGHT' : '☀️ BACK TO CLASSIC'}
          </button>
        </div>

        <div className="view-toggles custom-scrollbar" style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', justifyContent: 'flex-start', overflowX: 'auto', padding: '0.5rem 0', maxWidth: '65%' }}>
          
          {/* TAB 1: TOP 50 BENCHMARK */}
          <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => setViewMode('benchmark')}
              className={`view-btn ${viewMode === 'benchmark' ? 'active' : ''}`}
              style={{
                border: viewMode === 'benchmark' ? '1px solid rgba(250, 204, 21, 0.6)' : '1px solid rgba(250, 204, 21, 0.2)',
                color: viewMode === 'benchmark' ? '#facc15' : '#888',
                fontWeight: '900',
                background: viewMode === 'benchmark' ? 'rgba(250, 204, 21, 0.12)' : 'transparent',
                boxShadow: viewMode === 'benchmark' ? '0 0 15px rgba(250, 204, 21, 0.15)' : 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Scale size={16}/> ⚖️ TOP 50 BENCHMARK: PRIX VS SCORE
            </button>
            {viewMode === 'benchmark' && (
              <div style={{ position: 'absolute', bottom: '-8px', width: '60px', height: '3px', background: '#00ff88', borderRadius: '2px', boxShadow: '0 0 8px #00ff88' }} />
            )}
          </div>

          {/* TAB 2: NOUVELLE PAGE - RADAR DE PROXIMITÉ PDH (1%) */}
          <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => setViewMode('pdh_radar')}
              className={`view-btn ${viewMode === 'pdh_radar' ? 'active' : ''}`}
              style={{
                border: viewMode === 'pdh_radar' ? '1px solid rgba(0, 255, 136, 0.6)' : '1px solid rgba(0, 255, 136, 0.3)',
                color: viewMode === 'pdh_radar' ? '#00ff88' : '#8892b0',
                fontWeight: '900',
                background: viewMode === 'pdh_radar' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(0, 255, 136, 0.04)',
                boxShadow: viewMode === 'pdh_radar' ? '0 0 15px rgba(0, 255, 136, 0.25)' : 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Target size={16} color={viewMode === 'pdh_radar' ? '#00ff88' : '#888'} />
              <span>🎯 RADAR PROXIMITÉ PDH (≤ 1%)</span>
              <span style={{
                background: '#ff3366',
                color: '#fff',
                fontSize: '0.60rem',
                fontWeight: '900',
                padding: '1px 5px',
                borderRadius: '10px',
                letterSpacing: '0.3px',
                animation: 'pulse 2s infinite'
              }}>
                LIVE
              </span>
            </button>
            {viewMode === 'pdh_radar' && (
              <div style={{ position: 'absolute', bottom: '-8px', width: '70px', height: '3px', background: '#00ff88', borderRadius: '2px', boxShadow: '0 0 10px #00ff88' }} />
            )}
          </div>

          {/* Decorative tabs */}
          <button
            className="view-btn"
            style={{ border: '1px solid rgba(250, 204, 21, 0.15)', color: '#64748b', fontWeight: '700', background: 'transparent', borderRadius: '8px', padding: '6px 12px', whiteSpace: 'nowrap', opacity: 0.5, cursor: 'default' }}
          >
            <Trophy size={15}/> 👑 CONFLUENCE MATRIX
          </button>
          
          <button
            className="view-btn"
            style={{ border: '1px solid rgba(16, 185, 129, 0.15)', color: '#64748b', fontWeight: '700', background: 'transparent', borderRadius: '8px', padding: '6px 12px', whiteSpace: 'nowrap', opacity: 0.5, cursor: 'default' }}
          >
            <Zap size={15}/> ⚡ 💵 PURE TOKEN / USDT
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={15} color="#00d2ff" style={{ opacity: 0.8 }} />
          <LayoutGrid size={15} color="#00ff88" style={{ opacity: 0.8 }} />
          <div className="status-badge" style={{ color: '#00ff88', border: '1px solid rgba(0, 255, 136, 0.2)', background: 'rgba(0, 255, 136, 0.05)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800' }}>
            LIVE: {liveTime || 'En direct'}
          </div>
        </div>
      </header>

      {/* SUB-NAV (RANGS) */}
      <div className="sub-nav">
        <button className={`sub-btn ${listFilter === 'TOP_100' ? 'active' : ''}`} onClick={() => setListFilter('TOP_100')}>RANG 1-100</button>
        <button className={`sub-btn ${listFilter === 'TOP_200' ? 'active' : ''}`} onClick={() => setListFilter('TOP_200')}>RANG 101-200</button>
        <button className={`sub-btn ${listFilter === 'TOP_300' ? 'active' : ''}`} onClick={() => setListFilter('TOP_300')}>RANG 201-300</button>
        <button className={`sub-btn ${listFilter === 'TOP_400' ? 'active' : ''}`} onClick={() => setListFilter('TOP_400')}>RANG 301-400</button>
        <button className={`sub-btn ${listFilter === 'TOP_500' ? 'active' : ''}`} onClick={() => setListFilter('TOP_500')}>RANG 401-500</button>
      </div>

      {/* CONTENT AREA: Rendu avec display pour préserver l'état et le cache */}
      <div className="content" style={{ padding: '1.5rem' }}>
        <div style={{ display: viewMode === 'benchmark' ? 'block' : 'none' }}>
          <MonthlyTop50BenchmarkComparator onTop50Loaded={handleTop50Loaded} />
        </div>

        <div style={{ display: viewMode === 'pdh_radar' ? 'block' : 'none' }}>
          <Top50PdhRadar top50Tokens={top50MonthTokens} theme={theme} />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        body { background: #0a1a21; margin: 0; padding: 0; }
        .app-container { min-height: 100vh; background: #0a1a21; color: #fff; font-family: 'Inter', sans-serif; }
        header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: #0d212b; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .logo { font-size: 1rem; font-weight: 900; color: #00ff88; display: flex; gap: 8px; }
        .status-badge { font-size: 0.6rem; font-weight: 800; }
        .sub-nav { display: flex; gap: 0.5rem; justify-content: center; padding: 0.8rem; background: #0a1a21; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .sub-btn { background: transparent; color: #64748b; border: 1px solid transparent; padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .sub-btn:hover { border-color: rgba(0, 240, 255, 0.2); color: #e0e6ed; }
        .sub-btn.active { background: #0d212b; color: #00f0ff; border-color: rgba(0, 240, 255, 0.4); font-weight: 600; }
        .content { padding: 2rem; }
        .view-toggles { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center; }
        .view-btn { background: transparent; border: 1px solid transparent; color: #64748b; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .view-btn:hover { border-color: rgba(0, 240, 255, 0.2); color: #e0e6ed; }
        .view-btn.active { background: #0d212b; color: #00f0ff; border-color: rgba(0, 240, 255, 0.4); font-weight: 600; }
        .midnight-theme { background: #12122b !important; }
        .midnight-theme .app-container { background: #12122b !important; }
        .midnight-theme header { background: rgba(18, 18, 43, 0.8) !important; }
        .midnight-theme .sub-nav { background: #12122b !important; }
        .midnight-theme .view-btn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); color: #888; border-radius: 8px; }
        .midnight-theme .view-btn.active { background: #FFB800; color: #000; border-color: #FFB800; box-shadow: 0 4px 15px rgba(255, 184, 0, 0.3); }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        `
      }} />
    </div>
  );
}
