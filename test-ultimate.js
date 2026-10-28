import { runUltimateScan } from './src/logic/ultimate-engine.js';
import { fetchTop500Symbols } from './src/logic/scanner.js';

async function test() {
    console.log("Fetching top symbols...");
    const symbols = await fetchTop500Symbols();
    console.log(`Found ${symbols?.length} symbols`);
    
    if (!symbols || symbols.length === 0) return;
    
    console.log("Running ultimate scan on 5 symbols...");
    const results = await runUltimateScan(symbols.slice(0, 5), (p, s, m) => {
        console.log(`[${p}%] ${s}: ${m}`);
    });
    
    console.log("RESULTS:", results);
}

test();
