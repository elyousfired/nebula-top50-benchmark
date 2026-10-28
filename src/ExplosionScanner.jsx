import React, { useState, useEffect, useRef } from 'react';
import { Activity, Play, RefreshCw, Zap, TrendingUp, AlertTriangle, Radio } from 'lucide-react';
import { fetchTop500Symbols } from './logic/scanner';
import { OrderBookWS } from './logic/websocket';

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 500; // 500ms for orderbook is safe

const delay = ms => new Promise(res => setTimeout(res, ms));

const ExplosionScanner = () => {
  const [isLive, setIsLive] = useState(false);
  const [results, setResults] = useState([]);
  const [trackedSymbolsCount, setTrackedSymbolsCount] = useState(0);

  // Paper Trading State
  const [tradesUpdateTick, setTradesUpdateTick] = useState(0); // Used to force re-render for refs
  const openTradesRef = useRef({}); // { SYMBOL: { entryPrice, startTime, scoreAtEntry } }
  const tradeHistoryRef = useRef([]); // [ { symbol, entryPrice, exitPrice, pnlPercent, pnlUsd, reason, durationMs } ]

  const wsRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    wsRef.current = new OrderBookWS();
    return () => {
      if (wsRef.current) wsRef.current.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const toggleLiveRadar = async () => {
    if (isLive) {
      // Stop
      wsRef.current.disconnect();
      clearInterval(intervalRef.current);
      setIsLive(false);
      setTrackedSymbolsCount(0);
    } else {
      // Start
      setIsLive(true);
      try {
        const topTokens = await fetchTop500Symbols();
        const symbolsToTrack = topTokens.slice(0, 30).map(t => t.symbol); // Track Top 30 for performance
        setTrackedSymbolsCount(symbolsToTrack.length);
        
        wsRef.current.connect(symbolsToTrack);

        // Start processing loop
        intervalRef.current = setInterval(() => {
          processOrderBooks();
        }, 1000); // Check every second

      } catch (e) {
        console.error("Failed to start live radar:", e);
        setIsLive(false);
      }
    }
  };

  const processOrderBooks = () => {
    if (!wsRef.current) return;
    const snapshots = wsRef.current.getSnapshot();
    const allResults = [];
    
    let tradesChanged = false;

    for (const symbol in snapshots) {
      const obData = snapshots[symbol];
      const bids = obData.b; // already parsed and sorted [[price, size], ...]
      const asks = obData.a;

      if (bids.length === 0 || asks.length === 0) continue;

      const bestBid = bids[0][0];
      const bestAsk = asks[0][0];
      const currentPrice = (bestBid + bestAsk) / 2;

      const thresholdRatio = 0.015; 
      
      let bidVolume = 0;
      let largestBidWall = { price: 0, size: 0, distance: 0 };

      bids.forEach(bid => {
        const price = bid[0];
        const size = bid[1];
        const distance = (currentPrice - price) / currentPrice;

        if (distance <= thresholdRatio) {
          const vol = price * size;
          bidVolume += vol;
          if (vol > largestBidWall.size * largestBidWall.price) {
            largestBidWall = { price, size, distance: distance * 100 };
          }
        }
      });

      let askVolume = 0;
      let largestAskWall = { price: 0, size: 0, distance: 0 };

      asks.forEach(ask => {
        const price = ask[0];
        const size = ask[1];
        const distance = (price - currentPrice) / currentPrice;

        if (distance <= thresholdRatio) {
          const vol = price * size;
          askVolume += vol;
          if (vol > largestAskWall.size * largestAskWall.price) {
            largestAskWall = { price, size, distance: distance * 100 };
          }
        }
      });

      if (bidVolume === 0 && askVolume === 0) continue;

      const totalVolume = bidVolume + askVolume;
      const imbalanceRatio = bidVolume / totalVolume;

      let explosionScore = 0;
      
      if (imbalanceRatio > 0.6) explosionScore += 10;
      if (imbalanceRatio > 0.7) explosionScore += 20;
      if (imbalanceRatio > 0.8) explosionScore += 30;
      if (imbalanceRatio > 0.9) explosionScore += 50;

      const largestBidVol = largestBidWall.price * largestBidWall.size;
      const largestAskVol = largestAskWall.price * largestAskWall.size;
      
      if (largestBidVol > largestAskVol * 2) explosionScore += 20;
      if (largestBidVol > largestAskVol * 5) explosionScore += 30;
      if (largestBidVol > largestAskVol * 10) explosionScore += 50;

      if (largestBidWall.distance > 0.8) explosionScore -= 20;

      explosionScore = Math.max(0, Math.min(100, explosionScore));

      // ------------------------------------------------------------------
      // VIRTUAL TRADING LOGIC
      // ------------------------------------------------------------------
      const TRADE_AMOUNT_USD = 1000;
      const TP_PERCENT = 0.005; // +0.5%
      const SL_PERCENT = -0.005; // -0.5%
      const MAX_DURATION_MS = 120000; // 2 minutes

      if (openTradesRef.current[symbol]) {
        // Manage existing trade
        const trade = openTradesRef.current[symbol];
        const pnlPercent = (currentPrice - trade.entryPrice) / trade.entryPrice;
        const durationMs = Date.now() - trade.startTime;

        let closeReason = null;
        if (pnlPercent >= TP_PERCENT) closeReason = 'TP';
        else if (pnlPercent <= SL_PERCENT) closeReason = 'SL';
        else if (durationMs > MAX_DURATION_MS) closeReason = 'TIME';

        if (closeReason) {
          const pnlUsd = TRADE_AMOUNT_USD * pnlPercent;
          tradeHistoryRef.current.unshift({
            symbol,
            entryPrice: trade.entryPrice,
            exitPrice: currentPrice,
            pnlPercent: pnlPercent * 100,
            pnlUsd,
            reason: closeReason,
            durationMs,
            closeTime: Date.now()
          });
          
          // Keep only last 50 history items
          if (tradeHistoryRef.current.length > 50) tradeHistoryRef.current.pop();
          
          delete openTradesRef.current[symbol];
          tradesChanged = true;
        }
      } else {
        // Open new trade if score is high enough (>= 80)
        if (explosionScore >= 80) {
          openTradesRef.current[symbol] = {
            entryPrice: currentPrice,
            startTime: Date.now(),
            scoreAtEntry: explosionScore
          };
          tradesChanged = true;
        }
      }
      // ------------------------------------------------------------------

      if (explosionScore >= 50 || openTradesRef.current[symbol]) {
        allResults.push({
          symbol,
          price: currentPrice,
          imbalance: imbalanceRatio * 100,
          bidVolume,
          askVolume,
          largestBidWall,
          largestAskWall,
          score: explosionScore,
          isActiveTrade: !!openTradesRef.current[symbol]
        });
      }
    }

    allResults.sort((a, b) => {
      // Prioritize active trades, then by score
      if (a.isActiveTrade && !b.isActiveTrade) return -1;
      if (!a.isActiveTrade && b.isActiveTrade) return 1;
      return b.score - a.score;
    });
    
    setResults(allResults);
    if (tradesChanged) {
      setTradesUpdateTick(t => t + 1); // Trigger re-render to show new trades
    }
  };

  const formatVolume = (vol) => {
    if (vol > 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
    if (vol > 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#ff3b30', margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={24} className={isLive ? "pulse-icon" : ""} /> Radar Temps Réel (Top 30)
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Connexion WebSocket directe aux carnets d'ordres (Latence 0s)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={toggleLiveRadar}
            style={{
              background: isLive ? 'rgba(255, 59, 48, 0.1)' : '#ff3b30',
              color: isLive ? '#ff3b30' : '#fff',
              border: `1px solid ${isLive ? '#ff3b30' : 'transparent'}`,
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            {isLive ? (
              <>
                <Radio size={18} className="pulse-icon" /> 
                Radar Actif ({trackedSymbolsCount} symboles)
              </>
            ) : (
              <>
                <Play size={18} /> Activer le Radar Temps Réel
              </>
            )}
          </button>
        </div>
      </div>

      {isLive && results.length === 0 && (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>
          <Radio size={32} className="pulse-icon" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <div>Écoute du marché en cours... En attente d'une manipulation.</div>
        </div>
      )}

      {/* PAPER TRADING PANEL */}
      {(Object.keys(openTradesRef.current).length > 0 || tradeHistoryRef.current.length > 0) && (
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Active Trades */}
          <div style={{ flex: 1, minWidth: '300px', background: 'rgba(10, 26, 33, 0.8)', borderRadius: '12px', border: '1px solid #3b82f6', padding: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#3b82f6', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} /> Positions Long en Cours
            </h3>
            {Object.keys(openTradesRef.current).length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Aucune position ouverte. En attente d'anomalie (&gt;80%)...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(openTradesRef.current).map(([sym, trade]) => {
                  const currentItem = results.find(r => r.symbol === sym);
                  const currentPrice = currentItem ? currentItem.price : trade.entryPrice;
                  const currentPnl = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
                  const durationSecs = Math.floor((Date.now() - trade.startTime) / 1000);
                  
                  return (
                    <div key={sym} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>{sym.replace('USDT', '')}</span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Entrée: ${trade.entryPrice.toFixed(4)} ({durationSecs}s)</span>
                      </div>
                      <div style={{ fontWeight: 'bold', color: currentPnl >= 0 ? '#10b981' : '#ef4444' }}>
                        {currentPnl > 0 ? '+' : ''}{currentPnl.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trade History */}
          <div style={{ flex: 1, minWidth: '300px', background: 'rgba(10, 26, 33, 0.8)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <span>Historique Démo (Bot)</span>
              {tradeHistoryRef.current.length > 0 && (() => {
                const totalPnl = tradeHistoryRef.current.reduce((acc, t) => acc + t.pnlUsd, 0);
                return (
                  <span style={{ color: totalPnl >= 0 ? '#10b981' : '#ef4444', fontSize: '1rem' }}>
                    Total: {totalPnl > 0 ? '+' : ''}${totalPnl.toFixed(2)}
                  </span>
                )
              })()}
            </h3>
            {tradeHistoryRef.current.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>L'historique des trades fermés apparaîtra ici.</div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.85rem', color: '#f8fafc', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ paddingBottom: '8px' }}>Token</th>
                    <th style={{ paddingBottom: '8px' }}>Raison</th>
                    <th style={{ paddingBottom: '8px', textAlign: 'right' }}>PnL (%)</th>
                    <th style={{ paddingBottom: '8px', textAlign: 'right' }}>PnL ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeHistoryRef.current.map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{t.symbol.replace('USDT', '')}</td>
                      <td style={{ padding: '8px 0', color: t.reason === 'TP' ? '#10b981' : t.reason === 'SL' ? '#ef4444' : '#facc15' }}>{t.reason}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: t.pnlPercent >= 0 ? '#10b981' : '#ef4444' }}>
                        {t.pnlPercent > 0 ? '+' : ''}{t.pnlPercent.toFixed(2)}%
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: t.pnlUsd >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        {t.pnlUsd > 0 ? '+' : ''}${t.pnlUsd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {results.map((item, idx) => {
            const isCritical = item.score >= 80;
            return (
              <div key={idx} style={{ 
                background: isCritical ? 'rgba(255, 59, 48, 0.1)' : item.isActiveTrade ? 'rgba(59, 130, 246, 0.1)' : 'rgba(10, 26, 33, 0.8)', 
                borderRadius: '12px', 
                padding: '1.5rem', 
                border: `1px solid ${isCritical ? 'rgba(255, 59, 48, 0.5)' : item.isActiveTrade ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.05)'}`,
                position: 'relative',
                overflow: 'hidden'
              }}>
                {(isCritical || item.isActiveTrade) && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: isCritical ? '#ff3b30' : '#3b82f6', animation: 'pulse 2s infinite' }} />
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{item.symbol.replace('USDT', '')}</h3>
                    <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>${item.price.toFixed(4)}</span>
                  </div>
                  <div style={{ 
                    background: item.score >= 80 ? '#ff3b30' : item.score >= 60 ? '#facc15' : '#10b981',
                    color: item.score >= 60 ? '#000' : '#fff',
                    padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.9rem'
                  }}>
                    {item.score}% ALERT
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Imbalance Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px', color: '#94a3b8' }}>
                      <span>Bids (Acheteurs) : {item.imbalance.toFixed(1)}%</span>
                      <span>Asks (Vendeurs)</span>
                    </div>
                    <div style={{ display: 'flex', width: '100%', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.imbalance}%`, background: '#10b981' }} />
                      <div style={{ width: `${100 - item.imbalance}%`, background: '#ef4444' }} />
                    </div>
                  </div>

                  {/* Walls Details */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#10b981' }}>
                      <TrendingUp size={16} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Mur d'Achat Massif (Spoof Wall)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f8fafc' }}>
                      <span>Prix: ${item.largestBidWall.price.toFixed(4)}</span>
                      <span>Vol: {formatVolume(item.largestBidWall.size * item.largestBidWall.price)}</span>
                      <span style={{ color: '#10b981' }}>(-{item.largestBidWall.distance.toFixed(2)}%)</span>
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ fontSize: '0.85rem', color: '#ef4444', marginBottom: '4px' }}>Mur de Vente (Résistance)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f8fafc' }}>
                      <span>Prix: ${item.largestAskWall.price.toFixed(4)}</span>
                      <span>Vol: {formatVolume(item.largestAskWall.size * item.largestAskWall.price)}</span>
                      <span style={{ color: '#ef4444' }}>(+{item.largestAskWall.distance.toFixed(2)}%)</span>
                    </div>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}

      {!isLive && results.length === 0 && (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '4rem 0', background: 'rgba(10, 26, 33, 0.5)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <AlertTriangle size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <div>Activez le radar Temps Réel pour traquer les murs d'achats.</div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-icon { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
        .pulse-icon { animation: pulse-icon 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}} />
    </div>
  );
};

export default ExplosionScanner;
