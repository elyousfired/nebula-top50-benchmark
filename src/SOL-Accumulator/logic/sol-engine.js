import axios from 'axios';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

// Selected tokens from Solana Ecosystem
export const SOL_ECOSYSTEM = [
  'WIFUSDT', 'BONKUSDT', 'POPCATUSDT', 'JUPUSDT', 'PYTHUSDT', 
  'TNSRUSDT', 'RENDERUSDT', 'HNTUSDT', 'DRIFTUSDT', 'MEWUSDT'
];

/**
 * Fetches kline data and current price for SOL and tokens
 */
export const fetchMarketData = async () => {
  try {
    // 1. Get SOL Price first (The Benchmark)
    const solRes = await axios.get(`${BINANCE_BASE}/ticker/24hr?symbol=SOLUSDT`);
    const solPrice = parseFloat(solRes.data.lastPrice);
    const solChange = parseFloat(solRes.data.priceChangePercent);

    // 2. Fetch all ecosystem tokens
    const tokensData = await Promise.all(
      SOL_ECOSYSTEM.map(async (symbol) => {
        try {
          const res = await axios.get(`${BINANCE_BASE}/ticker/24hr?symbol=${symbol}`);
          const klines = await axios.get(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=1h&limit=24`);
          
          const price = parseFloat(res.data.lastPrice);
          const changePercent = parseFloat(res.data.priceChangePercent);
          
          // Calculate Relative Strength (Ratio Token/SOL)
          const ratio = price / solPrice;
          
          // Relative Change: How much more/less the token moved compared to SOL
          // Formula: ((1 + TokenChange/100) / (1 + SolChange/100) - 1) * 100
          const relativeChange = (((1 + changePercent / 100) / (1 + solChange / 100)) - 1) * 100;

          return {
            symbol: symbol.replace('USDT', ''),
            price,
            changeUSDT: changePercent,
            ratio,
            relativeChange,
            volume: parseFloat(res.data.quoteVolume),
            klines: klines.data.map(k => ({
              time: k[0],
              close: parseFloat(k[4]),
              ratio: parseFloat(k[4]) / solPrice // Simplified historical ratio
            }))
          };
        } catch (e) {
          console.error(`Error fetching ${symbol}:`, e);
          return null;
        }
      })
    );

    return {
      sol: {
        price: solPrice,
        change: solChange
      },
      tokens: tokensData.filter(t => t !== null).sort((a, b) => b.relativeChange - a.relativeChange)
    };
  } catch (error) {
    console.error("Error fetching market data:", error);
    return null;
  }
};

/**
 * Calculates the "Rotation Heat" based on relative volume and acceleration
 */
export const calculateRotationHeat = (token, sol) => {
  if (token.relativeChange > 5) return 'HOT';
  if (token.relativeChange > 0) return 'WARM';
  return 'COOL';
};
