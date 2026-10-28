// Engine for advanced synthetic charting (TOKEN/BTC)

const BYBIT_INTERVALS = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
  '3d': 'D', // Bybit uses 'D' for day, we'll need to aggregate if 3d isn't natively supported or just use native if possible
  '1W': 'W',
  '1M': 'M'
};

// Simple in-memory cache for BTC klines to avoid duplicate requests when rendering grid
const btcKlinesCache = new Map();

const fetchWithRetry = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.retCode !== 0) throw new Error(data.retMsg);
      return data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
    }
  }
};

/**
 * Fetch klines for a single symbol from spot market
 */
async function fetchKlines(symbol, interval, limit = 1000) {
  try {
    const intervalMap = {
      '1m': '1', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '4h': '240', '1d': 'D', '3d': 'D', '1W': 'W', '1M': 'M'
    };
    const bybitInterval = intervalMap[interval] || '60';
    
    // Ensure the symbol ends with USDT
    const formattedSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${formattedSymbol}&interval=${bybitInterval}&limit=${limit}`;
    
    // Check cache for BTC
    const cacheKey = `${symbol}-${bybitInterval}-${limit}`;
    if (symbol === 'BTC' && btcKlinesCache.has(cacheKey)) {
      return btcKlinesCache.get(cacheKey);
    }

    const data = await fetchWithRetry(url, 3);
    
    if (!data?.result?.list) return [];
    
    // Bybit returns newest first, so we reverse to get oldest first
    const parsedKlines = data.result.list.map(row => {
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

    if (symbol === 'BTC') {
      btcKlinesCache.set(cacheKey, parsedKlines);
      // Clear cache after 1 minute so it can refresh
      setTimeout(() => btcKlinesCache.delete(cacheKey), 60000);
    }
    
    return parsedKlines;
  } catch (err) {
    console.error(`Error fetching klines for ${symbol}`, err);
    return [];
  }
}

/**
 * Fetch token and BTC klines, and merge them into synthetic TOKEN/BTC candles
 */
export async function fetchSyntheticBtcChartData(tokenSymbol, interval, limit = 1000) {
  const [tokenKlines, btcKlines] = await Promise.all([
    fetchKlines(tokenSymbol, interval, limit),
    fetchKlines("BTC", interval, limit)
  ]);

  if (!tokenKlines.length || !btcKlines.length) return [];

  // Match by exact timestamp
  const btcMap = new Map(btcKlines.map(c => [c.time, c]));
  
  const syntheticCandles = [];
  
  for (const token of tokenKlines) {
    const btc = btcMap.get(token.time);
    if (btc && btc.open > 0 && btc.high > 0 && btc.low > 0 && btc.close > 0) {
      syntheticCandles.push({
        time: token.time,
        open: token.open / btc.open,
        high: token.high / btc.high, // Not perfectly accurate, but good enough for synthetic
        low: token.low / btc.low,
        close: token.close / btc.close,
        value: token.turnover, // For volume histogram (turnover in USDT)
        tokenOpen: token.open,
        tokenClose: token.close
      });
    }
  }

  // Aggregate 3d candles if interval is 3d
  if (interval === '3d') {
    return aggregateCandles(syntheticCandles, 3);
  }

  return syntheticCandles;
}

/**
 * Fetch standard USDT klines, formatted for the chart
 */
export async function fetchStandardChartData(tokenSymbol, interval, limit = 1000) {
  const klines = await fetchKlines(tokenSymbol, interval, limit);
  
  const formattedCandles = klines.map(k => ({
    time: k.time,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    value: k.turnover, // using value for Volume
    tokenOpen: k.open,
    tokenClose: k.close
  }));

  if (interval === '3d') {
    return aggregateCandles(formattedCandles, 3);
  }

  return formattedCandles;
}

// Helper to aggregate candles (e.g. 3 days into 1)
function aggregateCandles(candles, groupSize) {
  const aggregated = [];
  for (let i = 0; i < candles.length; i += groupSize) {
    const chunk = candles.slice(i, i + groupSize);
    if (chunk.length > 0) {
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const high = Math.max(...chunk.map(c => c.high));
      const low = Math.min(...chunk.map(c => c.low));
      const volume = chunk.reduce((sum, c) => sum + c.value, 0);
      aggregated.push({
        time: first.time,
        open: first.open,
        high,
        low,
        close: last.close,
        value: volume
      });
    }
  }
  return aggregated;
}

/**
 * Detect Supports and Resistances (Pivot points)
 */
export function detectSupportResistance(candles, initialLeft = 15, initialRight = 10, livePrice = null) {
  let supports = [];
  let resistances = [];
  let windowSizeLeft = initialLeft;
  let windowSizeRight = initialRight;
  
  const currentPrice = livePrice !== null ? livePrice : candles[candles.length - 1].close;

  while (windowSizeLeft >= 2 && windowSizeRight >= 2) {
    supports = [];
    resistances = [];
    
    for (let i = windowSizeLeft; i < candles.length - windowSizeRight; i++) {
      const currentHigh = candles[i].high;
      const currentLow = candles[i].low;

      let isPivotHigh = true;
      let isPivotLow = true;

      // Check left
      for (let j = 1; j <= windowSizeLeft; j++) {
        if (candles[i - j].high > currentHigh) isPivotHigh = false;
        if (candles[i - j].low < currentLow) isPivotLow = false;
      }

      // Check right
      for (let j = 1; j <= windowSizeRight; j++) {
        if (candles[i + j].high > currentHigh) isPivotHigh = false;
        if (candles[i + j].low < currentLow) isPivotLow = false;
      }

      if (isPivotHigh) {
        resistances.push({ price: currentHigh, time: candles[i].time, type: 'resistance' });
      }
      if (isPivotLow) {
        supports.push({ price: currentLow, time: candles[i].time, type: 'support' });
      }
    }

    let hasSupport = supports.some(s => s.price <= currentPrice);
    let hasResistance = resistances.some(r => r.price >= currentPrice);
    
    if (hasSupport && hasResistance) {
      break;
    }
    
    // Reduce strictness to find minor peaks (HH/LL)
    windowSizeLeft--;
    windowSizeRight--;
  }
  
  let closestSupport = null;
  let closestResistance = null;

  for (const s of supports) {
    if (s.price <= currentPrice) {
      if (!closestSupport || s.price > closestSupport.price) {
        closestSupport = s;
      }
    }
  }

  for (const r of resistances) {
    if (r.price >= currentPrice) {
      if (!closestResistance || r.price < closestResistance.price) {
        closestResistance = r;
      }
    }
  }

  return {
    supports: closestSupport ? [closestSupport] : [],
    resistances: closestResistance ? [closestResistance] : []
  };
}

/**
 * Calculate Exponential Moving Average (EMA) with Slope Color
 */
export function calculateSlopeEMA(data, period = 20, negativeColor = '#ef5350') {
  if (!data || data.length < period) return [];
  
  const emaData = [];
  const k = 2 / (period + 1);
  
  // Calculate SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEma = sum / period;
  
  // Add first point
  emaData.push({ time: data[period - 1].time, value: prevEma, color: '#64748b' });
  
  for (let i = period; i < data.length; i++) {
    const close = data[i].close;
    const currentEma = (close * k) + (prevEma * (1 - k));
    
    // Slope Color Logic
    let slopeColor = negativeColor; 
    if (currentEma > prevEma) {
      slopeColor = '#26a69a'; // Green
    }

    emaData.push({ time: data[i].time, value: currentEma, color: slopeColor });
    prevEma = currentEma;
  }
  
  return emaData;
}
