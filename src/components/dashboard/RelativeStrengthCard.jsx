import React, { useState, useEffect, useRef } from 'react';
import { ChartRow, calculateRollingStrength } from '../../MultiPackCharts';
import { syntheticRatio } from '../../logic/solSwitchEngine';
import { fetchBinanceData, fetchBybitData } from '../../logic/scanner';
import { Activity, TrendingUp } from 'lucide-react';
import { createChart } from 'lightweight-charts';

const parseCandles = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(k => ({
    time: Number(k[0]) / 1000, 
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  })).sort((a,b) => a.time - b.time);
};

const SinglePriceChart = ({ data, color }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions = {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { mode: 0 },
      handleScroll: { vertTouchDrag: false },
    };

    chartRef.current = createChart(chartContainerRef.current, chartOptions);
    
    seriesRef.current = chartRef.current.addAreaSeries({
        lineColor: color || '#2962FF',
        topColor: color ? `${color}44` : 'rgba(41, 98, 255, 0.28)',
        bottomColor: color ? `${color}05` : 'rgba(41, 98, 255, 0.05)',
        lineWidth: 2,
    });

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
      const newRect = entries[0].contentRect;
      chartRef.current.applyOptions({ width: newRect.width });
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chartRef.current?.remove();
    };
  }, [color]);

  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      seriesRef.current.setData(data);
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  return <div ref={chartContainerRef} style={{ height: '120px', width: '100%' }} />;
};

const formatPercent = (val) => val.toFixed(2) + '%';

export const RelativeStrengthCard = ({ token, index, btcKlines, solKlines, timeframe }) => {
  const [localTf, setLocalTf] = useState(timeframe || '60');
  const [usdtStrength, setUsdtStrength] = useState([]);
  const [btcStrength, setBtcStrength] = useState([]);
  const [solStrength, setSolStrength] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (timeframe) setLocalTf(timeframe);
  }, [timeframe]);
  
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      let rawUsdt = [];
      const fetchTf = localTf === '3D' ? 'D' : localTf;
      if (token.exchange === 'binance') {
        rawUsdt = await fetchBinanceData(token.symbol, fetchTf, 200);
      } else {
        rawUsdt = await fetchBybitData(token.symbol, fetchTf, 200);
      }
      
      let localBtc = btcKlines;
      let localSol = solKlines;
      
      if (localTf !== timeframe || !btcKlines || !solKlines) {
         localBtc = await fetchBybitData('BTCUSDT', fetchTf, 200);
         localSol = await fetchBybitData('SOLUSDT', fetchTf, 200);
      }
      
      if (!mounted) return;
      
      const parsedUsdt = parseCandles(rawUsdt);
      const parsedSol = parseCandles(localSol);
      const parsedBtc = parseCandles(localBtc);
      
      const synthSol = syntheticRatio(parsedUsdt, parsedSol);
      const synthBtc = syntheticRatio(parsedUsdt, parsedBtc);
      
      const getPeriodForTF = (tf) => {
        if (tf === '15') return 96;
        if (tf === '60') return 24;
        if (tf === '240') return 6;
        if (tf === 'D') return 1;
        if (tf === '3D') return 3;
        if (tf === 'W') return 1;
        return 24;
      };
      const period = getPeriodForTF(localTf);
      
      const strUsdt = calculateRollingStrength(parsedUsdt, period);
      const strSol = calculateRollingStrength(synthSol, period);
      const strBtc = calculateRollingStrength(synthBtc, period);
      
      if (mounted) {
         setUsdtStrength(strUsdt);
         setSolStrength(strSol);
         setBtcStrength(strBtc);
         setPriceData(parsedUsdt.map(c => ({ time: c.time, value: c.close })));
         setLoading(false);
      }
    };
    
    loadData();
    return () => { mounted = false; };
  }, [token, btcKlines, solKlines, isVisible, localTf]);

  const headerContent = (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {index !== undefined && (
            <div style={{ background: '#00ff88', color: '#000', fontSize: '0.8rem', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 'bold', boxShadow: '0 0 10px rgba(0,255,136,0.5)' }}>
              {index + 1}
            </div>
          )}
          <span style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold', letterSpacing: '1px' }}>{token.symbol.replace('USDT','')}</span>
          <span style={{ color: token.exchange === 'binance' ? '#F7931A' : '#3B82F6', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{token.exchange}</span>
          {(token.lastPrice || token.turnover24h) && (
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '10px', textTransform: 'none', letterSpacing: 'normal' }}>
              {token.lastPrice && <span style={{ marginRight: '10px' }}>Price: ${parseFloat(token.lastPrice) < 0.01 ? parseFloat(token.lastPrice).toFixed(6) : parseFloat(token.lastPrice).toFixed(4)}</span>}
              {token.turnover24h && <span>Vol: ${(token.turnover24h / 1000000).toFixed(1)}M</span>}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {['15', '60', '240', 'D'].map(tf => (
               <button 
                 key={tf}
                 onClick={() => setLocalTf(tf)}
                 style={{
                   background: localTf === tf ? 'rgba(0, 255, 136, 0.2)' : 'transparent',
                   color: localTf === tf ? '#00ff88' : '#8b9bb4',
                   border: `1px solid ${localTf === tf ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
                   padding: '2px 8px',
                   borderRadius: '4px',
                   cursor: 'pointer',
                   fontSize: '0.75rem',
                   fontWeight: 'bold',
                   transition: 'all 0.2s'
                 }}
               >
                 {tf === '15' ? '15m' : tf === '60' ? '1H' : tf === '240' ? '4H' : '1D'}
               </button>
            ))}
          </div>
          <div style={{ color: token.priceChangePercent >= 0 ? '#00FF88' : '#FF3B30', fontWeight: 'bold', fontSize: '1rem', background: token.priceChangePercent >= 0 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 59, 48, 0.1)', padding: '4px 10px', borderRadius: '6px', letterSpacing: 'normal' }}>
            {token.priceChangePercent >= 0 ? '↗ +' : '↘ '}{token.priceChangePercent.toFixed(2)}%
          </div>
        </div>
      </div>
  );

  return (
    <div ref={cardRef} style={{ width: '100%', background: '#0f172a', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1rem' }}>
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid rgba(30, 41, 59, 0.5)' }}>
          <Activity size={24} color="#00ff88" className="spin" style={{ marginBottom: '10px' }} />
          <div>Loading {token.symbol}...</div>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 2s linear infinite; }`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {headerContent}
          
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#a855f7', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              <TrendingUp size={16} color="#00d0ff" />
              <span style={{ color: '#fff' }}>Prix (USDT)</span>
            </h3>
            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <SinglePriceChart data={priceData} color="#00d0ff" />
            </div>
          </div>

          <ChartRow 
            title="Force 24H Roulante (Rolling 24H Strength)"
            icon={Activity} 
            type="histogram" 
            formatFunc={formatPercent}
            showZeroCrossLine={true}
            usdtData={usdtStrength} 
            solData={solStrength} 
            btcData={btcStrength} 
          />
        </div>
      )}
    </div>
  );
};
