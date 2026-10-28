import fs from 'fs';
import axios from 'axios';

// La grande base de données des "Narratifs" Crypto (Bear/Bull Market)
const categories = {
    "🐶 MEMECOINS (Bear Market Kings - Volatilité Extrême)": [
        "DOGEUSDT", "SHIBUSDT", "PEPEUSDT", "WIFUSDT", "BONKUSDT", "FLOKIUSDT", "BOMEUSDT", "MEMEUSDT", "TURBOUSDT", 
        "1000SATSUSDT", "ORDIUSDT", "1000RATSUSDT", "CATIUSDT", "PENGUUSDT", "CHIPUSDT", "PUMPUSDT", "NOMUSDT", 
        "NEIROUSDT", "BRETTUSDT", "MEWUSDT", "POPCATUSDT", "MOGUSDT", "PEOPLEUSDT", "1000PEPEUSDT"
    ],
    
    "🤖 INTELLIGENCE ARTIFICIELLE (La Technologie)": [
        "TAOUSDT", "FETUSDT", "RENDERUSDT", "WLDUSDT", "ARKMUSDT", "AIUSDT", "NFPUSDT", "CGPTUSDT", "PHBUSDT", 
        "AGIXUSDT", "OCEANUSDT", "NMRUSDT", "RLCUSDT", "CTXCUSDT", "MDTUSDT", "IQUSDT", "GLMUSDT", "GRTUSDT"
    ],
    
    "🎮 WEB3, GAMING & METAVERSE (La Hype Retail)": [
        "PIXELUSDT", "PORTALUSDT", "GALAUSDT", "IMXUSDT", "XAIUSDT", "MAVIAUSDT", "RONINUSDT", "YGGUSDT", "BEAMXUSDT", 
        "SANDUSDT", "MANAUSDT", "AXSUSDT", "ILVUSDT", "ENJUSDT", "MAGICUSDT", "ALICEUSDT", "DARUSDT", "TLMUSDT", 
        "APEUSDT", "CHZUSDT", "SUPERUSDT", "BIGTIMEUSDT", "GNOUSDT"
    ],
    
    "🏦 DEFI (Solana DEX & Ethereum Finance)": [
        "UNIUSDT", "AAVEUSDT", "MKRUSDT", "LDOUSDT", "SNXUSDT", "CRVUSDT", "CAKEUSDT", "COMPUSDT", "RUNEUSDT", 
        "SUSHIUSDT", "PENDLEUSDT", "JUPUSDT", "RAYUSDT", "ORCAUSDT", "1INCHUSDT", "DYDXUSDT", "CVXUSDT", "FXSUSDT", 
        "SOLVUSDT", "DOLOUSDT", "MITOUSDT", "LQTYUSDT"
    ],
    
    "⚙️ LAYER 1 & 2 (La Blacklist - Dinosaures et Gros Moteurs)": [
        "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "ADAUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT", "POLUSDT", 
        "NEARUSDT", "APTUSDT", "SUIUSDT", "SEIUSDT", "TIAUSDT", "OPUSDT", "ARBUSDT", "STRKUSDT", "ZKUSDT", 
        "MNTUSDT", "KASUSDT", "INJUSDT", "LTCUSDT", "FILUSDT", "XRPUSDT", "TRXUSDT", "LINKUSDT", "ATOMUSDT", "ICPUSDT", "ALGOUSDT"
    ]
};

async function generateNarrativeListBybit() {
    try {
        console.log("🚀 Connexion à l'API officielle de BYBIT (V5)...");
        
        // Télécharge les données du marché Spot de Bybit
        const res = await axios.get('https://api.bybit.com/v5/market/tickers?category=spot');
        const allTickers = res.data.result.list;
        
        // Convertir en dictionnaire pour un accès rapide
        const tickerMap = {};
        for (const t of allTickers) {
            tickerMap[t.symbol] = {
                price: parseFloat(t.lastPrice),
                volume: parseFloat(t.turnover24h) // Sur Bybit, le volume en USDT s'appelle 'turnover24h'
            };
        }
        
        let markdown = `# 🌌 NEBULA SCANNER - LA BIBLE DES NARRATIFS (🔴 EXCLUSIVITÉ BYBIT)\n\n`;
        markdown += `*Données en temps réel extraites de la plateforme BYBIT. Bybit a souvent des Memecoins et des petits projets Web3 bien avant qu'ils n'arrivent sur Binance !*\n\n`;
        
        const usedSymbols = new Set();
        
        for (const [categoryName, symbols] of Object.entries(categories)) {
            markdown += `## ${categoryName}\n`;
            markdown += `| TOKEN | PRIX ACTUEL | VOLUME 24H (USDT) |\n|---|---|---|\n`;
            
            const categoryTokens = [];
            
            for (const sym of symbols) {
                if (tickerMap[sym]) {
                    categoryTokens.push({
                        symbol: sym,
                        price: tickerMap[sym].price,
                        volume: tickerMap[sym].volume
                    });
                    usedSymbols.add(sym);
                }
            }
            
            categoryTokens.sort((a, b) => b.volume - a.volume);
            
            for (const t of categoryTokens) {
                const formattedPrice = t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(4);
                markdown += `| **${t.symbol}** | $${formattedPrice} | $${Math.round(t.volume).toLocaleString()} |\n`;
            }
            markdown += `\n`;
        }
        
        // Les tokens exclusifs à Bybit (Ceux qui ont de gros volumes mais qui ne sont pas sur Binance)
        markdown += `## 💎 PÉPITES CACHÉES (Fort Volume Bybit non classé)\n`;
        markdown += `*Ces tokens font énormément de volume sur Bybit. Surveillez-les pour des breakouts !*\n\n`;
        markdown += `| TOKEN | PRIX ACTUEL | VOLUME 24H (USDT) |\n|---|---|---|\n`;
        
        const otherTokens = [];
        for (const t of allTickers) {
            if (t.symbol.endsWith('USDT') && !usedSymbols.has(t.symbol) && parseFloat(t.turnover24h) > 500000 && !t.symbol.includes('UPUSDT') && !t.symbol.includes('DOWNUSDT')) {
                otherTokens.push({
                    symbol: t.symbol,
                    price: parseFloat(t.lastPrice),
                    volume: parseFloat(t.turnover24h)
                });
            }
        }
        
        otherTokens.sort((a, b) => b.volume - a.volume);
        
        for (let i = 0; i < Math.min(100, otherTokens.length); i++) {
            const t = otherTokens[i];
            const formattedPrice = t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(4);
            markdown += `| **${t.symbol}** | $${formattedPrice} | $${Math.round(t.volume).toLocaleString()} |\n`;
        }
        
        fs.writeFileSync('C:/Users/user/Desktop/Nebula-Scanner-V1/NEBULA_NARRATIVES_BYBIT.md', markdown);
        
        console.log(`\n✅ Extraction des données BYBIT réussie !`);
        console.log(`Le fichier NEBULA_NARRATIVES_BYBIT.md a été créé. Allez voir les pépites exclusives !`);
        
    } catch (e) {
        console.error("Erreur API Bybit:", e.message);
    }
}

generateNarrativeListBybit();
