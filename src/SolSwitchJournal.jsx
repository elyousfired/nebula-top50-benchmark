import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

const tags = ["Entered too late", "Ignored SOL trend", "Ignored unlock risk", "Ignored liquidity", "Exited too early", "Held after relative strength broke", "Chased pump", "Overtraded"];

const SolSwitchJournal = () => {
  const [entries, setEntries] = useState([
    { token: "HYPE", result: "Win", reason: "HYPE/SOL breakout confirmed with volume", notes: "Exited when 15m weakened." }
  ]);
  
  const [form, setForm] = useState({ token: '', result: 'Win', reason: '', notes: '' });

  const addEntry = () => {
    if (!form.token.trim()) return;
    setEntries(current => [...current, { ...form, token: form.token.toUpperCase() }]);
    setForm({ token: '', result: 'Win', reason: '', notes: '' });
  };

  return (
    <div className="sol-switch-journal">
      <div className="journal-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00d2ff' }}>
          <BookOpen /> Trading Journal
        </h2>
        <p>Manual switch journal focused on SOL-relative decisions and post-trade analysis.</p>
      </div>

      <div className="journal-panel">
        <div className="panel-header">
          <h3>New Entry</h3>
          <p>Store your reasoning, mistakes, and final SOL result.</p>
        </div>
        
        <div className="journal-form">
          <input 
            type="text" 
            placeholder="Token (e.g., HYPE)" 
            value={form.token}
            onChange={(e) => setForm({...form, token: e.target.value})}
          />
          <select value={form.result} onChange={(e) => setForm({...form, result: e.target.value})}>
            <option>Win</option>
            <option>Loss</option>
            <option>Breakeven</option>
          </select>
          <input 
            type="text" 
            placeholder="Reason for entry" 
            value={form.reason}
            onChange={(e) => setForm({...form, reason: e.target.value})}
          />
          <input 
            type="text" 
            placeholder="Mistakes / Notes" 
            value={form.notes}
            onChange={(e) => setForm({...form, notes: e.target.value})}
          />
          <button className="add-btn" onClick={addEntry}>Add journal entry</button>
        </div>
      </div>

      <div className="entries-grid">
        {entries.map((entry, idx) => (
          <div key={idx} className="entry-card">
            <div className="entry-header">
              <span className="entry-token">{entry.token}</span>
              <span className={`entry-result ${entry.result.toLowerCase()}`}>{entry.result}</span>
            </div>
            <div className="entry-body">
              <div className="entry-reason">
                <strong>Reasoning:</strong> {entry.reason || "N/A"}
              </div>
              <div className="entry-notes">
                <strong>Notes:</strong> {entry.notes || "N/A"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .sol-switch-journal { color: #eee; font-family: 'Inter', sans-serif; }
        .journal-header { margin-bottom: 24px; }
        .journal-header h2 { margin: 0 0 8px 0; font-size: 1.5rem; }
        .journal-header p { color: #888; font-size: 0.85rem; max-width: 600px; margin: 0; line-height: 1.4; }
        
        .journal-panel { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 12px; margin-bottom: 24px; overflow: hidden; }
        .panel-header { padding: 20px; border-bottom: 1px solid #1a1a1a; }
        .panel-header h3 { margin: 0 0 8px 0; color: #fff; }
        .panel-header p { margin: 0; color: #888; font-size: 0.8rem; line-height: 1.4; }
        
        .journal-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 20px; align-items: center; }
        .journal-form input, .journal-form select { background: #111; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 6px; outline: none; width: 100%; box-sizing: border-box; }
        .journal-form input:focus, .journal-form select:focus { border-color: #00d2ff; }
        
        .add-btn { grid-column: 1 / -1; background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.3); padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 8px; }
        .add-btn:hover { background: rgba(0, 210, 255, 0.2); }
        
        .entries-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px; }
        .entry-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; }
        .entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .entry-token { font-weight: 900; color: #fff; font-size: 1.2rem; }
        
        .entry-result { padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.8rem; }
        .entry-result.win { background: rgba(0,255,136,0.1); color: #00ff88; }
        .entry-result.loss { background: rgba(255,59,48,0.1); color: #ff3b30; }
        .entry-result.breakeven { background: rgba(255,255,255,0.1); color: #aaa; }
        
        .entry-body { display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem; color: #bbb; line-height: 1.5; }
        .entry-body strong { color: #fff; }
        
        @media (max-width: 800px) {
          .journal-form { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}

export default SolSwitchJournal;
