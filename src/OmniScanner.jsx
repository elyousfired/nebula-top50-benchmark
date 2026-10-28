import React, { useState, useEffect } from 'react';
import { Search, Zap, Crosshair } from 'lucide-react';
import { fetchBybitData, fetchDepth, fetchTrades, calculateNebulaLogic } from './logic/scanner';
import { PremiumCurveGrid, DailyLevelsPro, MacroStrategyDashboard } from './PremiumComponents';
import { LiquiditySweepsScanner } from './LiquiditySweepsScanner';
import { MarketStructureScanner } from './MarketStructureScanner';
import { MacroFlowScanner } from './MacroFlowScanner';
import { NetFlowIntensityScanner } from './NetFlowIntensityScanner';
import VolumeProfileScanner from './VolumeProfileScanner';

export function OmniScanner({ scans }) {
  const [searchToken, setSearchToken] = useState('');
  const [activeToken, setActiveToken] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [singleTokenScan, setSingleTokenScan] = useState(null);

  const handleDeepScan = async (e) => {
    if (e) e.preventDefault();
    if (!searchToken) return;

    setIsScanning(true);
    const rawToken = searchToken.toUpperCase();
    const token = (!rawToken.endsWith('USDT') && !rawToken.endsWith('USD')) ? rawToken + 'USDT' : rawToken;
    
    try {
      const klines = await fetchBybitData(token, '60');
      if (klines && klines.length > 0) {
        const depth = await fetchDepth(token);
        const trades = await fetchTrades(token);
        const logic = calculateNebulaLogic(klines, depth, trades);
        
        if (logic) {
           setSingleTokenScan({
             ...logic,
             lastPrice: klines[0][4],
             priceChangePercent: 0
           });
        }
      }
    } catch (err) {
      console.error(err);
    }
    
    setActiveToken(token);
    setIsScanning(false);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header & Search */}
      <div style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '1rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '15px', background: 'linear-gradient(90deg, rgba(0,255,136,0.1), rgba(0,208,255,0.1))', padding: '10px 25px', borderRadius: '50px', border: '1px solid rgba(0,255,136,0.3)', marginBottom: '20px' }}>
          <Crosshair size={24} color="#00ff88" />
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', fontWeight: '900', letterSpacing: '2px' }}>OMNI-SEARCH DASHBOARD</h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto', marginBottom: '2rem' }}>
          Entrez un symbole pour obtenir une vue unifiée de toutes les sections analytiques sur ce token.
        </p>

        <form onSubmit={handleDeepScan} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', gap: '15px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
          {isScanning && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)' }}>
              <div style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, #00ff88, #00d0ff)', animation: 'scan-loading 1.5s infinite linear' }} />
            </div>
          )}
          
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={24} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input 
              type="text" 
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              placeholder="Ex: JUP, WIF, SOL, BTC..."
              style={{ width: '100%', background: '#020617', border: '2px solid #1e293b', color: '#fff', padding: '15px 20px 15px 60px', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none', transition: 'all 0.3s' }}
              onFocus={(e) => e.target.style.borderColor = '#00ff88'}
              onBlur={(e) => e.target.style.borderColor = '#1e293b'}
              disabled={isScanning}
            />
          </div>
          
          <button type="submit" disabled={isScanning || !searchToken} style={{ background: isScanning ? '#1e293b' : 'linear-gradient(90deg, #00ff88, #00d0ff)', color: '#020617', border: 'none', padding: '0 30px', height: '60px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: '900', cursor: isScanning ? 'not-allowed' : 'pointer', transition: 'all 0.3s' }}>
            ANALYSER
          </button>
        </form>
      </div>

      {activeToken && !isScanning && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
           
           {/* Section 1: Courbes & Radar */}
           <div style={{ background: '#020617', padding: '20px', borderRadius: '24px', border: '1px solid rgba(0, 208, 255, 0.3)' }}>
              <h2 style={{ color: '#00d0ff', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Zap /> ANALYSE COURBES & RADAR</h2>
              <PremiumCurveGrid 
                tokens={[activeToken]} 
                scans={{ [activeToken]: singleTokenScan }} 
                depthHistory={{}} 
              />
           </div>

           {/* Section 2: Market Structure */}
           <div style={{ borderTop: '1px solid #1e293b', paddingTop: '2rem' }}>
              <h2 style={{ color: '#ffea00', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px' }}>⚡ MARKET STRUCTURE (SMC)</h2>
              <MarketStructureScanner initialSearch={activeToken} />
           </div>

           {/* Section 3: Daily Levels */}
           <div style={{ borderTop: '1px solid #1e293b', paddingTop: '2rem' }}>
              <h2 style={{ color: '#8b5cf6', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px' }}>📊 DAILY LEVELS</h2>
              <DailyLevelsPro tokens={[activeToken]} scans={{ [activeToken]: singleTokenScan }} />
           </div>

           {/* Section 4: Macro Strategy */}
           <div style={{ borderTop: '1px solid #1e293b', paddingTop: '2rem' }}>
              <h2 style={{ color: '#f97316', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px' }}>🎯 MACRO STRATEGY</h2>
              <MacroStrategyDashboard candidates={[]} tokens={[activeToken]} scans={{ [activeToken]: singleTokenScan }} />
           </div>

           {/* Section 5: Volume Profile */}
           <div style={{ borderTop: '1px solid #1e293b', paddingTop: '2rem' }}>
              <h2 style={{ color: '#eab308', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px' }}>📉 VOLUME PROFILE</h2>
              <VolumeProfileScanner initialSearch={activeToken} />
           </div>

           {/* Section 6: Macro Flow */}
           <div style={{ borderTop: '1px solid #1e293b', paddingTop: '2rem' }}>
              <h2 style={{ color: '#06b6d4', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px' }}>🌊 MACRO FLOW</h2>
              <MacroFlowScanner initialSearch={activeToken} />
           </div>

           {/* Section 7: Net Flow Intensity */}
           <div style={{ borderTop: '1px solid #1e293b', paddingTop: '2rem' }}>
              <h2 style={{ color: '#10b981', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px' }}>🔥 FLOW INTENSITY</h2>
              <NetFlowIntensityScanner initialSearch={activeToken} />
           </div>

           {/* Section 8: Liquidity Sweeps */}
           <div style={{ borderTop: '1px solid #1e293b', paddingTop: '2rem' }}>
              <h2 style={{ color: '#ff3366', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px' }}>🩸 LIQUIDITY SWEEPS</h2>
              <LiquiditySweepsScanner initialSearch={activeToken} />
           </div>

        </div>
      )}

      <style>{`
        @keyframes scan-loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
