import React, { useState } from 'react';
import { BellPlus, BellRing } from 'lucide-react';

const alertTypes = ["TOKEN/SOL broke resistance", "TOKEN/SOL lost support", "Liquidity inflow detected", "Liquidity leaving", "Fakeout risk rising", "Retest confirmed", "SOL becoming strong again", "Exit back to SOL", "Unlock risk approaching", "News danger", "Funding too high"];

const SolSwitchAlerts = () => {
  const [rules, setRules] = useState([{ token: "HYPE", type: "TOKEN/SOL broke resistance", priority: "High" }]);
  const [newToken, setNewToken] = useState("HYPE");
  const [newType, setNewType] = useState("TOKEN/SOL broke resistance");
  const [newPriority, setNewPriority] = useState("High");

  const addRule = () => {
    if (!newToken.trim()) return;
    setRules(current => [...current, { token: newToken.toUpperCase(), type: newType, priority: newPriority }]);
  };

  return (
    <div className="sol-switch-alerts">
      <div className="alerts-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
          <BellRing /> Alerts Rules
        </h2>
        <p>Define conditions for when the engine should alert you. (UI Only for MVP - no trades are executed automatically).</p>
      </div>

      <div className="alert-panel">
        <div className="panel-header">
          <h3>Create Alert Rule</h3>
          <p>Configure Telegram/Push notifications based on relative strength triggers.</p>
        </div>
        
        <div className="alert-form">
          <input 
            type="text" 
            placeholder="Token" 
            value={newToken} 
            onChange={(e) => setNewToken(e.target.value)} 
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            {alertTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
            {["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="add-btn" onClick={addRule}>
            <BellPlus size={16} /> Add Rule
          </button>
        </div>
      </div>

      <div className="rules-grid">
        {rules.map((rule, idx) => (
          <div key={`${rule.token}-${idx}`} className="rule-card">
            <div className="rule-token">{rule.token}</div>
            <div className="rule-type">{rule.type}</div>
            <div className="rule-priority">
              Priority: <span className={`priority-badge ${rule.priority.toLowerCase()}`}>{rule.priority}</span>
            </div>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .sol-switch-alerts { color: #eee; font-family: 'Inter', sans-serif; }
        .alerts-header { margin-bottom: 24px; }
        .alerts-header h2 { margin: 0 0 8px 0; font-size: 1.5rem; }
        .alerts-header p { color: #888; font-size: 0.85rem; max-width: 600px; margin: 0; line-height: 1.4; }
        
        .alert-panel { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 12px; margin-bottom: 24px; overflow: hidden; }
        .panel-header { padding: 20px; border-bottom: 1px solid #1a1a1a; }
        .panel-header h3 { margin: 0 0 8px 0; color: #fff; }
        .panel-header p { margin: 0; color: #888; font-size: 0.8rem; line-height: 1.4; }
        
        .alert-form { display: grid; grid-template-columns: 150px 1fr 150px auto; gap: 12px; padding: 20px; align-items: center; }
        .alert-form input, .alert-form select { background: #111; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 6px; outline: none; }
        .alert-form input:focus, .alert-form select:focus { border-color: #f59e0b; }
        
        .add-btn { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 10px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; }
        .add-btn:hover { background: rgba(245, 158, 11, 0.2); }
        
        .rules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .rule-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; }
        .rule-token { font-weight: 900; color: #fff; font-size: 1.2rem; margin-bottom: 8px; }
        .rule-type { color: #aaa; font-size: 0.85rem; margin-bottom: 16px; min-height: 40px; }
        .rule-priority { font-size: 0.75rem; color: #666; display: flex; align-items: center; gap: 8px; }
        
        .priority-badge { padding: 4px 8px; border-radius: 12px; font-weight: bold; }
        .priority-badge.critical { background: rgba(255,59,48,0.2); color: #ff3b30; }
        .priority-badge.high { background: rgba(245,158,11,0.2); color: #f59e0b; }
        .priority-badge.medium { background: rgba(0,255,136,0.2); color: #00ff88; }
        .priority-badge.low { background: rgba(255,255,255,0.1); color: #aaa; }
        
        @media (max-width: 800px) {
          .alert-form { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}

export default SolSwitchAlerts;
