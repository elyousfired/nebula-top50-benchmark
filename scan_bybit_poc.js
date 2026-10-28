import axios from 'axios';
import fs from 'fs';

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    orange: "\x1b[38;5;208m",
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    underline: "\x1b[4m",
    bgOrange: "\x1b[48;5;208m\x1b[30m",
    bgCyan: "\x1b[46m\x1b[30m",
    bgGreen: "\x1b[42m\x1b[30m",
    bgRed: "\x1b[41m\x1b[30m"
};

// Proxies fallback in case of rate limits or CORS
const PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://thingproxy.freeboard.io/fetch/${url}`
];

// Helper to fetch data with proxy fallback
async function fetchWithFallback(url, timeout = 2000) {
    try {
        const res = await axios.get(url, { timeout });
        if (res.data) return res.data;
    } catch (e) {
        // Silently try fallback
    }

    for (const proxyFn of PROXIES) {
        try {
            const res = await axios.get(proxyFn(url), { timeout: timeout + 1500 });
            if (res.data) {
                if (typeof res.data === 'string') {
                    return JSON.parse(res.data);
                }
                return res.data;
            }
        } catch (e) {
            // Ignore and try next proxy
        }
    }
    throw new Error(`Failed to fetch URL: ${url}`);
}

async function getTop100BybitSpot() {
    const url = 'https://api.bybit.com/v5/market/tickers?category=spot';
    try {
        const data = await fetchWithFallback(url, 2500);
        const list = data?.result?.list || data?.list;
        if (!list) {
            throw new Error("Invalid response format from Bybit Tickers API");
        }

        const blackList = ['USD', 'DAI', 'EUR', 'GBP', 'TRY', 'BUSD', 'USDC', 'USDE'];
        return list
            .filter(t => t.symbol.endsWith('USDT'))
            .filter(t => !blackList.some(ex => t.symbol.startsWith(ex)))
            .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
            .slice(0, 100)
            .map(t => ({
                symbol: t.symbol,
                lastPrice: parseFloat(t.lastPrice),
                turnover24h: parseFloat(t.turnover24h),
                price24hPcnt: parseFloat(t.price24hPcnt) * 100
            }));
    } catch (e) {
        console.error(`${colors.red}❌ Error fetching Bybit tickers: ${e.message}${colors.reset}`);
        return [];
    }
}

