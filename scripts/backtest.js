import { fetchBybitData, fetchTop500Symbols } from '../src/logic/scanner.js';
import { calculateTimeframeMomentum, buildSyntheticCandles } from '../src/logic/momentumScanner.js';

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

async function runBacktest() {
  console.log("🚀 Démarrage du Backtest 'GOLDEN SEQUENCE' (1 Mois)...");
  const baseAsset = "SOLUSDT";
  
  // 1 month = 720 hours + 200 hours for history buffer = 920 hours. Let's just fetch 1000.
  const [sol1H_raw, sol4H_raw, sol1D_raw] = await Promise.all([
    fetchBybitData(baseAsset, '60', 1000),
    fetchBybitData(baseAsset, '240', 1000),
    fetchBybitData(baseAsset, 'D', 1000)
  ]);
  
  const solMap1H = createMap(mapToParsed(sol1H_raw));
  const solMap4H = createMap(mapToParsed(sol4H_raw));
  const solMap1D = createMap(mapToParsed(sol1D_raw));

  const symbols = await fetchTop500Symbols('bybit');
  const tokensToTest = symbols.slice(0, 500); // Top 500 tokens
  
  let totalSignals = 0;
  let wins = 0;
  let losses = 0;
  let timeouts = 0;

  const WIN_PCT = 0.10;
  const LOSS_PCT = -0.10;
  const MAX_WAIT_HOURS = 48;
  const MONTH_CANDLES = 720; // Exact 30 days

  // Capital simulation
  let balance = 1000; // Starting with $1000
  const riskPerTrade = 0.05; // 5% of balance per trade
  
  // Track trades for history
  const trades = [];

  for (let i = 0; i < tokensToTest.length; i++) {
    const symbol = tokensToTest[i].symbol;
    const fetchSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
    
    try {
      const [klines1H, klines4H, klines1D] = await Promise.all([
        fetchBybitData(fetchSymbol, '60', 1000).catch(()=>null),
        fetchBybitData(fetchSymbol, '240', 1000).catch(()=>null),
        fetchBybitData(fetchSymbol, 'D', 1000).catch(()=>null)
      ]);
      
      if (!klines1H || !klines4H || !klines1D) continue;

      const synthetic1H = buildSyntheticCandles(mapToParsed(klines1H), solMap1H);
      const synthetic4H = buildSyntheticCandles(mapToParsed(klines4H), solMap4H);
      const synthetic1D = buildSyntheticCandles(mapToParsed(klines1D), solMap1D);

      if (synthetic1H.length < 150) continue;

      let lastSignalIdx = -999;
      
      // Limit to last 720 hours (1 month) + offset for max wait
      const startIdx = Math.max(100, synthetic1H.length - MONTH_CANDLES - MAX_WAIT_HOURS);

      for (let j = startIdx; j < synthetic1H.length - MAX_WAIT_HOURS; j++) {
        if (j - lastSignalIdx < 24) continue; // Cool down

        const historySlice = synthetic1H.slice(0, j + 1);
        const momentum1H = calculateTimeframeMomentum(historySlice);

        if (momentum1H.score >= 80) {
          const currentT = synthetic1H[j].time;
          const currentPrice = synthetic1H[j].close;

          const slice4H = getHistoryUpTo(synthetic4H, currentT, currentPrice);
          const momentum4H = calculateTimeframeMomentum(slice4H);

          const slice1D = getHistoryUpTo(synthetic1D, currentT, currentPrice);
          const momentum1D = calculateTimeframeMomentum(slice1D);

          // ✨ GOLDEN SEQUENCE CONDITION ✨
          const isGolden = momentum1D.state === 'EARLY' &&
                           momentum4H.state === 'BUILDING' &&
                           (momentum1H.state === 'BUILDING' || momentum1H.state === 'STRONG');

          if (isGolden) {
            totalSignals++;
            lastSignalIdx = j;

            const entryPrice = currentPrice;
            let outcome = 'TIMEOUT';
            let exitPrice = currentPrice;
            let duration = MAX_WAIT_HOURS;

            for (let k = 1; k <= MAX_WAIT_HOURS; k++) {
              const futureCandle = synthetic1H[j + k];
              const highPct = (futureCandle.high / entryPrice) - 1;
              const lowPct = (futureCandle.low / entryPrice) - 1;

              if (highPct >= WIN_PCT && lowPct <= LOSS_PCT) {
                 outcome = 'LOSS';
                 exitPrice = entryPrice * (1 + LOSS_PCT);
                 duration = k;
                 break;
              } else if (lowPct <= LOSS_PCT) {
                 outcome = 'LOSS';
                 exitPrice = entryPrice * (1 + LOSS_PCT);
                 duration = k;
                 break;
              } else if (highPct >= WIN_PCT) {
                 outcome = 'WIN';
                 exitPrice = entryPrice * (1 + WIN_PCT);
                 duration = k;
                 break;
              }
            }

            if (outcome === 'WIN') wins++;
            else if (outcome === 'LOSS') losses++;
            else timeouts++;

            trades.push({
              symbol: fetchSymbol,
              time: new Date(currentT * 1000).toLocaleString(),
              outcome,
              duration
            });
          }
        }
      }
      
      process.stdout.write(`\rProgression : ${i + 1}/${tokensToTest.length} tokens analysés... `);
      await SLEEP(50);

    } catch (e) {
      console.error(`\nError on ${symbol}: ${e.message}`);
    }
  }

  console.log("\n\n📊 --- RÉSULTATS DU BACKTEST: 1 MOIS --- 📊");
  console.log(`Condition : Score >= 80 ET (1D: EARLY -> 4H: BUILDING -> 1H: BUILDING/STRONG)`);
  console.log(`Période : ~30 Jours`);
  console.log(`Tokens analysés : Top ${tokensToTest.length}`);
  console.log(`-----------------------------------`);
  console.log(`Total Signaux  : ${totalSignals}`);
  console.log(`Gagnants (+10%) : ${wins}`);
  console.log(`Perdants (-10%) : ${losses}`);
  console.log(`Timeouts       : ${timeouts}`);
  
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
  console.log(`\n🏆 WIN RATE (sur trades fermés) : ${winRate.toFixed(2)}%`);
  
  // Calculate simulated PnL
  // Assume flat $100 per trade
  const pnl = (wins * 10) - (losses * 10);
  console.log(`\n💰 SIMULATION FINANCIÈRE (Risque $100 par trade) :`);
  console.log(`Gains bruts   : +$${wins * 10}`);
  console.log(`Pertes brutes : -$${losses * 10}`);
  console.log(`PnL Net       : ${pnl >= 0 ? '+' : ''}$${pnl} de profit net`);
  
  console.log("\n--- DERNIERS TRADES SIMULÉS ---");
  const recent = trades.slice(-10);
  for (const t of recent) {
      console.log(`${t.time} | ${t.symbol.padEnd(10)} | Résultat: ${t.outcome.padEnd(8)} | Durée: ${t.duration}H`);
  }
}

runBacktest();
