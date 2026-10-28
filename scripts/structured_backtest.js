import { fetchBybitData, fetchTop500Symbols } from '../src/logic/scanner.js';
import { calculateTimeframeMomentum, buildSyntheticCandles } from '../src/logic/momentumScanner.js';
import fs from 'fs';

const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

const mapToParsed = (klines) => [...klines].reverse().map(k => ({
  time: Math.floor(Number(k[0]) / 1000),
  open: Number(k[1]),
  high: Number(k[2]),
  low: Number(k[3]),
  close: Number(k[4]),
  volume: Number(k[5]),
  turnover: Number(k[6] || 0)
}));

const createMap = (klines) => {
  const map = new Map();
  for (const k of klines) {
    map.set(k.time, k);
  }
  return map;
};

// ----------------------------------------------------
// CONFIGURATION DU BACKTEST (SCORE + NET FLOW)
// ----------------------------------------------------
const CONFIG = {
  BASE_ASSET: "SOLUSDT",
  NUM_TOKENS: 500,           // Top 500
  ENTRY_SCORE_MIN: 80,       // Score >= 80
  TAKE_PROFIT_PCT: 0.10,     // 10% de gain sur TOKEN/SOL
  MAX_WAIT_HOURS: 72,        // 3 Jours max
  COOLDOWN_HOURS: 24,        // 24H de pause après un signal sur le même token
  HISTORY_LIMIT: 1000,       // Nombre de bougies à télécharger
};

async function runStructuredBacktest() {
  console.log(`🚀 Lancement du Backtest Simplifié (Score + Net Flow)...`);
  console.log(`Paramètres: Score >= ${CONFIG.ENTRY_SCORE_MIN} | Net Flow 24h > 0 | TP = +${CONFIG.TAKE_PROFIT_PCT*100}% | Délai Max = ${CONFIG.MAX_WAIT_HOURS}h | SL = AUCUN`);
  console.log(`Univers: Top ${CONFIG.NUM_TOKENS} Bybit | Base: ${CONFIG.BASE_ASSET}`);
  console.log("---------------------------------------------------------");

  // 1. DATA LOADER
  console.log(`[1/3] Téléchargement historique ${CONFIG.BASE_ASSET}...`);
  const sol1H_raw = await fetchBybitData(CONFIG.BASE_ASSET, '60', CONFIG.HISTORY_LIMIT);
  const solMap1H = createMap(mapToParsed(sol1H_raw));

  console.log(`[2/3] Téléchargement liste des tokens...`);
  const symbols = await fetchTop500Symbols('bybit');
  const tokensToTest = symbols.slice(0, CONFIG.NUM_TOKENS);
  
  let totalSignals = 0;
  let totalWins = 0;
  let totalLosses = 0; // "Loss" means it failed to hit 10% within 3 days
  
  // Track trades for history
  const trades = [];

  console.log(`[3/3] Analyse des ${tokensToTest.length} tokens...`);
  
  for (let i = 0; i < tokensToTest.length; i++) {
    const symbol = tokensToTest[i].symbol;
    const fetchSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
    
    try {
      const klines1H = await fetchBybitData(fetchSymbol, '60', CONFIG.HISTORY_LIMIT).catch(()=>null);
      if (!klines1H) continue;

      const tokenParsed = mapToParsed(klines1H);
      const synthetic1H = buildSyntheticCandles(tokenParsed, solMap1H);

      if (synthetic1H.length < 150) continue;

      let lastSignalIdx = -999;
      
      for (let j = 100; j < synthetic1H.length - CONFIG.MAX_WAIT_HOURS; j++) {
        if (j - lastSignalIdx < CONFIG.COOLDOWN_HOURS) continue;

        const historySlice = synthetic1H.slice(0, j + 1);
        const momentum1H = calculateTimeframeMomentum(historySlice);

        // CONDITION D'ENTRÉE : Score >= 80
        if (momentum1H.score >= CONFIG.ENTRY_SCORE_MIN) {
          
          const currentT = synthetic1H[j].time;
          const currentPrice = synthetic1H[j].close;

          // CALCUL DU NET FLOW 24H (Sur les bougies brutes USDT)
          let netFlow24h = 0;
          for (let c = 0; c < tokenParsed.length; c++) {
            const k = tokenParsed[c];
            if (k.time <= currentT && (currentT - k.time) < 24 * 3600) {
              if (k.open > 0) {
                netFlow24h += k.turnover * ((k.close - k.open) / k.open);
              }
            }
          }

          // CONDITION D'ENTRÉE : Net Flow Positif
          if (netFlow24h > 0) {
            totalSignals++;
            lastSignalIdx = j;

            const entryPrice = currentPrice;
            let outcome = 'LOSS'; // Défaut : on n'a pas atteint +10% en 72H
            let duration = CONFIG.MAX_WAIT_HOURS;

            for (let k = 1; k <= CONFIG.MAX_WAIT_HOURS; k++) {
              const futureCandle = synthetic1H[j + k];
              const maxPrice = futureCandle.high;
              const highPct = (maxPrice / entryPrice) - 1;

              if (highPct >= CONFIG.TAKE_PROFIT_PCT) {
                 outcome = 'WIN';
                 duration = k;
                 break;
              }
            }

            if (outcome === 'WIN') totalWins++;
            else totalLosses++;
            
            trades.push({
              symbol: fetchSymbol,
              time: new Date(currentT * 1000).toLocaleString(),
              netFlow: netFlow24h,
              outcome,
              duration
            });
          }
        }
      }
      
      process.stdout.write(`\rProgression : ${i + 1}/${tokensToTest.length} tokens analysés... `);
      await SLEEP(20); // Un peu plus rapide car 1 seul timeframe

    } catch (e) {
      console.error(`\nErreur sur ${symbol}: ${e.message}`);
    }
  }

  console.log("\n\n📊 ======================================");
  console.log("     RAPPPORT FINAL (SCORE + NET FLOW)   ");
  console.log("=========================================");
  console.log(`Univers : Top ${CONFIG.NUM_TOKENS}`);
  console.log(`Condition d'entrée : Score >= ${CONFIG.ENTRY_SCORE_MIN} ET NetFlow24h > 0`);
  console.log(`Objectif : +${CONFIG.TAKE_PROFIT_PCT*100}% en moins de ${CONFIG.MAX_WAIT_HOURS}h (Sans SL)`);
  console.log(`-----------------------------------------`);
  console.log(`Total des Signaux : ${totalSignals}`);
  console.log(`Gagnants (A touché +10%) : ${totalWins}`);
  console.log(`Perdants (N'a pas fait +10%) : ${totalLosses}`);
  
  const overallWR = totalSignals > 0 ? (totalWins / totalSignals) * 100 : 0;
  console.log(`\n🏆 WIN RATE GLOBAL : ${overallWR.toFixed(2)}%`);

  const pnl = (totalWins * 10) - (totalLosses * 10);
  console.log(`\n💰 SIMULATION FINANCIÈRE (Risque $100 par trade) :`);
  console.log(`PnL Net       : ${pnl >= 0 ? '+' : ''}$${pnl} de profit net`);
  
  console.log("\n--- EXEMPLES DE TRADES RÉCENTS ---");
  const recent = trades.slice(-10);
  for (const t of recent) {
      console.log(`${t.time} | ${t.symbol.padEnd(10)} | NetFlow: $${Math.floor(t.netFlow).toLocaleString()} | Résultat: ${t.outcome.padEnd(5)} en ${t.duration}H`);
  }
}

runStructuredBacktest();
