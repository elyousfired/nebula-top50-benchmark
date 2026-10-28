import { fetchBybitData, fetchTop500Symbols } from './scanner';

export const fetchCoinGeckoTop100 = async () => {
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true';
    const res = await fetch(url);
    if (!res.ok) throw new Error('CoinGecko API error');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(err);
    return [];
  }
};

const EXCLUDED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'USDTUSDT', 'USDCUSDT', 'DAIUSDT', 'FDUSDUSDT', 'USDEUSDT', 'WBTCUSDT', 'WETHUSDT'];

export const buildMacroIndex = async (cgData, days = 180) => {
  const bybitSymbols = await fetchTop500Symbols();
  const bybitSet = new Set(bybitSymbols.map(s => s.symbol));
  
  // Find matches
  const altcoinsToFetch = [];
  const solToken = cgData.find(c => c.symbol.toLowerCase() === 'sol');
  
  for (const c of cgData) {
    const sym = c.symbol.toUpperCase() + 'USDT';
    if (bybitSet.has(sym) && !EXCLUDED_SYMBOLS.includes(sym)) {
      altcoinsToFetch.push({
        ...c,
        bybitSymbol: sym
      });
    }
  }

  let solG6M = 0, solG1M = 0, solG1W = 0, solG1D = 0;

  const getGrowth = (dataArr, daysAgo) => {
     if (!dataArr || dataArr.length === 0) return 0;
     const currentClose = Number(dataArr[0][4]);
     const idx = Math.min(daysAgo, dataArr.length - 1);
     const oldClose = Number(dataArr[idx][4]);
     if (oldClose > 0) {
         return ((currentClose - oldClose) / oldClose) * 100;
     }
     return 0;
  };

  // Fetch SOL historical
  if (solToken) {
    const solData = await fetchBybitData('SOLUSDT', 'D', days);
    if (solData && solData.length > 0) {
       solG6M = getGrowth(solData, 180);
       solG1M = getGrowth(solData, 30);
       solG1W = getGrowth(solData, 7);
       solG1D = getGrowth(solData, 1);
    }
  }

  const results = [];

  // Fetch Altcoins
  const BATCH_SIZE = 10;
  for (let i = 0; i < altcoinsToFetch.length; i += BATCH_SIZE) {
    const batch = altcoinsToFetch.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (coin) => {
      try {
        const data = await fetchBybitData(coin.bybitSymbol, 'D', days);
        if (data && data.length > 0) {
           const tokenG6M = getGrowth(data, 180);
           const tokenG1M = getGrowth(data, 30);
           const tokenG1W = getGrowth(data, 7);
           const tokenG1D = getGrowth(data, 1);
           
           results.push({
              ...coin,
              growth6M: tokenG6M,
              growth1M: tokenG1M,
              growth1W: tokenG1W,
              growth1D: tokenG1D,
              outperformance6M: tokenG6M - solG6M,
              outperformance1M: tokenG1M - solG1M,
              outperformance1W: tokenG1W - solG1W,
              outperformance1D: tokenG1D - solG1D
           });
        }
      } catch (e) {}
    });
    await Promise.all(promises);
    if (i + BATCH_SIZE < altcoinsToFetch.length) await new Promise(r => setTimeout(r, 200));
  }

  // Sort by 6M outperformance descending initially
  results.sort((a, b) => b.outperformance6M - a.outperformance6M);

  return {
     rankedTokens: results,
     solGrowth: { g6M: solG6M, g1M: solG1M, g1W: solG1W, g1D: solG1D }
  };
};
