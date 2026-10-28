import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldAlert, Plus, Activity } from 'lucide-react';
import { fetchSolSwitchSnapshot, analyzeSnapshot } from './logic/solSwitchEngine';
import SolSwitchSimulator from './SolSwitchSimulator';
import SolSwitchBacktest from './SolSwitchBacktest';
import SolSwitchAlerts from './SolSwitchAlerts';
import SolSwitchJournal from './SolSwitchJournal';
const MetricCard = ({ title, value, detail, tone }) => {
  let color = '#fff';
  if (tone === 'good') color = '#00ff88';
  if (tone === 'bad') color = '#ff3b30';
  if (tone === 'warn') color = '#facc15';

  return (
    <div className="metric-card">
      <div className="metric-title">{title}</div>
      <div className="metric-value" style={{ color }}>{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
};

const SolSwitchRadar = () => {
  const [activeTab, setActiveTab] = useState('radar');
  const [symbols, setSymbols] = useState(["WIF", "POPCAT", "BONK", "BOME", "MEW", "JUP"]);
  const [newSymbol, setNewSymbol] = useState("");
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(symbols.map(async (sym) => {
        const snap = await fetchSolSwitchSnapshot(sym);
        return analyzeSnapshot(snap);
      }));
      setAnalyses(results);
    } catch (e) {
      console.error("Failed to load sol switch data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [symbols]);

  const addSymbol = () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol || symbols.includes(symbol)) return;
    setSymbols([...symbols, symbol]);
    setNewSymbol("");
  };

  const best = [...analyses].filter(a => a.snapshot.listed).sort((a, b) => b.recommendation.score - a.recommendation.score)[0];
  const clean = best?.recommendation.approved && best.recommendation.score >= 65;
  const bestAction = clean ? best.recommendation.action : "Stay in SOL";

  const formatPercent = (val) => {
    if (val === null || val === undefined) return "N/A";
    const color = val > 0 ? '#00ff88' : val < 0 ? '#ff3b30' : '#888';
    return <span style={{ color, fontWeight: 'bold' }}>{val > 0 ? '+' : ''}{val.toFixed(2)}%</span>;
  };

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

  const rows = [...analyses].sort((a, b) => b.recommendation.score - a.recommendation.score);

  return (
    <div className="sol-switch-container">
      <div className="sol-switch-nav">
        {['radar', 'simulator', 'backtest', 'alerts', 'journal'].map(tab => (
          <button 
            key={tab} 
            className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'simulator' && <SolSwitchSimulator />}
      {activeTab === 'backtest' && <SolSwitchBacktest />}
      {activeTab === 'alerts' && <SolSwitchAlerts />}
      {activeTab === 'journal' && <SolSwitchJournal />}

      {activeTab === 'radar' && (
        <div className="radar-content">
          <div className="sol-switch-header">
            <div className="header-text">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity color="#00ff88" /> SOL Switch Radar
          </h2>
          <p>Compare tokens against SOL first, then score whether a temporary rotation has enough relative strength to survive costs, liquidity, and risk.</p>
        </div>
        
        <div className="controls">
          <input 
            type="text" 
            value={newSymbol} 
            onChange={(e) => setNewSymbol(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
            placeholder="Add symbol, e.g. WIF" 
          />
          <button onClick={addSymbol}><Plus size={16} /></button>
          <button onClick={loadData} disabled={loading} className="refresh-btn">
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="symbols-list">
        {symbols.map(sym => <span key={sym} className="symbol-chip">{sym}</span>)}
      </div>

      <div className="metrics-grid">
        <MetricCard title="Best Action Now" value={loading ? "Scanning..." : bestAction} detail={clean ? "Critical pre-switch conditions are currently passing." : "Switch not approved unless TOKEN/SOL strength and risk filters improve."} tone={clean ? "good" : "warn"} />
        <MetricCard title="Best Candidate" value={best?.profile.symbol ?? "None"} detail={best?.recommendation.mainReason ?? "No clean setup beats SOL after costs."} tone={clean ? "good" : "neutral"} />
        <MetricCard title="Suggested Allocation" value={clean ? best?.recommendation.positionSize ?? "0%" : "0%"} detail="Position sizes are capped by risk mode logic; MVP defaults to balanced." />
        <MetricCard title="Main Risk" value={best?.risk.riskLevel ?? "Unknown"} detail={best?.recommendation.mainRisk ?? "Market data is still loading."} tone={best?.risk.riskLevel === "Danger" || best?.risk.riskLevel === "High" ? "bad" : "warn"} />
      </div>

      {!clean && !loading && (
        <div className="shield-alert">
          <ShieldAlert color="#facc15" size={24} />
          <div>
            <div className="shield-title">Switch not approved</div>
            <div className="shield-desc">{best?.recommendation.worstRisks[0] ?? "No token clearly beats SOL after fees, slippage, and risk filters."}</div>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="radar-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>15m vs SOL</th>
              <th>1h vs SOL</th>
              <th>4h vs SOL</th>
              <th>Token Trend</th>
              <th>SOL Trend</th>
              <th>TOKEN/SOL Trend</th>
              <th>Breakout Status</th>
              <th>Liq. Flow</th>
              <th>Score</th>
              <th>Action</th>
              <th>Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="12" style={{ textAlign: 'center', padding: '20px' }}>Loading market data...</td></tr>
            ) : rows.map(analysis => {
              const oneToken = analysis.tokenTrends.find((t) => t.timeframe === "1h")?.label ?? "Neutral";
              const oneSol = analysis.solTrends.find((t) => t.timeframe === "1h")?.label ?? "Neutral";
              const oneRatio = analysis.ratioTrends.find((t) => t.timeframe === "1h")?.label ?? "Neutral";
              
              const trendTone = (l) => l.includes("bullish") || l.includes("Bullish") ? "bullish" : l.includes("bearish") || l.includes("Bearish") ? "bearish" : "neutral";
              const riskTone = (r) => r === "Danger" ? "danger" : r === "High" ? "warning" : r === "Low" ? "bullish" : "neutral";
              
              return (
                <tr key={analysis.profile.symbol}>
                  <td style={{ fontWeight: 'bold', color: '#fff' }}>{analysis.profile.symbol}</td>
                  <td>{formatPercent(analysis.relative.performance["15m"])}</td>
                  <td>{formatPercent(analysis.relative.performance["1h"])}</td>
                  <td>{formatPercent(analysis.relative.performance["4h"])}</td>
                  <td><Badge tone={trendTone(oneToken)}>{oneToken}</Badge></td>
                  <td><Badge tone={trendTone(oneSol)}>{oneSol}</Badge></td>
                  <td><Badge tone={trendTone(oneRatio)}>{oneRatio}</Badge></td>
                  <td><Badge tone={analysis.breakout.status === "Confirmed breakout" ? "bullish" : analysis.breakout.status === "Fakeout risk" || analysis.breakout.status === "Breakdown" ? "danger" : "neutral"}>{analysis.breakout.status}</Badge></td>
                  <td style={{ fontSize: '0.8rem' }}>{analysis.liquidity.state}</td>
                  <td style={{ fontWeight: 'bold', color: '#00ff88' }}>{analysis.recommendation.score}</td>
                  <td style={{ fontSize: '0.85rem' }}>{analysis.recommendation.action}</td>
                  <td><Badge tone={riskTone(analysis.risk.riskLevel)}>{analysis.risk.riskLevel}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .sol-switch-container { padding: 24px; color: #eee; font-family: 'Inter', sans-serif; background: #050505; min-height: 100vh; }
        .sol-switch-nav { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid #1a1a1a; padding-bottom: 16px; overflow-x: auto; }
        .nav-tab { background: transparent; border: 1px solid transparent; color: #888; font-weight: bold; font-size: 0.9rem; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .nav-tab:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .nav-tab.active { color: #00ff88; background: rgba(0,255,136,0.1); border-color: rgba(0,255,136,0.3); }
        
        .sol-switch-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 20px; }
        .header-text h2 { margin: 0 0 8px 0; font-size: 1.8rem; }
        .header-text p { margin: 0; color: #888; max-width: 600px; line-height: 1.4; }
        
        .controls { display: flex; gap: 8px; }
        .controls input { background: #111; border: 1px solid #333; color: #fff; padding: 8px 12px; border-radius: 6px; outline: none; }
        .controls input:focus { border-color: #00ff88; }
        .controls button { background: #111; border: 1px solid #333; color: #fff; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .controls button:hover { background: #222; }
        .refresh-btn { background: rgba(0,255,136,0.1) !important; color: #00ff88 !important; border-color: rgba(0,255,136,0.3) !important; }
        
        .symbols-list { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .symbol-chip { background: #111; border: 1px solid #333; padding: 4px 10px; border-radius: 16px; font-size: 0.8rem; color: #aaa; }
        
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric-card { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 16px; border-radius: 12px; }
        .metric-title { font-size: 0.8rem; color: #888; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; }
        .metric-value { font-size: 1.5rem; font-weight: 900; margin-bottom: 8px; }
        .metric-detail { font-size: 0.8rem; color: #666; line-height: 1.4; }
        
        .shield-alert { display: flex; gap: 16px; padding: 16px; background: rgba(250, 204, 21, 0.05); border: 1px solid rgba(250, 204, 21, 0.2); border-radius: 12px; margin-bottom: 24px; align-items: center; }
        .shield-title { color: #facc15; font-weight: bold; margin-bottom: 4px; }
        .shield-desc { color: #aaa; font-size: 0.85rem; }
        
        .table-wrapper { overflow-x: auto; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 12px; }
        .radar-table { width: 100%; border-collapse: collapse; text-align: left; }
        .radar-table th { padding: 12px 16px; font-size: 0.75rem; text-transform: uppercase; color: #666; border-bottom: 1px solid #1a1a1a; background: #080808; white-space: nowrap; }
        .radar-table td { padding: 16px; border-bottom: 1px solid #111; vertical-align: middle; white-space: nowrap; }
        .radar-table tr:hover td { background: #111; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default SolSwitchRadar;
