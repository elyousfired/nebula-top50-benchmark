import axios from 'axios';

const BINANCE_API = 'https://fapi.binance.com';

/**
 * Fetch Klines (Candles) from Binance Futures
 * Returns format compatible with the app: [timeMs, open, high, low, close, volume, turnover]
 */
export const fetchBinanceData = async (symbol, interval = '15m', limit = 300) => {
    try {
        const response = await axios.get(`${BINANCE_API}/fapi/v1/klines`, {
            params: {
                symbol: symbol,
                interval: interval,
                limit: limit
            }
        });
        
        if (response.data) {
            // Binance returns: [Open time, Open, High, Low, Close, Volume, Close time, Quote asset volume, Number of trades, Taker buy base asset volume, Taker buy quote asset volume, Ignore]
            return response.data.map(c => [
                c[0], // timestamp (ms)
                c[1], // open
                c[2], // high
                c[3], // low
                c[4], // close
                c[5], // volume
                c[7]  // turnover (quote volume)
            ]);
        }
    } catch (error) {
        console.error("Erreur fetchBinanceData", error);
    }
    return [];
};

/**
 * Fetch Open Interest History from Binance Futures
 */
export const fetchBinanceOpenInterest = async (symbol, period = '15m', limit = 300) => {
    try {
        const response = await axios.get(`${BINANCE_API}/futures/data/openInterestHist`, {
            params: {
                symbol: symbol,
                period: period,
                limit: limit
            }
        });
        
        if (response.data) {
            return response.data.map(d => ({
                timestamp: d.timestamp,
                openInterest: d.sumOpenInterestValue // Use value in quote asset (USDT) or d.sumOpenInterest for base
            }));
        }
    } catch (error) {
        console.error("Erreur fetchBinanceOpenInterest", error);
    }
    return [];
};
