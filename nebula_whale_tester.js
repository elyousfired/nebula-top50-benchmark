import axios from 'axios';

const WHALE_THRESHOLD = 2.0; // Seuil abaissé pour le test
const trackedWhales = {};

console.log("\n\x1b[35m🐳 NEBULA WHALE TESTER - VALIDATION DE STRATÉGIE\x1b[0m");

async function startWhaleTester() {
    while (true) {
        try {
            const resData = await axios.get('http://127.0.0.1:3001/api/data', { timeout: 2000 }).catch(() => null);
            const resDepth = await axios.get('http://127.0.0.1:3002/api/depth', { timeout: 2000 }).catch(() => null);

            if (!resData || !resDepth) {
                console.clear();
                console.log("\x1b[35m🐳 NEBULA WHALE TESTER - DIAGNOSTIC CONNEXION\x1b[0m");
                console.log("-------------------------------------------");
                console.log(`Terminal CORE (3001)  : ${resData ? '✅ OK' : '❌ HORS LIGNE'}`);
                console.log(`Terminal DEPTH (3002) : ${resDepth ? '✅ OK' : '❌ HORS LIGNE'}`);
                console.log("-------------------------------------------");
                console.log("\x1b[90mRelance les terminaux manquants sur ton PC.\x1b[0m");
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }

            const depthData = resDepth.data;
            const scans = resData.data.scans;
            const depthSymbols = Object.keys(depthData);

            // 1. Détection des nouvelles baleines
            depthSymbols.forEach(symbol => {
                const depth = depthData[symbol];
                const price = scans[symbol]?.close;

                if (depth.hasWhale && parseFloat(depth.wallStrength) >= WHALE_THRESHOLD) {
                    if (!trackedWhales[symbol] && price) {
                        trackedWhales[symbol] = {
                            entryPrice: price,
                            entryWall: depth.wallStrength,
                            time: new Date().toLocaleTimeString(),
                            maxPnl: 0,
                            currentPrice: price
                        };
                    }
                }
                
                if (trackedWhales[symbol] && price) {
                    trackedWhales[symbol].currentPrice = price;
                    const pnl = ((price / trackedWhales[symbol].entryPrice - 1) * 100);
                    if (pnl > trackedWhales[symbol].maxPnl) trackedWhales[symbol].maxPnl = pnl;
                }
            });

            // 2. Affichage
            console.clear();
            console.log(`\x1b[35m🐳 NEBULA WHALE TRACKER - LIVE [Surveillance : ${depthSymbols.length} jetons]\x1b[0m`);
            console.log("====================================================================");
            console.log("TOKEN      | MUR ENTRÉE | PRIX ENTRÉE | PRIX ACTUEL | PNL %   | MAX %");
            console.log("--------------------------------------------------------------------");

            const sorted = Object.entries(trackedWhales).sort((a, b) => {
                const pnlA = ((a[1].currentPrice / a[1].entryPrice - 1) * 100);
                const pnlB = ((b[1].currentPrice / b[1].entryPrice - 1) * 100);
                return pnlB - pnlA;
            });

            if (sorted.length === 0) {
                console.log("\x1b[90mEn attente d'une baleine (Wall x5.0+)...\x1b[0m");
            }

            sorted.forEach(([symbol, info]) => {
                const pnl = ((info.currentPrice / info.entryPrice - 1) * 100);
                const pnlColor = pnl >= 0 ? "\x1b[32m" : "\x1b[31m";
                
                console.log(`${symbol.padEnd(10)} | x${info.entryWall.toString().padEnd(8)} | ${info.entryPrice.toString().padEnd(11)} | ${info.currentPrice.toString().padEnd(11)} | ${pnlColor}${pnl.toFixed(2).padStart(6)}%\x1b[0m | ${info.maxPnl.toFixed(2)}%`);
            });

            console.log("====================================================================");
            console.log("\x1b[90mCe script prouve si l'accumulation mène au Pump.\x1b[0m");

            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.log("Erreur Tester:", e.message);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

startWhaleTester();
