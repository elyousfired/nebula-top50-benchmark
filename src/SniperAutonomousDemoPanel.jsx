import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, RotateCcw, Download, TrendingUp, ShieldAlert, Award, Clock, ArrowUpRight, ArrowDownRight, Sparkles, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, Zap } from 'lucide-react';

const STORAGE_KEY = 'nebula_sniper_auto_demo_v2_pct';

export default function SniperAutonomousDemoPanel({
  tokensList = [],
  top20Tokens = [],
  realTrajectoryData = {},
  accelerationData = { accList: [] },
  newTop5Tokens = [],
  top5VisitorsList = []
}) {
  const [isBotActive, setIsBotActive] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [, setTick] = useState(0);

  // 🗃️ État persistant du Bot Démo (%)
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading sniper demo state:', e);
    }
    return {
      activePositions: [],
      closedTrades: [],
      lastScanTimestamp: Date.now()
    };
  });

  // Sauvegarder dans le localStorage à chaque mise à jour
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving sniper demo state:', e);
    }
  }, [state]);

  // ⏱️ Horloge d'actualisation temps réel chaque seconde pour le chrono et les gains live
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 🤖 MOTEUR D'EXÉCUTION AUTONOME DU BOT (SURVEILLANCE & DÉCISIONS EN TEMPS RÉEL)
  useEffect(() => {
    if (!isBotActive) return;

    setState(prevState => {
      const now = Date.now();
      let active = [...prevState.activePositions];
      let closed = [...prevState.closedTrades];
      let hasChanges = false;

      // 1. Mettre à jour les positions actives existantes (TP, Trailing Stop, Kill-Switch 30 min)
      active = active.map(pos => {
        const liveToken = tokensList.find(t => t.cleanSymbol === pos.cleanSymbol) || 
                          top20Tokens.find(t => t.cleanSymbol === pos.cleanSymbol);
        
        // VRAI PRIX USD EN DIRECT DEPUIS BYBIT SPOT
        const rawPrice = liveToken?.price ? parseFloat(liveToken.price) : 0;
        const curPrice = rawPrice > 0 ? rawPrice : pos.currentPrice;

        const curScore = liveToken?.score !== undefined ? (typeof liveToken.score === 'number' ? liveToken.score : parseFloat(liveToken.score || 0)) : pos.currentScore;
        const curGainPct = pos.entryPrice > 0 ? parseFloat((((curPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2)) : 0;
        const peakPrice = Math.max(pos.peakPrice || pos.entryPrice, curPrice);
        const maxGainPct = pos.entryPrice > 0 ? parseFloat((((peakPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2)) : 0;
        const elapsedMinutes = Math.floor((now - pos.entryTimestamp) / (60 * 1000));

        let tpTriggered = pos.tpTriggered;
        let tpReason = pos.tpReason;
        let stopPrice = pos.stopPrice;
        let lockedProfitPct = pos.lockedProfitPct || 0.0;

        // 💰 Règle TP1 (+4.0% de hausse) : ENCAISSEMENT RÉEL DE 50% DU GAIN (+2.0% NET EN POCHE) & Stop au Breakeven sur le reste !
        if (curGainPct >= 4.0 && !tpTriggered) {
          tpTriggered = true;
          lockedProfitPct = parseFloat((curGainPct * 0.5).toFixed(2)); // ex: +4.0% * 0.5 = +2.0% net garanti en poche
          stopPrice = pos.entryPrice; // Stop au prix d'entrée (0.00% de risque sur les 50% restants)
          tpReason = `Sécurisation TP1 (+${curGainPct}%) : 50% de la position encaissée (+${lockedProfitPct}% net garanti en poche) et Stop Loss déplacé au Breakeven sur le reste !`;
          hasChanges = true;
        }

        if (curPrice !== pos.currentPrice || curGainPct !== pos.currentGainPct || elapsedMinutes !== pos.elapsedMinutes) {
          hasChanges = true;
        }

        return {
          ...pos,
          currentPrice: curPrice,
          currentScore: curScore,
          currentGainPct: curGainPct,
          peakPrice: peakPrice,
          maxGainPct: maxGainPct,
          elapsedMinutes: elapsedMinutes,
          tpTriggered: tpTriggered,
          tpReason: tpReason,
          stopPrice: stopPrice,
          lockedProfitPct: lockedProfitPct
        };
      });

      // 2. Vérifier les conditions de SORTIE / CLÔTURE
      const remainingActive = [];

      active.forEach(pos => {
        let shouldExit = false;
        let exitReason = '';
        let finalPnlPct = pos.currentGainPct;

        // Cas A : Règle du Chrono 30 Minutes (Kill-Switch)
        if (pos.elapsedMinutes >= 30 && pos.maxGainPct < 1.2 && !pos.tpTriggered) {
          shouldExit = true;
          exitReason = `Sortie Coupe-Circuit (30 min) : ${pos.cleanSymbol} n'a pas accéléré au bout de 30 min (PnL: ${pos.currentGainPct}%). Clôture chirurgicale pour libérer la position.`;
        }
        // Cas B : Plongeon sous le Stop Loss / Breakeven
        else if (pos.stopPrice && pos.currentPrice <= pos.stopPrice) {
          shouldExit = true;
          if (pos.tpTriggered) {
            finalPnlPct = pos.lockedProfitPct || 2.0; // Conserve les 50% de gains encaissés au TP1
            exitReason = `Sortie Sécurisée (+${finalPnlPct}%) : 50% de gains encaissés au TP1 (+4%) et 50% clôturés au Breakeven. Bénéfice net validé !`;
          } else {
            exitReason = `Sortie Stop Loss (-${Math.abs(pos.currentGainPct)}%) : Niveau d'invalidation atteint sous le creux de départ.`;
          }
        }
        // Cas C : Trailing Stop après TP1 (si le prix retrace de plus de 2.5% depuis son pic max)
        else if (pos.tpTriggered && (pos.maxGainPct - pos.currentGainPct) >= 2.5 && pos.currentGainPct >= 3.0) {
          shouldExit = true;
          const remainingGain = parseFloat((pos.currentGainPct * 0.5).toFixed(2));
          finalPnlPct = parseFloat(((pos.lockedProfitPct || 2.0) + remainingGain).toFixed(2));
          exitReason = `Sortie Trailing Stop (+${finalPnlPct}%) : TP1 encaissé (+${pos.lockedProfitPct}%) + sommet capturé sur le reste (Pic: +${pos.maxGainPct}%).`;
        }
        // Cas D : Le token plonge lourdement sous le score radar (-2.5 pts)
        else if (pos.currentScore <= -2.5 && pos.currentGainPct < 0 && !pos.tpTriggered) {
          shouldExit = true;
          exitReason = `Sortie Invalidation Radar : La courbe est passée sous la ligne blanche du marché (-2.5 pts).`;
        }

        if (shouldExit) {
          hasChanges = true;
          closed.unshift({
            id: pos.id,
            symbol: pos.symbol,
            cleanSymbol: pos.cleanSymbol,
            entryTimestamp: pos.entryTimestamp,
            exitTimestamp: now,
            entryPrice: pos.entryPrice,
            exitPrice: pos.currentPrice,
            entryScore: parseFloat(pos.entryScore?.toFixed(1) || 0),
            finalScore: parseFloat(pos.currentScore?.toFixed(1) || 0),
            maxGainPct: pos.maxGainPct,
            finalPnlPct: finalPnlPct,
            entryReason: pos.entryReason,
            tpReason: pos.tpReason || 'Aucun (Sortie avant TP1)',
            exitReason: exitReason,
            outcome: finalPnlPct >= 1.0 ? 'WIN' : (finalPnlPct > -1.0 ? 'BREAKEVEN' : 'CUT')
          });
        } else {
          remainingActive.push(pos);
        }
      });

      active = remainingActive;

            // 3. Détecter de NOUVELLES ENTRÉES SNIPER (SANS AUCUNE LIMITE : ENTRÉE SUR TOUS LES TOKENS VALIDES !)
        const candidates = [];

        // Source 1 : Nouveaux Live Top 5 (comme SPX, PUMP ou S)
        if (newTop5Tokens && newTop5Tokens.length > 0) {
          newTop5Tokens.forEach(t => {
            const sym = t.cleanSymbol;
            const tokAcc = accelerationData?.accList?.find(a => a.cleanSymbol === sym)?.accPct || 0;
            
            // Récupérer le VRAI score sur la courbe (ex: 9.24 pts pour SPX au lieu de l'agrégat 25.4)
            const curve = realTrajectoryData?.tokenCurvesMap?.[sym] || [];
            const curVal = curve.length > 0 ? (curve[curve.length - 1] || 0) : (typeof t.score === 'number' ? t.score : parseFloat(t.score || 0));
            const actualCurveScore = parseFloat(curVal.toFixed(1));

            if (tokAcc >= 1.0 && actualCurveScore <= 14.0 && actualCurveScore >= -2.0) {
              candidates.push({
                cleanSymbol: sym,
                symbol: t.symbol || `${sym}USDT`,
                score: actualCurveScore,
                acc: tokAcc
              });
            }
          });
        }

        // Source 2 : Visiteurs Récents du Top 5 (< 3.5h) avec Accélération Active >= +1.0%/h
        if (top5VisitorsList && top5VisitorsList.length > 0) {
          top5VisitorsList.forEach(v => {
            const sym = v.sym;
            const curve = realTrajectoryData?.tokenCurvesMap?.[sym] || [];
            const curVal = curve.length > 0 ? (curve[curve.length - 1] || 0) : v.currentScore;
            const actualCurveScore = parseFloat(curVal.toFixed(1));

            const isFresh = v.hoursInTop5 <= 3.5 && v.entryScore <= 12.0 && actualCurveScore <= 14.0 && actualCurveScore >= -2.0;
            if (isFresh) {
              const tokAcc = accelerationData?.accList?.find(a => a.cleanSymbol === sym)?.accPct || 0;
              if (tokAcc >= 1.0) {
                if (!candidates.some(c => c.cleanSymbol === sym)) {
                  candidates.push({
                    cleanSymbol: sym,
                    symbol: `${sym}USDT`,
                    score: actualCurveScore,
                    acc: tokAcc
                  });
                }
              }
            }
          });
        }

        // Exécuter l'achat sur les candidats
        candidates.forEach(cand => {
          // Aucune limite de slots : entrée sur tous les tokens qualifiés
          const isAlreadyIn = active.some(p => p.cleanSymbol === cand.cleanSymbol);
          const wasRecentlyClosed = closed.some(c => c.cleanSymbol === cand.cleanSymbol && (now - c.exitTimestamp) < 15 * 60 * 1000);

          if (!isAlreadyIn && !wasRecentlyClosed) {
            const liveToken = tokensList.find(t => t.cleanSymbol === cand.cleanSymbol) || 
                              top20Tokens.find(t => t.cleanSymbol === cand.cleanSymbol);
            
            const rawEntryPrice = liveToken?.price ? parseFloat(liveToken.price) : 0;

            if (rawEntryPrice > 0) {
              hasChanges = true;
              active.push({
                id: `${cand.cleanSymbol}_${now}`,
                symbol: cand.symbol || `${cand.cleanSymbol}USDT`,
                cleanSymbol: cand.cleanSymbol,
                entryTimestamp: now,
                entryPrice: rawEntryPrice,
                currentPrice: rawEntryPrice,
                peakPrice: rawEntryPrice,
                entryScore: cand.score,
                currentScore: cand.score,
                entryAcc: cand.acc,
                currentGainPct: 0.0,
                maxGainPct: 0.0,
                elapsedMinutes: 0,
                tpTriggered: false,
                tpReason: '',
                stopPrice: rawEntryPrice * 0.95, // Stop initial à -5.0%
                entryReason: `Entrée Sniper : Nouveau Top 5 avec Accélération (+${cand.acc}%/h) et Score sain (${cand.score} pts).`
              });
            }
          }
        });

        if (hasChanges) {
        return {
          ...prevState,
          activePositions: active,
          closedTrades: closed.slice(0, 100),
          lastScanTimestamp: now
        };
      }
      return prevState;
    });
  }, [tokensList, top20Tokens, newTop5Tokens, top5VisitorsList, realTrajectoryData, accelerationData, isBotActive]);

  // 📊 CALCUL DES MÉTRIQUES CLÉS EN POURCENTAGE (%)
  const metrics = useMemo(() => {
    const totalTrades = state.closedTrades.length;
    if (totalTrades === 0) {
      return {
        totalPnlPct: 0.0,
        winRatePct: 0,
        winCount: 0,
        cutCount: 0,
        avgGainPct: 0.0,
        avgLossPct: 0.0,
        profitFactor: 0.0
      };
    }

    const wins = state.closedTrades.filter(t => t.finalPnlPct > 0);
    const losses = state.closedTrades.filter(t => t.finalPnlPct < 0);

    const totalGainPct = wins.reduce((acc, t) => acc + t.finalPnlPct, 0);
    const totalLossPct = Math.abs(losses.reduce((acc, t) => acc + t.finalPnlPct, 0));
    const totalPnlPct = parseFloat((totalGainPct - totalLossPct).toFixed(2));

    const winRatePct = parseFloat(((wins.length / totalTrades) * 100).toFixed(1));
    const avgGainPct = wins.length > 0 ? parseFloat((totalGainPct / wins.length).toFixed(2)) : 0.0;
    const avgLossPct = losses.length > 0 ? parseFloat((totalLossPct / losses.length).toFixed(2)) : 0.0;
    const profitFactor = totalLossPct > 0 ? parseFloat((totalGainPct / totalLossPct).toFixed(2)) : (totalGainPct > 0 ? 99.9 : 0.0);

    return {
      totalPnlPct,
      winRatePct,
      winCount: wins.length,
      cutCount: losses.length,
      avgGainPct,
      avgLossPct,
      profitFactor
    };
  }, [state.closedTrades]);

  // 📥 TÉLÉCHARGER LE RAPPORT PDF DES TRADES AVEC LES EXPLICATIONS PÉDAGOGIQUES
  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour télécharger le PDF.");
      return;
    }

    const tradesRows = state.closedTrades.map((t, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: bold; color: #0f172a; font-size: 13px;">${t.cleanSymbol}</td>
        <td style="padding: 10px 12px; color: #475569; font-size: 11px;">
          🕒 ${new Date(t.entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ➔ ${new Date(t.exitTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td style="padding: 10px 12px; font-weight: 800; font-size: 13px; color: ${t.finalPnlPct >= 0 ? '#16a34a' : '#dc2626'};">
          ${t.finalPnlPct >= 0 ? '+' : ''}${t.finalPnlPct}%
        </td>
        <td style="padding: 10px 12px; font-size: 11px; color: #334155; line-height: 1.45;">
          <div style="margin-bottom: 3px;"><strong style="color: #0284c7;">1. Raison d'Entrée :</strong> ${t.entryReason}</div>
          ${t.tpReason && t.tpReason !== 'Aucun (Sortie avant TP1)' ? `<div style="margin-bottom: 3px;"><strong style="color: #16a34a;">2. Sécurisation (TP) :</strong> ${t.tpReason}</div>` : ''}
          <div><strong style="color: ${t.finalPnlPct >= 0 ? '#16a34a' : '#d97706'};">3. Raison de Sortie :</strong> ${t.exitReason}</div>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport_Sniper_Auto_Bot_${new Date().toISOString().split('T')[0]}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 15px; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0; }
          .subtitle { font-size: 11px; color: #64748b; margin: 0; }
          .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .metric-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; }
          .metric-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 3px; }
          .metric-val { font-size: 16px; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #0f172a; color: #ffffff; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">🤖 RAPPORT DES TRADES DU SNIPER AUTO-BOT (DÉMO %)</h1>
          <p class="subtitle">Journal Transparent des Décisions & Performance Pure en Pourcentage • Généré le ${new Date().toLocaleString()}</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Performance Totale (%)</div>
            <div class="metric-val" style="color: ${metrics.totalPnlPct >= 0 ? '#16a34a' : '#dc2626'};">${metrics.totalPnlPct >= 0 ? '+' : ''}${metrics.totalPnlPct}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Taux de Réussite (Win Rate)</div>
            <div class="metric-val" style="color: #0284c7;">${metrics.winRatePct}% (${metrics.winCount}V / ${metrics.cutCount}D)</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Gain Moyen par Fusée</div>
            <div class="metric-val" style="color: #16a34a;">+${metrics.avgGainPct}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Perte Moyenne (Chrono 30m)</div>
            <div class="metric-val" style="color: #d97706;">-${metrics.avgLossPct}%</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 14%;">Jeton</th>
              <th style="width: 18%;">Heures Entrée / Sortie</th>
              <th style="width: 14%;">Résultat Net (%)</th>
              <th style="width: 54%;">Journal des Décisions & Raisons Pédagogiques</th>
            </tr>
          </thead>
          <tbody>
            ${tradesRows || '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">Aucun trade clôturé à exporter.</td></tr>'}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleReset = () => {
    if (window.confirm('Voulez-vous vraiment réinitialiser l’historique des trades du Bot Sniper Démo ?')) {
      setState({
        activePositions: [],
        closedTrades: [],
        lastScanTimestamp: Date.now()
      });
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(6, 12, 24, 0.95), rgba(4, 8, 16, 0.98))',
      border: '1px solid rgba(0, 255, 136, 0.25)',
      borderRadius: '12px',
      padding: '16px 20px',
      margin: '20px 0',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 255, 136, 0.03)'
    }}>
      {/* 🟢 HEADER PRINCIPAL DU BOT */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: isBotActive ? 'rgba(0, 255, 136, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${isBotActive ? '#00ff88' : '#ef4444'}`,
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isBotActive ? '0 0 15px rgba(0, 255, 136, 0.4)' : 'none'
          }}>
            <Zap size={20} color={isBotActive ? '#00ff88' : '#ef4444'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#ffffff', letterSpacing: '0.5px' }}>
                🤖 SNIPER AUTO-BOT 2.0 <span style={{ color: '#00ff88', fontSize: '0.82rem', background: 'rgba(0,255,136,0.12)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(0,255,136,0.3)' }}>DÉMO 100% EN POURCENTAGE (%)</span>
              </span>
              <span style={{
                background: isBotActive ? 'rgba(0, 255, 136, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isBotActive ? '#00ff88' : '#ef4444',
                fontSize: '0.72rem',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '12px',
                border: `1px solid ${isBotActive ? '#00ff88' : '#ef4444'}`
              }}>
                {isBotActive ? '● EN DIRECT & ACTIF' : '⏸️ EN PAUSE'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
              Exécution automatique • TP1 Sécurisation à +4% • Règle Chrono 30 min • Journal Pédagogique Transparent
            </p>
          </div>
        </div>

        {/* BOUTONS D'ACTION */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsBotActive(prev => !prev)}
            style={{
              background: isBotActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 255, 136, 0.15)',
              color: isBotActive ? '#ef4444' : '#00ff88',
              border: `1px solid ${isBotActive ? '#ef4444' : '#00ff88'}`,
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isBotActive ? <Pause size={14} /> : <Play size={14} />}
            {isBotActive ? 'Mettre en Pause' : 'Activer le Bot'}
          </button>

          <button
            onClick={handleExportPdf}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 12px rgba(56,189,248,0.4)'
            }}
            title="Télécharger le rapport imprimable et PDF complet des trades"
          >
            <Download size={14} />
            Télécharger en PDF
          </button>

          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Réinitialiser l’historique des trades du Bot Démo"
          >
            <RotateCcw size={13} />
            Reset
          </button>

          <button
            onClick={() => setIsExpanded(prev => !prev)}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* 📊 BARRE DES MÉTRIQUES CLÉS (%) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '12px',
        margin: '16px 0',
        padding: '12px 14px',
        background: 'rgba(0,0,0,0.5)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        {/* TOTAL CUMULÉ % */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Performance Totale (%)</span>
          <span style={{
            fontSize: '1.35rem',
            fontWeight: '900',
            color: metrics.totalPnlPct >= 0 ? '#00ff88' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {metrics.totalPnlPct >= 0 ? <ArrowUpRight size={22} color="#00ff88" /> : <ArrowDownRight size={22} color="#ef4444" />}
            {metrics.totalPnlPct >= 0 ? `+${metrics.totalPnlPct}%` : `${metrics.totalPnlPct}%`}
          </span>
        </div>

        {/* WIN RATE % */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Taux de Réussite (Win Rate)</span>
          <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#38bdf8' }}>
            {metrics.winRatePct}% <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>({metrics.winCount}V / ${metrics.cutCount}D)</span>
          </span>
        </div>

        {/* GAIN MOYEN PAR GAGNANT */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Gain Moyen par Fusée</span>
          <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#00ff88' }}>
            +{metrics.avgGainPct}%
          </span>
        </div>

        {/* PERTE MOYENNE SUR COUPE */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Perte Moyenne (Chrono 30m)</span>
          <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#f59e0b' }}>
            -{metrics.avgLossPct}%
          </span>
        </div>

        {/* RATIO R/R */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Profit Factor Réel</span>
          <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#e0e7ff' }}>
            {metrics.profitFactor}x
          </span>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 📍 SECTION 1 : POSITIONS EN COURS D'EXÉCUTION (LIVE) */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: '900', color: '#00ff88', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} /> Positions Sniper en Cours ({state.activePositions.length})
              </span>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Surveillance live de chaque bougie</span>
            </div>

            {state.activePositions.length === 0 ? (
              <div style={{ padding: '18px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem' }}>
                🔍 En attente du prochain nouveau token Top 5 avec Accélération ≥ +1.0%/h et Score sain...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {state.activePositions.map(pos => (
                  <div key={pos.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: pos.tpTriggered ? '1px solid #00ff88' : '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#ffffff' }}>{pos.cleanSymbol}</span>
                        <span style={{ fontSize: '0.74rem', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                          Score: {pos.currentScore?.toFixed(1)} pts
                        </span>
                        <span style={{ fontSize: '0.74rem', background: 'rgba(0,255,136,0.15)', color: '#00ff88', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                          Acc: +{pos.entryAcc}%/h
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> Entré à {new Date(pos.entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({pos.elapsedMinutes} min en cours)
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {pos.tpTriggered ? (
                          <span style={{ background: 'rgba(0,255,136,0.2)', color: '#00ff88', fontSize: '0.74rem', fontWeight: '800', padding: '3px 10px', borderRadius: '6px', border: '1px solid #00ff88' }}>
                            🛡️ 100% SÉCURISÉ (BREAKEVEN)
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.74rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px' }}>
                            ⏱️ Test 30 min ({pos.elapsedMinutes}/30m)
                          </span>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{
                            fontSize: '1.2rem',
                            fontWeight: '900',
                            color: pos.currentGainPct >= 0 ? '#00ff88' : '#ef4444'
                          }}>
                            {pos.currentGainPct >= 0 ? `+${pos.currentGainPct}%` : `${pos.currentGainPct}%`}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Prix: ${pos.entryPrice < 1 ? pos.entryPrice.toFixed(4) : pos.entryPrice.toFixed(2)} ➔ ${pos.currentPrice < 1 ? pos.currentPrice.toFixed(4) : pos.currentPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PHRASE D'EXPLICATION LIVE */}
                    <div style={{ background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1', borderLeft: '3px solid #38bdf8' }}>
                      <strong style={{ color: '#38bdf8' }}>🎯 Raison d'Entrée :</strong> {pos.entryReason}
                      {pos.tpReason && (
                        <div style={{ marginTop: '3px', color: '#00ff88' }}>
                          <strong>💰 Sécurisation TP1 :</strong> {pos.tpReason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 📜 SECTION 2 : HISTORIQUE DES TRADES CLÔTURÉS AVEC PHRASES EXPLICATIVES */}
          <div style={{ marginTop: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📜 Journal Transparent des Trades Clôturés ({state.closedTrades.length})
              </span>
            </div>

            {state.closedTrades.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.78rem' }}>
                Aucun trade clôturé pour le moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                {state.closedTrades.map(trade => (
                  <div key={trade.id} style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderLeft: trade.outcome === 'WIN' ? '4px solid #00ff88' : (trade.outcome === 'BREAKEVEN' ? '4px solid #38bdf8' : '4px solid #ef4444'),
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>{trade.cleanSymbol}</strong>
                        <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                          🕒 Entré à {new Date(trade.entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ➔ Sorti à {new Date(trade.exitTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.98rem',
                          fontWeight: '900',
                          color: trade.finalPnlPct >= 0 ? '#00ff88' : '#ef4444'
                        }}>
                          {trade.finalPnlPct >= 0 ? `+${trade.finalPnlPct}%` : `${trade.finalPnlPct}%`}
                        </span>
                      </div>
                    </div>

                    {/* LES 3 PHRASES PÉDAGOGIQUES */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', fontSize: '0.74rem' }}>
                      <div style={{ color: '#94a3b8' }}>
                        <strong style={{ color: '#38bdf8' }}>1. Pourquoi on est entré :</strong> {trade.entryReason}
                      </div>
                      {trade.tpReason && trade.tpReason !== 'Aucun (Sortie avant TP1)' && (
                        <div style={{ color: '#94a3b8' }}>
                          <strong style={{ color: '#00ff88' }}>2. Pourquoi on a sécurisé (TP) :</strong> {trade.tpReason}
                        </div>
                      )}
                      <div style={{ color: '#94a3b8' }}>
                        <strong style={{ color: trade.finalPnlPct >= 0 ? '#00ff88' : '#f59e0b' }}>3. Pourquoi on est sorti :</strong> {trade.exitReason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
