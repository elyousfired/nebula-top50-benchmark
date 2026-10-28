import React, { useState, useEffect } from 'react';
import { fetchTop500Symbols, fetchBybitData, fetchDailyMacro, calculateNebulaLogic, calculateVolumeProfile } from './logic/scanner';
import VolumeProfileChart from './VolumeProfileChart';
import { detectBreakoutResistance, BreakoutChartItem } from './BreakoutScanner'; 
import { TradingViewChart } from './App';
import { computeNetFlow24h, TokenChartCard } from './VwapPullbackScanner';
import { Activity, Target, Zap, Rocket, Bell, ExternalLink, X, Maximize, Crosshair } from 'lucide-react';
import Sidebar from './components/dashboard/Sidebar';
import Header from './components/dashboard/Header';
import FiltersBar from './components/dashboard/FiltersBar';
import { SignalColumn } from './components/dashboard/SignalColumn';
import { MarketOverview } from './components/dashboard/MarketOverview';
import { SignalSummary } from './components/dashboard/SignalSummary';
import { MarketHeatmap } from './components/dashboard/MarketHeatmap';
import { SystemStatus } from './components/dashboard/SystemStatus';

export const NotificationDashboard = ({ onOpenChart }) => {
    const [notifications, setNotifications] = useState([]);
    const [scanning, setScanning] = useState(true);
    const [hoveredAlert, setHoveredAlert] = useState(null);
    const [zoomedAlert, setZoomedAlert] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const scanMarket = async () => {
            setScanning(true);
            const allSymbols = await fetchTop500Symbols();
            const topSymbols = allSymbols.slice(0, 150); // Scan top 150
            
            const newAlerts = [];
            
            for(let i=0; i<topSymbols.length; i+=10) {
                const batch = topSymbols.slice(i, i+10);
                const promises = batch.map(async (t) => {
                    try {
                        const alerts = [];
                        
                        // 1. Fetch data once
                        const macroData = await fetchDailyMacro(t.symbol);
                        const klines1D = macroData ? macroData.klines : null;
                        
                        if (macroData && macroData.cupPattern) {
                            const p = macroData.cupPattern;
                            // Loosen filter to match the scanner base threshold (-15% to +10%)
                            if (p.breakoutPercent >= -15 && p.breakoutPercent <= 10) {
                                alerts.push({
                                    id: `macro-${t.symbol}`,
                                    type: 'MACRO_PARABOLIC',
                                    symbol: t.symbol,
                                    title: 'PARABOLIC RECOVERY (1D)',
                                    message: `Distance to old high: ${p.breakoutPercent.toFixed(2)}%`,
                                    time: new Date(),
                                    klines: p.klines, // Uses formatted klines inside cupPattern
                                    resistance: p.oldHigh,
                                    patternData: p,
                                    color: '#ffb800',
                                    icon: <Rocket size={20} color="#ffb800" />
                                });
                            }
                        }

                        // 2. BREAKOUT SCANNER Alert
                        if (klines1D && typeof detectBreakoutResistance === 'function') {
                            const breakoutData = detectBreakoutResistance(klines1D);
                            if (breakoutData && breakoutData.resistance) {
                                const nearest = breakoutData.resistance;
                                if (nearest.distance <= 5 && nearest.distance > 0) { // Within 5% of resistance
                                    alerts.push({
                                        id: `breakout-${t.symbol}`,
                                        type: 'HORIZONTAL_BREAKOUT',
                                        symbol: t.symbol,
                                        title: 'RESISTANCE BREAKOUT',
                                        message: `Approaching resistance at $${nearest.level.toFixed(4)} (Distance: ${nearest.distance.toFixed(2)}%)`,
                                        time: new Date(),
                                        klines: breakoutData.formattedKlines,
                                        resistance: nearest.level,
                                        breakoutData: { ...breakoutData, symbol: t.symbol },
                                        color: '#00d0ff',
                                        icon: <Target size={20} color="#00d0ff" />
                                    });
                                }
                            }
                        }

                        // 3. VWAP BREAKOUT Alert
                        const klines15m = await fetchBybitData(t.symbol, '15', 500);
                        if (klines15m && klines15m.length >= 50) {
                            const logic = calculateNebulaLogic(klines15m);
                            const prevVwap = logic.yesterdayMax;
                            if (prevVwap && prevVwap > 0) {
                                const currentPrice = parseFloat(klines15m[0][4]);
                                const gap = ((currentPrice - prevVwap) / prevVwap) * 100;
                                
                                // VWAP filter: prix entre -2% et +2% du VWAP Max (breakout ou retest)
                                if (gap >= -2 && gap <= 2) {
                                    // Net Flow + Volume check over last 24h
                                    const nf = computeNetFlow24h(klines15m);
                                    if (nf && nf.netFlowIncreasing && nf.volumeIncreasing) {
                                        alerts.push({
                                            id: `vwap-${t.symbol}`,
                                            type: 'VWAP_BREAKOUT',
                                            symbol: t.symbol,
                                            title: 'VWAP BREAKOUT RADAR',
                                            message: `${Math.abs(gap).toFixed(2)}% du VWAP Max`,
                                            time: new Date(),
                                            vwapToken: {
                                                symbol: t.symbol,
                                                currentPrice,
                                                prevVwap,
                                                gap,
                                                netFlowTotal: nf.netFlowTotal,
                                                netFlowIncreasing: nf.netFlowIncreasing,
                                                volumeTotal: nf.volumeTotal,
                                                volumeIncreasing: nf.volumeIncreasing
                                            },
                                            color: '#00d2ff',
                                            icon: <Crosshair size={20} color="#00d2ff" />
                                        });
                                    }
                                }
                            }
                        }

                        // 4. POC PROXIMITY Alert
                        if (klines15m && klines15m.length >= 50) {
                            const vpData = calculateVolumeProfile(klines15m);
                            if (vpData) {
                                // Proche du POC (±2.5%)
                                if (Math.abs(vpData.distancePoc) <= 2.5) {
                                    alerts.push({
                                        id: `poc-${t.symbol}`,
                                        type: 'POC_PROXIMITY',
                                        symbol: t.symbol,
                                        title: 'POC PROXIMITY',
                                        message: `Distance au POC: ${Math.abs(vpData.distancePoc).toFixed(2)}%`,
                                        time: new Date(),
                                        vpData: {
                                            symbol: t.symbol,
                                            ...vpData
                                        },
                                        color: '#F7931A',
                                        icon: <Target size={20} color="#F7931A" />
                                    });
                                }
                            }
                        }
                        return alerts;
                    } catch(e) {
                        return [];
                    }
                });
                
                const batchRes = await Promise.all(promises);
                batchRes.flat().forEach(a => newAlerts.push(a));
            }

            if(isMounted) {
                setNotifications(prev => {
                    const combined = [...newAlerts, ...prev];
                    const unique = [];
                    const seen = new Set();
                    combined.forEach(a => {
                        const key = a.id;
                        if(!seen.has(key)) {
                            seen.add(key);
                            unique.push(a);
                        }
                    });
                    return unique.sort((a,b) => b.time - a.time).slice(0, 50); // Keep last 50
                });
                setScanning(false);
            }
        };

        scanMarket();
        const interval = setInterval(scanMarket, 300000); // 5 mins
        return () => { isMounted = false; clearInterval(interval); };
    }, []);

    return (
        <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#05080C', color: '#fff', overflow: 'hidden' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                <Header />
                <FiltersBar />
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', alignItems: 'stretch', minHeight: '400px', height: '100%' }}>
                        <SignalColumn 
                          title="RESISTANCE BREAKOUTS" 
                          icon={<Target />} 
                          color="#00d0ff" 
                          count={12} 
                          alerts={notifications.filter(a => a.type === 'HORIZONTAL_BREAKOUT')} 
                          type="HORIZONTAL_BREAKOUT"
                          hoveredAlert={hoveredAlert}
                          setHoveredAlert={setHoveredAlert}
                          onZoom={setZoomedAlert}
                          renderHoverChart={(alert) => <BreakoutChartItem data={alert.breakoutData} timeframe="1D" />}
                        />
                        <SignalColumn 
                          title="MACRO PARABOLIC (1D)" 
                          icon={<Rocket />} 
                          color="#ffb800" 
                          count={10} 
                          alerts={notifications.filter(a => a.type === 'MACRO_PARABOLIC')} 
                          type="MACRO_PARABOLIC"
                          hoveredAlert={hoveredAlert}
                          setHoveredAlert={setHoveredAlert}
                          onZoom={setZoomedAlert}
                          renderHoverChart={(alert) => <TradingViewChart symbol={alert.symbol} initialTrajectory={alert.patternData.klines} initialTimeframe="D" hideControls={true} hh={alert.patternData.oldHigh} livePrice={alert.patternData.currentPrice} parabolaCurve={alert.patternData.parabolaCurve} />}
                        />
                        <SignalColumn 
                          title="VWAP BREAKOUT RADAR" 
                          icon={<Crosshair />} 
                          color="#00d0ff" 
                          count={8} 
                          alerts={notifications.filter(a => a.type === 'VWAP_BREAKOUT')} 
                          type="VWAP_BREAKOUT"
                          hoveredAlert={hoveredAlert}
                          setHoveredAlert={setHoveredAlert}
                          onZoom={setZoomedAlert}
                          renderHoverChart={(alert) => <TokenChartCard token={alert.vwapToken} isModal={true} />}
                        />
                        <SignalColumn 
                          title="POC PROXIMITY" 
                          icon={<Target />} 
                          color="#F7931A" 
                          count={10} 
                          alerts={notifications.filter(a => a.type === 'POC_PROXIMITY')} 
                          type="POC_PROXIMITY"
                          hoveredAlert={hoveredAlert}
                          setHoveredAlert={setHoveredAlert}
                          onZoom={setZoomedAlert}
                          renderHoverChart={(alert) => <VolumeProfileChart profileResults={alert.vpData} />}
                        />
                    </div>
                    
                    {/* BOTTOM WIDGETS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginTop: '15px', minHeight: '220px' }}>
                        <MarketOverview />
                        <SignalSummary notifications={notifications} />
                        <MarketHeatmap />
                        <SystemStatus />
                    </div>
                </div>

            {zoomedAlert && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                    <div style={{ width: '85vw', height: '85vh', background: '#0a1a21', borderRadius: '24px', position: 'relative', border: `2px solid ${zoomedAlert.color}50`, overflow: 'hidden', boxShadow: `0 0 100px ${zoomedAlert.color}30` }}>
                        <button 
                            onClick={() => setZoomedAlert(null)}
                            style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 100001, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'background 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            <X size={24} />
                        </button>
                        <div style={{ position: 'absolute', top: '15px', left: '25px', zIndex: 100001, display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.8rem', fontWeight: '900' }}>{zoomedAlert.symbol}</h2>
                            <span style={{ background: `${zoomedAlert.color}20`, color: zoomedAlert.color, padding: '5px 12px', borderRadius: '8px', fontWeight: 'bold' }}>{zoomedAlert.title}</span>
                            <span style={{ color: '#94a3b8', fontSize: '1rem' }}>{zoomedAlert.message}</span>
                        </div>
                        <div style={{ width: '100%', height: '100%', paddingTop: '70px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px' }}>
                            {zoomedAlert.type === 'HORIZONTAL_BREAKOUT' && (
                                <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
                                   <BreakoutChartItem data={zoomedAlert.breakoutData} timeframe="1D" />
                                </div>
                            )}
                            {zoomedAlert.type === 'MACRO_PARABOLIC' && (
                                <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
                                    <TradingViewChart 
                                        symbol={zoomedAlert.symbol} 
                                        initialTrajectory={zoomedAlert.patternData.klines} 
                                        initialTimeframe="D" 
                                        hideControls={true}
                                        hh={zoomedAlert.patternData.oldHigh}
                                        livePrice={zoomedAlert.patternData.currentPrice}
                                        parabolaCurve={zoomedAlert.patternData.parabolaCurve}
                                    />
                                </div>
                            )}
                            {zoomedAlert.type === 'VWAP_BREAKOUT' && (
                                <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
                                    <TokenChartCard token={zoomedAlert.vwapToken} isModal={true} />
                                </div>
                            )}
                            {zoomedAlert.type === 'POC_PROXIMITY' && (
                                <div style={{ height: '100%', width: '100%', display: 'flex', gap: '20px' }}>
                                    <div style={{ flex: 1, borderRadius: '16px', background: '#0a0a0f', border: `1px solid ${zoomedAlert.color}50`, overflow: 'hidden' }}>
                                        <VolumeProfileChart profileResults={zoomedAlert.vpData} />
                                    </div>
                                    <div style={{ width: '350px', borderRadius: '16px', background: '#0a0a0f', border: `1px solid ${zoomedAlert.color}50`, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Target size={20} color="#F7931A" />
                                            VP SESSION METRICS
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#050508', borderRadius: '8px', border: '1px solid #101016' }}>
                                                <span style={{ color: '#555', fontSize: '0.8rem', fontWeight: 'bold' }}>POINT OF CONTROL</span>
                                                <span style={{ color: '#F7931A', fontSize: '1rem', fontWeight: '900' }}>${zoomedAlert.vpData.pocPrice.toFixed(4)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#050508', borderRadius: '8px', border: '1px solid #101016' }}>
                                                <span style={{ color: '#555', fontSize: '0.8rem', fontWeight: 'bold' }}>VALUE AREA HIGH</span>
                                                <span style={{ color: '#fff', fontSize: '1rem', fontWeight: '900' }}>${zoomedAlert.vpData.vah.toFixed(4)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#050508', borderRadius: '8px', border: '1px solid #101016' }}>
                                                <span style={{ color: '#555', fontSize: '0.8rem', fontWeight: 'bold' }}>VALUE AREA LOW</span>
                                                <span style={{ color: '#fff', fontSize: '1rem', fontWeight: '900' }}>${zoomedAlert.vpData.val.toFixed(4)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#050508', borderRadius: '8px', border: '1px solid #101016', marginTop: '10px' }}>
                                                <span style={{ color: '#555', fontSize: '0.8rem', fontWeight: 'bold' }}>INTRADAY VOLUME</span>
                                                <span style={{ color: '#00ff88', fontSize: '1rem', fontWeight: '900' }}>{Math.round(zoomedAlert.vpData.dayVolume).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};
