import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  RefreshCw, 
  Award, 
  Filter, 
  BarChart3, 
  Zap, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Flame, 
  ShieldCheck, 
  Layers, 
  Trophy, 
  DollarSign, 
  Sparkles,
  Download
} from 'lucide-react';

function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val) || val === 0) return '$0.00';
  if (val < 0.00001) return `$${val.toFixed(8)}`;
  if (val < 0.001) return `$${val.toFixed(6)}`;
  if (val < 1) return `$${val.toFixed(4)}`;
  if (val < 100) return `$${val.toFixed(2)}`;
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMillions(val) {
  if (val === undefined || val === null || isNaN(val)) return '$0';
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  if (abs >= 1000000000) return `${sign}$${(abs / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

// 🌐 BATCH FETCHER FOR BYBIT DAILY HISTORICAL KLINES (1D)
async function fetchDailyKlines(symbol, limit = 370) {
  const clean = symbol.replace('USDT', '').toUpperCase();
  const pairs = [`${clean}USDT`, `1000${clean}USDT`];
  
  for (const p of pairs) {
    try {
      const res = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${p}&interval=D&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        const list = data?.result?.list || [];
        if (list.length > 0) {
          // Sort chronological: oldest to newest
          return list.map(item => ({
            time: Math.floor(parseInt(item[0]) / 1000),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5]),
            turnover: parseFloat(item[6] || 0)
          })).reverse();
        }
      }
    } catch (_) {}
  }
  return [];
}

export default function MarketMacroPerformanceTracker() {
  const [loading, setLoading] = useState(true);
  const [progressMsg, setProgressMsg] = useState('Chargement du Top 500 Bybit...');
  const [benchmarkMode, setBenchmarkMode] = useState('usdt'); // 'usdt' | 'btc' | 'sol'
  const [sortField, setSortField] = useState('score'); // 'score' | 'p1w' | 'p1m' | 'p3m' | 'p6m' | 'p1y'
  const [sortDirection, setSortDirection] = useState('desc'); // 'desc' | 'asc'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'gainers' | 'consistent'
  const [tokensData, setTokensData] = useState([]);
  const [benchmarkStats, setBenchmarkStats] = useState({
    btc: { price: 0, p1w: 0, p1m: 0, p3m: 0, p6m: 0, p1y: 0 },
    sol: { price: 0, p1w: 0, p1m: 0, p3m: 0, p6m: 0, p1y: 0 }
  });

  // Calculate percentage return between past index and current price
  const calculateReturn = (klines, daysAgo) => {
    if (!klines || klines.length < 2) return null;
    const curClose = klines[klines.length - 1].close;
    if (!curClose || curClose <= 0) return null;

    const targetIdx = Math.max(0, klines.length - 1 - daysAgo);
    const pastClose = klines[targetIdx]?.close || klines[0]?.close;
    if (!pastClose || pastClose <= 0) return null;

    return ((curClose - pastClose) / pastClose) * 100;
  };

  // Master Loader: Fetches Top 500 Bybit Tickers + Historical Daily Data
  const loadMarketMacroData = useCallback(async () => {
    try {
      setLoading(true);
      setProgressMsg('Analyse des 500 plus gros volumes de Bybit...');

      // 1. Fetch all Bybit Live Tickers
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      if (!res.ok) throw new Error('Impossible de charger les tickers Bybit');
      
      const json = await res.json();
      const rawList = json?.result?.list || [];

      // Sort by 24h Turnover and take strictly Top 500
      const top500Pairs = rawList
        .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('USDC'))
        .sort((a, b) => parseFloat(b.turnover24h || 0) - parseFloat(a.turnover24h || 0))
        .slice(0, 500);

      // 2. Fetch BTC & SOL Benchmarks First
      setProgressMsg('Calcul des benchmarks BTC et SOL (1W, 1M, 3M, 6M, 1Y)...');
      const [btcD, solD] = await Promise.all([
        fetchDailyKlines('BTCUSDT', 370),
        fetchDailyKlines('SOLUSDT', 370)
      ]);

      const btcB = {
        price: btcD[btcD.length - 1]?.close || 0,
        p1w: calculateReturn(btcD, 7) || 0,
        p1m: calculateReturn(btcD, 30) || 0,
        p3m: calculateReturn(btcD, 90) || 0,
        p6m: calculateReturn(btcD, 180) || 0,
        p1y: calculateReturn(btcD, 365) || 0,
      };

      const solB = {
        price: solD[solD.length - 1]?.close || 0,
        p1w: calculateReturn(solD, 7) || 0,
        p1m: calculateReturn(solD, 30) || 0,
        p3m: calculateReturn(solD, 90) || 0,
        p6m: calculateReturn(solD, 180) || 0,
        p1y: calculateReturn(solD, 365) || 0,
      };

      setBenchmarkStats({ btc: btcB, sol: solB });

      // 3. Process ALL 500 Tokens in parallel batches
      const results = [];
      const batchSize = 25; // Optimized batch size for ultra-fast parallel fetching
      const targetList = top500Pairs.slice(0, 500); // Strictement les 500 tokens Bybit

      for (let i = 0; i < targetList.length; i += batchSize) {
        const batch = targetList.slice(i, i + batchSize);
        setProgressMsg(`Calcul des performances: ${Math.min(i + batch.length, targetList.length)} / ${targetList.length} tokens...`);

        const batchPromises = batch.map(async (t) => {
          const sym = t.symbol;
          const clean = sym.replace('USDT', '');
          const curPrice = parseFloat(t.lastPrice || 0);
          const turnover24h = parseFloat(t.turnover24h || 0);

          const klines = await fetchDailyKlines(sym, 370);
          if (!klines || klines.length < 5) return null;

          const p1w = calculateReturn(klines, 7);
          const p1m = calculateReturn(klines, 30);
          const p3m = calculateReturn(klines, 90);
          const p6m = calculateReturn(klines, 180);
          const p1y = calculateReturn(klines, 365);

          // Composite Macro Alpha Score (Weighted combination of multi-horizons)
          const w1 = (p1w || 0) * 1.0;
          const w2 = (p1m || 0) * 1.5;
          const w3 = (p3m || 0) * 1.2;
          const w4 = (p6m || 0) * 1.0;
          const w5 = (p1y || 0) * 0.8;
          
          const compositeScore = (w1 + w2 + w3 + w4 + w5) / 5.5;

          return {
            symbol: sym,
            cleanSymbol: clean,
            price: curPrice,
            turnover24h,
            p1w: p1w !== null ? p1w : 0,
            p1m: p1m !== null ? p1m : 0,
            p3m: p3m !== null ? p3m : 0,
            p6m: p6m !== null ? p6m : 0,
            p1y: p1y !== null ? p1y : 0,
            compositeScore: parseFloat(compositeScore.toFixed(2)),
            has1y: p1y !== null
          };
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(r => { if (r) results.push(r); });
      }

      setTokensData(results);
    } catch (e) {
      console.error('Error loading Market Macro Performance data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketMacroData();
  }, [loadMarketMacroData]);

  // Adjust values according to Benchmark Mode (USDT vs BTC vs SOL)
  const processedTokens = useMemo(() => {
    return tokensData.map(t => {
      let v1w = t.p1w;
      let v1m = t.p1m;
      let v3m = t.p3m;
      let v6m = t.p6m;
      let v1y = t.p1y;

      if (benchmarkMode === 'btc') {
        v1w -= benchmarkStats.btc.p1w;
        v1m -= benchmarkStats.btc.p1m;
        v3m -= benchmarkStats.btc.p3m;
        v6m -= benchmarkStats.btc.p6m;
        v1y -= benchmarkStats.btc.p1y;
      } else if (benchmarkMode === 'sol') {
        v1w -= benchmarkStats.sol.p1w;
        v1m -= benchmarkStats.sol.p1m;
        v3m -= benchmarkStats.sol.p3m;
        v6m -= benchmarkStats.sol.p6m;
        v1y -= benchmarkStats.sol.p1y;
      }

      const score = (v1w * 1.0 + v1m * 1.5 + v3m * 1.2 + v6m * 1.0 + v1y * 0.8) / 5.5;

      return {
        ...t,
        calc1w: v1w,
        calc1m: v1m,
        calc3m: v3m,
        calc6m: v6m,
        calc1y: v1y,
        calcScore: score
      };
    });
  }, [tokensData, benchmarkMode, benchmarkStats]);

  // Filter and Sort Top 100 Outperforming Tokens
  const displayedTop100 = useMemo(() => {
    let list = [...processedTokens];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase().trim();
      list = list.filter(t => t.cleanSymbol.includes(q) || t.symbol.includes(q));
    }

    // Category filter
    if (selectedCategory === 'consistent') {
      list = list.filter(t => t.calc1w > 0 && t.calc1m > 0 && t.calc3m > 0);
    } else if (selectedCategory === 'gainers') {
      list = list.filter(t => t.calc1m > 15 || t.calc1w > 10);
    }

    // Dynamic Sort
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortField === 'score') { valA = a.calcScore; valB = b.calcScore; }
      else if (sortField === 'p1w') { valA = a.calc1w; valB = b.calc1w; }
      else if (sortField === 'p1m') { valA = a.calc1m; valB = b.calc1m; }
      else if (sortField === 'p3m') { valA = a.calc3m; valB = b.calc3m; }
      else if (sortField === 'p6m') { valA = a.calc6m; valB = b.calc6m; }
      else if (sortField === 'p1y') { valA = a.calc1y; valB = b.calc1y; }

      return sortDirection === 'desc' ? valB - valA : valA - valB;
    });

    return list.slice(0, 100);
  }, [processedTokens, searchQuery, selectedCategory, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderPerfCell = (val) => {
    if (val === null || val === undefined || isNaN(val)) return <span style={{ color: '#64748b' }}>-</span>;
    const isPos = val >= 0;
    const abs = Math.abs(val);

    let bg = 'transparent';
    let col = isPos ? '#10b981' : '#f43f5e';
    let border = 'none';

    if (abs >= 50) {
      bg = isPos ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
      border = `1px solid ${col}40`;
    }

    return (
      <span style={{
        background: bg,
        color: col,
        border: border,
        padding: '2px 6px',
        borderRadius: '4px',
        fontWeight: '800',
        fontSize: '0.74rem'
      }}>
        {isPos ? '+' : ''}{val.toFixed(2)}%
      </span>
    );
  };

  return (
    <div style={{
      maxWidth: '1600px',
      margin: '0 auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      fontFamily: 'JetBrains Mono, monospace',
      color: '#f8fafc'
    }}>
      {/* 🧭 Master Header & Title */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(8, 15, 28, 0.98) 0%, rgba(5, 10, 20, 0.99) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '14px',
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 0 35px rgba(0, 0, 0, 0.7)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981, #0284c7)',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.6)'
          }}>
            <Calendar size={20} color="#000000" />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: '900', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>MARCHÉ PERFORMANCE</span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', border: '1px solid #10b981' }}>
                TOP 100 SURPERFORMANTS
              </span>
            </div>
            <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginTop: '2px' }}>
              Analyse macro multi-horizons (1W · 1M · 3M · 6M · 1Y) sur les 500 actifs de Bybit
            </div>
          </div>
        </div>

        {/* Action Buttons: Benchmark Mode Switcher (USDT vs BTC vs SOL) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.6)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setBenchmarkMode('usdt')}
              style={{
                background: benchmarkMode === 'usdt' ? '#10b981' : 'transparent',
                color: benchmarkMode === 'usdt' ? '#000000' : '#94a3b8',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '5px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              💵 PRIX USDT
            </button>
            <button
              onClick={() => setBenchmarkMode('btc')}
              style={{
                background: benchmarkMode === 'btc' ? '#f7931a' : 'transparent',
                color: benchmarkMode === 'btc' ? '#000000' : '#94a3b8',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '5px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ₿ vs BTC
            </button>
            <button
              onClick={() => setBenchmarkMode('sol')}
              style={{
                background: benchmarkMode === 'sol' ? '#a855f7' : 'transparent',
                color: benchmarkMode === 'sol' ? '#000000' : '#94a3b8',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '5px',
                fontSize: '0.72rem',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              ◎ vs SOL
            </button>
          </div>

          <button
            onClick={loadMarketMacroData}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              padding: '5px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem',
              fontWeight: '700'
            }}
            title="Rafraîchir les données de marché"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* 📊 BENCHMARK REFERENCE CARDS (BTC & SOL MACRO RETURNS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
        {/* BTC CARD */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(247, 147, 26, 0.3)',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f7931a', fontWeight: '900', fontSize: '0.82rem' }}>
              <span>₿ BITCOIN (BTC/USDT)</span>
              <span style={{ color: '#cbd5e1', fontSize: '0.74rem' }}>{formatCurrency(benchmarkStats.btc.price)}</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '2px' }}>Benchmark Référence Marché</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.70rem', fontWeight: '800' }}>
            <span>1W: <strong style={{ color: benchmarkStats.btc.p1w >= 0 ? '#10b981' : '#f43f5e' }}>{benchmarkStats.btc.p1w >= 0 ? '+' : ''}{benchmarkStats.btc.p1w.toFixed(1)}%</strong></span>
            <span>1M: <strong style={{ color: benchmarkStats.btc.p1m >= 0 ? '#10b981' : '#f43f5e' }}>{benchmarkStats.btc.p1m >= 0 ? '+' : ''}{benchmarkStats.btc.p1m.toFixed(1)}%</strong></span>
            <span>1Y: <strong style={{ color: benchmarkStats.btc.p1y >= 0 ? '#10b981' : '#f43f5e' }}>{benchmarkStats.btc.p1y >= 0 ? '+' : ''}{benchmarkStats.btc.p1y.toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* SOL CARD */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a855f7', fontWeight: '900', fontSize: '0.82rem' }}>
              <span>◎ SOLANA (SOL/USDT)</span>
              <span style={{ color: '#cbd5e1', fontSize: '0.74rem' }}>{formatCurrency(benchmarkStats.sol.price)}</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '2px' }}>Benchmark Écosystème Solana</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.70rem', fontWeight: '800' }}>
            <span>1W: <strong style={{ color: benchmarkStats.sol.p1w >= 0 ? '#10b981' : '#f43f5e' }}>{benchmarkStats.sol.p1w >= 0 ? '+' : ''}{benchmarkStats.sol.p1w.toFixed(1)}%</strong></span>
            <span>1M: <strong style={{ color: benchmarkStats.sol.p1m >= 0 ? '#10b981' : '#f43f5e' }}>{benchmarkStats.sol.p1m >= 0 ? '+' : ''}{benchmarkStats.sol.p1m.toFixed(1)}%</strong></span>
            <span>1Y: <strong style={{ color: benchmarkStats.sol.p1y >= 0 ? '#10b981' : '#f43f5e' }}>{benchmarkStats.sol.p1y >= 0 ? '+' : ''}{benchmarkStats.sol.p1y.toFixed(1)}%</strong></span>
          </div>
        </div>
      </div>

      {/* 🔍 FILTER & QUICK PRESETS BAR */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Rechercher un token (ex: STX, TRUMP, SUI)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '6px 12px 6px 30px',
              color: '#ffffff',
              fontSize: '0.74rem',
              width: '100%',
              outline: 'none'
            }}
          />
        </div>

        {/* Quick Sorting Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '800' }}>TRI RAPIDE :</span>
          {[
            { id: 'score', label: '👑 SCORE COMPOSITE' },
            { id: 'p1w', label: '📅 1W (1 SEM)' },
            { id: 'p1m', label: '📅 1M (1 MOIS)' },
            { id: 'p3m', label: '📅 3M (3 MOIS)' },
            { id: 'p6m', label: '📅 6M (6 MOIS)' },
            { id: 'p1y', label: '📅 1Y (1 AN)' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => handleSort(btn.id)}
              style={{
                background: sortField === btn.id ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
                color: sortField === btn.id ? '#000000' : '#cbd5e1',
                border: `1px solid ${sortField === btn.id ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                padding: '4px 9px',
                borderRadius: '5px',
                fontSize: '0.68rem',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{btn.label}</span>
              {sortField === btn.id && (sortDirection === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
            </button>
          ))}
        </div>
      </div>

      {/* 📋 MASTER MACRO PERFORMANCE TABLE (TOP 100) */}
      <div style={{
        background: 'rgba(8, 14, 24, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 0 25px rgba(0,0,0,0.5)'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#10b981' }} />
            <div style={{ fontSize: '0.86rem', fontWeight: '900', color: '#f8fafc' }}>{progressMsg}</div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>Calcul en direct depuis les klines journalières Bybit V5</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.95)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '10px 14px', width: '60px' }}>RANG</th>
                  <th style={{ padding: '10px 14px' }}>TOKEN</th>
                  <th style={{ padding: '10px 14px' }}>PRIX USDT</th>
                  <th style={{ padding: '10px 14px', cursor: 'pointer', color: sortField === 'p1w' ? '#10b981' : '#94a3b8' }} onClick={() => handleSort('p1w')}>
                    1W (7J) {sortField === 'p1w' && (sortDirection === 'desc' ? '▼' : '▲')}
                  </th>
                  <th style={{ padding: '10px 14px', cursor: 'pointer', color: sortField === 'p1m' ? '#10b981' : '#94a3b8' }} onClick={() => handleSort('p1m')}>
                    1M (30J) {sortField === 'p1m' && (sortDirection === 'desc' ? '▼' : '▲')}
                  </th>
                  <th style={{ padding: '10px 14px', cursor: 'pointer', color: sortField === 'p3m' ? '#10b981' : '#94a3b8' }} onClick={() => handleSort('p3m')}>
                    3M (90J) {sortField === 'p3m' && (sortDirection === 'desc' ? '▼' : '▲')}
                  </th>
                  <th style={{ padding: '10px 14px', cursor: 'pointer', color: sortField === 'p6m' ? '#10b981' : '#94a3b8' }} onClick={() => handleSort('p6m')}>
                    6M (180J) {sortField === 'p6m' && (sortDirection === 'desc' ? '▼' : '▲')}
                  </th>
                  <th style={{ padding: '10px 14px', cursor: 'pointer', color: sortField === 'p1y' ? '#10b981' : '#94a3b8' }} onClick={() => handleSort('p1y')}>
                    1Y (365J) {sortField === 'p1y' && (sortDirection === 'desc' ? '▼' : '▲')}
                  </th>
                  <th style={{ padding: '10px 14px', cursor: 'pointer', color: sortField === 'score' ? '#facc15' : '#94a3b8' }} onClick={() => handleSort('score')}>
                    SCORE MACRO {sortField === 'score' && (sortDirection === 'desc' ? '▼' : '▲')}
                  </th>
                  <th style={{ padding: '10px 14px' }}>VOLUME 24H</th>
                </tr>
              </thead>
              <tbody>
                {displayedTop100.map((token, idx) => {
                  const isTop3 = idx < 3;
                  const isTop10 = idx < 10;

                  return (
                    <tr
                      key={token.symbol}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isTop3 ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isTop3 ? 'rgba(16, 185, 129, 0.04)' : 'transparent'}
                    >
                      {/* Rank */}
                      <td style={{ padding: '8px 14px', fontWeight: '900', color: isTop3 ? '#10b981' : (isTop10 ? '#38bdf8' : '#94a3b8') }}>
                        {idx === 0 ? '👑 #1' : (idx === 1 ? '🥈 #2' : (idx === 2 ? '🥉 #3' : `#${idx + 1}`))}
                      </td>

                      {/* Token Symbol */}
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '900', color: '#ffffff', fontSize: '0.82rem' }}>{token.cleanSymbol}</span>
                          <span style={{ color: '#64748b', fontSize: '0.65rem' }}>/USDT</span>
                        </div>
                      </td>

                      {/* Price */}
                      <td style={{ padding: '8px 14px', color: '#cbd5e1', fontWeight: '800' }}>
                        {formatCurrency(token.price)}
                      </td>

                      {/* 1W */}
                      <td style={{ padding: '8px 14px' }}>{renderPerfCell(token.calc1w)}</td>

                      {/* 1M */}
                      <td style={{ padding: '8px 14px' }}>{renderPerfCell(token.calc1m)}</td>

                      {/* 3M */}
                      <td style={{ padding: '8px 14px' }}>{renderPerfCell(token.calc3m)}</td>

                      {/* 6M */}
                      <td style={{ padding: '8px 14px' }}>{renderPerfCell(token.calc6m)}</td>

                      {/* 1Y */}
                      <td style={{ padding: '8px 14px' }}>{renderPerfCell(token.calc1y)}</td>

                      {/* Score Macro Composite */}
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{
                          background: 'rgba(250, 204, 21, 0.15)',
                          color: '#facc15',
                          border: '1px solid rgba(250, 204, 21, 0.4)',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontWeight: '900',
                          fontSize: '0.74rem'
                        }}>
                          +{token.calcScore.toFixed(1)} pts
                        </span>
                      </td>

                      {/* Volume 24H */}
                      <td style={{ padding: '8px 14px', color: '#94a3b8', fontSize: '0.70rem' }}>
                        {formatMillions(token.turnover24h)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
