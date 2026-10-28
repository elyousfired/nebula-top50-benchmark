import http from 'http';
import axios from 'axios';
import { fetchTop500Symbols, fetchDepth } from './src/logic/scanner.js';

const PORT = 3002;
let depthData = {};
let isScanning = false;

console.log("\n\x1b[36m🛰️ NEBULA DEPHT BRIDGE - INITIALISATION\x1b[0m");
console.log("\x1b[90mDémarrage du scanner de carnet d'ordres dédié...\x1b[0m\n");

async function runDepthCycle() {
    if (isScanning) return;
    isScanning = true;
    
    try {
        const symbolsList = await fetchTop500Symbols();
        const top100 = symbolsList.slice(0, 100);
        
        // SCAN DIRECT SANS PROXY (Vitesse maximale Node.js)
        for (let i = 0; i < top100.length; i += 10) {
            const batch = top100.slice(i, i + 10);
            await Promise.all(batch.map(async (symbol) => {
                try {
                    const response = await axios.get(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`, { timeout: 3000 });
                    const d = response.data;
                    
                    if (d && d.bids) {
                        const bV = d.bids.reduce((a, b) => a + parseFloat(b[1]), 0);
                        const aV = d.asks.reduce((a, b) => a + parseFloat(b[1]), 0);
                        const avgBid = bV / (d.bids.length || 1);
                        const buyWalls = d.bids.filter(b => parseFloat(b[1]) > avgBid * 5).length;
                        const biggestWall = Math.max(...d.bids.map(b => parseFloat(b[1])), 0);
                        
                        depthData[symbol] = { 
                            buyPressure: (bV / (bV + aV || 1)) * 100, 
                            hasWhale: buyWalls > 0,
                            wallStrength: (biggestWall / (avgBid || 1)).toFixed(1),
                            lastUpdate: new Date().toLocaleTimeString()
                        };
                    }
                } catch (e) {
                    // console.log(`Err ${symbol}`);
                }
            }));
            process.stdout.write(`\r\x1b[90m🚀 Scan Direct : ${i + batch.length}/100 cibles...\x1b[0m`);
        }
    } catch (e) {
        console.log("\n\x1b[31mErreur Depth:\x1b[0m", e.message);
    }
    
    isScanning = false;
}

// Serveur API pour le site
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    if (req.url === '/api/depth') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(depthData));
    } else {
        res.writeHead(404); res.end();
    }
});

server.listen(PORT, () => {
    console.log(`\n\x1b[32m✅ BRIDGE PROFONDEUR ACTIF : http://localhost:${PORT}/api/depth\x1b[0m`);
    console.log("\x1b[90mLe site Nebula va maintenant détecter ce terminal automatiquement.\x1b[0m\n");
});

// Boucle infinie
setInterval(runDepthCycle, 5000); // Mise à jour toutes les 5 secondes
runDepthCycle();
