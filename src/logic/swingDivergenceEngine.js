export const fetchSwingDivergenceData = async (symbol) => {
    try {
        const baseSymbol = symbol.replace(/USDT$|USDC$/i, '');
        
        // 1. Fetch Pool Address from DexScreener (with Honeypot Filter)
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${baseSymbol}`);
        const dexData = await dexRes.json();
        if (!dexData || !dexData.pairs) throw new Error("No DEX data");

        let solanaPairs = dexData.pairs.filter(p => p.chainId === 'solana' && p.baseToken.symbol.toUpperCase() === baseSymbol.toUpperCase());
        solanaPairs = solanaPairs.filter(p => {
            const liq = p.liquidity?.usd || 0;
            const vol = p.volume?.h24 || 0;
            if (vol < 100) return false;
            if (liq > 5_000_000 && vol < liq * 0.005) return false;
            return true;
        });
        solanaPairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
        
        if (solanaPairs.length === 0) throw new Error("No valid Solana pool found");
        const poolAddress = solanaPairs[0].pairAddress;

        // 2. Fetch 15m OHLCV from GeckoTerminal (DEX)
        // limit=12 to get roughly 3 hours of data (15m * 12)
        const geckoRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/minute?aggregate=15&limit=12`);
        const geckoData = await geckoRes.json();
        if (!geckoData?.data?.attributes?.ohlcv_list) throw new Error("GeckoTerminal failed");
        
        let dexKlines = geckoData.data.attributes.ohlcv_list.map(k => ({
            timestamp: k[0] * 1000, // Convert to ms
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));
        
        // Sort oldest to newest
        dexKlines.sort((a, b) => a.timestamp - b.timestamp);

        // 3. Fetch 15m Klines from Bybit (CEX)
        const bybitRes = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&limit=12`);
        const bybitData = await bybitRes.json();
        if (!bybitData?.result?.list) throw new Error("Bybit fetch failed");

        let cexKlines = bybitData.result.list.map(k => ({
            timestamp: parseInt(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));

        // Sort oldest to newest
        cexKlines.sort((a, b) => a.timestamp - b.timestamp);

        // 4. Calculate Momentum & Signals
        if (dexKlines.length < 3 || cexKlines.length < 3) throw new Error("Not enough klines");

        const dexStartPrice = dexKlines[0].open;
        const dexEndPrice = dexKlines[dexKlines.length - 1].close;
        const dexMomentum = ((dexEndPrice - dexStartPrice) / dexStartPrice) * 100;

        const cexStartPrice = cexKlines[0].open;
        const cexEndPrice = cexKlines[cexKlines.length - 1].close;
        const cexMomentum = ((cexEndPrice - cexStartPrice) / cexStartPrice) * 100;

        let signal = "NEUTRAL";
        let expectedPrice = cexEndPrice;

        // Arbitrage Logic: 
        // We lower the threshold to 1.5% momentum and 1.0% divergence to catch more micro-swings
        if (dexMomentum > 1.5 && (dexMomentum - cexMomentum > 1.0)) {
            signal = "BUY_OPPORTUNITY";
            // Theoretical expected price: CEX should have pumped as much as DEX
            expectedPrice = cexStartPrice * (1 + (dexMomentum / 100));
        }

        return {
            symbol,
            poolAddress,
            dexKlines,
            cexKlines,
            dexMomentum,
            cexMomentum,
            signal,
            currentCexPrice: cexEndPrice,
            expectedPrice,
            divergence: dexMomentum - cexMomentum
        };

    } catch (error) {
        console.error("SwingDivergence fetch error:", error);
        return null;
    }
};
