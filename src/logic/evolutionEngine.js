import { fetchBybitData, fetchBinanceData } from './scanner';

// Helper to calculate EMA
const calcEMA = (data, period) => {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

// Helper to calculate RSI
const calcRSI = (data, period = 14) => {
  if (data.length <= period) return data.map(() => 50);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  const rsi = new Array(period).fill(50);
  if (avgLoss === 0) rsi.push(100);
  else {
    let rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      let rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  return rsi;
};

// Extracts the market state at a specific index
export const extractMarketState = (closes, ema20, ema50, rsi, index) => {
  if (index < 50 || index >= closes.length) return "UNKNOWN";

  const close = closes[index];
  const e20 = ema20[index];
  const e50 = ema50[index];
  const r = rsi[index];

  let trend = e20 > e50 ? "BULL" : "BEAR";
  let momentum = r > 60 ? "STRONG" : r < 40 ? "WEAK" : "NEUTRAL";
  
  // Distance to EMA20 to detect if we are near support or extended
  const distEma = (close - e20) / e20;
  let position = "NEAR_SUPPORT";
  if (distEma > 0.05) position = "EXTENDED_UP";
  else if (distEma < -0.05) position = "EXTENDED_DOWN";

  // Example output: BULL_STRONG_NEAR_SUPPORT
  return `${trend}_${momentum}_${position}`;
};

export const runEvolutionBacktest = async (tokens, onProgress) => {
  const sequences = [];
  let processed = 0;

  for (const token of tokens) {
    try {
      // Fetch maximum available 1H history (e.g. 1000 candles ~ 40 days)
      const fetchSymbol = token.symbol.includes('USDT') ? token.symbol : `${token.symbol}USDT`;
      const data = token.exchange === 'binance' 
        ? await fetchBinanceData(fetchSymbol, '60', 1000)
        : await fetchBybitData(fetchSymbol, '60', 1000);

      if (!data || data.length < 200) {
        processed++;
        if (onProgress) onProgress((processed / tokens.length) * 100);
        await new Promise(r => setTimeout(r, 100)); // rate limit protection
        continue;
      }

      // Binance returns oldest first if reversed, Bybit returns newest first. 
      // Ensure chronological order (oldest to newest)
      const isBybit = token.exchange !== 'binance';
      let parsed = data;
      if (isBybit) {
         parsed = [...data].reverse();
      }

      const closes = parsed.map(k => Number(k[4]));
      const ema20 = calcEMA(closes, 20);
      const ema50 = calcEMA(closes, 50);
      const rsiArray = calcRSI(closes, 14);

      // We start scanning from index 100 to allow history for T-24, T-12, etc.
      // We stop at length - 48 to allow looking forward 48 hours for success/failure.
      for (let i = 100; i < closes.length - 48; i++) {
        const currentClose = closes[i];
        const stateT0 = extractMarketState(closes, ema20, ema50, rsiArray, i);
        const stateTminus4 = extractMarketState(closes, ema20, ema50, rsiArray, i - 4);
        const stateTminus12 = extractMarketState(closes, ema20, ema50, rsiArray, i - 12);
        const stateTminus24 = extractMarketState(closes, ema20, ema50, rsiArray, i - 24);

        // We only care about potential breakout signals: must be crossing above EMA20 or strong RSI
        if (stateT0.includes("BULL") || stateT0.includes("STRONG")) {
           
           // Evaluate future 48h (Winner = +15% peak, Loser = hits -5% before +15% or doesn't move)
           let outcome = "STAGNANT";
           let maxHigh = 0;
           let maxDrop = 0;

           for (let j = i + 1; j <= i + 48; j++) {
             const futureHigh = Number(parsed[j][2]);
             const futureLow = Number(parsed[j][3]);
             const gain = (futureHigh / currentClose) - 1;
             const drop = (futureLow / currentClose) - 1;

             if (drop < maxDrop) maxDrop = drop;
             if (gain > maxHigh) maxHigh = gain;

             if (maxDrop <= -0.05 && maxHigh < 0.15) {
               outcome = "LOSER";
               break;
             }
             if (maxHigh >= 0.15) {
               outcome = "WINNER";
               break;
             }
           }

           if (outcome !== "STAGNANT") {
              const sequenceStr = `${stateTminus24} -> ${stateTminus12} -> ${stateTminus4} -> ${stateT0}`;
              sequences.push({
                 symbol: token.symbol,
                 sequence: sequenceStr,
                 outcome: outcome
              });
              // Skip ahead a bit to avoid overlapping signals
              i += 12; 
           }
        }
      }
    } catch (err) {
      console.warn("Failed backtest for", token.symbol);
    }

    processed++;
    if (onProgress) onProgress((processed / tokens.length) * 100);
    
    // Avoid rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  return clusterSequences(sequences);
};

export const clusterSequences = (sequences) => {
  const clusters = {};

  // Group by sequence string
  sequences.forEach(seq => {
    if (!clusters[seq.sequence]) {
      clusters[seq.sequence] = { wins: 0, losses: 0, total: 0, winRate: 0 };
    }
    clusters[seq.sequence].total++;
    if (seq.outcome === "WINNER") clusters[seq.sequence].wins++;
    else if (seq.outcome === "LOSER") clusters[seq.sequence].losses++;
  });

  // Convert to array and calculate win rate
  const result = Object.entries(clusters)
    .map(([sequenceStr, stats]) => {
      stats.winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
      return { sequence: sequenceStr, ...stats };
    })
    // Filter out sequences that have very low occurrences to avoid noise
    .filter(c => c.total >= 5) 
    .sort((a, b) => b.winRate - a.winRate);

  return result;
};

// Main function to check a live sequence against the trained engine
export const evaluateCurrentTokenEvolution = (historicalCandles, stateMachineClusters) => {
  if (!stateMachineClusters || !Array.isArray(stateMachineClusters) || stateMachineClusters.length === 0 || !historicalCandles || !Array.isArray(historicalCandles) || historicalCandles.length < 50) return null;

  const closes = historicalCandles.map(c => c.close);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const rsiArray = calcRSI(closes, 14);

  const i = closes.length - 1;
  const stateT0 = extractMarketState(closes, ema20, ema50, rsiArray, i);
  const stateTminus4 = extractMarketState(closes, ema20, ema50, rsiArray, i - 4);
  const stateTminus12 = extractMarketState(closes, ema20, ema50, rsiArray, i - 12);
  const stateTminus24 = extractMarketState(closes, ema20, ema50, rsiArray, i - 24);

  const currentSequence = `${stateTminus24} -> ${stateTminus12} -> ${stateTminus4} -> ${stateT0}`;

  const match = stateMachineClusters.find(c => c.sequence === currentSequence);
  
  return {
    sequence: currentSequence,
    matchedCluster: match || null
  };
};

// Translates raw state indicators into a human-readable "Explosion Story"
export const generateExplosionStory = (historicalCandles, solCandles) => {
  try {
    if (!historicalCandles || historicalCandles.length < 50) return null;

    const closes = historicalCandles.map(c => c.close);
    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    const rsiArray = calcRSI(closes, 14);

    const i = closes.length - 1;
    
    const buildStep = (index, label) => {
      if (index < 0) return null;
      const state = extractMarketState(closes, ema20, ema50, rsiArray, index);
      const candle = historicalCandles[index];
      const prevCandle = index > 0 ? historicalCandles[index - 1] : candle;
      
      // Determine Trend
      let trendDesc = "Indécis";
      let icon = "⏸️";
      if (state.includes("BULL_STRONG")) { trendDesc = "Forte Hausse"; icon = "🚀"; }
      else if (state.includes("BULL")) { trendDesc = "Tendance Haussière"; icon = "🐂"; }
      else if (state.includes("BEAR_STRONG")) { trendDesc = "Forte Baisse"; icon = "🩸"; }
      else if (state.includes("BEAR")) { trendDesc = "Tendance Baissière"; icon = "🐻"; }
      
      // Determine Net Flow / Price Action vs SOL
      let flowDesc = "Consolidation";
      if (state.includes("EXTENDED_UP")) flowDesc = "Prix très étiré vers le haut (Surachat)";
      else if (state.includes("NEAR_SUPPORT")) flowDesc = "Le prix repose sur le support (EMA20)";
      else if (candle.close > prevCandle.close * 1.02) flowDesc = "Forte impulsion acheteuse";
      
      // Determine Volume/Whales
      let volumeDesc = "Volume Normal";
      let volIcon = "📊";
      if (candle.volume > (prevCandle.volume * 2)) {
        volumeDesc = "Pic d'Activité (Baleines possibles)";
        volIcon = "🐳";
      } else if (candle.volume < (prevCandle.volume * 0.5)) {
        volumeDesc = "Baisse de volume (Désintérêt)";
        volIcon = "📉";
      }

      // Determine VWAP distance (approx using EMA50 as proxy if real VWAP not passed, but we can just use EMAs here)
      const distToEma50 = ((candle.close / ema50[index]) - 1) * 100;
      let vwapDesc = `À ${distToEma50.toFixed(1)}% du prix moyen (VWAP/EMA50)`;

      return {
        label,
        state,
        trendDesc,
        icon,
        flowDesc,
        volumeDesc,
        volIcon,
        vwapDesc
      };
    };

    const steps = [
      buildStep(i - 24, "T-24h"),
      buildStep(i - 12, "T-12h"),
      buildStep(i - 4, "T-4h"),
      buildStep(i, "T0 (Signal)")
    ].filter(Boolean);

    return steps;
  } catch (err) {
    console.error("Error in generateExplosionStory:", err);
    return [{ label: "Error", state: "ERROR", trendDesc: err.message, icon: "❌", flowDesc: "", volumeDesc: "", volIcon: "", vwapDesc: "" }];
  }
};

