import React, { useMemo, useState } from 'react';
import { Trophy, Award, TrendingUp, Zap, Clock, ShieldCheck, Flame, ChevronRight, BarChart2 } from 'lucide-react';

export const Top3WeeklyChampions = ({ tokensList = [], onSelectToken }) => {
  const [selectedRankFilter, setSelectedRankFilter] = useState('all'); // 'all', '1', '2', '3'
  const [sortBy, setSortBy] = useState('maxReturn'); // 'maxReturn', 'timeInTop3', 'currentReturn'

  // Reconstruct 7-Day Podium History for Bybit Spot Tokens
  const championsData = useMemo(() => {
    if (!tokensList || tokensList.length === 0) return { champions: [], totalUnique: 0, avgPeakGain: 0, topGainer: null };

    const nowSec = Math.floor(Date.now() / 1000);
    const sevenDaysSec = 7 * 86400;
    const startTs = nowSec - sevenDaysSec;

    // 1. Gather all tokens with valid historical ratioSeries
    const validTokens = tokensList.filter(t => t.ratioSeries && t.ratioSeries.length >= 20);
    if (validTokens.length === 0) return { champions: [], totalUnique: 0, avgPeakGain: 0, topGainer: null };

    // 2. Find common time points over the last 7 days
    let timePointsMap = {};
    validTokens.forEach(t => {
      t.ratioSeries.forEach(item => {
        const time = typeof item === 'object' ? item.time : null;
        if (time && time >= startTs) {
          timePointsMap[time] = true;
        }
      });
    });

    const timePoints = Object.keys(timePointsMap).map(Number).sort((a, b) => a - b);
    if (timePoints.length < 5) return { champions: [], totalUnique: 0, avgPeakGain: 0, topGainer: null };

    // 3. For each timestamp, calculate percentage change relative to 7D start ratio
    const tokenCurvesMap = {};
    const tokenStartRatios = {};

    validTokens.forEach(token => {
      const rSeries = token.ratioSeries;
      let startIdx = rSeries.findIndex(item => (typeof item === 'object' ? item.time : 0) >= startTs);
      if (startIdx < 0 || startIdx >= rSeries.length) startIdx = Math.max(0, rSeries.length - 168);

      const startObj = rSeries[startIdx] || rSeries[0];
      const startRatio = typeof startObj === 'object' ? startObj.close : startObj;
      if (!startRatio || startRatio <= 0 || isNaN(startRatio)) return;

      tokenStartRatios[token.cleanSymbol] = startRatio;
      const curveMap = {};

      for (let i = startIdx; i < rSeries.length; i++) {
        const item = rSeries[i];
        const val = typeof item === 'object' ? item.close : item;
        const t   = typeof item === 'object' ? item.time : null;
        if (t) {
          const pct = ((val - startRatio) / startRatio) * 100;
          curveMap[t] = pct;
        }
      }
      tokenCurvesMap[token.cleanSymbol] = curveMap;
    });

    // 4. Track Top 3 positions at each timestamp
    const tokenStats = {};

    timePoints.forEach(t => {
      // Calculate performance of all tokens at timestamp t
      const perfList = [];
      validTokens.forEach(token => {
        const sym = token.cleanSymbol;
        const cMap = tokenCurvesMap[sym];
        if (cMap && cMap[t] !== undefined) {
          perfList.push({ symbol: sym, token, perf: cMap[t] });
        }
      });

      // Sort by performance descending
      perfList.sort((a, b) => b.perf - a.perf);

      // Top 3 tokens at this timestamp
      for (let rank = 1; rank <= Math.min(3, perfList.length); rank++) {
        const item = perfList[rank - 1];
        const sym = item.symbol;

        if (!tokenStats[sym]) {
          tokenStats[sym] = {
            token: item.token,
            cleanSymbol: sym,
            bestRank: rank,
            countRank1: 0,
            countRank2: 0,
            countRank3: 0,
            totalTop3Candles: 0,
            firstTop3Time: t,
            entryPerf: item.perf,
            maxPerf: item.perf,
            latestPerf: item.perf,
          };
        }

        const stat = tokenStats[sym];
        stat.bestRank = Math.min(stat.bestRank, rank);
        if (rank === 1) stat.countRank1++;
        if (rank === 2) stat.countRank2++;
        if (rank === 3) stat.countRank3++;
        stat.totalTop3Candles++;

        // Track max perf since entering Top 3
        if (item.perf > stat.maxPerf) stat.maxPerf = item.perf;
        stat.latestPerf = item.perf;
      }
    });

    // Convert stats to array
    const championsList = Object.values(tokenStats).map(stat => {
      // Calculate gain since entering Top 3
      const gainSinceEntry = stat.maxPerf - stat.entryPerf;
      const hoursInTop3 = Math.round((stat.totalTop3Candles * 15) / 60); // 15m candles to hours

      return {
        ...stat,
        gainSinceEntry,
        hoursInTop3,
        timePct: Math.round((stat.totalTop3Candles / timePoints.length) * 100),
      };
    });

    // Sort champions based on active filter
    const totalUnique = championsList.length;
    const avgPeakGain = championsList.length > 0
      ? championsList.reduce((acc, c) => acc + c.maxPerf, 0) / championsList.length
      : 0;

    let topGainer = null;
    if (championsList.length > 0) {
      topGainer = [...championsList].sort((a, b) => b.maxPerf - a.maxPerf)[0];
    }

    return { champions: championsList, totalUnique, avgPeakGain, topGainer };
  }, [tokensList]);

  // Filter & Sort Champions
  const filteredChampions = useMemo(() => {
    let list = [...championsData.champions];

    if (selectedRankFilter === '1') list = list.filter(c => c.bestRank === 1);
    if (selectedRankFilter === '2') list = list.filter(c => c.bestRank <= 2);
    if (selectedRankFilter === '3') list = list.filter(c => c.bestRank <= 3);

    if (sortBy === 'maxReturn') {
      list.sort((a, b) => b.maxPerf - a.maxPerf);
    } else if (sortBy === 'timeInTop3') {
      list.sort((a, b) => b.totalTop3Candles - a.totalTop3Candles);
    } else if (sortBy === 'currentReturn') {
      list.sort((a, b) => b.latestPerf - a.latestPerf);
    }

    return list;
  }, [championsData.champions, selectedRankFilter, sortBy]);

  return (
    <div style={{
      background: 'rgba(8,14,24,0.95)',
      border: '2px solid rgba(250,204,21,0.4)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 0 35px rgba(250,204,21,0.12)',
      margin: '25px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* HEADER & BADGES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Trophy size={28} color="#facc15" />
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: '900', letterSpacing: '0.5px' }}>
              🏆 TOKENS CHAMPIONS DE LA SEMAINE (PODIUM POSITIONS #1, #2, #3 ON BYBIT SPOT)
            </h2>
            <span style={{ color: '#888', fontSize: '0.8rem' }}>
              Analyse historique des 7 derniers jours : Tous les tokens ayant occupé le Top 3 du tableau Bybit Spot
            </span>
          </div>
        </div>

        {/* SUMMARY BADGES */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid #facc15', padding: '6px 14px', borderRadius: '10px', color: '#facc15', fontWeight: '900', fontSize: '0.85rem' }}>
            👑 {championsData.totalUnique} Tokens au Top 3 Cette Semaine
          </div>
          <div style={{ background: 'rgba(0,255,136,0.12)', border: '1px solid #00ff88', padding: '6px 14px', borderRadius: '10px', color: '#00ff88', fontWeight: '900', fontSize: '0.85rem' }}>
            🚀 Peak Moyen : +{championsData.avgPeakGain.toFixed(1)}%
          </div>
          {championsData.topGainer && (
            <div style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid #a855f7', padding: '6px 14px', borderRadius: '10px', color: '#a855f7', fontWeight: '900', fontSize: '0.85rem' }}>
              🔥 Max Gainer : {championsData.topGainer.cleanSymbol} (+{championsData.topGainer.maxPerf.toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {/* FILTERS AND SORT BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', background: 'rgba(0,0,0,0.5)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Filter by Best Rank */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>FILTRER PAR MEILLEURE POSITION :</span>
          {[
            { id: 'all', label: 'Tous les Top 3 (#1, #2, #3)' },
            { id: '1',   label: '🥇 Médaille d\'Or (#1 Uniquement)' },
            { id: '2',   label: '🥇+🥈 Top 2 (#1 & #2)' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedRankFilter(f.id)}
              style={{
                background: selectedRankFilter === f.id ? '#facc15' : 'transparent',
                color: selectedRankFilter === f.id ? '#000' : '#888',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: '900',
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>TRIER PAR :</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            <option value="maxReturn">🚀 Gain Max Atteint (%)</option>
            <option value="timeInTop3">⏱️ Temps Total au Top 3 (Heures)</option>
            <option value="currentReturn">📈 Rendement Actuel (%)</option>
          </select>
        </div>
      </div>

      {/* CHAMPIONS GRID / CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
        {filteredChampions.map((c, idx) => {
          const isGold = c.bestRank === 1;
          const isSilver = c.bestRank === 2;
          const badgeColor = isGold ? '#facc15' : isSilver ? '#e2e8f0' : '#cd7f32';
          const badgeIcon = isGold ? '🥇' : isSilver ? '🥈' : '🥉';

          return (
            <div
              key={c.cleanSymbol}
              onClick={() => onSelectToken && onSelectToken(c.cleanSymbol)}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: `2px solid ${isGold ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                cursor: 'pointer',
                transition: 'transform 0.2s, boxShadow 0.2s',
                boxShadow: isGold ? '0 0 20px rgba(250,204,21,0.15)' : 'none',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {/* CARD HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: badgeColor, color: '#000', padding: '4px 10px', borderRadius: '8px', fontWeight: '900', fontSize: '0.9rem', boxShadow: `0 0 10px ${badgeColor}66` }}>
                    #{c.bestRank}
                  </span>
                  <div>
                    <h4 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: '900' }}>
                      {c.cleanSymbol}
                    </h4>
                    <span style={{ color: badgeColor, fontSize: '0.72rem', fontWeight: 'bold' }}>
                      MEILLEUR RANG SUR 7J
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#00ff88', fontSize: '1.15rem', fontWeight: '900' }}>
                    +{c.maxPerf.toFixed(1)}%
                  </span>
                  <div style={{ color: '#888', fontSize: '0.68rem' }}>PEAK SUR 7J</div>
                </div>
              </div>

              {/* STATS BREAKDOWN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold' }}>TEMPS AU TOP 3</div>
                  <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} color="#facc15" /> ~{c.hoursInTop3}h ({c.timePct}%)
                  </div>
                </div>

                <div>
                  <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold' }}>DÉTAIL POSITIONS</div>
                  <div style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ color: '#facc15' }}>#1: {c.countRank1}x</span> | <span style={{ color: '#e2e8f0' }}>#2: {c.countRank2}x</span> | <span style={{ color: '#cd7f32' }}>#3: {c.countRank3}x</span>
                  </div>
                </div>
              </div>

              {/* GAIN SINCE ENTRY & CURRENT STATUS */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                <div style={{ color: c.latestPerf >= 0 ? '#00ff88' : '#ff3366', fontSize: '0.8rem', fontWeight: '900' }}>
                  Actuel : {c.latestPerf >= 0 ? '+' : ''}{c.latestPerf.toFixed(1)}%
                </div>
                <div style={{ color: '#facc15', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  ISOLER <ChevronRight size={14} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Top3WeeklyChampions;
