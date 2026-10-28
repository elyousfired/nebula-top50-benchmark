import React, { useState, useMemo } from 'react';
import { Activity, Droplet, DollarSign, BarChart3, AlertTriangle, ExternalLink } from 'lucide-react';
import { fetchDexPoolData } from './logic/dexScreener';

export const DexAnalyticsDashboard = ({ symbols = [] }) => {
    const [results, setResults] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [sortConfig, setSortConfig] = useState({ key: 'liquidityUsd', direction: 'desc' });

    const startScan = async () => {
        setIsScanning(true);
        setResults([]);
        let scanned = [];
        for (let i = 0; i < symbols.length; i++) {
            const data = await fetchDexPoolData(symbols[i].symbol);
            if (data) {
                // Calculate manipulation risk (FDV / Liquidity)
                const manipulationRatio = data.liquidityUsd > 0 ? (data.fdv / data.liquidityUsd) : 0;
                
                scanned.push({ 
                    symbol: symbols[i].symbol, 
                    manipulationRatio,
                    ...data 
                });
                setResults([...scanned]);
            }
            setProgress(Math.floor(((i + 1) / symbols.length) * 100));
            // Rate limit: DexScreener allows 300 req/min. 5 req/sec is safe.
            await new Promise(r => setTimeout(r, 200)); 
        }
        setIsScanning(false);
    };

    const sortedResults = useMemo(() => {
        let sortableItems = [...results];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [results, sortConfig]);

    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const formatMoney = (num) => {
        if (!num) return '$0';
        if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
        return '$' + num.toFixed(2);
    };

    return (
        <div style={{ padding: '20px', color: '#d1d4dc', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#fff', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Droplet color="#00d2ff" /> DEX LIQUIDITY MACHINE
                    </h2>
                    <p style={{ margin: '5px 0 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                        Scan On-Chain pools for {symbols.length} Bybit tokens. Discover the real market depth.
                    </p>
                </div>
                
                <button 
                    onClick={startScan}
                    disabled={isScanning || symbols.length === 0}
                    style={{
                        padding: '12px 24px', background: isScanning ? '#2a2e39' : '#00ff88', 
                        color: isScanning ? '#888' : '#000', border: 'none', borderRadius: '8px',
                        fontWeight: 'bold', fontSize: '14px', cursor: isScanning ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    {isScanning ? <Activity size={16} className="animate-spin" /> : <DollarSign size={16} />}
                    {isScanning ? `SCANNING (${progress}%)` : 'LANCER L\'ANALYSE DEX'}
                </button>
            </div>

            {isScanning && (
                <div style={{ width: '100%', height: '4px', background: '#2a2e39', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: '#00d2ff', transition: 'width 0.2s' }}></div>
                </div>
            )}

            {results.length > 0 && (
                <div style={{ background: '#1a1e29', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <th style={thStyle} onClick={() => requestSort('symbol')}>TOKEN ↕</th>
                                <th style={thStyle} onClick={() => requestSort('chainId')}>CHAIN ↕</th>
                                <th style={thStyle} onClick={() => requestSort('liquidityUsd')}>POOL LIQUIDITY ↕</th>
                                <th style={thStyle} onClick={() => requestSort('volume24h')}>24H VOL (DEX) ↕</th>
                                <th style={thStyle} onClick={() => requestSort('fdv')}>FDV ↕</th>
                                <th style={thStyle} onClick={() => requestSort('manipulationRatio')}>RISK RATIO (FDV/LIQ) ↕</th>
                                <th style={thStyle}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedResults.map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                                    <td style={tdStyle}>
                                        <strong style={{ color: '#fff' }}>{row.symbol}</strong>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px', textTransform: 'uppercase' }}>
                                            {row.chainId}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ color: '#00ff88', fontWeight: 'bold' }}>{formatMoney(row.liquidityUsd)}</div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ color: '#fff' }}>{formatMoney(row.volume24h)}</div>
                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                                            {row.txns24h.buys} Buys / {row.txns24h.sells} Sells
                                        </div>
                                    </td>
                                    <td style={tdStyle}>{formatMoney(row.fdv)}</td>
                                    <td style={tdStyle}>
                                        <div style={{ 
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            color: row.manipulationRatio > 50 ? '#ff3366' : row.manipulationRatio > 20 ? '#ffb800' : '#00d2ff',
                                            fontWeight: 'bold'
                                        }}>
                                            {row.manipulationRatio > 50 && <AlertTriangle size={14} />}
                                            {row.manipulationRatio.toFixed(1)}x
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00d2ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            View <ExternalLink size={14} />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const thStyle = {
    padding: '16px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    userSelect: 'none'
};

const tdStyle = {
    padding: '16px',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.7)'
};
