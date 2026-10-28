// Engine for advanced synthetic charting (TOKEN/SOL)

const BYBIT_INTERVALS = {
  '1m': '1',
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
    return data.result.list.map(row => ({
      time: Number(row[0]) / 1000,
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5])
    })).sort((a, b) => a.time - b.time);
  } catch (err) {
    console.error(`Error fetching klines for ${symbol}`, err);
    return [];
  }
}

/**
 * Fetch token and SOL klines, and merge them into synthetic TOKEN/SOL candles
 */
export async function fetchSyntheticChartData(tokenSymbol, interval) {
  const [tokenKlines, solKlines] = await Promise.all([
    fetchKlines(tokenSymbol, interval),
    fetchKlines("SOL", interval)
  ]);

  if (!tokenKlines.length || !solKlines.length) return [];

  // Match by exact timestamp
  const solMap = new Map(solKlines.map(c => [c.time, c]));
  
  const syntheticCandles = [];
  
  for (const token of tokenKlines) {
    const sol = solMap.get(token.time);
    if (sol && sol.open > 0 && sol.high > 0 && sol.low > 0 && sol.close > 0) {
      syntheticCandles.push({
        time: token.time,
        open: token.open / sol.open,
        high: token.high / sol.high,
        low: token.low / sol.low,
        close: token.close / sol.close,
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