async function fetchKlines(symbol) {
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&limit=200`;
    try {
        const data = await fetchWithFallback(url, 2000);
        const list = data?.result?.list || data?.list;
        if (list && list.length > 0) {
            return list.reverse().map(c => ({
                time: Number(c[0]),
                open: Number(c[1]),
                high: Number(c[2]),
                low: Number(c[3]),
                close: Number(c[4]),
                volume: Number(c[5])
            }));
        }
    } catch (e) {
        // Silent catch
    }
    return null;
}

function calculateVolumeProfile(candles) {
    const now = new Date();
    const startOfTodayTs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const startOfPrevDayTs = startOfTodayTs - 24 * 60 * 60 * 1000; // minuit J-1

    // Filter candles of the previous day (midnight J-1 to midnight J)
    let todayCandles = candles.filter(c => c.time >= startOfPrevDayTs && c.time < startOfTodayTs);
    let isFallback = false;
    
    // If not enough data, take the last 96 candles before today
    if (todayCandles.length < 12) {
        todayCandles = candles.filter(c => c.time < startOfTodayTs).slice(-96);
        isFallback = true;
    }

    const highs = todayCandles.map(c => c.high);
    const lows = todayCandles.map(c => c.low);
    const dayHigh = Math.max(...highs);
    const dayLow = Math.min(...lows);
    const currentPrice = todayCandles[todayCandles.length - 1].close;

    // We split the session range into 30 price bins
    const binsCount = 30;
    const binSize = (dayHigh - dayLow) / binsCount;
    const bins = Array.from({ length: binsCount }, (_, idx) => ({
        idx,
        low: dayLow + idx * binSize,
        high: dayLow + idx * binSize + binSize,
        volume: 0
    }));

    // Distribute candle volume across bins
    todayCandles.forEach(c => {
        const { high, low, volume } = c;
        if (high === low) {
            const binIdx = Math.min(Math.floor((high - dayLow) / binSize), binsCount - 1);
            if (binIdx >= 0 && binIdx < binsCount) bins[binIdx].volume += volume;
        } else {
            const overlapping = bins.filter(b => high >= b.low && low <= b.high);
            if (overlapping.length > 0) {
                const volPerBin = volume / overlapping.length;
                overlapping.forEach(b => { b.volume += volPerBin; });
            }
        }
    });

    // Find bin with maximum volume (Point of Control)
    let maxVol = 0;
    let pocPrice = (dayHigh + dayLow) / 2;
    let pocBinIdx = 0;
    bins.forEach((b, idx) => {
        if (b.volume > maxVol) {
            maxVol = b.volume;
            pocPrice = (b.low + b.high) / 2;
            pocBinIdx = idx;
        }
    });

    // Value Area Calculation (70% of session volume)
    const dayVolume = todayCandles.reduce((acc, c) => acc + c.volume, 0);
    const targetVaVol = dayVolume * 0.70;
    let vaMinIdx = pocBinIdx;
    let vaMaxIdx = pocBinIdx;
    let currentVaVol = bins[pocBinIdx]?.volume || 0;

    while (currentVaVol < targetVaVol && (vaMinIdx > 0 || vaMaxIdx < binsCount - 1)) {
        let prevVol = 0;
        if (vaMinIdx > 0) prevVol = bins[vaMinIdx - 1].volume + (bins[vaMinIdx - 2]?.volume || 0);
        let nextVol = 0;
        if (vaMaxIdx < binsCount - 1) nextVol = bins[vaMaxIdx + 1].volume + (bins[vaMaxIdx + 2]?.volume || 0);

        if (vaMinIdx > 0 && (vaMaxIdx === binsCount - 1 || prevVol >= nextVol)) {
            currentVaVol += bins[vaMinIdx - 1].volume;
            vaMinIdx--;
        } else if (vaMaxIdx < binsCount - 1) {
            currentVaVol += bins[vaMaxIdx + 1].volume;
            vaMaxIdx++;
        } else {
            break;
        }
    }

    const vah = bins[vaMaxIdx]?.high || dayHigh;
    const val = bins[vaMinIdx]?.low || dayLow;

    // Percent distances
    const distancePoc = ((currentPrice - pocPrice) / pocPrice) * 100;
    const distanceVah = ((currentPrice - vah) / vah) * 100;
    const distanceVal = ((currentPrice - val) / val) * 100;

    return {
        pocPrice,
        vah,
        val,
        dayHigh,
        dayLow,
        currentPrice,
        distancePoc,
        distanceVah,
        distanceVal,
        isFallback
    };
}

function printConsoleTable(title, list, type, color, distanceKey, targetPriceKey) {
    console.log(`\n---------------------------------------------------------------------------------`);
    console.log(`${colors.bold}${color}${title}${colors.reset}`);
    console.log(`---------------------------------------------------------------------------------`);
    console.log(`${colors.bold}${"Symbol".padEnd(12)} | ${"Current Price".padEnd(14)} | ${"Target Price".padEnd(14)} | ${"Distance".padEnd(12)} | ${"VAH / VAL Range".padEnd(20)} | ${"24h Vol (M)".padEnd(12)}${colors.reset}`);
    console.log(`---------------------------------------------------------------------------------`);

    if (list.length === 0) {
        console.log(`${colors.dim}   Aucun token sous le seuil de proximité de 1.5% dans cette catégorie.${colors.reset}`);
    } else {
        list.forEach((item, index) => {
            const distance = item[distanceKey];
            const absDist = Math.abs(distance);
            let distColor = colors.reset;
            
            if (absDist <= 0.3) {
                distColor = colors.bold + colors.green; // Perfect alignment
            } else if (absDist <= 0.8) {
                distColor = colors.green; // Close
            } else if (absDist <= 1.5) {
                distColor = colors.yellow; // Moderate
            } else {
                distColor = colors.dim;
            }

            const symDisplay = item.symbol.replace("USDT", "");
            const priceStr = item.price.toLocaleString(undefined, { minimumFractionDigits: item.price < 1 ? 5 : 2, maximumFractionDigits: item.price < 1 ? 5 : 2 });
            const targetStr = item[targetPriceKey].toLocaleString(undefined, { minimumFractionDigits: item[targetPriceKey] < 1 ? 5 : 2, maximumFractionDigits: item[targetPriceKey] < 1 ? 5 : 2 });
            const distStr = `${distance >= 0 ? '+' : ''}${distance.toFixed(3)}%`;
            const rangeStr = `${item.val.toLocaleString(undefined, { maximumFractionDigits: 1 })}-${item.vah.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
            const turnoverStr = `$${(item.turnover / 1000000).toFixed(2)}M`;

            const row = `${colors.bold}${color}#${String(index + 1).padEnd(2)}${colors.reset} ${colors.bold}${symDisplay.padEnd(9)}${colors.reset} | ${priceStr.padStart(13)} | ${targetStr.padStart(13)} | ${distColor}${distStr.padStart(11)}${colors.reset} | ${rangeStr.padStart(20)} | ${turnoverStr.padStart(11)}`;
            console.log(row);
        });
    }
}

