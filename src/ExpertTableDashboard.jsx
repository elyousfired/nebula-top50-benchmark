import React, { useState, useEffect, useRef } from 'react';
import { evaluateTokenExpert } from './logic/ExpertEngine';
import { buyToken } from './logic/PortfolioEngine';
import { Maximize2, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Target, Activity, ShoppingCart } from 'lucide-react';

const ExpertTableDashboard = ({ patterns, onOpenFullScreen }) => {
  const [expertData, setExpertData] = useState({});
  const [queueStatus, setQueueStatus] = useState({ total: 0, processed: 0 });
  const processingRef = useRef(false);
  const queueRef = useRef([]);

  useEffect(() => {
    const toProcess = patterns.filter(p => !expertData[p.symbol]);
    queueRef.current = toProcess;
    setQueueStatus({ total: patterns.length, processed: patterns.length - toProcess.length });

    const processQueue = async () => {
      if (processingRef.current || queueRef.current.length === 0) return;
      processingRef.current = true;

      while (queueRef.current.length > 0) {
        const batch = queueRef.current.splice(0, 3);
        
        const results = await Promise.all(batch.map(async (p) => {
          const res = await evaluateTokenExpert(p.symbol, p.pattern);
          return { symbol: p.symbol, data: res };
        }));

        setExpertData(prev => {
          const next = { ...prev };
          results.forEach(r => {
            if (r.data) next[r.symbol] = r.data;
          });
          return next;
        });

        setQueueStatus(prev => ({ ...prev, processed: prev.processed + batch.length }));
        await new Promise(r => setTimeout(r, 1000));
      }
      
      processingRef.current = false;
    };

    processQueue();
  }, [patterns]);

  const handleBuy = (symbol, price) => {
    // Trouver le prix actuel de SOLUSDT pour la conversion (1 SOL = X USDT)
    const solPattern = patterns.find(p => p.symbol === 'SOLUSDT');
    const solPriceUsdt = solPattern ? solPattern.pattern.currentPrice : 150; // Fallback sécurisé

    const res = buyToken(symbol, price, solPriceUsdt);
    if (res.success) {
      alert(res.message);
    } else {
      alert(res.message);
    }
  };

  const sortedPatterns = React.useMemo(() => {
    return [...patterns].sort((a, b) => {
      const scoreA = expertData[a.symbol]?.score ?? -1;
      const scoreB = expertData[b.symbol]?.score ?? -1;
      return scoreB - scoreA;
    });
  }, [patterns, expertData]);

  return (
    <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
         <h2 style={{ color: '#00f0ff', margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Activity size={24} /> EXPERT SCREENER LEADERBOARD
         </h2>
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,240,255,0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(0,240,255,0.3)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: processingRef.current ? '#00f0ff' : '#64748b', boxShadow: processingRef.current ? '0 0 10px #00f0ff' : 'none' }}></div>
            <span style={{ color: '#f8fafc', fontSize: '0.8rem', fontWeight: '600' }}>
               ANALYSE IA EN COURS : {queueStatus.processed} / {queueStatus.total}
            </span>
         </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', maxHeight: 'calc(100vh - 150px)', background: '#0a1a21', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '2000px' }}>
          <thead style={{ background: '#051016', position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>RANK</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>ASSET</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>PRICE</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>DROP %</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>DISTANCE</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>TREND (1D/4H/1H)</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>RETEST</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>VWAP</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>SCORE</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>BIAS</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>PLAN (E / S / T)</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)', width: '250px' }}>MAIN REASON</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)', width: '250px' }}>MAIN RISK</th>
              <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {sortedPatterns.map((p, idx) => {
              const expert = expertData[p.symbol];
              const price = expert?.plan?.entry || p.pattern.currentPrice;
              
              return (
                <tr key={p.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>#{idx + 1}</td>
                  <td style={{ padding: '16px 20px', color: '#f8fafc', fontWeight: 'bold', fontSize: '1rem' }}>{p.symbol.replace('USDT', '/SOL')}</td>
                  <td style={{ padding: '16px 20px', color: '#a1a1aa', fontSize: '0.85rem' }}>{price.toFixed(5)}</td>
                  <td style={{ padding: '16px 20px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>{p.pattern.dropPercent.toFixed(1)}%</td>
                  <td style={{ padding: '16px 20px', color: p.pattern.breakoutPercent > 0 ? '#10b981' : '#f59e0b', fontSize: '0.85rem', fontWeight: 'bold' }}>{p.pattern.breakoutPercent.toFixed(1)}%</td>
                  
                  {expert ? (
                    <>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                           {['1D', '4H', '1H'].map(tf => (
                             <span key={tf} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', background: expert.trends[tf]?.isBullish ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: expert.trends[tf]?.isBullish ? '#10b981' : '#ef4444' }}>
                               {tf}
                             </span>
                           ))}
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        {expert.confluences.retest ? <CheckCircle2 size={16} color="#10b981" /> : <XCircle size={16} color="#ef4444" />}
                      </td>
                      
                      <td style={{ padding: '16px 20px' }}>
                        {expert.confluences.vwapBullish ? <TrendingUp size={16} color="#3b82f6" /> : <TrendingDown size={16} color="#ef4444" />}
                      </td>

                      <td style={{ padding: '16px 20px', fontSize: '1rem', fontWeight: '900', color: '#00f0ff' }}>
                        {expert.score}/100
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', border: `1px solid ${expert.verdict.includes('BUY') ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}`, color: expert.verdict.includes('BUY') ? '#10b981' : '#ef4444' }}>
                          {expert.verdict}
                        </span>
                      </td>

                      <td style={{ padding: '16px 20px', fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.4' }}>
                        <div style={{ fontFamily: 'monospace' }}>
                          <div style={{ color: '#10b981' }}>E: {expert.plan.entry.toFixed(5)}</div>
                          <div style={{ color: '#ef4444' }}>S: {expert.plan.stopLoss.toFixed(5)}</div>
                          <div style={{ color: '#3b82f6' }}>T: {expert.plan.takeProfit.toFixed(5)}</div>
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                        {expert.instructions?.mainReason || '-'}
                      </td>

                      <td style={{ padding: '16px 20px', fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
                        {expert.instructions?.mainRisk || '-'}
                      </td>
                    </>
                  ) : (
                    <td colSpan="8" style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic', textAlign: 'center' }}>
                      <Activity size={14} style={{ animation: 'spin 2s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: '5px' }} />
                      Analyse IA en cours...
                    </td>
                  )}

                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleBuy(p.symbol, price)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.7rem', fontWeight: 'bold' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                      >
                        <ShoppingCart size={14} /> BUY
                      </button>
                      <button 
                        onClick={() => onOpenFullScreen(p.symbol, '1D', p.pattern)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', color: '#00f0ff', border: '1px solid rgba(0, 240, 255, 0.4)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.7rem', fontWeight: 'bold' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 240, 255, 0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Maximize2 size={14} /> CHART
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpertTableDashboard;
