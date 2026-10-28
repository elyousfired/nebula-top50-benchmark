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
  TAKE_PROFIT_PCT: 0.10,
  MAX_WAIT_HOURS: 72,
  COOLDOWN_HOURS: 24,
  HISTORY_LIMIT: 1000, 
  TEST_THRESHOLDS: [60, 65, 70, 75, 80, 85],
  EVAL_HOURS: 360 // Last 15 days
};

async function runOptimizationBacktest() {
  console.log(`🚀 Démarrage du Backtest Multi-Seuils...`);
  console.log(`Univers: Top ${CONFIG.NUM_TOKENS} | TP: +10% | Max 72H | Seuils testés: ${CONFIG.TEST_THRESHOLDS.join(', ')}`);
  
  const tfs = ['15', '60', '240', 'D'];
  console.log(`[1/3] Téléchargement historique de base (${CONFIG.BASE_ASSET})...`);
  
  const baseDataRaw = await Promise.all(tfs.map(tf => fetchBybitData(CONFIG.BASE_ASSET, tf, CONFIG.HISTORY_LIMIT)));
  const baseMaps = baseDataRaw.map(raw => createMap(mapToParsed(raw)));
  
  const symbols = await fetchTop500Symbols('bybit');
  const tokensToTest = symbols.slice(0, CONFIG.NUM_TOKENS);
  
  // Stats tracker for each threshold
  const stats = {};
  for (const th of CONFIG.TEST_THRESHOLDS) {
    stats[th] = { signals: 0, wins: 0, losses: 0, lastSignalIdx: -999 };
  }

  console.log(`[2/3] Téléchargement et analyse des ${tokensToTest.length} tokens (Pause de 250ms entre chaque pour préserver l'API)...`);
  
  for (let i = 0; i < tokensToTest.length; i++) {
    const symbol = tokensToTest[i].symbol;
    const fetchSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
    
    try {
      const klinesRaw = await Promise.all(tfs.map(tf => fetchBybitData(fetchSymbol, tf, CONFIG.HISTORY_LIMIT).catch(()=>null)));
      
      // Sleep to protect API
      await SLEEP(250);

      if (klinesRaw.some(k => !k || k.length < 200)) continue;

      const synthetics = klinesRaw.map((raw, idx) => buildSyntheticCandles(mapToParsed(raw), baseMaps[idx]));
      const synth15 = synthetics[0];
      const synth60 = synthetics[1];
      const synth240 = synthetics[2];
      const synthD = synthetics[3];

      if (synth60.length < 200) continue;

      // Initialize lastSignal tracking for this token
      for (const th of CONFIG.TEST_THRESHOLDS) {
        stats[th].lastSignalIdx = -999;
      }

      const startIdx = Math.max(100, synth60.length - CONFIG.EVAL_HOURS - CONFIG.MAX_WAIT_HOURS);

      for (let j = startIdx; j < synth60.length - CONFIG.MAX_WAIT_HOURS; j++) {
        const currentT = synth60[j].time;
        const currentPrice = synth60[j].close;

        // Extract slices
        const slice15 = getHistoryUpTo(synth15, currentT, currentPrice);
        const slice60 = getHistoryUpTo(synth60, currentT, currentPrice);
        const slice240 = getHistoryUpTo(synth240, currentT, currentPrice);
        const sliceD = getHistoryUpTo(synthD, currentT, currentPrice);

        if (slice60.length < 50 || slice240.length < 50 || sliceD.length < 50) continue;

        const mom15 = calculateTimeframeMomentum(slice15);
        const mom60 = calculateTimeframeMomentum(slice60);
        const mom240 = calculateTimeframeMomentum(slice240);
        const momD = calculateTimeframeMomentum(sliceD);

        const tfsData = {
          '15': mom15,
          '60': mom60,
          '240': mom240,
          'D': momD
        };

        const profile = analyzeMomentumProfile(tfsData);
        const score = profile.overallScore;

        for (const th of CONFIG.TEST_THRESHOLDS) {
          if (score >= th) {
            // Check cooldown
            if (j - stats[th].lastSignalIdx >= CONFIG.COOLDOWN_HOURS) {
              stats[th].signals++;
              stats[th].lastSignalIdx = j;

              const entryPrice = currentPrice;
              let isWin = false;

              for (let k = 1; k <= CONFIG.MAX_WAIT_HOURS; k++) {
                const futureCandle = synth60[j + k];
                const highPct = (futureCandle.high / entryPrice) - 1;
                if (highPct >= CONFIG.TAKE_PROFIT_PCT) {
                  isWin = true;
                  break;
                }
              }

              if (isWin) stats[th].wins++;
              else stats[th].losses++;
            }
          }
        }
      }

      process.stdout.write(`\rProgression: ${i + 1}/${tokensToTest.length} tokens analysés...`);

    } catch (e) {
      // ignore
    }
  }

  console.log("\n\n📊 ======================================");
  console.log("     RÉSULTATS DE L'OPTIMISATION DU SCORE  ");
  console.log("=========================================");
  console.log(`Seuil | Signaux | Win Rate | PnL Net ($100 risk)`);
  console.log(`--------------------------------------------------`);

  for (const th of CONFIG.TEST_THRESHOLDS) {
    const s = stats[th];
    const wr = s.signals > 0 ? (s.wins / s.signals) * 100 : 0;
    const pnl = (s.wins * 10) - (s.losses * 10);
    console.log(` > ${th}  | ${s.signals.toString().padStart(7)} | ${wr.toFixed(1)}%     | $${pnl}`);
  }
}

runOptimizationBacktest();
