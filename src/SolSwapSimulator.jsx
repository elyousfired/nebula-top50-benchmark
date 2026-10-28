import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, RefreshCw, Trash2, CheckCircle2, XCircle, Clock, Zap, ArrowUpRight, TrendingUp, DollarSign, Wallet, ShieldAlert, Award, Calendar, Layers } from 'lucide-react';

const STORAGE_KEY = 'nebula_sol_swaps_history_v2';

export const SolSwapSimulator = ({ exceptionalTokens = [], tokensList = [] }) => {
  const [swaps, setSwaps] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [autoExecute, setAutoExecute] = useState(true);
  const [initialCapital, setInitialCapital] = useState(10.0); // 10 SOL starting capital
  const [livePrices, setLivePrices] = useState({});

  // Save swaps to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(swaps));
    } catch (_) {}
  }, [swaps]);

  // Combine parent tokensList price map with live fast 1-second price ticks
  const priceMap = useMemo(() => {
    const map = {};
    tokensList.forEach(t => {
      map[t.cleanSymbol] = t.price;
    });
    Object.assign(map, livePrices);
    return map;
  }, [tokensList, livePrices]);

  // ── HIGH FREQUENCY 1-SECOND TICKER LOOP: SUIVI SCAN EN DIRECT CHAQUE SECONDE ──
  useEffect(() => {
    const openSwaps = swaps.filter(s => s.status === 'OPEN');
    if (openSwaps.length === 0) return;

    const intervalId = setInterval(async () => {
      try {
        const symbolsToFetch = Array.from(new Set(openSwaps.map(s => `${s.cleanSymbol}USDT`)));
        const pricePromises = symbolsToFetch.map(async (sym) => {
          try {
            const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${sym}`);
            if (res.ok) {
              const json = await res.json();
              if (json.result?.list?.length) {
                const lastP = parseFloat(json.result.list[0].lastPrice);
                const cleanS = sym.replace('USDT','');
                return { cleanS, lastP };
              }
            }
          } catch (_) {}
          return null;
        });

        const results = await Promise.all(pricePromises);
        const newTicks = {};
        results.forEach(r => {
          if (r && r.lastP > 0) newTicks[r.cleanS] = r.lastP;
        });

        if (Object.keys(newTicks).length > 0) {
          setLivePrices(prev => ({ ...prev, ...newTicks }));
        }
      } catch (_) {}
    }, 1000); // 1 second fast tick!

    return () => clearInterval(intervalId);
  }, [swaps]);

  // ── Auto-entry logic for exceptional tokens (1 SOL per token) ──
  useEffect(() => {
    if (!autoExecute || exceptionalTokens.length === 0) return;

    exceptionalTokens.forEach(t => {
      const symbol = t.cleanSymbol;
      const currentPrice = priceMap[symbol] || t.price;

      if (!currentPrice || currentPrice <= 0) return;

      // Check if there is already an open position for this token
      const alreadyOpen = swaps.some(s => s.status === 'OPEN' && s.cleanSymbol === symbol);
      if (alreadyOpen) return;

      const now = new Date();
      const formattedDate = now.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // Open new 1 SOL Swap Position
      const newSwap = {
        id: `swap_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`,
        cleanSymbol: symbol,
        entryPrice: currentPrice,
        entrySol: 1.0, // Exactly 1 SOL
        entryTime: now.toISOString(),
        entryDateFormatted: formattedDate,
        status: 'OPEN',
        tpPrice: currentPrice * 1.05, // +5% TP
        slPrice: currentPrice * 0.98, // -2% SL
        pnlSol: 0,
        pnlPct: 0,
        pnlUsdt: 0,
        exitPrice: null,
        exitTime: null,
        exitDateFormatted: null,
        exitReason: null,
      };

      setSwaps(prev => [newSwap, ...prev]);
    });
  }, [exceptionalTokens, autoExecute, swaps, priceMap]);

  // ── Real-Time Position Monitor: Check TP (+5%) & SL (-2%) for Open Swaps ──
  useEffect(() => {
    setSwaps(prevSwaps => {
      let updated = false;

      const nextSwaps = prevSwaps.map(swap => {
        if (swap.status !== 'OPEN') return swap;

        const livePrice = priceMap[swap.cleanSymbol];
        if (!livePrice || livePrice <= 0) return swap;

        const currentPnlPct = ((livePrice - swap.entryPrice) / swap.entryPrice) * 100;
        const now = new Date();
        const exitDateFormatted = now.toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        // Check TP: +5% gain (Triggered within 1 second)
        if (currentPnlPct >= 5.0 || livePrice >= swap.tpPrice) {
          updated = true;
          const exitPnlPct = 5.0; // Locked +5%
          const pnlSol = swap.entrySol * 0.05; // +0.05 SOL
          const pnlUsdt = (swap.entryPrice * 0.05);
          return {
            ...swap,
            status: 'CLOSED',
            exitPrice: swap.tpPrice,
            exitTime: now.toISOString(),
            exitDateFormatted,
            exitReason: 'TP_REACHED',
            pnlPct: exitPnlPct,
            pnlSol: pnlSol,
            pnlUsdt: pnlUsdt,
          };
        }

        // Check SL: -2% loss (Triggered within 1 second)
        if (currentPnlPct <= -2.0 || livePrice <= swap.slPrice) {
          updated = true;
          const exitPnlPct = -2.0; // Locked -2%
          const pnlSol = swap.entrySol * -0.02; // -0.02 SOL
          const pnlUsdt = (swap.entryPrice * -0.02);
          return {
            ...swap,
            status: 'CLOSED',
            exitPrice: swap.slPrice,
            exitTime: now.toISOString(),
            exitDateFormatted,
            exitReason: 'SL_HIT',
            pnlPct: exitPnlPct,
            pnlSol: pnlSol,
            pnlUsdt: pnlUsdt,
          };
        }

        // Update live un-closed PnL second by second
        const livePnlSol = swap.entrySol * (currentPnlPct / 100);
        const livePnlUsdt = (livePrice - swap.entryPrice);
        if (Math.abs(swap.pnlPct - currentPnlPct) > 0.001) {
          updated = true;
          return {
            ...swap,
            pnlPct: currentPnlPct,
            pnlSol: livePnlSol,
            pnlUsdt: livePnlUsdt,
          };
        }

        return swap;
      });

      return updated ? nextSwaps : prevSwaps;
    });
  }, [priceMap]);

  // ── Manual Position Closure ──
  const closeSwapManually = (swapId) => {
    const now = new Date();
    const exitDateFormatted = now.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    setSwaps(prev => prev.map(s => {
      if (s.id !== swapId || s.status !== 'OPEN') return s;
      const livePrice = priceMap[s.cleanSymbol] || s.entryPrice;
      const pnlPct = ((livePrice - s.entryPrice) / s.entryPrice) * 100;
      const pnlSol = s.entrySol * (pnlPct / 100);
      const pnlUsdt = livePrice - s.entryPrice;
      return {
        ...s,
        status: 'CLOSED',
        exitPrice: livePrice,
        exitTime: now.toISOString(),
        exitDateFormatted,
        exitReason: 'MANUAL_CLOSE',
        pnlPct,
        pnlSol,
        pnlUsdt,
      };
    }));
  };

  // ── Clear All History ──
  const clearHistory = () => {
    if (window.confirm('Voulez-vous vraiment effacer tout l\'historique des swaps ?')) {
      setSwaps([]);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }
  };

  // ── Statistics Calculations ──
  const stats = useMemo(() => {
    const closed = swaps.filter(s => s.status === 'CLOSED');
    const open = swaps.filter(s => s.status === 'OPEN');
    const wins = closed.filter(s => s.pnlPct > 0);
    const losses = closed.filter(s => s.pnlPct <= 0);

    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const totalRealizedPnlSol = closed.reduce((acc, s) => acc + s.pnlSol, 0);
    const totalUnrealizedPnlSol = open.reduce((acc, s) => acc + s.pnlSol, 0);
    const currentCapital = initialCapital + totalRealizedPnlSol + totalUnrealizedPnlSol;
    const accumulatedSolGains = totalRealizedPnlSol + totalUnrealizedPnlSol;

    return {
      totalSwaps: swaps.length,
      closedCount: closed.length,
      openCount: open.length,
      winsCount: wins.length,
      lossesCount: losses.length,
      winRate,
      realizedPnlSol: totalRealizedPnlSol,
      unrealizedPnlSol: totalUnrealizedPnlSol,
      currentCapital,
      accumulatedSolGains,
    };
  }, [swaps, initialCapital]);

  return (
    <div style={{
      background: 'rgba(8,14,24,0.95)',
      border: '2px solid rgba(250,204,21,0.4)',
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
          <Wallet size={34} color="#facc15" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', background: 'linear-gradient(90deg, #facc15, #00ff88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SIMULATEUR DE SWAP LIVE (SCAN HAUTE FRÉQUENCE 1 SECONDE) ⚡
            </h2>
            <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.85rem' }}>
              Execution 1 SOL | <span style={{ color: '#00ff88', fontWeight: 'bold' }}>TP : +5.0%</span> | <span style={{ color: '#ff3366', fontWeight: 'bold' }}>SL : -2.0%</span> | Suivi live chaque seconde avec horodatage exact & prix USDT !
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Fast Ticker Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(0,210,255,0.3)', padding: '6px 12px', borderRadius: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d2ff', animation: 'pulse 0.8s infinite' }} />
            <span style={{ color: '#00d2ff', fontSize: '0.78rem', fontWeight: '900' }}>TICKER 1s LIVE</span>
          </div>

          {/* Auto Trade Toggle */}
          <button
            onClick={() => setAutoExecute(a => !a)}
            style={{
              background: autoExecute ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
              color: autoExecute ? '#00ff88' : '#888',
              border: autoExecute ? '1px solid #00ff88' : '1px solid #444',
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: '900',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {autoExecute ? <Play size={16} color="#00ff88" /> : <Pause size={16} color="#888" />}
            AUTO-SWAP : {autoExecute ? 'ACTIF 🟢' : 'INACTIF ⏸'}
          </button>

          {/* Clear History */}
          <button
            onClick={clearHistory}
            style={{
              background: 'rgba(255,51,102,0.15)',
              color: '#ff3366',
              border: '1px solid #ff3366',
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trash2 size={16} /> RAZ HISTORIQUE
          </button>
        </div>
      </div>

      {/* STATS DASHBOARD CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        {/* SOL ACCUMULÉ LIVE */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid #00ff88', borderRadius: '14px', padding: '16px', boxShadow: '0 0 20px rgba(0,255,136,0.2)' }}>
          <span style={{ color: '#00ff88', fontSize: '0.78rem', fontWeight: '900', letterSpacing: '0.5px' }}>📈 SOL ACCUMULÉ EN DIRECT</span>
          <div style={{ color: '#00ff88', fontSize: '1.5rem', fontWeight: '900', marginTop: '4px' }}>
            {stats.currentCapital.toFixed(4)} SOL
          </div>
          <span style={{ color: stats.accumulatedSolGains >= 0 ? '#00ff88' : '#ff3366', fontSize: '0.75rem', fontWeight: 'bold' }}>
            Gains nets : {stats.accumulatedSolGains >= 0 ? '+' : ''}{stats.accumulatedSolGains.toFixed(4)} SOL
          </span>
        </div>

        {/* Realized PnL */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${stats.realizedPnlSol >= 0 ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`, borderRadius: '14px', padding: '16px' }}>
          <span style={{ color: '#888', fontSize: '0.78rem', fontWeight: 'bold' }}>PNL RÉALISÉ (SWAPS CLÔTURÉS)</span>
          <div style={{ color: stats.realizedPnlSol >= 0 ? '#00ff88' : '#ff3366', fontSize: '1.4rem', fontWeight: '900', marginTop: '4px' }}>
            {stats.realizedPnlSol >= 0 ? '+' : ''}{stats.realizedPnlSol.toFixed(4)} SOL
          </div>
          <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>{stats.closedCount} swaps terminés</span>
        </div>

        {/* Win Rate */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ color: '#888', fontSize: '0.78rem', fontWeight: 'bold' }}>TAUX DE RÉUSSITE (WIN RATE)</span>
          <div style={{ color: '#00d2ff', fontSize: '1.4rem', fontWeight: '900', marginTop: '4px' }}>
            {stats.winRate.toFixed(1)}%
          </div>
          <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>🟢 {stats.winsCount} Gagnés | 🔴 {stats.lossesCount} Perdu</span>
        </div>

        {/* Active Open Swaps */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '14px', padding: '16px' }}>
          <span style={{ color: '#888', fontSize: '0.78rem', fontWeight: 'bold' }}>POSITIONS EN COURS (SUIVI 1s)</span>
          <div style={{ color: '#a855f7', fontSize: '1.4rem', fontWeight: '900', marginTop: '4px' }}>
            {stats.openCount} EN COURS
          </div>
          <span style={{ color: stats.unrealizedPnlSol >= 0 ? '#00ff88' : '#ff3366', fontSize: '0.72rem', fontWeight: 'bold' }}>
            PnL non-réalisé : {stats.unrealizedPnlSol >= 0 ? '+' : ''}{stats.unrealizedPnlSol.toFixed(4)} SOL
          </span>
        </div>
      </div>

      {/* ACTIVE OPEN SWAPS TABLE WITH 1-SECOND REALTIME TICKER */}
      {stats.openCount > 0 && (
        <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '16px', padding: '18px' }}>
          <h4 style={{ margin: '0 0 14px 0', color: '#00ff88', fontSize: '1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} /> POSITIONS DE SWAP OUVERTES (TICKER 1 SECONDE EN DIRECT)
          </h4>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                  <th style={{ padding: '10px' }}>Date / Heure d'Entrée</th>
                  <th style={{ padding: '10px' }}>Token</th>
                  <th style={{ padding: '10px' }}>Prix Entrée USDT ($)</th>
                  <th style={{ padding: '10px' }}>Prix Actuel USDT ($)</th>
                  <th style={{ padding: '10px' }}>TP (+5%) USDT ($)</th>
                  <th style={{ padding: '10px' }}>SL (-2%) USDT ($)</th>
                  <th style={{ padding: '10px' }}>PnL Live (%)</th>
                  <th style={{ padding: '10px' }}>PnL Live (SOL)</th>
                  <th style={{ padding: '10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {swaps.filter(s => s.status === 'OPEN').map(swap => {
                  const livePrice = priceMap[swap.cleanSymbol] || swap.entryPrice;
                  const livePct = swap.pnlPct;
                  const liveSol = swap.pnlSol;
                  const isProfit = livePct >= 0;

                  return (
                    <tr key={swap.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#6b7280', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                        {swap.entryDateFormatted || new Date(swap.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px', fontWeight: '900', color: '#fff' }}>
                        {swap.cleanSymbol} / USDT
                      </td>
                      <td style={{ padding: '10px', color: '#00d2ff', fontWeight: 'bold' }}>
                        ${swap.entryPrice < 0.01 ? swap.entryPrice.toFixed(6) : swap.entryPrice.toFixed(4)}
                      </td>
                      <td style={{ padding: '10px', color: '#facc15', fontWeight: 'bold' }}>
                        ${livePrice < 0.01 ? livePrice.toFixed(6) : livePrice.toFixed(4)}
                      </td>
                      <td style={{ padding: '10px', color: '#00ff88', fontWeight: 'bold' }}>
                        ${swap.tpPrice < 0.01 ? swap.tpPrice.toFixed(6) : swap.tpPrice.toFixed(4)}
                      </td>
                      <td style={{ padding: '10px', color: '#ff3366', fontWeight: 'bold' }}>
                        ${swap.slPrice < 0.01 ? swap.slPrice.toFixed(6) : swap.slPrice.toFixed(4)}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          color: isProfit ? '#00ff88' : '#ff3366',
                          fontWeight: '900',
                          fontSize: '0.95rem',
                          background: isProfit ? 'rgba(0,255,136,0.12)' : 'rgba(255,51,102,0.12)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}>
                          {isProfit ? '+' : ''}{livePct.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: isProfit ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                        {isProfit ? '+' : ''}{liveSol.toFixed(4)} SOL
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button
                          onClick={() => closeSwapManually(swap.id)}
                          style={{
                            background: 'rgba(255,51,102,0.2)',
                            color: '#ff3366',
                            border: '1px solid #ff3366',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          FERMER POS.
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPLETED SWAPS HISTORY TABLE WITH EXACT USDT ENTRY/EXIT & EXACT DATES */}
      <div style={{ background: 'rgba(5,10,15,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px' }}>
        <h4 style={{ margin: '0 0 14px 0', color: '#fff', fontSize: '1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="#facc15" /> HISTORIQUE DES SWAPS ENREGISTRÉS ({swaps.length} SWAPS AU TOTAL)
        </h4>

        {swaps.length === 0 ? (
          <div style={{ color: '#6b7280', padding: '20px', textAlign: 'center', fontSize: '0.88rem' }}>
            Aucun swap enregistré pour l'instant. Les nouveaux swaps s'enregistreront automatiquement dès qu'un token exceptionnel sera détecté !
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                  <th style={{ padding: '10px' }}>Date/Heure Entrée Exacte</th>
                  <th style={{ padding: '10px' }}>Date/Heure Sortie Exacte</th>
                  <th style={{ padding: '10px' }}>Token</th>
                  <th style={{ padding: '10px' }}>Prix Entrée USDT ($)</th>
                  <th style={{ padding: '10px' }}>Prix Sortie USDT ($)</th>
                  <th style={{ padding: '10px' }}>Statut / Motif</th>
                  <th style={{ padding: '10px' }}>PnL (%)</th>
                  <th style={{ padding: '10px' }}>Gain / Perte SOL</th>
                </tr>
              </thead>
              <tbody>
                {swaps.map(swap => {
                  const isClosed = swap.status === 'CLOSED';
                  const isWin = swap.pnlPct > 0;
                  const isTp = swap.exitReason === 'TP_REACHED';
                  const isSl = swap.exitReason === 'SL_HIT';

                  return (
                    <tr key={swap.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#888', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                        {swap.entryDateFormatted || new Date(swap.entryTime).toLocaleString('fr-FR')}
                      </td>
                      <td style={{ padding: '10px', color: '#888', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                        {swap.exitDateFormatted || (swap.exitTime ? new Date(swap.exitTime).toLocaleString('fr-FR') : '— EN COURS')}
                      </td>
                      <td style={{ padding: '10px', fontWeight: '900', color: '#fff' }}>
                        {swap.cleanSymbol} / USDT
                      </td>
                      <td style={{ padding: '10px', color: '#00d2ff', fontWeight: 'bold' }}>
                        ${swap.entryPrice < 0.01 ? swap.entryPrice.toFixed(6) : swap.entryPrice.toFixed(4)}
                      </td>
                      <td style={{ padding: '10px', color: '#facc15', fontWeight: 'bold' }}>
                        {swap.exitPrice ? `$${swap.exitPrice < 0.01 ? swap.exitPrice.toFixed(6) : swap.exitPrice.toFixed(4)}` : '—'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {isTp ? (
                          <span style={{ color: '#00ff88', fontWeight: '900', background: 'rgba(0,255,136,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #00ff88', fontSize: '0.75rem' }}>
                            🎯 TP ATTEINT (+5%)
                          </span>
                        ) : isSl ? (
                          <span style={{ color: '#ff3366', fontWeight: '900', background: 'rgba(255,51,102,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #ff3366', fontSize: '0.75rem' }}>
                            🛑 SL TOUCHÉ (-2%)
                          </span>
                        ) : isClosed ? (
                          <span style={{ color: '#00d2ff', fontWeight: 'bold', fontSize: '0.75rem' }}>
                            🔒 CLÔTURÉ MANUEL
                          </span>
                        ) : (
                          <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: '0.75rem' }}>
                            ⏳ EN COURS (LIVE 1s)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px', fontWeight: '900', color: isWin ? '#00ff88' : swap.pnlPct < 0 ? '#ff3366' : '#888' }}>
                        {swap.pnlPct >= 0 ? '+' : ''}{swap.pnlPct.toFixed(2)}%
                      </td>
                      <td style={{ padding: '10px', fontWeight: '900', color: swap.pnlSol >= 0 ? '#00ff88' : '#ff3366' }}>
                        {swap.pnlSol >= 0 ? '+' : ''}{swap.pnlSol.toFixed(4)} SOL
                      </td>
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

export default SolSwapSimulator;
