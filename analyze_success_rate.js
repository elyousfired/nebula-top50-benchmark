import axios from 'axios';

async function analyzeSuccessRate() {
    try {
        console.log("\x1b[36m🔍 Analyse du Taux de Réussite de la Stratégie -2%...\x1b[0m");
        
        // 1. Get Top 100
        const resTicker = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
        const top100 = resTicker.data
            .filter(t => t.symbol.endsWith('USDT'))
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 100).map(t => t.symbol);

        let totalTrades = 0;
        let successfulPumps = 0;
        let failedDumps = 0;
        let totalPnl = 0;

        const now = Date.now();
        const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);

        console.log(`Scan de 3 jours d'historique pour les 100 actifs...\n`);

        for (const symbol of top100) {
            // On récupère les bougies 15m sur 3 jours
            const res = await axios.get('https://api.binance.com/api/v3/klines', {
                params: { symbol, interval: '15m', startTime: threeDaysAgo, limit: 1000 }
            });

            if (!res.data || res.data.length < 50) continue;

            // Calcul du plafond (on prend le max des 24h avant le début du scan pour être réaliste)
            const ceilingKlines = await axios.get('https://api.binance.com/api/v3/klines', {
                params: { symbol, interval: '1d', startTime: threeDaysAgo - (7 * 24 * 60 * 60 * 1000), limit: 7 }
            });
            const ceiling = Math.max(...ceilingKlines.data.map(k => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3));
            
            if (ceiling <= 0) continue;

            const targetPrice = ceiling * 0.98; // Entrée à -2% gap
            const stopPrice = ceiling * 0.90;   // Échec si on descend à -10% gap
            const takeProfit = ceiling * 1.05; // Succès si on atteint +5% au-dessus du plafond

            let inTrade = false;
            let entryPrice = 0;

            for (const k of res.data) {
                const high = parseFloat(k[2]);
                const low = parseFloat(k[3]);
                const close = parseFloat(k[4]);

                if (!inTrade) {
                    // Signal d'entrée : On touche le niveau -2%
                    if (targetPrice >= low && targetPrice <= high) {
                        inTrade = true;
                        entryPrice = targetPrice;
                        totalTrades++;
                    }
                } else {
                    // On est dans le trade, on cherche la sortie
                    if (high >= takeProfit) {
                        successfulPumps++;
                        totalPnl += ((takeProfit - entryPrice) / entryPrice) * 100;
                        inTrade = false;
                        break; // On ne prend qu'un trade par token pour la stat
                    } else if (low <= stopPrice) {
                        failedDumps++;
                        totalPnl += ((stopPrice - entryPrice) / entryPrice) * 100;
                        inTrade = false;
                        break;
                    }
                }
            }
            process.stdout.write("."); // Progress bar simple
        }

        console.log(`\n\n=========================================`);
        console.log(`📊 BILAN STATISTIQUE STRATÉGIE -2% :`);
        console.log(`-----------------------------------------`);
        console.log(`Nombre total de trades pris : ${totalTrades}`);
        console.log(`Nombre de SUCCÈS (Pump > +5%) : \x1b[32m${successfulPumps}\x1b[0m`);
        console.log(`Nombre d'ÉCHECS (Dump < -8%)  : \x1b[31m${failedDumps}\x1b[0m`);
        console.log(`-----------------------------------------`);
        
        const winRate = (successfulPumps / totalTrades) * 100;
        console.log(`TAUX DE RÉUSSITE : \x1b[33m${winRate.toFixed(2)}%\x1b[0m`);
        console.log(`EXPECTANCY (PNL MOYEN) : \x1b[32m${(totalPnl / totalTrades).toFixed(2)}%\x1b[0m`);
        console.log(`=========================================\n`);

    } catch (e) {
        console.error("Erreur:", e.message);
    }
}

analyzeSuccessRate();
