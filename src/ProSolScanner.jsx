import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, Maximize2, Target, Flame } from 'lucide-react';
import { fetchTop500Symbols } from './logic/scanner';
import { fetchMacroSol } from './logic/sol-scanner';
import { TradingViewChart } from './App';
import { DexAnalyticsDashboard } from './DexAnalyticsDashboard';
import ExpertSystem from './ExpertSystem';
import ExpertTableDashboard from './ExpertTableDashboard';
import PortfolioDashboard from './PortfolioDashboard';
import { Wallet } from 'lucide-react';

const DUMMY_BUTTONS_ROW1 = [
  { icon: '📈', label: 'COURBES' }, { icon: '📉', label: 'COURBES PRO' }, { icon: '📡', label: 'RADAR' }, { icon: '📐', label: 'DAILY LEVELS' },
  { icon: '📊', label: 'VOLUME PROFILE' }, { icon: '⚡', label: 'MACRO STRAT' }, { icon: '🌊', label: 'MACRO FLOW' }, { icon: '🛠️', label: 'MARKET STRUCTURE' }
];

const DUMMY_BUTTONS_ROW2 = [
  { icon: '🧹', label: 'LIQUIDITY SWEEPS' }, { icon: '🔥', label: 'FLOW INTENSITY' }, { icon: '🔗', label: 'BLOCKCHAIN' }, { icon: '🔮', label: 'MONAD TERMINAL' },
  { icon: '🌊', label: 'HYPE TERMINAL' }, { icon: '⚖️', label: 'HYPE/MON ARB' }, { icon: '🕯️', label: 'CVD CANDLES' }, { icon: '📄', label: 'TOP 100 NEWS' }
];

const DUMMY_BUTTONS_ROW3 = [
  { icon: '📊', label: 'BTC CORRELATION' }, { icon: '🧠', label: 'PRO SWITCH TERMINAL' }, { icon: '👑', label: 'PRO ALPHA (BTC)' }, { icon: '💧', label: 'NET FLOW (BTC)' },
  { icon: '📈', label: 'PRO SWITCH CHARTS' }, { icon: '🔴', label: 'BREAKOUT SCANNER' }, { icon: '🚀', label: 'PARABOLIC MACRO' }
];

