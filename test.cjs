const fetch = require('node-fetch');

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
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data?.result?.list) return [];
    
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

async function fetchSyntheticBtcChartData(tokenSymbol, interval, limit = 1000) {
  const [tokenKlines, btcKlines] = await Promise.all([
    fetchKlines(tokenSymbol, interval, limit),
    fetchKlines("BTC", interval, limit)
  ]);

  if (!tokenKlines.length || !btcKlines.length) return [];

  const btcMap = new Map(btcKlines.map(c => [c.time, c]));
  
  const syntheticCandles = [];
  
  for (const token of tokenKlines) {
    const btc = btcMap.get(token.time);
    if (btc && btc.open > 0 && btc.high > 0 && btc.low > 0 && btc.close > 0) {
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

  return syntheticCandles;
}

(async () => {
    let data = await fetchSyntheticBtcChartData("NEAR", "1d");
    console.log("Daily first time:", data[0].time, "Last time:", data[data.length-1].time);
    data = await fetchSyntheticBtcChartData("NEAR", "1h");
    console.log("Hourly first time:", data[0].time, "Last time:", data[data.length-1].time);
})();
