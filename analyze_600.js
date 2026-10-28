import fs from 'fs';
import axios from 'axios';

async function generateList() {
    try {
        console.log("🚀 Connexion à Binance... Analyse de TOUS les tokens en cours...");
        
        // Télécharge les données des 24 dernières heures pour toutes les paires Binance
        const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
        const allTickers = res.data;
        
        const pennyTokens = [];
        const midTokens = [];
        const heavyTokens = [];
        
        // Liste des Stablecoins et tokens à ignorer
        const stablecoins = ['USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'BUSDUSDT', 'EURUSDT', 'AEURUSDT', 'USDPUSDT', 'DAIUSDT', 'TRYUSDT'];
        
        for (const t of allTickers) {
            // On ne garde que les paires en USDT (Le marché principal)
            if (!t.symbol.endsWith('USDT')) continue;
            
            // Ignorer les Stablecoins et les vieux tokens à levier (UP/DOWN)
            if (stablecoins.includes(t.symbol) || 
                t.symbol.endsWith('UPUSDT') || 
                t.symbol.endsWith('DOWNUSDT') || 
                t.symbol.endsWith('BEARUSDT') || 
                t.symbol.endsWith('BULLUSDT')) {
                continue;
            }
            
            const price = parseFloat(t.lastPrice);
            const volume = parseFloat(t.quoteVolume); // Volume en dollars
            
            // On ignore les tokens "morts" qui ont un volume pathétique (moins de 500,000$ d'échanges)
            if (volume < 500000) continue;
            
            const tokenData = { symbol: t.symbol, price, volume };
            
            // CATÉGORIE 1 : PENNY COINS EXPLOSIFS (Prix < 0.20$) avec plus de 1 million$ de volume
            if (price < 0.20 && volume > 1000000) {
                pennyTokens.push(tokenData);
            }
            // CATÉGORIE 2 : MID COINS ACTIFS (0.20$ à 2.00$) avec plus de 2 millions$ de volume
            else if (price >= 0.20 && price <= 2.00 && volume > 2000000) {
                midTokens.push(tokenData);
            }
            // CATÉGORIE 3 : BLACKLIST / POIDS LOURDS (Prix > 10.00$)
            else if (price > 10.00) {
                heavyTokens.push(tokenData);
            }
        }
        
        // On trie chaque liste par VOLUME (Du plus tradé au moins tradé) pour avoir les meilleurs en haut !
        pennyTokens.sort((a, b) => b.volume - a.volume);
        midTokens.sort((a, b) => b.volume - a.volume);
        heavyTokens.sort((a, b) => b.volume - a.volume);
        
        // Création du fichier Markdown géant
        let markdown = `# 🌌 NEBULA SCANNER - ANALYSE DES 600 TOKENS (LIVE BINANCE)\n\n`;
        markdown += `*Généré automatiquement par l'algorithme d'analyse de liquidité.*\n\n`;
        
        markdown += `## 🚀 1. WHITELIST : PENNY COINS EXPLOSIFS (Prix < 0.20$)\n`;
        markdown += `*Ce sont les tokens les plus manipulables et les plus aimés par les traders particuliers. Lorsqu'une alerte Golden Strike sonne sur l'un d'eux, l'explosion de +15% est hautement probable car la psychologie pousse à l'achat massif.*\n\n`;
        markdown += `| TOKEN | PRIX ACTUEL | VOLUME 24H (USDT) |\n|---|---|---|\n`;
        for (const t of pennyTokens) markdown += `| **${t.symbol}** | $${t.price.toFixed(5)} | $${Math.round(t.volume).toLocaleString()} |\n`;
        
        markdown += `\n## 🔥 2. WHITELIST : MID-CAPS ACTIFS (0.20$ - 2.00$)\n`;
        markdown += `*Des projets sérieux avec un prix intermédiaire et d'énormes volumes d'échanges. Très bons pour des cassures propres et techniques.*\n\n`;
        markdown += `| TOKEN | PRIX ACTUEL | VOLUME 24H (USDT) |\n|---|---|---|\n`;
        for (const t of midTokens) markdown += `| **${t.symbol}** | $${t.price.toFixed(4)} | $${Math.round(t.volume).toLocaleString()} |\n`;
        
        markdown += `\n## ❌ 3. BLACKLIST : DINOSAURES & POIDS LOURDS (Prix > 10.00$)\n`;
        markdown += `*NE TRADEZ PAS CES TOKENS SUR DES BREAKOUTS ! Ils sont trop lourds et coûtent trop cher. La plupart des signaux sur ces tokens finissent en retracement brutal qui touche le Stop Loss car les vieux vendeurs liquident leurs positions.*\n\n`;
        markdown += `| TOKEN | PRIX ACTUEL | VOLUME 24H (USDT) |\n|---|---|---|\n`;
        for (const t of heavyTokens) markdown += `| **${t.symbol}** | $${t.price.toFixed(2)} | $${Math.round(t.volume).toLocaleString()} |\n`;
        
        fs.writeFileSync('C:/Users/user/Desktop/Nebula-Scanner-V1/NEBULA_600_ANALYSIS.md', markdown);
        
        console.log(`\n✅ Analyse mathématique des ~600 tokens terminée avec succès !`);
        console.log(`- 🚀 Penny Coins trouvés : ${pennyTokens.length}`);
        console.log(`- 🔥 Mid Coins trouvés : ${midTokens.length}`);
        console.log(`- ❌ Poids Lourds (Blacklist) : ${heavyTokens.length}`);
        console.log(`\nLe document géant NEBULA_600_ANALYSIS.md a été créé dans votre dossier de projet ! Ouvrez-le !`);
        
    } catch (e) {
        console.error("Erreur API Binance:", e.message);
    }
}

generateList();
