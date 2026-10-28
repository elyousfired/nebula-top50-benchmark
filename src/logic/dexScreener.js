export const fetchDexPoolData = async (symbol) => {
    try {
        // Clean symbol (e.g. WIFUSDT -> WIF)
        const cleanSymbol = symbol.replace(/USDT$|USDC$|BTC$|ETH$/i, '').replace(/[^a-zA-Z0-9]/g, '');
        const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${cleanSymbol}`);
        const data = await res.json();
        
        if (!data || !data.pairs || data.pairs.length === 0) return null;
        
        // Find exact matches for the symbol to avoid fake tokens with similar names
        const exactMatches = data.pairs.filter(p => 
            p.baseToken && p.baseToken.symbol && p.baseToken.symbol.toUpperCase() === cleanSymbol.toUpperCase()
        );
        
        const candidates = exactMatches.length > 0 ? exactMatches : data.pairs;
        
        // Anti-Honeypot Logic: Filter out fake liquidity
        const validPairs = candidates.filter(p => {
            const liq = p.liquidity?.usd || 0;
            const vol = p.volume?.h24 || 0;
            
            if (vol < 100) return false; // Dead pool
            
            // If liquidity is massive but volume is tiny, it's a honeypot
            if (liq > 10_000_000 && vol < 500_000) return false; 
            if (liq > 2_000_000 && vol < liq * 0.005) return false; 
            
            return true;
        });

        if (validPairs.length === 0) return null;

        // Sort by 24h Volume (highest first)
        validPairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
        
        const bestPair = validPairs[0];

        return {
            dexId: bestPair.dexId,
            chainId: bestPair.chainId,
            pairAddress: bestPair.pairAddress,
            priceUsd: bestPair.priceUsd,
            liquidityUsd: bestPair.liquidity.usd,
            fdv: bestPair.fdv || 0,
            volume24h: bestPair.volume?.h24 || 0,
            txns24h: bestPair.txns?.h24 || { buys: 0, sells: 0 },
            url: bestPair.url,
            pairCreatedAt: bestPair.pairCreatedAt,
            baseToken: bestPair.baseToken
        };
    } catch (e) {
        console.error("DexScreener fetch error for", symbol, e);
        return null;
    }
};
