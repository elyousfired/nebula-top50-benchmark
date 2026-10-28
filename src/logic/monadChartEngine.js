// Engine for advanced synthetic charting (TOKEN/MONAD)
const BYBIT_INTERVALS = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4H': '240',
  '1d': 'D',
  '1W': 'W'
};

/**
 * Fetch klines for a single symbol
 */
async function fetchKlines(symbol, interval, limit = 1000) {
  try {
    const bybitInterval = BYBIT_INTERVALS[interval];
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}USDT&interval=${bybitInterval}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data?.result?.list) return [];
    
    // Bybit returns newest first, so we reverse to get oldest first
    return data.result.list.map(row => {
      const open = Number(row[1]);
      const close = Number(row[4]);
      const volume = Number(row[5]);
      const turnover = Number(row[6]) || (volume * close);
      return {
        time: Number(row[0]) / 1000,
        open,
        high: Number(row[2]),
        low: Number(row[3]),
        close,
        volume,
        turnover
      };
    }).sort((a, b) => a.time - b.time);
  } catch (err) {
    console.error(`Error fetching klines for ${symbol}`, err);
    return [];
  }
}

/**
 * Fetch token and MONAD klines, and merge them into synthetic TOKEN/MONAD candles
 */
export async function fetchSyntheticChartData(tokenSymbol, interval) {
  const [tokenKlines, monKlines] = await Promise.all([
    fetchKlines(tokenSymbol, interval),
    fetchKlines("MON", interval)
  ]);

  if (!tokenKlines.length || !monKlines.length) return [];

  // Match by exact timestamp
  const monMap = new Map(monKlines.map(c => [c.time, c]));
  
  const syntheticCandles = [];
  
  for (const token of tokenKlines) {
    const mon = monMap.get(token.time);
    if (mon && mon.open > 0 && mon.high > 0 && mon.low > 0 && mon.close > 0) {
      syntheticCandles.push({
        time: token.time,
        open: token.open / mon.open,
        high: token.high / mon.high,
        low: token.low / mon.low,
        close: token.close / mon.close,
        value: token.volume // For volume histogram
      });
    }
  }

  return syntheticCandles;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data, period = 20) {
  if (!data || data.length < period) return [];
  
  const emaData = [];
  const k = 2 / (period + 1);
  
  // Calculate SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEma = sum / period;
  
  // Add first point (we put it at the index of the first valid period)
  emaData.push({ time: data[period - 1].time, value: prevEma });
  
  for (let i = period; i < data.length; i++) {
    const close = data[i].close;
    const currentEma = (close * k) + (prevEma * (1 - k));
    emaData.push({ time: data[i].time, value: currentEma });
    prevEma = currentEma;
  }
  
  return emaData;
}

/**
 * Fetch token sub-klines and aggregate them into parent timeframe CVD candles
 */
export async function fetchSyntheticCvdChartData(tokenSymbol, timeframe) {
  let subInterval = '15m';
  let blockMs = 60 * 60 * 1000;

  if (timeframe === '1m') { subInterval = '1m'; blockMs = 60 * 1000; }
  else if (timeframe === '15m') { subInterval = '5m'; blockMs = 15 * 60 * 1000; }
  else if (timeframe === '1h') { subInterval = '15m'; blockMs = 60 * 60 * 1000; }
  else if (timeframe === '4H') { subInterval = '15m'; blockMs = 4 * 60 * 60 * 1000; }
  else if (timeframe === '1d') { subInterval = '1h'; blockMs = 24 * 60 * 60 * 1000; }
  else if (timeframe === '1W') { subInterval = '1d'; blockMs = 7 * 24 * 60 * 60 * 1000; }

  const tokenKlines = await fetchKlines(tokenSymbol, subInterval, 1000);
  if (!tokenKlines || !tokenKlines.length) return [];

  const blocks = {};
  const blockOrder = [];
  let cumulativeFlow = 0;

  tokenKlines.forEach(k => {
    const timeMs = k.time * 1000;
    const flow = k.open > 0 ? k.turnover * ((k.close - k.open) / k.open) : 0;
    cumulativeFlow += flow;

    let blockTime;
    if (timeframe === '1W') {
      blockTime = Math.floor((timeMs - 345600000) / 604800000) * 604800000 + 345600000;
    } else {
      blockTime = Math.floor(timeMs / blockMs) * blockMs;
    }

    if (!blocks[blockTime]) {
      blocks[blockTime] = {
        time: blockTime,
        flows: [],
        cvdValues: []
      };
      blockOrder.push(blockTime);
    }
    blocks[blockTime].flows.push(flow);
    blocks[blockTime].cvdValues.push(cumulativeFlow);
  });

  let runningCvdPrev = 0;
  const cvdCandles = [];

  blockOrder.forEach(bt => {
    const b = blocks[bt];
    const openCvd = runningCvdPrev;
    const closeCvd = b.cvdValues[b.cvdValues.length - 1];
    const highCvd = Math.max(openCvd, closeCvd, ...b.cvdValues);
    const lowCvd = Math.min(openCvd, closeCvd, ...b.cvdValues);

    cvdCandles.push({
      time: bt / 1000,
      open: openCvd,
      high: highCvd,
      low: lowCvd,
      close: closeCvd
    });

    runningCvdPrev = closeCvd;
  });

  return cvdCandles;
}
