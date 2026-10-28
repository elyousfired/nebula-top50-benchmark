import React, { useState, useEffect, useRef } from 'react';
import { fetchSwingDivergenceData } from './logic/swingDivergenceEngine';
import { createChart } from 'lightweight-charts';
import { Search, Activity, Target, Radar } from 'lucide-react';

export const SwingDivergenceTerminal = () => {
    const [symbol, setSymbol] = useState('POPCATUSDT');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    
    // Global Scan State
    const [isGlobalScanning, setIsGlobalScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
    const [opportunities, setOpportunities] = useState([]);
    
    // Auto-Radar State
    const [isAutoRadar, setIsAutoRadar] = useState(false);
    const autoRadarRef = useRef(false);
    const [nextScanCountdown, setNextScanCountdown] = useState(0);

    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => { autoRadarRef.current = false; };
    }, []);

    const scanSymbol = async () => {
        setLoading(true);
        setError('');
        setData(null);
        setOpportunities([]);
        try {
            const res = await fetchSwingDivergenceData(symbol);
            if (!res) throw new Error("Could not fetch data or calculate divergence.");
            setData(res);
            renderChart(res);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    const toggleAutoRadar = () => {
        if (autoRadarRef.current) {
            autoRadarRef.current = false;
            setIsAutoRadar(false);
            setNextScanCountdown(0);
        } else {
            autoRadarRef.current = true;
            setIsAutoRadar(true);
            runAutoRadarLoop();
        }
    };

    const runAutoRadarLoop = async () => {
        while (autoRadarRef.current) {
            await scanMarket();
            
            if (!autoRadarRef.current) break;

            // Wait 60 secondes avant le prochain scan
            let countdown = 60;
            while (countdown > 0 && autoRadarRef.current) {
                setNextScanCountdown(countdown);
                await new Promise(r => setTimeout(r, 1000));
                countdown--;
            }
            setNextScanCountdown(0);
        }
    };

    const scanMarket = async () => {
        setIsGlobalScanning(true);
        setOpportunities([]);
        setData(null);
        setError('');
        
        try {
            // 1. Fetch Top Bybit Spot Tickers
            const bybitRes = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
            const bybitData = await bybitRes.json();
            if (!bybitData?.result?.list) throw new Error("Failed to fetch Bybit tickers");

            // Filter USDT pairs and sort by volume (turnover24h)
            let tickers = bybitData.result.list
                .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('USDC'))
                .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h));
            
            // Take Top 60 to scan (which will naturally filter out non-Solana tokens)
            tickers = tickers.slice(0, 60);
            setScanProgress({ current: 0, total: tickers.length });

            const BATCH_SIZE = 3;
            const validOpps = [];

            for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
                const batch = tickers.slice(i, i + BATCH_SIZE);
                
                const promises = batch.map(t => fetchSwingDivergenceData(t.symbol));
                const results = await Promise.all(promises);

                results.forEach(res => {
                    if (res && res.signal === 'BUY_OPPORTUNITY') {
                        validOpps.push(res);
                        // Update state progressively so user sees them appear live
                        setOpportunities(prev => [...prev, res]);
                    }
                });

                setScanProgress(prev => ({ ...prev, current: Math.min(i + BATCH_SIZE, tickers.length) }));
                
                // Sleep 1.5 seconds to avoid rate limiting from GeckoTerminal/DexScreener
                if (i + BATCH_SIZE < tickers.length) {
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

            if (validOpps.length === 0) {
                setError("Scan completed. No 15M Swing Arbitrage opportunities found on Solana tokens right now.");
            }

        } catch (err) {
            setError(err.message);
        }
        
        setIsGlobalScanning(false);
    };

    const renderChart = (res) => {
        if (!chartContainerRef.current) return;
        
        if (chartRef.current) {
            chartRef.current.remove();
        }

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 350,
            layout: { background: { color: '#050505' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#111' }, horzLines: { color: '#111' } },
            timeScale: { timeVisible: true }
        });

        const cexSeries = chart.addLineSeries({
            color: '#ffb800',
            lineWidth: 2,
            title: 'Bybit 15m Price'
        });

        const dexSeries = chart.addLineSeries({
            color: '#00f0ff',
            lineWidth: 2,
            title: 'Raydium 15m Price'
        });

        const formatData = (klines) => klines.map(k => ({
            time: k.timestamp / 1000,
            value: k.close
        }));

        cexSeries.setData(formatData(res.cexKlines));
        dexSeries.setData(formatData(res.dexKlines));

        chart.timeScale().fitContent();
        chartRef.current = chart;
    };

    return (
        <div style={{ padding: '2rem', background: '#0a0a0a', minHeight: '80vh', color: '#fff', fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ color: '#00f0ff', margin: 0, fontSize: '1.5rem', textTransform: 'uppercase' }}>🔭 15M DIVERGENCE SCANNER (SWING)</h2>
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>Macro Trend Arbitrage | GeckoTerminal \u2194 Bybit API</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={toggleAutoRadar}
                        disabled={loading && !isAutoRadar}
                        style={{ 
                            background: isAutoRadar ? '#ff3b30' : '#b388ff', 
                            color: isAutoRadar ? '#fff' : '#000', 
                            border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' 
                        }}
                    >
                        {isAutoRadar 
                            ? (isGlobalScanning ? `SCANNING (${scanProgress.current}/${scanProgress.total})` : `WAITING... ${nextScanCountdown}s`) 
                            : <><Radar size={16} style={{ verticalAlign: 'middle', marginRight: '5px'}}/> START AUTO-RADAR</>}
                    </button>
                    
                    <div style={{ width: '1px', background: '#333', margin: '0 10px' }}></div>
                    
                    <input 
                        type="text" 
                        value={symbol}
                        onChange={e => setSymbol(e.target.value.toUpperCase())}
                        disabled={isGlobalScanning || isAutoRadar}
                        style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '8px 15px', borderRadius: '4px' }}
                    />
                    <button 
                        onClick={scanSymbol}
                        disabled={loading || isGlobalScanning || isAutoRadar}
                        style={{ 
                            background: '#00f0ff', 
                            color: '#000', 
                            border: 'none', padding: '8px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' 
                        }}
                    >
                        {loading ? 'SCANNING...' : <><Search size={16} style={{ verticalAlign: 'middle', marginRight: '5px'}}/> SINGLE SCAN</>}
                    </button>
                </div>
            </div>

            {error && <div style={{ color: '#ff3b30', padding: '10px', background: '#220000', border: '1px solid #ff3b30', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

            {/* PROGRESS BAR FOR GLOBAL SCAN */}
            {isGlobalScanning && (
                <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #333', marginBottom: '20px' }}>
                    <div style={{ color: '#00ff88', fontSize: '0.8rem', marginBottom: '10px' }}>
                        📡 Interrogation des APIs (Bybit, DexScreener, GeckoTerminal) en cours. Filtrage des jetons Solana...
                    </div>
                    <div style={{ width: '100%', height: '4px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%`, height: '100%', background: '#b388ff', transition: 'width 0.3s' }}></div>
                    </div>
                </div>
            )}

            {/* OPPORTUNITIES BOARD (GLOBAL SCAN RESULTS) */}
            {opportunities.length > 0 && !data && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ color: '#00ff88', margin: '0 0 15px 0' }}>🎯 OPPORTUNITÉS DÉTECTÉES ({opportunities.length})</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                        {opportunities.map((opp, idx) => (
                            <div key={idx} style={{ background: '#002211', padding: '15px', borderRadius: '8px', border: '1px solid #00ff88', boxShadow: '0 0 15px rgba(0, 255, 136, 0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{opp.symbol}</strong>
                                    <button 
                                        onClick={() => { setSymbol(opp.symbol); scanSymbol(); }}
                                        style={{ background: '#00ff88', color: '#000', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        AFFICHER GRAPH
                                    </button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888', marginBottom: '10px' }}>
                                    <div>DEX MOMENTUM: <span style={{color: '#00ff88'}}>+{opp.dexMomentum.toFixed(2)}%</span></div>
                                    <div>CEX MOMENTUM: <span style={{color: opp.cexMomentum > 0 ? '#00ff88' : '#ff3b30'}}>{opp.cexMomentum > 0 ? '+' : ''}{opp.cexMomentum.toFixed(2)}%</span></div>
                                </div>
                                <div style={{ borderTop: '1px solid #113322', paddingTop: '10px', fontSize: '0.8rem' }}>
                                    PRIX BYBIT ACTUEL : <strong style={{color: '#ffb800'}}>${opp.currentCexPrice.toFixed(4)}</strong><br/>
                                    PRIX ATTENDU : <strong style={{color: '#00ff88'}}>${opp.expectedPrice.toFixed(4)}</strong>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SINGLE TOKEN VIEW */}
            {data && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #222' }}>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}><Activity size={12}/> DEX MOMENTUM (15M)</div>
                        <div style={{ fontSize: '1.5rem', color: data.dexMomentum > 0 ? '#00ff88' : '#ff3b30', fontWeight: 'bold' }}>
                            {data.dexMomentum > 0 ? '+' : ''}{data.dexMomentum.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '5px' }}>Dernières 3 Heures</div>
                    </div>
                    <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #222' }}>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}><Activity size={12}/> CEX MOMENTUM (15M)</div>
                        <div style={{ fontSize: '1.5rem', color: data.cexMomentum > 0 ? '#00ff88' : '#ff3b30', fontWeight: 'bold' }}>
                            {data.cexMomentum > 0 ? '+' : ''}{data.cexMomentum.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '5px' }}>Dernières 3 Heures</div>
                    </div>
                    
                    <div style={{ 
                        background: data.signal === 'BUY_OPPORTUNITY' ? '#002211' : '#111', 
                        padding: '15px', borderRadius: '8px', 
                        border: `1px solid ${data.signal === 'BUY_OPPORTUNITY' ? '#00ff88' : '#222'}`,
                        boxShadow: data.signal === 'BUY_OPPORTUNITY' ? '0 0 15px rgba(0, 255, 136, 0.2)' : 'none'
                    }}>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}><Target size={12}/> OPPORTUNITÉ D'ARBITRAGE</div>
                        <div style={{ fontSize: '1.2rem', color: data.signal === 'BUY_OPPORTUNITY' ? '#00ff88' : '#fff', fontWeight: 'bold' }}>
                            {data.signal === 'BUY_OPPORTUNITY' ? '🟢 BUY SIGNAL DETECTED' : '⚪ NEUTRAL'}
                        </div>
                        {data.signal === 'BUY_OPPORTUNITY' && (
                            <div style={{ fontSize: '0.8rem', color: '#fff', marginTop: '10px' }}>
                                PRIX ACTUEL : <span style={{color: '#ffb800'}}>${data.currentCexPrice.toFixed(4)}</span><br/>
                                PRIX ATTENDU : <span style={{color: '#00ff88'}}>${data.expectedPrice.toFixed(4)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div ref={chartContainerRef} style={{ width: '100%', height: '350px', border: '1px solid #222', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', background: '#050505', display: data ? 'block' : 'none' }}></div>
            
            {data && (
                 <div style={{ background: '#050505', border: '1px solid #222', borderRadius: '8px', padding: '15px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '10px' }}>ANALYSE ALGORITHMIQUE</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa', lineHeight: '1.5' }}>
                        L'algorithme compare la tendance Macro sur 15 minutes entre le DEX Solana (Raydium/Orca) et Bybit. 
                        La divergence de momentum est actuellement de <strong style={{color: data.divergence > 2 ? '#00ff88' : '#fff'}}>{data.divergence.toFixed(2)}%</strong>.
                        {data.signal === 'BUY_OPPORTUNITY' 
                            ? " Le DEX mène la danse de manière agressive. Bybit est en retard, ce qui crée une forte probabilité de rattrapage haussier à court terme." 
                            : " Les deux marchés sont globalement synchronisés ou la divergence n'est pas suffisante pour garantir un ratio Risque/Rendement optimal."}
                    </div>
                 </div>
            )}
        </div>
    );
};