export const ProSolScanner = ({ listFilter = 'TOP_100' }) => {
  const [activeTab, setActiveTab] = useState('MACRO');
  const [currentPage, setCurrentPage] = useState(0);
  const [analyzeAgainst, setAnalyzeAgainst] = useState('USDT');
  const [top500, setTop500] = useState([]);
  const [patterns1D, setPatterns1D] = useState([]);
  const [patterns4H, setPatterns4H] = useState([]);
  const [progress1D, setProgress1D] = useState(0);
  const [progress4H, setProgress4H] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [fullScreenData, setFullScreenData] = useState(null);

  const calculateProgression = (tf) => tf === '1D' ? progress1D : progress4H;

  useEffect(() => {
    let isMounted = true;
    
    const initScan = async () => {
       setIsScanning(true);
       try {
         const symbols = await fetchTop500Symbols();
         if (!isMounted) return;
         setTop500(symbols);
         
         // Scanner 1D
         setProgress1D(0);
         setPatterns1D([]);
         let count1D = 0;
         const res1D = [];
         const isUsdt = analyzeAgainst === 'USDT';
         for (const s of symbols) {
            if (!isMounted) break;
            const res = await fetchMacroSol(s.symbol, '1D', isUsdt);
            if (res.isValid && res.cupPattern) {
               res1D.push({ symbol: s.symbol, pattern: res.cupPattern });
               setPatterns1D([...res1D]);
            }
            count1D++;
            setProgress1D(Math.floor((count1D / symbols.length) * 100));
         }
         
         // Scanner 4H
         setProgress4H(0);
         setPatterns4H([]);
         let count4H = 0;
         const res4H = [];
         for (const s of symbols) {
            if (!isMounted) break;
            const res = await fetchMacroSol(s.symbol, '4H', isUsdt);
            if (res.isValid && res.cupPattern) {
               res4H.push({ symbol: s.symbol, pattern: res.cupPattern });
               setPatterns4H([...res4H]);
            }
            count4H++;
            setProgress4H(Math.floor((count4H / symbols.length) * 100));
         }

       } catch (e) {
          console.error("ProSolScanner scan failed", e);
       }
       setIsScanning(false);
    };

    initScan();
    return () => { isMounted = false; };
  }, [analyzeAgainst]);

  const getBestTokens = () => {
      const best = patterns1D.filter(p => {
          const pat = p.pattern;
          if (!pat || !pat.klines || pat.klines.length === 0) return false;
          
          const currentKline = pat.klines[pat.klines.length - 1];
          const currentTime = currentKline.time;

          // Condition 1: Dead Volume is finished
          let isDeadVolumeFinished = false;
          if (pat.deadZoneBox && pat.deadZoneBox.length > 0) {
              const deadZoneEnd = pat.deadZoneBox[pat.deadZoneBox.length - 1].time;
              isDeadVolumeFinished = currentTime > deadZoneEnd;
          } else {
              return false; // Requires a dead volume phase to have happened
          }

          if (!isDeadVolumeFinished) return false;

          // Condition 2: EMA 20 > EMA 50
          if (!pat.ema20 || !pat.ema50 || pat.ema20.length === 0 || pat.ema50.length === 0) return false;
          const lastEma20 = pat.ema20[pat.ema20.length - 1].value;
          const lastEma50 = pat.ema50[pat.ema50.length - 1].value;
          if (lastEma20 <= lastEma50) return false;

          // Condition 3: EMA 20 > VWAP Anchored
          if (!pat.anchoredVWAP || pat.anchoredVWAP.length === 0) return false;
          const lastVwap = pat.anchoredVWAP[pat.anchoredVWAP.length - 1].value;
          if (lastEma20 <= lastVwap) return false;

          return true;
      });

      // Score: distance to HH. Lower breakoutPercent means further from HH, so higher score.
      return best.sort((a, b) => Math.abs(b.pattern.breakoutPercent) - Math.abs(a.pattern.breakoutPercent));
  };

  const renderDashboard = (tf, patterns, progress, isBestMode = false) => (
    <ParabolicRecoveryDashboard 
      top500={top500} 
      timeframe={tf} 
      patterns={patterns} 
      progress={progress} 
      analyzing={isScanning} 
      isBestMode={isBestMode}
      listFilter={listFilter}
      analyzeAgainst={analyzeAgainst}
      onOpenFullScreen={(sym, tf, pat) => setFullScreenData({ symbol: sym, timeframe: tf, pattern: pat })} 
    />
  );

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'transparent', fontFamily: "'Inter', sans-serif", color: '#f8fafc' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
           {[
             { id: 'MACRO', label: `Scanner 1D (Macro)`, Icon: Target, progression: calculateProgression('1D') },
             { id: 'SWING', label: `Scanner 4H (Swing)`, Icon: Target, progression: calculateProgression('4H') },
             { id: 'TOP_DEPARTS', label: `Top Départs`, Icon: Flame, progression: calculateProgression('1D') },
             { id: 'EXPERT_TABLE', label: `Expert Table`, Icon: Activity, progression: calculateProgression('1D') },
             { id: 'PORTFOLIO_DEMO', label: `Portfolio Démo`, Icon: Wallet, progression: 100 }
           ].map(t => (
             <button key={t.id} onClick={() => { setActiveTab(t.id); setCurrentPage(0); }} 
                 style={{ 
                   display: 'flex', alignItems: 'center', gap: '8px',
                   background: activeTab === t.id ? '#0d212b' : 'transparent', 
                   border: `1px solid ${activeTab === t.id ? 'rgba(0, 240, 255, 0.4)' : 'transparent'}`, 
                   color: activeTab === t.id ? '#00f0ff' : '#64748b', 
                   fontSize: '0.85rem', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: activeTab === t.id ? '600' : '500' 
                 }}>
               <t.Icon size={16} /> <span>{t.label} {t.progression < 100 ? <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({t.progression}%)</span> : null}</span>
             </button>
           ))}

           <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)', marginLeft: 'auto' }}>
             <span style={{ padding: '0 8px', fontSize: '0.8rem', color: '#94a3b8' }}>Analyze against:</span>
             <button 
                onClick={() => setAnalyzeAgainst('SOL')}
                style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'SOL' ? '#00d0ff' : 'transparent', color: analyzeAgainst === 'SOL' ? '#000' : '#888', fontWeight: analyzeAgainst === 'SOL' ? 'bold' : 'normal', cursor: 'pointer' }}
             >
               VS SOL
             </button>
             <button 
                onClick={() => setAnalyzeAgainst('USDT')}
                style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'USDT' ? '#00ff88' : 'transparent', color: analyzeAgainst === 'USDT' ? '#000' : '#888', fontWeight: analyzeAgainst === 'USDT' ? 'bold' : 'normal', cursor: 'pointer' }}
             >
               VS USDT
             </button>
           </div>
        </div>
        {activeTab === 'MACRO' && renderDashboard('1D', patterns1D, progress1D)}
        {activeTab === 'SWING' && renderDashboard('4H', patterns4H, progress4H)}
        {activeTab === 'TOP_DEPARTS' && renderDashboard('1D', getBestTokens(), progress1D, true)}
        {activeTab === 'EXPERT_TABLE' && <ExpertTableDashboard patterns={patterns1D.map((p, idx) => ({...p, originalIndex: idx}))} onOpenFullScreen={(symbol, tf, pattern) => setFullScreenData({symbol, timeframe: tf, pattern})} />}
        {activeTab === 'PORTFOLIO_DEMO' && <PortfolioDashboard />}
        {activeTab === 'DEX_LIQUIDITY' && <DexAnalyticsDashboard symbols={top500} />}
      </div>

      {fullScreenData && (
        <div style={{ position: 'fixed', inset: 0, background: '#051016', zIndex: 9999, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ color: '#00ff88', margin: 0 }}>{analyzeAgainst === 'SOL' ? fullScreenData.symbol.replace('USDT', '/SOL') : fullScreenData.symbol} ({fullScreenData.timeframe})</h2>
              <button onClick={() => setFullScreenData(null)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>FERMER</button>
           </div>
           <div style={{ flex: 1, display: 'flex', gap: '1.5rem', minHeight: 0 }}>
               <div style={{ flex: '1 1 75%', minWidth: 0, height: '100%' }}>
                  <TradingViewChart 
                      symbol={analyzeAgainst === 'SOL' ? fullScreenData.symbol.replace('USDT', '/SOL') : fullScreenData.symbol} 
                      initialTrajectory={fullScreenData.pattern.klines}
                      hh={fullScreenData.pattern.oldHigh}
                      parabolaCurve={fullScreenData.pattern.parabolaCurve}
                      ema20Data={fullScreenData.pattern.ema20}
                      ema50Data={fullScreenData.pattern.ema50}
                      anchoredVwapData={fullScreenData.pattern.anchoredVWAP}
                      volumeData={fullScreenData.pattern.volumeData}
                      deadZoneBox={fullScreenData.pattern.deadZoneBox}
                      rawTokenData={fullScreenData.pattern.rawTokenData}
                      rawSolData={fullScreenData.pattern.rawSolData}
                      mathCoeffs={fullScreenData.pattern.mathCoeffs}
                      initialTimeframe={fullScreenData.timeframe === '1D' ? 'D' : '240'} 
                      hideControls={false}
                      showMiniCharts={true}
                  />
               </div>
               <div style={{ flex: '0 0 350px', height: '100%' }}>
                  <ExpertSystem rawSymbol={fullScreenData.symbol} pattern={fullScreenData.pattern} />
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

const ParabolicRecoveryDashboard = ({ top500, timeframe, patterns, progress, analyzing, isBestMode, listFilter, analyzeAgainst, onOpenFullScreen }) => {
  const displayRange = useMemo(() => {
    switch(listFilter) {
      case 'TOP_100': return [0, 100];
      case 'TOP_200': return [100, 200];
      case 'TOP_300': return [200, 300];
      case 'TOP_400': return [300, 400];
      case 'TOP_500': return [400, 500];
      default: return [0, 100];
    }
  }, [listFilter]);

  const displayedPatterns = useMemo(() => {
    if (isBestMode) return patterns;
    
    const patternWithIndex = patterns.map(p => {
      const idx = top500.findIndex(t => t.symbol === p.symbol);
      return { ...p, originalIndex: idx };
    });
    return patternWithIndex
      .filter(p => p.originalIndex >= displayRange[0] && p.originalIndex < displayRange[1])
      .sort((a, b) => b.pattern.breakoutPercent - a.pattern.breakoutPercent);
  }, [patterns, top500, displayRange, isBestMode]);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {analyzing && (
          <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '10px 15px', borderRadius: '6px' }}>
            <div style={{ color: '#8b5cf6', fontSize: '0.7rem', fontFamily: 'monospace', marginBottom: '6px', textAlign: 'center' }}>[ INFERENCE ENGINE: PROCESSING ]</div>
            <div style={{ width: '150px', height: '4px', background: '#14303b', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#8b5cf6', transition: 'width 0.3s' }}></div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
        {displayedPatterns.map(({ symbol, pattern: p }, idx) => {
          const displayBreakout = p.breakoutPercent;
          const displayType = p.type;
          
          return (
          <div key={idx} style={{ background: '#0d212b', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0', color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {analyzeAgainst === 'SOL' ? <>{symbol.replace('USDT', '')} <span style={{ color: '#64748b', fontSize: '0.9rem' }}>/SOL</span></> : symbol}
                  </h3>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{timeframe} Parabolic Recovery • Drop: {p.dropPercent.toFixed(1)}%</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ 
                  color: displayType === 'PRE-BREAKOUT' ? '#f59e0b' : '#8b5cf6', 
                  fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 'bold' 
                }}>
                  [{displayType}] {displayBreakout > 0 ? '+' : ''}{displayBreakout.toFixed(2)}%
                </span>
                
                <button 
                  onClick={() => onOpenFullScreen(symbol, timeframe, p)}
                  title="Ouvrir en plein écran"
                  style={{ 
                    background: 'transparent', border: 'none', 
                    color: '#8b5cf6', cursor: 'pointer', padding: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', opacity: 0.7
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                  onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            <div style={{ padding: '1px', flex: 1 }}>
              <div style={{ height: '280px', width: '100%' }}>
                  <TradingViewChart 
                     symbol={symbol} 
                     initialTrajectory={p.klines} 
                     hh={p.oldHigh}
                     parabolaCurve={p.parabolaCurve}
                     ema20Data={p.ema20}
                     ema50Data={p.ema50}
                     anchoredVwapData={p.anchoredVWAP}
                     volumeData={p.volumeData}
                     deadZoneBox={p.deadZoneBox}
                     rawTokenData={p.rawTokenData}
                     rawSolData={p.rawSolData}
                     initialTimeframe={timeframe === '1D' ? 'D' : '240'}
                     hideControls={true}
                  />
              </div>
            </div>
          </div>
          );
        })}
        {displayedPatterns.length === 0 && !analyzing && (
          <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#64748b', border: '1px dashed rgba(0, 240, 255, 0.2)', borderRadius: '4px', fontFamily: 'monospace' }}>
            &gt; NO_DATA_FOUND_IN_THIS_RANGE
          </div>
        )}
      </div>
    </div>
  );
};
