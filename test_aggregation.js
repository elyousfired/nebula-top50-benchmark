import axios from "axios";

async function fetchAggregatedPositions() {
    try {
        console.log("Fetching Top 20 Vaults...");
        const vaultRes = await axios.get('https://stats-data.hyperliquid.xyz/Mainnet/vaults');
        let activeVaults = vaultRes.data.filter(v => v.summary && !v.summary.isClosed);
        activeVaults.sort((a, b) => parseFloat(b.summary.tvl || 0) - parseFloat(a.summary.tvl || 0));
        
        const top20 = activeVaults.slice(0, 20);
        console.log(`Aggregating positions for ${top20.length} vaults...`);
        
        let tokenPositions = {};

        for (let i = 0; i < top20.length; i++) {
            const vault = top20[i];
            const address = vault.summary.vaultAddress;
            try {
                const stateRes = await axios.post('https://api.hyperliquid.xyz/info', {
                    type: 'clearinghouseState',
                    user: address
                });
                const assetPositions = stateRes.data.assetPositions;
                if (!assetPositions) continue;

                assetPositions.forEach(ap => {
                    const pos = ap.position;
                    const szi = parseFloat(pos.szi);
                    if (szi !== 0) {
                        if (!tokenPositions[pos.coin]) {
                            tokenPositions[pos.coin] = { longs: 0, shorts: 0, longVol: 0, shortVol: 0, wallets: [] };
                        }
                        const isLong = szi > 0;
                        const notional = parseFloat(pos.positionValue);
                        
                        if (isLong) {
                            tokenPositions[pos.coin].longs++;
                            tokenPositions[pos.coin].longVol += notional;
                        } else {
                            tokenPositions[pos.coin].shorts++;
                            tokenPositions[pos.coin].shortVol += notional;
                        }

                        tokenPositions[pos.coin].wallets.push({
                            name: vault.summary.name,
                            address,
                            side: isLong ? 'LONG' : 'SHORT',
                            size: szi,
                            notional
                        });
                    }
                });
            } catch(e) {
                console.log("Error fetching state for", address);
            }
        }

        // Sort tokens by total volume (long + short)
        const sortedTokens = Object.keys(tokenPositions).sort((a,b) => {
            const volA = tokenPositions[a].longVol + tokenPositions[a].shortVol;
            const volB = tokenPositions[b].longVol + tokenPositions[b].shortVol;
            return volB - volA;
        });

        console.log("\nTop 5 Tokens by Smart Money Volume:");
        sortedTokens.slice(0, 5).forEach(coin => {
            const t = tokenPositions[coin];
            console.log(`${coin}: ${t.longs} Longs (${t.longVol}), ${t.shorts} Shorts (${t.shortVol})`);
        });

    } catch(e) {
        console.error(e.message);
    }
}
fetchAggregatedPositions();
