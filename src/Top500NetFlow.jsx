import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowUpRight, ArrowDownRight, RefreshCw, BarChart2 } from 'lucide-react';

const STABLECOINS = ['USDCUSDT', 'FDUSDUSDT', 'BUSDUSDT', 'TUSDUSDT', 'USDEUSDT', 'EURUSDT'];

// Using the same proxy logic as scanner.js to avoid CORS issues
const PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

const fetchTickersWithRetry = async () => {
  const url = "https://api.bybit.com/v5/market/tickers?category=spot";
  try {
    const res = await axios.get(url, { timeout: 1500 });
    if (res.data?.result?.list) return res.data.result.list;
  } catch (err) {}

  for (let i = 0; i < PROXIES.length; i++) {
    try {
      const response = await axios.get(PROXIES[i](url), { timeout: 3000 });
      const list = response.data?.result?.list || response.data?.list;
      if (list) return list;
    } catch (e) { }
  }
  return [];
};

const formatMoney = (val) => {
  if (!val) return '0';
  if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
  if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
  return val.toFixed(2);
};

const Top500NetFlow = () => {
  const [inflows, setInflows] = useState([]);
  const [outflows, setOutflows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTimeframe, setActiveTimeframe] = useState('24H');

  const scanNetFlows = async (timeframe = activeTimeframe) => {
    setIsLoading(true);
    const tickers = await fetchTickersWithRetry();
    
    if (tickers && tickers.length > 0) {
      let flowData = [];
      
      if (timeframe === '24H') {
        tickers.forEach(t => {
          if (t.symbol.endsWith('USDT') && !STABLECOINS.includes(t.symbol) && !t.symbol.includes('DOWN') && !t.symbol.includes('UP')) {
            const lastPrice = parseFloat(t.lastPrice);
            const prevPrice24h = parseFloat(t.prevPrice24h);
            const turnover24h = parseFloat(t.turnover24h);
            
            if (prevPrice24h > 0 && turnover24h > 0) {
              const pctChange = (lastPrice / prevPrice24h) - 1;
              const netFlow = turnover24h * pctChange;
              
              flowData.push({
                symbol: t.symbol.replace('USDT', ''),
                price: lastPrice,
                pctChange: pctChange * 100,
                volume: turnover24h,
                netFlow: netFlow
              });
            }
          }
        });
      } else if (timeframe === '4H') {
        // Filter valid USDT pairs, sort by 24h volume to limit API calls, take top 150
        const validTokens = tickers
          .filter(t => t.symbol.endsWith('USDT') && !STABLECOINS.includes(t.symbol) && !t.symbol.includes('DOWN') && !t.symbol.includes('UP'))
          .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
          .slice(0, 150); // limit to 150 to avoid rate limit (120 req/sec)

        // Fetch 4H klines (interval=240, limit=1)
        const fetchKline = async (sym) => {
          try {
            const res = await axios.get(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${sym}&interval=240&limit=1`, { timeout: 2000 });
            if (res.data?.result?.list && res.data.result.list.length > 0) {
              const k = res.data.result.list[0];
              const open = parseFloat(k[1]);
              const close = parseFloat(k[4]);
              const volume = parseFloat(k[6]); // turnover
              const pctChange = (close / open) - 1;
              const netFlow = volume * pctChange;
              return { symbol: sym.replace('USDT', ''), price: close, pctChange: pctChange * 100, volume: volume, netFlow };
            }
          } catch(e) {}
          return null;
        };

        // Chunking the requests into batches of 30
        for (let i = 0; i < validTokens.length; i += 30) {
          const batch = validTokens.slice(i, i + 30);
          const results = await Promise.all(batch.map(t => fetchKline(t.symbol)));
          results.forEach(res => { if (res) flowData.push(res); });
          await new Promise(r => setTimeout(r, 200));
        }
      }
      
      flowData.sort((a, b) => b.netFlow - a.netFlow);
      const positiveFlows = flowData.filter(d => d.netFlow > 0).slice(0, timeframe === '4H' ? 25 : 50); 

      setInflows(positiveFlows);
      setLastUpdate(new Date());
    }
    setIsLoading(false);
  };

  useEffect(() => {
    scanNetFlows(activeTimeframe);
  }, [activeTimeframe]);

  const renderTable = (data, isOutflow = false) => {
    const maxFlow = Math.max(...data.map(d => Math.abs(d.netFlow)), 1);

    return (
      <div style={{ background: 'rgba(25, 30, 40, 0.6)', borderRadius: '12px', border: `1px solid ${isOutflow ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`, overflow: 'hidden' }}>
        <div style={{ background: isOutflow ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '15px 20px', borderBottom: `1px solid ${isOutflow ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isOutflow ? <ArrowDownRight color="#ef4444" size={24} /> : <ArrowUpRight color="#10b981" size={24} />}
          <h2 style={{ margin: 0, color: isOutflow ? '#ef4444' : '#10b981', fontSize: '1.2rem', fontWeight: 'bold' }}>
            TOP {data.length} {isOutflow ? 'OUTFLOWS (Vendeurs)' : 'INFLOWS (Acheteurs)'}
          </h2>
        </div>
        <div style={{ padding: '0 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#cbd5e1' }}>
            <thead>
              <tr>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem' }}>ASSET</th>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'right' }}>PRICE</th>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'right' }}>{activeTimeframe} VOL</th>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'right' }}>NET FLOW {activeTimeframe}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={item.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '12px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', width: '20px' }}>{idx + 1}.</span>
                    {item.symbol}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                    ${item.price < 0.01 ? item.price.toFixed(5) : item.price.toFixed(2)}
                    <span style={{ fontSize: '0.7rem', color: item.pctChange >= 0 ? '#10b981' : '#ef4444', marginLeft: '6px' }}>
                      {item.pctChange > 0 ? '+' : ''}{item.pctChange.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: '#94a3b8' }}>
                    ${formatMoney(item.volume)}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 'bold', color: isOutflow ? '#ef4444' : '#10b981' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span style={{ fontSize: '1.05rem' }}>{item.netFlow > 0 ? '+' : '-'}${formatMoney(Math.abs(item.netFlow))}</span>
                      <div style={{ width: '100%', maxWidth: '180px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${(Math.abs(item.netFlow) / maxFlow) * 100}%`, 
                          height: '100%', 
                          background: isOutflow ? '#ef4444' : '#10b981',
                          marginLeft: 'auto',
                          boxShadow: isOutflow ? '0 0 8px rgba(239, 68, 68, 0.5)' : '0 0 8px rgba(16, 185, 129, 0.5)'
                        }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', color: '#fff', minHeight: '100vh', background: 'transparent' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={28} color="#00e5ff" /> TOP 500 NET FLOW
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Tracking capital rotation across the entire Bybit Spot Market (Volume × Price % Change)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '4px' }}>
            <button 
              onClick={() => setActiveTimeframe('4H')}
              style={{ padding: '6px 12px', background: activeTimeframe === '4H' ? '#00e5ff' : 'transparent', color: activeTimeframe === '4H' ? '#000' : '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              4H
            </button>
            <button 
              onClick={() => setActiveTimeframe('24H')}
              style={{ padding: '6px 12px', background: activeTimeframe === '24H' ? '#00e5ff' : 'transparent', color: activeTimeframe === '24H' ? '#000' : '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              24H
            </button>
          </div>
          {lastUpdate && (
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button 
            onClick={scanNetFlows}
            disabled={isLoading}
            style={{
              background: '#00e5ff', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', 
              fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              opacity: isLoading ? 0.7 : 1, transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={16} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            {isLoading ? 'SCANNING...' : 'SCAN MARKET'}
          </button>
        </div>
      </div>

      {/* Single View */}
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {renderTable(inflows, false)}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default Top500NetFlow;
