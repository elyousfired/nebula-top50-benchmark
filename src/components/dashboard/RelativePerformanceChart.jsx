import React, { useMemo } from 'react';

const COLORS = {
  'SOL': '#9945FF',
  'JUP': '#22d3ee', // Cyan
  'ORCA': '#facc15', // Yellow
  'JTO': '#4ade80', // Green
  'RAY': '#f87171', // Red
  'MET': '#c084fc', // Purple
};

const RelativePerformanceChart = ({ pricesByTime, alignedTimes, tokens, referenceToken = 'SOL', resetDaily = false }) => {
  
  const chartData = useMemo(() => {
    if (!alignedTimes || alignedTimes.length === 0 || !pricesByTime) return null;
    
    const t0 = alignedTimes[0];
    let currentBaseTime = alignedTimes[0];
    let currentDay = new Date(currentBaseTime).getUTCDate();
    
    // Check if we have base prices
    let validBase = true;
    tokens.forEach(tok => {
      if (!pricesByTime[currentBaseTime] || !pricesByTime[currentBaseTime][tok]) validBase = false;
    });
    if (!validBase) return null;

    const dataPoints = alignedTimes.map(t => {
      const point = { time: t };
      
      if (resetDaily) {
        const day = new Date(t).getUTCDate();
        if (day !== currentDay) {
          currentDay = day;
          currentBaseTime = t;
          point.isDayBoundary = true;
        }
      }

      // MACRO return of reference token since the beginning
      const refMacroBasePrice = pricesByTime[t0][referenceToken];
      const refMacroReturn = refMacroBasePrice ? (pricesByTime[t][referenceToken] / refMacroBasePrice) - 1 : 0;
      
      // DAILY return of reference token
      const refDailyBasePrice = pricesByTime[currentBaseTime][referenceToken];
      const refDailyReturn = refDailyBasePrice ? (pricesByTime[t][referenceToken] / refDailyBasePrice) - 1 : 0;
      
      tokens.forEach(tok => {
        if (tok === referenceToken) {
           if (resetDaily) {
               // In tree-branch mode, the reference line moves according to its macro performance
               point[tok] = refMacroReturn * 100;
           } else {
               // In normal mode, reference line is perfectly flat at 0%
               point[tok] = 0; 
           }
        } else {
           if (pricesByTime[t] && pricesByTime[t][tok] && pricesByTime[currentBaseTime][tok]) {
              if (resetDaily) {
                  // Altcoin daily return
                  const tokDailyBasePrice = pricesByTime[currentBaseTime][tok];
                  const tokDailyReturn = (pricesByTime[t][tok] / tokDailyBasePrice) - 1;
                  
                  // Daily relative performance vs SOL
                  const dailyRelativePerf = tokDailyReturn - refDailyReturn;
                  
                  // Anchor the altcoin to the moving MACRO SOL line!
                  point[tok] = (refMacroReturn + dailyRelativePerf) * 100;
              } else {
                  // Standard relative macro performance
                  const tokMacroBasePrice = pricesByTime[t0][tok];
                  const tokMacroReturn = (pricesByTime[t][tok] / tokMacroBasePrice) - 1;
                  point[tok] = (tokMacroReturn - refMacroReturn) * 100;
              }
           } else {
              point[tok] = null;
           }
        }
      });
      return point;
    });
    
    return dataPoints;
  }, [pricesByTime, alignedTimes, tokens, referenceToken, resetDaily]);

  if (!chartData) return <div style={{ padding: '20px', color: '#94a3b8' }}>Données insuffisantes pour le graphique</div>;

  // Find min and max for Y axis scaling
  let min = 0;
  let max = 0;
  chartData.forEach(d => {
     tokens.forEach(t => {
        if (d[t] !== null) {
           if (d[t] > max) max = d[t];
           if (d[t] < min) min = d[t];
        }
     });
  });

  // Add padding to min/max
  const padding = Math.max(Math.abs(max), Math.abs(min)) * 0.1;
  if (padding === 0) { max = 1; min = -1; }
  max += Math.max(padding, 2);
  min -= Math.max(padding, 2);

  const width = 800;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const getX = (index) => margin.left + (index / (chartData.length - 1)) * innerWidth;
  const getY = (val) => margin.top + innerHeight - ((val - min) / (max - min)) * innerHeight;

  // Generate paths
  const paths = {};
  tokens.forEach(tok => {
     let d = '';
     chartData.forEach((point, i) => {
         if (point[tok] !== null) {
            const x = getX(i);
            const y = getY(point[tok]);
            if (d === '' || point.isDayBoundary) {
               d += `M ${x} ${y} `;
            } else {
               d += `L ${x} ${y} `;
            }
         }
     });
     paths[tok] = d;
  });

  // Zero line
  const zeroY = getY(0);

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#cbd5e1' }}>
        Performance Relative vs {referenceToken} (Ligne de Base 0%)
      </h3>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
        {tokens.map(tok => (
          <div key={tok} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[tok] || '#fff' }} />
            <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{tok}</span>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '600px', height: 'auto', display: 'block' }}>
          {/* Grid lines */}
          <line x1={margin.left} y1={margin.top} x2={width - margin.right} y2={margin.top} stroke="rgba(255,255,255,0.05)" />
          <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="rgba(255,255,255,0.05)" />
          
          {/* Day Boundaries */}
          {chartData.map((d, i) => {
             if (d.isDayBoundary) {
                const x = getX(i);
                return (
                   <g key={`boundary-${i}`}>
                     <line x1={x} y1={margin.top} x2={x} y2={height - margin.bottom} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 2" />
                     <text x={x + 4} y={margin.top + 10} fill="#64748b" fontSize="9">{new Date(d.time).getDate()}/{new Date(d.time).getMonth()+1}</text>
                   </g>
                );
             }
             return null;
          })}
          
          {/* Zero Line / Reference Line */}
          {!resetDaily && (
             <>
               <line x1={margin.left} y1={zeroY} x2={width - margin.right} y2={zeroY} stroke={COLORS[referenceToken]} strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />
               <text x={margin.left - 10} y={zeroY} fill={COLORS[referenceToken]} fontSize="12" textAnchor="end" alignmentBaseline="middle">0%</text>
             </>
          )}

          {/* Max/Min Labels */}
          <text x={margin.left - 10} y={margin.top} fill="#64748b" fontSize="10" textAnchor="end" alignmentBaseline="middle">+{max.toFixed(1)}%</text>
          <text x={margin.left - 10} y={height - margin.bottom} fill="#64748b" fontSize="10" textAnchor="end" alignmentBaseline="middle">{min.toFixed(1)}%</text>

          {/* Lines */}
          {tokens.map(tok => {
             const isRef = tok === referenceToken;
             if (isRef && !resetDaily) return null; // We already drew the flat zero line
             
             return (
               <path 
                 key={tok} 
                 d={paths[tok]} 
                 fill="none" 
                 stroke={COLORS[tok] || '#fff'} 
                 strokeWidth={isRef ? "3" : "2"} 
                 strokeLinejoin="round"
                 strokeDasharray={isRef ? "5 5" : "none"}
                 opacity={isRef ? "0.9" : "0.85"}
               />
             );
          })}
        </svg>
      </div>
    </div>
  );
};

export default RelativePerformanceChart;
