import React, { useState, useEffect, useRef } from 'react';
import { fetchTop500Symbols } from './logic/scanner';
import { Bot, RefreshCw, Zap, TrendingUp, Scale, DollarSign, Award, AlertTriangle, ShieldCheck, Play, Pause, RotateCcw, CheckCircle2, Layers, PlayCircle } from 'lucide-react';

async function fetchBybitKlines(symbol, interval = '15', limit = 100) {
  const cleanBase = symbol.replace('USDT', '');
  const formattedSymbol = `${cleanBase}USDT`;
  try {
    const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`);
    if (res.ok) {
      const json = await res.json();
      if (json.result?.list?.length) {
        return json.result.list.slice().reverse();
      }
    }
  } catch (_) {}

  try {
    const binanceTfMap = { '15':'15m', '60':'1h', '240':'4h', 'D':'1d', 'W':'1w' };
    const bTf = binanceTfMap[interval] || '15m';
    const res2 = await fetch(`https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=${bTf}&limit=${limit}`);
    if (res2.ok) {
      const list = await res2.json();
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (_) {}

  return [];
}

export const SolSwapLiveTester = () => {
  const [isRunning, setIsRunning] = useState(true);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [nextScanSeconds, setNextScanSeconds] = useState(60); // 1 minute countdown (60s)
  
  // Wallet State (Total Capital = 100 SOL, Allocated = 1.0 SOL per token)
  const [availableSolBalance, setAvailableSolBalance] = useState(100.0);
  const [initialCapital] = useState(100.0);
  
  // Multi-Position State (Array of active 1 SOL positions)
  const [activePositions, setActivePositions] = useState([]);
  const [tradeLogs, setTradeLogs] = useState([]);
  
  const [scannedTokensCount, setScannedTokensCount] = useState(0);
  const [topCandidates, setTopCandidates] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMsg, setScanStatusMsg] = useState('Prêt pour le scan 1 minute (1 SOL par token)...');

  // Run Real-Time 1m/15m Scan Engine
  const runLive1mScan = async (forceManualSwap = false) => {
    if (isScanning && !forceManualSwap) return;
    setIsScanning(true);
    setScanStatusMsg('Scan en direct du Top 500 Bybit Spot USDT...');

    try {
      const topSymbolsRaw = await fetchTop500Symbols(true, 500);
      let candidateSymbols = [];
      if (Array.isArray(topSymbolsRaw) && topSymbolsRaw.length > 0) {
        candidateSymbols = topSymbolsRaw
          .map(t => typeof t === 'string' ? t : t.symbol)
          .filter(s => s.endsWith('USDT') && !s.includes('USDC') && !s.includes('SOLUSDT'))
          .slice(0, 300);
      }

      setScannedTokensCount(candidateSymbols.length);
      setScanStatusMsg(`Fetch klines et analyse de ${candidateSymbols.length} tokens...`);

      const solKlines15m = await fetchBybitKlines('SOLUSDT', '15', 50);
      if (!solKlines15m.length) throw new Error('Impossible de charger les klines SOL');

      const solLatestClose = parseFloat(solKlines15m[solKlines15m.length - 1][4]);
      const solPrevClose   = parseFloat(solKlines15m[solKlines15m.length - 2][4]);

      const candidates = [];

      // Scan candidates
      for (let i = 0; i < Math.min(60, candidateSymbols.length); i++) {
        const symbol = candidateSymbols[i];
        const tokKlines = await fetchBybitKlines(symbol, '15', 30);
        if (tokKlines.length < 5) continue;

        const tokLatestClose = parseFloat(tokKlines[tokKlines.length - 1][4]);
        const tokLatestOpen  = parseFloat(tokKlines[tokKlines.length - 1][1]);
        const tokPrevClose   = parseFloat(tokKlines[tokKlines.length - 2][4]);

        const curRatio  = tokLatestClose / solLatestClose;
        const prevRatio = tokPrevClose / solPrevClose;

        // Ratio 15m Perf %
        const ratioPerf15m = ((curRatio - prevRatio) / prevRatio) * 100;
        const isGreenCandle = tokLatestClose > tokLatestOpen && ratioPerf15m > -0.5;

        // User's exact weighted score: Confluence (W=3, D=2.5, 4H=2, 1H=1.5, 15m=1) + Perf
        const confluencePts = (ratioPerf15m > 0 ? 1.0 : 0) + (isGreenCandle ? 1.5 : 0);
        const estimatedScore = Math.max(-10, Math.min(50, confluencePts + (ratioPerf15m * 2)));

        candidates.push({
          symbol,
          cleanSymbol: symbol.replace('USDT', ''),
          curRatio,
          ratioPerf15m,
          tokLatestClose,
          isGreenCandle,
          score: estimatedScore,
        });
      }

      candidates.sort((a, b) => b.score - a.score);
      setTopCandidates(candidates.slice(0, 10));

      const nowStr = new Date().toLocaleTimeString('fr-FR');
      setLastScanTime(nowStr);

      // ── 1. EVALUATE EXITS ON EXISTING 1.0 SOL POSITIONS ──
      const remainingPositions = [];
      let freedSolCapital = 0;
      const newLogs = [];

      for (const pos of activePositions) {
        const currentTokData = candidates.find(c => c.symbol === pos.symbol);
        const curRatio = currentTokData ? currentTokData.curRatio : pos.entryRatio;
        const curScore = currentTokData ? currentTokData.score : 5.0;

        const isTakeProfit = curScore >= 10.0;
        const isStopLoss   = curScore <= -5.0;

        if (isTakeProfit || isStopLoss) {
          // CLOSE POSITION: TOKEN ➡️ SOL
          const newSolAmount = pos.tokenAmount * curRatio;
          const solProfit    = newSolAmount - pos.solInvested;
          const pnlPct       = (solProfit / pos.solInvested) * 100;

          freedSolCapital += newSolAmount;

          newLogs.push({
            id: Date.now() + Math.random(),
            time: nowStr,
            type: isTakeProfit ? 'TAKE_PROFIT' : 'STOP_LOSS',
            symbol: pos.cleanSymbol,
            exitRatio: curRatio,
            solReceived: newSolAmount,
            solProfit: solProfit,
            pnlPct: pnlPct,
          });
        } else {
          remainingPositions.push(pos);
        }
      }

      // ── 2. EVALUATE NEW ENTRIES (ALLOCATE 1.0 SOL PER ELIGIBLE TOKEN AT 0-5 PTS) ──
      let updatedSolBalance = availableSolBalance + freedSolCapital;

      // Find tokens with Score >= 0 && Score <= 5.0 pts with Green Candle
      let eligibleTokens = candidates.filter(c => 
        c.score >= 0.0 && 
        c.score <= 5.0 && 
        c.isGreenCandle && 
        !remainingPositions.some(p => p.symbol === c.symbol)
      );

      // If manual force swap button clicked and no eligible token, pick top candidate
      if (forceManualSwap && eligibleTokens.length === 0 && candidates.length > 0) {
        const topOne = candidates.find(c => !remainingPositions.some(p => p.symbol === c.symbol)) || candidates[0];
        if (topOne) eligibleTokens = [topOne];
      }

      for (const tok of eligibleTokens) {
        if (updatedSolBalance >= 1.0) {
          // ALLOCATE EXACTLY 1.0 SOL TO THIS TOKEN
          const investedSol = 1.0;
          const tokenQty    = investedSol / tok.curRatio;

          const newPos = {
            id: Date.now() + Math.random(),
            symbol: tok.symbol,
            cleanSymbol: tok.cleanSymbol,
            entryRatio: tok.curRatio,
            tokenAmount: tokenQty,
            solInvested: investedSol,
            entryScore: tok.score,
            entryTime: nowStr,
          };

          remainingPositions.push(newPos);
          updatedSolBalance -= investedSol;

          newLogs.push({
            id: Date.now() + Math.random(),
            time: nowStr,
            type: 'BUY_SWAP',
            symbol: tok.cleanSymbol,
            entryRatio: tok.curRatio,
            solSpent: investedSol,
            tokenQty: tokenQty,
            score: tok.score,
          });
        }
      }

      setAvailableSolBalance(updatedSolBalance);
      setActivePositions(remainingPositions);
      if (newLogs.length > 0) {
        setTradeLogs(prev => [...newLogs, ...prev]);
      }

      setScanStatusMsg(`Scan terminé à ${nowStr}. Prochain scan dans 1 min.`);
    } catch (err) {
      setScanStatusMsg(`Erreur scan: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Timer Countdown (1 minute = 60 seconds)
  useEffect(() => {
    runLive1mScan();

    const interval = setInterval(() => {
      setNextScanSeconds(prev => {
        if (prev <= 1) {
          runLive1mScan();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const totalInvestedInPositions = activePositions.reduce((acc, p) => acc + p.solInvested, 0);
  const totalNetWalletValSol = availableSolBalance + totalInvestedInPositions;
  const totalPnLSol = totalNetWalletValSol - initialCapital;
  const totalPnLPct = (totalPnLSol / initialCapital) * 100;

  const minutesLeft = Math.floor(nextScanSeconds / 60);
  const secondsLeft = nextScanSeconds % 60;

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
      {/* HEADER & CONTROL STRIP */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Bot size={34} color="#00ff88" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', background: 'linear-gradient(90deg, #00ff88, #00d2ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SIMULATEUR DE SWAP EN TEMPS RÉEL (SCAN AUTO 1 MINUTE TOP 500) 🤖
            </h2>
            <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.85rem' }}>
              Scan Automatique toutes les 1 Minute sur le Top 500 Bybit — <span style={{ color: '#00ff88', fontWeight: 'bold' }}>Allocation : 1.0 SOL par Token (Entrée 0-35 pt / TP +45)</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => runLive1mScan(true)}
            disabled={isScanning}
            style={{
              background: 'linear-gradient(135deg, #00ff88 0%, #00d2ff 100%)',
              color: '#000',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '10px',
              fontWeight: '900',
              fontSize: '0.85rem',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 0 20px rgba(0,255,136,0.4)',
            }}
          >
            <PlayCircle size={16} />
            FORCER UN SWAP 1.0 SOL IMMÉDIAT
          </button>

          <button
            onClick={() => runLive1mScan(false)}
            disabled={isScanning}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={isScanning ? 'spin' : ''} />
            SCANNER 1M
          </button>
        </div>
      </div>

      {/* CAPITAL & MULTI-POSITIONS ACCOUNT LEDGER CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Net Wallet Value */}
        <div style={{ background: 'rgba(5,15,25,0.85)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '16px', padding: '18px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>VALEUR TOTALE DU PORTEFEUILLE</span>
          <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#00ff88' }}>
            {totalNetWalletValSol.toFixed(2)} <span style={{ fontSize: '0.9rem', color: '#9ca3af' }}>SOL</span>
          </div>
          <div style={{ color: totalPnLSol >= 0 ? '#00ff88' : '#ff3366', fontSize: '0.82rem', fontWeight: '900', marginTop: '4px' }}>
            PnL Cumulé : {totalPnLSol >= 0 ? '+' : ''}{totalPnLSol.toFixed(2)} SOL ({totalPnLSol >= 0 ? '+' : ''}{totalPnLPct.toFixed(1)}%)
          </div>
        </div>

        {/* Card 2: Available SOL Balance */}
        <div style={{ background: 'rgba(5,15,25,0.85)', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '16px', padding: '18px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>SOL DISPONIBLE EN RESERVE</span>
          <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#00d2ff' }}>
            {availableSolBalance.toFixed(2)} <span style={{ fontSize: '0.9rem', color: '#9ca3af' }}>SOL</span>
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.78rem', marginTop: '4px' }}>
            Prêt à allouer (1.0 SOL par nouveau token)
          </div>
        </div>

        {/* Card 3: Active Positions Count */}
        <div style={{ background: 'rgba(5,15,25,0.85)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: '16px', padding: '18px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>POSITIONS ACTIVES (PANIER)</span>
          <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#facc15' }}>
            {activePositions.length} <span style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Tokens</span>
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.78rem', marginTop: '4px' }}>
            Capital Engagé : {totalInvestedInPositions.toFixed(1)} SOL (1.0 SOL / token)
          </div>
        </div>

        {/* Card 4: Countdown Timer */}
        <div style={{ background: 'rgba(5,15,25,0.85)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '16px', padding: '18px' }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>PROCHAIN SCAN 1 MINUTE</span>
          <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#a855f7' }}>
            {String(minutesLeft).padStart(2, '0')}:{String(secondsLeft).padStart(2, '0')}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.78rem', marginTop: '4px' }}>
            {scannedTokensCount} tokens scannés sur Bybit
          </div>
        </div>
      </div>

      {/* ACTIVE MULTI-POSITIONS BASKET TABLE */}
      {activePositions.length > 0 && (
        <div style={{ background: 'rgba(5,10,15,0.9)', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px 0', color: '#00d2ff', fontSize: '1.1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#00d2ff" />
            PANIER EN COURS : {activePositions.length} POSITIONS D'ALLOCATION (1.0 SOL CHACUNE)
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                  <th style={{ padding: '10px' }}>Token</th>
                  <th style={{ padding: '10px' }}>SOL Investi</th>
                  <th style={{ padding: '10px' }}>Quantité Tokens</th>
                  <th style={{ padding: '10px' }}>Taux Entrée Ratio</th>
                  <th style={{ padding: '10px' }}>Heure d'Entrée</th>
                  <th style={{ padding: '10px' }}>Objectif Sortie TP</th>
                </tr>
              </thead>
              <tbody>
                {activePositions.map(pos => (
                  <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px', fontWeight: '900', color: '#fff' }}>{pos.cleanSymbol}</td>
                    <td style={{ padding: '10px', color: '#00ff88', fontWeight: 'bold' }}>{pos.solInvested.toFixed(1)} SOL</td>
                    <td style={{ padding: '10px', color: '#00d2ff' }}>{pos.tokenAmount.toFixed(2)}</td>
                    <td style={{ padding: '10px', color: '#facc15' }}>{pos.entryRatio.toFixed(6)}</td>
                    <td style={{ padding: '10px', color: '#9ca3af' }}>{pos.entryTime}</td>
                    <td style={{ padding: '10px', color: '#00ff88', fontWeight: 'bold' }}>Score &gt;= +45 pts (TP)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TOP CANDIDATES OF CURRENT SCAN */}
      <div style={{ background: 'rgba(5,10,15,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 14px 0', color: '#00d2ff', fontSize: '1.1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="#00d2ff" />
          TOP CANDIDATS DU SCAN EN DIRECT (ALLOCATION 1.0 SOL)
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                <th style={{ padding: '10px' }}>Token</th>
                <th style={{ padding: '10px' }}>Prix USDT</th>
                <th style={{ padding: '10px' }}>Ratio TOKEN/SOL</th>
                <th style={{ padding: '10px' }}>Perf Ratio 15m</th>
                <th style={{ padding: '10px' }}>Score Est. 15m</th>
                <th style={{ padding: '10px' }}>Action Allocation 1.0 SOL</th>
              </tr>
            </thead>
            <tbody>
              {topCandidates.map((c, idx) => (
                <tr key={c.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: c.score >= 0 && c.score <= 35.0 && c.isGreenCandle ? 'rgba(0,255,136,0.06)' : 'transparent' }}>
                  <td style={{ padding: '10px', fontWeight: '900', color: '#fff' }}>{c.cleanSymbol}</td>
                  <td style={{ padding: '10px', color: '#00d2ff' }}>${c.tokLatestClose.toFixed(4)}</td>
                  <td style={{ padding: '10px', color: '#facc15' }}>{c.curRatio.toFixed(6)}</td>
                  <td style={{ padding: '10px', color: c.ratioPerf15m >= 0 ? '#00ff88' : '#ff3366', fontWeight: 'bold' }}>
                    {c.ratioPerf15m >= 0 ? '+' : ''}{c.ratioPerf15m.toFixed(2)}%
                  </td>
                  <td style={{ padding: '10px', fontWeight: '900', color: c.score >= 45 ? '#00ff88' : '#facc15' }}>
                    +{c.score.toFixed(1)} pts
                  </td>
                  <td style={{ padding: '10px' }}>
                    {c.score >= 0 && c.score <= 35.0 && c.isGreenCandle ? (
                      <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.75rem', background: 'rgba(0,255,136,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid #00ff88' }}>
                        ✅ SWAP 1.0 SOL ÉLIGIBLE (Score 0-35 pt)
                      </span>
                    ) : c.score > 35.0 ? (
                      <span style={{ color: '#facc15', fontSize: '0.75rem', fontWeight: 'bold' }}>Déjà en hausse (&gt;35 pt)</span>
                    ) : (
                      <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Attente Rebond &gt;0 pt</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JOURNAL EXHAUSTIF DES SWAPS & GAINS DE SOL */}
      <div style={{ background: 'rgba(5,10,15,0.9)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '16px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 14px 0', color: '#00ff88', fontSize: '1.1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={18} color="#00ff88" />
          JOURNAL AUTOMATIQUE DES SWAPS & ACCUMULATION DE SOL ({tradeLogs.length} OPÉRATIONS)
        </h3>

        {tradeLogs.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>
            Aucun swap exécuté pour le moment. Cliquez sur "FORCER UN SWAP 1.0 SOL IMMÉDIAT" ci-dessus pour lancer le premier swap de test !
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
                  <th style={{ padding: '10px' }}>Heure</th>
                  <th style={{ padding: '10px' }}>Type d'Opération</th>
                  <th style={{ padding: '10px' }}>Token</th>
                  <th style={{ padding: '10px' }}>Taux Ratio</th>
                  <th style={{ padding: '10px' }}>Montant SOL Engagé / Reçu</th>
                  <th style={{ padding: '10px' }}>Profit Net en SOL</th>
                </tr>
              </thead>
              <tbody>
                {tradeLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px', color: '#9ca3af' }}>{log.time}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        background: log.type === 'BUY_SWAP' ? 'rgba(0,210,255,0.15)' : log.type === 'TAKE_PROFIT' ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)',
                        color: log.type === 'BUY_SWAP' ? '#00d2ff' : log.type === 'TAKE_PROFIT' ? '#00ff88' : '#ff3366',
                        padding: '3px 8px', borderRadius: '6px', fontWeight: '900', fontSize: '0.75rem',
                      }}>
                        {log.type === 'BUY_SWAP' ? '🔄 SWAP: 1.0 SOL ➡️ TOKEN' : log.type === 'TAKE_PROFIT' ? '💰 SWAP: TOKEN ➡️ SOL (TP +45)' : '🛡️ STOP LOSS'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: '900', color: '#fff' }}>{log.symbol}</td>
                    <td style={{ padding: '10px', color: '#facc15' }}>{(log.entryRatio || log.exitRatio).toFixed(6)}</td>
                    <td style={{ padding: '10px', color: '#00ff88', fontWeight: 'bold' }}>
                      {log.type === 'BUY_SWAP' ? `${log.solSpent.toFixed(2)} SOL` : `${log.solReceived.toFixed(2)} SOL`}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {log.solProfit ? (
                        <span style={{ color: log.solProfit >= 0 ? '#00ff88' : '#ff3366', fontWeight: '900' }}>
                          {log.solProfit >= 0 ? '+' : ''}{log.solProfit.toFixed(2)} SOL ({log.pnlPct >= 0 ? '+' : ''}{log.pnlPct.toFixed(1)}%)
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolSwapLiveTester;
