import axios from "axios";

async function run() {
    try {
        const res = await axios.get('https://stats-data.hyperliquid.xyz/Mainnet/vaults');
        const activeVaults = res.data.filter(v => v.summary && !v.summary.isClosed);
        activeVaults.sort((a, b) => parseFloat(b.summary.tvl || 0) - parseFloat(a.summary.tvl || 0));
        
        console.log("Top Vault:", JSON.stringify(activeVaults[0], null, 2));
    } catch(e) {
        console.error(e.message);
    }
}
run();
