import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { fetchBinanceData, calculateNebulaLogic, fetchTop500Symbols } from './src/logic/scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const historyFile = path.join(__dirname, 'history.json');

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    red: "\x1b[31m",
    bgGreen: "\x1b[42m\x1b[30m",
    dim: "\x1b[2m"
};

let monitoringList = [];
let scans = {};
let isGlobalScanning = false;
let goldenHistory = {};

if (fs.existsSync(historyFile)) {
    try {
        const data = fs.readFileSync(historyFile, 'utf8');
        goldenHistory = JSON.parse(data);
    } catch (e) {}
}

const saveHistory = () => {
    fs.writeFileSync(historyFile, JSON.stringify(goldenHistory, null, 2), 'utf8');
};

const printGoldenStrike = (symbol, current, time) => {
    console.log(`\n${colors.bgGreen} ⚡ GOLDEN STRIKE DETECTED : ${symbol} ⚡ ${colors.reset}`);
    console.log(`${colors.green}► Heure      : ${time}${colors.reset}`);
    console.log(`${colors.green}► Prix Entrée: $${current.close}${colors.reset}\n`);
};

const runCycle2 = async (targetList = null) => {
    if (isGlobalScanning && !targetList) return;
    const listToScan = targetList || monitoringList;
    if (listToScan.length === 0) return;
    
    let processedCount = 0;
    for (let i = 0; i < listToScan.length; i += 20) {
        const batch = listToScan.slice(i, i + 20);
        await Promise.all(batch.map(async (symbol) => {
            const data = await fetchBinanceData(symbol);
            if (data) {
                const processed = calculateNebulaLogic(data);
                if (processed) {
                    const current = processed[processed.length - 1];
                    scans[symbol] = current;
                    if (current.isGolden && !goldenHistory[symbol]) {
                        const now = new Date();
                        const timeStr = now.toLocaleTimeString();
                        goldenHistory[symbol] = { time: timeStr, priceAtStrike: current.close, timestamp: Date.now() };
                        saveHistory();
                        printGoldenStrike(symbol, current, timeStr);
                    }
                }
            }
        }));
        processedCount += batch.length;
        process.stdout.write(`${colors.dim}[${new Date().toLocaleTimeString()}] Sniper Scan : ${processedCount}/${listToScan.length} cibles...\r${colors.reset}`);
    }
};

const runCycle1 = async () => {
    if (isGlobalScanning) return;
    isGlobalScanning = true;
    console.log(`\n${colors.yellow}🚀 CYCLE 1 : DECOUVERTE GLOBALE (1H)${colors.reset}`);
    
    let top600 = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
        top600 = await fetchTop500Symbols();
        if (top600.length > 0) break;
        console.log(`${colors.yellow}[ATTENTION] Tentative ${attempt}/3 échouée. Nouvelle tentative dans 5s...${colors.reset}`);
        await new Promise(r => setTimeout(r, 5000));
    }

    if (top600.length === 0) {
        console.log(`${colors.red}[ERREUR] Impossible de récupérer le Top 600 après 3 tentatives.${colors.reset}`);
        isGlobalScanning = false;
        return;
    }

    const candidates = [];
    let processedCount = 0;
    for (let i = 0; i < top600.length; i += 25) {
        const batch = top600.slice(i, i + 25);
        await Promise.all(batch.map(async (symbol) => {
            const data = await fetchBinanceData(symbol);
            if (data) {
                const processed = calculateNebulaLogic(data);
                if (processed && processed[processed.length - 1].scanSignal) {
                    candidates.push(symbol);
                }
            }
        }));
        processedCount += batch.length;
        process.stdout.write(`${colors.cyan}[INFO] Analyse... ${processedCount}/${top600.length} tokens\r${colors.reset}`);
    }

    monitoringList = candidates;
    isGlobalScanning = false;
    runCycle2(candidates);
};

// Petit serveur minimaliste pour l'historique (comme avant)
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/api/history') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(goldenHistory));
    } else {
        res.writeHead(404); res.end();
    }
});
server.listen(3001);

runCycle1();
setInterval(runCycle1, 3600000); 
setInterval(() => runCycle2(), 30000);
