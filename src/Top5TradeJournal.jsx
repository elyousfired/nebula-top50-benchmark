import React, { useState, useEffect, useCallback } from 'react';
import { Play, Square, Download, Trash2, TrendingUp, ShieldAlert, CheckCircle2, XCircle, Clock, DollarSign, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { getTokenFixedColor } from './DeltaSMomentumRadar';
import Top5EquityCurve from './Top5EquityCurve';

const STORAGE_KEY = 'nebula_top5_trades_journal_v1';

// 🌐 UNIVERSAL BYBIT PRICE RESOLVER (Handles Spot, Linear, 1000x multiplier contracts like 1000PEPE, 1000FLOKI, etc.)
async function fetchBybitUniversalPrice(symbol) {
  const clean = symbol.replace('USDT', '').toUpperCase();
  const variations = [
    { cat: 'linear', sym: `${clean}USDT`, div: 1 },
    { cat: 'spot', sym: `${clean}USDT`, div: 1 },
    { cat: 'linear', sym: `1000${clean}USDT`, div: 1000 },
    { cat: 'spot', sym: `1000${clean}USDT`, div: 1000 },
    { cat: 'linear', sym: `1000000${clean}USDT`, div: 1000000 }
  ];

  for (const v of variations) {
    try {
      const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=${v.cat}&symbol=${v.sym}`);
      if (res.ok) {
        const data = await res.json();
        const rawPrice = parseFloat(data?.result?.list?.[0]?.lastPrice || 0);
        if (rawPrice > 0) {
          const finalPrice = rawPrice / v.div;
          return finalPrice;
        }
      }
    } catch (_) {}
  }
  return 0;
}

// 🎯 DYNAMIC PRECISION PRICE FORMATTER (Micro-cents up to Bitcoin scale)
function formatTokenPrice(p) {
  if (p === null || p === undefined || isNaN(p) || p === 0) return '$0.00';
  if (p < 0.00001) return `$${p.toFixed(8)}`;
  if (p < 0.001) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  if (p < 100) return `$${p.toFixed(2)}`;
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Top5TradeJournal({ top5Tokens, marketAvg, onSelectToken }) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default
  const [trades, setTrades] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load trade journal from localStorage', e);
      return [];
    }
  });

  const [livePrices, setLivePrices] = useState({});
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  // Save to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    } catch (e) {
      console.error('Failed to persist trade journal to localStorage', e);
    }
  }, [trades]);

  // Polling real-time prices for active trades from Bybit API
  const updateActiveTradePrices = useCallback(async () => {
    const activeSymbols = trades
      .filter(t => t.status === 'EN COURS')
      .map(t => t.symbol);

    if (activeSymbols.length === 0) return;

    try {
      setIsUpdatingPrices(true);
      const newPrices = { ...livePrices };

      // Fetch in parallel using universal resolver
      await Promise.all(
        activeSymbols.map(async (sym) => {
          const clean = sym.replace('USDT', '').toUpperCase();
          const price = await fetchBybitUniversalPrice(clean);
          if (price > 0) {
            newPrices[clean] = price;
          }
        })
      );

      setLivePrices(newPrices);

      // Auto-heal legacy trades that were created with $0.01 fallback when true price is micro-cap
      setTrades(prev => prev.map(t => {
        if (t.status === 'EN COURS' && t.entryPrice === 0.01 && newPrices[t.symbol] && newPrices[t.symbol] < 0.001) {
          return {
            ...t,
            entryPrice: newPrices[t.symbol]
          };
        }
        return t;
      }));

    } catch (err) {
      console.warn('Error fetching live prices for journal', err);
    } finally {
      setIsUpdatingPrices(false);
    }
  }, [trades, livePrices]);

  // Run price update on mount and every 3.5 seconds
  useEffect(() => {
    updateActiveTradePrices();
    const interval = setInterval(updateActiveTradePrices, 3500);
    return () => clearInterval(interval);
  }, [updateActiveTradePrices]);

  // ─── 🎯 ACTION : ENTRER EN POSITION ───
  const handleOpenTrade = async (tokenObj) => {
    const cleanSym = tokenObj.cleanSymbol || tokenObj.sym || (tokenObj.symbol || '').replace('USDT', '').toUpperCase();
    
    // Fetch instant real entry price using universal resolver
    let entryPrice = await fetchBybitUniversalPrice(cleanSym);

    // Fallback price from tokenObj if fetch failed
    if (!entryPrice || entryPrice === 0) {
      entryPrice = tokenObj.price || tokenObj.close || livePrices[cleanSym] || 0.01;
    }

    const now = new Date();
    const nowUtcStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    const newTrade = {
      id: 'trade_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: nowUtcStr,
      symbol: cleanSym,
      rankAtEntry: tokenObj.rank || (top5Tokens?.findIndex(t => (t.cleanSymbol || t.sym) === cleanSym) + 1) || 1,
      scoreAtEntry: tokenObj.score || 0,
      alphaAtEntry: (tokenObj.score || 0) - (marketAvg || 0),
      maturityAtEntry: tokenObj.maturity ? `${tokenObj.maturity.label} (${tokenObj.maturity.timeFormatted})` : '🌱 NAISSANCE (Début)',
      entryPrice: entryPrice,
      exitPrice: null,
      status: 'EN COURS',
      pnlFinal: null,
      exitTimestamp: null,
      notes: 'Entrée Leader Top 5'
    };

    setTrades(prev => [newTrade, ...prev]);
    setLivePrices(prev => ({ ...prev, [cleanSym]: entryPrice }));
  };

  // ─── ⏹️ ACTION : CLÔTURER LE TRADE ───
  const handleCloseTrade = (tradeId) => {
    const target = trades.find(t => t.id === tradeId);
    if (!target) return;

    const currentPrice = livePrices[target.symbol] || target.entryPrice;
    const finalPnl = target.entryPrice > 0 ? ((currentPrice - target.entryPrice) / target.entryPrice) * 100 : 0;
    const nowUtcStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    setTrades(prev => prev.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          status: 'FERMÉ',
          exitPrice: currentPrice,
          pnlFinal: parseFloat(finalPnl.toFixed(2)),
          exitTimestamp: nowUtcStr,
          notes: finalPnl >= 0 ? 'TP Clôturé avec succès' : 'SL Clôturé'
        };
      }
      return t;
    }));
  };

  // ─── 🚨 ACTION : PANIC STOP / FERMER TOUT EN 1 CLIC ───
  const handlePanicCloseAll = () => {
    const running = trades.filter(t => t.status === 'EN COURS');
    if (running.length === 0) {
      alert('Aucune position ouverte à clôturer.');
      return;
    }

    if (window.confirm(`🚨 PANIC STOP : Voulez-vous clôturer IMMÉDIATEMENT les ${running.length} trades en cours et sécuriser vos gains ?`)) {
      const nowUtcStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      setTrades(prev => prev.map(t => {
        if (t.status === 'EN COURS') {
          const currentPrice = livePrices[t.symbol] || t.entryPrice;
          const finalPnl = t.entryPrice > 0 ? ((currentPrice - t.entryPrice) / t.entryPrice) * 100 : 0;
          return {
            ...t,
            status: 'FERMÉ',
            exitPrice: currentPrice,
            pnlFinal: parseFloat(finalPnl.toFixed(2)),
            exitTimestamp: nowUtcStr,
            notes: '🚨 Clôture d\'urgence Panic Stop'
          };
        }
        return t;
      }));
    }
  };

  // ─── 🗑️ ACTION : SUPPRIMER UN TRADE ───
  const handleDeleteTrade = (tradeId) => {
    if (window.confirm('Voulez-vous supprimer ce trade de l\'historique ?')) {
      setTrades(prev => prev.filter(t => t.id !== tradeId));
    }
  };

  // ─── 🗑️ ACTION : TOUT RÉINITIALISER ───
  const handleClearAll = () => {
    if (window.confirm('Voulez-vous effacer TOUT l\'historique des trades ?')) {
      setTrades([]);
    }
  };

  // ─── 📥 ACTION : TÉLÉCHARGER LE FICHIER CSV POUR GOOGLE SHEETS ───
  const handleDownloadCsv = () => {
    if (trades.length === 0) {
      alert('Aucun trade enregistré à exporter.');
      return;
    }

    const headers = [
      'Date & Heure (UTC)',
      'Token',
      'Rang & Score Entree',
      'Maturite du Rallye',
      'Prix Entree ($)',
      'Prix Sortie / Actuel ($)',
      'Statut',
      'PnL Actuel (%)',
      'PnL Final (%)',
      'Date Sortie (UTC)',
      'Commentaire / Notes'
    ];

    const rows = trades.map(t => {
      const currPrice = t.status === 'FERMÉ' ? t.exitPrice : (livePrices[t.symbol] || t.entryPrice);
      const currentPnl = t.entryPrice > 0 ? (((currPrice - t.entryPrice) / t.entryPrice) * 100).toFixed(2) + '%' : '0%';
      const finalPnl = t.pnlFinal !== null ? t.pnlFinal.toFixed(2) + '%' : '';

      return [
        `"${t.timestamp}"`,
        `"${t.symbol}"`,
        `"#${t.rankAtEntry} (${t.scoreAtEntry >= 0 ? '+' : ''}${t.scoreAtEntry.toFixed(1)} pts)"`,
        `"${t.maturityAtEntry}"`,
        t.entryPrice,
        currPrice,
        `"${t.status}"`,
        `"${currentPnl}"`,
        `"${finalPnl}"`,
        `"${t.exitTimestamp || ''}"`,
        `"${t.notes || ''}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `nebula_top5_trades_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── STATISTIQUES GLOBALES (FERMÉS + EN COURS LIVE) ───
  const closedTrades = trades.filter(t => t.status === 'FERMÉ');
  const openTrades = trades.filter(t => t.status === 'EN COURS');
  const winTrades = closedTrades.filter(t => (t.pnlFinal || 0) > 0);
  const lossTrades = closedTrades.filter(t => (t.pnlFinal || 0) <= 0);
  const winRate = closedTrades.length > 0 ? ((winTrades.length / closedTrades.length) * 100).toFixed(0) : 0;
  
  const closedPnLCumul = closedTrades.reduce((acc, t) => acc + (t.pnlFinal || 0), 0);
  const openLivePnLCumul = openTrades.reduce((acc, t) => {
    const currPrice = livePrices[t.symbol] || t.entryPrice;
    const pnl = t.entryPrice > 0 ? ((currPrice - t.entryPrice) / t.entryPrice) * 100 : 0;
    return acc + pnl;
  }, 0);
  const totalOverallPnL = closedPnLCumul + openLivePnLCumul;

  return (
    <div style={{
      background: 'rgba(8, 14, 24, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '14px 18px',
      marginTop: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      fontFamily: 'JetBrains Mono, monospace'
    }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={16} color="#10b981" />
          <span style={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: '800', letterSpacing: '0.5px' }}>
            JOURNAL DES TRADES TOP 5 (PAPER TRADING LIVE)
          </span>
          <span style={{ fontSize: '0.66rem', color: '#64748b' }}>
            · Sauvegarde locale automatique · Cotation Bybit en direct
          </span>
        </div>

        {/* Action Buttons: Panic Stop, Download & Clear + Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsCollapsed(prev => !prev)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '3px 8px',
              borderRadius: '5px',
              fontSize: '0.68rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            {isCollapsed ? (
              <><span>Afficher</span> <ChevronDown size={13} /></>
            ) : (
              <><span>Réduire</span> <ChevronUp size={13} /></>
            )}
          </button>
          {openTrades.length > 0 && (
            <button
              onClick={handlePanicCloseAll}
              style={{
                background: 'rgba(244, 63, 94, 0.2)',
                color: '#f43f5e',
                border: '1px solid rgba(244, 63, 94, 0.5)',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.70rem',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 0 12px rgba(244, 63, 94, 0.3)'
              }}
              title="Clôturer immédiatement tous les trades en cours et figer vos profits !"
            >
              <Square size={12} color="#f43f5e" /> 🚨 FERMER TOUT ({openTrades.length})
            </button>
          )}

          <button
            onClick={handleDownloadCsv}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.70rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
            title="Télécharger le fichier CSV pour Google Sheets / Excel"
          >
            <Download size={13} color="#94a3b8" /> TÉLÉCHARGER (CSV / GOOGLE SHEETS)
          </button>

          {trades.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#64748b',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.66rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={11} /> EFFACER
            </button>
          )}
        </div>
      </div>

      {/* 🚀 QUICK ENTRY BAR (1-CLICK BUY FOR TOP 5 LEADERS) */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '8px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span style={{ fontSize: '0.70rem', fontWeight: '800', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🎯 ENTRÉE INSTANTANÉE (TOP 5) :
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {(top5Tokens || []).slice(0, 5).map((tok, idx) => {
            const sym = tok.cleanSymbol || tok.sym;
            return (
              <button
                key={sym}
                onClick={() => handleOpenTrade(tok)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.70rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
                title={`Acheter immédiatement #${idx + 1} ${sym}`}
              >
                <span style={{ color: '#94a3b8' }}>#{idx + 1}</span>
                <span>{sym}</span>
                <span style={{ color: '#10b981', fontWeight: '900', fontSize: '0.64rem' }}>
                  + ACHETER
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 📈 COURBE D'ÉVOLUTION DU % DEPUIS LE PREMIER TRADE (FERMÉS + EN COURS) */}
      <Top5EquityCurve trades={trades} livePrices={livePrices} />

      {/* Metrics Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px' }}>
        <div style={{ background: 'rgba(15,23,42,0.5)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.60rem', color: '#64748b', textTransform: 'uppercase' }}>Total Trades</div>
          <div style={{ fontSize: '0.90rem', fontWeight: '900', color: '#f8fafc' }}>
            {trades.length} <span style={{ fontSize: '0.64rem', color: '#10b981' }}>({openTrades.length} en cours)</span>
          </div>
        </div>
        <div style={{ background: 'rgba(15,23,42,0.5)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.60rem', color: '#64748b', textTransform: 'uppercase' }}>Win Rate (Fermés)</div>
          <div style={{ fontSize: '0.90rem', fontWeight: '900', color: winRate >= 50 ? '#10b981' : '#f43f5e' }}>
            {winRate}% <span style={{ fontSize: '0.64rem', color: '#64748b' }}>({winTrades.length}V - {lossTrades.length}D)</span>
          </div>
        </div>
        <div style={{ background: 'rgba(15,23,42,0.5)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.60rem', color: '#64748b', textTransform: 'uppercase' }}>PnL Cumulé Total (Live)</div>
          <div style={{ fontSize: '0.90rem', fontWeight: '900', color: totalOverallPnL >= 0 ? '#10b981' : '#f43f5e' }}>
            {totalOverallPnL >= 0 ? '+' : ''}{totalOverallPnL.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 📊 TRADES TABLE */}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ padding: '6px 10px' }}>DATE (UTC)</th>
              <th style={{ padding: '6px 10px' }}>TOKEN</th>
              <th style={{ padding: '6px 10px' }}>RANG & SCORE</th>
              <th style={{ padding: '6px 10px' }}>MATURITÉ</th>
              <th style={{ padding: '6px 10px' }}>PRIX ENTRÉE</th>
              <th style={{ padding: '6px 10px' }}>PRIX ACTUEL / SORTIE</th>
              <th style={{ padding: '6px 10px' }}>STATUT</th>
              <th style={{ padding: '6px 10px' }}>PNL ACTUEL</th>
              <th style={{ padding: '6px 10px' }}>PNL FINAL</th>
              <th style={{ padding: '6px 10px', textAlign: 'center' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  Aucun trade dans le journal. Cliquez sur <strong>"+ ACHETER"</strong> ci-dessus sur l'un des Top 5 pour lancer une position !
                </td>
              </tr>
            ) : (
              trades.map((t, idx) => {
                const isRunning = t.status === 'EN COURS';
                const currPrice = isRunning ? (livePrices[t.symbol] || t.entryPrice) : t.exitPrice;
                const livePnl = t.entryPrice > 0 ? ((currPrice - t.entryPrice) / t.entryPrice) * 100 : 0;

                return (
                  <tr
                    key={t.id}
                    style={{
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid rgba(255,255,255,0.03)'
                    }}
                  >
                    <td style={{ padding: '6px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {t.timestamp.slice(5, 16)}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: '900', color: '#f8fafc' }}>
                      <span
                        onClick={() => onSelectToken && onSelectToken(t.symbol)}
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        title="Cliquez pour isoler ce token sur le graphique"
                      >
                        {t.symbol}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 5px', borderRadius: '3px', color: '#cbd5e1' }}>
                        #{t.rankAtEntry} ({t.scoreAtEntry >= 0 ? '+' : ''}{t.scoreAtEntry.toFixed(1)})
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', color: '#94a3b8' }}>
                      {t.maturityAtEntry}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: '700', color: '#e2e8f0' }}>
                      {formatTokenPrice(t.entryPrice)}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: '700', color: currPrice >= t.entryPrice ? '#10b981' : '#f43f5e' }}>
                      {formatTokenPrice(currPrice)}
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.62rem',
                        fontWeight: '800',
                        background: isRunning ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: isRunning ? '#10b981' : '#64748b',
                        border: `1px solid ${isRunning ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)'}`
                      }}>
                        {isRunning ? '🟢 EN COURS' : '🔴 FERMÉ'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: '800', color: livePnl >= 0 ? '#10b981' : '#f43f5e' }}>
                      {isRunning ? `${livePnl >= 0 ? '+' : ''}${livePnl.toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: '800', color: (t.pnlFinal || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                      {t.pnlFinal !== null ? `${t.pnlFinal >= 0 ? '+' : ''}${t.pnlFinal.toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        {isRunning ? (
                          <button
                            onClick={() => handleCloseTrade(t.id)}
                            style={{
                              background: 'rgba(244, 63, 94, 0.15)',
                              border: '1px solid rgba(244, 63, 94, 0.3)',
                              color: '#f43f5e',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '0.62rem',
                              fontWeight: '800',
                              cursor: 'pointer'
                            }}
                            title="Fermer ce trade et figer le résultat final"
                          >
                            <Square size={10} /> STOP
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteTrade(t.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              padding: '2px'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
