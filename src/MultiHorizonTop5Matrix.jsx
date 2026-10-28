import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { Download, TrendingUp, TrendingDown, Minus, Crown, Zap, Calendar, Globe, Sparkles, LineChart, Maximize2, Minimize2, RefreshCw, MoveVertical, Activity, ArrowLeft, Trophy } from 'lucide-react';

const getTokenFixedColor = (symbol) => {
  if (!symbol) return '#00ff88';
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#00ff88', '#00d2ff', '#ff0055', '#ffd700', '#ff00ff',
    '#7928ca', '#ff4d4d', '#00f0ff', '#ffaa00', '#00e5ff',
    '#a3e635', '#f43f5e', '#38bdf8', '#fbbf24', '#c084fc'
  ];
  return colors[Math.abs(hash) % colors.length];
};

// 📈 COMPOSANT : GRAPHIQUE 24H DÉDIÉ (COURBES MULTI-TOKENS AVEC FILTRE NOUVEAUX ENTRANTS FRAIS & BOUGIES)
const MomentumIntelligenceChart = ({ tokensList = [], activeTokens = [], selectedTokenSym = null, onSelectToken, top5VisitorsAnalysis = null }) => {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesMapRef = useRef({});
  const candleSeriesRef = useRef(null);
  const hasInitializedRangeRef = useRef(false);

  const [isolatedSymbol, setIsolatedSymbol] = useState(selectedTokenSym || null);
  const [viewMode, setViewMode] = useState(selectedTokenSym ? 'candles' : 'curves');
  const [chartFilterMode, setChartFilterMode] = useState('sniper_fresh'); // 'sniper_fresh' | 'all'
  const [chartHeight, setChartHeight] = useState(420);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (selectedTokenSym) {
      setIsolatedSymbol(selectedTokenSym);
      setViewMode('candles');
    }
  }, [selectedTokenSym]);

  // 🎯 CALCUL DES VRAIS NOUVEAUX TOKENS FRAIS (STRICTEMENT ACCÉLÉRATION ACTIVE > 0)
  const freshSniperTokens = useMemo(() => {
    if (!top5VisitorsAnalysis?.visitors || top5VisitorsAnalysis.visitors.length === 0) return [];
    
    // Filtrer STRICTEMENT les jetons récents (< 3.5h), score sain <= 12, score actuel <= 30, et avec une impulsion active confirmée
    const candidates = top5VisitorsAnalysis.visitors.filter(v => {
      return v.hoursInTop5 <= 3.5 && v.entryScore <= 12 && v.currentScore <= 30 && v.currentScore >= -2 && v.impulseAfterEntry >= 2.0;
    });

    candidates.sort((a, b) => b.impulseAfterEntry - a.impulseAfterEntry);
    return candidates.slice(0, 5);
  }, [top5VisitorsAnalysis]);

    const tokensToDisplay = useMemo(() => {
    if (!tokensList || tokensList.length === 0) return [];
    
    if (chartFilterMode === 'sniper_fresh' && freshSniperTokens.length > 0) {
      const freshSymbols = new Set(freshSniperTokens.map(t => t.sym));
      return tokensList.filter(t => freshSymbols.has(t.cleanSymbol));
    }

    const activeSymbols = new Set(activeTokens.map(t => t.sym));
    return tokensList.filter(t => activeSymbols.has(t.cleanSymbol));
  }, [tokensList, activeTokens, chartFilterMode, freshSniperTokens]);

  // 1. Initialiser le Graphique Principal (Courbes ou Bougies)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: isFullscreen ? (window.innerHeight - 130) : chartHeight,
      layout: {
        background: { color: '#060a12' },
        textColor: '#94a3b8',
        fontSize: 11
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#38bdf8', width: 1, style: 2 },
        horzLine: { color: '#38bdf8', width: 1, style: 2 }
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
    });

    chartInstanceRef.current = chart;

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || !entries[0]) return;
      const { width } = entries[0].contentRect;
      if (chartInstanceRef.current) chartInstanceRef.current.applyOptions({ width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        seriesMapRef.current = {};
        candleSeriesRef.current = null;
      }
    };
  }, [viewMode, isFullscreen]);

  // 2. Mettre à jour les données
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    if (viewMode === 'candles' && isolatedSymbol) {
      const tokenObj = tokensList.find(t => t.cleanSymbol === isolatedSymbol);
      const rSeries = tokenObj?.ratioSeries || [];

      if (rSeries.length > 0) {
        if (!candleSeriesRef.current) {
          candleSeriesRef.current = chart.addCandlestickSeries({
            upColor: '#00ff88',
            downColor: '#ff0055',
            borderUpColor: '#00ff88',
            borderDownColor: '#ff0055',
            wickUpColor: '#00ff88',
            wickDownColor: '#ff0055',
            title: '🕯️ ' + isolatedSymbol + '/USDT'
          });
        }

        const candleData = [];
        rSeries.forEach((c) => {
          if (typeof c === 'object') {
            const tSec = c.time ? (typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000)) : Math.floor(c.timeMs / 1000);
            if (!tSec) return;
            candleData.push({
              time: tSec,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close
            });
          }
        });

        candleData.sort((a, b) => a.time - b.time);
        candleSeriesRef.current.setData(candleData);

        if (!hasInitializedRangeRef.current && candleData.length > 0) {
          chart.timeScale().fitContent();
          hasInitializedRangeRef.current = true;
        }
      }
    } else {
      const currentSeriesMap = seriesMapRef.current;
      const activeSymSet = new Set(tokensToDisplay.map(t => t.cleanSymbol));

      const timeMap = {};
      tokensList.forEach(t => {
        const rSeries = t.ratioSeries || [];
        if (rSeries.length < 10) return;
        const startIdx = Math.max(0, rSeries.length - 96);
        const slice = rSeries.slice(startIdx);
        const baseVal = typeof slice[0] === 'object' ? (slice[0].open || slice[0].close) : slice[0];
        if (!baseVal || baseVal <= 0) return;

        slice.forEach(candle => {
          let tSec = 0;
          let val = 0;
          if (typeof candle === 'object') {
            tSec = candle.time ? (typeof candle.time === 'number' ? candle.time : Math.floor(new Date(candle.time).getTime() / 1000)) : Math.floor(candle.timeMs / 1000);
            val = candle.close;
          } else {
            val = candle;
          }
          if (!tSec) return;
          const normVal = ((val - baseVal) / baseVal) * 100;
          if (!timeMap[tSec]) timeMap[tSec] = { sum: 0, count: 0 };
          timeMap[tSec].sum += normVal;
          timeMap[tSec].count += 1;
        });
      });

      const groupData = Object.entries(timeMap)
        .map(([tSec, obj]) => ({ time: parseInt(tSec), value: parseFloat((obj.sum / obj.count).toFixed(2)) }))
        .sort((a, b) => a.time - b.time);

      if (groupData.length > 0) {
        if (!currentSeriesMap['__GROUP__']) {
          currentSeriesMap['__GROUP__'] = chart.addLineSeries({
            color: '#ffffff',
            lineWidth: 2,
            lineStyle: 2,
            title: '⚪ RÉF. MARCHÉ',
            priceFormat: { type: 'custom', minMove: 0.1, formatter: (p) => (p >= 0 ? '+' : '') + p.toFixed(1) + ' pts' }
          });
        }
        currentSeriesMap['__GROUP__'].setData(groupData);
      }

      Object.keys(currentSeriesMap).forEach(sym => {
        if (sym !== '__GROUP__' && !activeSymSet.has(sym)) {
          chart.removeSeries(currentSeriesMap[sym]);
          delete currentSeriesMap[sym];
        }
      });

      tokensToDisplay.forEach(tok => {
        const sym = tok.cleanSymbol;
        const rSeries = tok.ratioSeries || [];
        if (rSeries.length < 10) return;

        const startIdx = Math.max(0, rSeries.length - 96);
        const slice = rSeries.slice(startIdx);
        const baseVal = typeof slice[0] === 'object' ? (slice[0].open || slice[0].close) : slice[0];
        if (!baseVal || baseVal <= 0) return;

        const curveData = [];
        const seenTimes = new Set();

        slice.forEach(candle => {
          let tSec = 0;
          let val = 0;
          if (typeof candle === 'object') {
            tSec = candle.time ? (typeof candle.time === 'number' ? candle.time : Math.floor(new Date(candle.time).getTime() / 1000)) : Math.floor(candle.timeMs / 1000);
            val = candle.close;
          } else {
            val = candle;
          }
          if (!tSec || seenTimes.has(tSec)) return;
          seenTimes.add(tSec);
          const normVal = ((val - baseVal) / baseVal) * 100;
          curveData.push({ time: tSec, value: parseFloat(normVal.toFixed(2)) });
        });

        curveData.sort((a, b) => a.time - b.time);

        if (curveData.length > 0) {
          const isAlpha = activeTokens.find(t => t.sym === sym && t.type === 'alpha');
          const defaultColor = isAlpha ? '#10b981' : getTokenFixedColor(sym);

          if (!currentSeriesMap[sym]) {
            currentSeriesMap[sym] = chart.addLineSeries({
              color: defaultColor,
              lineWidth: isAlpha ? 3 : 2,
              title: sym,
              priceFormat: { type: 'custom', minMove: 0.1, formatter: (p) => (p >= 0 ? '+' : '') + p.toFixed(1) + ' pts' }
            });
          }
          currentSeriesMap[sym].setData(curveData);
        }
      });

      if (!hasInitializedRangeRef.current && groupData.length > 0) {
        chart.timeScale().fitContent();
        hasInitializedRangeRef.current = true;
      }
    }
  }, [tokensToDisplay, activeTokens, viewMode, isolatedSymbol]);

  const handleSelectTokenView = (sym) => {
    setIsolatedSymbol(sym);
    setViewMode('candles');
    if (onSelectToken) onSelectToken(sym);
  };

  const handleReturnToCurves = () => {
    setViewMode('curves');
    setIsolatedSymbol(null);
  };

  const handleResetZoom = () => {
    if (chartInstanceRef.current) chartInstanceRef.current.timeScale().fitContent();
  };

  const chartBlockContent = (
    <div style={{
      background: 'rgba(3, 7, 18, 0.98)',
      borderRadius: isFullscreen ? '0px' : '10px',
      border: isFullscreen ? 'none' : '1px solid rgba(56, 189, 248, 0.3)',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
      height: isFullscreen ? '100vh' : 'auto',
      boxSizing: 'border-box'
    }}>
      {/* Chart Control Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {viewMode === 'candles' ? (
            <button
              onClick={handleReturnToCurves}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                padding: '3px 8px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.70rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <ArrowLeft size={13} />
              <span>RETOURNER AUX COURBES</span>
            </button>
          ) : (
            <LineChart size={16} color="#38bdf8" />
          )}

          <span style={{ color: '#ffffff', fontWeight: '900', fontSize: '0.82rem' }}>
            {viewMode === 'candles'
              ? '🕯️ BOUGIES JAPONAISES (15m) · ' + isolatedSymbol + '/USDT'
              : (chartFilterMode === 'sniper_fresh'
                  ? '🎯 COURBES DES NOUVEAUX ENTRANTS FRAIS (< 3.5H) · VRAIES OPPORTUNITÉS DE DÉCOLLAGE'
                  : '📈 COURBES MOMENTUM 24H (TOUS LES LEADERS INCLUS ANCIENS ROIS)')
            }
          </span>
        </div>

        {/* Action & Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {viewMode === 'curves' && (
            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '5px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                onClick={() => setChartFilterMode('sniper_fresh')}
                style={{
                  background: chartFilterMode === 'sniper_fresh' ? '#00ff88' : 'transparent',
                  color: chartFilterMode === 'sniper_fresh' ? '#000000' : '#94a3b8',
                  border: 'none',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.66rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: chartFilterMode === 'sniper_fresh' ? '0 0 8px rgba(0, 255, 136, 0.4)' : 'none'
                }}
                title="Afficher uniquement les tokens entrés récemment dans le Top 5 (moins de 3h, score modéré, pas déjà partis comme AGI)"
              >
                <span>🎯 NOUVEAUX TOKENS FRAIS ({freshSniperTokens.length})</span>
              </button>

              <button
                onClick={() => setChartFilterMode('all')}
                style={{
                  background: chartFilterMode === 'all' ? '#38bdf8' : 'transparent',
                  color: chartFilterMode === 'all' ? '#000000' : '#94a3b8',
                  border: 'none',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.66rem',
                  fontWeight: '900',
                  cursor: 'pointer'
                }}
                title="Afficher tous les tokens leaders du moment (y compris ceux déjà partis il y a 20h)"
              >
                <span>🌐 TOUS LES LEADERS</span>
              </button>
            </div>
          )}

          <button
            onClick={handleResetZoom}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.66rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={11} />
            <span>RESET ZOOM</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              background: isFullscreen ? '#facc15' : 'rgba(56, 189, 248, 0.15)',
              border: '1px solid ' + (isFullscreen ? '#facc15' : '#38bdf8'),
              color: isFullscreen ? '#000000' : '#38bdf8',
              padding: '3px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? 'QUITTER' : '⛶ PLEIN ÉCRAN'}</span>
          </button>
        </div>
      </div>

      {/* Token Selection Badges Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: '800' }}>
          {chartFilterMode === 'sniper_fresh' ? '🎯 CANDIDATS FRAIS :' : 'SÉLECTIONNER :'}
        </span>
        {tokensToDisplay.map(tok => {
          const sym = tok.cleanSymbol;
          const isSelected = isolatedSymbol === sym && viewMode === 'candles';
          const isAlpha = activeTokens.find(t => t.sym === sym && t.type === 'alpha');
          const baseColor = isAlpha ? '#10b981' : getTokenFixedColor(sym);
          const visitorObj = top5VisitorsAnalysis?.visitors?.find(v => v.sym === sym);

          return (
            <button
              key={sym}
              onClick={() => handleSelectTokenView(sym)}
              style={{
                background: isSelected ? baseColor : 'rgba(255, 255, 255, 0.04)',
                border: '1px solid ' + (isSelected ? baseColor : 'rgba(255, 255, 255, 0.12)'),
                color: isSelected ? '#000000' : '#ffffff',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.70rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              title={'Afficher les bougies de ' + sym + (visitorObj ? ' (Entré à ' + visitorObj.firstEntryTimeFormatted + ')' : '')}
            >
              <span>{chartFilterMode === 'sniper_fresh' ? '🎯' : (isAlpha ? '👑' : '🚀')} {sym}</span>
              <span style={{ fontSize: '0.62rem', opacity: isSelected ? 0.9 : 0.7 }}>
                {tok.score ? '+' + tok.score.toFixed(1) + ' pts' : (tok.points24h ? '+' + tok.points24h + ' pts' : '')}
              </span>
              {visitorObj && (
                <span style={{ fontSize: '0.58rem', color: isSelected ? '#000000' : '#38bdf8', opacity: 0.85 }}>
                  ({visitorObj.hoursInTop5}h)
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Candlestick / Curves Chart DOM */}
      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 130px)' : (chartHeight + 'px'),
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}
      />
    </div>
  );

  if (isFullscreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: 'rgba(2, 6, 15, 0.98)',
        backdropFilter: 'blur(10px)',
        padding: '12px'
      }}>
        {chartBlockContent}
      </div>
    );
  }

  return chartBlockContent;
};

