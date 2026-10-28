export class OrderBookWS {
  constructor() {
    this.ws = null;
    this.orderbooks = {}; // { SYMBOL: { b: Map(price -> size), a: Map(price -> size) } }
    this.symbols = [];
  }

  connect(symbols) {
    if (this.ws) {
      this.disconnect();
    }
    
    this.symbols = symbols;
    this.orderbooks = {};
    
    this.ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
    
    this.ws.onopen = () => {
      console.log('WS connected. Subscribing to orderbooks...');
      // Bybit allows max 10 args per subscribe request. Batch them.
      for (let i = 0; i < symbols.length; i += 10) {
        const batch = symbols.slice(i, i + 10);
        const args = batch.map(s => `orderbook.50.${s}`);
        this.ws.send(JSON.stringify({ op: "subscribe", args: args }));
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (!data || !data.topic || !data.data) return;

      const symbol = data.data.s;
      const type = data.type; // "snapshot" or "delta"

      if (type === 'snapshot') {
        this.orderbooks[symbol] = {
          b: new Map(),
          a: new Map()
        };
        data.data.b.forEach(([price, size]) => this.orderbooks[symbol].b.set(price, size));
        data.data.a.forEach(([price, size]) => this.orderbooks[symbol].a.set(price, size));
      } else if (type === 'delta') {
        if (!this.orderbooks[symbol]) return;
        
        data.data.b.forEach(([price, size]) => {
          if (parseFloat(size) === 0) this.orderbooks[symbol].b.delete(price);
          else this.orderbooks[symbol].b.set(price, size);
        });
        
        data.data.a.forEach(([price, size]) => {
          if (parseFloat(size) === 0) this.orderbooks[symbol].a.delete(price);
          else this.orderbooks[symbol].a.set(price, size);
        });
      }
    };

    this.ws.onerror = (e) => {
      console.error("WebSocket error:", e);
    };

    this.ws.onclose = () => {
      console.log("WebSocket closed");
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getSnapshot() {
    // Return a clean copy of current state for all tracked symbols
    const result = {};
    for (const sym in this.orderbooks) {
      result[sym] = {
        b: Array.from(this.orderbooks[sym].b.entries())
            .map(e => [parseFloat(e[0]), parseFloat(e[1])])
            .sort((a,b) => b[0] - a[0]), // sort bids descending
        a: Array.from(this.orderbooks[sym].a.entries())
            .map(e => [parseFloat(e[0]), parseFloat(e[1])])
            .sort((a,b) => a[0] - b[0]) // sort asks ascending
      };
    }
    return result;
  }
}
