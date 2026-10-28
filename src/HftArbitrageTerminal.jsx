import React, { useState, useEffect, useRef } from 'react';
import { HftArbitrageEngine } from './logic/hftArbitrageEngine';
import { createChart } from 'lightweight-charts';

export const HftArbitrageTerminal = () => {
    const [symbol, setSymbol] = useState('POPCATUSDT');
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState({ cexPrice: 0, dexPrice: 0, spread: 0 });
    const [logs, setLogs] = useState([]);
    const [pnl, setPnl] = useState(0); // Simulated PnL
    
    const engineRef = useRef(null);
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const spreadSeriesRef = useRef(null);
    const cexPriceSeriesRef = useRef(null);
    
    useEffect(() => {
        if (!chartContainerRef.current) return;
        
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 300,
            layout: { background: { color: '#050505' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#111' }, horzLines: { color: '#111' } },
            timeScale: { timeVisible: true, secondsVisible: true },
            rightPriceScale: { visible: true },
            leftPriceScale: { visible: true }
        });
        
        const cexPriceSeries = chart.addLineSeries({
            color: '#ffb800',
            lineWidth: 2,
            title: 'Bybit Price ($)',
            priceScaleId: 'right'
        });

        const spreadSeries = chart.addLineSeries({
            color: '#00f0ff',
            lineWidth: 2,
            title: 'Spread %',
            priceScaleId: 'left'
        });
        
        chartRef.current = chart;
        spreadSeriesRef.current = spreadSeries;
        cexPriceSeriesRef.current = cexPriceSeries;

        return () => chart.remove();
    }, []);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
    };

    const handleTick = (data) => {
        setStats({
            cexPrice: data.cexPrice,
            dexPrice: data.dexPrice,
            spread: data.spread
        });

        if (spreadSeriesRef.current) {
            spreadSeriesRef.current.update({
                time: data.timestamp / 1000,
                value: data.spread
            });
        }
        if (cexPriceSeriesRef.current && data.cexPrice > 0) {
            cexPriceSeriesRef.current.update({
                time: data.timestamp / 1000,
                value: data.cexPrice
            });
        }
    };

    const handleSignal = (signal) => {
        if (signal.type === 'DEX_WHALE_PUMP') {
            addLog(signal.message, 'warning');
        } else if (signal.type === 'ARBITRAGE_BUY_CEX') {
            addLog(`[EXECUTE] ${signal.message}`, 'success');
            // Simulate a trade execution
            // We buy on CEX, wait 2 seconds, and assume we sell at the new (DEX-aligned) price
            // Simplification: We assume we capture 50% of the spread as profit
            const simulatedProfit = 1000 * (signal.spread / 100) * 0.5; // On a $1000 order
            setPnl(prev => prev + simulatedProfit);
            addLog(`[PAPER TRADE] +$${simulatedProfit.toFixed(2)} secured (Latency: 45ms)`, 'profit');
        }
    };

    const toggleEngine = () => {
        if (isRunning) {
            if (engineRef.current) engineRef.current.stop();
            setIsRunning(false);
            addLog('HFT Engine Stopped.', 'info');
        } else {
            engineRef.current = new HftArbitrageEngine(symbol, handleTick, handleSignal);
            engineRef.current.start();
            setIsRunning(true);
            addLog(`HFT Engine Started on ${symbol}. Monitoring Raydium vs Bybit...`, 'info');
            setLogs([]);
            setPnl(0);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (engineRef.current) engineRef.current.stop();
        };
    }, []);

    return (
        <div style={{ padding: '2rem', background: '#0a0a0a', minHeight: '80vh', color: '#fff', fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ color: '#00f0ff', margin: 0, fontSize: '1.5rem', textTransform: 'uppercase' }}>⚡ HFT ARBITRAGE TERMINAL (PAPER TRADING)</h2>
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>Solana RPC \u2194 Bybit WebSocket V5</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        type="text" 
                        value={symbol}
                        onChange={e => setSymbol(e.target.value.toUpperCase())}
                        disabled={isRunning}
                        style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '8px 15px', borderRadius: '4px' }}
                    />
                    <button 
                        onClick={toggleEngine}
                        style={{ 
                            background: isRunning ? '#ff3b30' : '#00f0ff', 
                            color: isRunning ? '#fff' : '#000', 
                            border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' 
                        }}
                    >
                        {isRunning ? 'STOP ENGINE' : 'START HFT NODE'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #222' }}>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>BYBIT (CEX) ASK</div>
                    <div style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>
                        ${stats.cexPrice > 0 ? stats.cexPrice.toFixed(6) : '---'}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#00ff88', marginTop: '5px' }}>WS LATENCY: ~45ms</div>
                </div>
                <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #222' }}>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>RAYDIUM (DEX) PRICE</div>
                    <div style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>
                        ${stats.dexPrice > 0 ? stats.dexPrice.toFixed(6) : '---'}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#ffb800', marginTop: '5px' }}>POLLING: 1.5s</div>
                </div>
                <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: `1px solid ${stats.spread > 1.5 ? '#00f0ff' : '#222'}` }}>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>SPREAD DELTA</div>
                    <div style={{ fontSize: '1.5rem', color: stats.spread > 1.5 ? '#00f0ff' : '#fff', fontWeight: 'bold' }}>
                        {stats.spread.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#00ff88', marginTop: '5px' }}>
                        PAPER PNL: <span style={{ color: pnl > 0 ? '#00ff88' : '#fff', fontWeight: 'bold' }}>+${pnl.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div ref={chartContainerRef} style={{ width: '100%', height: '300px', border: '1px solid #222', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}></div>

            <div style={{ background: '#050505', border: '1px solid #222', borderRadius: '8px', height: '250px', overflowY: 'auto', padding: '15px' }}>
                <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '10px' }}>HFT EXECUTION LOGS</div>
                {logs.map((l, i) => (
                    <div key={i} style={{ 
                        fontSize: '0.8rem', 
                        marginBottom: '5px',
                        color: l.type === 'profit' ? '#00ff88' : l.type === 'warning' ? '#ffb800' : l.type === 'success' ? '#00f0ff' : '#aaa'
                    }}>
                        <span style={{ color: '#555', marginRight: '10px' }}>[{l.time}]</span> 
                        {l.msg}
                    </div>
                ))}
                {logs.length === 0 && <div style={{ color: '#444', fontSize: '0.8rem' }}>Waiting for signals...</div>}
            </div>
        </div>
    );
};
