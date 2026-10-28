import React, { useState, useEffect, useMemo } from 'react';
import { fetchTop500Symbols } from './logic/scanner';
import { SolScoreCandleChart } from './SolScoreCandleChart';
import { Trophy, Search, RefreshCw, Zap, TrendingUp, Filter, BarChart3, Globe, Award, ArrowUpDown, ChevronLeft, ChevronRight, Scale, X } from 'lucide-react';

async function fetchBybitKlines(symbol, interval = '15', limit = 1000) {
  const cleanBase = symbol.replace('USDT', '').toUpperCase();
  const formattedSymbol = `${cleanBase}USDT`;

  const binanceTfMap = { '15':'15m', '60':'1h', '240':'4h', 'D':'1d', 'W':'1w' };
  const bTf = binanceTfMap[interval] || '15m';

  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=${bTf}&limit=${limit}`);
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (_) {}

  try {
    const res2 = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`);
    if (res2.ok) {
      const json = await res2.json();
      if (json.result?.list?.length) {
        return json.result.list.slice().reverse();
      }
    }
  } catch (_) {}

  return [];
}

// Calculate EXACT Multi-Timeframe Score matching SolScoreCandleChart.jsx
// W=3.0, D=2.5, 4H=2.0, 1H=1.5, 15m=1.0 (Max = 10 pts) + WeightedPerf
function computeExactMultiTfScore(tokenRatioData, solRatioData) {
  if (!tokenRatioData || tokenRatioData.length < 2) return 0;

  const len = tokenRatioData.length;
  const curTokenRatio = tokenRatioData[len - 1];
  
  // Lookbacks for 15m, 1h, 4h, 1d, 1w
  const idx15m = Math.max(0, len - 2);
  const idx1h  = Math.max(0, len - 5);
  const idx4h  = Math.max(0, len - 17);
  const idx1d  = Math.max(0, len - 97);
  const idx1w  = Math.max(0, len - 673);

  const getPerf = (prevIdx) => {
    const prev = tokenRatioData[prevIdx];
    return prev > 0 ? ((curTokenRatio - prev) / prev) * 100 : 0;
  };

  const p15m = getPerf(idx15m);
  const p1h  = getPerf(idx1h);
  const p4h  = getPerf(idx4h);
  const p1d  = getPerf(idx1d);
  const p1w  = getPerf(idx1w);

  let confluencePts = 0;
  if (p1w  > 0) confluencePts += 3.0;
  if (p1d  > 0) confluencePts += 2.5;
  if (p4h  > 0) confluencePts += 2.0;
  if (p1h  > 0) confluencePts += 1.5;
  if (p15m > 0) confluencePts += 1.0;

  const weightedPerf = (p1w * 0.30) + (p1d * 0.25) + (p4h * 0.20) + (p1h * 0.15) + (p15m * 0.10);
  return confluencePts + weightedPerf;
}

