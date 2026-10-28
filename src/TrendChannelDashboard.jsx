import React, { useState, useEffect, useRef } from 'react';
import { Activity, ShieldAlert, RefreshCw, BarChart2 } from 'lucide-react';
import { fetchBybitData, fetchBinanceData, fetchTop500Symbols } from './logic/scanner';
import { detectChannel } from './logic/channelDetector';
import { createChart } from 'lightweight-charts';

export const ChannelChart = ({ channelData }) => {
  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !channelData || !channelData.candles || channelData.candles.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.2)' }, horzLines: { color: 'rgba(42, 46, 57, 0.2)' } },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(42, 46, 57, 0.5)' },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff88', downColor: '#ff3b30', borderVisible: false,
      wickUpColor: '#00ff88', wickDownColor: '#ff3b30'
    });

    candleSeries.setData(channelData.candles.map(c => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close
    })));

    // Generate Regression Lines
    const N = channelData.candles.length;
    const { slope, b_upper, b_lower, b_mid } = channelData;
    
    const upperLineData = [];
    const lowerLineData = [];
    const midLineData = [];

    for (let i = 0; i < N; i++) {
      upperLineData.push({ time: channelData.candles[i].time, value: slope * i + b_upper });
      lowerLineData.push({ time: channelData.candles[i].time, value: slope * i + b_lower });
      midLineData.push({ time: channelData.candles[i].time, value: slope * i + b_mid });
    }

    const upperSeries = chart.addLineSeries({ color: 'rgba(255, 59, 48, 0.8)', lineWidth: 2, lineStyle: 2 });
    upperSeries.setData(upperLineData);

    const lowerSeries = chart.addLineSeries({ color: 'rgba(0, 255, 136, 0.8)', lineWidth: 2, lineStyle: 2 });
    lowerSeries.setData(lowerLineData);

    const midSeries = chart.addLineSeries({ color: 'rgba(200, 200, 200, 0.4)', lineWidth: 1, lineStyle: 3 });
    midSeries.setData(midLineData);

    chart.timeScale().fitContent();

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [channelData]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '300px' }} />;
};

