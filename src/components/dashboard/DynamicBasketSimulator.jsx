import React, { useMemo, useState } from 'react';
import { runDynamicBasketSimulation } from '../../lib/backtester';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { createChart } from 'lightweight-charts';

const DynamicBasketSimulator = ({ pricesMap, globalTimes, tokens }) => {
  const [activeTab, setActiveTab] = useState('usdt');

  const simulation = useMemo(() => {
    if (!pricesMap || !globalTimes || globalTimes.length === 0) return null;
    return runDynamicBasketSimulation(pricesMap, globalTimes, tokens);
  }, [pricesMap, globalTimes, tokens]);

  const chartContainerRef = React.useRef();
  const chartRef = React.useRef();

  React.useEffect(() => {
    if (!simulation || !chartContainerRef.current) return;

    if (!chartRef.current) {
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 350,
            layout: {
                background: { color: 'transparent' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            }
        });
        chartRef.current = chart;
    }

    const chart = chartRef.current;
    
    // Clear old series if they exist
    if (chartRef.current.basketSeries) chart.removeSeries(chartRef.current.basketSeries);
    if (chartRef.current.solSeries) chart.removeSeries(chartRef.current.solSeries);

    const basketSeries = chart.addLineSeries({
        color: '#00d2ff',
        lineWidth: 2,
        title: 'Dynamic Basket',
    });
    const solSeries = chart.addLineSeries({
        color: '#9945FF',
        lineWidth: 2,
        title: 'Buy & Hold SOL',
        lineStyle: 2, // Dashed
    });

    chartRef.current.basketSeries = basketSeries;
    chartRef.current.solSeries = solSeries;

    const basketData = simulation.history.map(h => ({
        time: h.time,
        value: activeTab === 'usdt' ? h.basketValue : h.basketSolBalance
    }));

    const solData = simulation.history.map(h => ({
        time: h.time,
        value: activeTab === 'usdt' ? h.solValue : h.benchmarkSolBalance
    }));

    basketSeries.setData(basketData);
    solSeries.setData(solData);
    
    chart.timeScale().fitContent();

    const handleResize = () => {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, [simulation, activeTab]);

  if (!simulation) {
      return <div style={{ padding: '20px', color: '#94a3b8' }}>Données insuffisantes pour la simulation.</div>;
  }

  const formatUsdt = (v) => `$${v.toFixed(2)}`;
  const formatSol = (v) => `${v.toFixed(2)} SOL`;
  
  const usdtReturn = ((simulation.finalUsdt / 10000) - 1) * 100;
  const benchmarkReturn = ((simulation.benchmarkUsdt / 10000) - 1) * 100;
  
  const solAccumulated = simulation.finalSol - simulation.benchmarkSol;

  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#00d2ff' }}>
          <Activity size={24} /> Dynamic Basket Simulator
        </h2>
        
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '4px' }}>
            <button 
                onClick={() => setActiveTab('usdt')}
                style={{ padding: '6px 15px', background: activeTab === 'usdt' ? '#00d2ff' : 'transparent', color: activeTab === 'usdt' ? '#000' : '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Valeur USDT
            </button>
            <button 
                onClick={() => setActiveTab('sol')}
                style={{ padding: '6px 15px', background: activeTab === 'sol' ? '#9945FF' : 'transparent', color: activeTab === 'sol' ? '#fff' : '#888', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Accumulation SOL
            </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
         <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '5px' }}>Capital Final (Basket)</div>
            <div style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 'bold' }}>{formatUsdt(simulation.finalUsdt)}</div>
            <div style={{ color: usdtReturn >= 0 ? '#10b981' : '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
               {usdtReturn >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {Math.abs(usdtReturn).toFixed(2)}%
            </div>
         </div>
         
         <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(153, 69, 255, 0.2)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '5px' }}>Si HODL SOL (Benchmark)</div>
            <div style={{ fontSize: '1.4rem', color: '#cbd5e1', fontWeight: 'bold' }}>{formatUsdt(simulation.benchmarkUsdt)}</div>
            <div style={{ color: benchmarkReturn >= 0 ? '#10b981' : '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
               {benchmarkReturn >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {Math.abs(benchmarkReturn).toFixed(2)}%
            </div>
         </div>

         <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '5px' }}>Différence en SOL généré</div>
            <div style={{ fontSize: '1.4rem', color: '#10b981', fontWeight: 'bold' }}>+{formatSol(solAccumulated)}</div>
            <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '5px' }}>
               Total: {formatSol(simulation.finalSol)}
            </div>
         </div>
         
         <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '5px' }}>Position Actuelle</div>
            <div style={{ fontSize: '1.4rem', color: '#facc15', fontWeight: 'bold' }}>
               100% {simulation.history.length > 0 ? simulation.history[simulation.history.length - 1].asset : 'USDT'}
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '5px' }}>
               {simulation.trades.length} trades effectués
            </div>
         </div>
      </div>

      <div ref={chartContainerRef} style={{ width: '100%', height: '350px', background: '#0B0E14', borderRadius: '8px', overflow: 'hidden' }} />
      
      <div style={{ marginTop: '20px' }}>
         <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '10px' }}>Historique des dernières rotations (Arbitrage)</h3>
         <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#94a3b8', textAlign: 'left' }}>
               <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                     <th style={{ padding: '8px 12px' }}>Date</th>
                     <th style={{ padding: '8px 12px' }}>Vente</th>
                     <th style={{ padding: '8px 12px' }}>Achat</th>
                     <th style={{ padding: '8px 12px' }}>Valeur (USDT)</th>
                  </tr>
               </thead>
               <tbody>
                  {simulation.trades.slice().reverse().map((t, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '8px 12px' }}>{new Date(t.time * 1000).toLocaleString('fr-FR')}</td>
                        <td style={{ padding: '8px 12px', color: '#ef4444' }}>- {t.from}</td>
                        <td style={{ padding: '8px 12px', color: '#10b981' }}>+ {t.to}</td>
                        <td style={{ padding: '8px 12px' }}>{formatUsdt(t.usdtValue)}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default DynamicBasketSimulator;
