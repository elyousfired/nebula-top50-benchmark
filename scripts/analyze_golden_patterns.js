import { fetchBybitData } from '../src/logic/scanner.js';
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

const TARGETS = [
  'MEMEUSDT', 'KMNOUSDT', 'HTXUSDT', 'XPLUSDT', 'GRASSUSDT', 
  'TAUSDT', 'AAPLXUSDT', 'NFTUSDT', 'GPSUSDT', 'SUNUSDT'
];

async function runPatternAnalysis() {
  const tfs = ['15', '60', '240', 'D'];
  const baseDataRaw = await Promise.all(tfs.map(tf => fetchBybitData('SOLUSDT', tf, 1000)));
  const baseMaps = baseDataRaw.map(raw => createMap(mapToParsed(raw)));

  for (const symbol of TARGETS) {
    try {
      const klinesRaw = await Promise.all(tfs.map(tf => fetchBybitData(symbol, tf, 1000).catch(()=>null)));
      await SLEEP(250);

      if (klinesRaw.some(k => !k || k.length < 200)) continue;

      const synthetics = klinesRaw.map((raw, idx) => buildSyntheticCandles(mapToParsed(raw), baseMaps[idx]));
      const synth15 = synthetics[0];
      const synth60 = synthetics[1];
      const synth240 = synthetics[2];
      const synthD = synthetics[3];

      // Find the FIRST moment it hit >= 80 in the last 15 days
      const startIdx = Math.max(100, synth60.length - 360);
      let signalIdx = -1;

      for (let j = startIdx; j < synth60.length; j++) {
        const currentT = synth60[j].time;
        const currentPrice = synth60[j].close;

        const slice15 = getHistoryUpTo(synth15, currentT, currentPrice);
        const slice60 = getHistoryUpTo(synth60, currentT, currentPrice);
        const slice240 = getHistoryUpTo(synth240, currentT, currentPrice);
        const sliceD = getHistoryUpTo(synthD, currentT, currentPrice);

        if (slice60.length < 50 || slice240.length < 50 || sliceD.length < 50) continue;

        const profile = analyzeMomentumProfile({
          '15': calculateTimeframeMomentum(slice15),
          '60': calculateTimeframeMomentum(slice60),
          '240': calculateTimeframeMomentum(slice240),
          'D': calculateTimeframeMomentum(sliceD)
        });

        if (profile.overallScore >= 80) {
          signalIdx = j;
          break; // Found the signal
        }
      }

      if (signalIdx === -1) {
        console.log(`\n--- ${symbol} : AUCUN SIGNAL >= 80 TROUVÉ DANS L'HISTORIQUE ---`);
        continue;
      }

      // Analyze specific points relative to signalIdx
      const pointsOfInterest = [-24, -12, -4, 0, 12, 24];
      console.log(`\n========================================`);
      console.log(`🚀 ANALYSE DU CYCLE POUR : ${symbol}`);
      console.log(`Signal détecté le : ${new Date(synth60[signalIdx].time * 1000).toLocaleString('fr-FR')}`);
      console.log(`========================================`);
      
      const signalPrice = synth60[signalIdx].close;

      for (const offset of pointsOfInterest) {
        const j = signalIdx + offset;
        if (j < 0 || j >= synth60.length) continue;

        const currentT = synth60[j].time;
        const currentPrice = synth60[j].close;

        const slice15 = getHistoryUpTo(synth15, currentT, currentPrice);
        const slice60 = getHistoryUpTo(synth60, currentT, currentPrice);
        const slice240 = getHistoryUpTo(synth240, currentT, currentPrice);
        const sliceD = getHistoryUpTo(synthD, currentT, currentPrice);

        const mom60 = calculateTimeframeMomentum(slice60);
        const profile = analyzeMomentumProfile({
          '15': calculateTimeframeMomentum(slice15),
          '60': mom60,
          '240': calculateTimeframeMomentum(slice240),
          'D': calculateTimeframeMomentum(sliceD)
        });

        // Calculate NetFlow 24h leading up to this point
        let netFlow24h = 0;
        const tokenRawMap = mapToParsed(klinesRaw[1]); // 1H raw
        for (let c = 0; c < tokenRawMap.length; c++) {
          const k = tokenRawMap[c];
          if (k.time <= currentT && (currentT - k.time) < 24 * 3600) {
            if (k.open > 0) {
              netFlow24h += k.turnover * ((k.close - k.open) / k.open);
            }
          }
        }

        const priceChangeFromSignal = ((currentPrice - signalPrice) / signalPrice) * 100;
        const timeLabel = offset === 0 ? "T = 0 (SIGNAL)" : (offset > 0 ? `T + ${offset}H` : `T - ${Math.abs(offset)}H`);

        console.log(`\n[ ${timeLabel.padEnd(14)} ] - ${new Date(currentT * 1000).toLocaleString('fr-FR')}`);
        console.log(`> Prix vs Signal : ${offset === 0 ? '0.00%' : (priceChangeFromSignal > 0 ? '+' : '') + priceChangeFromSignal.toFixed(2) + '%'}`);
        console.log(`> Score Global   : ${profile.overallScore} | État: ${profile.alignment}`);
        console.log(`> Momentum 1H    : RSI = ${mom60.rsi.toFixed(1)} | VolRatio = ${mom60.volRatio.toFixed(2)}x`);
        console.log(`> Structure 1H   : Prix vs EMA20 = ${currentPrice > mom60.ema20 ? 'Au-dessus' : 'En-dessous'} | Tendance = ${mom60.structureBullish ? 'Haussière (HH/HL)' : 'Neutre/Baissière'}`);
        console.log(`> Net Flow 24H   : $${Math.floor(netFlow24h).toLocaleString()}`);
      }

    } catch (e) {
      console.error(`\nError analyzing ${symbol}:`, e.message);
    }
  }
}

runPatternAnalysis();
