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

async function generateNarrativeList() {
    try {
        console.log("🚀 Connexion à Binance... Classement par Narratifs (IA, Memes, Web3)...");
        
        const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
        const allTickers = res.data;
        
        // Convertir en dictionnaire pour un accès rapide
        const tickerMap = {};
        for (const t of allTickers) {
            tickerMap[t.symbol] = {
                price: parseFloat(t.lastPrice),
                volume: parseFloat(t.quoteVolume)
            };
        }
        
        let markdown = `# 🌌 NEBULA SCANNER - LA BIBLE DES NARRATIFS (BEAR/BULL MARKET)\n\n`;
        markdown += `*Dans un marché difficile (Bear Market), l'argent tourne en boucle dans des secteurs très spécifiques : les Memecoins, l'IA et le Web3. Privilégiez les Golden Strikes sur ces listes !*\n\n`;
        
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
            
            // Tri par volume pour avoir les plus "chauds" en haut
            categoryTokens.sort((a, b) => b.volume - a.volume);
            
            for (const t of categoryTokens) {
                // Astuce pour bien afficher les Memecoins avec plein de zéros
                const formattedPrice = t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(4);
                markdown += `| **${t.symbol}** | $${formattedPrice} | $${Math.round(t.volume).toLocaleString()} |\n`;
            }
            markdown += `\n`;
        }
        
        // Les "Autres" (Tous les autres tokens Binance non classés)
        markdown += `## 📦 AUTRES TOKENS (Moins connus / Faible Volume)\n`;
        markdown += `| TOKEN | PRIX ACTUEL | VOLUME 24H (USDT) |\n|---|---|---|\n`;
        
        const otherTokens = [];
        for (const t of allTickers) {
            if (t.symbol.endsWith('USDT') && !usedSymbols.has(t.symbol) && parseFloat(t.quoteVolume) > 500000 && !t.symbol.includes('UPUSDT') && !t.symbol.includes('DOWNUSDT')) {
                otherTokens.push({
                    symbol: t.symbol,
                    price: parseFloat(t.lastPrice),
                    volume: parseFloat(t.quoteVolume)
                });
            }
        }
        
        otherTokens.sort((a, b) => b.volume - a.volume);
        
        // On ne met que le Top 100 des autres pour ne pas faire un fichier trop lourd
        for (let i = 0; i < Math.min(100, otherTokens.length); i++) {
            const t = otherTokens[i];
            const formattedPrice = t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(4);
            markdown += `| **${t.symbol}** | $${formattedPrice} | $${Math.round(t.volume).toLocaleString()} |\n`;
        }
        
        fs.writeFileSync('C:/Users/user/Desktop/Nebula-Scanner-V1/NEBULA_NARRATIVES.md', markdown);
        
        console.log(`\n✅ La Bible des Narratifs a été générée avec succès !`);
        console.log(`Le fichier NEBULA_NARRATIVES.md a été créé. Vous y trouverez les listes parfaites d'IA, de Memecoins et de Web3 !`);
        
    } catch (e) {
        console.error("Erreur API:", e.message);
    }
}

generateNarrativeList();
