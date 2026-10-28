import React, { useState, useEffect } from 'react';
import { runEvolutionBacktest } from './logic/evolutionEngine';
import { fetchTop500Symbols } from './logic/scanner';
import { BrainCircuit, Play, Save, CheckCircle, AlertTriangle } from 'lucide-react';

export default function EvolutionBacktester() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clusters, setClusters] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem('nebula_evolution_rules');
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed)) {
          setClusters(parsed);
        }
      } catch (e) {}
    }
  }, []);

  const handleRunBacktest = async () => {
    setLoading(true);
    setProgress(0);
    setSaved(false);
    
    // Fetch top 100 symbols for MVP performance
    const tickers = await fetchTop500Symbols(true);
    const top100 = tickers.slice(0, 100);
    
    const results = await runEvolutionBacktest(top100, (p) => {
      setProgress(p);
    });

    setClusters(results);
    setLoading(false);
  };

  const handleSaveRules = () => {
    localStorage.setItem('nebula_evolution_rules', JSON.stringify(clusters));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-gray-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center space-x-4 mb-8">
          <BrainCircuit size={40} className="text-purple-400" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Market Evolution Engine</h1>
            <p className="text-gray-400 text-sm mt-1">Discover the genetic sequences of winning trades.</p>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[#1F2937] p-6 mb-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Extract State Machine</h2>
              <p className="text-gray-400 text-sm mt-1 max-w-2xl">
                This will simulate the scanner over the top 100 tokens using 1H candles for the past month.
                It will identify all potential signals, evaluate their 48-hour forward returns (+15% vs -5%), 
                and reconstruct the market states at T-24, T-12, T-4, and T0.
              </p>
            </div>
            <button 
              onClick={handleRunBacktest}
              disabled={loading}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-bold transition-all ${
                loading 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
              }`}
            >
              <Play size={18} />
              <span>{loading ? 'Extracting...' : 'Start Extraction'}</span>
            </button>
          </div>

          {loading && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-purple-300 mb-2">
                <span>Processing Historical Data...</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {clusters && clusters.length > 0 && (
          <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1F2937] flex items-center justify-between bg-[#151D2C]">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Discovered Evolutionary Patterns</span>
                <span className="bg-purple-900/50 text-purple-300 text-xs px-2 py-1 rounded-full ml-2">
                  {clusters ? clusters.length : 0} Patterns
                </span>
              </h3>
              <button 
                onClick={handleSaveRules}
                className="flex items-center space-x-2 px-4 py-2 bg-[#1F2937] hover:bg-[#374151] rounded-md text-sm font-medium transition-colors"
              >
                {saved ? <CheckCircle size={16} className="text-green-400" /> : <Save size={16} />}
                <span>{saved ? 'Saved to Live Scanner' : 'Save Rules for Live Scanner'}</span>
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="text-xs uppercase bg-[#0A0E17] text-gray-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Evolutionary Sequence (T-24 → T-12 → T-4 → T0)</th>
                    <th className="px-6 py-4 font-medium text-right">Occurrences</th>
                    <th className="px-6 py-4 font-medium text-right">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                  {clusters.map((cluster, idx) => (
                    <tr key={idx} className="hover:bg-[#1A2333] transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-gray-300 leading-relaxed max-w-2xl">
                        {cluster.sequence.split(' -> ').map((step, i) => (
                          <span key={i} className="inline-flex items-center">
                            <span className="bg-[#1F2937] px-2 py-1 rounded border border-gray-700">{step}</span>
                            {i < 3 && <span className="mx-2 text-gray-600">→</span>}
                          </span>
                        ))}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-white">
                        {cluster.total}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-1 rounded-md font-bold ${
                          cluster.winRate >= 70 ? 'bg-green-900/40 text-green-400' :
                          cluster.winRate >= 50 ? 'bg-yellow-900/40 text-yellow-400' :
                          'bg-red-900/40 text-red-400'
                        }`}>
                          {cluster.winRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!clusters || clusters.length === 0) && !loading && (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                        No patterns discovered yet. Run the extraction engine.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
