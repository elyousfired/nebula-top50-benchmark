import axios from 'axios';

const API_URL = 'https://api.hyperliquid.xyz/info';

/**
 * Fetch all available tokens on Hyperliquid
 */
export const fetchHyperliquidMeta = async () => {
    try {
        const response = await axios.post(API_URL, { type: 'metaAndAssetCtxs' });
        if (response.data && response.data.length === 2) {
            const meta = response.data[0];
            const ctxs = response.data[1];
            
            return meta.universe.map((coin, idx) => {
                const ctx = ctxs[idx];
                return {
                    name: coin.name,
                    maxLeverage: coin.maxLeverage,
                    price: ctx ? parseFloat(ctx.markPx) : 0,
                    openInterest: ctx ? parseFloat(ctx.openInterest) : 0,
                    fundingRate: ctx ? parseFloat(ctx.funding) : 0,
                    volume24h: ctx ? parseFloat(ctx.dayNtlVlm) : 0
                };
            }).sort((a, b) => b.volume24h - a.volume24h);
        }
    } catch (error) {
        console.error("Erreur fetchHyperliquidMeta", error);
    }
    return [];
};

/**
 * Fetch open positions and margin for a specific wallet address
 * @param {string} address Wallet address (0x...)
 */
export const fetchHyperliquidUserState = async (address) => {
    try {
        const response = await axios.post(API_URL, {
            type: 'clearinghouseState',
            user: address
        });
        
        if (response.data && response.data.marginSummary) {
            const marginSummary = response.data.marginSummary;
            const assetPositions = response.data.assetPositions || [];
            
            const positions = assetPositions.map(p => {
                const pos = p.position;
                const size = parseFloat(pos.szi);
                const isLong = size > 0;
                
                return {
                    coin: pos.coin,
                    type: isLong ? 'LONG' : 'SHORT',
                    size: Math.abs(size),
                    entryPrice: parseFloat(pos.entryPx),
                    leverage: pos.leverage.value,
                    liquidationPrice: parseFloat(pos.liquidationPx),
                    unrealizedPnl: parseFloat(pos.unrealizedPnl),
                    returnOnEquity: parseFloat(pos.returnOnEquity) * 100, // percentage
                    marginUsed: parseFloat(pos.marginUsed)
                };
            }).sort((a, b) => Math.abs(b.size * b.entryPrice) - Math.abs(a.size * a.entryPrice)); // Sort by position value

            return {
                accountValue: parseFloat(marginSummary.accountValue) || 0,
                totalMarginUsed: parseFloat(marginSummary.totalMarginUsed) || 0,
                totalNtlPos: parseFloat(marginSummary.totalNtlPos) || 0,
                positions
            };
        }
    } catch (error) {
        console.error("Erreur fetchHyperliquidUserState", error);
    }
    return { accountValue: 0, totalMarginUsed: 0, totalNtlPos: 0, positions: [] };
};

/**
 * Fetch candles (klines) from Hyperliquid
 */
export const fetchHyperliquidCandles = async (coin, interval = '15m') => {
    try {
        const endTime = Date.now();
        const startTime = endTime - (1000 * 60 * 60 * 24 * 3); // 3 days ago
        const response = await axios.post(API_URL, {
            type: 'candleSnapshot',
            req: {
                coin: coin,
                interval: interval,
                startTime: startTime,
                endTime: endTime
            }
        });
        
        if (response.data && Array.isArray(response.data)) {
            // Hyperliquid candle format: {t: timeMs, o: open, h: high, l: low, c: close, v: volume}
            return response.data.map(c => [
                c.t,      // [0] timestamp
                c.o,      // [1] open
                c.h,      // [2] high
                c.l,      // [3] low
                c.c,      // [4] close
                c.v,      // [5] base volume
                c.v * c.c // [6] quote volume (approx turnover)
            ]);
        }
    } catch (error) {
        console.error("Erreur fetchHyperliquidCandles", error);
    }
    return [];
};
