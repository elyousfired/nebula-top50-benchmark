import fs from 'fs';
import axios from 'axios';

const reportFile = 'C:/Users/user/Downloads/NEBULA_REPORT_2026-05-02.md';

async function findAnticipatedEntry(symbol, strikePrice, strikeTimestamp) {
    try {
        // On récupère les 48h précédant le strike pour trouver le moment du gap -2%
        const startTime = strikeTimestamp - (48 * 60 * 60 * 1000);
        const res = await axios.get('https://api.binance.com/api/v3/klines', {
            params: { symbol, interval: '15m', startTime, endTime: strikeTimestamp, limit: 1000 }
        });
        
        if (!res.data || res.data.length < 2) return null;
        
        // On estime le plafond (Ceiling) à partir du strike price
        // (En supposant que le strike est très proche du plafond, ou en calculant le max des jours précédents)
        const dailyKlines = await axios.get('https://api.binance.com/api/v3/klines', {
            params: { symbol, interval: '1d', startTime: strikeTimestamp - (7 * 24 * 60 * 60 * 1000), limit: 7 }
        });
        const ceiling = Math.max(...dailyKlines.data.slice(0, -1).map(k => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3));
        
        const targetEntryPrice = ceiling * 0.98; // Le fameux gap de -2%

        // On cherche le premier moment où on a touché ce prix AVANT le strike
        for (const k of res.data) {
            const high = parseFloat(k[2]);
            const low = parseFloat(k[3]);
            if (targetEntryPrice >= low && targetEntryPrice <= high) {
                return { price: targetEntryPrice, time: new Date(k[0]).toLocaleTimeString() };
            }
        }
        return null;
    } catch (e) { return null; }
}

async function runAnticipationTest() {
    try {
        console.log("\x1b[36m🔍 Test d'Anticipation (Entrée à -2% du Plafond)...\x1b[0m");
        
        const resTicker = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
        const top100 = resTicker.data.filter(t => t.symbol.endsWith('USDT')).sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)).slice(0, 100).map(t => t.symbol);
        const resPrices = await axios.get('https://api.binance.com/api/v3/ticker/price');
        const priceMap = resPrices.data.reduce((acc, item) => { acc[item.symbol] = parseFloat(item.price); return acc; }, {});

        const text = fs.readFileSync(reportFile, 'utf8');
        const lines = text.split('\n');
        let currentDate = "";
        const signals = [];

        for (const line of lines) {
            const dateMatch = line.match(/## DATE : (\d{2})\/(\d{2})\/(\d{4})/);
            if (dateMatch) currentDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            const tokenMatch = line.match(/\|\s*\*\*([A-Z0-9]+)\*\*\s*\|\s*([\d:]+)\s*\|\s*\$([0-9.]+)\s*\|/);
            if (tokenMatch && currentDate) {
                const symbol = tokenMatch[1];
                if (!top100.includes(symbol)) continue;
                const entryPrice = parseFloat(tokenMatch[3]);
                const timestamp = new Date(`${currentDate}T${tokenMatch[2]}Z`).getTime();
                if (entryPrice > 0 && priceMap[symbol]) {
                    signals.push({ symbol, strikePrice: entryPrice, current: priceMap[symbol], timestamp, date: currentDate, time: tokenMatch[2] });
                }
            }
        }

        console.log(`Analyse comparative sur ${signals.length} signaux...\n`);
        let totalStrikePnl = 0;
        let totalAnticipatedPnl = 0;
        let antCount = 0;

        for (const s of signals) {
            const antEntry = await findAnticipatedEntry(s.symbol, s.strikePrice, s.timestamp);
            const strikePnl = ((s.current - s.strikePrice) / s.strikePrice) * 100;
            totalStrikePnl += strikePnl;

            let antMsg = "\x1b[90m(Pas d'entrée à -2% trouvée)\x1b[0m";
            if (antEntry) {
                const antPnl = ((s.current - antEntry.price) / antEntry.price) * 100;
                totalAnticipatedPnl += antPnl;
                antCount++;
                antMsg = `🎯 \x1b[32mAnticipé à ${antEntry.time} | PNL: +${antPnl.toFixed(2)}%\x1b[0m`;
            } else {
                totalAnticipatedPnl += strikePnl; // Si pas d'anticipation possible, on garde le strike
            }

            console.log(`${s.symbol.padEnd(12)} | Strike: ${strikePnl >= 0 ? '+' : ''}${strikePnl.toFixed(2)}% | ${antMsg}`);
            await new Promise(r => setTimeout(r, 80));
        }

        console.log(`\n=========================================`);
        console.log(`📊 BILAN DE L'ANTICIPATION (-2%) :`);
        console.log(`-----------------------------------------`);
        console.log(`PNL STRIKE (Entrée Cassure)   : \x1b[33m${totalStrikePnl.toFixed(2)}%\x1b[0m`);
        console.log(`PNL ANTICIPÉ (Entrée à -2%)   : \x1b[32m${totalAnticipatedPnl.toFixed(2)}%\x1b[0m`);
        console.log(`-----------------------------------------`);
        console.log(`Gain supplémentaire : \x1b[35m+${(totalAnticipatedPnl - totalStrikePnl).toFixed(2)}%\x1b[0m`);
        console.log(`=========================================\n`);

    } catch (e) { console.error("Erreur:", e.message); }
}

runAnticipationTest();
