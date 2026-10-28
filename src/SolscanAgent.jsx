import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Upload, X, Bot, Play, ShieldAlert, TrendingUp, TrendingDown, Users, Search, Activity, Target, FileText, Key, BrainCircuit, Zap } from 'lucide-react';
import { fetchLiveTransactions, runAutoDiscovery } from './ApiConnector';

export function SolscanAgent() {
  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  
  // Nouveaux états IA
  // J'ai dû retirer la clé codée en dur car GitHub bloque les clés de sécurité.
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [aiNarrative, setAiNarrative] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [hints, setHints] = useState({});
  const [loadingHints, setLoadingHints] = useState({});
  const [reportLanguage, setReportLanguage] = useState(localStorage.getItem('nebula_lang') || 'FR');
  
  // Nouveaux états de simulation
  const [simConfig, setSimConfig] = useState({ capital: 1000, tradeAmount: 50 });
  const [simResults, setSimResults] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Nouveaux états de découverte auto
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState(null);
  
  const logsEndRef = useRef(null);

  // Nouveaux états Helius Live Scanner
  const [heliusKey, setHeliusKey] = useState('50a90d2c-283e-4694-8c5e-2220f5f95c8b');
  const [targetAddress, setTargetAddress] = useState('');
  const [isScanningLive, setIsScanningLive] = useState(false);

  // Nouveaux états Deep Scan
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [deepScanProgress, setDeepScanProgress] = useState({ current: 0, total: 0 });
  const [deepScanResults, setDeepScanResults] = useState(null);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), msg, type }]);
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  const runLiveScan = async (addressToScan = null) => {
    const scanTarget = addressToScan || targetAddress;
    if (!scanTarget || !heliusKey) return;
    setTargetAddress(scanTarget);
    setLogs([]);
    setResults(null);
    setSelectedWallet(null);
    setIsScanningLive(true);
    setFile(null); // On désélectionne le CSV s'il y en avait un

    addLog("DÉMARRAGE DU SCANNER LIVE VIA HELIUS...", "title");
    addLog(`Cible : ${scanTarget.slice(0,8)}...`);
    
    try {
      addLog("Interrogation de la blockchain Solana (API Helius)...", "process");
      const mappedData = await fetchLiveTransactions(scanTarget, heliusKey);
      
      addLog(`Extraction réussie : ${mappedData.length} transactions récupérées.`, "success");
      
      // On injecte les données Helius dans notre algorithme existant !
      const { allWallets, totalVolume } = await detectFormatAndProcess(mappedData, true);
      
      addLog(`Profilage terminé : ${allWallets.length} portefeuilles uniques analysés.`, 'success');
      await delay(1000);

      const topProfitable = [...allWallets].sort((a, b) => b.pnl - a.pnl).slice(0, 10);
      const topAccumulators = [...allWallets].sort((a, b) => b.net - a.net).slice(0, 10);
      const topDumpers = [...allWallets].sort((a, b) => a.net - b.net).slice(0, 10);

      addLog('Génération du rapport détaillé...', 'process');
      await delay(800);
      addLog('--- ANALYSE TERMINÉE ---', 'title');

      setResults({
        totalTransactions: mappedData.length,
        uniqueWallets: allWallets.length,
        totalVolume,
        hasSwaps: true, // Les données Helius Live contiennent toujours l'action
        topProfitable: topProfitable.filter(w => w.pnl > 0),
        topAccumulators: topAccumulators.filter(w => w.net > 0),
        topDumpers: topDumpers.filter(w => w.net < 0)
      });
      
      // Auto-trigger AI if scanning a specific candidate from discovery
      if (scanTarget && allWallets.length > 0) {
        const targetW = allWallets.find(w => w.address === scanTarget) || allWallets[0];
        handleWalletClick(targetW);
      }
      
    } catch (err) {
      addLog(`Erreur de connexion Live : ${err.message}`, "error");
    } finally {
      setIsScanningLive(false);
    }
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
    localStorage.setItem('gemini_api_key', e.target.value);
  };

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setLogs([]);
      setResults(null);
      addLog(`Fichier chargé : ${selectedFile.name}`, 'success');
      addLog('Prêt pour l\'analyse intelligente. Cliquez sur LANCER LE PROFILAGE.', 'info');
    }
  };

  const clearAgent = () => {
    setFile(null);
    setResults(null);
    setLogs([]);
    setIsAnalyzing(false);
    setSelectedWallet(null);
    setDiscoveryResults(null);
  };

  const handleAutoDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveryResults(null);
    setSelectedWallet(null);
    setResults(null);
    
    setLogs([{ type: 'title', message: 'LANCEMENT DU RADAR À BALEINES...' }]);
    await delay(500);
    addLog('Balayage des hubs de liquidité Solana (USDC, JUP)...', 'process');
    
    try {
      const candidates = await runAutoDiscovery(heliusKey);
      addLog(`Succès ! ${candidates.length} candidats identifiés.`, 'success');
      setDiscoveryResults(candidates);
    } catch (err) {
      addLog(`Erreur du Radar : ${err.message}`, 'error');
    } finally {
      setIsDiscovering(false);
    }
  };

  const runDeepScan = async () => {
    if (!discoveryResults || discoveryResults.length === 0 || !heliusKey) return;
    
    setIsDeepScanning(true);
    setDeepScanResults(null);
    setLogs([{ type: 'title', message: 'LANCEMENT DU DEEP SCAN (MAX PUISSANCE)...' }]);
    
    // On prend un maximum de 50 baleines pour éviter de saturer l'API
    const targets = discoveryResults.slice(0, 50);
    setDeepScanProgress({ current: 0, total: targets.length });
    
    let allProcessedWallets = [];
    
    try {
      for (let i = 0; i < targets.length; i++) {
        const candidate = targets[i];
        setDeepScanProgress({ current: i + 1, total: targets.length });
        addLog(`[${i+1}/${targets.length}] Extraction des données pour : ${candidate.address.slice(0,8)}...`, 'process');
        
        try {
          const mappedData = await fetchLiveTransactions(candidate.address, heliusKey);
          if (mappedData && mappedData.length > 0) {
            // Profilage rapide (on ne garde que ce portefeuille spécifique)
            const { allWallets } = await detectFormatAndProcess(mappedData, true, true);
            const w = allWallets.find(x => x.address === candidate.address);
            if (w) allProcessedWallets.push(w);
          }
        } catch (e) {
          console.warn("Erreur sur portefeuille", candidate.address, e);
        }
        
        // Délai pour ne pas se faire ban par Helius (Rate Limit)
        await delay(300);
      }
      
      addLog(`Deep Scan terminé. ${allProcessedWallets.length} portefeuilles profilés.`, 'success');
      
      // Agrégation Globale
      const strategyCounts = {};
      let totalPnl = 0;
      let totalVolume = 0;
      
      allProcessedWallets.forEach(w => {
        strategyCounts[w.strategy] = (strategyCounts[w.strategy] || 0) + 1;
        if (!isNaN(w.pnl)) totalPnl += w.pnl;
        totalVolume += w.spentUSD + w.earnedUSD;
      });
      
      setDeepScanResults({
        wallets: allProcessedWallets.sort((a,b) => b.pnl - a.pnl), // triés par PnL
        strategyCounts,
        totalPnl,
        totalVolume
      });
      
    } catch (err) {
      addLog(`Erreur critique Deep Scan: ${err.message}`, 'error');
    } finally {
      setIsDeepScanning(false);
    }
  };

  const parseNumber = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(/,/g, '').replace(/\$/g, '')) || 0;
  };

  const detectFormatAndProcess = async (data, isLive = false, silent = false) => {
    if (data.length === 0) throw new Error("Le fichier CSV est vide.");

    const firstRow = data[0];
    const keys = Object.keys(firstRow).map(k => k.toLowerCase());
    
    const hasSwaps = keys.some(k => k.includes('price') || k.includes('token in') || k.includes('token out'));
    
    if (!silent) {
      if (isLive) {
        addLog("Format détecté : DONNÉES LIVE HELIUS (Swaps intégrés)", 'process');
      } else {
        addLog(hasSwaps ? "Format détecté : DEFI TRADES (Calcul de PNL possible)" : "Format détecté : TRANSFERS SIMPLES (Calcul d'accumulation)", 'process');
      }
      await delay(1000);
    }

    let wallets = {};
    let totalVolume = 0;

    data.forEach(row => {
      const rKeys = Object.keys(row);
      const getVal = (keywords) => {
        for(let k of rKeys) {
          if (keywords.some(word => k.toLowerCase().includes(word))) return row[k];
        }
        return null;
      };

      const from = getVal(['sender', 'from', 'maker', 'owner']) || Object.values(row)[3];
      const to = getVal(['receiver', 'to']) || Object.values(row)[4];
      let amount = parseNumber(getVal(['amount', 'value', 'size', 'token amount']) || Object.values(row)[5]);
      const decimalsStr = getVal(['decimals']);
      if (decimalsStr && !isNaN(parseNumber(decimalsStr))) {
        amount = amount / Math.pow(10, parseNumber(decimalsStr));
      }

      const tokenIn = getVal(['token in', 'buy token']);
      const tokenOut = getVal(['token out', 'sell token']);
      const priceStr = getVal(['price', 'usd']);
      const actionStr = getVal(['action', 'type']);

      if (amount === 0) return;
      totalVolume += amount;

      const targetWallet = from || to;
      if (!targetWallet) return;

      if (!wallets[targetWallet]) {
        wallets[targetWallet] = { 
          address: targetWallet, 
          received: 0, sent: 0, net: 0, txCount: 0, 
          spentUSD: 0, earnedUSD: 0, pnl: 0,
          strategy: 'Inconnu',
          timeline: []
        };
      }

      let w = wallets[targetWallet];
      w.txCount += 1;

      if (from === targetWallet) { w.sent += amount; w.net -= amount; w.timeline.push({ type: 'TRANSFER_OUT', amount }); }
      if (to === targetWallet) { w.received += amount; w.net += amount; w.timeline.push({ type: 'TRANSFER_IN', amount }); }

      const isBuy = actionStr && actionStr.toLowerCase().includes('buy');
      const isSell = actionStr && actionStr.toLowerCase().includes('sell');
      const price = parseNumber(priceStr);

      if (price > 0) {
        const tokenB = tokenIn || 'Token ciblé';
        const tokenS = tokenOut || 'SOL/USDC';
        if (isBuy || (tokenOut && tokenOut.toLowerCase().includes('sol'))) {
          w.spentUSD += (amount * price);
          w.timeline[w.timeline.length - 1] = { type: 'BUY', amount, value: amount * price, tokenB, tokenS };
        } else if (isSell || (tokenIn && tokenIn.toLowerCase().includes('sol'))) {
          w.earnedUSD += (amount * price);
          w.timeline[w.timeline.length - 1] = { type: 'SELL', amount, value: amount * price, tokenB: tokenS, tokenS: tokenB }; // Inverse pour les ventes
        }
      }
    });

    const allWallets = Object.values(wallets);
    
    if (!silent) {
      addLog("Exécution de l'algorithme de détection comportementale...", 'process');
      await delay(1500);
    }

    allWallets.forEach(w => {
      if (w.spentUSD > 0 || w.earnedUSD > 0) {
        w.pnl = w.earnedUSD - w.spentUSD;
      }
      w.timeline.reverse();

      if (w.txCount > 50 && w.net > -100 && w.net < 100) w.strategy = '🤖 Bot Wash Trading';
      else if (w.pnl > 10000) w.strategy = '🎯 Master Trader';
      else if (w.pnl > 0) w.strategy = '✅ Trader Rentable';
      else if (w.txCount <= 5 && w.net > 0 && w.sent === 0) w.strategy = '💎 Diamond Hands';
      else if (w.sent > w.received * 10) w.strategy = '📤 Distributeur / Dev';
      else if (w.net < 0 && w.txCount < 5) w.strategy = '🚨 Panic Seller';
      else if (w.received > 0 && w.sent > 0) w.strategy = '🌊 Swing Trader';
      else w.strategy = 'Retail Investisseur';
    });

    return { allWallets, totalVolume, hasSwaps };
  };

  const startAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setLogs([]);
    setResults(null);
    setSelectedWallet(null);
    
    addLog('DÉMARRAGE DE L\'AGENT SOLSCAN IA...', 'title');
    await delay(800);
    addLog(`Lecture de ${file.name}...`, 'process');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          addLog(`Extraction réussie : ${parsed.data.length} lignes trouvées.`, 'success');
          await delay(800);
          
          const { allWallets, totalVolume, hasSwaps } = await detectFormatAndProcess(parsed.data);

          addLog(`Profilage terminé : ${allWallets.length} portefeuilles uniques analysés.`, 'success');
          await delay(1000);

          const topProfitable = [...allWallets].sort((a, b) => b.pnl - a.pnl).slice(0, 10);
          const topAccumulators = [...allWallets].sort((a, b) => b.net - a.net).slice(0, 10);
          const topDumpers = [...allWallets].sort((a, b) => a.net - b.net).slice(0, 10);

          addLog('Génération du rapport détaillé...', 'process');
          await delay(800);
          addLog('--- ANALYSE TERMINÉE ---', 'title');

          setResults({
            totalTransactions: parsed.data.length,
            uniqueWallets: allWallets.length,
            totalVolume,
            hasSwaps,
            topProfitable: topProfitable.filter(w => w.pnl > 0),
            topAccumulators: topAccumulators.filter(w => w.net > 0),
            topDumpers: topDumpers.filter(w => w.net < 0)
          });

        } catch (error) {
          addLog(`Erreur de l'Agent : ${error.message}`, 'error');
        } finally {
          setIsAnalyzing(false);
        }
      },
      error: (error) => {
        addLog(`Erreur de lecture CSV : ${error.message}`, 'error');
        setIsAnalyzing(false);
      }
    });
  };

  const WALLET_PROFILES_DB = [
    {
      name: '🎯 Le Sniper / Découvreur',
      match: (w, buys, sells) => buys.length > 0 && w.txCount <= 10 && w.pnl > 500,
      narrative: (w, tokens) => `Ce portefeuille détecte les pépites très tôt. Il n'a fait que quelques transactions ultra-ciblées sur <b>${tokens}</b> et a généré des profits rapides (+$${w.pnl.toLocaleString(undefined, {maximumFractionDigits:0})}).`,
      action: `👉 <b>Action de Copie :</b> Copie aveugle rapide. C'est du Smart Money pur.`
    },
    {
      name: '💎 Diamond Hands (Accumulateur)',
      match: (w, buys, sells) => buys.length > 0 && sells.length === 0,
      narrative: (w, tokens) => `Accumulation agressive de <b>${tokens}</b>. Il n'a JAMAIS rien revendu. Ce portefeuille construit un bag massif (${w.received.toLocaleString()} jetons) et attend une explosion du prix.`,
      action: `👉 <b>Action de Copie :</b> Surveillez ses cibles. S'il ne vend pas, c'est qu'il sait quelque chose. Suivez le mouvement.`
    },
    {
      name: '🕵️‍♂️ Insider / Équipe Projet',
      match: (w, buys, sells) => buys.length === 0 && sells.length > 0 && w.sent > 10000,
      narrative: (w, tokens) => `<b>Alerte Rouge :</b> Ce portefeuille n'a jamais acheté. Il n'a fait que VENDRE ou transférer massivement des tokens reçus de l'extérieur. Probablement un développeur ou distributeur.`,
      action: `👉 <b>Action :</b> DANGER ! Fuyez ce jeton s'il continue de dumper.`
    },
    {
      name: '🌊 Swing Trader Rentable',
      match: (w, buys, sells) => buys.length > 0 && sells.length > 0 && w.pnl > 0,
      narrative: (w, tokens) => `Trader agile et rentable. Il entre et sort activement du marché sur les vagues de volatilité (+$${w.pnl.toLocaleString(undefined, {maximumFractionDigits:0})}).`,
      action: `👉 <b>Action de Copie :</b> Bon candidat pour du Copy Trading actif.`
    },
    {
      name: '🚨 Panic Seller (Retail)',
      match: (w, buys, sells) => w.pnl < 0 && sells.length > 0,
      narrative: (w, tokens) => `Comportement retail typique. Il achète tard (FOMO) et revend en panique à perte (-$${Math.abs(w.pnl).toLocaleString(undefined, {maximumFractionDigits:0})}).`,
      action: `👉 <b>Action :</b> Ne pas copier. Portefeuille perdant.`
    },
    {
      name: '📈 Accumulateur Stratégique (DCA In)',
      match: (w, buys, sells) => buys.length > sells.length * 2,
      narrative: (w, tokens) => `Une stratégie d'accumulation. Il achète silencieusement par petites tranches (DCA In) sur <b>${tokens}</b> pour lisser son prix d'entrée.`,
      action: `👉 <b>Action de Copie :</b> Suivez ses zones d'accumulation point par point.`
    },
    {
      name: '📉 Le Liquidateur (DCA Out)',
      match: (w, buys, sells) => sells.length > buys.length * 2,
      narrative: (w, tokens) => `Il revend <b>${tokens}</b> par petites tranches pour sécuriser des profits sans effondrer le marché d'un seul coup.`,
      action: `👉 <b>Action :</b> Prudence, la pression vendeuse est constante.`
    },
    {
      name: '🤖 Bot d\'Arbitrage / Wash Trading',
      match: (w, buys, sells) => w.txCount > 40,
      narrative: (w, tokens) => `Une activité frénétique avec ${w.txCount} transactions entrantes et sortantes. Il trade les écarts de prix minuscules ou génère du faux volume.`,
      action: `👉 <b>Action :</b> Ne pas copier manuellement. Réservé aux bots HFT.`
    },
    {
      name: '⚖️ Portefeuille Actif (Hold / Break-even)',
      match: (w, buys, sells) => buys.length > 0 && sells.length > 0,
      narrative: (w, tokens) => `Le portefeuille échange activement <b>${tokens}</b> mais n'a pas encore dégagé de profit majeur (ou le prix des jetons n'est pas coté en USD).`,
      action: `👉 <b>Action :</b> Surveillez l'évolution de son bag avant de copier.`
    },
    {
      name: '🏦 Le Coffre-Fort',
      match: (w, buys, sells) => w.net > 0 && w.spentUSD === 0,
      narrative: (w, tokens) => `Il agit comme un coffre-fort de transit pour ${w.net.toLocaleString(undefined, {maximumFractionDigits:0})} jetons. Pas d'achats en USD détectés.`,
      action: `👉 <b>Action :</b> Analyse plus poussée requise sur ses portefeuilles liés.`
    },
    {
      name: '🔍 Portefeuille de Transit',
      match: (w, buys, sells) => true, // Fallback ultime
      narrative: (w, tokens) => `Mouvements de fonds de routine, simples transferts ou liquidations sans pattern stratégique précis sur <b>${tokens}</b>.`,
      action: `👉 <b>Action :</b> Ignorer. Aucun signal d'achat clair.`
    }
  ];

  const generateNarrativeLocal = (w) => {
    const buys = w.timeline.filter(t => t.type === 'BUY' || t.type === 'TRANSFER_IN');
    const sells = w.timeline.filter(t => t.type === 'SELL' || t.type === 'TRANSFER_OUT');
    
    // Détection des tokens
    const tokensArray = [...new Set([...buys, ...sells].map(t => t.tokenB).filter(t => t && t !== 'Token ciblé'))];
    const tokens = tokensArray.length > 0 ? tokensArray.join(', ') : 'certains tokens';

    // MATCHING ENGINE (On trouve le premier profil qui correspond)
    const profile = WALLET_PROFILES_DB.find(p => p.match(w, buys, sells));

    // Création du rendu HTML du rapport
    let narrative = `<div style="margin-bottom: 15px;">`;
    narrative += `<div style="color: #00d0ff; font-weight: bold; font-size: 1.1rem; margin-bottom: 10px;">${profile.name}</div>`;
    narrative += `<div>${profile.narrative(w, tokens)}</div>`;
    narrative += `</div>`;
    
    narrative += `<div style="background: rgba(0,0,0,0.3); padding: 10px; border-left: 3px solid ${profile.action.includes('Ne pas copier') || profile.action.includes('DANGER') ? '#ff3b30' : '#00ff88'}; border-radius: 4px;">`;
    narrative += `${profile.action}`;
    narrative += `</div>`;

    return narrative;
  };

  // TRUE AI GENERATION WITH SMART FALLBACK
  const handleWalletClick = async (w) => {
    setSelectedWallet(w);
    setIsAiThinking(true);
    
    // Si aucune clé n'est fournie, on utilise directement notre algorithme local
    if (!apiKey || apiKey.trim() === '') {
      setAiNarrative('Analyse via le moteur heuristique interne (Mode sans clé)...');
      await delay(1200);
      setAiNarrative(generateNarrativeLocal(w));
      setIsAiThinking(false);
      return;
    }

    setAiNarrative('Connexion au réseau neuronal Google... Analyse du journal de transactions en cours...');

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const txSummary = w.timeline.slice(0, 20).map(t => `${t.type} de ${t.amount.toLocaleString(undefined, {maximumFractionDigits:2})} jetons${t.value ? ` ($${t.value.toFixed(2)})` : ''}`).join(', ');
      const langInstruction = reportLanguage === 'AR' ? 'IMPORTANT: Tu dois rédiger tout ce rapport EXCLUSIVEMENT en langue Arabe (Arabic).' : (reportLanguage === 'EN' ? 'IMPORTANT: Write this entire report EXCLUSIVELY in English.' : 'IMPORTANT: Tu dois rédiger ce rapport en Français.');
      
      const prompt = `Tu es l'Agent Détective Blockchain officiel de Nebula Scanner. Tu dois rédiger un rapport d'investigation psychologique et stratégique sur un portefeuille Solana.
Voici ses données exactes :
- Adresse : ${w.address}
- Nombre de transactions : ${w.txCount}
- Profit/Perte estimé : ${w.pnl > 0 ? '+' : ''}$${w.pnl.toFixed(2)}
- Algorithme de base détecté : ${w.strategy}
- Volume accumulé non vendu : ${w.net} jetons
- Dernières Actions : ${txSummary}

Analyse ses dernières actions et donne-moi les ÉTAPES EXACTES de ce qu'il a fait (Exemple: "Il a commencé par accumuler 1000 jetons, puis il a dumpé 500 jetons au sommet..."). Sois précis, donne les montants s'il y en a, et dis s'il faut le copier ou non. Utilise du HTML basique (<b>, <br>, <ul><li>) pour formater ta réponse de manière esthétique. Ne mets pas de bloc markdown de code.
${langInstruction}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setAiNarrative(response.text());
    } catch (err) {
      // SMART FALLBACK: If Google API fails (404, invalid key, etc), use the local heuristic engine seamlessly
      console.warn("L'API Google a échoué. Basculement sur le moteur heuristique local Nebula.", err);
      setAiNarrative(`L'API Google a échoué (${err.message}). Basculement sur le moteur heuristique local Nebula...`);
      await delay(2500); // Wait longer so the user can read the error
      setAiNarrative(generateNarrativeLocal(w) + `<br/><br/><small style="color:#ff3b30">Info technique: Le rapport détaillé de l'IA a échoué avec l'erreur : ${err.message}</small>`);
    } finally {
      setIsAiThinking(false);
    }
  };

  const fetchHint = async (e, address, contextData) => {
    e.stopPropagation();
    if (!apiKey || apiKey.trim() === '') {
      setHints(prev => ({ ...prev, [address]: "⚠️ Clé API Gemini requise." }));
      return;
    }
    setLoadingHints(prev => ({ ...prev, [address]: true }));
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const langInstruction = reportLanguage === 'AR' ? 'Réponds EXCLUSIVEMENT en langue Arabe (Arabic).' : (reportLanguage === 'EN' ? 'Reply EXCLUSIVELY in English.' : 'Réponds EXCLUSIVEMENT en Français.');
      const prompt = `Tu es l'IA experte Nebula. Décrypte en 2 phrases ultra-courtes la stratégie probable de cette baleine Solana. 
Données : ${contextData}
Donne un "Hint" stratégique percutant. Pas de fioritures.
${langInstruction}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      setHints(prev => ({ ...prev, [address]: response.text() }));
    } catch (err) {
      setHints(prev => ({ ...prev, [address]: `Erreur IA: ${err.message}` }));
    } finally {
      setLoadingHints(prev => ({ ...prev, [address]: false }));
    }
  };

  const simulateCopy = async (w) => {
    setIsSimulating(true);
    setSimResults(null);
    await delay(1200);

    let virtualCapital = simConfig.capital;
    let tokenBag = 0;
    const trades = [];
    let whaleBag = 0;

    w.timeline.forEach(t => {
      if (t.type === 'BUY' && t.value > 0 && t.amount > 0) {
        const price = t.value / t.amount;
        if (virtualCapital >= simConfig.tradeAmount) {
          virtualCapital -= simConfig.tradeAmount;
          const tokensBought = simConfig.tradeAmount / price;
          tokenBag += tokensBought;
          whaleBag += t.amount;
          trades.push({ type: 'BUY', cost: simConfig.tradeAmount });
        }
      } else if (t.type === 'SELL' && t.value > 0 && t.amount > 0) {
        if (whaleBag > 0 && tokenBag > 0) {
          const sellPercentage = Math.min(t.amount / whaleBag, 1);
          const tokensToSell = tokenBag * sellPercentage;
          const price = t.value / t.amount;
          
          const revenue = tokensToSell * price * 0.99; // 1% slippage
          virtualCapital += revenue;
          tokenBag -= tokensToSell;
          whaleBag -= t.amount;
          trades.push({ type: 'SELL', revenue });
        }
      }
    });

    const finalValue = virtualCapital + (tokenBag > 0 && w.timeline.length > 0 ? tokenBag * (w.timeline[w.timeline.length-1].value / w.timeline[w.timeline.length-1].amount || 0) : 0);
    const pnl = finalValue - simConfig.capital;
    
    setSimResults({
      finalCapital: virtualCapital,
      finalValue: finalValue,
      pnl: pnl,
      roi: (pnl / simConfig.capital) * 100,
      tradesCount: trades.length,
      bagLeft: tokenBag
    });
    
    setIsSimulating(false);
  };

  const renderLog = (log) => {
    let style = { color: '#94a3b8', margin: '8px 0', fontFamily: 'monospace', fontSize: '0.9rem' };
    if (log.type === 'title') style = { color: '#fff', fontWeight: 'bold', margin: '20px 0 10px 0', fontSize: '1.1rem' };
    if (log.type === 'process') style = { color: '#fcd34d', fontStyle: 'italic' };
    if (log.type === 'success') style = { color: '#00ff88', fontWeight: 'bold' };
    if (log.type === 'error') style = { color: '#ff3b30', fontWeight: 'bold' };

    return <div key={log.id} style={style} className="terminal-line">{log.msg}</div>;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '15px', background: 'linear-gradient(90deg, rgba(0,208,255,0.1), rgba(139,92,246,0.1))', padding: '10px 25px', borderRadius: '50px', border: '1px solid rgba(0,208,255,0.3)', marginBottom: '15px' }}>
          <BrainCircuit size={24} color="#00d0ff" />
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', fontWeight: '900', letterSpacing: '2px' }}>NEBULA TRUE AI PROFILER</h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '700px', margin: '0 auto', marginBottom: '20px' }}>
          Importez un CSV Solscan. Mon intelligence artificielle va analyser les transactions et rédiger un rapport stratégique en direct.
        </p>
        
        {/* API KEY SETTINGS */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#0f172a', padding: '10px 20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <Key size={18} color="#fcd34d" />
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Clé API Gemini :</span>
          {showSettings ? (
            <input 
              type="password" 
              value={apiKey} 
              onChange={handleApiKeyChange} 
              placeholder="AIzaSy..." 
              style={{ background: '#020617', border: '1px solid #334155', color: '#fff', padding: '5px 10px', borderRadius: '6px', width: '250px', outline: 'none' }}
            />
          ) : (
            <span style={{ color: '#00ff88', fontFamily: 'monospace' }}>•••{apiKey.slice(-4)}</span>
          )}
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', color: '#00d0ff', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}>
            {showSettings ? 'Masquer' : 'Modifier'}
          </button>
          {/* LANGUAGE SELECTOR */}
          <div style={{ marginLeft: '15px', paddingLeft: '15px', borderLeft: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Langue IA :</span>
            <select 
              value={reportLanguage} 
              onChange={(e) => { setReportLanguage(e.target.value); localStorage.setItem('nebula_lang', e.target.value); }}
              style={{ background: '#020617', border: '1px solid #334155', color: '#fff', padding: '4px 8px', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="FR">🇫🇷 Français</option>
              <option value="AR">🇸🇦 العربية</option>
              <option value="EN">🇬🇧 English</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
        
        {/* LEFT COLUMN : CONTROLS & TERMINAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ background: '#0f172a', border: '2px dashed #1e293b', borderRadius: '16px', padding: '2rem', textAlign: 'center', transition: 'all 0.3s', borderColor: (file || discoveryResults) ? '#00ff88' : '#1e293b' }}>
            
            {/* DISCOVERY SECTION */}
            <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #1e293b' }}>
              <button 
                onClick={handleAutoDiscovery}
                disabled={isDiscovering || isDeepScanning || !heliusKey}
                style={{ width: '100%', background: isDiscovering ? '#1e293b' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)', color: '#fff', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: (isDiscovering || isDeepScanning || !heliusKey) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)', marginBottom: discoveryResults ? '15px' : '0' }}
              >
                <Target size={20} />
                {isDiscovering ? 'BALAYAGE EN COURS...' : '📡 DÉTECTION AUTO DES BALEINES'}
              </button>
              
              {discoveryResults && (
                <div style={{ marginTop: '15px' }}>
                  <button 
                    onClick={runDeepScan}
                    disabled={isDeepScanning}
                    style={{ width: '100%', background: isDeepScanning ? '#1e293b' : 'linear-gradient(90deg, #ef4444, #9f1239)', color: '#fff', border: '1px solid #f87171', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: isDeepScanning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
                  >
                    <Activity size={18} />
                    {isDeepScanning ? `DEEP SCAN EN COURS (${deepScanProgress.current}/${deepScanProgress.total})...` : '🚀 LANCER LE DEEP SCAN (MAX PUISSANCE)'}
                  </button>
                  {isDeepScanning && (
                    <div style={{ marginTop: '10px', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#ef4444', width: `${(deepScanProgress.current / deepScanProgress.total) * 100}%`, transition: 'width 0.3s' }}></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* LIVE SCANNER SECTION */}
            <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
                <Zap size={24} color="#fcd34d" />
                <h3 style={{ color: '#fff', margin: 0 }}>Scanner Live (API Helius)</h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>
                Entrez une adresse de Jeton ou de Portefeuille pour analyser ses dernières transactions en temps réel.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  placeholder="Adresse Solana (ex: JUPyiwr...)" 
                  style={{ flex: 1, background: '#020617', border: '1px solid #334155', color: '#fff', padding: '12px 15px', borderRadius: '8px', outline: 'none' }}
                />
                <button 
                  onClick={() => runLiveScan()}
                  disabled={isScanningLive || !targetAddress}
                  style={{ background: isScanningLive ? '#1e293b' : 'linear-gradient(90deg, #f59e0b, #d97706)', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: (isScanningLive || !targetAddress) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Search size={18} />
                  {isScanningLive ? 'SCAN...' : 'SCAN LIVE'}
                </button>
              </div>
            </div>

            {/* CSV UPLOAD SECTION (LEGACY) */}
            <div style={{ opacity: 0.7 }}>
              <p style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Ou utiliser l'ancienne méthode</p>
              {!file ? (
                <>
                  <label style={{ background: '#1e293b', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' }}>
                    <Upload size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
                    Importer un CSV Solscan
                    <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <h4 style={{ color: '#00ff88', margin: '0 0 5px 0' }}>Fichier Prêt</h4>
                    <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>{file.name}</p>
                  </div>
                  <button onClick={() => setFile(null)} style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}><X size={18} /></button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <button 
              onClick={startAnalysis} 
              disabled={!file || isAnalyzing} 
              style={{ flex: 2, background: isAnalyzing ? '#1e293b' : 'linear-gradient(90deg, #00d0ff, #8b5cf6)', color: '#fff', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '900', cursor: (!file || isAnalyzing) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
            >
              <Bot size={20} />
              {isAnalyzing ? 'ANALYSE EN COURS...' : 'LANCER LE PROFILAGE'}
            </button>
            <button onClick={clearAgent} style={{ flex: 1, background: '#1e293b', color: '#ff3b30', border: '1px solid #334155', padding: '15px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '12px', padding: '15px', height: '250px', overflowY: 'auto', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)' }}>
             {logs.length === 0 ? <div style={{ color: '#334155', fontStyle: 'italic', textAlign: 'center', marginTop: '100px' }}>Agent en veille...</div> : logs.map(renderLog)}
             <div ref={logsEndRef} />
          </div>
        </div>

        {/* RIGHT COLUMN : RESULTS & MODAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* LEADERBOARD RADAR */}
          {discoveryResults && !selectedWallet && !results && (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem', flex: 1 }}>
              <h2 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Target size={20} color="#3b82f6" />
                🎯 TABLEAU DE CHASSE (TOP {discoveryResults.length})
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
                Ces portefeuilles viennent tout juste de trader sur Solana. Cliquez sur l'un d'eux pour lancer l'investigation et le Simulateur.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {discoveryResults.map((candidate, idx) => (
                  <React.Fragment key={idx}>
                  <div 
                    onClick={() => {
                      setTargetAddress(candidate.address);
                      runLiveScan(candidate.address);
                    }}
                    style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '15px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '30px', height: '30px', background: '#0b1320', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {candidate.address.substring(0, 8)}...{candidate.address.substring(candidate.address.length - 6)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>
                          Dernière Action: <span style={{ color: candidate.lastAction === 'ACHAT' ? '#00ff88' : candidate.lastAction === 'VENTE' ? '#ff3b30' : '#00d0ff' }}>{candidate.lastAction}</span>
                        </div>
                        
                        {/* BOUTON HINT IA */}
                        <div style={{ marginTop: '10px' }}>
                          <button 
                            onClick={(e) => fetchHint(e, candidate.address, `Adresse: ${candidate.address}, Tx totales: ${candidate.txCount}, Swaps DeFi: ${candidate.swapsCount}, Dernier mouvement: ${candidate.lastAction}`)}
                            disabled={loadingHints[candidate.address]}
                            style={{ background: 'rgba(0, 208, 255, 0.1)', border: '1px solid #00d0ff', color: '#00d0ff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: loadingHints[candidate.address] ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                          >
                            <BrainCircuit size={12} />
                            {loadingHints[candidate.address] ? 'DÉCRYPTAGE...' : '💡 Hint IA'}
                          </button>
                        </div>

                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 'bold' }}>{candidate.swapsCount} Swaps</div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>sur {candidate.txCount} actions</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* AFFICHAGE DU HINT */}
                  {hints[candidate.address] && (
                    <div style={{ background: 'linear-gradient(90deg, rgba(0, 208, 255, 0.05), transparent)', borderLeft: '3px solid #00d0ff', padding: '10px 15px', borderRadius: '0 8px 8px 0', fontSize: '0.85rem', color: '#e2e8f0', marginTop: '-5px', marginBottom: '10px', fontStyle: 'italic', lineHeight: '1.5' }}>
                      <span dangerouslySetInnerHTML={{ __html: hints[candidate.address].replace(/\\n/g, '<br/>') }} />
                    </div>
                  )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {selectedWallet && (
            <div className="narrative-modal" style={{ background: '#0a0a0a', border: '1px solid #00f0ff', borderRadius: '16px', padding: '2rem', position: 'relative', boxShadow: '0 0 30px rgba(0, 240, 255, 0.1)' }}>
              <button onClick={() => setSelectedWallet(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={24} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <BrainCircuit size={24} color="#00f0ff" className={isAiThinking ? "pulse-anim" : ""} />
                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.3rem' }}>DOSSIER D'INVESTIGATION IA</h2>
              </div>
              
              <div style={{ background: '#1e293b', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px', fontFamily: 'monospace', color: '#00ff88', wordBreak: 'break-all' }}>
                {selectedWallet.address}
              </div>

              <div style={{ color: '#e2e8f0', fontSize: '1.1rem', lineHeight: '1.8', fontStyle: 'italic', background: 'linear-gradient(180deg, #1e293b, #0f172a)', padding: '20px', borderLeft: '4px solid #00f0ff', borderRadius: '8px', position: 'relative', marginBottom: '20px' }}>
                {isAiThinking && <div className="loader-bar"></div>}
                <span dangerouslySetInnerHTML={{ __html: aiNarrative.replace(/\n/g, '<br/>') }} />
              </div>

              {/* SIMULATEUR DE COPY-TRADING */}
              <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <Target size={20} color="#fcd34d" />
                  <h3 style={{ margin: 0, color: '#fff' }}>SIMULATEUR DE COPY-TRADING</h3>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '5px' }}>Capital de départ ($)</label>
                    <input type="number" value={simConfig.capital} onChange={(e) => setSimConfig({...simConfig, capital: Number(e.target.value)})} style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#fff', padding: '10px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '5px' }}>Montant par achat ($)</label>
                    <input type="number" value={simConfig.tradeAmount} onChange={(e) => setSimConfig({...simConfig, tradeAmount: Number(e.target.value)})} style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#fff', padding: '10px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <button 
                  onClick={() => simulateCopy(selectedWallet)}
                  disabled={isSimulating}
                  style={{ width: '100%', background: isSimulating ? '#1e293b' : 'linear-gradient(90deg, #f59e0b, #d97706)', color: '#fff', border: 'none', padding: '15px', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: isSimulating ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                >
                  <Play size={18} />
                  {isSimulating ? 'SIMULATION EN COURS...' : 'LANCER LE BACKTEST DE COPIE'}
                </button>

                {simResults && (
                  <div style={{ marginTop: '20px', padding: '20px', background: simResults.pnl >= 0 ? 'rgba(0, 255, 136, 0.05)' : 'rgba(255, 59, 48, 0.05)', border: `1px solid ${simResults.pnl >= 0 ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 59, 48, 0.2)'}`, borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#fff', textAlign: 'center' }}>RÉSULTATS DU BACKTEST</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center' }}>
                      <div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Capital Final (Jetons Inclus)</div>
                        <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>${simResults.finalValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Profit / Perte</div>
                        <div style={{ color: simResults.pnl >= 0 ? '#00ff88' : '#ff3b30', fontSize: '1.2rem', fontWeight: 'bold' }}>{simResults.pnl >= 0 ? '+' : ''}${simResults.pnl.toFixed(2)} ({simResults.roi.toFixed(2)}%)</div>
                      </div>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: '15px' }}>
                      Basé sur {simResults.tradesCount} trades virtuels exécutés proportionnellement.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(!results && !discoveryResults && !deepScanResults) ? (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic', minHeight: '400px' }}>
              Le profil des portefeuilles s'affichera ici.
            </div>
          ) : deepScanResults && !selectedWallet ? (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem', flex: 1 }}>
              <h2 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={20} color="#fcd34d" />
                RÉSULTAT GLOBAL DU DEEP SCAN
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(0, 208, 255, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(0, 208, 255, 0.2)' }}>
                  <div style={{ color: '#00d0ff', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase' }}>Baleines Analysées</div>
                  <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>{deepScanResults.wallets.length}</div>
                </div>
                <div style={{ background: 'rgba(0, 255, 136, 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(0, 255, 136, 0.2)' }}>
                  <div style={{ color: '#00ff88', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase' }}>Profit Total Cumulé</div>
                  <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>${deepScanResults.totalPnl.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                </div>
              </div>
              
              <h3 style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase' }}>Répartition Stratégique</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                {Object.entries(deepScanResults.strategyCounts).sort((a,b) => b[1] - a[1]).map(([strat, count]) => (
                  <div key={strat} style={{ background: '#1e293b', padding: '8px 12px', borderRadius: '20px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    <span style={{ fontWeight: 'bold', color: '#fff', marginRight: '5px' }}>{count}</span> {strat}
                  </div>
                ))}
              </div>
              
              <h3 style={{ color: '#00ff88', fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase' }}>🏆 Top 5 Baleines (Meilleur PNL)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {deepScanResults.wallets.filter(w => !isNaN(w.pnl)).slice(0, 5).map((w, i) => (
                   <div key={i} onClick={() => handleWalletClick(w)} style={{ background: '#020617', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }} className="wallet-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 'bold' }}>{w.address.slice(0,6)}...{w.address.slice(-4)}</span>
                        <span style={{ color: w.pnl >= 0 ? '#00ff88' : '#ff3b30', fontWeight: 'bold' }}>{w.pnl >= 0 ? '+' : ''}${w.pnl.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#fcd34d' }}>{w.strategy}</span>
                        <span style={{ color: '#64748b' }}>Tx: {w.txCount}</span>
                      </div>
                      
                      <div style={{ marginTop: '10px' }}>
                        <button 
                          onClick={(e) => fetchHint(e, w.address, `Adresse: ${w.address}, Tx totales: ${w.txCount}, PNL: ${w.pnl}, Stratégie: ${w.strategy}`)}
                          disabled={loadingHints[w.address]}
                          style={{ background: 'rgba(0, 208, 255, 0.1)', border: '1px solid #00d0ff', color: '#00d0ff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: loadingHints[w.address] ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                        >
                          <BrainCircuit size={12} />
                          {loadingHints[w.address] ? 'DÉCRYPTAGE...' : '💡 Hint IA'}
                        </button>
                      </div>
                      
                      {hints[w.address] && (
                        <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(90deg, rgba(0, 208, 255, 0.05), transparent)', borderLeft: '3px solid #00d0ff', padding: '10px 15px', borderRadius: '0 8px 8px 0', fontSize: '0.85rem', color: '#e2e8f0', marginTop: '10px', fontStyle: 'italic', lineHeight: '1.5' }}>
                          <span dangerouslySetInnerHTML={{ __html: hints[w.address].replace(/\\n/g, '<br/>') }} />
                        </div>
                      )}
                   </div>
                ))}
              </div>
            </div>
          ) : results && !selectedWallet ? (
            <>
              {/* STATS GLOBALES */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '5px' }}><Users size={14} style={{ display:'inline', verticalAlign:'middle'}}/> WALLETS UNIQUES</div>
                  <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>{results.uniqueWallets.toLocaleString()}</div>
                </div>
                <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '5px' }}><Activity size={14} style={{ display:'inline', verticalAlign:'middle'}}/> TRANSACTIONS</div>
                  <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>{results.totalTransactions.toLocaleString()}</div>
                </div>
                <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '5px' }}><Target size={14} style={{ display:'inline', verticalAlign:'middle'}}/> MODE D'ANALYSE</div>
                  <div style={{ color: results.hasSwaps ? '#00f0ff' : '#8b5cf6', fontSize: '1rem', fontWeight: 'bold', marginTop: '5px' }}>
                    {results.hasSwaps ? 'DEFI SWAPS (PNL)' : 'TRANSFERS (NET FLOW)'}
                  </div>
                </div>
              </div>

              {/* LISTE DES PROFILS */}
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem', flex: 1, display: selectedWallet ? 'none' : 'block' }}>
                <h2 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BrainCircuit size={20} color="#fcd34d" />
                  RÉSULTATS (CLIQUEZ SUR UN WALLET POUR DEMANDER L'AVIS DE L'IA)
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  {results.hasSwaps && results.topProfitable.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#00d0ff', fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase' }}>💰 Master Traders (Top PNL)</h3>
                      {results.topProfitable.map((w, i) => (
                        <div key={i} onClick={() => handleWalletClick(w)} style={{ background: 'rgba(0, 208, 255, 0.05)', border: '1px solid rgba(0, 208, 255, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s' }} className="wallet-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 'bold' }}>{w.address.slice(0,6)}...{w.address.slice(-4)}</span>
                            <span style={{ color: '#00d0ff', fontWeight: '900' }}>+${w.pnl.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: '#fcd34d' }}>{w.strategy}</span>
                            <span style={{ color: '#64748b' }}>Tx: {w.txCount}</span>
                          </div>
                          
                          <div style={{ marginTop: '10px' }}>
                            <button 
                              onClick={(e) => fetchHint(e, w.address, `Adresse: ${w.address}, Tx totales: ${w.txCount}, PNL: ${w.pnl}, Stratégie: ${w.strategy}`)}
                              disabled={loadingHints[w.address]}
                              style={{ background: 'rgba(0, 208, 255, 0.1)', border: '1px solid #00d0ff', color: '#00d0ff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: loadingHints[w.address] ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                            >
                              <BrainCircuit size={12} />
                              {loadingHints[w.address] ? 'DÉCRYPTAGE...' : '💡 Hint IA'}
                            </button>
                          </div>
                          
                          {hints[w.address] && (
                            <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(90deg, rgba(0, 208, 255, 0.05), transparent)', borderLeft: '3px solid #00d0ff', padding: '10px 15px', borderRadius: '0 8px 8px 0', fontSize: '0.85rem', color: '#e2e8f0', marginTop: '10px', fontStyle: 'italic', lineHeight: '1.5' }}>
                              <span dangerouslySetInnerHTML={{ __html: hints[w.address].replace(/\\n/g, '<br/>') }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h3 style={{ color: '#00ff88', fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase' }}>🐋 Baleines en Accumulation (Top In)</h3>
                    {results.topAccumulators.map((w, i) => (
                      <div key={i} onClick={() => handleWalletClick(w)} style={{ background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s' }} className="wallet-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 'bold' }}>{w.address.slice(0,6)}...{w.address.slice(-4)}</span>
                          <span style={{ color: '#00ff88', fontWeight: '900' }}>+{w.net.toLocaleString(undefined, {maximumFractionDigits:2})} jetons</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: '#fcd34d' }}>{w.strategy}</span>
                          <span style={{ color: '#64748b' }}>Tx: {w.txCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '10px' }}>
                    <h3 style={{ color: '#ff3b30', fontSize: '0.9rem', marginBottom: '10px', textTransform: 'uppercase' }}>🚨 Vendeurs Massifs (Top Out)</h3>
                    {results.topDumpers.map((w, i) => (
                      <div key={i} onClick={() => handleWalletClick(w)} style={{ background: 'rgba(255, 59, 48, 0.05)', border: '1px solid rgba(255, 59, 48, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s' }} className="wallet-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 'bold' }}>{w.address.slice(0,6)}...{w.address.slice(-4)}</span>
                          <span style={{ color: '#ff3b30', fontWeight: '900' }}>{w.net.toLocaleString(undefined, {maximumFractionDigits:2})} jetons</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: '#fcd34d' }}>{w.strategy}</span>
                          <span style={{ color: '#64748b' }}>Tx: {w.txCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </>
          ) : null}

        </div>
      </div>
      
      <style>{`
        .terminal-line { animation: fade-in 0.3s ease-out forwards; }
        .wallet-card:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); border-color: #fff !important; }
        .narrative-modal { animation: fade-in 0.4s ease-out forwards; }
        .pulse-anim { animation: pulse 1.5s infinite; }
        .loader-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: #00f0ff; animation: load 1.5s infinite; border-radius: 0 0 8px 8px; }
        
        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes load { 0% { width: 0%; opacity: 1; } 50% { width: 50%; opacity: 0.5; } 100% { width: 100%; opacity: 0; } }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
      `}</style>
    </div>
  );
}
