const axios = require('axios');
const fs = require('fs');

// Basic Math/TA Functions
const parseCandles = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(k => ({
    time: Number(k[0]) / 1000, 
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  })).sort((a,b) => a.time - b.time);
};

const syntheticRatio = (tokenCandles, benchmarkCandles) => {
  if (!tokenCandles.length || !benchmarkCandles.length) return [];
  const byTime = new Map(benchmarkCandles.map((c) => [c.time, c]));
  return tokenCandles.flatMap((tc) => {
    const bc = byTime.get(tc.time);
    if (!bc || !bc.close) return [];
    return [{
      time: tc.time,
      open: tc.open / bc.open,
      high: tc.high / bc.high,
      low: tc.low / bc.low,
      close: tc.close / bc.close,
      volume: tc.volume
    }];
  });
};

const calculateRollingStrength = (candles, period = 24) => {
  const result = [];
  for (let i = period; i < candles.length; i++) {
    const current = candles[i].close;
    const past = candles[i - period].close;
    if (past > 0) {
      result.push({
        time: candles[i].time,
        value: ((current / past) - 1) * 100
      });
    }
  }
  return result;
};

// API Fetchers
const fetchBybitData = async (symbol, limit = 1000) => {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=60&limit=${limit}`;
  try {
    const res = await axios.get(url);
    if (res.data?.result?.list) return res.data.result.list;
  } catch (e) {}
  return [];
};

const fetchTopTickers = async () => {
  const url = 'https://api.bybit.com/v5/market/tickers?category=spot';
  try {
    const res = await axios.get(url);
    const list = res.data?.result?.list || [];
    return list.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
               .sort((a,b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
               .slice(0, 300); // Analyze top 300 tokens by volume
  } catch(e) {}
  return [];
};

// Backtest Logic purely based on ROLLING STRENGTH (USDT, SOL, BTC)
const runBacktest = async () => {
  console.log("Fetching Benchmark Data (BTC & SOL)...");
  const rawBtc = await fetchBybitData('BTCUSDT', 1000);
  const rawSol = await fetchBybitData('SOLUSDT', 1000);
  const btcCandles = parseCandles(rawBtc);
  const solCandles = parseCandles(rawSol);

  console.log("Fetching Top Tickers...");
  const tickers = await fetchTopTickers();
  console.log(`Found ${tickers.length} tickers. Scanning for recent pumps...`);

  let pumpCount = 0;
  const analysisResults = [];

  for (let t = 0; t < tickers.length; t++) {
    const ticker = tickers[t];
    if (t % 50 === 0 && t > 0) console.log(`Scanned ${t} tokens...`);

    const rawCandles = await fetchBybitData(ticker.symbol, 1000);
    const candles = parseCandles(rawCandles);
    if (candles.length < 200) continue;

    // Detect a pump: > 15% increase within 12 candles (12 hours extended rally)
    let pumpStartIndex = -1;
    let maxGain = 0;

    for (let i = 100; i < candles.length - 15; i++) {
      const basePrice = candles[i].close;
      let localMax = basePrice;
      for (let j = 1; j <= 12; j++) {
        if (candles[i+j].high > localMax) localMax = candles[i+j].high;
      }
      const gain = ((localMax / basePrice) - 1) * 100;
      if (gain >= 15) {
        // Find the first clean breakout
        const prevPrice = candles[i - 12].close;
        const prevGain = ((basePrice / prevPrice) - 1) * 100;
        if (prevGain < 10) {
          pumpStartIndex = i;
          maxGain = gain;
          break; 
        }
      }
    }

    if (pumpStartIndex !== -1) {
      pumpCount++;
      
      const historyCandles = candles.slice(0, pumpStartIndex + 1); // Up to T=0

      // Calculate ROLLING STRENGTH ONLY
      const strSol = calculateRollingStrength(syntheticRatio(historyCandles, solCandles), 24); 
      const strBtc = calculateRollingStrength(syntheticRatio(historyCandles, btcCandles), 24);
      const strUsdt = calculateRollingStrength(historyCandles, 24);

      const getVal = (arr, offset) => {
        if (!arr || arr.length <= offset) return null;
        return arr[arr.length - 1 - offset]?.value;
      };

      // Extract values at T-1, T-2, T-3, T-4, T-6
      analysisResults.push({
        symbol: ticker.symbol,
        gain: maxGain,
        // USDT
        t1_strUsdt: getVal(strUsdt, 1),
        t2_strUsdt: getVal(strUsdt, 2),
        t3_strUsdt: getVal(strUsdt, 3),
        t4_strUsdt: getVal(strUsdt, 4),
        t6_strUsdt: getVal(strUsdt, 6),
        // SOL
        t1_strSol: getVal(strSol, 1),
        t2_strSol: getVal(strSol, 2),
        t3_strSol: getVal(strSol, 3),
        t4_strSol: getVal(strSol, 4),
        t6_strSol: getVal(strSol, 6),
        // BTC
        t1_strBtc: getVal(strBtc, 1),
        t2_strBtc: getVal(strBtc, 2),
        t3_strBtc: getVal(strBtc, 3),
        t4_strBtc: getVal(strBtc, 4),
        t6_strBtc: getVal(strBtc, 6)
      });
    }
  }

  console.log(`\n--- ANALYSIS COMPLETE ---`);
  console.log(`Analyzed ${pumpCount} valid historical breakouts.`);
  
  if (pumpCount === 0) {
    console.log("No pumps found in the dataset to analyze.");
    return;
  }

  // Counters for specific Rolling Strength patterns BEFORE the pump
  let solLeadingUsdt = 0;       // SOL strength > USDT strength at T-1
  let btcLeadingUsdt = 0;       // BTC strength > USDT strength at T-1
  let solCrossedZeroEarly = 0;  // SOL strength > 0 while USDT strength < 0 at T-1 or T-2
  let btcCrossedZeroEarly = 0;  // BTC strength > 0 while USDT strength < 0 at T-1 or T-2
  let solSlopingUp = 0;         // SOL strength increasing from T-4 to T-1
  let btcSlopingUp = 0;         // BTC strength increasing from T-4 to T-1
  let allNegativeBefore = 0;    // All 3 strengths were negative at T-1 (sudden pump out of nowhere)
  let usdtFlatButSolRising = 0; // USDT strength changed < 2% between T-4 and T-1, but SOL strength rose > 2%

  analysisResults.forEach(res => {
    if (res.t1_strSol > res.t1_strUsdt) solLeadingUsdt++;
    if (res.t1_strBtc > res.t1_strUsdt) btcLeadingUsdt++;
    
    if ((res.t1_strSol > 0 && res.t1_strUsdt < 0) || (res.t2_strSol > 0 && res.t2_strUsdt < 0)) solCrossedZeroEarly++;
    if ((res.t1_strBtc > 0 && res.t1_strUsdt < 0) || (res.t2_strBtc > 0 && res.t2_strUsdt < 0)) btcCrossedZeroEarly++;
    
    if (res.t1_strSol > res.t4_strSol) solSlopingUp++;
    if (res.t1_strBtc > res.t4_strBtc) btcSlopingUp++;

    if (res.t1_strUsdt < 0 && res.t1_strSol < 0 && res.t1_strBtc < 0) allNegativeBefore++;

    const usdtChange = Math.abs(res.t1_strUsdt - res.t4_strUsdt);
    const solChange = res.t1_strSol - res.t4_strSol;
    if (usdtChange < 2 && solChange > 2) usdtFlatButSolRising++;
  });

  const report = {
    totalPumpsAnalyzed: pumpCount,
    signals: {
      "SOL_Leading_USDT_At_T1": ((solLeadingUsdt / pumpCount)*100).toFixed(1) + '%',
      "BTC_Leading_USDT_At_T1": ((btcLeadingUsdt / pumpCount)*100).toFixed(1) + '%',
      "SOL_Crossed_Zero_Before_USDT": ((solCrossedZeroEarly / pumpCount)*100).toFixed(1) + '%',
      "BTC_Crossed_Zero_Before_USDT": ((btcCrossedZeroEarly / pumpCount)*100).toFixed(1) + '%',
      "SOL_Strength_Sloping_Up_T4_to_T1": ((solSlopingUp / pumpCount)*100).toFixed(1) + '%',
      "USDT_Flat_But_SOL_Rising": ((usdtFlatButSolRising / pumpCount)*100).toFixed(1) + '%',
      "Sudden_Pump_All_Negative_At_T1": ((allNegativeBefore / pumpCount)*100).toFixed(1) + '%'
    }
  };

  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync('./scripts/backtest_results_rolling.json', JSON.stringify(analysisResults, null, 2));
  console.log('Results saved to backtest_results_rolling.json');
};

runBacktest();
