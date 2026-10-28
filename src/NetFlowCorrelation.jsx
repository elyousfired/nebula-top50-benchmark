import React, { useState, useEffect, useRef } from 'react';

import { fetchTop200Symbols } from './logic/scanner';

// ============================================================
// NET FLOW CORRELATION ANALYSIS
// Weekly Net Flow from Oct 2024 → Now
// Computes Pearson correlation with BTC Net Flow
// ============================================================

const BYBIT_WEEKLY = 'W';
async function fetchWeeklyKlines(symbol, limit = 40) {
  const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=W&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.retCode !== 0) throw new Error(data.retMsg);
  return data.result.list.map(row => ({
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    turnover: Number(row[6])
  })).reverse(); // chronological
}

function computeNetFlow(klines) {
  return klines.map(k => {
    const pctChange = k.open > 0 ? (k.close - k.open) / k.open : 0;
    return { time: k.time, netFlow: k.turnover * pctChange };
  });
}

function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 4) return 0;
  const xs = x.slice(0, n), ys = y.slice(0, n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx2 += (xs[i] - mx) ** 2;
    dy2 += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

function getCorrelationLabel(r) {
  if (r >= 0.8) return { text: 'TRÈS CORRÉLÉ', color: '#00ff88' };
  if (r >= 0.5) return { text: 'CORRÉLÉ', color: '#7fff00' };
  if (r >= 0.2) return { text: 'FAIBLE +', color: '#facc15' };
  if (r >= -0.2) return { text: 'NEUTRE', color: '#888' };
  if (r >= -0.5) return { text: 'FAIBLE -', color: '#ff9500' };
  if (r >= -0.8) return { text: 'INVERSE', color: '#ff3b30' };
  return { text: 'TRÈS INVERSE', color: '#ff0040' };
}

// Mini sparkline SVG for weekly Net Flow
function NetFlowSparkline({ data, btcData, width = 120, height = 40 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.netFlow);
  const maxV = Math.max(...vals.map(Math.abs), 1);
  const midY = height / 2;
  const stepX = width / (vals.length - 1);

  const points = vals.map((v, i) => `${i * stepX},${midY - (v / maxV) * midY * 0.85}`).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* Zero line */}
      <line x1="0" y1={midY} x2={width} y2={midY} stroke="#333" strokeWidth="1" />
      {/* Net flow bars */}
      {vals.map((v, i) => (
        <rect
          key={i}
          x={i * stepX - 3}
          y={v >= 0 ? midY - (v / maxV) * midY * 0.85 : midY}
          width={6}
          height={Math.abs((v / maxV) * midY * 0.85)}
          fill={v >= 0 ? '#00ff88' : '#ff3b30'}
          opacity={0.7}
        />
      ))}
    </svg>
  );
}

