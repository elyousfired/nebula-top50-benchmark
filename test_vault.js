import axios from "axios";

async function run() {
    try {
        const res = await axios.get('https://stats-data.hyperliquid.xyz/Mainnet/vaults');
        const activeVaults = res.data.filter(v => v.summary && !v.summary.isClosed);
        if (activeVaults.length > 0) {
            console.log(JSON.stringify(activeVaults[0], null, 2));
            console.log("Summary keys:", Object.keys(activeVaults[0].summary));
        }
    } catch (e) {
        console.error(e);
    }
}

run();
