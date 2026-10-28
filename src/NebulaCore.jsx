import React, { useState, useEffect } from 'react';
import { Eye, Terminal, Activity, Zap, ShieldAlert, CheckCircle, Search, Rocket, BarChart2 } from 'lucide-react';
import { fetchTop500Symbols } from './logic/scanner';
import { runUltimateScan } from './logic/ultimate-engine';

export const NebulaCore = () => {
    const [status, setStatus] = useState('idle'); // idle, scanning, complete
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const [topTokens, setTopTokens] = useState([]);
    const [scanningSymbol, setScanningSymbol] = useState('');

    const addLog = (msg) => {
        setLogs(prev => [...prev.slice(-15), msg]);
    };

    const startScan = async () => {
        setStatus('scanning');
        setProgress(0);
        setLogs([]);
        setTopTokens([]);
        addLog("[SYSTEM] Initialisation de l'Oeil de Nebula...");
        
        try {
            addLog("[SYSTEM] Fetching Top Market Data...");
            const symbols = await fetchTop500Symbols();
            addLog(`[SYSTEM] ${symbols.length} actifs liquides détectés.`);
            addLog("[ENGINE] Lancement de l'Inférence Multi-Modèles (Breakout, Volume, Liquidity, Trend)...");

            const results = await runUltimateScan(symbols, (prog, sym, msg) => {
                setProgress(prog);
                setScanningSymbol(sym);
                if (msg) addLog(`[SCAN] ${msg} -> ${sym}`);
            });

            addLog("[SYSTEM] Scan terminé. Confluence calculée.");
            setTopTokens(results);
            setStatus('complete');

        } catch(e) {
            addLog(`[ERROR] Erreur système: ${e.message}`);
            setStatus('idle');
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#e2e8f0', fontFamily: '"JetBrains Mono", monospace' }}>
            
            {status === 'idle' && (
                <div style={{ textAlign: 'center', marginTop: '10vh' }}>
                    <div style={{ 
                        width: '150px', height: '150px', margin: '0 auto 2rem', 
                        borderRadius: '50%', background: 'rgba(0, 240, 255, 0.05)', 
                        border: '2px solid rgba(0, 240, 255, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 50px rgba(0, 240, 255, 0.1)',
                        animation: 'pulse 3s infinite'
                    }}>
                        <Eye size={80} color="#00f0ff" />
                    </div>
                    
                    <h1 style={{ fontSize: '3rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#fff', textShadow: '0 0 20px rgba(0, 240, 255, 0.5)' }}>L'ŒIL DE NEBULA</h1>
                    <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: '800px', margin: '0 auto 3rem', lineHeight: '1.6' }}>
                        Activez l'Intelligence Globale. Ce module va scanner tout le marché, croiser les algorithmes de Breakout, de Flux Institutionnel et de Liquidité pour trouver la Confluence Absolue.
                    </p>
                    
                    <button onClick={startScan} style={{
                        background: 'linear-gradient(90deg, rgba(0,240,255,0.2) 0%, rgba(139,92,246,0.2) 100%)',
                        border: '1px solid #00f0ff',
                        padding: '1.5rem 4rem',
                        color: '#fff',
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        boxShadow: '0 0 30px rgba(0, 240, 255, 0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <Zap size={20} style={{ display: 'inline', marginRight: '10px', verticalAlign: 'middle' }}/> 
                        Démarrer L'Inférence Globale
                    </button>
                </div>
            )}

            {status === 'scanning' && (
                <div style={{ marginTop: '5vh' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ color: '#00f0ff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Activity className="spin-slow" /> SCANNING MULTI-DIMENSIONNEL...
                        </h2>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{progress}%</div>
                    </div>
                    
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '2rem' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: '#00f0ff', boxShadow: '0 0 10px #00f0ff', transition: 'width 0.2s' }}></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        {/* Fake UI for modules */}
                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                            <h3 style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>MODULES EN COURS</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00f0ff' }}>▶ Liquidity Engine</span> <span style={{ color: '#4ade80' }}>ACTIF</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00f0ff' }}>▶ Breakout Scanner</span> <span style={{ color: '#4ade80' }}>ACTIF</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00f0ff' }}>▶ Trend Matrix</span> <span style={{ color: '#4ade80' }}>ACTIF</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#00f0ff' }}>▶ Flow Intensity</span> <span style={{ color: '#4ade80' }}>ACTIF</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                    <span style={{ color: '#cbd5e1' }}>Cible Actuelle:</span> <strong style={{ color: '#fff', fontSize: '1.2rem' }}>{scanningSymbol}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Logs Terminal */}
                        <div style={{ background: '#020617', border: '1px solid #1e293b', padding: '1.5rem', borderRadius: '12px', height: '300px', overflowY: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            {logs.map((log, i) => (
                                <div key={i} style={{ color: log.includes('ERROR') ? '#ef4444' : log.includes('SYSTEM') ? '#8b5cf6' : '#00f0ff', fontSize: '0.85rem', marginBottom: '6px', opacity: 0.5 + (i/logs.length)*0.5 }}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {status === 'complete' && (
                <div style={{ animation: 'fadeIn 1s ease' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <CheckCircle size={60} color="#4ade80" style={{ margin: '0 auto 1rem' }} />
                        <h2 style={{ fontSize: '2.5rem', color: '#fff', margin: 0, textShadow: '0 0 20px rgba(74, 222, 128, 0.4)' }}>RÉSULTAT DE LA CONFLUENCE</h2>
                        <p style={{ color: '#94a3b8' }}>Les 3 actifs présentant la structure algorithmique la plus parfaite du marché actuellement.</p>
                        <button onClick={() => setStatus('idle')} style={{ marginTop: '1.5rem', background: 'transparent', border: '1px solid #64748b', color: '#cbd5e1', padding: '0.5rem 2rem', borderRadius: '8px', cursor: 'pointer' }}>Relancer un scan</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        {topTokens.map((t, idx) => (
                            <div key={idx} style={{ 
                                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(2, 6, 23, 0.9) 100%)', 
                                border: `1px solid ${idx === 0 ? '#fbbf24' : idx === 1 ? '#cbd5e1' : '#b45309'}`, 
                                borderRadius: '16px', 
                                padding: '2rem',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: `0 0 30px ${idx === 0 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(0,0,0,0)'}`
                            }}>
                                {/* Badge Rang */}
                                <div style={{ position: 'absolute', top: 0, right: 0, background: idx === 0 ? '#fbbf24' : idx === 1 ? '#cbd5e1' : '#b45309', color: '#000', padding: '0.5rem 1.5rem', fontWeight: 'bold', borderBottomLeftRadius: '16px' }}>
                                    TOP {idx + 1}
                                </div>
                                
                                <h3 style={{ fontSize: '2rem', color: '#fff', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {t.symbol.replace('USDT', '')}
                                </h3>
                                
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: idx === 0 ? '#fbbf24' : '#fff', marginBottom: '2rem' }}>
                                    {t.score}<span style={{ fontSize: '1rem', color: '#64748b' }}>/100</span>
                                </div>

                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Signaux de Confluence :</div>
                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#e2e8f0', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {t.reasons.map((r, i) => (
                                            <li key={i}>{r}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div style={{ borderLeft: '3px solid #00f0ff', paddingLeft: '1rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#00f0ff', fontWeight: 'bold', marginBottom: '4px' }}>PAIRE RECOMMANDÉE : {t.symbol.replace('USDT', '')}/{t.recommendedPair}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.4' }}>{t.pairReason}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes pulse {
                    0% { box-shadow: 0 0 20px rgba(0, 240, 255, 0.2); }
                    50% { box-shadow: 0 0 60px rgba(0, 240, 255, 0.6); }
                    100% { box-shadow: 0 0 20px rgba(0, 240, 255, 0.2); }
                }
                .spin-slow {
                    animation: spin 3s linear infinite;
                }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}} />
        </div>
    );
};
