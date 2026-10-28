import React, { useState, useEffect } from 'react';
import { fetchBybitData, fetchBinanceData } from './logic/scanner';
import { Target, TrendingUp, X, RefreshCw, BarChart2 } from 'lucide-react';

const DemoPortfolio = () => {
  const [trades, setTrades] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [solPrice, setSolPrice] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load trades from localStorage
  useEffect(() => {
    try {
      let saved = JSON.parse(localStorage.getItem('nebula_demo_portfolio'));
      if (!Array.isArray(saved)) {
        saved = [];
      }
      setTrades(saved);
    } catch (e) {
      setTrades([]);
    }
  }, []);

  // Fetch Live Prices
  const fetchPrices = async () => {
    setLoading(true);
    try {
      // Fetch SOL Price
      const solRes = await fetchBybitData('SOLUSDT', '15', 1);
      const currentSolPrice = solRes && solRes.length > 0 ? parseFloat(solRes[0][4]) : 0;
      setSolPrice(currentSolPrice);

      const openTrades = trades.filter(t => t.status === 'OPEN');
      const uniqueSymbols = [...new Set(openTrades.map(t => t.symbol))];

      const priceMap = {};
      await Promise.all(uniqueSymbols.map(async (sym) => {
        try {
          // Check exchange from the first trade that has it, default to bybit
          const trade = openTrades.find(t => t.symbol === sym);
          const exchange = trade?.exchange || 'bybit';
          const fetchSymbol = sym.includes('USDT') ? sym : `${sym}USDT`;
          
          const res = exchange === 'binance' 
            ? await fetchBinanceData(fetchSymbol, '15', 1) 
            : await fetchBybitData(fetchSymbol, '15', 1);
            
          if (res && res.length > 0) {
            priceMap[sym] = parseFloat(res[res.length - 1][4] || res[0][4]); 
          }
        } catch (e) { }
      }));

      setLivePrices(priceMap);
    } catch (e) { }
    setLoading(false);
  };

  useEffect(() => {
    if (trades.length > 0) {
      fetchPrices();
      const interval = setInterval(fetchPrices, 10000); // refresh every 10s
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [trades]);

  const closeTrade = (tradeId) => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;

    const currentTokenPrice = livePrices[trade.symbol];
    if (!currentTokenPrice || solPrice <= 0) {
      alert("Prix actuels non disponibles. Veuillez patienter ou rafraîchir.");
      return;
    }

    const valueUsdt = trade.tokensAcquired * currentTokenPrice;
    const valueSol = valueUsdt / solPrice;

    const updatedTrades = trades.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          status: 'CLOSED',
          exitTime: Date.now(),
          exitSolPriceUsdt: solPrice,
          exitTokenPriceUsdt: currentTokenPrice,
          finalValueSol: valueSol,
          finalValueUsdt: valueUsdt
        };
      }
      return t;
    });

    setTrades(updatedTrades);
    localStorage.setItem('nebula_demo_portfolio', JSON.stringify(updatedTrades));
  };

  const deleteTrade = (tradeId) => {
    const updatedTrades = trades.filter(t => t.id !== tradeId);
    setTrades(updatedTrades);
    localStorage.setItem('nebula_demo_portfolio', JSON.stringify(updatedTrades));
  };

  const openTrades = trades.filter(t => t.status === 'OPEN').sort((a,b) => b.entryTime - a.entryTime);
  const closedTrades = trades.filter(t => t.status === 'CLOSED').sort((a,b) => b.exitTime - a.exitTime);

  // Compute Total Unrealized PNL
  let totalInvestedSol = 0;
  let totalCurrentSol = 0;
  let totalInvestedUsdt = 0;
  let totalCurrentUsdt = 0;

  openTrades.forEach(t => {
    totalInvestedSol += t.solAmount;
    totalInvestedUsdt += t.solAmount * t.entrySolPriceUsdt;

    const currentTokenPrice = livePrices[t.symbol] || t.entryTokenPriceUsdt;
    const valueUsdt = t.tokensAcquired * currentTokenPrice;
    const valueSol = solPrice > 0 ? valueUsdt / solPrice : t.solAmount;

    totalCurrentSol += valueSol;
    totalCurrentUsdt += valueUsdt;
  });

  const totalPnlSol = totalCurrentSol - totalInvestedSol;
  const totalPnlSolPct = totalInvestedSol > 0 ? (totalPnlSol / totalInvestedSol) * 100 : 0;
  const totalPnlUsdt = totalCurrentUsdt - totalInvestedUsdt;
  const totalPnlUsdtPct = totalInvestedUsdt > 0 ? (totalPnlUsdt / totalInvestedUsdt) * 100 : 0;

  return (
    <div style={{ padding: '2rem', background: '#050505', minHeight: '100vh', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 10px 0', color: '#00ff88', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={28} /> DEMO PORTFOLIO
          </h1>
          <p style={{ color: '#888', margin: 0 }}>Simulez vos stratégies de swap (SOL → TOKEN → SOL) sans risque.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#888', fontSize: '0.8rem', fontWeight: 'bold' }}>PRIX DU SOL (LIVE)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#00d0ff' }}>
            {solPrice > 0 ? `$${solPrice.toFixed(2)}` : '---'}
          </div>
        </div>
      </div>

      {/* Global Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#0a0f1a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '5px' }}>INVESTISSEMENT TOTAL</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>{totalInvestedSol.toFixed(2)} SOL</div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>≈ ${totalInvestedUsdt.toFixed(2)}</div>
        </div>
        <div style={{ background: '#0a0f1a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '5px' }}>VALEUR ACTUELLE</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff' }}>{totalCurrentSol.toFixed(2)} SOL</div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>≈ ${totalCurrentUsdt.toFixed(2)}</div>
        </div>
        <div style={{ background: totalPnlSol >= 0 ? 'rgba(0,255,136,0.05)' : 'rgba(255,59,48,0.05)', border: `1px solid ${totalPnlSol >= 0 ? 'rgba(0,255,136,0.2)' : 'rgba(255,59,48,0.2)'}`, borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ color: totalPnlSol >= 0 ? '#00ff88' : '#ff3b30', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '5px' }}>UNREALIZED PNL (SOL)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: totalPnlSol >= 0 ? '#00ff88' : '#ff3b30' }}>
            {totalPnlSol >= 0 ? '+' : ''}{totalPnlSol.toFixed(4)} SOL
          </div>
          <div style={{ fontSize: '0.8rem', color: totalPnlSol >= 0 ? '#00ff88' : '#ff3b30', fontWeight: 'bold' }}>
            {totalPnlSolPct >= 0 ? '+' : ''}{totalPnlSolPct.toFixed(2)}%
          </div>
        </div>
        <div style={{ background: totalPnlUsdt >= 0 ? 'rgba(0,208,255,0.05)' : 'rgba(255,59,48,0.05)', border: `1px solid ${totalPnlUsdt >= 0 ? 'rgba(0,208,255,0.2)' : 'rgba(255,59,48,0.2)'}`, borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ color: totalPnlUsdt >= 0 ? '#00d0ff' : '#ff3b30', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '5px' }}>UNREALIZED PNL (USDT)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: totalPnlUsdt >= 0 ? '#00d0ff' : '#ff3b30' }}>
            {totalPnlUsdt >= 0 ? '+' : ''}${totalPnlUsdt.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.8rem', color: totalPnlUsdt >= 0 ? '#00d0ff' : '#ff3b30', fontWeight: 'bold' }}>
            {totalPnlUsdtPct >= 0 ? '+' : ''}{totalPnlUsdtPct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '800' }}>Positions Ouvertes ({openTrades.length})</h2>
        <button onClick={fetchPrices} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Rafraîchir
        </button>
      </div>

      {openTrades.length === 0 ? (
        <div style={{ background: '#111', padding: '3rem', textAlign: 'center', borderRadius: '12px', border: '1px dashed #333' }}>
          <div style={{ color: '#666', marginBottom: '10px' }}><BarChart2 size={40} /></div>
          <div style={{ color: '#888', fontSize: '1.2rem', fontWeight: 'bold' }}>Aucune position ouverte</div>
          <p style={{ color: '#555', fontSize: '0.9rem' }}>Allez sur le scanner Momentum Streaks pour ouvrir un trade démo.</p>
        </div>
      ) : (
        <div style={{ background: '#0a0f1a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: '3rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                <th style={{ padding: '15px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>TOKEN</th>
                <th style={{ padding: '15px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>INVESTISSEMENT</th>
                <th style={{ padding: '15px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>PRIX ENTRÉE</th>
                <th style={{ padding: '15px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>PRIX ACTUEL</th>
                <th style={{ padding: '15px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>PNL (SOL)</th>
                <th style={{ padding: '15px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>PNL (USDT)</th>
                <th style={{ padding: '15px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map(t => {
                const currentTokenPrice = livePrices[t.symbol] || t.entryTokenPriceUsdt;
                const valueUsdt = t.tokensAcquired * currentTokenPrice;
                const valueSol = solPrice > 0 ? valueUsdt / solPrice : t.solAmount;
                
                const pnlSol = valueSol - t.solAmount;
                const pnlSolPct = (pnlSol / t.solAmount) * 100;
                
                const entryUsdt = t.solAmount * t.entrySolPriceUsdt;
                const pnlUsdt = valueUsdt - entryUsdt;
                const pnlUsdtPct = (pnlUsdt / entryUsdt) * 100;

                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '15px', fontWeight: '900', color: '#fff' }}>
                      {t.symbol} <br/>
                      <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 'normal' }}>{new Date(t.entryTime).toLocaleString()}</span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{t.solAmount} SOL</div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>{t.tokensAcquired.toLocaleString()} tokens</div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ color: '#aaa', fontSize: '0.8rem' }}>Token: ${t.entryTokenPriceUsdt.toFixed(6)}</div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>SOL: ${t.entrySolPriceUsdt.toFixed(2)}</div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>${currentTokenPrice.toFixed(6)}</div>
                      <div style={{ color: '#00d0ff', fontSize: '0.7rem' }}>SOL: ${solPrice.toFixed(2)}</div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ color: pnlSol >= 0 ? '#00ff88' : '#ff3b30', fontWeight: '900' }}>
                        {pnlSol >= 0 ? '+' : ''}{pnlSol.toFixed(4)} SOL
                      </div>
                      <div style={{ color: pnlSol >= 0 ? '#00ff88' : '#ff3b30', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {pnlSolPct >= 0 ? '+' : ''}{pnlSolPct.toFixed(2)}%
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ color: pnlUsdt >= 0 ? '#00d0ff' : '#ff3b30', fontWeight: '900' }}>
                        {pnlUsdt >= 0 ? '+' : ''}${pnlUsdt.toFixed(2)}
                      </div>
                      <div style={{ color: pnlUsdt >= 0 ? '#00d0ff' : '#ff3b30', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {pnlUsdtPct >= 0 ? '+' : ''}{pnlUsdtPct.toFixed(2)}%
                      </div>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'right' }}>
                      <button 
                        onClick={() => closeTrade(t.id)}
                        style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', color: '#ff3b30', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                      >
                        CLOSE TRADE
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', fontWeight: '800', color: '#888' }}>Historique (Fermés)</h2>
      {closedTrades.length > 0 && (
        <div style={{ background: '#0a0f1a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', opacity: 0.8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                <th style={{ padding: '12px 15px', color: '#666', fontSize: '0.7rem', fontWeight: 'bold' }}>TOKEN</th>
                <th style={{ padding: '12px 15px', color: '#666', fontSize: '0.7rem', fontWeight: 'bold' }}>INVESTISSEMENT</th>
                <th style={{ padding: '12px 15px', color: '#666', fontSize: '0.7rem', fontWeight: 'bold' }}>PRIX ENTRÉE</th>
                <th style={{ padding: '12px 15px', color: '#666', fontSize: '0.7rem', fontWeight: 'bold' }}>PRIX SORTIE</th>
                <th style={{ padding: '12px 15px', color: '#666', fontSize: '0.7rem', fontWeight: 'bold' }}>PNL (SOL)</th>
                <th style={{ padding: '12px 15px', color: '#666', fontSize: '0.7rem', fontWeight: 'bold' }}>PNL (USDT)</th>
                <th style={{ padding: '12px 15px', color: '#666', fontSize: '0.7rem', fontWeight: 'bold', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.map(t => {
                const pnlSol = t.finalValueSol - t.solAmount;
                
                const entryUsdt = t.solAmount * t.entrySolPriceUsdt;
                const pnlUsdt = t.finalValueUsdt - entryUsdt;

                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#aaa', fontSize: '0.85rem' }}>
                      {t.symbol} <br/>
                      <span style={{ fontSize: '0.6rem', color: '#555' }}>Fermé le {new Date(t.exitTime).toLocaleString()}</span>
                    </td>
                    <td style={{ padding: '12px 15px', color: '#aaa', fontSize: '0.85rem' }}>{t.solAmount} SOL</td>
                    <td style={{ padding: '12px 15px' }}>
                      <div style={{ color: '#888', fontSize: '0.75rem' }}>${t.entryTokenPriceUsdt.toFixed(6)}</div>
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <div style={{ color: '#888', fontSize: '0.75rem' }}>${t.exitTokenPriceUsdt.toFixed(6)}</div>
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <div style={{ color: pnlSol >= 0 ? '#00ff88' : '#ff3b30', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {pnlSol >= 0 ? '+' : ''}{pnlSol.toFixed(4)} SOL
                      </div>
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <div style={{ color: pnlUsdt >= 0 ? '#00d0ff' : '#ff3b30', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {pnlUsdt >= 0 ? '+' : ''}${pnlUsdt.toFixed(2)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                      <button onClick={() => deleteTrade(t.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }} title="Supprimer de l'historique">
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default DemoPortfolio;
