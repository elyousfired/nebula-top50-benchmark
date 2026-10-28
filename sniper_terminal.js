import axios from 'axios';
import { fetchBinanceData, fetchTop500Symbols, calculateNebulaLogic } from './src/logic/scanner.js';

// Réinitialisation complète pour la nouvelle simulation
const trackedEntries = {}; 

async function startSniperTerminal() {
    console.clear();
    console.log("\n\x1b[35m🛰️ NEBULA TERMINAL V2 - INITIALISATION NOUVELLE SESSION\x1b[0m");
    console.log("\x1b[90mResetting all simulation data to 0.00%...\x1b[0m\n");
    
    while (true) {
        try {
            const symbols = await fetchTop500Symbols();
            const top100 = symbols.slice(0, 100);
            
            for (const symbol of top100) {
                const klines = await fetchBinanceData(symbol);
                if (!klines) continue;

                const processed = calculateNebulaLogic(klines);
                if (!processed || processed.length === 0) continue;

                const current = processed[processed.length - 1];
                const vwapMaxTuesday = current.vwapMaxTuesday || 0;
                if (vwapMaxTuesday === 0) continue;

                const gap = ((current.vwapDaily / vwapMaxTuesday - 1) * 100);
                
                // Entrée automatique si dans une zone d'intérêt (-2.5% à +10%)
                if (gap >= -2.5 && !trackedEntries[symbol]) {
                    trackedEntries[symbol] = {
                        entryPrice: current.close,
                        entryGap: gap,
                        type: gap >= 0 ? 'BREAKOUT' : 'SNIPER',
                        time: new Date().toLocaleTimeString(),
                        lastPrice: current.close,
                        lastGap: gap
                    };
                }

                if (trackedEntries[symbol]) {
                    trackedEntries[symbol].lastPrice = current.close;
                    trackedEntries[symbol].lastGap = gap;
                }
            }

            // --- AFFICHAGE DU TABLEAU DE BILAN ---
            console.clear();
            console.log(`\x1b[35m🛰️ NEBULA PRO MONITOR - SESSION LIVE (${new Date().toLocaleTimeString()})\x1b[0m`);
            console.log("====================================================================");
            console.log("TOKEN      | ENTRÉE    | GAP ACTUEL | PNL %      | STRATÉGIE");
            console.log("--------------------------------------------------------------------");

            let sniperPnl = 0;
            let breakoutPnl = 0;
            let sniperCount = 0;
            let breakoutCount = 0;
            
            const entries = Object.entries(trackedEntries).sort((a, b) => b[1].lastGap - a[1].lastGap);

            if (entries.length === 0) {
                console.log("\x1b[90mEn attente du premier signal (Zone -2% ou Breakout 0%)...\x1b[0m");
            }

            for (const [symbol, info] of entries) {
                const pnl = ((info.lastPrice / info.entryPrice - 1) * 100);
                
                if (info.type === 'SNIPER') {
                    sniperPnl += pnl;
                    sniperCount++;
                } else {
                    breakoutPnl += pnl;
                    breakoutCount++;
                }

                const pnlColor = pnl >= 0 ? "\x1b[32m" : "\x1b[31m";
                const stratLabel = info.type === 'SNIPER' ? "\x1b[33m🎯 SNIPER\x1b[0m" : "\x1b[32m⚡ BREAKOUT\x1b[0m";
                
                console.log(`${symbol.padEnd(10)} | ${info.entryPrice.toString().padEnd(9)} | ${info.lastGap.toFixed(2).padStart(8)}% | ${pnlColor}${pnl.toFixed(2).padStart(8)}%\x1b[0m | ${stratLabel}`);
            }

            console.log("====================================================================");
            console.log(`\x1b[33m🎯 PNL CUMULÉ SNIPER   :\x1b[0m \x1b[1m${sniperPnl >= 0 ? "\x1b[32m+" : "\x1b[31m"}${sniperPnl.toFixed(2)}% (${sniperCount} trades)\x1b[0m`);
            console.log(`\x1b[32m⚡ PNL CUMULÉ BREAKOUT :\x1b[0m \x1b[1m${breakoutPnl >= 0 ? "\x1b[32m+" : "\x1b[31m"}${breakoutPnl.toFixed(2)}% (${breakoutCount} trades)\x1b[0m`);
            console.log("--------------------------------------------------------------------");
            const totalPnl = sniperPnl + breakoutPnl;
            console.log(`\x1b[35m💎 TOTAL SESSION PNL   : ${totalPnl >= 0 ? "\x1b[32m+" : "\x1b[31m"}${totalPnl.toFixed(2)}%\x1b[0m`);
            console.log("\x1b[90m(Le scan redémarre dans 30 secondes...)\x1b[0m");

            await new Promise(r => setTimeout(r, 30000)); 
        } catch (e) {
            console.log("\x1b[31mErreur scan:\x1b[0m", e.message);
            await new Promise(r => setTimeout(r, 10000));
        }
    }
}

startSniperTerminal();
