import React, { useState, useEffect, useRef } from 'react';
import { Activity, RefreshCw, BarChart2 } from 'lucide-react';
import { fetchBybitData } from './logic/scanner';
import { fetchSolData } from './logic/sol-scanner';
import { detectChannel } from './logic/channelDetector';
import { ChannelChart } from './TrendChannelDashboard';

const BullishScanner = ({ tokens = [] }) => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [analyzeAgainst, setAnalyzeAgainst] = useState("USDT");
  const hasScanned = useRef(false);
  const scanIdRef = useRef(0);

  const loadData = async (against = analyzeAgainst) => {
    const currentScanId = ++scanIdRef.current;
    setLoading(true);
    setProgress(0);
    setChannels([]);
    const results = [];
    const tf = "240"; // 4H timeframe
    
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

    const BATCH_SIZE = 5;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      if (scanIdRef.current !== currentScanId) return;
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (sym) => {
        try {
          const fetchSymbol = sym.includes('USDT') ? sym : `${sym}USDT`;
          if (fetchSymbol === 'SOLUSDT' && against === 'SOL') return null;

          const rawData = await fetchBybitData(fetchSymbol, tf, 200);
          
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
             }).filter((v, idx, a) => idx === 0 || v.time > a[idx - 1].time);
             
             if (against === 'SOL') {
               tokenCandles = tokenCandles.filter(c => !isNaN(c.close) && isFinite(c.close));
             }

             const channel = detectChannel(tokenCandles);
             // ONLY KEEP ASCENDING AND SIDEWAYS
             if (channel && channel.quality >= 40 && (channel.channelType === 'Ascending' || channel.channelType === 'Sideways')) {
                 return { symbol: sym, channel, against };
             }
          }
        } catch(e) {}
        return null;
      });
      
      const batchResults = await Promise.all(promises);
      batchResults.forEach(r => { if(r) results.push(r); });
      setProgress(Math.min(100, Math.floor(((i + BATCH_SIZE) / tokens.length) * 100)));
      if (i + BATCH_SIZE < tokens.length) await new Promise(res => setTimeout(res, 1000));
    }
    
    // Sort Ascending first, then Sideways, then by quality
    setChannels(results.sort((a,b) => {
       const pA = a.channel.channelType === 'Ascending' ? 2 : 1;
       const pB = b.channel.channelType === 'Ascending' ? 2 : 1;
       if (pA !== pB) return pB - pA;
       return b.channel.quality - a.channel.quality;
    }));
    setLoading(false);
  };

  useEffect(() => {
    if (tokens.length > 0 && !hasScanned.current) {
      hasScanned.current = true;
      loadData();
    }
  }, [tokens]);

  return (
    <div style={{ padding: '2rem', color: '#fff', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ff88', margin: 0, fontSize: '2rem' }}>
            <BarChart2 size={32} /> Bullish Grid (4H)
          </h2>
          <p style={{ color: '#94a3b8', margin: '8px 0 0 0' }}>Grille des opportunités haussières et latérales sur le timeframe 4H.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(0, 208, 255, 0.2)' }}>
            <span style={{ padding: '0 8px', fontSize: '0.8rem', color: '#94a3b8' }}>Analyze against:</span>
            <button 
              onClick={() => { setAnalyzeAgainst('SOL'); loadData('SOL'); }}
              style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'SOL' ? '#00d0ff' : 'transparent', color: analyzeAgainst === 'SOL' ? '#000' : '#888', fontWeight: analyzeAgainst === 'SOL' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              VS SOL
            </button>
            <button 
              onClick={() => { setAnalyzeAgainst('USDT'); loadData('USDT'); }}
              style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: analyzeAgainst === 'USDT' ? '#00ff88' : 'transparent', color: analyzeAgainst === 'USDT' ? '#000' : '#888', fontWeight: analyzeAgainst === 'USDT' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              VS USDT
            </button>
          </div>

          <button 
            onClick={() => loadData(analyzeAgainst)} 
            disabled={loading} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: loading ? '#1e293b' : 'rgba(0,255,136,0.1)', color: loading ? '#64748b' : '#00ff88', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            <RefreshCw size={18} className={loading ? "spin" : ""} /> 
            {loading ? `Scanning ${progress}%...` : "Refresh"}
          </button>
        </div>
      </div>

      {loading && channels.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', background: '#0a0f1c', borderRadius: '16px', border: '1px solid #1e293b' }}>
          <Activity size={48} color="#00ff88" className="spin" style={{ marginBottom: '24px' }} />
          <h3 style={{ margin: 0, color: '#fff' }}>Analyse des canaux en 4H...</h3>
          <p style={{ color: '#94a3b8' }}>Recherche des tendances Bullish et Sideways parmi {tokens.length} tokens ({progress}%)</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
          {channels.map(({ symbol, channel }) => (
            <div key={symbol} style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: analyzeAgainst === 'SOL' ? '#00d0ff' : '#00ff88' }}>{symbol}</span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: channel.channelType === 'Ascending' ? 'rgba(0,255,136,0.2)' : 'rgba(250,204,21,0.2)', color: channel.channelType === 'Ascending' ? '#00ff88' : '#facc15', border: `1px solid ${channel.channelType === 'Ascending' ? '#00ff88' : '#facc15'}` }}>
                    {channel.channelType}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', gap: '12px' }}>
                  <span>Score: <strong style={{ color: '#fff' }}>{channel.quality.toFixed(0)}</strong></span>
                  <span>Pos: <strong style={{ color: channel.positionPct < 20 ? '#00ff88' : channel.positionPct > 80 ? '#ef4444' : '#fff' }}>{channel.positionPct.toFixed(0)}%</strong></span>
                </div>
              </div>
              <div style={{ flex: 1, padding: '16px' }}>
                <ChannelChart channelData={channel} />
              </div>
            </div>
          ))}
          {channels.length === 0 && !loading && (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#64748b', background: '#0f172a', borderRadius: '12px' }}>
              Aucun canal haussier ou latéral trouvé sur les tokens scannés.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BullishScanner;
