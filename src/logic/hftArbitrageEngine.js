export class HftArbitrageEngine {
    constructor(symbol, onTick, onSignal) {
        this.symbol = symbol; // e.g. WIFUSDT
        this.onTick = onTick; // Callback for UI updates
        this.onSignal = onSignal; // Callback for trade execution
        
        this.ws = null;
        this.dexInterval = null;
        
        this.cexPrice = 0;
        this.dexPrice = 0;
        
        // Settings
        this.spreadThreshold = 1.5; // Trigger arbitrage if spread > 1.5%
        this.running = false;
        
        this.dexSymbol = symbol.replace(/USDT$|USDC$/i, ''); // e.g. WIF
    }

    start() {
        this.running = true;
        this.connectBybitWS();
        this.startDexPolling();
    }

    stop() {
        this.running = false;
        if (this.ws) {
            this.ws.close();
        }
        if (this.dexInterval) {
            clearInterval(this.dexInterval);
        }
    }

    connectBybitWS() {
        this.ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
        
        this.ws.onopen = () => {
            console.log(`[HFT] Connected to Bybit WS for ${this.symbol}`);
            const req = {
                op: 'subscribe',
                args: [`publicTrade.${this.symbol}`]
            };
            this.ws.send(JSON.stringify(req));
        };

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.topic === `publicTrade.${this.symbol}` && msg.data && msg.data.length > 0) {
                // Get the latest trade price
                const latestTrade = msg.data[0];
                this.cexPrice = parseFloat(latestTrade.p);
                this.evaluateState();
            }
        };

        this.ws.onclose = () => {
            if (this.running) {
                console.log("[HFT] Bybit WS closed. Reconnecting...");
                setTimeout(() => this.connectBybitWS(), 1000);
            }
        };
    }

    async fetchDexPrice() {
        try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${this.dexSymbol}`);
            const data = await res.json();
            if (!data.pairs) return;

            // Filter for Solana to ensure we get the Raydium/Orca pool
            let solanaPairs = data.pairs.filter(p => p.chainId === 'solana' && p.baseToken.symbol.toUpperCase() === this.dexSymbol.toUpperCase());
            
            // Honeypot filter
            solanaPairs = solanaPairs.filter(p => {
                const liq = p.liquidity?.usd || 0;
                const vol = p.volume?.h24 || 0;
                if (vol < 100) return false;
                if (liq > 5_000_000 && vol < liq * 0.005) return false;
                return true;
            });

            solanaPairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));

            if (solanaPairs.length > 0) {
                const oldPrice = this.dexPrice;
                this.dexPrice = parseFloat(solanaPairs[0].priceUsd);
                
                // If DEX price pumped suddenly by > 1% in 1.5s, that's a whale!
                if (oldPrice > 0 && this.dexPrice > oldPrice * 1.01) {
                    this.onSignal({
                        type: 'DEX_WHALE_PUMP',
                        message: `Whale Buy on Raydium! Price spiked +${((this.dexPrice/oldPrice - 1)*100).toFixed(2)}%`,
                        dexPrice: this.dexPrice,
                        cexPrice: this.cexPrice,
                        timestamp: Date.now()
                    });
                }
                
                this.evaluateState();
            }
        } catch (e) {
            console.error("[HFT] DEX Fetch Error", e);
        }
    }

    startDexPolling() {
        // High frequency polling (every 1.5 seconds)
        // In a real Node.js backend, we would use a Solana RPC WebSocket (e.g. Helius) for 10ms latency.
        this.fetchDexPrice();
        this.dexInterval = setInterval(() => {
            if (this.running) this.fetchDexPrice();
        }, 1500);
    }

    evaluateState() {
        if (this.cexPrice === 0 || this.dexPrice === 0) {
            this.onTick({
                cexPrice: this.cexPrice,
                dexPrice: this.dexPrice,
                spread: 0,
                timestamp: Date.now()
            });
            return;
        }

        // Calculate spread
        const spreadPercent = ((this.dexPrice - this.cexPrice) / this.cexPrice) * 100;
        
        // If DEX is significantly higher than CEX, CEX is lagging! Arbitrage opportunity.
        if (spreadPercent >= this.spreadThreshold) {
            const now = Date.now();
            if (!this.lastArbTime || now - this.lastArbTime > 3000) {
                this.lastArbTime = now;
                this.onSignal({
                    type: 'ARBITRAGE_BUY_CEX',
                    message: `Spread > ${this.spreadThreshold}%. Buy on Bybit!`,
                    dexPrice: this.dexPrice,
                    cexPrice: this.cexPrice,
                    spread: spreadPercent,
                    timestamp: now
                });
            }
        }

        // Emit tick for UI
        this.onTick({
            cexPrice: this.cexPrice,
            dexPrice: this.dexPrice,
            spread: spreadPercent,
            timestamp: Date.now()
        });
    }
}