const TrendChannelDashboard = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);
  const [timeframe, setTimeframe] = useState("240");
  const [analyzeAgainst, setAnalyzeAgainst] = useState("USDT");
  const hasScanned = useRef(false);
  const scanIdRef = useRef(0);
  const tokenListRef = useRef([]);

  const loadData = async (tf = timeframe, against = analyzeAgainst) => {
    const currentScanId = ++scanIdRef.current;
    setLoading(true);
    setProgress(0);
    setChannels([]);
    const results = [];
    
    let solMap = new Map();
    if (against === 'SOL') {
       const solRawData = await fetchBybitData('SOLUSDT', tf, 200);
       if (solRawData) {
         solRawData.forEach(k => {
           solMap.set(Math.floor(Number(k[0]) / 1000), {
              open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4])
           });
         });
       }
    }

    // Process in batches of 30 to speed up scanning while respecting rate limits (Bybit allows 120 req/s)
    const BATCH_SIZE = 30;
    const tokensToScan = tokenListRef.current;
    
    for (let i = 0; i < tokensToScan.length; i += BATCH_SIZE) {
      if (scanIdRef.current !== currentScanId) return; // Abort if another scan started
      const batch = tokensToScan.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (symObj) => {
        try {
          const sym = symObj.symbol;
          const fetchSymbol = sym.includes('USDT') ? sym : `${sym}USDT`;
          if (fetchSymbol === 'SOLUSDT' && against === 'SOL') return null; // Skip SOL/SOL

          let rawData = null;
          if (symObj.exchange === 'binance') {
            const binanceInterval = tf === 'D' ? '1d' : tf === '240' ? '4h' : tf === '60' ? '1h' : '15m';
            rawData = await fetchBinanceData(fetchSymbol, binanceInterval, 200);
          } else {
            rawData = await fetchBybitData(fetchSymbol, tf, 200);
          }
          
          if (rawData && rawData.length >= 50) {
             let tokenCandles = [...rawData].reverse().map(k => {
                const t = Math.floor(Number(k[0]) / 1000);
                let o = Number(k[1]), h = Number(k[2]), l = Number(k[3]), c = Number(k[4]);

                if (against === 'SOL' && solMap.has(t)) {
                  const sol = solMap.get(t);
                  o = o / sol.open;
                  h = h / sol.high;
                  l = l / sol.low;
                  c = c / sol.close;
                }

                return { time: t, open: o, high: h, low: l, close: c, volume: Number(k[5]) };
             }).filter((v, i, a) => i === 0 || v.time > a[i - 1].time);
             
             if (against === 'SOL') {
               tokenCandles = tokenCandles.filter(c => !isNaN(c.close) && isFinite(c.close));
             }

             const channel = detectChannel(tokenCandles);
             if (channel && channel.quality >= 40) return { symbol: sym, channel, against };
          }
        } catch(e) {}
        return null;
      });
      
      const batchResults = await Promise.all(promises);
      batchResults.forEach(r => { if(r) results.push(r); });
      setProgress(Math.min(100, Math.floor(((i + BATCH_SIZE) / tokensToScan.length) * 100)));
      // Wait 300ms between batches to respect rate limits while maintaining high speed
      if (i + BATCH_SIZE < tokensToScan.length) await new Promise(res => setTimeout(res, 300));
    }
    
    setChannels(results.sort((a,b) => {
       const getPriority = (type) => {
         if (type === 'Ascending') return 3;
         if (type === 'Sideways') return 2;
         if (type === 'Descending') return 1;
         return 0;
       };
       const pA = getPriority(a.channel.channelType);
       const pB = getPriority(b.channel.channelType);
       if (pA !== pB) return pB - pA;
       return b.channel.quality - a.channel.quality;
    }));
    setLoading(false);
  };

  useEffect(() => {
    if (hasScanned.current) return;
    hasScanned.current = true;
    
    const init = async () => {
      setLoading(true);
      try {
        const top500 = await fetchTop500Symbols(true);
        tokenListRef.current = top500.filter(t => !t.symbol.includes('SOL')).map(t => ({ symbol: t.symbol, exchange: t.exchange || 'bybit' }));
        loadData();
      } catch(e) {
        setLoading(false);
      }
    };
    init();
  }, []);

  const Badge = ({ tone, children }) => {
    let bg = '#111', color = '#aaa', border = '#333';
    if (tone === 'bullish') { bg = 'rgba(0,255,136,0.1)'; color = '#00ff88'; border = '#00ff88'; }
    if (tone === 'bearish' || tone === 'danger') { bg = 'rgba(255,59,48,0.1)'; color = '#ff3b30'; border = '#ff3b30'; }
    if (tone === 'warning') { bg = 'rgba(250,204,21,0.1)'; color = '#facc15'; border = '#facc15'; }
    
    return (
      <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', background: bg, color, border: `1px solid ${border}` }}>
        {children}
      </span>
    );
  };

  return (
    <div className="sol-switch-container">
      <div className="sol-switch-header">
        <div className="header-text">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 color="#00ff88" /> Trend Channel Detector
          </h2>
          <p>Scan the market for perfect parallel trend channels using Linear Regression on multiple timeframes.</p>
        </div>
        
        <div className="controls" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(0, 208, 255, 0.2)' }}>
             <span style={{ padding: '0 8px', fontSize: '0.8rem', color: '#94a3b8' }}>Analyze against:</span>
             <button 
                onClick={() => { setAnalyzeAgainst('SOL'); loadData(timeframe, 'SOL'); }}
                style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'SOL' ? '#00d0ff' : 'transparent', color: analyzeAgainst === 'SOL' ? '#000' : '#888', fontWeight: analyzeAgainst === 'SOL' ? 'bold' : 'normal' }}
             >
               VS SOL
             </button>
             <button 
                onClick={() => { setAnalyzeAgainst('USDT'); loadData(timeframe, 'USDT'); }}
                style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'USDT' ? '#00ff88' : 'transparent', color: analyzeAgainst === 'USDT' ? '#000' : '#888', fontWeight: analyzeAgainst === 'USDT' ? 'bold' : 'normal' }}
             >
               VS USDT
             </button>
          </div>

          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '4px', gap: '4px' }}>
            {[{label: '15M', val: '15'}, {label: '1H', val: '60'}, {label: '4H', val: '240'}, {label: '1D', val: 'D'}].map(opt => (
              <button 
                key={opt.val}
                onClick={() => { setTimeframe(opt.val); loadData(opt.val); }}
                style={{
                  background: timeframe === opt.val ? 'rgba(0,255,136,0.2)' : 'transparent',
                  color: timeframe === opt.val ? '#00ff88' : '#888',
                  border: 'none',
                  padding: '4px 12px'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={() => loadData(timeframe)} disabled={loading} className="refresh-btn">
            <RefreshCw size={16} className={loading ? "spin" : ""} /> {loading ? `Scanning ${progress}%...` : "Refresh All"}
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="radar-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Channel Type</th>
              <th>Quality Score</th>
              <th>Price Position</th>
              <th>Status</th>
              <th>Action</th>
              <th>AI Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading && channels.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                <Activity size={32} color="#00ff88" className="spin" style={{ marginBottom: '16px' }} />
                <div>Analyzing Linear Regression Channels for {tokenListRef.current.length > 0 ? tokenListRef.current.length : '...'} tokens... {progress}%</div>
              </td></tr>
            ) : channels.map(({ symbol, channel }) => (
              <React.Fragment key={symbol}>
                <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedRow(expandedRow === symbol ? null : symbol)}>
                  <td style={{ fontWeight: 'bold', color: '#fff' }}>{symbol}</td>
                  <td>
                    <Badge tone={channel.channelType === 'Ascending' ? 'bullish' : channel.channelType === 'Descending' ? 'danger' : 'neutral'}>
                      {channel.channelType}
                    </Badge>
                  </td>
                  <td style={{ fontWeight: 'bold', color: channel.quality > 70 ? '#00ff88' : channel.quality > 40 ? '#facc15' : '#888' }}>
                    {channel.quality.toFixed(0)} / 100
                  </td>
                  <td>
                    <div style={{ width: '100px', background: '#222', borderRadius: '4px', height: '6px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ 
                        position: 'absolute', 
                        left: `${Math.min(100, Math.max(0, channel.positionPct))}%`,
                        top: 0, bottom: 0, width: '4px', 
                        background: channel.positionPct > 80 ? '#ff3b30' : channel.positionPct < 20 ? '#00ff88' : '#00d2ff',
                        marginLeft: '-2px', borderRadius: '2px'
                      }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px' }}>
                      {channel.positionPct.toFixed(1)}%
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: channel.status?.includes('resistance') ? '#ff3b30' : channel.status?.includes('support') ? '#00ff88' : '#ccc' }}>
                    {channel.status}
                  </td>
                  <td style={{ fontWeight: 'bold', fontSize: '0.85rem', color: channel.action === 'Avoid' ? '#ff3b30' : channel.action?.includes('Watch') ? '#00ff88' : '#facc15' }}>
                    {channel.action || 'Wait'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#aaa', whiteSpace: 'normal', minWidth: '300px' }}>
                    {channel.reason}
                  </td>
                </tr>
                {expandedRow === symbol && (
                  <tr className="expanded-row">
                    <td colSpan="7" style={{ padding: '24px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
                      <h4 style={{ margin: '0 0 16px 0', color: analyzeAgainst === 'SOL' ? '#00d0ff' : '#00ff88' }}>
                        {symbol}/{analyzeAgainst} - {timeframe === '15' ? '15M' : timeframe === '60' ? '1H' : timeframe === '240' ? '4H' : '1D'} Linear Regression Channel
                      </h4>
                      <ChannelChart channelData={channel} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .sol-switch-container { padding: 24px; color: #eee; font-family: 'Inter', sans-serif; background: transparent; }
        .sol-switch-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 20px; }
        .header-text h2 { margin: 0 0 8px 0; font-size: 1.8rem; }
        .header-text p { margin: 0; color: #888; max-width: 600px; line-height: 1.4; }
        
        .controls { display: flex; gap: 8px; }
        .controls button { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; transition: all 0.2s; }
        .controls button:hover { background: rgba(0,0,0,0.6); border-color: rgba(255,255,255,0.3); }
        .controls button:disabled { opacity: 0.7; cursor: not-allowed; }
        .refresh-btn { background: rgba(0,255,136,0.1) !important; color: #00ff88 !important; border-color: rgba(0,255,136,0.3) !important; }
        .refresh-btn:hover { background: rgba(0,255,136,0.2) !important; border-color: rgba(0,255,136,0.5) !important; box-shadow: 0 0 10px rgba(0,255,136,0.2); }
        
        .table-wrapper { overflow-x: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; backdrop-filter: blur(10px); }
        .radar-table { width: 100%; border-collapse: collapse; text-align: left; }
        .radar-table th { padding: 14px 16px; font-size: 0.75rem; text-transform: uppercase; color: #888; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.4); white-space: nowrap; font-weight: 600; letter-spacing: 1px; }
        .radar-table td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.02); vertical-align: middle; transition: background 0.2s; }
        .radar-table tr:hover td { background: rgba(255,255,255,0.03); }
        .expanded-row:hover td { background: #0a0a0a !important; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default TrendChannelDashboard;
