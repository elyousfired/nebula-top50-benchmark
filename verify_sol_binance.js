import axios from 'axios';

const solTokens = [
  'SOL', 'JUP', 'JTO', 'PYTH', 'RNDR', 'W', 'RAY', 'KMNO', 'DRIFT', 'MNDE',
  'ORCA', 'SLND', 'MNGO', 'PORT', 'LDO', 'MET', 'JLP', 'bSOL', 'mSOL', 'jitoSOL',
  'ATLAS', 'POLIS', 'AURY', 'FIDA', 'STEP', 'OXY', 'PRISM', 'SHDW', 'HONEY', 'DFL',
  'NOS', 'ARKM', 'HNT', 'MOBILE', 'IO',
  'BONK', 'WIF', 'BOME', 'POPCAT', 'PENGU', 'TRUMP', 'SAMO', 'FARTCOIN', 'PIPPIN', 'CHEEMS',
  'PUMP', 'INF', 'dSOL', 'JupSOL', 'JSOL'
];

async function checkBinance() {
    try {
        console.log("Vérification des 50 tokens Solana sur Binance...");
        const res = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
        const binanceSymbols = res.data.symbols
            .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT')
            .map(s => s.baseAsset);
            
        const binanceSet = new Set(binanceSymbols);
        const available = [];
        const missing = [];
        
        for (const token of solTokens) {
            // Certaines monnaies s'écrivent parfois différemment sur Binance, mais on teste la version standard
            if (binanceSet.has(token.toUpperCase())) {
                available.push(token.toUpperCase());
            } else {
                missing.push(token);
            }
        }
        
        console.log("\n✅ TOKENS DISPONIBLES SUR BINANCE (USDT) :");
        console.log(available.join(', '));
        console.log("\n❌ TOKENS NON DISPONIBLES SUR BINANCE :");
        console.log(missing.join(', '));
        
    } catch (err) {
        console.error("Erreur API:", err.message);
    }
}

checkBinance();