export const Top500TokensPerformance = () => {
  const [tokensList, setTokensList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all'); // 'all', 'positive', 'negative'
  const [sortBy, setSortBy] = useState('scoreDesc'); // 'scoreDesc', 'scoreAsc', 'symbol'
  
  // INLINE CHART DISPLAY ON THE SAME PAGE
  const [selectedTokenChart, setSelectedTokenChart] = useState(null);

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const loadTop500Performance = async () => {
    setIsLoading(true);
    setProgressMsg('Récupération du Top 500 Bybit Spot USDT...');
    try {
      const topSymbolsRaw = await fetchTop500Symbols(true, 500);
      let candidateSymbols = [];
      if (Array.isArray(topSymbolsRaw) && topSymbolsRaw.length > 0) {
        candidateSymbols = topSymbolsRaw
          .map(t => typeof t === 'string' ? t : t.symbol)
          .filter(s => s.endsWith('USDT') && !s.includes('USDC') && !s.includes('SOLUSDT'))
          .slice(0, 300);
      }

      setProgressMsg(`Chargement des klines SOL/USDT...`);

      const solKlines = await fetchBybitKlines('SOLUSDT', '15', 1000);
      if (!solKlines.length) throw new Error('Impossible de charger les klines SOL');

      const solCloses = solKlines.map(k => parseFloat(k[4]));
      const solLatestClose = solCloses[solCloses.length - 1];

      const results = [];

      // Process tokens in parallel batches
      const batchSize = 10;
      for (let i = 0; i < candidateSymbols.length; i += batchSize) {
        const batch = candidateSymbols.slice(i, i + batchSize);
        setProgressMsg(`Calcul exact des scores Multi-TF (1000 klines): ${i + batch.length} / ${candidateSymbols.length} tokens...`);

        const batchPromises = batch.map(async (symbol) => {
          const tokKlines = await fetchBybitKlines(symbol, '15', 1000);
          if (!tokKlines || tokKlines.length < 5) return null;

          const tokCloses = tokKlines.map(k => parseFloat(k[4]));
          const tokLatestClose = tokCloses[tokCloses.length - 1];

          // Build ratio series
          const minLen = Math.min(tokCloses.length, solCloses.length);
          const ratioSeries = [];
          for (let k = 0; k < minLen; k++) {
            const sC = solCloses[solCloses.length - minLen + k];
            const tC = tokCloses[tokCloses.length - minLen + k];
            if (sC > 0) ratioSeries.push(tC / sC);
          }

          if (ratioSeries.length < 5) return null;

          const curRatio  = ratioSeries[ratioSeries.length - 1];
          const prevRatio = ratioSeries[ratioSeries.length - 2];
          const ratioPerf15m = ((curRatio - prevRatio) / prevRatio) * 100;

          // EXACT Multi-TF Score (matching SolScoreCandleChart.jsx)
          const exactScore = computeExactMultiTfScore(ratioSeries, solCloses);

          return {
            symbol,
            cleanSymbol: symbol.replace('USDT', '').toUpperCase(),
            price: tokLatestClose,
            curRatio,
            ratioPerf15m,
            score: exactScore,
          };
        });

        const batchResults = await Promise.all(batchPromises);
        for (const item of batchResults) {
          if (item) results.push(item);
        }
      }

      // Sort by score descending by default
      results.sort((a, b) => b.score - a.score);
      setTokensList(results);

    } catch (err) {
      setProgressMsg(`Erreur de chargement: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTop500Performance();
  }, []);

  // Filter & Sort logic
  const filteredTokens = useMemo(() => {
    let data = tokensList;

    if (searchTerm) {
      const q = searchTerm.trim().toUpperCase();
      data = data.filter(d => d.symbol.toUpperCase().includes(q) || d.cleanSymbol.toUpperCase().includes(q));
    }

    if (scoreFilter === 'positive') data = data.filter(d => d.score >= 0);
    if (scoreFilter === 'negative') data = data.filter(d => d.score < 0);

    return [...data].sort((a, b) => {
      if (sortBy === 'scoreDesc') return b.score - a.score;
      if (sortBy === 'scoreAsc') return a.score - b.score;
      if (sortBy === 'symbol') return a.cleanSymbol.localeCompare(b.cleanSymbol);
      return b.score - a.score;
    });
  }, [tokensList, searchTerm, scoreFilter, sortBy]);

  const totalPages = Math.ceil(filteredTokens.length / pageSize) || 1;
  const paginatedTokens = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTokens.slice(start, start + pageSize);
  }, [filteredTokens, page]);

  return (
    <div style={{
      background: 'rgba(10,15,25,0.95)',
      border: '1px solid rgba(0,255,136,0.35)',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {/* HEADER & CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Trophy size={34} color="#facc15" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', background: 'linear-gradient(90deg, #facc15, #00ff88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CLASSEMENT DES PERFORMANCES DU TOP 500 BYBIT SPOT (SCORE EXACT MULTI-TF) 🏆
            </h2>
            <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.85rem' }}>
              Cliquez sur n'importe quel token pour afficher ses <span style={{ color: '#00ff88', fontWeight: 'bold' }}>3 graphiques directement sur cette même page !</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadTop500Performance()}
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #00ff88 100%)',
              color: '#000',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '10px',
              fontWeight: '900',
              fontSize: '0.85rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 0 20px rgba(250,204,21,0.4)',
            }}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            {isLoading ? 'CALCUL DU CLASSEMENT...' : 'RAFRAÎCHIR CLASSEMENT TOP 500'}
          </button>
        </div>
      </div>

      {/* ── INLINE CHARTS DISPLAYED RIGHT HERE ON THE SAME PAGE ── */}
      {selectedTokenChart && (
        <div style={{
          background: 'rgba(5,10,15,0.95)',
          borderRadius: '16px',
          border: '2px solid #00ff88',
          padding: '20px',
          boxShadow: '0 0 30px rgba(0,255,136,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Zap size={24} color="#00ff88" />
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: '900' }}>
                TRIPLE GRAPHIQUE DIRECT POUR : <span style={{ color: '#00ff88' }}>{selectedTokenChart} / USDT</span>
              </h3>
            </div>
            <button
              onClick={() => setSelectedTokenChart(null)}
              style={{
                background: 'rgba(255,51,102,0.2)',
                color: '#ff3366',
                border: '1px solid #ff3366',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: '900',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <X size={16} /> FERMER LE GRAPHIQUE
            </button>
          </div>

          {/* RENDER THE 3 CHARTS RIGHT HERE ON THIS PAGE! */}
          <SolScoreCandleChart key={selectedTokenChart} initialSymbol={selectedTokenChart} />
        </div>
      )}

      {/* FILTER STRIP & SEARCH */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', background: 'rgba(5,10,15,0.8)', padding: '14px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={16} color="#00ff88" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Rechercher un token (ex: BICO, WLD, NYM)..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(0,255,136,0.3)',
              color: '#fff',
              padding: '8px 14px 8px 36px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              outline: 'none',
              width: '240px',
            }}
          />
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 'bold' }}>Score :</span>
          <button
            onClick={() => { setScoreFilter('all'); setPage(1); }}
            style={{
              background: scoreFilter === 'all' ? '#00ff88' : 'rgba(255,255,255,0.05)',
              color: scoreFilter === 'all' ? '#000' : '#888',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Tous ({tokensList.length})
          </button>
          <button
            onClick={() => { setScoreFilter('positive'); setPage(1); }}
            style={{
              background: scoreFilter === 'positive' ? '#00ff88' : 'rgba(255,255,255,0.05)',
              color: scoreFilter === 'positive' ? '#000' : '#888',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            🟢 Score Positif &gt; 0 ({tokensList.filter(t => t.score >= 0).length})
          </button>
          <button
            onClick={() => { setScoreFilter('negative'); setPage(1); }}
            style={{
              background: scoreFilter === 'negative' ? '#ff3366' : 'rgba(255,255,255,0.05)',
              color: scoreFilter === 'negative' ? '#fff' : '#888',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            🔴 Score Négatif &lt; 0 ({tokensList.filter(t => t.score < 0).length})
          </button>
        </div>

        {/* Sort Select */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 'bold' }}>Trier par :</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(250,204,21,0.4)',
              color: '#facc15',
              padding: '6px 12px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="scoreDesc">🏆 Du Meilleur au Plus Bas Score</option>
            <option value="scoreAsc">🔻 Du Plus Bas au Meilleur Score</option>
            <option value="symbol">🔤 Ordre Alphabétique (A-Z)</option>
          </select>
        </div>
      </div>

      {/* LEADERBOARD TABLE */}
      <div style={{ background: 'rgba(5,10,15,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
        {isLoading ? (
          <div style={{ color: '#00ff88', fontWeight: '900', padding: '40px', textAlign: 'center', fontSize: '1.1rem' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '10px' }} />
            <div>{progressMsg}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                  <th style={{ padding: '12px' }}>Rang</th>
                  <th style={{ padding: '12px' }}>Token</th>
                  <th style={{ padding: '12px' }}>Prix USDT ($)</th>
                  <th style={{ padding: '12px' }}>Ratio TOKEN/SOL</th>
                  <th style={{ padding: '12px' }}>Perf Ratio 15m</th>
                  <th style={{ padding: '12px' }}>Score SOL (Pondéré)</th>
                  <th style={{ padding: '12px' }}>Statut Force Relative</th>
                  <th style={{ padding: '12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTokens.map((t, idx) => {
                  const globalRank = (page - 1) * pageSize + idx + 1;
                  const isTop3 = globalRank <= 3;
                  const rankBadge = globalRank === 1 ? '🥇 #1' : globalRank === 2 ? '🥈 #2' : globalRank === 3 ? '🥉 #3' : `#${globalRank}`;
                  const isSelected = selectedTokenChart === t.cleanSymbol;

                  return (
                    <tr
                      key={t.symbol}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isSelected ? 'rgba(0,255,136,0.15)' : isTop3 ? 'rgba(250,204,21,0.06)' : t.score >= 0 ? 'rgba(0,255,136,0.03)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: '900', color: isTop3 ? '#facc15' : '#9ca3af', fontSize: isTop3 ? '1rem' : '0.88rem' }}>
                        {rankBadge}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '900', color: '#fff', fontSize: '1rem' }}>
                        {t.cleanSymbol} <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>/ USDT</span>
                      </td>
                      <td style={{ padding: '12px', color: '#00d2ff', fontWeight: 'bold' }}>
                        ${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(4)}
                      </td>
                      <td style={{ padding: '12px', color: '#facc15', fontWeight: 'bold' }}>
                        {t.curRatio.toFixed(6)}
                      </td>
                      <td style={{ padding: '12px', color: t.ratioPerf15m >= 0 ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {t.ratioPerf15m >= 0 ? '+' : ''}{t.ratioPerf15m.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px', fontWeight: '900', fontSize: '1.05rem', color: t.score >= 10 ? '#00ff88' : t.score >= 0 ? '#facc15' : '#ff3366' }}>
                        {t.score >= 0 ? '+' : ''}{t.score.toFixed(1)} pts
                      </td>
                      <td style={{ padding: '12px' }}>
                        {t.score >= 10 ? (
                          <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(0,255,136,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #00ff88' }}>
                            🔥 CONFLUENCE TOTALE (10+ pts)
                          </span>
                        ) : t.score >= 0 ? (
                          <span style={{ color: '#facc15', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(250,204,21,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #facc15' }}>
                            🟢 SURPERFORMANCE TOKEN &gt;= SOL
                          </span>
                        ) : (
                          <span style={{ color: '#ff3366', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(255,51,102,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #ff3366' }}>
                            🔴 SOUS-PERFORMANCE TOKEN &lt; SOL
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTokenChart(null);
                            } else {
                              setSelectedTokenChart(t.cleanSymbol);
                            }
                          }}
                          style={{
                            background: isSelected ? '#00ff88' : 'rgba(0,255,136,0.12)',
                            color: isSelected ? '#000' : '#00ff88',
                            border: '1px solid #00ff88',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontWeight: '900',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 0 15px rgba(0,255,136,0.5)' : 'none',
                          }}
                        >
                          {isSelected ? '❌ FERMER CHARTE' : '📈 VOIR CHARTE DIRECTE'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {!isLoading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>
              Affichage de {((page - 1) * pageSize) + 1} à {Math.min(page * pageSize, filteredTokens.length)} sur {filteredTokens.length} tokens
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: page === 1 ? '#444' : '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ChevronLeft size={16} /> Précédent
              </button>
              <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.85rem' }}>
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: page === totalPages ? '#444' : '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Suivant <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Top500TokensPerformance;
