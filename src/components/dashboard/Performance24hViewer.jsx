import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, ArrowUpRight, ArrowDownRight, Search, ArrowUpDown, Flame, RefreshCw } from 'lucide-react';

const Performance24hViewer = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickers, setTickers] = useState([]);
  const [solGainUsdt, setSolGainUsdt] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'solGain', direction: 'desc' });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPerformanceData = async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      setError(null);
      const url = 'https://api.bybit.com/v5/market/tickers?category=spot';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erreur API Bybit: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.retCode !== 0 || !data.result || !data.result.list) {
        throw new Error('Format de données inattendu de l\'API Bybit');
      }

      const list = data.result.list;
      
      // Isoler le SOLUSDT pour avoir le gain de référence
      const solTicker = list.find(t => t.symbol === 'SOLUSDT');
      const solUsdtGain = solTicker ? Number(solTicker.price24hPcnt) : 0;
      setSolGainUsdt(solUsdtGain);

      // Traiter et filtrer la liste
      const processedList = list
        .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('DOWN') && !t.symbol.includes('UP') && t.symbol !== 'USDCUSDT')
        .map(t => {
          const usdtGain = Number(t.price24hPcnt);
          const solGain = ((1 + usdtGain) / (1 + solUsdtGain)) - 1;
          
          return {
            symbol: t.symbol,
            baseCoin: t.symbol.replace('USDT', ''),
            lastPrice: Number(t.lastPrice),
            volume24h: Number(t.turnover24h),
            usdtGain: usdtGain,
            solGain: solGain
          };
        })
        .filter(t => t.volume24h > 100000);

      setTickers(processedList);
      setLastUpdate(new Date());
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
    // Scan every 1 minute
    const intervalId = setInterval(() => fetchPerformanceData(false), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredTickers = useMemo(() => {
    let filterableTickers = [...tickers];

    if (searchTerm) {
      filterableTickers = filterableTickers.filter(t => 
        t.baseCoin.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortConfig.key) {
      filterableTickers.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filterableTickers;
  }, [tickers, searchTerm, sortConfig]);

  const formatPercent = (val) => {
    return (val * 100).toFixed(2) + '%';
  };

  const formatCurrency = (val) => {
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
    if (val >= 1000) return '$' + (val / 1000).toFixed(2) + 'k';
    return '$' + val.toFixed(2);
  };

  const getGainColor = (val) => {
    if (val > 0.05) return '#10b981'; // Emerald 500
    if (val > 0) return '#34d399'; // Emerald 400
    if (val < -0.05) return '#ef4444'; // Red 500
    if (val < 0) return '#f87171'; // Red 400
    return '#94a3b8'; // Slate 400
  };

  return (
    <div style={{ padding: '20px', color: '#fff', minHeight: '100vh', background: 'transparent' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#a855f7' }}>
            <Flame size={28} color="#f97316" /> 24H PERFORMANCE TRACKER
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Vue comparative des performances USDT et SOL (Gain SOL : {formatPercent(solGainUsdt)})
            {lastUpdate && <span style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>Maj: {lastUpdate.toLocaleTimeString()}</span>}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <Search size={18} color="#64748b" />
            </div>
            <input
              type="text"
              placeholder="Rechercher (ex: JUP)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '250px',
                padding: '10px 10px 10px 35px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                outline: 'none',
                fontFamily: 'monospace'
              }}
            />
          </div>
          <button 
            onClick={() => fetchPerformanceData(true)}
            disabled={isRefreshing}
            style={{
              background: '#a855f7', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', 
              fontWeight: 'bold', cursor: isRefreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              opacity: isRefreshing ? 0.7 : 1, transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            {isRefreshing ? 'SCANNING...' : 'SCAN'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '15px', borderRadius: '8px', color: '#f87171', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* TABLE */}
      <div style={{ background: 'rgba(25, 30, 40, 0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '0 20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#cbd5e1' }}>
            <thead>
              <tr>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => handleSort('baseCoin')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>TOKEN <ArrowUpDown size={12}/></div>
                </th>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('lastPrice')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>PRIX <ArrowUpDown size={12}/></div>
                </th>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('volume24h')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>VOL 24H <ArrowUpDown size={12}/></div>
                </th>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#38bdf8', fontSize: '0.8rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('usdtGain')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>GAIN vs USDT (24H) <ArrowUpDown size={12}/></div>
                </th>
                <th style={{ padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#c084fc', fontSize: '0.8rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('solGain')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>GAIN vs SOL (24H) <ArrowUpDown size={12}/></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && tickers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                      <Loader2 size={32} color="#a855f7" style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                    Chargement du marché...
                  </td>
                </tr>
              ) : sortedAndFilteredTickers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
                    Aucun token trouvé.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredTickers.map((t, idx) => (
                  <tr key={t.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.8rem', width: '25px' }}>{idx + 1}.</span>
                      {t.baseCoin}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontFamily: 'monospace', color: '#e2e8f0' }}>
                      ${t.lastPrice < 0.01 ? t.lastPrice.toFixed(6) : t.lastPrice < 1 ? t.lastPrice.toFixed(4) : t.lastPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                      {formatCurrency(t.volume24h)}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: getGainColor(t.usdtGain) }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        {t.usdtGain > 0 ? <ArrowUpRight size={14}/> : t.usdtGain < 0 ? <ArrowDownRight size={14}/> : null}
                        {formatPercent(t.usdtGain)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: getGainColor(t.solGain) }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        {t.solGain > 0 ? <ArrowUpRight size={14}/> : t.solGain < 0 ? <ArrowDownRight size={14}/> : null}
                        {formatPercent(t.solGain)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default Performance24hViewer;
