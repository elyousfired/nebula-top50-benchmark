import React, { useState, useEffect } from 'react';
import { fetchTop500Symbols } from './logic/scanner';
import { TrendingUp, Activity, Flame } from 'lucide-react';

export const TopGainersList = () => {
    const [gainers, setGainers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const runScan = async () => {
            setLoading(true);
            try {
                const allSymbols = await fetchTop500Symbols(true);
                const sorted = allSymbols
                    .filter(t => t.priceChangePercent !== undefined)
                    .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
                    .slice(0, 50); // Top 50 Gainers
                
                if (isMounted) {
                    setGainers(sorted);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error fetching top gainers:", err);
                if (isMounted) setLoading(false);
            }
        };
        
        runScan();
        const interval = setInterval(runScan, 30000); // Refresh every 30s
        return () => { 
            isMounted = false; 
            clearInterval(interval);
        };
    }, []);

    return (
        <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0, 208, 255, 0.2)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <h2 style={{ margin: 0, color: '#00ff88', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', textShadow: '0 0 10px rgba(0, 255, 136, 0.3)' }}>
                    <Flame size={24} color="#00ff88" /> 
                    TOP 50 GAINERS (BYBIT & BINANCE)
                </h2>
                {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    <Activity className="spin" size={16} /> UPDATING...
                </div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                {gainers.length === 0 && !loading && <div style={{ color: '#94a3b8' }}>Aucun token trouvé.</div>}
                
                {gainers.map((t, idx) => (
                    <div key={t.symbol} style={{ 
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(0, 0, 0, 0.5))',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px', 
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)',
                        position: 'relative'
                    }}>
                        <div style={{ position: 'absolute', top: -10, left: -10, background: '#00ff88', color: '#000', fontSize: '0.8rem', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 'bold', boxShadow: '0 0 10px rgba(0,255,136,0.5)' }}>
                            {idx + 1}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '10px' }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff', letterSpacing: '1px' }}>{t.symbol.replace('USDT','')}</span>
                            <div style={{ background: 'rgba(0, 255, 136, 0.2)', color: '#00ff88', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <TrendingUp size={14} /> +{t.priceChangePercent.toFixed(2)}%
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8', paddingLeft: '10px' }}>
                            <span>Price: ${parseFloat(t.lastPrice) < 0.01 ? parseFloat(t.lastPrice).toFixed(6) : parseFloat(t.lastPrice).toFixed(4)}</span>
                            <span>Vol: ${(t.turnover24h / 1000000).toFixed(1)}M</span>
                        </div>
                        <div style={{ paddingLeft: '10px', fontSize: '0.75rem', color: t.exchange === 'binance' ? '#F7931A' : '#3B82F6', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase' }}>
                            {t.exchange}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
