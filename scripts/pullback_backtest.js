import { fetchBybitData, fetchTop500Symbols } from '../src/logic/scanner.js';
import { calculateTimeframeMomentum, buildSyntheticCandles, analyzeMomentumProfile } from '../src/logic/momentumScanner.js';

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

function getHistoryUpTo(syntheticHigherTF, currentTime, currentPrice) {
  const slice = syntheticHigherTF.filter(c => c.time <= currentTime);
  if (slice.length === 0) return [];
  const result = [...slice];
  const last = { ...result[result.length - 1] };
  last.close = currentPrice;
  result[result.length - 1] = last;
  return result;
}

const CONFIG = {
  BASE_ASSET: "SOLUSDT",
  NUM_TOKENS: 500,
  HISTORY_LIMIT: 1000, 
  EVAL_HOURS: 720, // 30 days
  SCORE_THRESHOLD: 80,
  MAX_WATCHLIST_HOURS: 48,
  TAKE_PROFIT_PCT: 0.15,
  MAX_HOLD_HOURS: 168 // 7 days
};

async function runPullbackBacktest() {
  console.log(`🚀 Démarrage du Backtest PULLBACK (Option 2) sans Stop Loss...`);
  console.log(`Univers: Top ${CONFIG.NUM_TOKENS} | Durée: 30 jours | TP: +15% | Max Hold: 5 jours`);
  
  const tfs = ['15', '60', '240', 'D'];
  console.log(`[1/3] Téléchargement historique de base (${CONFIG.BASE_ASSET})...`);
  
  const baseDataRaw = await Promise.all(tfs.map(tf => fetchBybitData(CONFIG.BASE_ASSET, tf, CONFIG.HISTORY_LIMIT)));
  const baseMaps = baseDataRaw.map(raw => createMap(mapToParsed(raw)));
  
  const symbols = await fetchTop500Symbols('bybit');
  const tokensToTest = symbols.slice(0, CONFIG.NUM_TOKENS);
  
  let totalSignals = 0;
  let totalEntries = 0;
  let wins = 0;
  let timeouts = 0; // Since no SL, it either hits TP or timeouts
  let totalPnL_Pct = 0;

  console.log(`[2/3] Téléchargement et analyse des ${tokensToTest.length} tokens...`);
  
  for (let i = 0; i < tokensToTest.length; i++) {
    const symbol = tokensToTest[i].symbol;
    const fetchSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
    
    try {
      const klinesRaw = await Promise.all(tfs.map(tf => fetchBybitData(fetchSymbol, tf, CONFIG.HISTORY_LIMIT).catch(()=>null)));
      await SLEEP(250);

      if (klinesRaw.some(k => !k || k.length < 300)) continue;

      const synthetics = klinesRaw.map((raw, idx) => buildSyntheticCandles(mapToParsed(raw), baseMaps[idx]));
      const synth15 = synthetics[0];
      const synth60 = synthetics[1];
      const synth240 = synthetics[2];
      const synthD = synthetics[3];

      if (synth60.length < 300) continue;

      const startIdx = Math.max(100, synth60.length - CONFIG.EVAL_HOURS - CONFIG.MAX_HOLD_HOURS - CONFIG.MAX_WATCHLIST_HOURS);
      
      let watchlistExpiryIdx = -1;
      let signalPrice = 0;

      for (let j = startIdx; j < synth60.length - CONFIG.MAX_HOLD_HOURS; j++) {
        const currentT = synth60[j].time;
        const currentPrice = synth60[j].close;

        const slice15 = getHistoryUpTo(synth15, currentT, currentPrice);
        const slice60 = getHistoryUpTo(synth60, currentT, currentPrice);
        const slice240 = getHistoryUpTo(synth240, currentT, currentPrice);
        const sliceD = getHistoryUpTo(synthD, currentT, currentPrice);

        if (slice60.length < 50) continue;
        const mom60 = calculateTimeframeMomentum(slice60);

        // 1. Is it currently in the watchlist? Check for Entry
        if (j <= watchlistExpiryIdx) {
          // Entry Condition: Price drops to or below EMA20
          if (currentPrice <= mom60.ema20) {
            totalEntries++;
            watchlistExpiryIdx = -1; // Remove from watchlist, we entered!
            
            const entryPrice = currentPrice;
            let isWin = false;
            let pnlPct = 0;

            // Track trade for MAX_HOLD_HOURS
            for (let k = 1; k <= CONFIG.MAX_HOLD_HOURS; k++) {
              if (j + k >= synth60.length) break;
              const futureCandle = synth60[j + k];
              const highPct = (futureCandle.high / entryPrice) - 1;
              
              if (highPct >= CONFIG.TAKE_PROFIT_PCT) {
                isWin = true;
                pnlPct = CONFIG.TAKE_PROFIT_PCT;
                break;
              }
              // If it's the last candle of the hold period, record the PnL
              if (k === CONFIG.MAX_HOLD_HOURS) {
                pnlPct = (futureCandle.close / entryPrice) - 1;
              }
            }

            if (isWin) wins++;
            else timeouts++;
            
            totalPnL_Pct += pnlPct;
            
            // Advance j so we don't scan while holding a trade
            j += CONFIG.MAX_HOLD_HOURS;
            continue;
          }
        }

        // 2. Scan for Golden Signal (Only if not already in watchlist)
        if (j > watchlistExpiryIdx) {
          const profile = analyzeMomentumProfile({
            '15': calculateTimeframeMomentum(slice15),
            '60': mom60,
            '240': calculateTimeframeMomentum(slice240),
            'D': calculateTimeframeMomentum(sliceD)
          });

          if (profile.overallScore >= CONFIG.SCORE_THRESHOLD) {
            totalSignals++;
            // Add to watchlist for next 48 hours
            watchlistExpiryIdx = j + CONFIG.MAX_WATCHLIST_HOURS;
            signalPrice = currentPrice;
          }
        }
      }

      process.stdout.write(`\rProgression: ${i + 1}/${tokensToTest.length} tokens analysés...`);

    } catch (e) {
      // ignore
    }
  }

  console.log("\n\n📊 ======================================");
  console.log("     RÉSULTATS DU BACKTEST PULLBACK      ");
  console.log("=========================================");
  console.log(`Période : 30 Jours`);
  console.log(`Condition d'Alerte : Score >= 80`);
  console.log(`Condition d'Achat  : Rebond sur l'EMA 20 (Max 48H après l'alerte)`);
  console.log(`Sortie : Take Profit +15% ou Timeout 5 Jours (AUCUN STOP LOSS)`);
  console.log(`-----------------------------------------`);
  console.log(`Total Alertes (Score 80) : ${totalSignals}`);
  console.log(`Total Achats (EMA20 hit) : ${totalEntries}`);
  console.log(`Trades Gagnants (+15%)   : ${wins}`);
  console.log(`Trades Non-Conclusifs    : ${timeouts} (Fermés après 5 Jours)`);
  
  const winRate = totalEntries > 0 ? (wins / totalEntries) * 100 : 0;
  console.log(`\n🏆 WIN RATE GLOBAL : ${winRate.toFixed(2)}%`);

  // Financial simulation
  console.log(`\n💰 SIMULATION FINANCIÈRE (Sans Effet de levier) :`);
  console.log(`Rendement Net Cumulé : ${(totalPnL_Pct * 100).toFixed(2)}%`);
  console.log(`Si on investissait $100 sur chaque signal : Profit de $${(totalPnL_Pct * 100).toFixed(2)}`);
}

runPullbackBacktest();
