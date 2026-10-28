import React, { useState, useEffect } from 'react';
import { getPortfolio, sellToken, resetPortfolio } from './logic/PortfolioEngine';
import { fetchTop500Symbols } from './logic/scanner'; // Pour avoir les prix en temps réel
import { Wallet, TrendingUp, TrendingDown, History, RefreshCw, XCircle, Activity } from 'lucide-react';

const PortfolioDashboard = () => {
  const [portfolio, setPortfolio] = useState(getPortfolio());
  const [livePrices, setLivePrices] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const loadPrices = async () => {
    setIsLoading(true);
    const symbols = await fetchTop500Symbols();
    if (symbols) {
      const priceMap = {};
      symbols.forEach(s => {
        priceMap[s.symbol] = parseFloat(s.lastPrice);
      });
      setLivePrices(priceMap);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, 15000); // Mettre à jour toutes les 15 secondes
    return () => clearInterval(interval);
  }, []);

  const handleSell = (symbol) => {
    if (!livePrices[symbol]) return;
    const result = sellToken(symbol, livePrices[symbol]);
    if (result.success) {
      setPortfolio(getPortfolio());
    } else {
      alert(result.message);
    }
  };

  const handleReset = () => {
    if (window.confirm("Voulez-vous vraiment réinitialiser le portefeuille de démo et revenir à 10 SOL ?")) {
      setPortfolio(resetPortfolio());
    }
  };

  // Calcul du total en temps réel
  const livePositionsValue = portfolio.positions.reduce((acc, pos) => {
    // Si l'ancienne version, on skip
    if (!pos.entryPriceUsdt) return acc;
    
    const currentPriceUsdt = livePrices[pos.symbol] || pos.entryPriceUsdt;
    const currentSolPrice = livePrices['SOLUSDT'] || pos.solPriceAtEntry || 150;
    
    const valueNowUsdt = pos.amount * currentPriceUsdt;
    const valueNowSol = valueNowUsdt / currentSolPrice;
    
    return acc + valueNowSol;
  }, 0);

  const totalEquity = portfolio.balance + livePositionsValue;
  const totalPnL = totalEquity - 10; // 10 SOL est le capital initial
  const totalPnLPercent = (totalPnL / 10) * 100;

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
         <h2 style={{ color: '#00f0ff', margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Wallet size={24} /> PORTFOLIO DÉMO
         </h2>
         <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
           <RefreshCw size={14} /> RESET (10 SOL)
         </button>
      </div>

      {/* Résumé du Compte */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '2rem' }}>
         <div style={{ background: '#0a1a21', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '5px' }}>SOLDE LIBRE</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#f8fafc' }}>{portfolio.balance.toFixed(4)} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>SOL</span></div>
         </div>
         <div style={{ background: '#0a1a21', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '5px' }}>VALEUR POSITIONS</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#f8fafc' }}>{livePositionsValue.toFixed(4)} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>SOL</span></div>
         </div>
         <div style={{ background: '#0a1a21', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '5px' }}>CAPITAL TOTAL</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#00f0ff' }}>{totalEquity.toFixed(4)} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>SOL</span></div>
         </div>
         <div style={{ background: 'rgba(10, 26, 33, 0.8)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${totalPnL >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
            <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '5px' }}>PnL GLOBAL</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: totalPnL >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {totalPnL >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              {totalPnL > 0 ? '+' : ''}{totalPnL.toFixed(4)} SOL <span style={{ fontSize: '1rem' }}>({totalPnLPercent > 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%)</span>
            </div>
         </div>
      </div>

      {/* Positions Actives */}
      <h3 style={{ color: '#f8fafc', margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={18} color="#00f0ff" /> POSITIONS OUVERTES
      </h3>
      {portfolio.positions.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#0a1a21', borderRadius: '12px', color: '#64748b', marginBottom: '2rem' }}>
          Aucune position ouverte. Achetez un token depuis l'Expert Table.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '2rem', background: '#0a1a21', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#051016' }}>
              <tr>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>ASSET</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>ENTRY PRICE (USDT)</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>CURRENT PRICE (USDT)</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>INVESTI</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>PnL (SOL)</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>PnL (%)</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map((pos) => {
                // Ignore old buggy format visually
                if (!pos.entryPriceUsdt) return null;

                const currentPriceUsdt = livePrices[pos.symbol] || pos.entryPriceUsdt;
                const currentSolPriceUsdt = livePrices['SOLUSDT'] || pos.solPriceAtEntry || 150;
                
                const valueNowUsdt = pos.amount * currentPriceUsdt;
                const valueNowSol = valueNowUsdt / currentSolPriceUsdt;
                
                const pnl = valueNowSol - pos.investmentSol;
                const pnlPercent = (pnl / pos.investmentSol) * 100;
                const isPositive = pnl >= 0;

                return (
                  <tr key={pos.symbol} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 16px', color: '#f8fafc', fontWeight: 'bold' }}>{pos.symbol.replace('USDT', '')}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>${pos.entryPriceUsdt.toFixed(5)}</td>
                    <td style={{ padding: '12px 16px', color: '#f8fafc' }}>
                      {isLoading && !livePrices[pos.symbol] ? '...' : `$${currentPriceUsdt.toFixed(5)}`}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{pos.investmentSol} SOL</td>
                    <td style={{ padding: '12px 16px', color: isPositive ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                      {isPositive ? '+' : ''}{pnl.toFixed(4)}
                    </td>
                    <td style={{ padding: '12px 16px', color: isPositive ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                      {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => {
                          const solPr = livePrices['SOLUSDT'] || pos.solPriceAtEntry || 150;
                          const res = sellToken(pos.symbol, currentPriceUsdt, solPr);
                          if (res.success) setPortfolio(getPortfolio());
                          else alert(res.message);
                        }} disabled={!livePrices[pos.symbol]}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '6px 12px', borderRadius: '4px', cursor: livePrices[pos.symbol] ? 'pointer' : 'not-allowed', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <XCircle size={14} /> FERMER
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Historique */}
      <h3 style={{ color: '#f8fafc', margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <History size={18} color="#00f0ff" /> HISTORIQUE DES TRADES
      </h3>
      {portfolio.history.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#0a1a21', borderRadius: '12px', color: '#64748b' }}>
          Aucun trade terminé.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#0a1a21', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#051016' }}>
              <tr>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>ASSET</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>ENTRY PRICE (USDT)</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>EXIT PRICE (USDT)</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>PnL (SOL)</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>PnL (%)</th>
                <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.7rem', fontWeight: '800' }}>DURÉE</th>
              </tr>
            </thead>
            <tbody>
              {[...portfolio.history].reverse().map((trade, idx) => {
                if (!trade.entryPriceUsdt) return null; // Ignore old buggy history

                const isPositive = trade.pnlSol >= 0;
                const durationHours = ((trade.exitTime - trade.entryTime) / (1000 * 60 * 60)).toFixed(1);

                return (
                  <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 16px', color: '#f8fafc', fontWeight: 'bold' }}>{trade.symbol.replace('USDT', '')}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>${trade.entryPriceUsdt.toFixed(5)}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>${trade.exitPriceUsdt.toFixed(5)}</td>
                    <td style={{ padding: '12px 16px', color: isPositive ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                      {isPositive ? '+' : ''}{trade.pnlSol.toFixed(4)}
                    </td>
                    <td style={{ padding: '12px 16px', color: isPositive ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                      {isPositive ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.8rem' }}>{durationHours} h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PortfolioDashboard;
