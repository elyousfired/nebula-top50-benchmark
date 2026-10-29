import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Target, Zap, Flame, RefreshCw, Volume2, VolumeX, Search, 
  ExternalLink, ArrowUpRight, ArrowDownRight, Activity, ShieldAlert,
  Clock, TrendingUp, Filter, Sparkles, CheckCircle2, ChevronRight, Copy, Check
} from 'lucide-react';
import { fetchTop500Symbols } from './logic/scanner';

// 🔊 Web Audio API Synthesizer pour alertes Cyber (sans dépendance externe)
function playPdhAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.exponentialRampToValueAtTime(987.77, now + 0.14); // B5
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.28); // E6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(329.63, now); // E4
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.28);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (_) {}
}

// Formatters
function formatPrice(p) {
  if (p === undefined || p === null || isNaN(p)) return '$0.00';
  if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(3)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  if (p >= 0.0001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

function formatVolumeUSDT(val) {
  if (!val || isNaN(val) || val <= 0) return '$0';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

const PDH_KLINE_CACHE = new Map();

export default function Top50PdhRadar({ top50Tokens = [], theme = 'classic' }) {
  const [tokensList, setTokensList] = useState([]);
  const [pdhDataMap, setPdhDataMap] = useState({});
  const [livePricesMap, setLivePricesMap] = useState({});
  const [priceFlashMap, setPriceFlashMap] = useState({});
  const [isLoadingPdh, setIsLoadingPdh] = useState(true);
  const [isUpdatingLive, setIsUpdatingLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('NEAR_1PCT'); // 'NEAR_1PCT' | 'IMMINENT' | 'BREAKOUT' | 'ALL'
  const [sortBy, setSortBy] = useState('DISTANCE'); // 'DISTANCE' | 'GAP' | 'RANK' | 'PRICE' | 'VOLUME'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Initialisation du radar PDH...');

  const prevPricesRef = useRef({});
  const alertedTokensRef = useRef(new Set());

  // 1. Initialisation de la liste des Top 50 du mois
  useEffect(() => {
    let sourceList = [];

    if (Array.isArray(top50Tokens) && top50Tokens.length > 0) {
      sourceList = top50Tokens.slice(0, 50);
    } else {
      try {
        const cached = localStorage.getItem('nebula_top50_month_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            sourceList = parsed.slice(0, 50);
          }
        }
      } catch (_) {}
    }

    if (sourceList.length > 0) {
      setTokensList(sourceList);
    } else {
      // Si le cache est vide (ex: premier chargement direct), charger les 50 meilleurs tokens Bybit spot par volume
      setLoadingMsg('Chargement des Top 50 Bybit en cours...');
      fetchTop500Symbols(true, 50)
        .then(res => {
          if (Array.isArray(res) && res.length > 0) {
            const fallback = res
              .filter(t => {
                const sym = (t.symbol || '').replace('USDT', '').toUpperCase();
                return sym !== 'BTC' && sym !== 'ETH' && !sym.endsWith('X');
              })
              .slice(0, 50)
              .map((t, idx) => ({
                rankMonth: idx + 1,
                symbol: t.symbol || `${t.cleanSymbol}USDT`,
                cleanSymbol: t.cleanSymbol || (t.symbol || '').replace('USDT', ''),
                scoreMonth: Math.round(50 - idx * 0.7),
                confMonth: 10,
                price: parseFloat(t.lastPrice || 0),
                turnover24h: parseFloat(t.turnover24h || 0),
                volume24h: parseFloat(t.volume24h || 0),
                p30d: parseFloat(t.price24hPcnt || 0) * 100
              }));
            setTokensList(fallback);
          }
        })
        .catch(() => {});
    }
  }, [top50Tokens]);

  // 2. Récupération des Daily Klines (PDH & PDL) pour chacun des 50 tokens
  const fetchPdhForTokens = useCallback(async (list) => {
    if (!list || list.length === 0) return;
    setIsLoadingPdh(true);
    setLoadingMsg(`Calcul du PDH (Previous Daily High) pour ${list.length} tokens...`);

    const newPdhMap = {};
    const BATCH_SIZE = 10;

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (token) => {
        const sym = token.symbol || `${token.cleanSymbol}USDT`;
        const cached = PDH_KLINE_CACHE.get(sym);
        const now = Date.now();

        if (cached && (now - cached.ts) < 180000) {
          return { symbol: sym, data: cached.data };
        }

        try {
          const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${sym}&interval=D&limit=3`);
          if (res.ok) {
            const json = await res.json();
            const klines = json.result?.list || [];
            if (klines.length >= 2) {
              // klines[0] = aujourd'hui, klines[1] = hier (Previous Day)
              const yesterday = klines[1];
              const today = klines[0];

              const pdh = parseFloat(yesterday[2]); // High hier = PDH
              const pdl = parseFloat(yesterday[3]); // Low hier = PDL
              const pdClose = parseFloat(yesterday[4]);
              const pdOpen = parseFloat(yesterday[1]);
              const pdVolume = parseFloat(yesterday[5]);

              const todayHigh = parseFloat(today[2]);
              const todayLow = parseFloat(today[3]);
              const todayOpen = parseFloat(today[1]);
              const candleClose = parseFloat(today[4]);

              const parsed = {
                pdh,
                pdl,
                pdClose,
                pdOpen,
                pdVolume,
                todayHigh,
                todayLow,
                todayOpen,
                candleClose
              };

              PDH_KLINE_CACHE.set(sym, { data: parsed, ts: now });
              return { symbol: sym, data: parsed };
            }
          }
        } catch (_) {}
        return null;
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(r => {
        if (r && r.data) {
          newPdhMap[r.symbol] = r.data;
        }
      });
    }

    setPdhDataMap(prev => ({ ...prev, ...newPdhMap }));
    setIsLoadingPdh(false);
  }, []);

  useEffect(() => {
    if (tokensList.length > 0) {
      fetchPdhForTokens(tokensList);
    }
  }, [tokensList, fetchPdhForTokens]);

  // 3. Récupération des Prix Live (USDT) via Bybit Tickers API en direct
  const fetchLiveTickers = useCallback(async () => {
    try {
      setIsUpdatingLive(true);
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
      if (res.ok) {
        const json = await res.json();
        const list = json.result?.list || [];
        const newPrices = {};
        const newFlashes = {};

        list.forEach(item => {
          const sym = item.symbol;
          const p = parseFloat(item.lastPrice || 0);
          if (p > 0) {
            newPrices[sym] = {
              price: p,
              price24hPcnt: parseFloat(item.price24hPcnt || 0) * 100,
              turnover24h: parseFloat(item.turnover24h || 0),
              volume24h: parseFloat(item.volume24h || 0),
              high24h: parseFloat(item.highPrice24h || 0),
              low24h: parseFloat(item.lowPrice24h || 0)
            };

            const prevP = prevPricesRef.current[sym]?.price;
            if (prevP && prevP !== p) {
              newFlashes[sym] = p > prevP ? 'green' : 'red';
            }
          }
        });

        prevPricesRef.current = newPrices;
        setLivePricesMap(newPrices);
        setPriceFlashMap(newFlashes);
        setLastUpdate(new Date().toLocaleTimeString());

        // Nettoyer les animations de flash après 1.2s
        setTimeout(() => setPriceFlashMap({}), 1200);
      }
    } catch (_) {}
    finally {
      setIsUpdatingLive(false);
    }
  }, []);

  // Déclenchement live polling
  useEffect(() => {
    fetchLiveTickers();
    if (!autoRefreshEnabled) return;
    const interval = setInterval(fetchLiveTickers, 4000);
    return () => clearInterval(interval);
  }, [fetchLiveTickers, autoRefreshEnabled]);

  // 4. Fusion des Données & Calcul du Gap vers le PDH
  const analyzedRows = useMemo(() => {
    let playedSoundThisTurn = false;

    return tokensList.map((token, idx) => {
      const sym = token.symbol || `${token.cleanSymbol}USDT`;
      const clean = token.cleanSymbol || sym.replace('USDT', '');
      const pdhInfo = pdhDataMap[sym] || null;
      const liveInfo = livePricesMap[sym] || null;

      const curPrice = liveInfo?.price || pdhInfo?.candleClose || token.price || 0;
      const pdh = pdhInfo?.pdh || 0;
      const pdl = pdhInfo?.pdl || 0;

      let gapPct = 0;
      let absDistPct = 999;
      let isWithin1Pct = false;
      let isImminent = false;
      let isBreakout = false;
      let isApproaching = false;

      if (curPrice > 0 && pdh > 0) {
        gapPct = ((curPrice - pdh) / pdh) * 100;
        absDistPct = Math.abs(curPrice - pdh) / pdh * 100;
        isWithin1Pct = absDistPct <= 1.0;
        isBreakout = curPrice >= pdh;
        isImminent = gapPct >= -0.5 && gapPct < 0;
        isApproaching = gapPct >= -1.0 && gapPct < -0.5;

        // Détection alerte sonore
        if (isWithin1Pct && soundEnabled && !alertedTokensRef.current.has(sym)) {
          alertedTokensRef.current.add(sym);
          if (!playedSoundThisTurn) {
            playPdhAlertSound();
            playedSoundThisTurn = true;
          }
        }
      }

      // Position dans le Range de la veille (PDL -> PDH)
      let rangeProgress = 50;
      if (pdh > pdl && pdl > 0) {
        rangeProgress = Math.max(0, Math.min(130, ((curPrice - pdl) / (pdh - pdl)) * 100));
      }

      return {
        rankMonth: token.rankMonth || idx + 1,
        symbol: sym,
        cleanSymbol: clean,
        scoreMonth: token.scoreMonth || 0,
        curPrice,
        pdh,
        pdl,
        gapPct,
        absDistPct,
        isWithin1Pct,
        isImminent,
        isBreakout,
        isApproaching,
        rangeProgress,
        p24h: liveInfo?.price24hPcnt || token.p1d || 0,
        turnover24h: liveInfo?.turnover24h || token.turnover24h || 0,
        volume24h: liveInfo?.volume24h || token.volume24h || 0,
        p30d: token.p30d || 0,
        flash: priceFlashMap[sym] || null
      };
    });
  }, [tokensList, pdhDataMap, livePricesMap, priceFlashMap, soundEnabled]);

  // 5. Filtrage & Tri
  const filteredRows = useMemo(() => {
    let list = [...analyzedRows];

    // Recherche
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(r => r.cleanSymbol.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q));
    }

    // Filtre de proximité PDH
    if (activeFilter === 'NEAR_1PCT') {
      list = list.filter(r => r.isWithin1Pct);
    } else if (activeFilter === 'IMMINENT') {
      list = list.filter(r => r.isImminent);
    } else if (activeFilter === 'BREAKOUT') {
      list = list.filter(r => r.isBreakout);
    }

    // Tri
    list.sort((a, b) => {
      if (sortBy === 'DISTANCE') return a.absDistPct - b.absDistPct;
      if (sortBy === 'GAP') return b.gapPct - a.gapPct;
      if (sortBy === 'RANK') return a.rankMonth - b.rankMonth;
      if (sortBy === 'PRICE') return b.curPrice - a.curPrice;
      if (sortBy === 'VOLUME') return b.turnover24h - a.turnover24h;
      return 0;
    });

    return list;
  }, [analyzedRows, searchTerm, activeFilter, sortBy]);

  // Statistiques KPIs
  const stats = useMemo(() => {
    const near1Count = analyzedRows.filter(r => r.isWithin1Pct).length;
    const imminentCount = analyzedRows.filter(r => r.isImminent).length;
    const breakoutCount = analyzedRows.filter(r => r.isBreakout).length;
    return {
      near1Count,
      imminentCount,
      breakoutCount,
      totalCount: analyzedRows.length
    };
  }, [analyzedRows]);

  const handleCopyList = () => {
    const nearTokens = analyzedRows.filter(r => r.isWithin1Pct).map(r => `${r.cleanSymbol} (Prix: $${r.curPrice} | PDH: $${r.pdh} | Écart: ${r.gapPct >= 0 ? '+' : ''}${r.gapPct.toFixed(2)}%)`).join('\n');
    navigator.clipboard.writeText(nearTokens || 'Aucun token à ≤ 1% du PDH');
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', color: '#fff' }}>
      
      {/* ── HEADER BANNER ─────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(13, 33, 43, 0.95) 0%, rgba(10, 26, 33, 0.95) 100%)',
        border: '1px solid rgba(0, 255, 136, 0.25)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              background: 'rgba(0, 255, 136, 0.15)',
              border: '1px solid rgba(0, 255, 136, 0.4)',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Target size={22} color="#00ff88" />
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: '900', letterSpacing: '0.5px', margin: 0, color: '#fff' }}>
              🎯 RADAR DE PROXIMITÉ PDH <span style={{ color: '#00ff88' }}>(TOP 50 MOIS)</span>
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#8892b0' }}>
            Monitoring live des 50 champions du mois par rapport à leur <strong>Previous Daily High (PDH)</strong> • Alerte de proximité : <strong>≤ 1.0%</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Sound Alert Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: soundEnabled ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${soundEnabled ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              color: soundEnabled ? '#00ff88' : '#888',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? 'BIP ALERTE (ON)' : 'BIP ALERTE (OFF)'}</span>
          </button>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            style={{
              background: autoRefreshEnabled ? 'rgba(0, 210, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${autoRefreshEnabled ? 'rgba(0, 210, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              color: autoRefreshEnabled ? '#00d2ff' : '#888',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={15} />
            <span>LIVE REFRESH: {autoRefreshEnabled ? 'AUTO (4s)' : 'PAUSE'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => {
              fetchPdhForTokens(tokensList);
              fetchLiveTickers();
            }}
            disabled={isLoadingPdh || isUpdatingLive}
            style={{
              background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 210, 255, 0.2))',
              border: '1px solid #00ff88',
              color: '#fff',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isLoadingPdh || isUpdatingLive ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} className={isLoadingPdh || isUpdatingLive ? 'animate-spin' : ''} />
            <span>ACTUALISER</span>
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* KPI 1: Near PDH (<= 1%) */}
        <div 
          onClick={() => setActiveFilter('NEAR_1PCT')}
          style={{
            background: activeFilter === 'NEAR_1PCT' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(13, 33, 43, 0.8)',
            border: `1px solid ${activeFilter === 'NEAR_1PCT' ? '#00ff88' : 'rgba(0, 255, 136, 0.3)'}`,
            borderRadius: '12px',
            padding: '1.2rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeFilter === 'NEAR_1PCT' ? '0 0 20px rgba(0, 255, 136, 0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#00ff88', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🔥 Proximité ≤ 1% du PDH
            </span>
            <Flame size={18} color="#00ff88" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#fff' }}>
            {stats.near1Count} <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: '500' }}>/ {stats.totalCount}</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#8892b0', marginTop: '4px' }}>
            Tokens en zone de compression maximale
          </div>
        </div>

        {/* KPI 2: Imminent Breakout (<= 0.5%) */}
        <div 
          onClick={() => setActiveFilter('IMMINENT')}
          style={{
            background: activeFilter === 'IMMINENT' ? 'rgba(250, 204, 21, 0.15)' : 'rgba(13, 33, 43, 0.8)',
            border: `1px solid ${activeFilter === 'IMMINENT' ? '#facc15' : 'rgba(250, 204, 21, 0.3)'}`,
            borderRadius: '12px',
            padding: '1.2rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeFilter === 'IMMINENT' ? '0 0 20px rgba(250, 204, 21, 0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚡ Breakout Imminent (≤ 0.5%)
            </span>
            <Zap size={18} color="#facc15" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#fff' }}>
            {stats.imminentCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#8892b0', marginTop: '4px' }}>
            À quelques poussières de percer le haut d'hier
          </div>
        </div>

        {/* KPI 3: Breakout en cours (> PDH) */}
        <div 
          onClick={() => setActiveFilter('BREAKOUT')}
          style={{
            background: activeFilter === 'BREAKOUT' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(13, 33, 43, 0.8)',
            border: `1px solid ${activeFilter === 'BREAKOUT' ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)'}`,
            borderRadius: '12px',
            padding: '1.2rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeFilter === 'BREAKOUT' ? '0 0 20px rgba(56, 189, 248, 0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🚀 Au-Dessus du PDH (&gt; 0%)
            </span>
            <TrendingUp size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: '#fff' }}>
            {stats.breakoutCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#8892b0', marginTop: '4px' }}>
            Tokens en extension haussière au-dessus du PDH
          </div>
        </div>

        {/* KPI 4: Total & Status */}
        <div style={{
          background: 'rgba(13, 33, 43, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📡 Flux Spot Bybit Direct
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
              <span style={{ fontSize: '0.65rem', color: '#00ff88', fontWeight: '800' }}>100% LIVE</span>
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>
            {lastUpdate || 'En cours...'}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#8892b0', marginTop: '4px' }}>
            Top 50 synchronisé avec le tableau du mois
          </div>
        </div>
      </div>

      {/* ── TOOLBAR (SEARCH + FILTERS + SORTS) ─────────────────────────── */}
      <div style={{
        background: 'rgba(13, 33, 43, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem'
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', minWidth: '240px' }}>
          <Search size={16} color="#888" />
          <input
            type="text"
            placeholder="Filtrer par token (SOL, SUI, DOGE...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '0.8rem',
              width: '100%'
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveFilter('NEAR_1PCT')}
            style={{
              background: activeFilter === 'NEAR_1PCT' ? 'rgba(0, 255, 136, 0.2)' : 'transparent',
              border: `1px solid ${activeFilter === 'NEAR_1PCT' ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
              color: activeFilter === 'NEAR_1PCT' ? '#00ff88' : '#888',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            🔥 Proximité ≤ 1% ({stats.near1Count})
          </button>

          <button
            onClick={() => setActiveFilter('IMMINENT')}
            style={{
              background: activeFilter === 'IMMINENT' ? 'rgba(250, 204, 21, 0.2)' : 'transparent',
              border: `1px solid ${activeFilter === 'IMMINENT' ? '#facc15' : 'rgba(255,255,255,0.1)'}`,
              color: activeFilter === 'IMMINENT' ? '#facc15' : '#888',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            ⚡ Imminent ≤ 0.5% ({stats.imminentCount})
          </button>

          <button
            onClick={() => setActiveFilter('BREAKOUT')}
            style={{
              background: activeFilter === 'BREAKOUT' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              border: `1px solid ${activeFilter === 'BREAKOUT' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
              color: activeFilter === 'BREAKOUT' ? '#38bdf8' : '#888',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            🚀 Breakout &gt; PDH ({stats.breakoutCount})
          </button>

          <button
            onClick={() => setActiveFilter('ALL')}
            style={{
              background: activeFilter === 'ALL' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              border: `1px solid ${activeFilter === 'ALL' ? '#fff' : 'rgba(255,255,255,0.1)'}`,
              color: activeFilter === 'ALL' ? '#fff' : '#888',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            📋 Tous les 50 Tokens
          </button>
        </div>

        {/* Sort & Copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#888' }}>
            <span>Trier par :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: '#0a1a21',
                color: '#00d2ff',
                border: '1px solid rgba(0, 210, 255, 0.3)',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '700',
                outline: 'none'
              }}
            >
              <option value="DISTANCE">Plus proche du PDH (Défaut)</option>
              <option value="GAP">Écart % décroissant</option>
              <option value="RANK">Rang Top 50 Mois</option>
              <option value="PRICE">Prix USDT le plus élevé</option>
              <option value="VOLUME">Volume 24h le plus fort</option>
            </select>
          </div>

          <button
            onClick={handleCopyList}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: hasCopied ? '#00ff88' : '#e0e6ed',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {hasCopied ? <Check size={13} /> : <Copy size={13} />}
            <span>{hasCopied ? 'Copié !' : 'Copier ≤ 1%'}</span>
          </button>
        </div>
      </div>

      {/* ── TABLE ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#0d212b',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
      }}>
        {isLoadingPdh && filteredRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8892b0' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 15px', color: '#00ff88' }} />
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>{loadingMsg}</div>
            <div style={{ fontSize: '0.75rem' }}>Connexion aux Klines Journalières Bybit pour extraire le Previous Daily High...</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#8892b0' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
              Aucun token ne correspond aux critères
            </div>
            <div style={{ fontSize: '0.78rem' }}>
              {activeFilter === 'NEAR_1PCT' 
                ? 'Aucun token du Top 50 n\'est actuellement à ≤ 1% de son PDH. Cliquez sur "Tous les 50 Tokens" pour voir l\'ensemble.' 
                : 'Essayez de modifier vos filtres ou votre recherche.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#8892b0' }}>
                  <th style={{ padding: '12px 14px', width: '50px' }}>RANG</th>
                  <th style={{ padding: '12px 14px' }}>TOKEN SPOT</th>
                  <th style={{ padding: '12px 14px' }}>SCORE MOIS</th>
                  <th style={{ padding: '12px 14px' }}>PRIX LIVE (USDT)</th>
                  <th style={{ padding: '12px 14px', color: '#facc15' }}>PDH (HAUT VEILLE)</th>
                  <th style={{ padding: '12px 14px' }}>PDL (BAS VEILLE)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>ÉCART AU PDH (%)</th>
                  <th style={{ padding: '12px 14px', minWidth: '160px' }}>POSITION DANS LE RANGE</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>STATUT / SIGNAL</th>
                  <th style={{ padding: '12px 14px' }}>VOLUME 24H</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>TRADING</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isGoldRank = row.rankMonth <= 3;
                  const isHighlighted = row.isWithin1Pct;

                  return (
                    <tr 
                      key={row.symbol}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        background: isHighlighted 
                          ? 'rgba(0, 255, 136, 0.06)' 
                          : row.flash === 'green' 
                            ? 'rgba(0, 255, 136, 0.15)' 
                            : row.flash === 'red' 
                              ? 'rgba(255, 59, 48, 0.15)' 
                              : 'transparent',
                        transition: 'background 0.3s'
                      }}
                    >
                      {/* Rang */}
                      <td style={{ padding: '12px 14px', fontWeight: '900', color: isGoldRank ? '#facc15' : '#888' }}>
                        #{row.rankMonth}
                      </td>

                      {/* Token */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '900', color: '#fff', fontSize: '0.88rem' }}>
                            {row.cleanSymbol}
                          </span>
                          <span style={{ fontSize: '0.62rem', color: '#00d2ff', background: 'rgba(0, 210, 255, 0.1)', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                            SPOT
                          </span>
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#8892b0' }}>
                          30D: <span style={{ color: row.p30d >= 0 ? '#00ff88' : '#ff4d4d' }}>{row.p30d >= 0 ? '+' : ''}{row.p30d.toFixed(1)}%</span>
                        </div>
                      </td>

                      {/* Score Mois */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: '900', color: '#facc15', fontSize: '0.85rem' }}>
                          +{row.scoreMonth} pts
                        </span>
                      </td>

                      {/* Prix Live USDT */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{
                          fontWeight: '900',
                          fontSize: '0.92rem',
                          color: row.flash === 'green' ? '#00ff88' : row.flash === 'red' ? '#ff4d4d' : '#fff',
                          transition: 'color 0.2s'
                        }}>
                          {formatPrice(row.curPrice)}
                        </div>
                        <div style={{
                          fontSize: '0.65rem',
                          fontWeight: '700',
                          color: row.p24h >= 0 ? '#00ff88' : '#ff4d4d',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          {row.p24h >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                          <span>{row.p24h >= 0 ? '+' : ''}{row.p24h.toFixed(2)}% (24h)</span>
                        </div>
                      </td>

                      {/* PDH */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '900', color: '#facc15', fontSize: '0.90rem' }}>
                          {formatPrice(row.pdh)}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#8892b0' }}>
                          High d'hier
                        </div>
                      </td>

                      {/* PDL */}
                      <td style={{ padding: '12px 14px', color: '#94a3b8' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.82rem' }}>
                          {formatPrice(row.pdl)}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                          Low d'hier
                        </div>
                      </td>

                      {/* Écart au PDH (%) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontWeight: '900',
                          fontSize: '0.85rem',
                          background: row.isBreakout 
                            ? 'rgba(0, 255, 136, 0.2)' 
                            : row.isWithin1Pct 
                              ? 'rgba(250, 204, 21, 0.2)' 
                              : 'rgba(255, 255, 255, 0.04)',
                          color: row.isBreakout 
                            ? '#00ff88' 
                            : row.isWithin1Pct 
                              ? '#facc15' 
                              : row.gapPct > -3 
                                ? '#38bdf8' 
                                : '#8892b0',
                          border: `1px solid ${
                            row.isBreakout 
                              ? 'rgba(0, 255, 136, 0.5)' 
                              : row.isWithin1Pct 
                                ? 'rgba(250, 204, 21, 0.5)' 
                                : 'transparent'
                          }`,
                          boxShadow: row.isWithin1Pct ? '0 0 10px rgba(0, 255, 136, 0.2)' : 'none'
                        }}>
                          {row.gapPct >= 0 ? '+' : ''}{row.gapPct.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '0.60rem', color: '#8892b0', marginTop: '2px' }}>
                          Dist: {row.absDistPct.toFixed(2)}%
                        </div>
                      </td>

                      {/* Range Progress Bar */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#64748b', marginBottom: '3px' }}>
                          <span>PDL</span>
                          <span style={{ color: row.isBreakout ? '#00ff88' : '#facc15', fontWeight: '800' }}>
                            {row.rangeProgress.toFixed(0)}%
                          </span>
                          <span style={{ color: '#facc15', fontWeight: '700' }}>PDH</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                            width: `${Math.min(100, row.rangeProgress)}%`,
                            height: '100%',
                            background: row.isBreakout 
                              ? 'linear-gradient(90deg, #00d2ff, #00ff88)' 
                              : row.isWithin1Pct 
                                ? 'linear-gradient(90deg, #00d2ff, #facc15)' 
                                : 'linear-gradient(90deg, #3b82f6, #00d2ff)',
                            borderRadius: '4px'
                          }} />
                        </div>
                      </td>

                      {/* Statut / Signal */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {row.isBreakout ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(0, 255, 136, 0.15)',
                            color: '#00ff88',
                            border: '1px solid rgba(0, 255, 136, 0.4)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: '900'
                          }}>
                            🚀 BREAKOUT ACTIF
                          </span>
                        ) : row.isImminent ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(250, 204, 21, 0.2)',
                            color: '#facc15',
                            border: '1px solid #facc15',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: '900',
                            animation: 'pulse 1.5s infinite'
                          }}>
                            ⚡ IMMINENT (≤ 0.5%)
                          </span>
                        ) : row.isWithin1Pct ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(0, 255, 136, 0.15)',
                            color: '#00ff88',
                            border: '1px solid rgba(0, 255, 136, 0.4)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: '900'
                          }}>
                            🔥 ZONE SNIPER (≤ 1%)
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            color: '#8892b0',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: '600'
                          }}>
                            ⏳ EN REPLI ({row.gapPct.toFixed(1)}%)
                          </span>
                        )}
                      </td>

                      {/* Volume 24h */}
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#cbd5e1' }}>
                        {formatVolumeUSDT(row.turnover24h || row.volume24h * row.curPrice)}
                      </td>

                      {/* Trading Bybit Link */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <a
                          href={`https://www.bybit.com/trade/spot/${row.cleanSymbol}/USDT`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: 'rgba(0, 210, 255, 0.1)',
                            border: '1px solid rgba(0, 210, 255, 0.3)',
                            color: '#00d2ff',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '0.70rem',
                            fontWeight: '800',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#00d2ff';
                            e.currentTarget.style.color = '#000';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 210, 255, 0.1)';
                            e.currentTarget.style.color = '#00d2ff';
                          }}
                        >
                          <span>Bybit</span>
                          <ExternalLink size={12} />
                        </a>
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
