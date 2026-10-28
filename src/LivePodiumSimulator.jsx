import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, RefreshCw, Trash2, Settings, TrendingUp, TrendingDown, ShieldCheck, DollarSign, Clock, Flame, Award, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

const STORAGE_KEY = 'nebula_live_podium_simulator_v2';

export const LivePodiumSimulator = ({ tokensList = [], onSelectToken }) => {
  // 1. Load initial state from localStorage
  const [positions, setPositions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.positions || [];
      }
    } catch (e) {
      console.error("Error reading simulator storage:", e);
    }
    return [];
  });

  const [isRunning, setIsRunning] = useState(true);
  const [autoExitOnDrop, setAutoExitOnDrop] = useState(false); // Default: keep active until manual close or TP/SL
  const [tpPct, setTpPct] = useState(20);
  const [slPct, setSlPct] = useState(10);
  const [useTpSl, setUseTpSl] = useState(false);
  const [solPrice, setSolPrice] = useState(150); // Default SOL price in USD
  const [lastTickTime, setLastTickTime] = useState(Date.now());

  // Save to localStorage whenever positions change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        positions,
        updatedAt: Date.now()
      }));
    } catch (e) {
      console.error("Error saving simulator storage:", e);
    }
  }, [positions]);

  // Extract current SOL price from tokensList if available
  useEffect(() => {
    const solToken = tokensList.find(t => t.cleanSymbol === 'SOL');
    if (solToken && solToken.price > 0) {
      setSolPrice(solToken.price);
    }
  }, [tokensList]);

  // 2. REAL-TIME SECOND-BY-SECOND LIVE ENGINE
  useEffect(() => {
    if (!isRunning || !tokensList || tokensList.length === 0) return;

    setLastTickTime(Date.now());

    // Extract current Top 3 positive tokens sorted by score
    const positiveTokens = tokensList
      .filter(t => t.score >= 0.0)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const top3 = positiveTokens.slice(0, 3);
    if (top3.length === 0) return;

    const now = Date.now();
    const dateStr = new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date(now).toLocaleDateString('fr-FR');

    setPositions(prevPositions => {
      let updated = [...prevPositions];
      let hasChanges = false;

      // A. AUTO-ENTRY FOR NEW TOP 3 TOKENS
      top3.forEach((token, idx) => {
        const rank = idx + 1; // 1, 2, 3
        const sym = token.cleanSymbol;
        const currentPrice = token.price || token.lastPrice || 0;

        if (currentPrice <= 0) return;

        // Check if token already has an open position
        const existingOpen = updated.find(p => p.cleanSymbol === sym && p.status === 'OPEN');
        if (!existingOpen) {
          // Open new 1 SOL trade!
          const newPos = {
            id: `${sym}_${now}`,
            symbol: token.symbol,
            cleanSymbol: sym,
            entryRank: rank,
            entryPrice: currentPrice,
            entryTime: now,
            entryDateStr: dateStr,
            solAmount: 1.0,
            status: 'OPEN',
            exitPrice: null,
            exitTime: null,
            exitDateStr: null,
            realizedPnlPct: null,
            realizedPnlUsd: null,
          };
          updated.unshift(newPos);
          hasChanges = true;
        }
      });

      // B. AUTO-MANAGEMENT (TP/SL or Drop Exit)
      const top3SymbolsSet = new Set(top3.map(t => t.cleanSymbol));

      updated = updated.map(pos => {
        if (pos.status !== 'OPEN') return pos;

        const liveTok = tokensList.find(t => t.cleanSymbol === pos.cleanSymbol);
        const curPrice = liveTok?.price || liveTok?.lastPrice || pos.entryPrice;
        const pnlPct = ((curPrice - pos.entryPrice) / pos.entryPrice) * 100;

        let shouldClose = false;
        let closeReason = '';

        if (useTpSl) {
          if (pnlPct >= tpPct) { shouldClose = true; closeReason = `TP (+${pnlPct.toFixed(1)}%)`; }
          if (pnlPct <= -slPct) { shouldClose = true; closeReason = `SL (${pnlPct.toFixed(1)}%)`; }
        }

        if (autoExitOnDrop && !top3SymbolsSet.has(pos.cleanSymbol)) {
          shouldClose = true;
          closeReason = 'Sortie Top 3';
        }

        if (shouldClose) {
          hasChanges = true;
          const pnlUsd = (pos.solAmount * solPrice) * (pnlPct / 100);
          return {
            ...pos,
            status: 'CLOSED',
            exitPrice: curPrice,
            exitTime: now,
            exitDateStr: dateStr,
            realizedPnlPct: parseFloat(pnlPct.toFixed(2)),
            realizedPnlUsd: parseFloat(pnlUsd.toFixed(2)),
            closeReason,
          };
        }

        return pos;
      });

      return hasChanges ? updated : prevPositions;
    });
  }, [tokensList, isRunning, autoExitOnDrop, useTpSl, tpPct, slPct, solPrice]);

  // Manual Position Close Helper
  const handleClosePosition = (id) => {
    const now = Date.now();
    const dateStr = new Date(now).toLocaleTimeString('fr-FR') + ' ' + new Date(now).toLocaleDateString('fr-FR');

    setPositions(prev => prev.map(pos => {
      if (pos.id !== id || pos.status !== 'OPEN') return pos;
      const liveTok = tokensList.find(t => t.cleanSymbol === pos.cleanSymbol);
      const curPrice = liveTok?.price || liveTok?.lastPrice || pos.entryPrice;
      const pnlPct = ((curPrice - pos.entryPrice) / pos.entryPrice) * 100;
      const pnlUsd = (pos.solAmount * solPrice) * (pnlPct / 100);

      return {
        ...pos,
        status: 'CLOSED',
        exitPrice: curPrice,
        exitTime: now,
        exitDateStr: dateStr,
        realizedPnlPct: parseFloat(pnlPct.toFixed(2)),
        realizedPnlUsd: parseFloat(pnlUsd.toFixed(2)),
        closeReason: 'Fermeture Manuelle',
      };
    }));
  };

  // Reset All Simulation Data
  const handleReset = () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser l'historique et vider la simulation ?")) {
      setPositions([]);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }
  };

  // Compute Live Statistics
  const openPositions = useMemo(() => positions.filter(p => p.status === 'OPEN'), [positions]);
  const closedPositions = useMemo(() => positions.filter(p => p.status === 'CLOSED'), [positions]);

  const stats = useMemo(() => {
    let openPnlUsd = 0;
    let openPnlPctSum = 0;

    openPositions.forEach(pos => {
      const liveTok = tokensList.find(t => t.cleanSymbol === pos.cleanSymbol);
      const curPrice = liveTok?.price || liveTok?.lastPrice || pos.entryPrice;
      const pnlPct = ((curPrice - pos.entryPrice) / pos.entryPrice) * 100;
      const pnlUsd = (pos.solAmount * solPrice) * (pnlPct / 100);
      openPnlUsd += pnlUsd;
      openPnlPctSum += pnlPct;
    });

    let closedPnlUsd = 0;
    let winsCount = 0;
    let lossesCount = 0;

    closedPositions.forEach(pos => {
      closedPnlUsd += (pos.realizedPnlUsd || 0);
      if ((pos.realizedPnlPct || 0) >= 0) winsCount++;
      else lossesCount++;
    });

    const totalPnlUsd = openPnlUsd + closedPnlUsd;
    const totalPnlSol = solPrice > 0 ? (totalPnlUsd / solPrice) : 0;
    const winRate = (winsCount + lossesCount) > 0 ? Math.round((winsCount / (winsCount + lossesCount)) * 100) : 0;

    return {
      openPnlUsd,
      openPnlPctAvg: openPositions.length > 0 ? (openPnlPctSum / openPositions.length) : 0,
      closedPnlUsd,
      totalPnlUsd,
      totalPnlSol,
      winRate,
      winsCount,
      lossesCount,
      totalTrades: positions.length,
    };
  }, [positions, openPositions, closedPositions, tokensList, solPrice]);

  return (
    <div style={{
      background: 'rgba(8,14,24,0.95)',
      border: '2px solid rgba(0,255,136,0.4)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 0 35px rgba(0,255,136,0.15)',
      margin: '25px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* TOP BANNER & LIVE CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Flame size={28} color="#00ff88" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: '900' }}>
                ⚡ SIMULATEUR TEMPS RÉEL (ENTRÉE AUTOMATIQUE 1 SOL SUR PODIUM #1, #2, #3)
              </h2>
              <span style={{
                background: isRunning ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)',
                color: isRunning ? '#00ff88' : '#ff3366',
                border: `1px solid ${isRunning ? '#00ff88' : '#ff3366'}`,
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isRunning ? '#00ff88' : '#ff3366', animation: isRunning ? 'pulse 1s infinite' : 'none' }}></span>
                {isRunning ? 'LIVE 1s ENGINE ACTIF' : 'EN PAUSE'}
              </span>
            </div>
            <span style={{ color: '#888', fontSize: '0.8rem' }}>
              Sauvegarde persistante dans le navigateur : Vos entrées, dates et prix restent 100% conservés même après fermeture du site !
            </span>
          </div>
        </div>

        {/* CONTROLS */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setIsRunning(!isRunning)}
            style={{
              background: isRunning ? 'rgba(255,255,255,0.08)' : '#00ff88',
              color: isRunning ? '#fff' : '#000',
              border: `1px solid ${isRunning ? 'rgba(255,255,255,0.2)' : '#00ff88'}`,
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: '900',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? 'Mettre en Pause' : 'Activer Simulation'}
          </button>

          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255,51,102,0.15)',
              color: '#ff3366',
              border: '1px solid rgba(255,51,102,0.4)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trash2 size={16} /> Réinitialiser
          </button>
        </div>
      </div>

      {/* LIVE PNL METRICS DISPLAY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {/* TOTAL PNL */}
        <div style={{
          background: 'rgba(0,0,0,0.6)',
          border: `2px solid ${stats.totalPnlUsd >= 0 ? 'rgba(0,255,136,0.6)' : 'rgba(255,51,102,0.6)'}`,
          borderRadius: '12px',
          padding: '14px',
          boxShadow: stats.totalPnlUsd >= 0 ? '0 0 20px rgba(0,255,136,0.15)' : '0 0 20px rgba(255,51,102,0.15)',
        }}>
          <div style={{ color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>PNL TOTAL CUMULÉ</div>
          <div style={{ color: stats.totalPnlUsd >= 0 ? '#00ff88' : '#ff3366', fontSize: '1.4rem', fontWeight: '900', marginTop: '2px' }}>
            {stats.totalPnlUsd >= 0 ? '+' : ''}${stats.totalPnlUsd.toFixed(2)} USD
          </div>
          <div style={{ color: stats.totalPnlSol >= 0 ? '#00ff88' : '#ff3366', fontSize: '0.85rem', fontWeight: 'bold' }}>
            {stats.totalPnlSol >= 0 ? '+' : ''}{stats.totalPnlSol.toFixed(3)} SOL
          </div>
        </div>

        {/* OPEN PNL */}
        <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>POSITIONS ACTIVES ({openPositions.length})</div>
          <div style={{ color: stats.openPnlUsd >= 0 ? '#00ff88' : '#ff3366', fontSize: '1.25rem', fontWeight: '900', marginTop: '2px' }}>
            {stats.openPnlUsd >= 0 ? '+' : ''}${stats.openPnlUsd.toFixed(2)} USD
          </div>
          <div style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>
            Moy. Latente : {stats.openPnlPctAvg >= 0 ? '+' : ''}{stats.openPnlPctAvg.toFixed(1)}%
          </div>
        </div>

        {/* WIN RATE */}
        <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>TAUX DE RÉUSSITE (WIN RATE)</div>
          <div style={{ color: '#facc15', fontSize: '1.25rem', fontWeight: '900', marginTop: '2px' }}>
            {stats.winRate}%
          </div>
          <div style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>
            🟢 {stats.winsCount} Gagnants | 🔴 {stats.lossesCount} Perdants
          </div>
        </div>

        {/* TOTAL TRADES */}
        <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>TRADES ENREGISTRÉS</div>
          <div style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '900', marginTop: '2px' }}>
            {stats.totalTrades} Positions
          </div>
          <div style={{ color: '#00ff88', fontSize: '0.78rem', fontWeight: 'bold' }}>
            💾 Sauvegardé en Local
          </div>
        </div>
      </div>

      {/* TABLE 1: OPEN ACTIVE POSITIONS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Flame size={18} color="#00ff88" /> POSITIONS ACTIVES EN DIRECT ({openPositions.length}) - SUIVI SECONDE PAR SECONDE
        </h3>

        {openPositions.length === 0 ? (
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '10px', color: '#888', textAlign: 'center', fontWeight: 'bold', fontSize: '0.88rem' }}>
            Aucune position active pour le moment. Dès qu'un token entrera en Position #1, #2 ou #3, une entrée de 1 SOL sera exécutée automatiquement !
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,255,136,0.1)', borderBottom: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>TOKEN</th>
                  <th style={{ padding: '10px' }}>RANG D'ENTRÉE</th>
                  <th style={{ padding: '10px' }}>DATE & HEURE ENTRÉE</th>
                  <th style={{ padding: '10px' }}>PRIX ENTRÉE</th>
                  <th style={{ padding: '10px' }}>PRIX ACTUEL (1s)</th>
                  <th style={{ padding: '10px' }}>PNL LIVE (%)</th>
                  <th style={{ padding: '10px' }}>PNL LIVE ($)</th>
                  <th style={{ padding: '10px' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((pos) => {
                  const liveTok = tokensList.find(t => t.cleanSymbol === pos.cleanSymbol);
                  const curPrice = liveTok?.price || liveTok?.lastPrice || pos.entryPrice;
                  const pnlPct = ((curPrice - pos.entryPrice) / pos.entryPrice) * 100;
                  const pnlUsd = (pos.solAmount * solPrice) * (pnlPct / 100);
                  const rankBadge = pos.entryRank === 1 ? '🥇 #1' : pos.entryRank === 2 ? '🥈 #2' : '🥉 #3';

                  return (
                    <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)' }}>
                      <td style={{ padding: '10px', fontWeight: '900', color: '#00ff88', cursor: 'pointer' }} onClick={() => onSelectToken && onSelectToken(pos.cleanSymbol)}>
                        {pos.cleanSymbol}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>
                        <span style={{ background: pos.entryRank === 1 ? '#facc15' : pos.entryRank === 2 ? '#e2e8f0' : '#cd7f32', color: '#000', padding: '2px 8px', borderRadius: '6px', fontWeight: '900', fontSize: '0.75rem' }}>
                          {rankBadge}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: '#aaa', fontSize: '0.78rem' }}>{pos.entryDateStr}</td>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>${pos.entryPrice.toFixed(4)}</td>
                      <td style={{ padding: '10px', fontWeight: 'bold', color: '#facc15' }}>${curPrice.toFixed(4)}</td>
                      <td style={{ padding: '10px', fontWeight: '900', color: pnlPct >= 0 ? '#00ff88' : '#ff3366' }}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                      </td>
                      <td style={{ padding: '10px', fontWeight: '900', color: pnlUsd >= 0 ? '#00ff88' : '#ff3366' }}>
                        {pnlUsd >= 0 ? '+' : ''}${pnlUsd.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button
                          onClick={() => handleClosePosition(pos.id)}
                          style={{
                            background: 'rgba(255,51,102,0.2)',
                            color: '#ff3366',
                            border: '1px solid #ff3366',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                          }}
                        >
                          Fermer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TABLE 2: CLOSED TRADES LOG (PERSISTED HISTORY) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} color="#facc15" /> HISTORIQUE DES POSITIONS CLÔTURÉES & ENREGISTRÉES ({closedPositions.length})
        </h3>

        {closedPositions.length === 0 ? (
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '10px', color: '#666', textAlign: 'center', fontSize: '0.82rem' }}>
            Aucun trade clôturé pour le moment.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#aaa', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>TOKEN</th>
                  <th style={{ padding: '8px' }}>ENTRÉE</th>
                  <th style={{ padding: '8px' }}>DATE ENTRÉE</th>
                  <th style={{ padding: '8px' }}>PRIX ENTRÉE</th>
                  <th style={{ padding: '8px' }}>PRIX SORTIE</th>
                  <th style={{ padding: '8px' }}>DATE SORTIE</th>
                  <th style={{ padding: '8px' }}>PNL REALISÉ (%)</th>
                  <th style={{ padding: '8px' }}>PNL REALISÉ ($)</th>
                  <th style={{ padding: '8px' }}>RAISON</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((pos) => {
                  const isWin = (pos.realizedPnlPct || 0) >= 0;
                  const rankBadge = pos.entryRank === 1 ? '🥇 #1' : pos.entryRank === 2 ? '🥈 #2' : '🥉 #3';

                  return (
                    <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{pos.cleanSymbol}</td>
                      <td style={{ padding: '8px' }}>{rankBadge}</td>
                      <td style={{ padding: '8px', color: '#888', fontSize: '0.75rem' }}>{pos.entryDateStr}</td>
                      <td style={{ padding: '8px' }}>${pos.entryPrice.toFixed(4)}</td>
                      <td style={{ padding: '8px' }}>${(pos.exitPrice || 0).toFixed(4)}</td>
                      <td style={{ padding: '8px', color: '#888', fontSize: '0.75rem' }}>{pos.exitDateStr}</td>
                      <td style={{ padding: '8px', fontWeight: '900', color: isWin ? '#00ff88' : '#ff3366' }}>
                        {isWin ? '+' : ''}{pos.realizedPnlPct}%
                      </td>
                      <td style={{ padding: '8px', fontWeight: '900', color: isWin ? '#00ff88' : '#ff3366' }}>
                        {isWin ? '+' : ''}${pos.realizedPnlUsd}
                      </td>
                      <td style={{ padding: '8px', color: '#aaa', fontSize: '0.75rem' }}>{pos.closeReason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePodiumSimulator;
