const fs = require('fs');

async function fetchTopGainers() {
  const url = 'https://api.bybit.com/v5/market/tickers?category=spot';
  const response = await fetch(url);
  const data = await response.json();
  if (data.retCode === 0) {
    const list = data.result.list;
    const sorted = list
      .filter(t => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.price24hPcnt) - parseFloat(a.price24hPcnt))
      .slice(0, 15);
    return sorted;
  }
  return [];
}

async function fetchKlines(symbol, interval, limit) {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.retCode === 0 && data.result && data.result.list) {
    // Bybit returns newest first, so we reverse it
    return data.result.list.reverse().map(k => ({
      time: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
  }
  return [];
}

function calculateRollingStrength(klines, period) {
  if (!klines || klines.length < period) return [];
  const strength = [];
  for (let i = period; i < klines.length; i++) {
    const currentClose = klines[i].close;
    const pastClose = klines[i - period].close;
    const change = ((currentClose - pastClose) / pastClose) * 100;
    strength.push({
      time: klines[i].time,
      value: change
    });
  }
  return strength;
}

function syntheticRatio(klinesTarget, klinesBase) {
  const baseMap = new Map();
  for (let k of klinesBase) {
    baseMap.set(k.time, k.close);
  }
  const synth = [];
  for (let k of klinesTarget) {
    if (baseMap.has(k.time)) {
      synth.push({
        time: k.time,
        close: k.close / baseMap.get(k.time)
      });
    }
  }
  return synth;
}

function getPeriodForTF(tf) {
  if (tf === '15') return 96;
  if (tf === '60') return 24;
  if (tf === '240') return 6;
  if (tf === 'D') return 1;
  return 24;
}

async function run() {
  console.log("Fetching top 15 gainers...");
  const gainers = await fetchTopGainers();
  console.log("Top Gainers:", gainers.map(g => `${g.symbol} (+${(g.price24hPcnt*100).toFixed(2)}%)`).join(', '));
  
  const timeframes = ['15', '60', '240']; // 15m, 1h, 4h
  
  let btcKlines = {};
  let solKlines = {};
  
  for (let tf of timeframes) {
    btcKlines[tf] = await fetchKlines('BTCUSDT', tf, 500);
    solKlines[tf] = await fetchKlines('SOLUSDT', tf, 500);
  }
  
  const analysis = [];

  for (let token of gainers) {
    console.log(`Analyzing ${token.symbol}...`);
    
    let tokenData = {};
    for (let tf of timeframes) {
      const klines = await fetchKlines(token.symbol, tf, 500);
      if (klines.length < 100) continue;
      
      const period = getPeriodForTF(tf);
      
      const strUsdt = calculateRollingStrength(klines, period);
      
      const synthSol = syntheticRatio(klines, solKlines[tf]);
      const strSol = calculateRollingStrength(synthSol, period);
      
      // Find the pump index
      // The pump is usually the biggest 1-2 bars
      let maxChange = 0;
      let pumpIndex = -1;
      for (let i = 1; i < klines.length; i++) {
        const change = ((klines[i].close - klines[i-1].close) / klines[i-1].close) * 100;
        if (change > maxChange) {
          maxChange = change;
          pumpIndex = i;
        }
      }
      
      if (pumpIndex !== -1 && pumpIndex > period + 20) {
        // Look at the rolling strength 1 to 20 bars before the pump
        const prePumpUsdt = strUsdt.filter(s => s.time < klines[pumpIndex].time).slice(-20);
        const prePumpSol = strSol.filter(s => s.time < klines[pumpIndex].time).slice(-20);
        
        tokenData[tf] = {
           pumpTime: new Date(klines[pumpIndex].time).toISOString(),
           pumpSize: maxChange.toFixed(2),
           prePumpUsdt: prePumpUsdt.map(s => s.value.toFixed(2)),
           prePumpSol: prePumpSol.map(s => s.value.toFixed(2))
        };
      }
    }
    
    if (Object.keys(tokenData).length > 0) {
       analysis.push({ symbol: token.symbol, data: tokenData });
    }
  }
  
  fs.writeFileSync('gainer_analysis.json', JSON.stringify(analysis, null, 2));
  console.log("Analysis saved to gainer_analysis.json");
}

run().catch(console.error);
