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
  COOLDOWN_HOURS: 24,
  HISTORY_LIMIT: 1000, 
  THRESHOLD: 80,
  EVAL_HOURS: 360 // Last 15 days
};

async function runFind80Tokens() {
  const tfs = ['15', '60', '240', 'D'];
  const baseDataRaw = await Promise.all(tfs.map(tf => fetchBybitData(CONFIG.BASE_ASSET, tf, CONFIG.HISTORY_LIMIT)));
  const baseMaps = baseDataRaw.map(raw => createMap(mapToParsed(raw)));
  
  const symbols = await fetchTop500Symbols('bybit');
  const tokensToTest = symbols.slice(0, CONFIG.NUM_TOKENS);
  
  const foundSignals = [];

  for (let i = 0; i < tokensToTest.length; i++) {
    const symbol = tokensToTest[i].symbol;
    const fetchSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
    
    try {
      const klinesRaw = await Promise.all(tfs.map(tf => fetchBybitData(fetchSymbol, tf, CONFIG.HISTORY_LIMIT).catch(()=>null)));
      await SLEEP(250);

      if (klinesRaw.some(k => !k || k.length < 200)) continue;

      const synthetics = klinesRaw.map((raw, idx) => buildSyntheticCandles(mapToParsed(raw), baseMaps[idx]));
      const synth15 = synthetics[0];
      const synth60 = synthetics[1];
      const synth240 = synthetics[2];
      const synthD = synthetics[3];

      if (synth60.length < 200) continue;

      let lastSignalIdx = -999;
      const startIdx = Math.max(100, synth60.length - CONFIG.EVAL_HOURS);

      for (let j = startIdx; j < synth60.length; j++) {
        const currentT = synth60[j].time;
        const currentPrice = synth60[j].close;

        if (j - lastSignalIdx < CONFIG.COOLDOWN_HOURS) continue;

        const slice15 = getHistoryUpTo(synth15, currentT, currentPrice);
        const slice60 = getHistoryUpTo(synth60, currentT, currentPrice);
        const slice240 = getHistoryUpTo(synth240, currentT, currentPrice);
        const sliceD = getHistoryUpTo(synthD, currentT, currentPrice);

        if (slice60.length < 50 || slice240.length < 50 || sliceD.length < 50) continue;

        const mom15 = calculateTimeframeMomentum(slice15);
        const mom60 = calculateTimeframeMomentum(slice60);
        const mom240 = calculateTimeframeMomentum(slice240);
        const momD = calculateTimeframeMomentum(sliceD);

        const profile = analyzeMomentumProfile({
          '15': mom15,
          '60': mom60,
          '240': mom240,
          'D': momD
        });

        if (profile.overallScore >= CONFIG.THRESHOLD) {
          foundSignals.push({
            symbol: symbol,
            date: new Date(currentT * 1000).toLocaleString('fr-FR'),
            score: profile.overallScore
          });
          lastSignalIdx = j;
        }
      }
      process.stdout.write(`\rAnalysed: ${i + 1}/${tokensToTest.length}`);
    } catch (e) {
      // ignore
    }
  }

  console.log("\n\n--- TOKENS AVEC SCORE 80+ ---");
  foundSignals.sort((a,b) => b.score - a.score);
  for (const s of foundSignals) {
    console.log(`${s.date} | ${s.symbol.padEnd(10)} | Score: ${s.score}`);
  }
}

runFind80Tokens();
