import React from 'react';

/**
 * PREMIUM RADAR: Un sonar holographique avec balayage circulaire
 */
export const PremiumRadar = ({ tokens, scans, title, onTokenClick }) => {
  if (!tokens || tokens.length === 0) return null;

  const sortedTokens = [...tokens].map(symbol => {
    const data = scans[symbol];
    const latestPrice = data && data.trajectory && data.trajectory.length > 0 ? data.trajectory[data.trajectory.length - 1].price : (data ? data.vwapDaily : 0);
    const gap = data && data.yesterdayMax > 0 ? ((latestPrice / data.yesterdayMax - 1) * 100) : -99;
    return { symbol, gap, data };
  }).filter(t => t.gap >= -8).sort((a, b) => a.gap - b.gap);

  return (
    <div className="premium-radar-container">
      <div className="radar-header-pro">
        <div className="radar-title-box">
          <span className="radar-tag">INSTITUTIONAL</span>
          <h3>{title} <span className="pro-label">PRO</span></h3>
        </div>
        <div className="radar-status">
          <div className="scanning-pulse"></div>
          OMNISCIENCE ACTIVE
        </div>
      </div>

      <div className="premium-radar-box">
        {/* Effet Sonar / Balayage */}
        <div className="radar-sweep"></div>
        
        {/* Cercles Concentriques de profondeur */}
        <div className="radar-circle c1"></div>
        <div className="radar-circle c2"></div>
        <div className="radar-circle c3"></div>
        
        {/* Axes de référence */}
        <div className="radar-axis-h"></div>
        <div className="radar-axis-v"></div>

        {/* Labels de distance */}
        <span className="radar-dist-label d1">0% (BREAKOUT)</span>
        <span className="radar-dist-label d2">-2% (SUPPORT)</span>
        <span className="radar-dist-label d3">-5% (COIL)</span>

        {sortedTokens.map((t, index) => {
          // Mapping circulaire : Gap = Distance du centre, Index = Angle
          const distance = 50 + (Math.max(Math.min(t.gap, 2), -8) + 8) * 25; // 50px à 250px du centre
          const angle = (index / sortedTokens.length) * Math.PI * 2;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;

          const buyPressure = t.data?.depthAnalysis?.buyPressure || 50;
          const intensity = Math.min(buyPressure / 100 + 0.5, 1.5);
          
          let color = '#9945FF'; // Purple default
          if (t.gap > 0) color = '#00ff88'; // Green breakout
          else if (t.gap > -2) color = '#FFD700'; // Gold compression

          return (
            <div 
              key={t.symbol} 
              className="premium-node"
              onClick={() => onTokenClick(t.symbol)}
              style={{
                transform: `translate(calc(50% + ${x}px), calc(50% + ${y}px))`,
                '--node-color': color,
                '--node-intensity': intensity
              }}
            >
              <div className="node-glow"></div>
              <div className="node-point"></div>
              <div className="node-label-pro">
                <span className="symbol">{t.symbol.replace('USDT', '')}</span>
                <span className="gap">{t.gap > 0 ? '+' : ''}{t.gap.toFixed(2)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .premium-radar-container {
          background: radial-gradient(circle at center, #0a0a15 0%, #050505 100%);
          border-radius: 24px;
          padding: 2rem;
          border: 1px solid rgba(153, 69, 255, 0.2);
          box-shadow: 0 0 40px rgba(0,0,0,0.5);
          position: relative;
          overflow: hidden;
          margin-top: 2rem;
        }
        .radar-header-pro { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .radar-tag { font-size: 0.5rem; font-weight: 900; color: #9945FF; letter-spacing: 2px; }
        .pro-label { background: #9945FF; color: #fff; padding: 2px 6px; borderRadius: 4px; fontSize: 0.6rem; margin-left: 8px; }
        .radar-status { display: flex; alignItems: center; gap: 8px; fontSize: 0.6rem; color: #00ff88; fontWeight: 900; }
        .scanning-pulse { width: 8px; height: 8px; background: #00ff88; border-radius: 50%; animation: pulse 1.5s infinite; }
        
        .premium-radar-box {
          position: relative;
          width: 100%;
          height: 600px;
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 50%;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .radar-circle { position: absolute; border: 1px solid rgba(255,255,255,0.05); border-radius: 50%; transform: translate(-50%, -50%); top: 50%; left: 50%; }
        .c1 { width: 200px; height: 200px; }
        .c2 { width: 400px; height: 400px; }
        .c3 { width: 600px; height: 600px; border-style: dashed; }
        
        .radar-axis-h { position: absolute; width: 100%; height: 1px; background: rgba(255,255,255,0.03); top: 50%; }
        .radar-axis-v { position: absolute; height: 100%; width: 1px; background: rgba(255,255,255,0.03); left: 50%; }
        
        .radar-sweep {
          position: absolute;
          width: 50%;
          height: 50%;
          background: conic-gradient(from 0deg, rgba(153, 69, 255, 0.2) 0%, transparent 45%);
          top: 0; left: 0;
          transform-origin: bottom right;
          animation: rotate 4s linear infinite;
          pointer-events: none;
          z-index: 1;
        }

        .radar-dist-label { position: absolute; color: rgba(255,255,255,0.2); font-size: 0.5rem; font-weight: 900; }
        .d1 { top: calc(50% - 110px); left: 50.5%; }
        .d2 { top: calc(50% - 210px); left: 50.5%; }
        .d3 { top: calc(50% - 310px); left: 50.5%; }

        .premium-node {
          position: absolute;
          width: 0; height: 0;
          cursor: pointer;
          z-index: 2;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .node-point {
          width: 10px; height: 10px;
          background: var(--node-color);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 calc(10px * var(--node-intensity)) var(--node-color);
        }
        .node-glow {
          position: absolute;
          width: 30px; height: 30px;
          background: var(--node-color);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.15;
          filter: blur(8px);
        }
        .node-label-pro {
          position: absolute;
          top: 10px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center;
          opacity: 0.7; transition: opacity 0.3s;
        }
        .premium-node:hover .node-label-pro { opacity: 1; }
        .symbol { font-size: 0.65rem; font-weight: 900; color: #fff; text-shadow: 0 0 5px #000; }
        .gap { font-size: 0.55rem; color: var(--node-color); font-weight: 800; }

        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}} />
    </div>
  );
};

/**
 * PREMIUM CURVES: Des trajectoires avec glow et gradients
 */
export const PremiumTokenCard = ({ t, isExpanded, onToggle, width = 300, height = 120 }) => {
  const chartData = t.trajectory;
  if (!chartData || chartData.length < 2) return null;

  const allVals = chartData.flatMap(d => [d.price, d.vwap, d.ema]);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = Math.max(maxVal - minVal, 0.00000001);
  const getY = (val) => height - ((val - minVal) / range) * height;
  const stepX = width / (chartData.length - 1);

  const isPositive = t.gap >= 0;
  const mainColor = isPositive ? '#00ff88' : '#ff3b30';

  return (
    <div className={`premium-curve-card ${isExpanded ? 'expanded' : ''}`} onClick={onToggle}>
      <div className="card-glass-effect"></div>
      
      <div className="card-header-pro">
        <div className="token-identity">
          <span className="sym">{t.symbol.replace('USDT', '')}</span>
          <span className="name">BYBIT SPOT</span>
        </div>
        <div className="price-info">
          <span className="price">${t.lastPrice || '---'}</span>
          <span className={`gap-badge ${isPositive ? 'pos' : 'neg'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(t.gap).toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="premium-chart-area">
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={`grad-${t.symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={mainColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={mainColor} stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Zone de remplissage sous la courbe */}
          <path 
            d={`M 0,${height} ` + chartData.map((d, i) => `L ${i * stepX},${getY(d.price)}`).join(' ') + ` L ${width},${height} Z`} 
            fill={`url(#grad-${t.symbol})`} 
          />

          {/* Lignes de repère (Hier Max/Min) */}
          {t.yesterdayMax > 0 && (
            <line x1="0" y1={getY(t.yesterdayMax)} x2={width} y2={getY(t.yesterdayMax)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,4" />
          )}

          {/* Courbes EMA & VWAP (Subtiles) */}
          <polyline fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" points={chartData.map((d, i) => `${i * stepX},${getY(d.ema)}`).join(' ')} />
          <polyline fill="none" stroke="rgba(0, 208, 255, 0.3)" strokeWidth="1.5" points={chartData.map((d, i) => `${i * stepX},${getY(d.vwap)}`).join(' ')} />

          {/* Courbe de prix principale */}
          <polyline 
            fill="none" 
            stroke={mainColor} 
            strokeWidth="3" 
            filter="url(#glow)"
            points={chartData.map((d, i) => `${i * stepX},${getY(d.price)}`).join(' ')} 
          />
          
          <circle cx={width} cy={getY(chartData[chartData.length - 1].price)} r="4" fill="#fff" />
        </svg>
      </div>

      <div className="card-footer-pro">
        <div className="footer-stat">
          <span className="label">PRESSURE</span>
          <span className="val" style={{ color: mainColor }}>{t.depthAnalysis?.buyPressure?.toFixed(0)}%</span>
        </div>
        <div className="footer-stat">
          <span className="label">SIGNAL</span>
          <span className="val">{t.decision.label.split(' ')[1] || t.decision.label}</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .premium-curve-card {
          background: #0a0a0f;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
        }
        .premium-curve-card:hover {
          border-color: rgba(0, 255, 136, 0.3);
          transform: translateY(-5px);
          box-shadow: 0 15px 35px rgba(0,0,0,0.4);
        }
        .card-glass-effect {
          position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle at center, rgba(255,255,255,0.03) 0%, transparent 70%);
          pointer-events: none;
        }
        .card-header-pro { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; z-index: 2; position: relative; }
        .token-identity .sym { font-size: 1.2rem; font-weight: 900; color: #fff; display: block; }
        .token-identity .name { font-size: 0.55rem; color: #555; font-weight: 800; letter-spacing: 1px; }
        .price-info { text-align: right; }
        .price-info .price { font-size: 1rem; font-weight: 800; color: #fff; display: block; }
        .gap-badge { font-size: 0.65rem; font-weight: 900; padding: 2px 8px; border-radius: 6px; margin-top: 4px; display: inline-block; }
        .gap-badge.pos { background: rgba(0, 255, 136, 0.1); color: #00ff88; }
        .gap-badge.neg { background: rgba(255, 59, 48, 0.1); color: #ff3b30; }
        
        .premium-chart-area { margin: 1rem 0; z-index: 1; position: relative; }
        
        .card-footer-pro { display: flex; justify-content: space-between; margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 1rem; }
        .footer-stat .label { font-size: 0.5rem; color: #444; font-weight: 900; display: block; letter-spacing: 1px; }
        .footer-stat .val { font-size: 0.75rem; font-weight: 800; color: #eee; }
      `}} />
    </div>
  );
};

export const PremiumCurveGrid = ({ tokens, scans, depthHistory, expandedSymbol, setExpandedSymbol }) => {
  if (!tokens || tokens.length === 0) return null;

  const allData = tokens.map(symbol => {
    const data = scans[symbol];
    const latestPrice = data && data.trajectory && data.trajectory.length > 0 ? data.trajectory[data.trajectory.length - 1].price : (data ? data.vwapDaily : 0);
    const gap = data && data.yesterdayMax > 0 ? ((latestPrice / data.yesterdayMax - 1) * 100) : -99;
    
    const decision = (() => {
      if (!data) return { label: 'SCANNING...', col: '#444' };
      const p = data.depthAnalysis?.buyPressure || 50;
      const isBrk = data.vwapDaily > data.yesterdayMax;
      if (isBrk) return { label: '🔥 BREAKOUT', col: '#00ff88' };
      if (p > 75) return { label: '💎 PUMP', col: '#00ff88' };
      return { label: '⏳ WATCH', col: '#888' };
    })();

    return { symbol, gap, ...data, decision };
  }).filter(t => t.vwapDaily);

  return (
    <div className="premium-grid-container" style={{ padding: '2rem 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
        {allData.sort((a,b) => b.gap - a.gap).map(t => (
          <PremiumTokenCard key={t.symbol} t={t} isExpanded={expandedSymbol === t.symbol} onToggle={() => setExpandedSymbol(expandedSymbol === t.symbol ? null : t.symbol)} />
        ))}
      </div>
    </div>
  );
};

/**
 * DAILY LEVELS PRO: Visualisation des 4 niveaux institutionnels clés
 */
export const DailyLevelsPro = ({ tokens, scans }) => {
  if (!tokens || tokens.length === 0) return null;

  const allData = tokens.map(symbol => {
    const data = scans[symbol];
    if (!data || !data.vwapDaily) return null;
    return { symbol, ...data };
  }).filter(t => t !== null);

  return (
    <div className="daily-levels-container">
      <div className="levels-header">
        <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 900 }}>INSTITUTIONAL LEVELS <span className="pro-label">DAILY</span></h2>
        <p style={{ color: '#666', fontSize: '0.7rem' }}>PREVIOUS DAY HIGH/LOW (PRICE vs VWAP)</p>
      </div>

      <div className="levels-grid">
        {allData.map(t => {
          if (!t.trajectory || t.trajectory.length === 0) return null;

          const currentPrice = t.trajectory[t.trajectory.length - 1]?.price || 0;
          
          // Calcul des échelles ultra-précis
          const allTrajectoryPrices = t.trajectory.map(p => p.price);
          const allTrajectoryVwaps = t.trajectory.map(p => p.vwap);
          const levels = [t.yesterdayMaxPrice, t.yesterdayMinPrice, t.yesterdayMax, t.yesterdayMin, ...allTrajectoryPrices, ...allTrajectoryVwaps].filter(v => v > 0 && v !== Infinity && v !== -Infinity);
          
          if (levels.length === 0) return null;

          const minLevel = Math.min(...levels);
          const maxLevel = Math.max(...levels);
          const rawRange = (maxLevel - minLevel) || 0.0001;
          
          // Ajout de 10% de marge en haut et en bas pour la visibilité des lignes
          const min = minLevel - (rawRange * 0.1);
          const max = maxLevel + (rawRange * 0.1);
          const range = max - min;
          const getPos = (val) => ((val - min) / range) * 100;

          // Trouver l'index de séparation entre Hier et Aujourd'hui (Minuit)
          const todayStr = new Date().toISOString().split('T')[0];
          const todayIndex = t.trajectory.findIndex(p => {
             if (!p.time) return false;
             const d = new Date(p.time).toISOString().split('T')[0];
             return d === todayStr;
          });
          const splitX = todayIndex !== -1 ? (todayIndex / (t.trajectory.length - 1)) * 100 : 50;

          return (
            <div key={t.symbol} className={`level-card ${t.isSweepHigh || t.isSweepLow ? 'sweep-active' : ''}`}>
              <div className="level-card-header">
                <span className="sym">{t.symbol.replace('USDT','')}</span>
                {t.isSweepHigh && <span className="sweep-alert high">⚡ SWEEP HIGH</span>}
                {t.isSweepLow && <span className="sweep-alert low">⚡ SWEEP LOW</span>}
                <span className="price">${currentPrice.toLocaleString()}</span>
              </div>

              <div className="levels-visualization">
                {/* Marqueur de séparation des jours (Minuit) */}
                <div className="day-separator" style={{ left: `${splitX}%` }}>
                  <span>TODAY</span>
                </div>

                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
                  <defs>
                    <filter id="glow-eff">
                      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  
                  {/* Courbe VWAP (Cyan - Subtile) */}
                  <polyline
                    fill="none"
                    stroke="rgba(0, 242, 255, 0.25)"
                    strokeWidth="0.5"
                    points={t.trajectory.map((p, i) => {
                      const x = (i / (t.trajectory.length - 1)) * 100;
                      const y = 100 - getPos(p.vwap);
                      return `${x},${y}`;
                    }).join(' ')}
                  />

                  {/* LIGNE DE PRIX BLANCHE (LA COURBE PRINCIPALE) */}
                  <polyline
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.0"
                    style={{ filter: 'url(#glow-eff)' }}
                    points={t.trajectory.map((p, i) => {
                      const x = (i / (t.trajectory.length - 1)) * 100;
                      const y = 100 - getPos(p.price);
                      return `${x},${y}`;
                    }).join(' ')}
                  />

                  {/* MARQUEURS DE SWEEP HISTORIQUES */}
                  {t.trajectory.map((p, i) => {
                    const isHistSweepHigh = p.high > t.yesterdayMaxPrice && p.price < t.yesterdayMaxPrice;
                    const isHistSweepLow = t.yesterdayMinPrice > 0 && p.low < t.yesterdayMinPrice && p.price > t.yesterdayMinPrice;
                    
                    if (!isHistSweepHigh && !isHistSweepLow) return null;

                    const x = (i / (t.trajectory.length - 1)) * 100;
                    const y = 100 - getPos(p.price);
                    const color = isHistSweepHigh ? '#ffB800' : '#9945FF';

                    return (
                      <g key={`sweep-${i}`}>
                        <circle cx={x} cy={y} r="2.5" fill={color} style={{ filter: 'url(#glow-eff)' }}>
                          <animate attributeName="r" values="2.5;4;2.5" dur="1s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={x} cy={y} r="6" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5">
                          <animate attributeName="r" values="6;12" dur="1.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.5;0" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                      </g>
                    );
                  })}
                </svg>

                {/* Niveaux Prix (PDH/PDL) */}
                <div className="level-line price-high" style={{ bottom: `${getPos(t.yesterdayMaxPrice)}%` }}>
                  <span className="level-tag">PDH PRICE</span>
                </div>
                <div className="level-line price-low" style={{ bottom: `${getPos(t.yesterdayMinPrice)}%` }}>
                  <span className="level-tag">PDL PRICE</span>
                </div>

                {/* Niveaux VWAP (PDH/PDL) */}
                <div className="level-line vwap-high" style={{ bottom: `${getPos(t.yesterdayMax)}%` }}>
                  <span className="level-tag">PDH VWAP</span>
                </div>
                <div className="level-line vwap-low" style={{ bottom: `${getPos(t.yesterdayMin)}%` }}>
                  <span className="level-tag">PDL VWAP</span>
                </div>
              </div>

              <div className="levels-data-table">
                <div className="data-row">
                  <span className="l">PRICE RANGE</span>
                  <span className="v">${t.yesterdayMinPrice.toFixed(4)} - ${t.yesterdayMaxPrice.toFixed(4)}</span>
                </div>
                <div className="data-row">
                  <span className="l">VWAP RANGE</span>
                  <span className="v">${t.yesterdayMin.toFixed(4)} - ${t.yesterdayMax.toFixed(4)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .daily-levels-container { padding: 2rem 0; }
        .levels-header { margin-bottom: 2rem; border-left: 4px solid #9945FF; padding-left: 1.5rem; }
        .levels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem; }
        
        .level-card {
          background: #0a0a0f;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 1.5rem;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .level-card.sweep-active {
          border-color: #ffB800;
          box-shadow: 0 0 20px rgba(255, 184, 0, 0.2);
          animation: sweep-pulse 2s infinite;
        }
        .level-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .level-card-header .sym { font-size: 1.2rem; font-weight: 900; color: #fff; }
        .level-card-header .price { font-size: 0.9rem; color: #00ff88; font-weight: 800; }

        .levels-visualization {
          height: 200px;
          background: rgba(255,255,255,0.015);
          border-radius: 8px;
          position: relative;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255,255,255,0.03);
          overflow: hidden;
        }

        .day-separator {
          position: absolute;
          top: 0; bottom: 0;
          width: 1px;
          background: rgba(255,255,255,0.1);
          z-index: 1;
        }
        .day-separator span {
          position: absolute;
          top: 5px; left: 5px;
          font-size: 0.45rem;
          color: rgba(255,255,255,0.2);
          font-weight: 900;
        }

        .sweep-alert {
          font-size: 0.6rem;
          font-weight: 900;
          padding: 2px 8px;
          border-radius: 4px;
          background: #ffB800;
          color: #000;
          animation: flash 0.5s infinite alternate;
        }
        .sweep-alert.low { background: #9945FF; color: #fff; }

        .level-line {
          position: absolute;
          width: 100%;
          height: 1px;
          display: flex;
          align-items: center;
          padding-left: 10px;
          z-index: 2;
        }
        .level-tag {
          font-size: 0.4rem;
          font-weight: 900;
          padding: 1px 4px;
          border-radius: 2px;
          transform: translateY(-50%);
          letter-spacing: 0.5px;
        }

        .price-high { border-top: 1px dashed rgba(255, 59, 48, 0.4); }
        .price-high .level-tag { background: rgba(255, 59, 48, 0.15); color: #ff3b30; }
        
        .price-low { border-top: 1px dashed rgba(255, 59, 48, 0.4); }
        .price-low .level-tag { background: rgba(255, 59, 48, 0.15); color: #ff3b30; }

        .vwap-high { border-top: 1px solid rgba(0, 242, 255, 0.4); }
        .vwap-high .level-tag { background: rgba(0, 242, 255, 0.15); color: #00f2ff; }

        .vwap-low { border-top: 1px solid rgba(153, 69, 255, 0.4); }
        .vwap-low .level-tag { background: rgba(153, 69, 255, 0.15); color: #9945FF; }

        .current-price-marker {
          position: absolute;
          width: 100%;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 5px;
        }
        .marker-line { width: 100%; height: 1px; background: rgba(255,255,255,0.8); box-shadow: 0 0 10px #fff; }
        .marker-label { position: absolute; font-size: 0.5rem; font-weight: 900; color: #000; background: #fff; padding: 1px 4px; border-radius: 2px; transform: translateY(-50%); }

        .levels-data-table { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; }
        .data-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .data-row .l { font-size: 0.55rem; color: #444; font-weight: 900; }
        .data-row .v { font-size: 0.65rem; color: #888; font-weight: 700; }
        @keyframes sweep-pulse { 0% { border-color: rgba(255, 184, 0, 0.2); } 50% { border-color: rgba(255, 184, 0, 1); } 100% { border-color: rgba(255, 184, 0, 0.2); } }
        @keyframes flash { from { opacity: 0.5; } to { opacity: 1; } }
        @keyframes flow { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
      `}} />
    </div>
  );
};

/**
 * MACRO RADAR : Visualisation normalisée du couloir institutionnel
 */
export const MacroRadar = ({ tokens, scans }) => {
  if (!tokens || tokens.length === 0) return null;

  const top20Gainers = [...tokens]
    .map(s => ({ symbol: s, change: parseFloat(scans[s]?.priceChangePercent || 0) }))
    .sort((a, b) => b.change - a.change)
    .slice(0, 20)
    .map(t => t.symbol);

  const radarTokens = tokens.map(symbol => {
    const data = scans[symbol];
    if (!data || !data.yesterdayMax || !data.yesterdayMaxPrice || !data.lastPrice) return null;
    
    const vwap = data.yesterdayMax;
    const priceMax = data.yesterdayMaxPrice;
    
    // Si l'écart est trop faible, on force un range minimum pour éviter la division par 0
    const range = Math.max(priceMax - vwap, vwap * 0.001);
    const macroRatio = (data.lastPrice - vwap) / range;
    
    return { symbol, macroRatio, price: data.lastPrice };
  }).filter(t => t !== null && t.macroRatio >= -2 && t.macroRatio <= 3).sort((a, b) => a.macroRatio - b.macroRatio);

  return (
    <div style={{ marginBottom: '4rem' }}>
      <div className="solana-radar-container" style={{ background: 'rgba(5,5,7,0.8)', border: '1px solid rgba(0, 255, 136, 0.15)', borderRadius: '24px', position: 'relative', height: '650px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
        <div className="radar-header" style={{ position: 'absolute', top: '25px', left: '30px', zIndex: 10 }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: '1.5rem', fontWeight: 900, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>MACRO BREAKOUT RADAR</h3>
          <span style={{ color: '#00ff88', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '1px' }}>NORMALIZED INSTITUTIONAL CORRIDOR</span>
        </div>

        <div className="radar-box" style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* LIGNE DU HAUT : PDH PRICE (100% de la zone de cassure) */}
        <div style={{ position: 'absolute', bottom: '70%', width: '100%', borderTop: '1px dashed #ff3b30', opacity: 0.8 }}></div>
        <span style={{ position: 'absolute', bottom: 'calc(70% + 5px)', left: '20px', fontSize: '0.6rem', color: '#ff3b30', fontWeight: 900 }}>PDH PRICE (ULTIMATE RESISTANCE)</span>

        {/* LIGNE DU BAS : PDH VWAP (0% - Point d'entrée de la zone) */}
        <div style={{ position: 'absolute', bottom: '40%', width: '100%', borderTop: '1px dashed #00d0ff', opacity: 0.8 }}></div>
        <span style={{ position: 'absolute', bottom: 'calc(40% + 5px)', left: '20px', fontSize: '0.6rem', color: '#00d0ff', fontWeight: 900 }}>PDH VWAP (ENTRY TRIGGER)</span>

        {/* POINTS DES JETONS */}
        {radarTokens.map((t, index) => {
          // Mapping: Ratio 0 = 40% height, Ratio 1 = 70% height
          const bottomPercent = Math.max(Math.min(40 + (t.macroRatio * 30), 95), 5);
          
          const isTopGainer = top20Gainers.includes(t.symbol);
          
          let color = '#9945FF'; // Sous le radar (Loin)
          if (isTopGainer) color = '#ffffff'; // Top Gainer en blanc
          else if (t.macroRatio >= 0 && t.macroRatio < 1) color = '#FFB800'; // Dans la zone de combat
          else if (t.macroRatio >= 1) color = '#00ff88'; // Macro Breakout

          const showText = t.macroRatio >= 0 || isTopGainer; // Afficher le texte si dans la zone OU si c'est un top gainer

          return (
            <div key={t.symbol} style={{
              position: 'absolute',
              bottom: `${bottomPercent}%`,
              left: `${(index / Math.max(radarTokens.length - 1, 1)) * 90 + 5}%`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.5s ease'
            }}>
              <div style={{
                width: t.macroRatio >= 1 ? '10px' : '6px',
                height: t.macroRatio >= 1 ? '10px' : '6px',
                background: color, borderRadius: '50%',
                boxShadow: `0 0 ${t.macroRatio >= 1 ? '15px' : '5px'} ${color}`,
                transition: 'all 0.3s'
              }}></div>
              {showText && (
                <div style={{ position: 'absolute', top: '15px', color: '#fff', fontSize: '0.55rem', fontWeight: 900 }}>
                  {t.symbol.replace('USDT', '')}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* TOP 20 GAINERS MOMENTUM TABLE */}
      <div className="momentum-table" style={{ marginTop: '2rem', background: 'rgba(5, 5, 7, 0.8)', borderRadius: '16px', border: '1px solid #151515', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff', fontWeight: '900', letterSpacing: '1px' }}>🏆 TOP 20 GAINERS - MOMENTUM</h4>
          <span style={{ fontSize: '0.6rem', color: '#444' }}>LIVE PERFORMANCE • BYBIT DATA</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          {top20Gainers.map((symbol, i) => {
            const t = scans[symbol] || {};
            return (
              <div key={symbol} className="gainer-card" style={{
                padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #fff',
                transition: 'all 0.2s ease', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', borderRadius: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#fff' }}>#{i + 1} {symbol.replace('USDT', '')}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#fff' }}>
                    {t.priceChangePercent ? `+${parseFloat(t.priceChangePercent).toFixed(2)}%` : '---'}
                  </span>
                </div>
                <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 'bold' }}>
                  {t.lastPrice ? `$${parseFloat(t.lastPrice).toLocaleString()}` : '---'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * MACRO STRATEGY: Suivi chirurgical des Breakouts Long (15m Confirmation)
 */
export const MacroStrategyDashboard = ({ candidates = [], tokens, scans }) => {
  return (
    <div className="macro-strategy-container">
      <MacroRadar tokens={tokens} scans={scans} />

      <div className="macro-header">
        <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 900 }}>⚡ MACRO STRATEGY <span className="long-label">LONG ONLY</span></h2>
        <p style={{ color: '#666', fontSize: '0.8rem' }}>MONITORING 15M CONFIRMATION ABOVE PDH PRICE / PDH VWAP</p>
      </div>

      <div className="macro-grid">
        {candidates.length === 0 ? (
          <div className="no-candidates">
            <div className="radar-search"></div>
            <p>SEARCHING FOR INSTITUTIONAL ATTACKS...</p>
          </div>
        ) : (
          candidates.map(c => {
            const step = c.confirmationStep || 0; // 0: Attack, 1: 1st Close, 2: Confirmed
            return (
              <div key={c.symbol} className={`macro-card step-${step}`}>
                <div className="macro-card-glow"></div>
                <div className="card-top">
                  <span className="sym">{c.symbol.replace('USDT','')}</span>
                  <span className="price">${c.lastPrice}</span>
                </div>
                
                <div className="strategy-status">
                  <div className={`step-indicator ${step >= 0 ? 'active' : ''}`}>
                    <div className="step-dot"></div>
                    <span>ATTACK</span>
                  </div>
                  <div className="step-connector"></div>
                  <div className={`step-indicator ${step >= 1 ? 'active' : ''}`}>
                    <div className="step-dot"></div>
                    <span>15M CLOSE</span>
                  </div>
                  <div className="step-connector"></div>
                  <div className={`step-indicator ${step >= 2 ? 'confirmed' : ''}`}>
                    <div className="step-dot"></div>
                    <span>CONFIRMED</span>
                  </div>
                </div>

                <div className="macro-footer">
                  <div className="stat">
                    <span className="lab">LEVEL</span>
                    <span className="val" style={{ color: '#ffB800' }}>{c.triggerType || 'PDH'} REACHED</span>
                  </div>
                  <div className="stat">
                    <span className="lab">TIME LEFT</span>
                    <span className="val">{c.timeLeft || 'SCANNING...'}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .macro-strategy-container { padding: 2rem 0; }
        .macro-header { margin-bottom: 3rem; border-left: 5px solid #00ff88; padding-left: 1.5rem; }
        .long-label { background: #00ff88; color: #000; padding: 2px 10px; border-radius: 4px; font-size: 0.7rem; margin-left: 10px; vertical-align: middle; }
        
        .macro-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 2rem; }
        
        .no-candidates { 
          grid-column: 1 / -1; height: 300px; display: flex; flex-direction: column; 
          align-items: center; justify-content: center; background: rgba(255,255,255,0.02);
          border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1); color: #444; font-weight: 900;
        }

        .macro-card {
          background: #0a0a0f; border: 1px solid rgba(255,255,255,0.05); border-radius: 24px;
          padding: 2rem; position: relative; overflow: hidden; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .macro-card-glow {
          position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle at center, rgba(0, 255, 136, 0.05) 0%, transparent 70%);
          pointer-events: none; opacity: 0; transition: opacity 0.5s;
        }
        .macro-card.step-2 .macro-card-glow { opacity: 1; }
        .macro-card.step-2 { border-color: #00ff88; box-shadow: 0 0 30px rgba(0, 255, 136, 0.15); transform: translateY(-5px); }

        .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .card-top .sym { font-size: 1.5rem; font-weight: 900; color: #fff; }
        .card-top .price { font-size: 1rem; color: #888; font-weight: 800; }

        .strategy-status { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; position: relative; }
        .step-indicator { display: flex; flex-direction: column; align-items: center; gap: 10px; z-index: 2; }
        .step-dot { width: 12px; height: 12px; border-radius: 50%; background: #222; border: 2px solid #333; transition: all 0.4s; }
        .step-indicator span { font-size: 0.55rem; font-weight: 900; color: #444; transition: all 0.4s; }
        
        .step-indicator.active .step-dot { background: #ffB800; border-color: #ffB800; box-shadow: 0 0 10px #ffB800; }
        .step-indicator.active span { color: #ffB800; }
        
        .step-indicator.confirmed .step-dot { background: #00ff88; border-color: #00ff88; box-shadow: 0 0 15px #00ff88; }
        .step-indicator.confirmed span { color: #00ff88; }

        .step-connector { flex-grow: 1; height: 2px; background: #222; margin: 0 10px; transform: translateY(-8px); }
        
        .macro-footer { display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem; }
        .macro-footer .stat { display: flex; flex-direction: column; }
        .macro-footer .lab { font-size: 0.5rem; color: #444; font-weight: 900; margin-bottom: 4px; }
        .macro-footer .val { font-size: 0.75rem; font-weight: 800; color: #eee; }
      `}} />
    </div>
  );
};