async function runScanner() {
    console.clear();
    console.log(`================================================================================`);
    console.log(`🌌 ${colors.bgOrange} NEBULA SCANNER v1 - MULTI-LEVEL VOLUME PROFILE SEPARATION ${colors.reset}`);
    console.log(`================================================================================`);
    console.log(`⏳ Fetching top spot tokens by 24h volume from BYBIT Spot market...`);

    const topSpot = await getTop100BybitSpot();
    if (topSpot.length === 0) {
        console.log(`${colors.red}❌ Error: No tokens retrieved. Exiting.${colors.reset}`);
        return;
    }

    console.log(`✅ Loaded ${topSpot.length} spot tokens successfully.`);
    console.log(`⏳ Scanning previous day volume profiles (batching with anti-rate-limit throttling)...`);

    const results = [];
    const batchSize = 10;

    for (let i = 0; i < topSpot.length; i += batchSize) {
        const batch = topSpot.slice(i, i + batchSize);
        process.stdout.write(`   Processing: ${i} to ${Math.min(i + batchSize, topSpot.length)} of ${topSpot.length} tokens...\r`);
        
        await Promise.all(batch.map(async (token) => {
            try {
                const klines = await fetchKlines(token.symbol);
                if (klines && klines.length >= 12) {
                    const profile = calculateVolumeProfile(klines);
                    results.push({
                        symbol: token.symbol,
                        price: profile.currentPrice,
                        pocPrice: profile.pocPrice,
                        vah: profile.vah,
                        val: profile.val,
                        distancePoc: profile.distancePoc,
                        distanceVah: profile.distanceVah,
                        distanceVal: profile.distanceVal,
                        turnover: token.turnover24h,
                        change: token.price24hPcnt,
                        isFallback: profile.isFallback
                    });
                }
            } catch (err) {
                // Ignore tokens with errors
            }
        }));

        // Anti-rate limit pause of 200ms
        await new Promise(r => setTimeout(r, 200));
    }

    process.stdout.write(`\n`);

    // Categorize and filter results (within 1.5% distance, sorted by absolute proximity)
    const pocList = results
        .filter(t => Math.abs(t.distancePoc) <= 1.5)
        .sort((a, b) => Math.abs(a.distancePoc) - Math.abs(b.distancePoc))
        .slice(0, 15);

    const vahList = results
        .filter(t => Math.abs(t.distanceVah) <= 1.5)
        .sort((a, b) => Math.abs(a.distanceVah) - Math.abs(b.distanceVah))
        .slice(0, 15);

    const valList = results
        .filter(t => Math.abs(t.distanceVal) <= 1.5)
        .sort((a, b) => Math.abs(a.distanceVal) - Math.abs(b.distanceVal))
        .slice(0, 15);

    console.clear();
    console.log(`\n=================================================================================`);
    console.log(`📊 ${colors.bold}${colors.orange}BYBIT TOP 100 SPOT - SEPARATED VOLUME PROFILE SCANS${colors.reset}`);
    console.log(`=================================================================================`);
    console.log(`${colors.dim}Heure du scan : ${new Date().toLocaleString()} (Heure Locale)`);
    console.log(`Les trois tableaux séparent les actifs à proximité de leurs niveaux clés de session (1D).`);
    console.log(`Proximité maximale configurée : 1.5% | Triés par proximité absolue.${colors.reset}`);

    // Print the three tables
    printConsoleTable("🎯 TOKENS PROCHES DU POC (POINT OF CONTROL - ZONE DE COMPRESSION)", pocList, "poc", colors.orange, "distancePoc", "pocPrice");
    printConsoleTable("📈 TOKENS PROCHES DE LA VAH (VALUE AREA HIGH - RÉSISTANCE / BREAKOUT)", vahList, "vah", colors.cyan, "distanceVah", "vah");
    printConsoleTable("📉 TOKENS PROCHES DE LA VAL (VALUE AREA LOW - SUPPORT / REBOND)", valList, "val", colors.magenta, "distanceVal", "val");

    console.log(`\n=================================================================================`);
    console.log(`💾 Génération du rapport markdown : BYBIT_POC_SCAN_REPORT.md ...`);
    
    // Generate BYBIT_POC_SCAN_REPORT.md in French
    let md = `# 🌌 RAPPORT DE SCAN DE PROXIMITÉ VOLUME PROFILE BYBIT (TOP 100 SPOT)

Ce rapport présente les tokens du **Top 100 Spot de Bybit** (classés par volume d'échange sur 24h) qui se situent actuellement le plus proche de leurs niveaux clés du **Volume Profile du jour précédent (J-1)** (Calculé à partir des bougies de 15 minutes de 00:00 UTC J-1 à 00:00 UTC aujourd'hui).

Le rapport sépare les jetons en trois catégories distinctes :
1. **Point of Control (POC)** : Zone de forte accumulation ou de compression (coiling).
2. **Value Area High (VAH)** : Sommet de la zone de valeur, agissant comme résistance ou pivot de breakout haussier.
3. **Value Area Low (VAL)** : Bas de la zone de valeur, agissant comme support majeur ou pivot de breakdown baissier.

---

## 🎯 1. TOKENS PROCHES DU POINT OF CONTROL (POC)
*Zone de juste valeur de la session actuelle. Idéal pour repérer des compressions de prix avant un mouvement.*

| Rang | Token | Prix Actuel | Point of Control (POC) | Écart au POC | Range de Session (VAH / VAL) | Volume 24h (M$) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
`;

    pocList.forEach((t, idx) => {
        const symbol = t.symbol.replace("USDT", "");
        const price = t.price.toLocaleString(undefined, { minimumFractionDigits: t.price < 1 ? 5 : 2, maximumFractionDigits: t.price < 1 ? 5 : 2 });
        const target = t.pocPrice.toLocaleString(undefined, { minimumFractionDigits: t.pocPrice < 1 ? 5 : 2, maximumFractionDigits: t.pocPrice < 1 ? 5 : 2 });
        const dist = `${t.distancePoc >= 0 ? '+' : ''}${t.distancePoc.toFixed(3)}%`;
        const range = `${t.val.toLocaleString(undefined, { maximumFractionDigits: 1 })}-${t.vah.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
        const turnover = `$${(t.turnover / 1000000).toFixed(2)}M`;
        md += `| **#${idx + 1}** | **${symbol}** | $${price} | $${target} | **${dist}** | $${range} | ${turnover} |\n`;
    });
    if (pocList.length === 0) md += `| - | Aucun token trouvé dans la limite de 1.5% | - | - | - | - | - |\n`;

    md += `
---

## 📈 2. TOKENS PROCHES DE LA VALUE AREA HIGH (VAH)
*Sommet de la zone de juste valeur. Représente des zones de résistance clés ou des opportunités de breakout haussier.*

| Rang | Token | Prix Actuel | Value Area High (VAH) | Écart à la VAH | Range de Session (VAL - VAH) | Volume 24h (M$) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
`;

    vahList.forEach((t, idx) => {
        const symbol = t.symbol.replace("USDT", "");
        const price = t.price.toLocaleString(undefined, { minimumFractionDigits: t.price < 1 ? 5 : 2, maximumFractionDigits: t.price < 1 ? 5 : 2 });
        const target = t.vah.toLocaleString(undefined, { minimumFractionDigits: t.vah < 1 ? 5 : 2, maximumFractionDigits: t.vah < 1 ? 5 : 2 });
        const dist = `${t.distanceVah >= 0 ? '+' : ''}${t.distanceVah.toFixed(3)}%`;
        const range = `${t.val.toLocaleString(undefined, { maximumFractionDigits: 1 })}-${t.vah.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
        const turnover = `$${(t.turnover / 1000000).toFixed(2)}M`;
        md += `| **#${idx + 1}** | **${symbol}** | $${price} | $${target} | **${dist}** | $${range} | ${turnover} |\n`;
    });
    if (vahList.length === 0) md += `| - | Aucun token trouvé dans la limite de 1.5% | - | - | - | - | - |\n`;

    md += `
---

## 📉 3. TOKENS PROCHES DE LA VALUE AREA LOW (VAL)
*Bas de la zone de juste valeur. Représente des zones de support clés ou des opportunités de breakdown baissier/achat sur repli.*

| Rang | Token | Prix Actuel | Value Area Low (VAL) | Écart à la VAL | Range de Session (VAL - VAH) | Volume 24h (M$) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
`;

    valList.forEach((t, idx) => {
        const symbol = t.symbol.replace("USDT", "");
        const price = t.price.toLocaleString(undefined, { minimumFractionDigits: t.price < 1 ? 5 : 2, maximumFractionDigits: t.price < 1 ? 5 : 2 });
        const target = t.val.toLocaleString(undefined, { minimumFractionDigits: t.val < 1 ? 5 : 2, maximumFractionDigits: t.val < 1 ? 5 : 2 });
        const dist = `${t.distanceVal >= 0 ? '+' : ''}${t.distanceVal.toFixed(3)}%`;
        const range = `${t.val.toLocaleString(undefined, { maximumFractionDigits: 1 })}-${t.vah.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
        const turnover = `$${(t.turnover / 1000000).toFixed(2)}M`;
        md += `| **#${idx + 1}** | **${symbol}** | $${price} | $${target} | **${dist}** | $${range} | ${turnover} |\n`;
    });
    if (valList.length === 0) md += `| - | Aucun token trouvé dans la limite de 1.5% | - | - | - | - | - |\n`;

    md += `
---

## 📈 INTERPRÉTATION & GUIDE DE TRADING

1. **Compression (Proche du POC)** : Les volumes s'accumulent. Le marché est équilibré, mais c'est souvent le calme avant la tempête. Une cassure de la VAH/VAL à la suite d'une longue compression POC produit souvent les mouvements les plus violents.
2. **Breakout / Rejet VAH** : Si le prix s'approche de la VAH par le bas et la traverse avec du volume, cela signale un breakout haussier (recherche d'une nouvelle juste valeur plus haute). Si le volume décline, on assistera à un rejet et un retour vers le POC.
3. **Rebond / Breakout VAL** : La VAL sert de support dynamique majeur pour la session. Un rebond sur la VAL avec augmentation du delta acheteur offre d'excellents ratios risque/rendement pour viser un retour vers le POC. Une cassure nette sous la VAL indique une forte pression vendeuse (breakdown).

*Rapport généré dynamiquement le ${new Date().toLocaleString()} (Heure Locale).*
`;

    fs.writeFileSync('BYBIT_POC_SCAN_REPORT.md', md);
    console.log(`✅ Rapport généré avec succès dans BYBIT_POC_SCAN_REPORT.md !`);
    console.log(`=================================================================================\n`);
}

runScanner();
