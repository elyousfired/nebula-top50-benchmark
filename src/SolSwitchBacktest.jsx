import React from 'react';
import { History } from 'lucide-react';

const results = [
  { symbol: "HYPE", winRate: 58, averageSolGain: 4.8, averageSolLoss: -1.9, bestTimeframe: "1h + 4h", maxDrawdownSolPct: -7.2, trades: 31 },
  { symbol: "ASTER", winRate: 44, averageSolGain: 3.1, averageSolLoss: -2.6, bestTimeframe: "4h", maxDrawdownSolPct: -12.4, trades: 18 },
  { symbol: "MON", winRate: 0, averageSolGain: 0, averageSolLoss: 0, bestTimeframe: "No market data", maxDrawdownSolPct: 0, trades: 0 }
];

const SolSwitchBacktest = () => {
  const best = results.filter(row => row.trades > 0).sort((a, b) => b.winRate - a.winRate)[0];
  const worst = results.filter(row => row.trades > 0).sort((a, b) => a.maxDrawdownSolPct - b.maxDrawdownSolPct)[0];

  const Info = ({ label, value }) => (
    <div>
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );

  return (
    <div className="sol-switch-backtest">
      <div className="backtest-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9945FF' }}>
          <History /> Strategy Backtest
        </h2>
        <p>MVP strategy report shape. Shows historical performance of the switch rotation strategy.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Best token</div>
          <div className="stat-value">{best?.symbol ?? "No data"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Worst token</div>
          <div className="stat-value">{worst?.symbol ?? "No data"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Best timeframe</div>
          <div className="stat-value">{best?.bestTimeframe ?? "No data"}</div>
        </div>
      </div>

      <div className="rules-panel">
        <div className="panel-header">
          <h3>Entry Rules</h3>
          <p>Enter only when TOKEN/SOL 1h and 4h are positive, token trend is bullish, breakout is confirmed, volume is above average, unlock risk is not high, and entry is not late.</p>
        </div>
        
        <div className="results-grid">
          {results.map((result) => (
            <div key={result.symbol} className="result-card">
              <div className="result-header">
                <span className="result-symbol">{result.symbol}</span>
                <span className={`result-badge ${result.trades > 0 ? 'bullish' : 'neutral'}`}>
                  {result.trades} trades
                </span>
              </div>
              <div className="result-details">
                <Info label="Win rate" value={`${result.winRate}%`} />
                <Info label="Avg SOL gain" value={`${result.averageSolGain}%`} />
                <Info label="Avg SOL loss" value={`${result.averageSolLoss}%`} />
                <Info label="Max drawdown" value={`${result.maxDrawdownSolPct}%`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .sol-switch-backtest { color: #eee; font-family: 'Inter', sans-serif; }
        .backtest-header { margin-bottom: 24px; }
        .backtest-header h2 { margin: 0 0 8px 0; font-size: 1.5rem; }
        .backtest-header p { color: #888; font-size: 0.85rem; max-width: 600px; margin: 0; line-height: 1.4; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 20px; border-radius: 12px; }
        .stat-title { font-size: 0.8rem; color: #666; margin-bottom: 8px; }
        .stat-value { font-size: 1.8rem; font-weight: 900; color: #fff; }
        
        .rules-panel { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 12px; overflow: hidden; }
        .panel-header { padding: 20px; border-bottom: 1px solid #1a1a1a; }
        .panel-header h3 { margin: 0 0 8px 0; color: #fff; }
        .panel-header p { margin: 0; color: #888; font-size: 0.8rem; line-height: 1.4; }
        
        .results-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; padding: 20px; }
        .result-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; }
        .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .result-symbol { font-weight: bold; color: #fff; }
        .result-badge { padding: 4px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }
        .result-badge.bullish { background: rgba(0,255,136,0.1); color: #00ff88; border: 1px solid #00ff88; }
        .result-badge.neutral { background: rgba(255,255,255,0.1); color: #aaa; border: 1px solid #444; }
        
        .result-details { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-label { font-size: 0.7rem; color: #666; margin-bottom: 4px; }
        .info-value { font-weight: bold; color: #ccc; }
      `}} />
    </div>
  );
}

export default SolSwitchBacktest;
