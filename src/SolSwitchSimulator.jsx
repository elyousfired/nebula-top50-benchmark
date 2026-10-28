import React, { useMemo, useState } from 'react';
import { simulateSwitch } from './logic/solSwitchEngine';
import { Calculator } from 'lucide-react';

const SolSwitchSimulator = () => {
  const [form, setForm] = useState({
    solStart: 100,
    solEntry: 160,
    solNow: 175,
    tokenEntry: 20,
    tokenNow: 23,
    feesPct: 0.2,
    slippagePct: 0.35,
    positionSizePct: 25
  });

  const result = useMemo(() => simulateSwitch(form), [form]);
  
  const scenarios = [
    { label: "Token outperforms SOL by +2%", multiplier: 1.02 },
    { label: "Token outperforms SOL by +5%", multiplier: 1.05 },
    { label: "Token underperforms SOL by -2%", multiplier: 0.98 },
    { label: "SOL pumps while token lags", multiplier: 0.94 }
  ].map(({ label, multiplier }) => {
    const next = simulateSwitch({ ...form, tokenNow: form.tokenEntry * (form.solNow / form.solEntry) * multiplier });
    return { label, ...next };
  });

  const update = (key, value) => {
    setForm(current => ({ ...current, [key]: Number(value) }));
  };

  const labels = {
    solStart: "Starting SOL amount",
    solEntry: "SOL price at entry",
    solNow: "SOL price now/exit",
    tokenEntry: "Token price at entry",
    tokenNow: "Token price now/exit",
    feesPct: "Fees %",
    slippagePct: "Slippage %",
    positionSizePct: "Position size %"
  };

  const formatNumber = (num) => num.toFixed(2);
  const formatPercent = (num) => {
    const color = num > 0 ? '#00ff88' : num < 0 ? '#ff3b30' : '#888';
    return <span style={{ color }}>{num > 0 ? '+' : ''}{num.toFixed(2)}%</span>;
  };

  const Box = ({ label, value }) => (
    <div className="sim-box">
      <div className="sim-box-label">{label}</div>
      <div className="sim-box-value">{value}</div>
    </div>
  );

  return (
    <div className="sol-switch-simulator">
      <div className="sim-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ff88' }}>
          <Calculator /> Switch Simulator
        </h2>
        <p>Estimate SOL gained or lost from switching part of your SOL stack into a token and rotating back later.</p>
      </div>

      <div className="sim-grid">
        <div className="sim-panel">
          <h3>Inputs</h3>
          <p className="panel-desc">All outputs are evaluated in SOL terms.</p>
          <div className="inputs-grid">
            {Object.entries(form).map(([key, value]) => (
              <label key={key} className="input-group">
                <span>{labels[key] ?? key}</span>
                <input type="number" value={value} onChange={(e) => update(key, e.target.value)} />
              </label>
            ))}
          </div>
        </div>

        <div className="sim-panel">
          <h3>Output Results</h3>
          <p className="panel-desc">Calculated after adjusting for position size, fees and slippage.</p>
          <div className="outputs-grid">
            <Box label="SOL used" value={formatNumber(result.solUsed)} />
            <Box label="Remaining SOL" value={formatNumber(result.remainingSol)} />
            <Box label="Token received" value={formatNumber(result.tokenAmount)} />
            <Box label="Estimated SOL" value={formatNumber(result.estimatedSol)} />
            <Box label="Net SOL gain/loss" value={formatNumber(result.netSol)} />
            <Box label="Net % vs holding SOL" value={formatPercent(result.netPct)} />
          </div>
        </div>
      </div>

      <div className="sim-panel" style={{ marginTop: '20px' }}>
        <h3>Scenario Analysis</h3>
        <div className="scenarios-grid">
          {scenarios.map((scenario) => (
            <div key={scenario.label} className="sim-box scenario-box">
              <div className="sim-box-label">{scenario.label}</div>
              <div className="sim-box-value">
                {formatNumber(scenario.netSol)} SOL ({formatPercent(scenario.netPct)})
              </div>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .sol-switch-simulator { color: #eee; font-family: 'Inter', sans-serif; }
        .sim-header { margin-bottom: 24px; }
        .sim-header h2 { margin: 0 0 8px 0; font-size: 1.5rem; }
        .sim-header p { color: #888; font-size: 0.85rem; max-width: 600px; margin: 0; line-height: 1.4; }
        .sim-grid { display: grid; grid-template-columns: 350px 1fr; gap: 20px; }
        .sim-panel { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 20px; border-radius: 12px; }
        .sim-panel h3 { margin: 0 0 4px 0; font-size: 1.1rem; color: #fff; }
        .panel-desc { color: #666; font-size: 0.75rem; margin: 0 0 16px 0; }
        
        .inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .input-group { display: flex; flex-direction: column; gap: 4px; }
        .input-group span { font-size: 0.7rem; color: #888; }
        .input-group input { background: #111; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 6px; outline: none; width: 100%; box-sizing: border-box; }
        .input-group input:focus { border-color: #00ff88; }
        
        .outputs-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .scenarios-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        
        .sim-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; }
        .sim-box-label { font-size: 0.7rem; color: #888; margin-bottom: 6px; }
        .sim-box-value { font-size: 1.2rem; font-weight: 900; color: #fff; }
        
        @media (max-width: 900px) {
          .sim-grid { grid-template-columns: 1fr; }
          .outputs-grid { grid-template-columns: 1fr 1fr; }
          .scenarios-grid { grid-template-columns: 1fr 1fr; }
        }
      `}} />
    </div>
  );
};

export default SolSwitchSimulator;