export const MultiHorizonTop5Matrix = ({ tokensList = [], onSelectToken }) => {
  const [macroData30d, setMacroData30d] = useState({});
  const [loading30d, setLoading30d] = useState(false);
  const [selectedTokenForView, setSelectedTokenForView] = useState(null);

  useEffect(() => {
    if (!tokensList || tokensList.length === 0) return;

    let isMounted = true;
    const fetch30dMacro = async () => {
      try {
        setLoading30d(true);
        const candidates = tokensList.slice(0, 60);
        const results = {};

        const batchSize = 15;
        for (let i = 0; i < candidates.length; i += batchSize) {
          if (!isMounted) break;
          const batch = candidates.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (tok) => {
              try {
                const sym = tok.cleanSymbol + 'USDT';
                const res = await fetch('https://api.bybit.com/v5/market/kline?category=linear&symbol=' + sym + '&interval=D&limit=31');
                if (res.ok) {
                  const json = await res.json();
                  const list = json?.result?.list || [];
                  if (list.length >= 2) {
                    const curPrice = parseFloat(list[0][4]);
                    const d30Price = parseFloat(list[list.length - 1][4]);
                    const d7Price = parseFloat(list[Math.min(7, list.length - 1)][4]);
                    const d1Price = parseFloat(list[Math.min(1, list.length - 1)][4]);

                    const p30d = ((curPrice - d30Price) / d30Price) * 100;
                    const p7d = ((curPrice - d7Price) / d7Price) * 100;
                    const p1d = ((curPrice - d1Price) / d1Price) * 100;

                    const prev30to7Change = ((d7Price - d30Price) / d30Price) * 100;
                    const trend30d = p7d > (prev30to7Change / 3) ? 'up' : (p7d < 0 ? 'down' : 'flat');

                    results[tok.cleanSymbol] = {
                      p30d: parseFloat(p30d.toFixed(1)),
                      p7d: parseFloat(p7d.toFixed(1)),
                      p1d: parseFloat(p1d.toFixed(1)),
                      trend30d
                    };
                  }
                }
              } catch (_) {}
            })
          );
        }

        if (isMounted) {
          setMacroData30d(results);
        }
      } catch (err) {
        console.warn('Macro 30d fetch error:', err);
      } finally {
        if (isMounted) setLoading30d(false);
      }
    };

    fetch30dMacro();

    return () => {
      isMounted = false;
    };
  }, [tokensList]);

  // Map of all tokens stats
  const tokenStatsMap = useMemo(() => {
    const map = {};
    tokensList.forEach(t => {
      const sym = t.cleanSymbol;
      const rSeries = t.ratioSeries || [];

      let points24h = t.score || 0;
      let trend24h = 'flat';
      if (rSeries.length >= 10) {
        const startIdx = Math.max(0, rSeries.length - 96);
        const startVal = typeof rSeries[startIdx] === 'object' ? (rSeries[startIdx].open || rSeries[startIdx].close) : rSeries[startIdx];
        const lastVal = typeof rSeries[rSeries.length - 1] === 'object' ? rSeries[rSeries.length - 1].close : rSeries[rSeries.length - 1];
        if (startVal > 0) {
          points24h = ((lastVal - startVal) / startVal) * 100;
        }

        const idx4h = Math.max(0, rSeries.length - 16);
        const val4h = typeof rSeries[idx4h] === 'object' ? rSeries[idx4h].close : rSeries[idx4h];
        const diff4h = ((lastVal - val4h) / val4h) * 100;
        if (diff4h > 0.5) trend24h = 'up';
        else if (diff4h < -0.5) trend24h = 'down';
        else trend24h = 'flat';
      }

      let points7d = 0;
      let trend7d = 'flat';
      if (rSeries.length >= 96) {
        const startIdx7 = Math.max(0, rSeries.length - 672);
        const startVal7 = typeof rSeries[startIdx7] === 'object' ? (rSeries[startIdx7].open || rSeries[startIdx7].close) : rSeries[startIdx7];
        const lastVal7 = typeof rSeries[rSeries.length - 1] === 'object' ? rSeries[rSeries.length - 1].close : rSeries[rSeries.length - 1];
        if (startVal7 > 0) {
          points7d = ((lastVal7 - startVal7) / startVal7) * 100;
        }

        const idx24h = Math.max(0, rSeries.length - 96);
        const val24h = typeof rSeries[idx24h] === 'object' ? rSeries[idx24h].close : rSeries[idx24h];
        const diff24h = ((lastVal7 - val24h) / val24h) * 100;
        if (diff24h > 1.2) trend7d = 'up';
        else if (diff24h < -1.2) trend7d = 'down';
        else trend7d = 'flat';
      } else if (macroData30d[sym]) {
        points7d = macroData30d[sym].p7d;
        trend7d = macroData30d[sym].p1d > 0 ? 'up' : 'down';
      }

      let points30d = macroData30d[sym]?.p30d !== undefined ? macroData30d[sym].p30d : parseFloat((points7d * 1.8).toFixed(1));
      let trend30d = macroData30d[sym]?.trend30d || (points7d > 0 ? 'up' : 'down');

      map[sym] = {
        points24h: parseFloat((t.score || points24h).toFixed(1)),
        trend24h,
        points7d: parseFloat(points7d.toFixed(1)),
        trend7d,
        points30d: parseFloat(points30d.toFixed(1)),
        trend30d
      };
    });
    return map;
  }, [tokensList, macroData30d]);

  // 2. Compute Top 10 for 24H
  const top10_24h = useMemo(() => {
    return [...tokensList].map(t => ({
      cleanSymbol: t.cleanSymbol,
      stats: tokenStatsMap[t.cleanSymbol] || { points24h: t.score || 0, points7d: 0, points30d: 0, trend24h: 'flat' }
    })).sort((a, b) => b.stats.points24h - a.stats.points24h).slice(0, 10);
  }, [tokensList, tokenStatsMap]);

  // 3. Compute Top 10 for 7 Days
  const top10_7d = useMemo(() => {
    return [...tokensList].map(t => ({
      cleanSymbol: t.cleanSymbol,
      stats: tokenStatsMap[t.cleanSymbol] || { points24h: t.score || 0, points7d: 0, points30d: 0, trend7d: 'flat' }
    })).sort((a, b) => b.stats.points7d - a.stats.points7d).slice(0, 10);
  }, [tokensList, tokenStatsMap]);

  // 4. Compute Top 10 for 30 Days
  const top10_30d = useMemo(() => {
    return [...tokensList].map(t => ({
      cleanSymbol: t.cleanSymbol,
      stats: tokenStatsMap[t.cleanSymbol] || { points24h: t.score || 0, points7d: 0, points30d: 0, trend30d: 'flat' }
    })).sort((a, b) => b.stats.points30d - a.stats.points30d).slice(0, 10);
  }, [tokensList, tokenStatsMap]);

  // 🧮 CALCUL QUANTITATIF DU RSI MULTI-TF (0 à 100)
  const computeMultiTfRsi = (p24, p7, p30, trend24) => {
    const w = (0.45 * p24) + (0.35 * (p7 / 1.6)) + (0.20 * (p30 / 2.2));
    let rsi = 50 + (50 * Math.tanh(w / 35));
    if (trend24 === 'down') rsi = Math.min(rsi, rsi * 0.7);
    return Math.max(0, Math.min(100, parseFloat(rsi.toFixed(1))));
  };

  const getRsiStatus = (rsi, trend24) => {
    if (rsi >= 88) return { label: '👑 EMPEREUR MULTI-TF', color: '#00ff88', bg: 'rgba(0, 255, 136, 0.2)', border: '#00ff88' };
    if (rsi >= 75) return { label: '🚀 SUPER MOMENTUM', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)', border: '#38bdf8' };
    if (rsi >= 60) return { label: '🟢 DÉCOLLAGE ACTIF', color: '#a3e635', bg: 'rgba(163, 230, 53, 0.2)', border: '#a3e635' };
    if (rsi >= 45) return { label: '🟡 ZONE NEUTRE', color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)', border: '#facc15' };
    return { label: '🔴 ÉPUISEMENT / VENTE', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e' };
  };

  const topRsiTokens = useMemo(() => {
    return Object.entries(tokenStatsMap).map(([sym, stats]) => {
      const rsi = computeMultiTfRsi(stats.points24h, stats.points7d, stats.points30d, stats.trend24h);
      return {
        cleanSymbol: sym,
        stats,
        rsi,
        status: getRsiStatus(rsi, stats.trend24h)
      };
    }).sort((a, b) => b.rsi - a.rsi).slice(0, 10);
  }, [tokenStatsMap]);

  // 🏛️ MOTEUR D'HISTORIQUE & BACKTEST EN DIRECT DES VISITEURS DU TOP 5 AVEC FILTRES SNIPER
  const [visitorFilterMode, setVisitorFilterMode] = useState('sniper_active'); // 'all' | 'sniper_active' | 'winners' | 'traps'

  const top5VisitorsAnalysis = useMemo(() => {
    if (!tokensList || tokensList.length === 0) {
      return { visitors: [], filteredVisitors: [], stats: { total: 0, winners: 0, traps: 0, neutrals: 0, winRate: 0, avgGain: 0, avgLoss: 0, verdict: 'INSUFFICIENT_DATA', verdictLabel: 'Calcul des données...', verdictColor: '#94a3b8' }, sniperStats: { winRate: 0, netProfit: 0, avgGain: 0, avgLoss: 0, savedLoss: 0 } };
    }

    const validTokens = tokensList.filter(t => (t.ratioSeries || []).length >= 10);
    if (validTokens.length === 0) {
      return { visitors: [], filteredVisitors: [], stats: { total: 0, winners: 0, traps: 0, neutrals: 0, winRate: 0, avgGain: 0, avgLoss: 0, verdict: 'INSUFFICIENT_DATA', verdictLabel: 'Calcul des données...', verdictColor: '#94a3b8' }, sniperStats: { winRate: 0, netProfit: 0, avgGain: 0, avgLoss: 0, savedLoss: 0 } };
    }

    const numSteps = 96;
    const tokenCurves = {};
    const timeArray = [];

    validTokens.forEach(tok => {
      const rSeries = tok.ratioSeries || [];
      const startIdx = Math.max(0, rSeries.length - numSteps);
      const slice = rSeries.slice(startIdx);
      const baseVal = typeof slice[0] === 'object' ? (slice[0].open || slice[0].close) : slice[0];
      if (!baseVal || baseVal <= 0) return;

      const curve = [];
      slice.forEach((c, idx) => {
        let val = typeof c === 'object' ? c.close : c;
        let t = typeof c === 'object' ? (c.time ? (typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime()/1000)) : Math.floor(c.timeMs/1000)) : 0;
        if (idx >= timeArray.length && t > 0) timeArray.push(t);
        const norm = ((val - baseVal) / baseVal) * 100;
        curve.push(norm);
      });
      tokenCurves[tok.cleanSymbol] = curve;
    });

    const visitorsMap = {};

    for (let step = 0; step < numSteps; step++) {
      const stepScores = [];
      Object.entries(tokenCurves).forEach(([sym, curve]) => {
        if (curve[step] !== undefined) {
          stepScores.push({ sym, score: curve[step] });
        }
      });

      stepScores.sort((a, b) => b.score - a.score);
      const currentTop5 = stepScores.slice(0, 5);

      currentTop5.forEach((item, rankIdx) => {
        const sym = item.sym;
        const currentScore = parseFloat(item.score.toFixed(1));

        if (!visitorsMap[sym]) {
          const tTimestamp = timeArray[step] || (Math.floor(Date.now()/1000) - (numSteps - step) * 900);
          const timeDate = new Date(tTimestamp * 1000);
          const timeFormatted = timeDate.getHours().toString().padStart(2, '0') + ':' + timeDate.getMinutes().toString().padStart(2, '0');

          visitorsMap[sym] = {
            sym,
            firstEntryStep: step,
            firstEntryTimeFormatted: timeFormatted,
            entryScore: currentScore,
            entryRank: rankIdx + 1,
            maxScoreReached: currentScore,
            maxRankReached: rankIdx + 1,
            stepsInTop5: 1,
            lastStepSeenInTop5: step
          };
        } else {
          visitorsMap[sym].stepsInTop5 += 1;
          visitorsMap[sym].lastStepSeenInTop5 = step;
          if (currentScore > visitorsMap[sym].maxScoreReached) {
            visitorsMap[sym].maxScoreReached = currentScore;
          }
          if (rankIdx + 1 < visitorsMap[sym].maxRankReached) {
            visitorsMap[sym].maxRankReached = rankIdx + 1;
          }
        }
      });
    }

    // Calculer les métriques avancées du Filtre Sniper pour chaque token
    const visitorsList = Object.values(visitorsMap).map(v => {
      const curve = tokenCurves[v.sym] || [];
      const currentScore = curve.length > 0 ? parseFloat((curve[curve.length - 1]).toFixed(1)) : v.entryScore;
      const currentRank = top10_24h.findIndex(t => t.cleanSymbol === v.sym) + 1;
      const netOutcomePts = parseFloat((currentScore - v.entryScore).toFixed(1));
      const hoursInTop5 = parseFloat(((v.stepsInTop5 * 15) / 60).toFixed(1));
      const impulseAfterEntry = parseFloat((v.maxScoreReached - v.entryScore).toFixed(1));

      // 🎯 RÈGLE 1 : Entrée Précoce (Score ≤ +12 pts) vs FOMO (> +15 pts)
      const isEarlyEntry = v.entryScore <= 12;
      const isFomoLate = v.entryScore > 15;

      // ⏱️ RÈGLE 2 : Poussée Confirmée (> 1.5 pts d'impulsion) vs Rejet Immédiat
      const hasContinuedPush = impulseAfterEntry >= 1.5;

      // PnL Réel avec les Filtres Sniper appliqués
      let sniperPnl = netOutcomePts;
      let sniperAction = 'VALID_TRADE';
      let sniperBadge = '🎯 ENTRÉE VALIDÉE';
      let sniperColor = '#00ff88';

      if (isFomoLate) {
        sniperPnl = 0; // Trade évité par la Règle #1
        sniperAction = 'AVOIDED_FOMO';
        sniperBadge = '🚫 ÉVITÉ (Score Entrée > 15)';
        sniperColor = '#94a3b8';
      } else if (!hasContinuedPush) {
        sniperPnl = -0.5; // Coupé en 30 min par la Règle #2
        sniperAction = 'CUT_30MIN';
        sniperBadge = '⏱️ COUPÉ 30 MIN (-0.5 pt)';
        sniperColor = '#fbbf24';
      }

      let status = 'NEUTRAL';
      let statusLabel = '🟡 SORTIE CALME';
      let statusColor = '#facc15';
      let statusBg = 'rgba(250, 204, 21, 0.15)';

      if (currentRank > 0 && currentRank <= 5) {
        status = 'ACTIVE_LEADER';
        statusLabel = '👑 LEADER ACTUEL (#' + currentRank + ')';
        statusColor = '#00ff88';
        statusBg = 'rgba(0, 255, 136, 0.2)';
      } else if (netOutcomePts >= 6) {
        status = 'WINNER_RUNNER';
        statusLabel = '🚀 GAIN VALIDÉ (+' + netOutcomePts + ' pts)';
        statusColor = '#38bdf8';
        statusBg = 'rgba(56, 189, 248, 0.2)';
      } else if (netOutcomePts <= -5) {
        status = 'TRAP_DUMPED';
        statusLabel = '🔴 PIÈGE ACHETEUR (REJET)';
        statusColor = '#f43f5e';
        statusBg = 'rgba(244, 63, 94, 0.2)';
      }

      return {
        ...v,
        currentScore,
        currentRank: currentRank > 0 ? currentRank : '>10',
        netOutcomePts,
        hoursInTop5,
        impulseAfterEntry,
        isEarlyEntry,
        isFomoLate,
        hasContinuedPush,
        sniperPnl,
        sniperAction,
        sniperBadge,
        sniperColor,
        status,
        statusLabel,
        statusColor,
        statusBg
      };
    });

    visitorsList.sort((a, b) => b.netOutcomePts - a.netOutcomePts);

    // Calcul des statistiques BRUTES
    const total = visitorsList.length;
    const winners = visitorsList.filter(v => v.netOutcomePts >= 4 || v.status === 'ACTIVE_LEADER').length;
    const traps = visitorsList.filter(v => v.netOutcomePts <= -4).length;
    const neutrals = total - winners - traps;
    const rawWinRate = total > 0 ? parseFloat(((winners / total) * 100).toFixed(1)) : 0;

    const winnerTokens = visitorsList.filter(v => v.netOutcomePts > 0);
    const trapTokens = visitorsList.filter(v => v.netOutcomePts < 0);
    const avgGain = winnerTokens.length > 0
      ? parseFloat((winnerTokens.reduce((acc, v) => acc + v.netOutcomePts, 0) / winnerTokens.length).toFixed(1))
      : 0;
    const avgLoss = trapTokens.length > 0
      ? parseFloat((trapTokens.reduce((acc, v) => acc + v.netOutcomePts, 0) / trapTokens.length).toFixed(1))
      : 0;

    // Calcul des statistiques OPTIMISÉES AVEC FILTRE SNIPER
    const sniperEligible = visitorsList.filter(v => !v.isFomoLate);
    const sniperWinners = sniperEligible.filter(v => v.sniperPnl > 0);
    const sniperLosses = sniperEligible.filter(v => v.sniperPnl < 0);
    const sniperWinRate = sniperEligible.length > 0 ? parseFloat(((sniperWinners.length / sniperEligible.length) * 100).toFixed(1)) : 0;

    const sniperAvgGain = sniperWinners.length > 0
      ? parseFloat((sniperWinners.reduce((acc, v) => acc + v.sniperPnl, 0) / sniperWinners.length).toFixed(1))
      : 0;
    const sniperAvgLoss = sniperLosses.length > 0
      ? parseFloat((sniperLosses.reduce((acc, v) => acc + v.sniperPnl, 0) / sniperLosses.length).toFixed(1))
      : -0.5;

    let verdictLabel = '🟢 STRATÉGIE OPTIMISÉE (Filtres Anti-FOMO & Stop 30 min Actifs)';
    let verdictColor = '#00ff88';

    // Filtrer la liste selon le mode sélectionné
    let filteredVisitors = visitorsList;
    if (visitorFilterMode === 'sniper_active') {
      filteredVisitors = visitorsList.filter(v => !v.isFomoLate);
    } else if (visitorFilterMode === 'winners') {
      filteredVisitors = visitorsList.filter(v => v.netOutcomePts > 0);
    } else if (visitorFilterMode === 'traps') {
      filteredVisitors = visitorsList.filter(v => v.netOutcomePts < 0);
    }

    return {
      visitors: visitorsList,
      filteredVisitors,
      stats: {
        total,
        winners,
        traps,
        neutrals,
        winRate: rawWinRate,
        avgGain,
        avgLoss,
        verdictLabel,
        verdictColor
      },
      sniperStats: {
        total: sniperEligible.length,
        winnersCount: sniperWinners.length,
        trapsAvoided: visitorsList.filter(v => v.isFomoLate || !v.hasContinuedPush).length,
        winRate: sniperWinRate,
        avgGain: sniperAvgGain,
        avgLoss: sniperAvgLoss,
        rrRatio: Math.abs(sniperAvgLoss) > 0 ? parseFloat((sniperAvgGain / Math.abs(sniperAvgLoss)).toFixed(2)) : 0
      }
    };
  }, [tokensList, top10_24h, visitorFilterMode]);


  // Action categories
  const actionCategories = useMemo(() => {
    const alphaSupreme = [];
    const emergingRockets = [];
    const exhaustedKings = [];

    const allCandidates = Array.from(new Set([
      ...top10_24h.map(t => t.cleanSymbol),
      ...top10_7d.map(t => t.cleanSymbol),
      ...top10_30d.map(t => t.cleanSymbol)
    ]));

    allCandidates.forEach(sym => {
      const stats = tokenStatsMap[sym];
      if (!stats) return;

      const isTop24h = top10_24h.some(t => t.cleanSymbol === sym);
      const isTop7d = top10_7d.some(t => t.cleanSymbol === sym);
      const isTop30d = top10_30d.some(t => t.cleanSymbol === sym);

      const rank24h = top10_24h.findIndex(t => t.cleanSymbol === sym) + 1;
      const rank7d = top10_7d.findIndex(t => t.cleanSymbol === sym) + 1;

      if (stats.trend24h === 'up' && stats.points24h >= 14 && (isTop7d || isTop30d || stats.points7d >= 15)) {
        alphaSupreme.push({
          sym,
          type: 'alpha',
          rank24h: rank24h > 0 ? rank24h : 1,
          points24h: stats.points24h,
          points7d: stats.points7d,
          points30d: stats.points30d
        });
      } else if (stats.trend24h === 'up' && stats.points24h >= 10 && !isTop7d) {
        emergingRockets.push({
          sym,
          type: 'rocket',
          rank24h: rank24h > 0 ? rank24h : 1,
          points24h: stats.points24h,
          points7d: stats.points7d,
          points30d: stats.points30d
        });
      } else if ((stats.trend24h === 'down' || stats.trend7d === 'down') && (stats.points7d >= 20 || stats.points30d >= 35)) {
        exhaustedKings.push({
          sym,
          type: 'exhausted',
          rank24h: rank24h > 0 ? rank24h : (rank7d > 0 ? rank7d : '-'),
          points24h: stats.points24h,
          points7d: stats.points7d,
          points30d: stats.points30d
        });
      }
    });

    alphaSupreme.sort((a, b) => b.points24h - a.points24h);
    emergingRockets.sort((a, b) => b.points24h - a.points24h);
    exhaustedKings.sort((a, b) => b.points7d - a.points7d);

    return {
      alphaSupreme: alphaSupreme.slice(0, 3),
      emergingRockets: emergingRockets.slice(0, 6),
      exhaustedKings: exhaustedKings.slice(0, 6)
    };
  }, [top10_24h, top10_7d, top10_30d, tokenStatsMap]);

  const activeFocusTokens = useMemo(() => {
    return [
      ...actionCategories.alphaSupreme,
      ...actionCategories.emergingRockets
    ];
  }, [actionCategories]);


  // 📥 FONCTION D'EXPORT PDF DU REGISTRE DES VISITEURS DU TOP 5
  const handleExportTop5Pdf = () => {
    const stats = top5VisitorsAnalysis.stats;
    const visitors = top5VisitorsAnalysis.visitors;
    const nowStr = new Date().toLocaleString('fr-FR', { timeZone: 'UTC' }) + ' UTC';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les fenêtres pop-up pour télécharger le rapport PDF.');
      return;
    }

    const rowsHtml = visitors.map((v, i) => `
      <tr style="background: ${i % 2 === 0 ? '#0f172a' : '#090d16'}; border-bottom: 1px solid #1e293b;">
        <td style="padding: 8px 10px; font-weight: bold; color: #ffffff;">#${v.entryRank} ${v.sym}</td>
        <td style="padding: 8px 10px; color: #94a3b8;">${v.firstEntryTimeFormatted} (${v.hoursInTop5}h)</td>
        <td style="padding: 8px 10px; color: #ffffff;">+${v.entryScore} pts</td>
        <td style="padding: 8px 10px; color: #38bdf8; font-weight: bold;">+${v.maxScoreReached} pts</td>
        <td style="padding: 8px 10px; color: ${v.currentScore >= 0 ? '#10b981' : '#f43f5e'};">${v.currentScore >= 0 ? '+' : ''}${v.currentScore} pts (#${v.currentRank})</td>
        <td style="padding: 8px 10px; font-weight: bold; color: ${v.netOutcomePts >= 0 ? '#10b981' : '#f43f5e'};">${v.netOutcomePts >= 0 ? '+' : ''}${v.netOutcomePts} pts</td>
        <td style="padding: 8px 10px;"><span style="background: ${v.statusBg}; color: ${v.statusColor}; border: 1px solid ${v.statusColor}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${v.statusLabel}</span></td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapport_Top5_Visitors_${new Date().toISOString().slice(0, 10)}.pdf</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #050811;
              color: #f8fafc;
              padding: 24px;
              margin: 0;
            }
            .header {
              border-bottom: 2px solid #00ff88;
              padding-bottom: 12px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .title {
              font-size: 20px;
              font-weight: 900;
              color: #00ff88;
              letter-spacing: 0.5px;
            }
            .date {
              font-size: 12px;
              color: #94a3b8;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }
            .card {
              background: #0f172a;
              border: 1px solid #1e293b;
              border-radius: 8px;
              padding: 12px;
            }
            .card-title {
              font-size: 11px;
              color: #94a3b8;
              font-weight: 800;
              margin-bottom: 4px;
            }
            .card-val {
              font-size: 22px;
              font-weight: 900;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              background: #0b1120;
              border-radius: 8px;
              overflow: hidden;
            }
            th {
              background: #020617;
              color: #64748b;
              padding: 10px;
              text-align: left;
              font-weight: 900;
              border-bottom: 2px solid #1e293b;
            }
            @media print {
              body { background: #ffffff !important; color: #000000 !important; }
              .header { border-color: #000000 !important; }
              .title { color: #000000 !important; }
              .card { background: #f8fafc !important; border-color: #cbd5e1 !important; }
              .card-val { color: #000000 !important; }
              table { background: #ffffff !important; color: #000000 !important; }
              th { background: #e2e8f0 !important; color: #000000 !important; }
              tr { background: #ffffff !important; border-bottom: 1px solid #e2e8f0 !important; }
              td { color: #000000 !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">🏛️ RAPPORT DES VISITEURS DU TOP 5 (24 HEURES)</div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Analyse Quantitative Anti-Biais de Survie & Backtest de Stratégie</div>
            </div>
            <div style="text-align: right;">
              <div class="date">Généré le : ${nowStr}</div>
              <div style="font-weight: bold; color: ${stats.verdictColor}; font-size: 12px; margin-top: 4px;">${stats.verdictLabel}</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="card">
              <div class="card-title">🎯 TAUX DE SUCCÈS (WIN RATE)</div>
              <div class="card-val" style="color: ${stats.winRate >= 50 ? '#00ff88' : '#f43f5e'};">${stats.winRate}%</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${stats.winners} Gagnants / ${stats.traps} Pièges</div>
            </div>
            <div class="card">
              <div class="card-title">🚀 GAIN MOYEN PAR GAGNANT</div>
              <div class="card-val" style="color: #00ff88;">+${stats.avgGain} pts</div>
            </div>
            <div class="card">
              <div class="card-title">🔻 PERTE MOYENNE SUR PIÈGES</div>
              <div class="card-val" style="color: #f43f5e;">${stats.avgLoss} pts</div>
            </div>
            <div class="card">
              <div class="card-title">⚖️ ESPÉRANCE MATHÉMATIQUE</div>
              <div class="card-val" style="color: #38bdf8;">${Math.abs(stats.avgLoss) > 0 ? (stats.avgGain / Math.abs(stats.avgLoss)).toFixed(2) + 'x R/R' : 'N/A'}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>TOKEN</th>
                <th>1ÈRE ENTRÉE</th>
                <th>SCORE ENTRÉE</th>
                <th>PIC MAX</th>
                <th>SCORE ACTUEL</th>
                <th>GAIN / PERTE NET</th>
                <th>STATUT RÉEL</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleSelectTokenInternal = (sym) => {
    setSelectedTokenForView(sym);
    if (onSelectToken) onSelectToken(sym);
  };

  const getUniversalBadge = (sym) => {
    let count = 0;
    if (top10_24h.some(t => t.cleanSymbol === sym)) count++;
    if (top10_7d.some(t => t.cleanSymbol === sym)) count++;
    if (top10_30d.some(t => t.cleanSymbol === sym)) count++;
    return count >= 2;
  };

  const renderTrendIcon = (trend) => {
    if (trend === 'up') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          color: '#10b981',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: '900',
          fontSize: '0.64rem',
          whiteSpace: 'nowrap'
        }}>
          <TrendingUp size={12} color="#10b981" />
          <span>EN HAUSSE</span>
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          color: '#f43f5e',
          background: 'rgba(244, 63, 94, 0.15)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: '900',
          fontSize: '0.64rem',
          whiteSpace: 'nowrap'
        }}>
          <TrendingDown size={12} color="#f43f5e" />
          <span>EN BAISSE</span>
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        color: '#facc15',
        background: 'rgba(250, 204, 21, 0.12)',
        border: '1px solid rgba(250, 204, 21, 0.35)',
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: '900',
        fontSize: '0.64rem',
        whiteSpace: 'nowrap'
      }}>
        <Minus size={12} color="#facc15" />
        <span>STABLE</span>
      </span>
    );
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(8, 14, 24, 0.98) 100%)',
      border: '1px solid rgba(56, 189, 248, 0.35)',
      borderRadius: '14px',
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      boxShadow: '0 0 30px rgba(0,0,0,0.6), 0 0 15px rgba(56, 189, 248, 0.15)',
      marginBottom: '8px'
    }}>
      {/* Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid #38bdf8',
            color: '#38bdf8',
            padding: '4px 10px',
            borderRadius: '6px',
            fontWeight: '900',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Crown size={16} color="#38bdf8" />
            <span>TABLEAU MULTI-HORIZONS DES TOP 10 (24H | 7J | 30J)</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            · Points accumulés sur 24H, 7J et 30J avec dynamique en direct
          </span>
        </div>

        {loading30d && (
          <span style={{ fontSize: '0.65rem', color: '#38bdf8' }}>
            ⚡ Actualisation points macro 30J...
          </span>
        )}
      </div>

      {/* 3 Columns Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '12px'
      }}>
        {/* ── COLONNE 1 : TOP 10 (24 HEURES) ── */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          borderRadius: '10px',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
            paddingBottom: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '900', fontSize: '0.78rem' }}>
              <Zap size={15} color="#10b981" />
              <span>TOP 10 · DERNIÈRES 24 HEURES</span>
            </div>
            <span style={{ fontSize: '0.60rem', color: '#64748b', fontWeight: '700' }}>POINTS 24H</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {top10_24h.map((tok, idx) => {
              const sym = tok.cleanSymbol;
              const stats = tok.stats;
              const color = getTokenFixedColor(sym);
              const isUniversal = getUniversalBadge(sym);

              return (
                <div
                  key={sym}
                  onClick={() => handleSelectTokenInternal(sym)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={"Cliquer pour voir les bougies et l'oscillateur RSI Multi-TF de " + sym}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      background: color,
                      color: '#000000',
                      fontWeight: '900',
                      fontSize: '0.66rem',
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontWeight: '900', fontSize: '0.76rem', color: '#ffffff' }}>
                      {sym}
                    </span>
                    {isUniversal && (
                      <span style={{ fontSize: '0.60rem', color: '#ffd700' }} title="Leader Multi-Horizons">👑</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: '900',
                      color: stats.points24h >= 0 ? '#10b981' : '#f43f5e',
                      background: stats.points24h >= 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(244, 63, 94, 0.18)',
                      border: '1px solid ' + (stats.points24h >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'),
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }} title="Points accumulés sur 24H">
                      24H: {stats.points24h >= 0 ? '+' : ''}{stats.points24h} pts
                    </span>

                    <span style={{
                      fontSize: '0.60rem',
                      fontWeight: '700',
                      color: '#38bdf8'
                    }} title="Points accumulés sur 7J">
                      7J: {stats.points7d >= 0 ? '+' : ''}{stats.points7d} pts
                    </span>

                    <span style={{
                      fontSize: '0.60rem',
                      fontWeight: '700',
                      color: '#c084fc'
                    }} title="Points accumulés sur 30J">
                      30J: {stats.points30d >= 0 ? '+' : ''}{stats.points30d} pts
                    </span>

                    {renderTrendIcon(stats.trend24h)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COLONNE 2 : TOP 10 (7 JOURS) ── */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          borderRadius: '10px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
            paddingBottom: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: '900', fontSize: '0.78rem' }}>
              <Calendar size={15} color="#38bdf8" />
              <span>TOP 10 · DERNIERS 7 JOURS</span>
            </div>
            <span style={{ fontSize: '0.60rem', color: '#64748b', fontWeight: '700' }}>POINTS 7J</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {top10_7d.map((tok, idx) => {
              const sym = tok.cleanSymbol;
              const stats = tok.stats;
              const color = getTokenFixedColor(sym);
              const isUniversal = getUniversalBadge(sym);

              return (
                <div
                  key={sym}
                  onClick={() => handleSelectTokenInternal(sym)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={"Cliquer pour voir les bougies et l'oscillateur RSI Multi-TF de " + sym}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      background: color,
                      color: '#000000',
                      fontWeight: '900',
                      fontSize: '0.66rem',
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontWeight: '900', fontSize: '0.76rem', color: '#ffffff' }}>
                      {sym}
                    </span>
                    {isUniversal && (
                      <span style={{ fontSize: '0.60rem', color: '#ffd700' }} title="Leader Multi-Horizons">👑</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: '900',
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.18)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }} title="Points accumulés sur 7J">
                      7J: {stats.points7d >= 0 ? '+' : ''}{stats.points7d} pts
                    </span>

                    <span style={{
                      fontSize: '0.60rem',
                      fontWeight: '700',
                      color: stats.points24h >= 0 ? '#10b981' : '#f43f5e'
                    }} title="Points accumulés sur 24H">
                      24H: {stats.points24h >= 0 ? '+' : ''}{stats.points24h} pts
                    </span>

                    <span style={{
                      fontSize: '0.60rem',
                      fontWeight: '700',
                      color: '#c084fc'
                    }} title="Points accumulés sur 30J">
                      30J: {stats.points30d >= 0 ? '+' : ''}{stats.points30d} pts
                    </span>

                    {renderTrendIcon(stats.trend7d)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COLONNE 3 : TOP 10 (30 JOURS) ── */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          borderRadius: '10px',
          border: '1px solid rgba(192, 132, 252, 0.3)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(192, 132, 252, 0.25)',
            paddingBottom: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', fontWeight: '900', fontSize: '0.78rem' }}>
              <Globe size={15} color="#c084fc" />
              <span>TOP 10 · DERNIERS 30 JOURS</span>
            </div>
            <span style={{ fontSize: '0.60rem', color: '#64748b', fontWeight: '700' }}>POINTS 30J</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {top10_30d.map((tok, idx) => {
              const sym = tok.cleanSymbol;
              const stats = tok.stats;
              const color = getTokenFixedColor(sym);
              const isUniversal = getUniversalBadge(sym);

              return (
                <div
                  key={sym}
                  onClick={() => handleSelectTokenInternal(sym)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title={"Cliquer pour voir les bougies et l'oscillateur RSI Multi-TF de " + sym}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      background: color,
                      color: '#000000',
                      fontWeight: '900',
                      fontSize: '0.66rem',
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontWeight: '900', fontSize: '0.76rem', color: '#ffffff' }}>
                      {sym}
                    </span>
                    {isUniversal && (
                      <span style={{ fontSize: '0.60rem', color: '#ffd700' }} title="Leader Multi-Horizons">👑</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: '900',
                      color: '#c084fc',
                      background: 'rgba(192, 132, 252, 0.18)',
                      border: '1px solid rgba(192, 132, 252, 0.4)',
                      padding: '1px 5px',
                      borderRadius: '4px'
                    }} title="Points accumulés sur 30J">
                      30J: {stats.points30d >= 0 ? '+' : ''}{stats.points30d} pts
                    </span>

                    <span style={{
                      fontSize: '0.60rem',
                      fontWeight: '700',
                      color: '#38bdf8'
                    }} title="Points accumulés sur 7J">
                      7J: {stats.points7d >= 0 ? '+' : ''}{stats.points7d} pts
                    </span>

                    <span style={{
                      fontSize: '0.60rem',
                      fontWeight: '700',
                      color: stats.points24h >= 0 ? '#10b981' : '#f43f5e'
                    }} title="Points accumulés sur 24H">
                      24H: {stats.points24h >= 0 ? '+' : ''}{stats.points24h} pts
                    </span>

                    {renderTrendIcon(stats.trend30d)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ⚡ TABLEAU DÉDIÉ : RSI MULTI-TF (0 à 100) */}
      <div style={{
        background: 'rgba(4, 9, 20, 0.95)',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 0 25px rgba(0, 0, 0, 0.6), 0 0 12px rgba(56, 189, 248, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.15) 100%)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              padding: '3px 8px',
              borderRadius: '6px',
              fontWeight: '900',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Zap size={15} color="#38bdf8" />
              <span>CLASSEMENT RSI MULTI-TF (0 à 100)</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              · Indicateur Quantitatif Propriétaire (40% 24H + 35% 7J + 25% 30J)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', fontSize: '0.64rem', color: '#64748b', fontWeight: '800' }}>
            <span style={{ color: '#00ff88' }}>● &gt;88 Empereur</span>
            <span style={{ color: '#38bdf8' }}>● 75-88 Super Momentum</span>
            <span style={{ color: '#a3e635' }}>● 60-75 Décollage</span>
            <span style={{ color: '#f43f5e' }}>● &lt;45 Épuisement</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {topRsiTokens.map((item, idx) => {
            const sym = item.cleanSymbol;
            const stats = item.stats;
            const rsi = item.rsi;
            const status = item.status;
            const color = getTokenFixedColor(sym);

            return (
              <div
                key={sym}
                onClick={() => handleSelectTokenInternal(sym)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '150px 1fr 110px 240px 180px',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={"Cliquer pour voir les bougies et l'oscillateur RSI Multi-TF de " + sym}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: color,
                    color: '#000000',
                    fontWeight: '900',
                    fontSize: '0.68rem',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    #{idx + 1}
                  </span>
                  <span style={{ fontWeight: '900', fontSize: '0.82rem', color: '#ffffff' }}>
                    {sym}
                  </span>
                  {rsi >= 85 && <span style={{ fontSize: '0.70rem' }} title="Tri-Horizon Emperor">👑</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <div style={{
                    flex: 1,
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: rsi + '%',
                      height: '100%',
                      background: rsi >= 85
                        ? 'linear-gradient(90deg, #38bdf8 0%, #00ff88 100%)'
                        : (rsi >= 70 ? '#38bdf8' : (rsi >= 55 ? '#a3e635' : (rsi >= 45 ? '#facc15' : '#f43f5e'))),
                      borderRadius: '4px',
                      boxShadow: rsi >= 75 ? ('0 0 10px ' + status.color) : 'none',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: '900', color: status.color }}>
                    {rsi}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: '700' }}>/ 100</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.64rem' }}>
                  <span style={{ color: stats.points24h >= 0 ? '#10b981' : '#f43f5e', fontWeight: '800' }}>
                    24H: {stats.points24h >= 0 ? '+' : ''}{stats.points24h}
                  </span>
                  <span style={{ color: '#475569' }}>·</span>
                  <span style={{ color: '#38bdf8', fontWeight: '700' }}>
                    7J: +{stats.points7d}
                  </span>
                  <span style={{ color: '#475569' }}>·</span>
                  <span style={{ color: '#c084fc', fontWeight: '700' }}>
                    30J: +{stats.points30d}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{
                    background: status.bg,
                    border: '1px solid ' + status.border,
                    color: status.color,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: '900',
                    fontSize: '0.64rem',
                    whiteSpace: 'nowrap'
                  }}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      
    </div>
  );
};

export default MultiHorizonTop5Matrix;