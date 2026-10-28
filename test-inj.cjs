const axios = require('axios');

async function testINJ() {
  const symbol = 'INJUSDT';
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=D&limit=300`;
  const res = await axios.get(url);
  const klines = res.data.result.list;
  
  for(let i=100; i<300; i++) {
      if(!klines[i]) continue;
      const high = parseFloat(klines[i][2]);
      if (high > 6.9 && high < 7.5) {
          console.log(`Day ${i} High: ${high}`);
      }
  }
}

testINJ();
