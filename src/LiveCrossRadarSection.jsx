import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { Flame, Zap } from 'lucide-react';

const NEON_COLORS = [
  '#00ff88', '#00d2ff', '#facc15', '#a855f7', '#ec4899',
  '#f97316', '#06b6d4', '#84cc16', '#e11d48', '#3b82f6',
  '#10b981', '#6366f1', '#d946ef', '#f472b6', '#a3e635'
];

export const LiveCrossRadarSection = ({ tokensList = [], onSelectToken }) => {
  const [liveCrosses, setLiveCrosses] = useState([]);
  const [hoveredSymbol, setHoveredSymbol] = useState(null);

  // Snapshot of past cross symbols when app loads - ALL PAST CROSSES ARE EXCLUDED!
  const initialPastCrossesRef = useRef(null);

  useEffect(() => {
    if (!tokensList || tokensList.length === 0) return;

    // Capture initial scan state once: All tokens crossing in the PAST are registered as "past" and ignored!
    if (initialPastCrossesRef.current === null) {
      const pastSet = new Set();
      tokensList.forEach(t => {
        if (t.crosses?.hasAny) {
          pastSet.add(t.cleanSymbol);
        }
      });
      initialPastCrossesRef.current = pastSet;
      return; // Do NOT populate history table with past tokens!
    }

    // Process only NEW REAL-TIME CROSSES that occur after page load!
    tokensList.forEach(t => {
      if (t.crosses?.hasAny) {
        // If it was ALREADY crossing in the past before page load, ignore it!
        if (initialPastCrossesRef.current.has(t.cleanSymbol)) return;

        setLiveCrosses(prev => {
          const alreadyIn = prev.some(item => item.cleanSymbol === t.cleanSymbol);
          if (alreadyIn) {
            return prev.map(item => {
              if (item.cleanSymbol === t.cleanSymbol) {
                const gain = ((t.price - item.priceAtCross) / item.priceAtCross) * 100;
                return { ...item, currentPrice: t.price, postCrossGain: gain };
              }
              return item;
            });
          }

          const crossType = t.crosses.isTriple ? '💥 TRIPLE CROSS' : t.crosses.m15 ? '🚀 15M CROSS' : t.crosses.h1 ? '🔥 1H CROSS' : '⚡ 4H CROSS';

          const newItem = {
            id: `${t.cleanSymbol}-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            cleanSymbol: t.cleanSymbol,
            priceAtCross: t.price,
            currentPrice: t.price,
            postCrossGain: 0,
            crossType,
            m15: t.crosses.m15,
            h1: t.crosses.h1,
            h4: t.crosses.h4,
          };

          return [newItem, ...prev].slice(0, 30);
        });
      }
    });
  }, [tokensList]);

  const crossTokens15m = useMemo(() => liveCrosses.filter(t => t.m15), [liveCrosses]);
  const crossTokens1h  = useMemo(() => liveCrosses.filter(t => t.h1),  [liveCrosses]);
  const crossTokens4h  = useMemo(() => liveCrosses.filter(t => t.h4),  [liveCrosses]);

  return (
    <div style={{
      background: 'rgba(8,14,24,0.95)',
      border: '2px solid rgba(0,255,136,0.4)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 0 30px rgba(0,255,136,0.15)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* HEADER TITLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Flame size={24} color="#00ff88" />
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: '900' }}>
            🎯 RADARS DES CROISEMENTS DÉTECTÉS EN DIRECT (DEPUIS CET INSTANT)
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: '#00ff88', fontSize: '0.78rem', fontWeight: 'bold', background: 'rgba(0,255,136,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid #00ff88' }}>
            🚀 15M: {crossTokens15m.length} live
          </span>
          <span style={{ color: '#facc15', fontSize: '0.78rem', fontWeight: 'bold', background: 'rgba(250,204,21,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid #facc15' }}>
            🔥 1H: {crossTokens1h.length} live
          </span>
          <span style={{ color: '#a855f7', fontSize: '0.78rem', fontWeight: 'bold', background: 'rgba(168,85,247,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid #a855f7' }}>
            ⚡ 4H: {crossTokens4h.length} live
          </span>
        </div>
      </div>

      {/* ── LES 3 FENÊTRES DE CHARTE CÔTE-À-CÔTE (15m | 1h | 4h) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
        {/* FENÊTRE 1: 15 MIN RADAR */}
        <SingleTimeframeCrossRadar
          title="⚡ CHARTE 15 MIN : CROISEMENTS LIVE 15M"
          borderColor="#00ff88"
          titleColor="#00ff88"
          depth={96}
          crossTokens={crossTokens15m}
          allTokensList={tokensList}
          hoveredSymbol={hoveredSymbol}
          onHoverSymbol={setHoveredSymbol}
          onSelectToken={onSelectToken}
        />

        {/* FENÊTRE 2: 1 HEURE RADAR */}
        <SingleTimeframeCrossRadar
          title="🔥 CHARTE 1 HEURE (1H) : CROISEMENTS LIVE 1H"
          borderColor="#facc15"
          titleColor="#facc15"
          depth={48}
          crossTokens={crossTokens1h}
          allTokensList={tokensList}
          hoveredSymbol={hoveredSymbol}
          onHoverSymbol={setHoveredSymbol}
          onSelectToken={onSelectToken}
        />

        {/* FENÊTRE 3: 4 HEURES RADAR */}
        <SingleTimeframeCrossRadar
          title="⚡ CHARTE 4 HEURES (4H) : CROISEMENTS LIVE 4H (~3 MOIS)"
          borderColor="#a855f7"
          titleColor="#a855f7"
          depth={30}
          crossTokens={crossTokens4h}
          allTokensList={tokensList}
          hoveredSymbol={hoveredSymbol}
          onHoverSymbol={setHoveredSymbol}
          onSelectToken={onSelectToken}
        />
      </div>

      {/* ── PETIT TABLEAU HISTORIQUE DES NOUVEAUX CROISEMENTS LIVE ── */}
      <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px' }}>
        <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: '900', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={16} color="#facc15" /> PETIT TABLEAU DE SUIVI : NOUVEAUX CROISEMENTS ENREGISTRÉS EN DIRECT ({liveCrosses.length})
        </div>

        <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
          {liveCrosses.length === 0 ? (
            <div style={{ color: '#888', fontSize: '0.82rem', textAlign: 'center', padding: '25px', fontWeight: 'bold' }}>
              ⏳ Les anciens croisements passés ont été ignorés. En attente du premier nouveau croisement en direct sous vos yeux...
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', fontSize: '0.75rem' }}>
                  <th style={{ padding: '8px' }}>HORODATAGE</th>
                  <th style={{ padding: '8px' }}>TOKEN</th>
                  <th style={{ padding: '8px' }}>SIGNAL CROISEMENT</th>
                  <th style={{ padding: '8px' }}>PRIX ENTRÉE</th>
                  <th style={{ padding: '8px' }}>PRIX ACTUEL</th>
                  <th style={{ padding: '8px' }}>GAIN DEPUIS CROISEMENT</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {liveCrosses.map(item => {
                  const isHovered = hoveredSymbol === item.cleanSymbol;
                  const isPositive = item.postCrossGain >= 0;
                  return (
                    <tr
                      key={item.id}
                      onMouseEnter={() => setHoveredSymbol(item.cleanSymbol)}
                      onMouseLeave={() => setHoveredSymbol(null)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isHovered ? 'rgba(0,255,136,0.15)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '8px', color: '#888', fontWeight: 'bold' }}>{item.timestamp}</td>
                      <td style={{ padding: '8px', fontWeight: '900', color: '#fff' }}>{item.cleanSymbol} / USDT</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          background: item.crossType.includes('TRIPLE') ? 'linear-gradient(90deg, #facc15, #00ff88)' : item.crossType.includes('15M') ? 'rgba(0,255,136,0.2)' : item.crossType.includes('1H') ? 'rgba(250,204,21,0.2)' : 'rgba(168,85,247,0.2)',
                          color: item.crossType.includes('TRIPLE') ? '#000' : item.crossType.includes('15M') ? '#00ff88' : item.crossType.includes('1H') ? '#facc15' : '#a855f7',
                          padding: '2px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '0.72rem',
                        }}>
                          {item.crossType}
                        </span>
                      </td>
                      <td style={{ padding: '8px', color: '#ccc' }}>${item.priceAtCross < 0.01 ? item.priceAtCross.toFixed(6) : item.priceAtCross.toFixed(4)}</td>
                      <td style={{ padding: '8px', color: '#00d2ff', fontWeight: 'bold' }}>${item.currentPrice < 0.01 ? item.currentPrice.toFixed(6) : item.currentPrice.toFixed(4)}</td>
                      <td style={{ padding: '8px', fontWeight: '900', color: isPositive ? '#00ff88' : '#ff3366' }}>
                        {isPositive ? '+' : ''}{item.postCrossGain.toFixed(2)}%
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <button
                          onClick={() => onSelectToken && onSelectToken(item.cleanSymbol)}
                          style={{
                            background: 'rgba(0,255,136,0.15)',
                            color: '#00ff88',
                            border: '1px solid #00ff88',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontWeight: '900',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                          }}
                        >
                          📈 OUVRIR CHARTE
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ── COMPOSANT INDIVIDUEL RADAR CÔTE-À-CÔTE ULTRARAPIDE ET VÉRIFIÉ ──
const SingleTimeframeCrossRadar = ({
  title,
  borderColor,
  titleColor,
  tfInterval, // '15', '60', '240'
  crossTokens,
  allTokensList,
  hoveredSymbol,
  onHoverSymbol,
  onSelectToken,
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadRadarData = async () => {
      if (!crossTokens || crossTokens.length === 0) {
        setIsLoading(false);
        if (chartRef.current) {
          try { chartRef.current.remove(); } catch (_) {}
          chartRef.current = null;
        }
        return;
      }
      setIsLoading(true);

      try {
        // Fetch SOL klines for this exact timeframe from Bybit API
        const solRes = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=SOLUSDT&interval=${tfInterval}&limit=200`);
        if (!solRes.ok) return;
        const solJson = await solRes.json();
        const listSol = (solJson.result?.list || []).slice().reverse();
        if (listSol.length === 0) return;

        const solMap = {};
        listSol.forEach(k => { solMap[parseInt(k[0])] = parseFloat(k[4]); });

        // Fetch cross tokens klines for this timeframe
        const targetTokens = crossTokens.slice(0, 8);
        const fetchedResults = await Promise.all(
          targetTokens.map(async (tok) => {
            try {
              const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${tok.cleanSymbol}USDT&interval=${tfInterval}&limit=200`);
              if (!res.ok) return null;
              const json = await res.json();
              const list = (json.result?.list || []).slice().reverse();
              if (!list.length) return null;

              const series = [];
              list.forEach(k => {
                const ts = parseInt(k[0]);
                const solPrice = solMap[ts];
                const tokPrice = parseFloat(k[4]);
                if (solPrice && solPrice > 0) {
                  series.push({ time: Math.floor(ts / 1000), ratio: tokPrice / solPrice });
                }
              });

              if (series.length < 5) return null;
              const startRatio = series[0].ratio;
              const deltas = series.map(s => ({
                time: s.time,
                delta: parseFloat((((s.ratio - startRatio) / startRatio) * 100).toFixed(2)),
              }));

              return { symbol: tok.cleanSymbol, deltas };
            } catch (_) {
              return null;
            }
          })
        );

        if (isCancelled) return;

        const validResults = (fetchedResults || []).filter(Boolean);
        if (validResults.length === 0) {
          setIsLoading(false);
          return;
        }

        const masterTimePoints = validResults[0].deltas.map(d => d.time);
        const groupCurve = masterTimePoints.map((t, idx) => {
          let sum = 0, count = 0;
          validResults.forEach(r => {
            if (r.deltas[idx] !== undefined) {
              sum += r.deltas[idx].delta;
              count++;
            }
          });
          return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
        });

        if (chartRef.current) {
          try { chartRef.current.remove(); } catch (_) {}
          chartRef.current = null;
        }
        seriesMapRef.current = {};

        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth || 360,
          height: 320,
          layout: { background: { color: 'rgba(5,10,15,0.98)' }, textColor: '#b2b5be' },
          grid: { vertLines: { color: 'rgba(42, 46, 57, 0.15)' }, horzLines: { color: 'rgba(42, 46, 57, 0.15)' } },
          rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0.4)', scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { borderColor: 'rgba(42, 46, 57, 0.4)', timeVisible: true, rightOffset: 12 },
        });

        // Red Group Line
        const groupSeries = chart.addLineSeries({
          color: '#ff3366',
          lineWidth: 2,
          title: 'LIGNE DU GROUPE',
        });
        groupSeries.setData(masterTimePoints.map((t, idx) => ({ time: t, value: groupCurve[idx] })));

        // Plot tokens that are REALLY above group line and crossed
        validResults.forEach((res, index) => {
          const curTok = res.deltas[res.deltas.length - 1]?.delta || 0;
          const curGrp = groupCurve[groupCurve.length - 1] || 0;

          // Reject false positives where current token is below group line (like MUB at -6.88% vs 38.83%)
          if (curTok <= curGrp) return;

          const baseColor = NEON_COLORS[index % NEON_COLORS.length];
          const lineSeries = chart.addLineSeries({
            color: baseColor,
            lineWidth: 2.5,
            title: `${res.symbol}`,
          });

          lineSeries.setData(res.deltas.map(d => ({
            time: d.time,
            value: parseFloat((d.delta || 0).toFixed(2)),
          })));

          // Find exact candle index where token crossed FROM BELOW TO ABOVE the group line
          let crossIdx = -1;
          for (let i = 1; i < res.deltas.length; i++) {
            const prevTok = res.deltas[i-1].delta;
            const prevGrp = groupCurve[i-1];
            const curT    = res.deltas[i].delta;
            const curG    = groupCurve[i];
            if (prevTok <= prevGrp && curT > curG) {
              crossIdx = i;
            }
          }

          if (crossIdx !== -1 && masterTimePoints[crossIdx]) {
            lineSeries.setMarkers([
              {
                time: masterTimePoints[crossIdx],
                position: 'aboveBar',
                color: baseColor,
                shape: 'circle',
                text: `🎯 CROSSE (${res.symbol})`,
              }
            ]);
          }

          seriesMapRef.current[res.symbol] = { series: lineSeries, baseColor };
        });

        chart.timeScale().fitContent();
        chartRef.current = chart;
      } catch (_) {
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadRadarData();
    return () => { isCancelled = true; };
  }, [crossTokens, tfInterval]);

  useEffect(() => {
    Object.entries(seriesMapRef.current).forEach(([sym, { series, baseColor }]) => {
      if (!series) return;
      if (!hoveredSymbol) {
        series.applyOptions({ color: baseColor, lineWidth: 2.5 });
      } else if (sym === hoveredSymbol) {
        series.applyOptions({ color: baseColor, lineWidth: 4.5 });
      } else {
        series.applyOptions({ color: 'rgba(255,255,255,0.06)', lineWidth: 1 });
      }
    });
  }, [hoveredSymbol]);

  return (
    <div style={{ background: 'rgba(10,15,25,0.9)', border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '12px' }}>
      <div style={{ color: titleColor, fontWeight: '900', fontSize: '0.85rem', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{title}</span>
        <span style={{ color: '#fff', fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
          {crossTokens.length} Cross(es) Live
        </span>
      </div>

      {/* Cross Token Chips */}
      {crossTokens.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          {crossTokens.slice(0, 10).map((t, idx) => {
            const isHovered = hoveredSymbol === t.cleanSymbol;
            const chipColor = NEON_COLORS[idx % NEON_COLORS.length];
            return (
              <button
                key={t.cleanSymbol}
                onMouseEnter={() => onHoverSymbol(t.cleanSymbol)}
                onMouseLeave={() => onHoverSymbol(null)}
                onClick={() => onSelectToken && onSelectToken(t.cleanSymbol)}
                style={{
                  background: isHovered ? chipColor : 'rgba(255,255,255,0.06)',
                  color: isHovered ? '#000' : '#ccc',
                  border: `1px solid ${isHovered ? chipColor : 'rgba(255,255,255,0.15)'}`,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                🎯 {t.cleanSymbol}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '8px', fontStyle: 'italic', padding: '6px 0' }}>
          En attente d'un nouveau croisement live sur cette tranche...
        </div>
      )}

      {/* Chart Canvas Container ALWAYS VISIBLE IN DOM */}
      <div style={{ width: '100%', height: '320px', borderRadius: '8px', overflow: 'hidden' }}>
        <div ref={chartContainerRef} style={{ width: '100%', height: '320px' }} />
      </div>
    </div>
  );
};

export default LiveCrossRadarSection;