export default function NetFlowCorrelation() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [btcWeeklyFlow, setBtcWeeklyFlow] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('correlation'); // 'correlation' | 'inverse' | 'name'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'correlated' | 'inverse' | 'neutral'

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setProgress(0);

    try {
      // 1. Fetch BTC weekly
      const btcKlines = await fetchWeeklyKlines('BTCUSDT', 40);
      // Filter from Oct 2024 → now
      const oct2024 = new Date('2024-10-01').getTime();
      const btcFiltered = btcKlines.filter(k => k.time >= oct2024);
      const btcFlow = computeNetFlow(btcFiltered);
      setBtcWeeklyFlow(btcFlow);
      const btcFlowVals = btcFlow.map(d => d.netFlow);

      setProgress(10);

      // 2. Fetch Top 100 dynamically
      const top200 = await fetchTop200Symbols();
      const top100 = top200.slice(0, 100).map(t => t.symbol);

      const tokenResults = [];
      for (let i = 0; i < top100.length; i++) {
        const symbol = top100[i];
        try {
          const klines = await fetchWeeklyKlines(symbol, 40);
          const filtered = klines.filter(k => k.time >= oct2024);
          const flow = computeNetFlow(filtered);

          // Align weeks with BTC (match timestamps)
          const btcTimeSet = new Set(btcFlow.map(d => d.time));
          const aligned = flow.filter(d => btcTimeSet.has(d.time));
          const btcAligned = btcFlow.filter(d => new Set(flow.map(f => f.time)).has(d.time));

          const flowVals = aligned.map(d => d.netFlow);
          const btcAlignedVals = btcAligned.map(d => d.netFlow);

          const corr = pearsonCorrelation(flowVals, btcAlignedVals);
          const totalFlow = flowVals.reduce((a, b) => a + b, 0);
          const avgWeeklyFlow = totalFlow / (flowVals.length || 1);
          const lastFlow = flowVals[flowVals.length - 1] || 0;

          tokenResults.push({
            symbol: symbol.replace('USDT', ''),
            correlation: corr,
            weeklyFlowData: aligned,
            totalFlow,
            avgWeeklyFlow,
            lastFlow,
            weeksAnalyzed: aligned.length,
          });
        } catch (e) {
          // skip on error
        }
        setProgress(10 + Math.floor((i / top100.length) * 90));
        // small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 150));
      }

      setResults(tokenResults);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  const sortedResults = [...results].filter(t => {
    if (filterMode === 'correlated') return t.correlation >= 0.5;
    if (filterMode === 'inverse') return t.correlation <= -0.3;
    if (filterMode === 'neutral') return t.correlation > -0.3 && t.correlation < 0.5;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'correlation') return b.correlation - a.correlation;
    if (sortBy === 'inverse') return a.correlation - b.correlation;
    if (sortBy === 'name') return a.symbol.localeCompare(b.symbol);
    return 0;
  });

  const formatFlow = (v) => {
    const abs = Math.abs(v);
    const sign = v >= 0 ? '+' : '-';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${abs.toFixed(0)}`;
  };

  return (
    <div style={{ padding: '24px', background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '2px' }}>
          📊 ANALYSE NET FLOW — CORRÉLATION BTC
        </h2>
        <p style={{ fontSize: '0.75rem', color: '#555', margin: '6px 0 0' }}>
          Net Flow hebdomadaire • Octobre 2024 → Maintenant • Pearson Correlation
        </p>
      </div>

      {/* Launch Button */}
      {results.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔬</div>
          <p style={{ color: '#555', marginBottom: '20px', fontSize: '0.85rem' }}>
            Analysez la corrélation du flux de capital entre le BTC et les 100 principaux altcoins<br/>
            depuis octobre 2024. Données hebdomadaires réelles (Bybit Klines).
          </p>
          <button
            onClick={runAnalysis}
            style={{
              padding: '14px 40px', fontSize: '0.9rem', fontWeight: 800,
              background: 'linear-gradient(135deg, #00ff88, #00cc66)',
              color: '#000', border: 'none', borderRadius: '12px',
              cursor: 'pointer', letterSpacing: '2px'
            }}
          >
            ▶ LANCER L'ANALYSE
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ marginBottom: '12px', color: '#888', fontSize: '0.85rem' }}>
            Téléchargement des données hebdomadaires Bybit...
          </div>
          <div style={{ width: '300px', height: '6px', background: '#222', borderRadius: '3px', margin: '0 auto', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #00ff88, #00cc66)', transition: 'width 0.3s', borderRadius: '3px' }} />
          </div>
          <div style={{ marginTop: '8px', color: '#444', fontSize: '0.7rem' }}>{progress}%</div>
        </div>
      )}

      {error && (
        <div style={{ color: '#ff3b30', padding: '20px', background: 'rgba(255,59,48,0.1)', borderRadius: '8px', marginBottom: '20px' }}>
          Erreur: {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'TOKENS', val: results.length, color: '#fff' },
              { label: 'TRÈS CORRÉLÉS (r≥0.8)', val: results.filter(t => t.correlation >= 0.8).length, color: '#00ff88' },
              { label: 'CORRÉLÉS (0.5≤r<0.8)', val: results.filter(t => t.correlation >= 0.5 && t.correlation < 0.8).length, color: '#7fff00' },
              { label: 'INVERSÉS (r≤-0.3)', val: results.filter(t => t.correlation <= -0.3).length, color: '#ff3b30' },
              { label: 'NEUTRES', val: results.filter(t => t.correlation > -0.3 && t.correlation < 0.5).length, color: '#888' },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', padding: '14px', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
                <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 700, letterSpacing: '1px' }}>{s.label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: s.color, marginTop: '4px' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Filter & Sort Controls */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 700 }}>FILTRE:</span>
            {[
              { id: 'all', label: 'Tous' },
              { id: 'correlated', label: '🟢 Corrélés (r≥0.5)' },
              { id: 'inverse', label: '🔴 Inversés (r≤-0.3)' },
              { id: 'neutral', label: '⬜ Neutres' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterMode(f.id)} style={{
                padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                background: filterMode === f.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: `1px solid ${filterMode === f.id ? '#fff' : '#333'}`,
                color: filterMode === f.id ? '#fff' : '#555', borderRadius: '6px'
              }}>{f.label}</button>
            ))}
            <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 700, marginLeft: '12px' }}>TRIER:</span>
            {[
              { id: 'correlation', label: '↓ Plus corrélés' },
              { id: 'inverse', label: '↓ Plus inversés' },
              { id: 'name', label: 'A→Z' },
            ].map(s => (
              <button key={s.id} onClick={() => setSortBy(s.id)} style={{
                padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                background: sortBy === s.id ? 'rgba(0,255,136,0.1)' : 'transparent',
                border: `1px solid ${sortBy === s.id ? '#00ff88' : '#333'}`,
                color: sortBy === s.id ? '#00ff88' : '#555', borderRadius: '6px'
              }}>{s.label}</button>
            ))}
            <button onClick={runAnalysis} style={{
              marginLeft: 'auto', padding: '6px 16px', fontSize: '0.7rem', fontWeight: 700,
              background: 'transparent', border: '1px solid #333', color: '#555',
              borderRadius: '6px', cursor: 'pointer'
            }}>↺ Relancer</button>
          </div>

          {/* Table */}
          <div style={{ background: '#0d0d0d', borderRadius: '12px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#111', borderBottom: '1px solid #222' }}>
                  <th style={th}>#</th>
                  <th style={th}>TOKEN</th>
                  <th style={th}>CORRÉLATION BTC</th>
                  <th style={th}>INTERPRÉTATION</th>
                  <th style={th}>NET FLOW HEBDO (VISUEL)</th>
                  <th style={th}>DERNIER FLUX</th>
                  <th style={th}>FLUX MOYEN/SEMAINE</th>
                  <th style={th}>SEMAINES</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((t, i) => {
                  const label = getCorrelationLabel(t.correlation);
                  const corrBarWidth = Math.abs(t.correlation) * 100;
                  const corrBarColor = t.correlation >= 0 ? '#00ff88' : '#ff3b30';
                  return (
                    <tr key={t.symbol} style={{ borderBottom: '1px solid #111', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#111'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={td}><span style={{ color: '#444', fontSize: '0.7rem' }}>#{i + 1}</span></td>
                      <td style={td}>
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>{t.symbol}</span>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 900, fontSize: '1rem', color: corrBarColor, minWidth: '52px' }}>
                            {t.correlation >= 0 ? '+' : ''}{t.correlation.toFixed(2)}
                          </span>
                          <div style={{ width: '80px', height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${corrBarWidth}%`, height: '100%', background: corrBarColor, borderRadius: '3px' }} />
                          </div>
                        </div>
                      </td>
                      <td style={td}>
                        <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 700,
                          background: `${label.color}18`, color: label.color, border: `1px solid ${label.color}44` }}>
                          {label.text}
                        </span>
                      </td>
                      <td style={td}>
                        <NetFlowSparkline data={t.weeklyFlowData} width={130} height={36} />
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: t.lastFlow >= 0 ? '#00ff88' : '#ff3b30' }}>
                          {formatFlow(t.lastFlow)}$
                        </span>
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: '0.75rem', color: t.avgWeeklyFlow >= 0 ? '#00e676' : '#ff6b6b' }}>
                          {formatFlow(t.avgWeeklyFlow)}$/sem
                        </span>
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: '0.7rem', color: '#555' }}>{t.weeksAnalyzed}w</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const th = {
  padding: '10px 14px', textAlign: 'left', fontSize: '0.6rem',
  color: '#555', fontWeight: 700, letterSpacing: '1px', whiteSpace: 'nowrap'
};
const td = { padding: '10px 14px', verticalAlign: 'middle' };
