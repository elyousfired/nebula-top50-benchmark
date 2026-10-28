import { fetchBybitData, fetchDepth, fetchTrades, calculateNebulaLogic, fetchTop500Symbols } from './scanner';
import { analyzeWhaleBehavior } from './whale-analyzer';

export const runUltimateScan = async (symbolsData, onProgress) => {
    // Filtrer le top 30 en termes de volume pour éviter de bloquer l'API (Rate Limit = 120req/min)
    let pool = [...symbolsData].sort((a,b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h)).slice(0, 30);
    
    const results = [];
    const total = pool.length;
    
    let btcData = [];
    let solData = [];
    try {
        btcData = await fetchBybitData('BTCUSDT', '60', 100);
        solData = await fetchBybitData('SOLUSDT', '60', 100);
    } catch(e) {}
    const btcReturns = btcData.length ? btcData.map(c => parseFloat(c[4]) / parseFloat(c[1]) - 1) : [];
    const solReturns = solData.length ? solData.map(c => parseFloat(c[4]) / parseFloat(c[1]) - 1) : [];

    for (let i = 0; i < total; i++) {
        const token = pool[i];
        try {
            // DEEP SCAN - ETAPE 1: Extraction des Bougies
            if (onProgress) onProgress(Math.floor(((i) / total) * 100), token.symbol, "Extraction Bougies 1H...");
            const klines = await fetchBybitData(token.symbol, '60', 100);
            if (!klines || klines.length < 90) continue;
            
            // DEEP SCAN - ETAPE 2: Extraction du Carnet d'Ordres
            if (onProgress) onProgress(Math.floor(((i + 0.3) / total) * 100), token.symbol, "Extraction Carnet d'Ordres...");
            const depth = await fetchDepth(token.symbol);
            
            // DEEP SCAN - ETAPE 3: Extraction des Trades
            if (onProgress) onProgress(Math.floor(((i + 0.6) / total) * 100), token.symbol, "Analyse du Net Flow (Trades)...");
            const trades = await fetchTrades(token.symbol);

            // DEEP SCAN - ETAPE 4: Nebula Engine Complet (VWAP, Sweeps, EMA)
            if (onProgress) onProgress(Math.floor(((i + 0.9) / total) * 100), token.symbol, "Calcul VWAP & Liquidités...");
            const nebulaResult = calculateNebulaLogic(klines, depth, trades);
            const currentData = nebulaResult;
            const currentPrice = parseFloat(klines[0][4]);
            
            let score = 0;
            const reasons = [];

            // 1. REBOND VWAP INSTITUTIONNEL (20 pts)
            const vwap = currentData.vwapDaily;
            if (vwap && currentPrice > vwap && currentPrice < vwap * 1.05) {
                score += 20;
                reasons.push("Rebond Confirmé sur le VWAP Institutionnel (Smart Money Entry)");
            } else if (currentPrice > vwap) {
                score += 10;
            }

            // 2. ORDERBOOK & TRADE FLOW (25 pts)
            // Utilisation des vraies données de `depthAnalysis`
            const pressure = currentData.depthAnalysis ? currentData.depthAnalysis.buyPressure : 50;
            if (pressure > 65) {
                score += 25;
                reasons.push(`Pression Acheteuse Extrême (${pressure.toFixed(1)}% d'accumulation limit/market)`);
            } else if (pressure > 55) {
                score += 10;
            }

            // 3. LIQUIDITY SWEEP (20 pts)
            // L'algorithme a-t-il balayé le plus bas de la veille et rebondi ?
            if (currentData.isSweepLow) {
                score += 20;
                reasons.push("Liquidity Sweep (Chasse aux Stop-Loss) Validé. Rebond en cours.");
            }

            // 4. TENDANCE MACRO EMA (15 pts)
            if (currentData.ema20Bullish) {
                score += 15;
                if (!currentData.isSweepLow) {
                    reasons.push("Structure Macro Haussière (Prix > EMA20)");
                }
            }

            // 5. SURPERFORMANCE (ALPHA) vs BTC/SOL (20 pts)
            let recommendedPair = 'USDT';
            let pairReason = "Paire par défaut pour sécuriser les gains en dollars.";
            
            const tokenReturns = klines.map(c => parseFloat(c[4]) / parseFloat(c[1]) - 1);
            const token24hRet = tokenReturns.slice(-24).reduce((a,b)=>a+b,0);
            const btc24hRet = btcReturns.length ? btcReturns.slice(-24).reduce((a,b)=>a+b,0) : 0;
            const sol24hRet = solReturns.length ? solReturns.slice(-24).reduce((a,b)=>a+b,0) : 0;
            
            if (token24hRet > btc24hRet + 0.05) {
                score += 20;
                reasons.push(`Alpha Détecté : Surperformance de +${((token24hRet - btc24hRet)*100).toFixed(1)}% vs Bitcoin`);
                
                if (token24hRet > sol24hRet + 0.03 && sol24hRet > 0) {
                    recommendedPair = 'SOL';
                    pairReason = "Le token absorbe la liquidité de Solana. Trader en paire /SOL est mathématiquement supérieur.";
                } else if (token24hRet > btc24hRet + 0.02 && btc24hRet > 0) {
                    recommendedPair = 'BTC';
                    pairReason = "Accumulation massive de Sats. La paire /BTC est recommandée pour battre le marché.";
                }
            }

            score = Math.min(score, 100);
            
            results.push({
                symbol: token.symbol,
                score,
                reasons: [...new Set(reasons)].slice(0, 4),
                price: currentPrice,
                recommendedPair,
                pairReason,
                turnover24h: parseFloat(token.turnover24h)
            });

            // Protection anti-ban API (Rate Limit strict : Pause de 800ms entre chaque Deep Scan complet)
            await new Promise(r => setTimeout(r, 800));

        } catch (e) {
            console.error("ERROR ON TOKEN", token.symbol, e);
        }
    }
    
    if (onProgress) onProgress(100, "TERMINÉ", "Confluence Calculée");

    // Tri par score (desc), puis par volume sur 24h (desc) pour casser les égalités
    results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.turnover24h - a.turnover24h;
    });
    return results.slice(0, 3);
};
