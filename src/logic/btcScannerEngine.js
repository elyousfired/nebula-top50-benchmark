import { calculateSlopeEMA } from './btcChartEngine';

const BYBIT_INTERVALS = {
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240'
};

const fetchWithRetry = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.retCode !== 0) throw new Error(data.retMsg);
      return data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 500));
    }
  }
};

export async function runMultiTimeframeScan(onProgress) {
  try {
    if (onProgress) onProgress("Fetching Top 100...", 5);
    
    // 1. Fetch Top 100 USDT spot pairs
    const tickersData = await fetchWithRetry("https://api.bybit.com/v5/market/tickers?category=spot");
    const btcTicker = tickersData.result.list.find(t => t.symbol === "BTCUSDT");
    const btcNow = btcTicker ? parseFloat(btcTicker.lastPrice) : 1;
    const btcPrev = btcTicker ? parseFloat(btcTicker.prevPrice24h) : 1;

    let symbolsData = tickersData.result.list
      .filter(t => t.symbol.endsWith("USDT") && t.symbol !== "BTCUSDT")
      .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
      .slice(0, 100);

    const timeframesToFetch = [
      { tf: '1h', interval: '60', limit: 100 },
      { tf: '5m', interval: '5', limit: 4 },
      { tf: '1W', interval: 'W', limit: 2 },
      { tf: '1M', interval: 'M', limit: 2 }
    ];
    
    const results = {};
    const symbols = [];
    
    symbolsData.forEach(t => {
      const tokenNow = parseFloat(t.lastPrice);
      const tokenPrev = parseFloat(t.prevPrice24h);
      const tokenPctChange = (tokenNow / tokenPrev) - 1;
      const netFlow24h = parseFloat(t.turnover24h) * tokenPctChange;
      
      const ratioNow = tokenNow / btcNow;
      const ratioPrev = tokenPrev / btcPrev;
      const rsChange24h = ((ratioNow / ratioPrev) - 1) * 100;
      
      const s = t.symbol;
      symbols.push(s);
      
      results[s] = { 
        symbol: s.replace('USDT', ''), 
        signals: [],      // array of { tf, candleTime }
        netFlow24h,
        rsChange24h,
        rsChange1w: 0,
        rsChange4h: 0,
        rsChange1h: 0,
        rsChange15m: 0,
        rsChange5m: 0,
      };
    });

    const currentPrices = {};
    symbolsData.forEach(t => {
      const sym = t.symbol.replace('USDT', '');
      const tokenNow = parseFloat(t.lastPrice);
      if (btcNow > 0) currentPrices[sym] = tokenNow / btcNow;
    });

    let completed = 0;
    const totalTasks = timeframesToFetch.length * symbols.length;

    for (const fetchItem of timeframesToFetch) {
      const { tf, interval, limit } = fetchItem;
      
      // Fetch BTC for this timeframe
      const btcUrl = `https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
      const btcRes = await fetchWithRetry(btcUrl);
      const btcKlines = btcRes.result.list.map(row => ({
        time: Number(row[0]) / 1000, open: Number(row[1]), close: Number(row[4]), high: Number(row[2]), low: Number(row[3])
      })).reverse();
      
      const btcMap = new Map(btcKlines.map(c => [c.time, c]));

      // Scan altcoins in batches
      const batchSize = 10;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (symbol) => {
          try {
            const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
            const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`;
            const tokenRes = await fetchWithRetry(url, 2);
            const tokenKlines = tokenRes.result.list.map(row => ({
               time: Number(row[0]) / 1000, 
               open: Number(row[1]), 
               high: Number(row[2]), 
               low: Number(row[3]), 
               close: Number(row[4]),
               volume: Number(row[5]),
               turnover: Number(row[6]) || (Number(row[5]) * Number(row[4]))
            })).reverse();

            // Compute Synthetic Candles (Token / BTC)
            const syntheticCandles = [];
            for (const token of tokenKlines) {
              const btc = btcMap.get(token.time);
              if (btc && btc.open > 0) {
                syntheticCandles.push({
                  time: token.time,
                  open: token.open / btc.open,
                  high: token.high / btc.high,
                  low: token.low / btc.low,
                  close: token.close / btc.close,
                  value: token.turnover,
                  tokenOpen: token.open,
                  tokenClose: token.close
                });
              }
            }

            if (syntheticCandles.length === 0) return;

            // Compute RS values based on the timeframe we just fetched
            const currentCandle = syntheticCandles[syntheticCandles.length - 1];
            
            if (tf === '1h') {
              // We have 100 candles of 1h.
              // RS 1h: last candle close vs its open, or last vs prev close? 
              // Usually RS is change over the period. So close of current vs close 1 period ago.
              if (syntheticCandles.length >= 2) {
                const prev1 = syntheticCandles[syntheticCandles.length - 2];
                results[symbol].rsChange1h = ((currentCandle.close / prev1.close) - 1) * 100;
              }
              if (syntheticCandles.length >= 5) {
                const prev4 = syntheticCandles[syntheticCandles.length - 5];
                results[symbol].rsChange4h = ((currentCandle.close / prev4.close) - 1) * 100;
              }

              // Calculate EMAs and CVD for signals ONLY on 1h
              if (syntheticCandles.length > 50) {
                const ema9 = calculateSlopeEMA(syntheticCandles, 9);
                const ema20 = calculateSlopeEMA(syntheticCandles, 20);
                const ema50 = calculateSlopeEMA(syntheticCandles, 50);

                let cumulativeFlow = 0;
                const cvdData = syntheticCandles.map(d => {
                  const o = d.tokenOpen;
                  const c = d.tokenClose;
                  if (o > 0) cumulativeFlow += d.value * ((c - o) / o);
                  return cumulativeFlow;
                });

                const getVal = (arr, offset) => arr[arr.length - 1 - offset];

                const checkBullish = (offsetFromEnd) => {
                  const e9 = getVal(ema9, offsetFromEnd);
                  const e20 = getVal(ema20, offsetFromEnd);
                  const e50 = getVal(ema50, offsetFromEnd);
                  const e9p = getVal(ema9, offsetFromEnd + 1);
                  const e20p = getVal(ema20, offsetFromEnd + 1);
                  const e50p = getVal(ema50, offsetFromEnd + 1);
                  const cvd = getVal(cvdData, offsetFromEnd);
                  const cvdp = getVal(cvdData, offsetFromEnd + 1);

                  if (!e9 || !e20 || !e50 || !e9p || !e20p || !e50p || cvd === undefined || cvdp === undefined) return false;

                  const slope9Green = e9.value > e9p.value;
                  const slope20Green = e20.value > e20p.value;
                  const slope50Green = e50.value > e50p.value;
                  const cvdWhite = cvd >= cvdp;

                  return slope9Green && slope20Green && slope50Green && cvdWhite;
                };

                const currentBullish = checkBullish(0);
                const prevBullish = checkBullish(1);

                if (currentBullish && !prevBullish) {
                  results[symbol].signals.push({ tf: '1h', candleTime: currentCandle.time });
                }
              }
            } else if (tf === '5m') {
              // We have 4 candles of 5m
              if (syntheticCandles.length >= 2) {
                const prev1 = syntheticCandles[syntheticCandles.length - 2];
                results[symbol].rsChange5m = ((currentCandle.close / prev1.close) - 1) * 100;
              }
              if (syntheticCandles.length >= 4) {
                const prev3 = syntheticCandles[syntheticCandles.length - 4];
                // 3 candles ago = 15m ago
                results[symbol].rsChange15m = ((currentCandle.close / prev3.close) - 1) * 100;
              }
            } else if (tf === '1W') {
              // We have 2 candles of 1W
              if (syntheticCandles.length >= 2) {
                const prev1 = syntheticCandles[syntheticCandles.length - 2];
                results[symbol].rsChange1w = ((currentCandle.close / prev1.close) - 1) * 100;
              }
            } else if (tf === '1M') {
              // We have 2 candles of 1M
              if (syntheticCandles.length >= 2) {
                const prev1 = syntheticCandles[syntheticCandles.length - 2];
                results[symbol].rsChange1M = ((currentCandle.close / prev1.close) - 1) * 100;
              }
            }

          } catch (e) {
            // silent fail
          }
        }));
        
        completed += batch.length;
        if (onProgress) onProgress(`Scanning ${tf}...`, 5 + Math.floor((completed / totalTasks) * 95));
        
        await new Promise(r => setTimeout(r, 100));
      }
    }

    const sortedTokens = symbols.map(s => results[s]).sort((a, b) => {
      const aSignals = a.signals.length;
      const bSignals = b.signals.length;
      if (aSignals !== bSignals) return bSignals - aSignals;
      return (b.netFlow24h || 0) - (a.netFlow24h || 0);
    });

    return { tokens: sortedTokens, currentPrices };

  } catch (error) {
    console.error("Scanner Error:", error);
    return { tokens: [], currentPrices: {} };
  }
}
