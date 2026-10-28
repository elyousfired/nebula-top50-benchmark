import fs from 'fs';
import axios from 'axios';

const reportFile = 'C:/Users/user/Downloads/NEBULA_REPORT_2026-05-01.md';

async function getTop100Tokens() {
    console.log("⏳ Récupération du Top 300-600 Binance (Classement par Volume)...");
    try {
        const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
        const blackList = ['USD', 'DAI', 'EUR', 'GBP', 'TRY', 'BUSD', 'AEUR', 'PAXG', 'UUSDT', 'USDE', 'FDUSD', 'BFUSD', 'RLUSD', 'USDC'];
        const top300_600 = response.data
            .filter(t => t.symbol.endsWith('USDT'))
            .filter(t => !blackList.some(ex => t.symbol.startsWith(ex)))
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(300, 600)
            .map(t => t.symbol);
            
        return new Set(top300_600);
    } catch (e) {
        console.error("Erreur de connexion API:", e.message);
        return new Set();
    }
}

async function runMaxPnlAnalysis() {
    const top100Set = await getTop100Tokens();
    if (top100Set.size === 0) return;

    console.log("✅ Top 300-600 récupéré avec succès.");
    console.log("Lecture du rapport Markdown...");
    
    let text;
    try {
        text = fs.readFileSync(reportFile, 'utf8');
    } catch (e) {
        console.error("Fichier introuvable:", reportFile);
        return;
    }
    
    const lines = text.split('\n');
    let currentDate = "";
    const tokensToAnalyze = [];

    for (const line of lines) {
        const dateMatch = line.match(/## DATE : (\d{2})\/(\d{2})\/(\d{4})/);
        if (dateMatch) {
            currentDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`; 
        }
        
        const tokenMatch = line.match(/\|\s*\*\*([A-Z0-9]+)\*\*\s*\|\s*([\d:]+)\s*\|\s*\$([0-9.]+)\s*\|/);
        if (tokenMatch && currentDate) {
            const symbol = tokenMatch[1];
            const time = tokenMatch[2];
            const entryPrice = parseFloat(tokenMatch[3]);
            
            // Filtre de minuit désactivé pour inclure tous les signaux
            // if (time.startsWith("00:")) continue;
            
            // --- FILTRE TOP 100 ---
            if (top100Set.has(symbol)) {
                const timestamp = new Date(`${currentDate}T${time}Z`).getTime();
                const endOfDayTimestamp = new Date(`${currentDate}T23:59:59Z`).getTime();
                tokensToAnalyze.push({ symbol, date: currentDate, time, entryPrice, timestamp, endOfDayTimestamp });
            }
        }
    }

    console.log(`\n🚀 ${tokensToAnalyze.length} signaux détectés appartenant strictement au TOP 300-600.`);
    console.log("Calcul du PNL Maximum Atteint (Potentiel Brut) pour chaque token de la journée...\n");

    let totalMaxPnl = 0;
    
    for (const token of tokensToAnalyze) {
        try {
            const res = await axios.get('https://api.binance.com/api/v3/klines', {
                params: {
                    symbol: token.symbol,
                    interval: '1m',
                    startTime: token.timestamp,
                    limit: 1000
                }
            });
            
            if (res.data && res.data.length > 0) {
                // Correction pour les Meme Coins dont le prix a été arrondi à 0.0000 dans le markdown
                if (token.entryPrice === 0) {
                    token.entryPrice = parseFloat(res.data[0][1]); // Prix d'ouverture de la minute de strike
                }
                
                let highestPrice = token.entryPrice;
                
                for (const kline of res.data) {
                    const time = kline[0];
                    if (time > token.endOfDayTimestamp) break; // Ne regarde que l'évolution intraday
                    
                    const high = parseFloat(kline[4]); // Prix le plus haut (Close) de la bougie
                    if (high > highestPrice) highestPrice = high;
                }
                
                const maxPnl = ((highestPrice - token.entryPrice) / token.entryPrice) * 100;
                totalMaxPnl += maxPnl;
                
                const displayDate = token.date.split('-').reverse().join('/');
                console.log(`[${displayDate}] \x1b[36m${token.symbol.padEnd(10)}\x1b[0m | Heure: ${token.time} | PNL Maximum Réalisé : \x1b[32m+${maxPnl.toFixed(2)}%\x1b[0m`);
            } else {
                console.log(`[${token.date}] ${token.symbol.padEnd(10)} | PAS DE DATA`);
            }
            
            // Pause 500ms anti-ban IP
            await new Promise(r => setTimeout(r, 500));
            
        } catch (e) {
            console.log(`[${token.date}] ${token.symbol.padEnd(10)} | ERREUR API : ${e.message}`);
        }
    }
    
    if (tokensToAnalyze.length > 0) {
        console.log(`\n=====================================================================`);
        console.log(`🚀 Somme du Max PNL (Capacité explosive du Top 300-600) : \x1b[32m+${totalMaxPnl.toFixed(2)}%\x1b[0m`);
        console.log(`📊 PNL Maximum Moyen par Trade                          : \x1b[36m+${(totalMaxPnl / tokensToAnalyze.length).toFixed(2)}%\x1b[0m`);
        console.log(`=====================================================================\n`);
    } else {
        console.log("Aucun token du Top 300-600 n'a déclenché de signal Golden Strike sur cette période.");
    }
}

runMaxPnlAnalysis();
