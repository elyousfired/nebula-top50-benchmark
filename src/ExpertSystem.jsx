import React, { useState, useEffect } from 'react';
import { fetchBybitData, calculateEMA } from './logic/scanner';
import { ShieldCheck, ShieldAlert, TrendingUp, TrendingDown, Clock, Activity, Target } from 'lucide-react';

const ExpertSystem = ({ rawSymbol, pattern }) => {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState({ '1D': null, '4H': null, '1H': null });
  const [confluences, setConfluences] = useState({
    retest: false,
    fvg: false,
    volumeAccumulation: false,
    emaReclaim: false
  });
  
  useEffect(() => {
    let isMounted = true;
    
    const analyzeTrend = async () => {
      setLoading(true);
      try {
        const timeframes = [
          { label: '1D', interval: 'D', limit: 100 },
          { label: '4H', interval: '240', limit: 100 },
          { label: '1H', interval: '60', limit: 100 }
        ];
        
        const results = {};
        for (const tf of timeframes) {
          const data = await fetchBybitData(rawSymbol, tf.interval, tf.limit);
          if (data && data.length > 50) {
            const closes = data.map(k => parseFloat(k[4]));
            const ema20 = calculateEMA(closes, 20);
            const ema50 = calculateEMA(closes, 50);
            
            const lastEma20 = ema20[ema20.length - 1];
            const lastEma50 = ema50[ema50.length - 1];
            
            results[tf.label] = {
              ema20: lastEma20,
              ema50: lastEma50,
              isBullish: lastEma20 > lastEma50
            };
          } else {
            results[tf.label] = { isBullish: false };
          }
        }
        
        if (isMounted) {
          setTrends(results);
          
          // Evaluate Confluences from pattern
          let hasRetest = false;
          if (pattern.parabolaCurve && pattern.parabolaCurve.length > 0 && pattern.klines) {
              const curveMap = new Map();
              pattern.parabolaCurve.forEach(p => curveMap.set(p.time, p.value));
              pattern.klines.forEach(d => {
                 const cVal = curveMap.get(d.time);
                 if (cVal && d.low <= cVal * 1.05 && d.low >= cVal * 0.90 && d.close >= cVal) {
                     hasRetest = true;
                 }
              });
          }
          
          setConfluences({
            retest: hasRetest,
            emaReclaim: pattern.hasEmaReclaim,
            volumeAccumulation: pattern.deadZoneBox && pattern.deadZoneBox.length > 0
          });
          
          setLoading(false);
        }
      } catch (err) {
        console.error("Error analyzing trend:", err);
        if (isMounted) setLoading(false);
      }
    };
    
    analyzeTrend();
    return () => { isMounted = false; };
  }, [rawSymbol, pattern]);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a1a21', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '20px' }}>
        <Activity size={32} color="#00f0ff" style={{ animation: 'spin 2s linear infinite', marginBottom: '16px' }} />
        <h3 style={{ color: '#00f0ff', margin: 0, fontSize: '0.9rem' }}>ANALYSE MULTI-TIMEFRAME EN COURS...</h3>
        <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '8px' }}>Vérification des EMA 20/50 sur 1D, 4H, 1H</p>
      </div>
    );
  }

  const isFullTrendBullish = trends['1D']?.isBullish && trends['4H']?.isBullish && trends['1H']?.isBullish;
  
  let score = 0;
  if (isFullTrendBullish) score += 50;
  else if (trends['1D']?.isBullish && trends['4H']?.isBullish) score += 30;
  
  if (confluences.retest) score += 20;
  if (confluences.emaReclaim) score += 15;
  if (confluences.volumeAccumulation) score += 15;
  
  let verdict = { text: 'DO NOT TRADE', color: '#ef4444', icon: ShieldAlert };
  if (score >= 80) verdict = { text: 'STRONG BUY', color: '#10b981', icon: ShieldCheck };
  else if (score >= 50) verdict = { text: 'BUY', color: '#3b82f6', icon: Target };
  else if (score >= 30) verdict = { text: 'WAIT (CONSOLIDATION)', color: '#f59e0b', icon: Clock };

  const VerdictIcon = verdict.icon;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a1a21', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '15px' }}>
        <Activity size={20} color="#00f0ff" />
        <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: 0, fontWeight: '800' }}>SYSTÈME EXPERT</h3>
      </div>
      
      {/* Verdict Panel */}
      <div style={{ background: `linear-gradient(45deg, ${verdict.color}15, transparent)`, border: `1px solid ${verdict.color}40`, borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
         <VerdictIcon size={32} color={verdict.color} style={{ marginBottom: '10px' }} />
         <div style={{ color: verdict.color, fontSize: '1.4rem', fontWeight: '900', letterSpacing: '1px' }}>{verdict.text}</div>
         <div style={{ color: '#a1a1aa', fontSize: '0.8rem', marginTop: '5px' }}>Score de Confluence: <span style={{ color: '#fff', fontWeight: 'bold' }}>{score}/100</span></div>
      </div>
      
      {/* Pillar 1: Trend */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ color: '#00f0ff', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', borderBottom: '1px solid rgba(0,240,255,0.1)', paddingBottom: '5px' }}>Pilier 1 : Tendance (EMA 20 &gt; 50)</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
           {['1D', '4H', '1H'].map(tf => {
             const isBullish = trends[tf]?.isBullish;
             return (
               <div key={tf} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 'bold' }}>Timeframe {tf}</span>
                  {isBullish ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold' }}><TrendingUp size={14} /> HAUSSIER</span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold' }}><TrendingDown size={14} /> BAISSIER</span>
                  )}
               </div>
             )
           })}
        </div>
      </div>
      
      {/* Pillar 2 & 3: Confluences */}
      <div>
        <h4 style={{ color: '#00f0ff', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', borderBottom: '1px solid rgba(0,240,255,0.1)', paddingBottom: '5px' }}>Confluences (Triggers)</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
              <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>Retest Parabole Confirmé</span>
              <span style={{ color: confluences.retest ? '#10b981' : '#64748b', fontWeight: 'bold' }}>{confluences.retest ? 'OUI' : 'NON'}</span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
              <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>Zone d'Accumulation (Volume)</span>
              <span style={{ color: confluences.volumeAccumulation ? '#10b981' : '#64748b', fontWeight: 'bold' }}>{confluences.volumeAccumulation ? 'OUI' : 'NON'}</span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
              <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>Reclaim EMA 50 Récents</span>
              <span style={{ color: confluences.emaReclaim ? '#10b981' : '#64748b', fontWeight: 'bold' }}>{confluences.emaReclaim ? 'OUI' : 'NON'}</span>
           </div>
        </div>
      </div>
      
      <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
         <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
           Rappel: Le trading comporte des risques. Ceci est un système d'aide à la décision mathématique.
         </div>
      </div>
    </div>
  );
};

export default ExpertSystem;
