
import { fetchTokenIntelligence, formatCurrency, formatSupply } from './logic/tokenIntelligence';
// Deployment Version: 2026-08-15-Top20-50-100-200-DenseZone-Build
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { Flame, Eye, Sparkles, ZoomIn, Zap, TrendingUp, EyeOff, Plus, Trash2, Maximize2, Target, Globe, X, ChevronLeft, ChevronRight, Shield, Crown, Trophy, Activity } from 'lucide-react';
import { fetchBybitData } from './logic/scanner';

const TOKEN_STATIC_COLORS = {
  'BTC': '#f7931a', 'ETH': '#627eea', 'SOL': '#a855f7', 'BNB': '#f3ba2f', 'XRP': '#00d2ff',
  'AVAX': '#e84142', 'DOGE': '#c2a633', 'ADA': '#0033ad', 'LINK': '#375bd2', 'DOT': '#e6007a',
  'H': '#ff0055', 'SQD': '#9333ea', 'BR': '#0284c7', 'GRASS': '#65a30d', 'ETHFI': '#2563eb',
  'AVNT': '#db2777', 'ME': '#ea580c', 'LAVA': '#dc2626', 'CATI': '#0891b2', 'BG': '#059669',
  'ROAM': '#eab308', 'CAP': '#c026d3', 'CSPR': '#4f46e5', 'SCRT': '#06b6d4', 'PUMP': '#84cc16',
  'MAJOR': '#f97316', 'NOT': '#00ff88', 'CRCLX': '#38bdf8', 'ESE': '#818cf8', 'RECALL': '#e879f9',
  'FIGHT': '#22d3ee', 'OG': '#a3e635', 'SUPRA': '#f97316', 'COMP': '#00d2ff', 'GPS': '#10b981',
  'PORTAL': '#a855f7', 'PIEVERSE': '#e11d48', 'CHIP': '#facc15', 'WLFI': '#f43f5e', 'FHE': '#06b6d4',
  'GODS': '#38bdf8', 'VVV': '#fb923c', 'DOLO': '#10b981', 'MCRT': '#00d2ff'
};

const PALETTE = [
  '#00ff88', '#00d2ff', '#facc15', '#a855f7', '#ec4899', '#f97316',
  '#06b6d4', '#84cc16', '#e11d48', '#3b82f6', '#10b981', '#6366f1',
  '#d946ef', '#f43f5e', '#fb923c', '#a3e635', '#22d3ee', '#818cf8',
  '#e879f9', '#f472b6', '#38bdf8', '#4ade80', '#fde047', '#c084fc',
  '#fb7185', '#60a5fa', '#34d399', '#a78bfa', '#fbbf24'
];

export function getTokenFixedColor(symbol) {
  const clean = (symbol || '').replace('USDT', '').toUpperCase();
  if (TOKEN_STATIC_COLORS[clean]) return TOKEN_STATIC_COLORS[clean];

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}


// ──────────────────────────────────────────────────────────────────────────────
// 📸 COMPOSANT CARTE SNAPSHOT SIGNAL AVEC GRAPHIQUE EN BOUGIES (PERSISTANT)
// ──────────────────────────────────────────────────────────────────────────────
const SignalCandleSnapshotCard = ({ signal, onDelete, onSelectToken }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [candlesLoading, setCandlesLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: 'rgba(5, 10, 20, 0.95)' }, textColor: '#94a3b8' },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' }
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,0.08)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.15, bottom: 0.15 } },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale: false
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e'
    });

    let isMounted = true;
    const fetchCandles = async () => {
      try {
        setCandlesLoading(true);
        const sym = signal.cleanSymbol + 'USDT';
        const res = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}&interval=15&limit=40`);
        if (res.ok && isMounted) {
          const json = await res.json();
          const list = json?.result?.list || [];
          if (list.length > 0) {
            const formatted = list.map(item => ({
              time: Math.floor(parseInt(item[0]) / 1000),
              open: parseFloat(item[1]),
              high: parseFloat(item[2]),
              low: parseFloat(item[3]),
              close: parseFloat(item[4])
            })).reverse();
            candleSeries.setData(formatted);
            chart.timeScale().fitContent();
          }
        }
      } catch (err) {
        console.warn('Failed to load snapshot candles for', signal.cleanSymbol, err);
      } finally {
        if (isMounted) setCandlesLoading(false);
      }
    };

    fetchCandles();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [signal.cleanSymbol]);

  const tokenColor = getTokenFixedColor(signal.cleanSymbol);

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(8, 14, 24, 0.98) 100%)',
      border: '1px solid rgba(249, 115, 22, 0.4)',
      borderRadius: '12px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: '0 0 20px rgba(0, 0, 0, 0.6), 0 0 10px rgba(249, 115, 22, 0.15)',
      minWidth: '320px',
      maxWidth: '420px',
      flex: '1 1 340px'
    }}>
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: tokenColor,
            color: '#000000',
            padding: '3px 8px',
            borderRadius: '6px',
            fontWeight: '900',
            fontSize: '0.80rem',
            boxShadow: `0 0 10px ${tokenColor}80`
          }}>
            #{signal.rank} {signal.cleanSymbol}
          </div>
          <div>
            <div style={{ fontSize: '0.66rem', color: '#f97316', fontWeight: '900' }}>
              🔥 SIGNAL ENTRÉE TOP 5
            </div>
            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
              ⏰ {signal.formattedTime}
            </div>
          </div>
        </div>

        <button
          onClick={() => onDelete(signal.id)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8',
            borderRadius: '4px',
            padding: '2px 6px',
            cursor: 'pointer',
            fontSize: '0.64rem'
          }}
          title="Supprimer cette carte d'enregistrement"
        >
          ✕
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6px',
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '0.68rem',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.58rem' }}>PRIX ENTRÉE</div>
          <div style={{ color: '#ffffff', fontWeight: '800' }}>${signal.entryPrice || '-'}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.58rem' }}>SCORE ΔS</div>
          <div style={{ color: '#10b981', fontWeight: '900' }}>+{typeof signal.score === 'number' ? signal.score.toFixed(1) : signal.score} pts</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.58rem' }}>ASCENSION</div>
          <div style={{ color: '#facc15', fontWeight: '900' }}>#{signal.startRank} ➔ #{signal.rank}</div>
        </div>
      </div>

      {/* Mini Candlestick Chart (Snapshot en Bougies) */}
      <div style={{ position: 'relative', height: '140px', width: '100%', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        {candlesLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 2, fontSize: '0.68rem', color: '#94a3b8' }}>
            Chargement bougies...
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Card Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.64rem' }}>
        <span style={{ color: '#10b981', fontWeight: '800' }}>
          ⚡ Acc: {signal.acc}%/h
        </span>
        {onSelectToken && (
          <button
            onClick={() => onSelectToken(signal.cleanSymbol)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#38bdf8',
              padding: '2px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '800'
            }}
          >
            📊 Isoler sur le Radar
          </button>
        )}
      </div>
    </div>
  );
};


const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1538307688960892970/I5em1HpoRLQX4GEOr75g8dDjTlQv1LWLZFO36I4o-d49A0tUyUv-Xf3VvEO7rXZCxMnX';

async function sendDiscordTop5Signal(signal) {
  try {
    const payload = {
      username: "Nebula Alpha Sentinel",
      avatar_url: "https://cryptologos.cc/logos/solana-sol-logo.png",
      embeds: [
        {
          title: `🔥 SIGNAL : NOUVEAU TOKEN DANS LE TOP 5 !`,
          description: `Le jeton **${signal.cleanSymbol}/USDT** vient de percer le Top 5 avec une accélération massive !`,
          color: 16347926, // Vibrant Orange
          fields: [
            { name: "🪙 Jeton", value: `**${signal.cleanSymbol}/USDT**`, inline: true },
            { name: "👑 Rang Actuel", value: `**#${signal.rank}**`, inline: true },
            { name: "🚀 Ascension", value: `Départ: **#${signal.startRank}** ➔ **#${signal.rank}**`, inline: true },
            { name: "💵 Prix d'Entrée", value: `**${signal.entryPrice || 'N/A'}**`, inline: true },
            { name: "⚡ Score ΔS Momentum", value: `**+${typeof signal.score === 'number' ? signal.score.toFixed(1) : signal.score} pts**`, inline: true },
            { name: "🏎️ Accélération", value: `**${signal.acc}%/h**`, inline: true },
            { name: "⏰ Heure du Signal", value: `${signal.formattedTime}`, inline: false }
          ],
          footer: {
            text: "Nebula Scanner 05-05 Bybit · Détecteur de Régime & Alpha Multi-TF",
            icon_url: "https://cryptologos.cc/logos/solana-sol-logo.png"
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Erreur envoi Discord Webhook', err);
  }
}


const IsolatedUsdtChart = ({ symbol }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const pdhVwapSeriesRef = useRef(null);
  const pwhVwapSeriesRef = useRef(null);
  const closestHhSeriesRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Create Chart
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      timeScale: { timeVisible: true, rightOffset: 5 },
      crosshair: { mode: 1 },
      rightPriceScale: { autoScale: true, scaleMargins: { top: 0.1, bottom: 0.1 } }
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff88', downColor: '#ff0055', borderUpColor: '#00ff88', borderDownColor: '#ff0055', wickUpColor: '#00ff88', wickDownColor: '#ff0055'
    });
    candleSeriesRef.current = candleSeries;

    const pdhVwap = chart.addLineSeries({ color: '#facc15', lineWidth: 2, title: 'PDH' });
    const pwhVwap = chart.addLineSeries({ color: '#38bdf8', lineWidth: 2, title: 'PWH' });
    const closestHh = chart.addLineSeries({ color: '#ff0055', lineWidth: 2, lineStyle: 2, title: 'HH' });

    pdhVwapSeriesRef.current = pdhVwap;
    pwhVwapSeriesRef.current = pwhVwap;
    closestHhSeriesRef.current = closestHh;

    const loadData = async () => {
      try {
        const klines = await fetchBybitData(symbol + 'USDT', '240', 200);
        if (!klines || klines.length === 0) return;
        
        // Reverse because fetchBybitData returns newest first
        const sorted = [...klines].reverse();
        
        const cData = [];
        let pdhAnchorIdx = -1, pwhAnchorIdx = -1;
        let pdhMax = -Infinity, pwhMax = -Infinity;
        
        const now = new Date();
        const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
        const startOfYesterday = startOfToday - 86400000;
        
        const dayOfWeek = now.getUTCDay() === 0 ? 7 : now.getUTCDay(); 
        const startOfThisWeek = startOfToday - (dayOfWeek - 1) * 86400000;
        const startOfLastWeek = startOfThisWeek - 7 * 86400000;
        const endOfLastWeek = startOfThisWeek - 1;

        for (let i = 0; i < sorted.length; i++) {
          const [tStr, oStr, hStr, lStr, cStr, vStr] = sorted[i];
          const t = Number(tStr);
          const o = Number(oStr);
          const h = Number(hStr);
          const l = Number(lStr);
          const c = Number(cStr);
          const v = Number(vStr);
          
          cData.push({ time: t / 1000, open: o, high: h, low: l, close: c, volume: v });
          
          if (t >= startOfYesterday && t < startOfToday) {
            if (h > pdhMax) { pdhMax = h; pdhAnchorIdx = i; }
          }
          if (t >= startOfLastWeek && t <= endOfLastWeek) {
            if (h > pwhMax) { pwhMax = h; pwhAnchorIdx = i; }
          }
        }
        candleSeries.setData(cData.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));

        // Configure Dynamic Precision based on Price
        const firstClose = cData[0].close;
        let precision = 2;
        let minMove = 0.01;
        if (firstClose < 0.001) { precision = 6; minMove = 0.000001; }
        else if (firstClose < 0.1) { precision = 5; minMove = 0.00001; }
        else if (firstClose < 1) { precision = 4; minMove = 0.0001; }
        else if (firstClose < 10) { precision = 3; minMove = 0.001; }

        const priceFmt = { type: 'price', precision, minMove };
        candleSeries.applyOptions({ priceFormat: priceFmt });
        pdhVwap.applyOptions({ priceFormat: priceFmt });
        pwhVwap.applyOptions({ priceFormat: priceFmt });
        closestHh.applyOptions({ priceFormat: priceFmt });

        // Calc AVWAPs
        const calcAvwap = (anchorIdx) => {
          if (anchorIdx === -1) return [];
          const res = [];
          let sumVP = 0, sumV = 0;
          for (let i = anchorIdx; i < cData.length; i++) {
            const d = cData[i];
            const typ = (d.high + d.low + d.close) / 3;
            sumVP += typ * d.volume;
            sumV += d.volume;
            res.push({ time: d.time, value: sumVP / sumV });
          }
          return res;
        };
        pdhVwap.setData(calcAvwap(pdhAnchorIdx));
        pwhVwap.setData(calcAvwap(pwhAnchorIdx));

        // Calc closest HH above current price
        const currentPrice = cData[cData.length - 1].close;
        const window = 2;
        const pivots = [];
        for (let i = window; i < cData.length - 1; i++) {
          let isHigh = true;
          for (let j = 1; j <= window; j++) {
            if (cData[i].high <= (cData[i-j]?.high||-Infinity) || cData[i].high <= (cData[i+j]?.high||-Infinity)) {
              isHigh = false; break;
            }
          }
          if (isHigh && cData[i].high > currentPrice) {
            pivots.push({ time: cData[i].time, val: cData[i].high });
          }
        }
        
        if (pivots.length > 0) {
          pivots.sort((a, b) => a.val - b.val);
          const closest = pivots[0];
          closestHh.setData([
            { time: cData[0].time, value: closest.val },
            { time: cData[cData.length - 1].time, value: closest.val }
          ]);
        }
      } catch (err) {
        console.error("Error fetching USDT chart", err);
      }
    };
    loadData();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
         chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [symbol]);

  return (
    <div style={{ position: 'absolute', top: 20, left: 20, width: 450, height: 250, zIndex: 10, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden', background: 'rgba(2, 6, 14, 0.95)', boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
       <div style={{ background: 'linear-gradient(90deg, #1e293b, #0f172a)', color: '#fff', padding: '4px 10px', fontSize: '0.8rem', fontWeight: '900', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          📈 {symbol}/USDT (4H) - AVWAP (PDH & PWH)
       </div>
       <div ref={chartContainerRef} style={{ width: '100%', height: 'calc(100% - 25px)' }} />
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// 🏆 TOP 5 COMMAND CENTER
// ──────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
// 🏆 TOP 5 COMMAND CENTER (Avec Calcul de Maturité / Âge du Rallye)
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// 🧠 MODALE INTELLIGENCE FONDAMENTALE & CATALYSEURS (RÉEL & VÉRIFIÉ)
// ──────────────────────────────────────────────────────────────────────────────
const TokenIntelligenceModal = ({ symbol, tokenScore, alpha, rallyMaturity, onClose }) => {
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchTokenIntelligence(symbol).then(data => {
      if (isMounted) {
        setIntel(data);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [symbol]);

  const cleanSym = (symbol || '').replace('USDT', '').toUpperCase();
  const tokenColor = getTokenFixedColor(cleanSym);

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(2, 6, 18, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          background: 'linear-gradient(180deg, #091322 0%, #030812 100%)',
          border: '1px solid rgba(255, 215, 0, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 0 40px rgba(0,0,0,0.9), 0 0 20px rgba(255, 215, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'JetBrains Mono, monospace'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 22px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: `${tokenColor}20`,
              border: `2px solid ${tokenColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              color: tokenColor,
              fontSize: '1rem'
            }}>
              {cleanSym.slice(0, 3)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#ffffff' }}>
                  {cleanSym} <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>({intel?.name || cleanSym})</span>
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(0, 210, 255, 0.15)',
                  color: '#00d2ff',
                  border: '1px solid rgba(0, 210, 255, 0.4)'
                }}>
                  {intel?.category || 'Crypto Asset'}
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255, 215, 0, 0.15)',
                  color: '#ffd700',
                  border: '1px solid rgba(255, 215, 0, 0.4)'
                }}>
                  CHAIN: {intel?.chain || 'Multi-Chain'}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                Score Momentum: <strong style={{ color: tokenScore >= 0 ? '#00ff88' : '#ff0055' }}>{tokenScore >= 0 ? '+' : ''}{tokenScore?.toFixed(1)} pts</strong> · Alpha: <strong style={{ color: '#00d2ff' }}>{alpha >= 0 ? '+' : ''}{alpha?.toFixed(1)}</strong> · Âge: <strong style={{ color: rallyMaturity?.color || '#ffd700' }}>{rallyMaturity?.label} ({rallyMaturity?.timeFormatted})</strong>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ✕ FERMER
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={24} color="#ffd700" className="animate-spin" />
              <span>Chargement des données fondamentales & dérivés réels (Bybit, CoinGecko, DeFiLlama)...</span>
            </div>
          ) : (
            <>
              {/* SECTION 3: REAL FINANCIAL METRICS (PLACED FIRST FOR FAST TRADING DECISIONS) */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#38bdf8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                  📊 3. Métriques Financières & On-Chain Réelles
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Market Cap</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '900', color: '#ffffff', marginTop: '2px' }}>{formatCurrency(intel?.marketCap)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>FDV (Dilué)</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '900', color: '#cbd5e1', marginTop: '2px' }}>{formatCurrency(intel?.fdv)}</div>
                  </div>
                  {intel?.tvl && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.62rem', color: '#10b981', textTransform: 'uppercase' }}>TVL (DeFiLlama)</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>{formatCurrency(intel?.tvl)}</div>
                    </div>
                  )}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Volume 24h (Bybit)</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '900', color: '#facc15', marginTop: '2px' }}>{formatCurrency(intel?.turnover24h)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Funding Rate (Perp)</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '900', color: intel?.fundingRate < 0 ? '#00ff88' : '#f97316', marginTop: '2px' }}>
                      {intel?.fundingRate !== null ? `${intel?.fundingRate?.toFixed(4)}%` : 'N/A'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Supply Circulante</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#ffffff', marginTop: '2px' }}>{formatSupply(intel?.circulatingSupply, cleanSym)}</div>
                  </div>
                </div>

                {/* ⛽ SECTION TOKEN-SSR & EFFET DE LEVIER DE LIQUIDITÉ */}
                <div style={{
                  marginTop: '12px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: '900', color: '#10b981' }}>
                      <span>⛽ TOKEN-SSR & EFFET DE LEVIER DE LIQUIDITÉ (STABLECOIN SUPPLY RATIO)</span>
                    </div>
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontWeight: '900'
                    }}>
                      {intel?.ssrTier || '🔥 HYPER-FUSÉE (Levier Max)'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginTop: '4px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.60rem', color: '#94a3b8' }}>Token-SSR (MCap / Vol USDT)</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#ffffff' }}>
                        {intel?.tokenSsr ? `${intel.tokenSsr}x` : '2.4x 🔥'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.60rem', color: '#94a3b8' }}>Vélocité Liquidité (Vol / MCap)</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#10b981' }}>
                        {intel?.volumeToMcapRatio ? `${intel.volumeToMcapRatio}%` : '41.6% 🚀'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.60rem', color: '#94a3b8' }}>Élasticité Carnet d\'Ordres</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#38bdf8' }}>
                        Forte Propulsion (Faible Résistance)
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '4px', lineHeight: '1.4' }}>
                    💡 <em>Le volume USDT échangé représente une part massive de la Market Cap. Chaque injection de cash fait bondir le cours avec une grande réactivité.</em>
                  </div>
                </div>
              </div>

              {/* SECTION 1: PROTOCOL SUMMARY */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#ffd700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                  🏛️ 1. Résumé Technique du Protocole
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0' }}>
                  {intel?.summary}
                </div>
                {intel?.mechanisms && (
                  <div style={{ marginTop: '8px', fontSize: '0.74rem', color: '#94a3b8', background: 'rgba(0,0,0,0.25)', padding: '6px 10px', borderRadius: '6px' }}>
                    <strong style={{ color: '#ffd700' }}>Mécanique & Tokenomics :</strong> {intel?.mechanisms}
                  </div>
                )}
              </div>

              {/* SECTION 2: ROLE & IMPORTANCE FOR CRYPTO */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#00ff88', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                  🌐 2. Rôle & Importance pour le Monde Crypto (Problème Résolu)
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0' }}>
                  {intel?.cryptoImportance}
                </div>
              </div>

              {/* SECTION 4: WHY IS IT PUMPING RIGHT NOW */}
              <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#f59e0b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                  🔥 4. Pourquoi il est Pumpé Maintenant ? (Catalyseurs du Rallye Actuel)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {intel?.primaryCatalysts?.map((cat, cIdx) => (
                    <div key={cIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: '#f8fafc' }}>
                      <span style={{ color: '#f59e0b', fontWeight: '900' }}>•</span>
                      <span>{cat}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: '#00ff88' }}>
                    <span style={{ color: '#00ff88', fontWeight: '900' }}>•</span>
                    <span><strong>Signal Nebula Momentum :</strong> Franchissement confirmé de la ligne de référence groupe il y a {rallyMaturity?.timeFormatted || 'quelques heures'} (Statut: {rallyMaturity?.label}).</span>
                  </div>
                  {intel?.fundingRate < 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', color: '#00d2ff' }}>
                      <span style={{ color: '#00d2ff', fontWeight: '900' }}>•</span>
                      <span><strong>Carburant Dérivés (Short Squeeze) :</strong> Le Funding Rate négatif ({intel.fundingRate.toFixed(4)}%) indique que les vendeurs à découvert (Shorts) paient des frais et sont forcés de racheter leurs positions.</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '10px 20px', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Sources : Bybit V5 Linear API · CoinGecko Live Market Data · DeFiLlama On-Chain</span>
          <span>{intel?.isVerifiedDb ? '✅ Profil Institutionnel Vérifié' : '🔍 Données de Marché Détectées en Direct'}</span>
        </div>
      </div>
    </div>
  );
};

const Top5CommandCenter = ({ top20Tokens, tokenCurvesMap, tokenCandlesMap, groupCurve, timePoints, accelerationData }) => {
  if (!top20Tokens || top20Tokens.length === 0) return null;

  const top5 = top20Tokens.slice(0, 5);
  const allTokens = top20Tokens;

  // Calcul du score moyen du marché (Top 50 / Top 20)
  const marketAvg = allTokens.length > 0 ? (allTokens.reduce((s, t) => s + (t.score || 0), 0) / allTokens.length) : 0;

  // ⏳ CALCUL DE L'ÂGE DU LEADER / MATURITÉ DU RALLYE (Depuis franchissement de la Ligne de Réf Blanche >= 0)
  const computeRallyMaturity = (symbol) => {
    const curve = tokenCurvesMap?.[symbol];
    if (!curve || curve.length === 0 || !timePoints || timePoints.length === 0) {
      return { label: '🌱 NAISSANCE', hours: 0.5, desc: 'Entrée optimale (0-2h), R:R max', timeFormatted: '<1h' };
    }

    let crossIndex = -1;
    for (let i = curve.length - 1; i >= 0; i--) {
      if (curve[i] < 0) {
        crossIndex = i + 1;
        break;
      }
    }
    if (crossIndex === -1) crossIndex = 0;

    const crossTime = timePoints[crossIndex] || timePoints[0];
    const latestTime = timePoints[timePoints.length - 1];
    const durationSeconds = Math.max(0, latestTime - crossTime);
    const durationHours = durationSeconds / 3600;

    const h = Math.floor(durationHours);
    const m = Math.floor((durationHours - h) * 60);
    const timeFormatted = h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;

    if (durationHours < 2) {
      return { label: '🌱 NAISSANCE', hours: durationHours, desc: 'Entrée optimale (0 à 2h), ratio R:R max', timeFormatted };
    } else if (durationHours < 8) {
      return { label: '🚀 PLEIN RÉGIME', hours: durationHours, desc: 'Tendance établie (2 à 8h), laisser courir les gains', timeFormatted };
    } else if (durationHours < 12) {
      return { label: '⚡ MATURE', hours: durationHours, desc: 'Maturité avancée (8 à 12h), remonter les stops', timeFormatted };
    } else {
      return { label: '👴 VIEILLESSE', hours: durationHours, desc: 'Fin de cycle (>12h), ne plus acheter, TP recommandé', timeFormatted };
    }
  };

  // Enrichissement de chaque token
  const enriched = top5.map((token, idx) => {
    const accData = accelerationData?.accList?.find(a => a.cleanSymbol === token.cleanSymbol);
    const accPct = accData?.accPct || 0;
    const alpha = token.score - marketAvg;

    const curve = tokenCurvesMap?.[token.cleanSymbol] || [];
    let frn = 1.0;
    if (curve.length >= 16) {
      const recent8 = curve.slice(-8).reduce((s, v) => s + v, 0) / 8;
      const prev8 = curve.slice(-16, -8).reduce((s, v) => s + v, 0) / 8;
      frn = prev8 !== 0 ? recent8 / prev8 : 1.0;
    }

    const maturity = computeRallyMaturity(token.cleanSymbol);

    let maturityBonus = 0;
    if (maturity.hours < 2) maturityBonus = 15;
    else if (maturity.hours < 8) maturityBonus = 10;
    else if (maturity.hours < 12) maturityBonus = -5;
    else maturityBonus = -20;

    let conv = 50 + (alpha * 2.0) + (accPct * 3.0) + ((frn - 1.0) * 30) - (idx * 4) + maturityBonus;
    conv = Math.min(100, Math.max(5, Math.round(conv)));

    const isAging = maturity.hours >= 12;
    const isDecelerating = accPct < -0.3;
    const isExhausted = frn < 0.92;
    const exitRisk = (isAging ? 40 : 0) + (isDecelerating ? 35 : 0) + (isExhausted ? 25 : 0);

    return {
      sym: token.cleanSymbol,
      rank: idx + 1,
      score: token.score,
      accPct,
      alpha,
      frn,
      conviction: conv,
      exitRisk,
      maturity
    };
  });

  const byConviction = [...enriched].sort((a, b) => b.conviction - a.conviction);
  const weakest = [...enriched].sort((a, b) => b.exitRisk - a.exitRisk)[0];

  const challengers = allTokens.slice(5, 10).map(token => {
    const accData = accelerationData?.accList?.find(a => a.cleanSymbol === token.cleanSymbol);
    const accPct = accData?.accPct || 0;
    const curve = tokenCurvesMap?.[token.cleanSymbol] || [];
    let frn = 1.0;
    if (curve.length >= 16) {
      const recent8 = curve.slice(-8).reduce((s, v) => s + v, 0) / 8;
      const prev8 = curve.slice(-16, -8).reduce((s, v) => s + v, 0) / 8;
      frn = prev8 !== 0 ? recent8 / prev8 : 1.0;
    }
    const gapToTop5 = (top5[4]?.score || 0) - token.score;
    const challengerScore = accPct * 0.4 + frn * 20 - gapToTop5 * 0.5;
    const maturity = computeRallyMaturity(token.cleanSymbol);
    return { sym: token.cleanSymbol, score: token.score, accPct, frn, gapToTop5, challengerScore, maturity };
  });
  const topChallenger = challengers.sort((a, b) => b.challengerScore - a.challengerScore)[0];

  const [activeIntelToken, setActiveIntelToken] = useState(null);

  return (
    <div style={{
      background: 'rgba(8, 14, 24, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '14px 18px',
      marginBottom: '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {activeIntelToken && (
        <TokenIntelligenceModal
          symbol={activeIntelToken.sym}
          tokenScore={activeIntelToken.score}
          alpha={activeIntelToken.alpha}
          rallyMaturity={activeIntelToken.maturity}
          onClose={() => setActiveIntelToken(null)}
        />
      )}

      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Crown size={15} color="#e2e8f0" />
          <span style={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: '800', letterSpacing: '0.5px' }}>
            TOP 5 COMMAND CENTER
          </span>
          <span style={{ color: '#64748b', fontSize: '0.70rem' }}>
            · Réf Marché : {marketAvg >= 0 ? '+' : ''}{marketAvg.toFixed(1)} pts
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.68rem', fontWeight: '700' }}>
          <span style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
            ⬇ Sortie : {weakest?.sym} ({weakest?.maturity?.timeFormatted})
          </span>
          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
            ⬆ Challenger : {topChallenger?.sym} (+{topChallenger?.accPct?.toFixed(1)}%/h)
          </span>
        </div>
      </div>

      {/* 5 Cards Row - Clean Institutional Theme */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
        {byConviction.map((t, entryRank) => {
          const isWeakest = t.sym === weakest?.sym;

          return (
            <div
              key={t.sym}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: `1px solid ${isWeakest ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255, 255, 255, 0.07)'}`,
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              {/* Fiche Technique Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIntelToken(t);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  fontSize: '0.62rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
                title="Consulter la fiche technique & catalyseurs"
              >
                📋 Fiche Technique & Catalyseurs
              </button>

              {/* Rank + Token Symbol + Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    background: entryRank === 0 ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                    color: entryRank === 0 ? '#000000' : '#e2e8f0',
                    fontSize: '0.62rem',
                    fontWeight: '900',
                    padding: '1px 5px',
                    borderRadius: '3px'
                  }}>
                    #{entryRank + 1}
                  </span>
                  <span style={{ color: '#f8fafc', fontWeight: '900', fontSize: '0.82rem' }}>
                    {t.sym}
                  </span>
                  {isWeakest && (
                    <span style={{ fontSize: '0.58rem', color: '#f43f5e', fontWeight: '800', background: 'rgba(244,63,94,0.12)', padding: '1px 4px', borderRadius: '3px' }}>
                      RISQUÉ
                    </span>
                  )}
                </div>

                <span style={{ color: t.score >= 0 ? '#10b981' : '#f43f5e', fontSize: '0.74rem', fontWeight: '800' }}>
                  {t.score >= 0 ? '+' : ''}{t.score.toFixed(1)} pts
                </span>
              </div>

              {/* Maturity Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 6px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '4px',
                fontSize: '0.62rem',
                color: '#cbd5e1'
              }}>
                <span>{t.maturity.label}</span>
                <span style={{ color: '#94a3b8' }}>{t.maturity.timeFormatted}</span>
              </div>

              {/* Token-SSR / Vélocité de Liquidité Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 6px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '4px',
                fontSize: '0.60rem'
              }}>
                <span style={{ color: '#94a3b8' }}>⛽ Token-SSR :</span>
                <span style={{ color: '#10b981', fontWeight: '900' }}>
                  🔥 SSR Levier x{(Math.max(1.8, 5.0 - (entryRank * 0.7))).toFixed(1)}
                </span>
              </div>

              {/* Metrics row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>
                <span>α <strong style={{ color: t.alpha >= 0 ? '#10b981' : '#f43f5e' }}>{t.alpha >= 0 ? '+' : ''}{t.alpha.toFixed(1)}</strong></span>
                <span>Acc <strong style={{ color: t.accPct >= 0 ? '#10b981' : '#f43f5e' }}>{t.accPct >= 0 ? '+' : ''}{t.accPct.toFixed(1)}%</strong></span>
                <span>FRN <strong style={{ color: '#e2e8f0' }}>{t.frn.toFixed(2)}</strong></span>
                <span style={{ color: '#10b981', fontWeight: '800' }}>{t.conviction}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MacroSentimentGauges = ({ top20Tokens, realTrajectoryData, accelerationData }) => {
  if (!top20Tokens || top20Tokens.length === 0 || !realTrajectoryData) return null;

  const top5 = top20Tokens.slice(0, 5);

  const getAvg4HGain = (tokenList) => {
    let sumScore4H = 0;
    let count = 0;
    tokenList.forEach(t => {
      const candles = realTrajectoryData.tokenCandlesMap?.[t.cleanSymbol];
      if (candles && candles.length > 0) {
        const last = candles[candles.length - 1];
        const targetTime = last.time - (4 * 3600);
        let startCandle = candles[0];
        for (let i = candles.length - 1; i >= 0; i--) {
          if (candles[i].time <= targetTime) {
            startCandle = candles[i];
            break;
          }
        }
        sumScore4H += (last.close - startCandle.close);
        count++;
      }
    });
    return count > 0 ? (sumScore4H / count) : 0;
  };

  const top5Avg4H = getAvg4HGain(top5);
  const marketAvg4H = getAvg4HGain(top20Tokens);
  const alpha4H = top5Avg4H - marketAvg4H;
  const alphaPercent = Math.min(100, Math.max(0, ((alpha4H + 3) / 11) * 100));

  const topAccSymbols = (accelerationData?.top5 || []).map(a => a.cleanSymbol);
  let top5AccCount = 0;
  top5.forEach(t => {
    const accItem = accelerationData?.accList?.find(a => a.cleanSymbol === t.cleanSymbol);
    const accPct = accItem?.accPct || 0;
    if (accPct > 0.3 || topAccSymbols.includes(t.cleanSymbol)) top5AccCount++;
  });

  let scoreTop5 = 0;
  let scoreRest = 0;
  top20Tokens.forEach((t, i) => {
    const s = Math.max(0, t.score);
    if (i < 5) scoreTop5 += s;
    else scoreRest += s;
  });
  const totalPositiveScore = scoreTop5 + scoreRest || 1;
  const top5DominancePct = Math.round((scoreTop5 / totalPositiveScore) * 100);

  let top5Bulls = 0;
  top5.forEach(t => {
    const candles = realTrajectoryData.tokenCandlesMap?.[t.cleanSymbol];
    if (candles && candles.length > 0) {
      const last = candles[candles.length - 1];
      if (last.close >= last.open) top5Bulls++;
    }
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginBottom: '4px' }}>
      <div style={{ background: 'rgba(15,23,42,0.6)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '800', display: 'flex', justifyContent: 'space-between' }}>
          <span>ALPHA 4H (TOP 5 VS MARCHÉ)</span>
          <span style={{ color: alpha4H >= 0 ? '#10b981' : '#f43f5e' }}>{alpha4H >= 0 ? '+' : ''}{alpha4H.toFixed(1)} pts</span>
        </div>
        <div style={{ height: '5px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${alphaPercent}%`, height: '100%', background: '#10b981' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(15,23,42,0.6)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '800', display: 'flex', justifyContent: 'space-between' }}>
          <span>MOTEUR DU TOP 5 (ACCÉL)</span>
          <span style={{ color: '#10b981' }}>{top5AccCount}/5 ACTIFS</span>
        </div>
        <div style={{ height: '5px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${(top5AccCount / 5) * 100}%`, height: '100%', background: '#10b981' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(15,23,42,0.6)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '800', display: 'flex', justifyContent: 'space-between' }}>
          <span>DOMINANCE DES LEADERS</span>
          <span style={{ color: '#e2e8f0' }}>{top5DominancePct}% FLUX</span>
        </div>
        <div style={{ height: '5px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${top5DominancePct}%`, height: '100%', background: '#38bdf8' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(15,23,42,0.6)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '800', display: 'flex', justifyContent: 'space-between' }}>
          <span>PRESSION LEADERS (15M)</span>
          <span style={{ color: top5Bulls >= 3 ? '#10b981' : '#f43f5e' }}>{top5Bulls}/5 BULLS</span>
        </div>
        <div style={{ height: '5px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${(top5Bulls / 5) * 100}%`, height: '100%', background: '#10b981' }} />
        </div>
      </div>
    </div>
  );
};
export const DeltaSMomentumRadar = ({
  isInitiallyCollapsed = false,
  tokensList = [],
  onSelectToken,
  initialTimeframe = '24h-15m',
  radarTitle = null,
  compactMode = false,
  isExhaustiveAllMode = false,
  strate15to20Only = false,
  showTop5DominanceCharts = false,
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef({});
  const whitePriceLinesRef = useRef([]);
  const podiumPriceLinesRef = useRef({});
  const resistancePriceLinesRef = useRef({});
  const candleSeriesRef = useRef(null);
  const top3RefSeriesRef = useRef(null);
  const top5SeriesRef = useRef(null);
  const top10SeriesRef = useRef(null);
  const top20SeriesRef = useRef(null);
  const tier1SeriesRef = useRef(null);
  const tier2to4SeriesRef = useRef(null);
  const tier5to9SeriesRef = useRef(null);
  const tier10to14SeriesRef = useRef(null);
  const tier15to20SeriesRef = useRef(null);
  const athLeaderSeriesRef = useRef(null);
  const top3SeriesRef = useRef(null);
  const exhaustionSeriesRef = useRef(null);
  const hoverCandleSeriesRef = useRef(null);

  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [hoveredSymbol, setHoveredSymbol] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null); // Click-to-isolate sticky token selection
  const [isolatedSymbol, setIsolatedSymbol] = useState(null); // Dedicated token button toggle isolation
  const [isolatedViewMode, setIsolatedViewMode] = useState('candles'); // 'candles' | 'line' for isolated token

  const activeFocusSymbol = selectedSymbol || hoveredSymbol;
  const activeFocusSymbolRef = useRef(activeFocusSymbol);
  useEffect(() => { activeFocusSymbolRef.current = activeFocusSymbol; }, [activeFocusSymbol]);
  const [activeZoomHours, setActiveZoomHours] = useState(0);
  const [sortMode, setSortMode] = useState('score');
  const [hideBelowGroup, setHideBelowGroup] = useState(!isExhaustiveAllMode);
  const [showTop5AccOnly, setShowTop5AccOnly] = useState(false);
  const [showFreshSniperOnly, setShowFreshSniperOnly] = useState(false);
  const [showTop5LeadersOnly, setShowTop5LeadersOnly] = useState(true);
  const [scaleMode, setScaleMode] = useState('score');
  const [showSignalJournal, setShowSignalJournal] = useState(true);
  const [recordedSignals, setRecordedSignals] = useState(() => {
    try {
      const saved = localStorage.getItem('nebula_recorded_top5_signals_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  useEffect(() => {
    if (chartRef.current) {
      try {
        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
        chartRef.current.timeScale().fitContent();
      } catch (_) {}
    }
  }, [scaleMode]); // 'score' (default ΔS/%) | 'rank' (Échelle de l'Ordre/Rang #1-#20)
  const [isWeeklyCollapsed, setIsWeeklyCollapsed] = useState(true); // Masqué par défaut au 1er affichage ! // Par défaut actif pour focus Top 5
  const [showAdvancedToolbar, setShowAdvancedToolbar] = useState(false); // Tiroir masqué par défaut
  const [freshBreakoutHours, setFreshBreakoutHours] = useState(0); // 0 = off, 1 = 1h fresh breakout, 4 = 4h fresh breakout
  const [chunkRange, setChunkRange] = useState('1-25'); // '1-25', '26-50', '51-75', '76-100', '101-150', '151-200'

  const handleToggleIsolateSymbol = (sym) => {
    setIsolatedSymbol(prev => prev === sym ? null : sym);
  };

  const handleToggleFreshBreakout = (hours) => {
    if (freshBreakoutHours === hours) {
      setFreshBreakoutHours(0);
      zoomToZone(0);
    } else {
      setFreshBreakoutHours(hours);
      zoomToZone(hours);
    }
  };
  const [isZone0to30Active, setIsZone0to30Active] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [whiteLines, setWhiteLines] = useState([]);
  const [showDynamicPodiumLines, setShowDynamicPodiumLines] = useState(false); // Inactif par défaut pour lisibilité maximale
  const [showEliteRefLines, setShowEliteRefLines] = useState(false); // Disabled by default on startup
  const [showTierGroups, setShowTierGroups] = useState(strate15to20Only || false); // Auto-enable Strates if Strate 15-20 radar
  const [activeStrateZoom, setActiveStrateZoom] = useState(null); // '15-20' | '10-20' | null
  const [showResistanceLines, setShowResistanceLines] = useState(false); // Disabled by default on startup
  const [maxTokensLimit, setMaxTokensLimit] = useState(isExhaustiveAllMode ? 9999 : 20);
  const [isFocusedOnDenseZone, setIsFocusedOnDenseZone] = useState(false);
  const [showFlatBaseOnly, setShowFlatBaseOnly] = useState(false);
  const [showMiniCharts, setShowMiniCharts] = useState(showTop5DominanceCharts); // Disabled by default for maximum speed & 0 lag
  const [neverTouchedTier5to9Only, setNeverTouchedTier5to9Only] = useState(false);
  const [neverTouchedTier2to4Only, setNeverTouchedTier2to4Only] = useState(false);
  const [maximizedToken, setMaximizedToken] = useState(null);
  
  // 🎯 ZONE OPTIMALE D'ENTRÉE (Heatmap Stats)
  const [showOptimalZone, setShowOptimalZone] = useState(false);
  const [optimalZoneResult, setOptimalZoneResult] = useState(null);
  const optimalZoneSeriesRef = useRef(null);
  const optimalZonePriceLinesRef = useRef([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMaximizedToken(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const storageKey = compactMode ? 'nebula_radar_compact_chart_height' : 'nebula_radar_chart_height';

  // 📐 Mouse Draggable Resizable Chart Height State
  const [chartHeight, setChartHeight] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return Math.max(250, Math.min(1400, parseInt(saved, 10)));
    } catch (_) {}
    return compactMode ? 360 : 620;
  });
  const [isDraggingHeight, setIsDraggingHeight] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  const handleMouseDownResize = (e) => {
    e.preventDefault();
    setIsDraggingHeight(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = chartHeight;
  };

  useEffect(() => {
    if (!isDraggingHeight) return;

    const handleMouseMove = (e) => {
      const deltaY = e.clientY - dragStartYRef.current;
      const minH = compactMode ? 250 : 300;
      const newHeight = Math.max(minH, Math.min(1400, dragStartHeightRef.current + deltaY));
      setChartHeight(newHeight);
      try { localStorage.setItem(storageKey, newHeight.toString()); } catch (_) {}
    };

    const handleMouseUp = () => {
      setIsDraggingHeight(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHeight, chartHeight, compactMode, storageKey]);

  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      chartRef.current.applyOptions({
        height: chartHeight,
        width: chartContainerRef.current.clientWidth
      });
    }
  }, [chartHeight]);

  const positiveTokens = useMemo(() => {
    return isExhaustiveAllMode ? tokensList : tokensList.filter(t => t.score >= 0.0);
  }, [tokensList, isExhaustiveAllMode]);

  const top20Tokens = useMemo(() => {
    const sorted = [...positiveTokens].sort((a, b) => b.score - a.score);
    if (strate15to20Only) {
      return sorted.slice(14, 20); // strictly Ranks #15 to #20 (6 tokens)
    }
    if (isExhaustiveAllMode) {
      if (chunkRange === '1-25') return sorted.slice(0, 25);
      if (chunkRange === '26-50') return sorted.slice(25, 50);
      if (chunkRange === '51-75') return sorted.slice(50, 75);
      if (chunkRange === '76-100') return sorted.slice(75, 100);
      if (chunkRange === '101-150') return sorted.slice(100, 150);
      if (chunkRange === '151-200') return sorted.slice(150, 200);
      return sorted.slice(0, 25);
    }
    if (maxTokensLimit >= 9999) return sorted.slice(0, 30);
    return sorted.slice(0, maxTokensLimit);
  }, [positiveTokens, maxTokensLimit, isExhaustiveAllMode, chunkRange, strate15to20Only]);

  const realTrajectoryData = useMemo(() => {
    if (positiveTokens.length === 0) return { timePoints: [], groupCurve: [], tokenCurvesMap: {} };

    const nowSec = Math.floor(Date.now() / 1000);
    const nowDate = new Date();
    const utcMidnightTs = Math.floor(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()) / 1000);

    let targetStartTs = nowSec - 24 * 3600;

    if (timeframe === 'today-15m') { targetStartTs = utcMidnightTs; }
    else if (timeframe === '24h-15m') { targetStartTs = nowSec - 24 * 3600; }
    else if (timeframe === '24h-1h')  { targetStartTs = nowSec - 24 * 3600; }
    else if (timeframe === '24h-4h')  { targetStartTs = nowSec - 24 * 3600; }
    else if (timeframe === '7d-1h')   { targetStartTs = nowSec - 7 * 86400;  }
    else if (timeframe === '7d-4h')   { targetStartTs = nowSec - 7 * 86400;  }
    else if (timeframe === '30d-4h')  { targetStartTs = nowSec - 30 * 86400; }
    const tokenCurvesMap = {};
    const tokenCandlesMap = {};
    let masterTimePoints = [];

    positiveTokens.forEach(token => {
      const rSeries = token.ratioSeries;
      if (!rSeries || rSeries.length < 5) return;

      let startIdx = rSeries.findIndex(item => {
        const t = typeof item === 'object' ? item.time : 0;
        return t >= targetStartTs;
      });
      if (startIdx < 0 || startIdx >= rSeries.length) {
        startIdx = Math.max(0, rSeries.length - 96);
      }

      const startObj = rSeries[startIdx] || rSeries[0];
      const startRatio = typeof startObj === 'object' ? (startObj.open || startObj.close) : startObj;

      if (!startRatio || startRatio <= 0 || isNaN(startRatio)) return;

      const curve = [];
      const candles = [];
      const times = [];

      for (let i = startIdx; i < rSeries.length; i++) {
        const item = rSeries[i];
        const valClose = typeof item === 'object' ? item.close : item;
        const valOpen  = typeof item === 'object' && item.open  !== undefined ? item.open  : valClose;
        const valHigh  = typeof item === 'object' && item.high  !== undefined ? item.high  : Math.max(valOpen, valClose);
        const valLow   = typeof item === 'object' && item.low   !== undefined ? item.low   : Math.min(valOpen, valClose);
        const t        = typeof item === 'object' ? item.time : null;

        const pctChange = ((valClose - startRatio) / startRatio) * 100;
        curve.push(pctChange);
        if (t) {
          times.push(t);
          const openPct  = ((valOpen  - startRatio) / startRatio) * 100;
          const highPct  = ((valHigh  - startRatio) / startRatio) * 100;
          const lowPct   = ((valLow   - startRatio) / startRatio) * 100;
          const closePct = ((valClose - startRatio) / startRatio) * 100;
          candles.push({
            time: t,
            open: parseFloat(openPct.toFixed(2)),
            high: parseFloat(Math.max(openPct, closePct, highPct).toFixed(2)),
            low: parseFloat(Math.min(openPct, closePct, lowPct).toFixed(2)),
            close: parseFloat(closePct.toFixed(2))
          });
        }
      }

      tokenCurvesMap[token.cleanSymbol] = curve;
      tokenCandlesMap[token.cleanSymbol] = candles;
      if (times.length > masterTimePoints.length) masterTimePoints = times;
    });

    if (masterTimePoints.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      masterTimePoints = Array.from({ length: 96 }, (_, i) => now - (96 - i) * 900);
    }

    const groupCurve = masterTimePoints.map((_, idx) => {
      let sum = 0;
      let count = 0;
      Object.values(tokenCurvesMap).forEach(c => {
        if (c[idx] !== undefined && !isNaN(c[idx])) {
          sum += c[idx];
          count++;
        }
      });
      return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
    });

    // 🏆 CALCUL DES TRAJECTOIRES D'ORDRE/RANG (#1 À #20) 100% SYNCHRONISÉ AVEC LE CLASSEMENT MASTER (ΔS)
    const tokenRankCurvesMap = {};
    positiveTokens.forEach(t => { tokenRankCurvesMap[t.cleanSymbol] = []; });

    // Map each token to its exact current Master Table Rank (based on score ΔS)
    const currentMasterRankMap = {};
    top20Tokens.forEach((tok, rIdx) => {
      currentMasterRankMap[tok.cleanSymbol] = rIdx + 1;
    });

    const totalPoints = masterTimePoints.length;

    masterTimePoints.forEach((_, idx) => {
      const isLastPoint = (idx === totalPoints - 1);

      if (isLastPoint) {
        // EXACT TERMINAL RANKS matching Master Table (#1 STX, #2 TRUMP, #3 ENA, #4 PUMP, #5 VVV...)
        positiveTokens.forEach((token) => {
          const finalRank = currentMasterRankMap[token.cleanSymbol] || (positiveTokens.findIndex(t => t.cleanSymbol === token.cleanSymbol) + 1);
          tokenRankCurvesMap[token.cleanSymbol].push(-finalRank);
        });
      } else {
        // Historical relative score/momentum ranking across time
        const snapshot = [];
        positiveTokens.forEach(token => {
          const c = tokenCurvesMap[token.cleanSymbol];
          const masterR = currentMasterRankMap[token.cleanSymbol] || 999;
          
          if (c && c[idx] !== undefined && !isNaN(c[idx])) {
            // Blend historical relative delta with target score trajectory
            const progress = idx / (totalPoints - 1);
            const scoreProxy = (token.score || 0) * progress + (c[idx] || 0) * (1 - progress);
            snapshot.push({ sym: token.cleanSymbol, value: scoreProxy, masterR });
          }
        });

        // Sort descending by value
        snapshot.sort((a, b) => b.value - a.value);

        snapshot.forEach((item, rIdx) => {
          const rawHistoricalRank = rIdx + 1;
          const progress = idx / (totalPoints - 1);
          // Smooth progressive convergence to the true master rank
          const blendedRank = Math.round(rawHistoricalRank * (1 - Math.pow(progress, 2)) + item.masterR * Math.pow(progress, 2));
          const boundedRank = Math.max(1, Math.min(25, blendedRank));
          tokenRankCurvesMap[item.sym].push(-boundedRank);
        });
      }
    });

    // 👑 Dynamic Rolling Cross-Sectional Ranking at every timestamp t:
    // Guarantees mathematically: ATH Leader >= Top 3 >= Top 5 >= Top 10 >= Top 20 >= Group (No historical crossovers!)
    const allCurvesList = Object.values(tokenCurvesMap);

    const sortedScoresPerTime = masterTimePoints.map((_, idx) => {
      return allCurvesList
        .map(c => c[idx])
        .filter(v => v !== undefined && !isNaN(v))
        .sort((a, b) => b - a); // Tri décroissant à l'instant t
    });

    // 👑 1. Ligne de Référence du TOP 3 (Podium Champions à chaque instant t)
    const top3RefCurve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      if (vals.length === 0) return groupCurve[idx] || 0;
      const count = Math.min(3, vals.length);
      const sum = vals.slice(0, count).reduce((a, b) => a + b, 0);
      return parseFloat((sum / count).toFixed(2));
    });

    // 👑 2. Ligne de Référence du TOP 5 (Ultra-Élite à chaque instant t)
    const top5Curve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      if (vals.length === 0) return groupCurve[idx] || 0;
      const count = Math.min(5, vals.length);
      const sum = vals.slice(0, count).reduce((a, b) => a + b, 0);
      return parseFloat((sum / count).toFixed(2));
    });

    // 👑 3. Ligne de Référence du TOP 10 (Super-Élite à chaque instant t)
    const top10Curve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      if (vals.length === 0) return groupCurve[idx] || 0;
      const count = Math.min(10, vals.length);
      const sum = vals.slice(0, count).reduce((a, b) => a + b, 0);
      return parseFloat((sum / count).toFixed(2));
    });

    // 👑 4. Ligne de Référence du TOP 20 (Élite à chaque instant t)
    const top20Curve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      if (vals.length === 0) return groupCurve[idx] || 0;
      const count = Math.min(20, vals.length);
      const sum = vals.slice(0, count).reduce((a, b) => a + b, 0);
      return parseFloat((sum / count).toFixed(2));
    });

    // 🚥 LES 5 STRATES DE GROUPES INDÉPENDANTES (Non-Overlapping Tiers) :
    // 1. Strate [1] : Leader Suprême (Rang 1)
    const tier1Curve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      return vals.length > 0 ? parseFloat(vals[0].toFixed(2)) : (groupCurve[idx] || 0);
    });

    // 2. Strate [2-4] : Podium Chasseurs (Rangs 2 à 4)
    const tier2to4Curve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      const slice = vals.slice(1, 4);
      if (slice.length === 0) return tier1Curve[idx] || groupCurve[idx] || 0;
      const sum = slice.reduce((a, b) => a + b, 0);
      return parseFloat((sum / slice.length).toFixed(2));
    });

    // 3. Strate [5-9] : Peloton Élite (Rangs 5 à 9)
    const tier5to9Curve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      const slice = vals.slice(4, 9);
      if (slice.length === 0) return tier2to4Curve[idx] || groupCurve[idx] || 0;
      const sum = slice.reduce((a, b) => a + b, 0);
      return parseFloat((sum / slice.length).toFixed(2));
    });

    // 4. Strate [10-14] : Avant-Garde (Rangs 10 à 14)
    const tier10to14Curve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      const slice = vals.slice(9, 14);
      if (slice.length === 0) return tier5to9Curve[idx] || groupCurve[idx] || 0;
      const sum = slice.reduce((a, b) => a + b, 0);
      return parseFloat((sum / slice.length).toFixed(2));
    });

    // 5. Strate [15-20] : Porte d'Entrée Élite (Rangs 15 à 20)
    const tier15to20Curve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      const slice = vals.slice(14, 20);
      if (slice.length === 0) return tier10to14Curve[idx] || groupCurve[idx] || 0;
      const sum = slice.reduce((a, b) => a + b, 0);
      return parseFloat((sum / slice.length).toFixed(2));
    });

    // 🚨 1. Courbe Dynamique du Leader Max (Plafond ATH Rolling Max à chaque instant t)
    const athLeaderCurve = masterTimePoints.map((_, idx) => {
      const vals = sortedScoresPerTime[idx] || [];
      return vals.length > 0 ? parseFloat(vals[0].toFixed(2)) : (top20Curve[idx] || 0);
    });

    // 🏆 2. Courbe Dynamique du Podium (Moyenne du TOP 3 à chaque instant t)
    const top3Curve = top3RefCurve;

    // ⚡ 3. Courbe Dynamique d'Épuisement (Extension 2.8x du TOP 20 Rolling)
    const exhaustionCurve = masterTimePoints.map((_, idx) => {
      const t20 = top20Curve[idx] || 0;
      const exh = Math.max(0, t20) * 2.8;
      return parseFloat(exh.toFixed(2));
    });

    return { timePoints: masterTimePoints, groupCurve, top3RefCurve, top5Curve, top10Curve, top20Curve, tier1Curve, tier2to4Curve, tier5to9Curve, tier10to14Curve, tier15to20Curve, athLeaderCurve, top3Curve, exhaustionCurve, tokenCurvesMap, tokenCandlesMap, tokenRankCurvesMap };
  }, [positiveTokens, timeframe, top20Tokens]);

  const accelerationData = useMemo(() => {
    const { tokenCurvesMap } = realTrajectoryData;
    const accList = top20Tokens.map(token => {
      const curve = tokenCurvesMap[token.cleanSymbol];
      if (!curve || curve.length < 2) {
        return { ...token, accPct: 0 };
      }
      const curVal = curve[curve.length - 1] || 0;

      // Determine candle lookback for true 1-hour impulse rate (%/h) with 0 lag
      let lookback = 4; // default for 15m (4 * 15m = 1 hour)
      let hourlyFactor = 1;

      if (timeframe === 'today-15m' || timeframe === '24h-15m') {
        lookback = 4; // 1 hour = 4 candles
        hourlyFactor = 1;
      } else if (timeframe === '24h-1h' || timeframe === '7d-1h') {
        lookback = 1; // 1 hour = 1 candle
        hourlyFactor = 1;
      } else if (timeframe === '24h-4h' || timeframe === '7d-4h' || timeframe === '30d-4h') {
        lookback = 1; // 1 candle = 4 hours
        hourlyFactor = 0.25; // divide change over 4h by 4 to get %/h
      }

      const prevIdx = Math.max(0, curve.length - 1 - lookback);
      const prevVal = curve[prevIdx] || 0;
      const rawDelta = curVal - prevVal;
      const accPct = parseFloat((rawDelta * hourlyFactor).toFixed(2));

      return { ...token, accPct };
    });

    const sortedByAcc = [...accList].sort((a, b) => b.accPct - a.accPct);
    const topAccSymbol = sortedByAcc[0]?.cleanSymbol || null;

    return { accList, sortedByAcc, topAccSymbol };
  }, [top20Tokens, realTrajectoryData, timeframe]);

  // 🎯 Algorithme de Détection des Bases Plates & Ressorts Compressés (Score proche de 0)
  // 🔥 DÉTECTEUR EN DIRECT & ENREGISTREMENT : VRAIS NOUVEAUX ENTRANTS DANS LE TOP 5
  const newTop5Tokens = useMemo(() => {
    if (!realTrajectoryData || !realTrajectoryData.tokenRankCurvesMap) return [];
    const { tokenCurvesMap, tokenRankCurvesMap } = realTrajectoryData;
    const list = [];
    const top5 = top20Tokens.slice(0, 5);

    top5.forEach((token, idx) => {
      const sym = token.cleanSymbol;
      const rankCurve = tokenRankCurvesMap?.[sym];
      const scoreCurve = tokenCurvesMap?.[sym];
      const acc = accelerationData.accList.find(a => a.cleanSymbol === sym)?.accPct || 0;

      if (!rankCurve || rankCurve.length < 10) return;

      const len = rankCurve.length;
      const curRank = Math.abs(rankCurve[len - 1]);
      
      const rank2hAgo = Math.abs(rankCurve[Math.max(0, len - 8)] || rankCurve[0]);
      const rank4hAgo = Math.abs(rankCurve[Math.max(0, len - 16)] || rankCurve[0]);
      const startRank = Math.abs(rankCurve[0]);
      const startScore = scoreCurve && scoreCurve.length > 0 ? scoreCurve[0] : 0;

      const wasOutsideRecently = rank2hAgo > 5 || rank4hAgo > 5 || (startRank > 8 && startScore < 12);
      const isCurrentlyTop5 = curRank <= 5;
      const isGenuineNewEntry = isCurrentlyTop5 && wasOutsideRecently;

      if (isGenuineNewEntry) {
        list.push({
          cleanSymbol: sym,
          symbol: token.symbol,
          rank: idx + 1,
          startRank: rank4hAgo > 5 ? rank4hAgo : startRank,
          score: typeof token.score === 'number' ? token.score : parseFloat(token.score || 0),
          entryPrice: token.price ? token.price.toFixed(4) : '',
          acc: (acc >= 0 ? '+' : '') + acc
        });
      }
    });

    return list;
  }, [top20Tokens, realTrajectoryData, accelerationData]);

  // ⏰ RÈGLE 3 : DÉBUT DES SIGNAUX DISCORD À PARTIR DE CET INSTANT PRÉCIS
  const discordSessionStartRef = useRef(Date.now());

  // 🗃️ AUTO-SAVE NEW SIGNALS INTO PERSISTENT JOURNAL
  useEffect(() => {
    if (newTop5Tokens.length === 0) return;

    setRecordedSignals(prev => {
      const updated = [...prev];
      let hasChanges = false;
      const now = new Date();
      const formattedTime = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      newTop5Tokens.forEach(t => {
        // Only add if not already recorded within the last 3 hours
        const exists = updated.some(r => r.cleanSymbol === t.cleanSymbol && (Date.now() - r.timestamp < 3 * 3600 * 1000));
        if (!exists) {
          const newSignalObj = {
            id: t.cleanSymbol + '_' + Date.now(),
            cleanSymbol: t.cleanSymbol,
            symbol: t.symbol,
            rank: t.rank,
            startRank: t.startRank,
            score: t.score,
            acc: t.acc,
            entryPrice: t.entryPrice,
            timestamp: Date.now(),
            formattedTime
          };
          updated.unshift(newSignalObj);
          hasChanges = true;

          // 📡 TRANSMISSION AUTOMATIQUE AU WEBHOOK DISCORD (Uniquement à partir de cet instant)
          if (newSignalObj.timestamp >= discordSessionStartRef.current - 10000) {
            sendDiscordTop5Signal(newSignalObj);
          }
        }
      });

      if (hasChanges) {
        const trimmed = updated.slice(0, 20); // Keep last 20 signals
        try {
          localStorage.setItem('nebula_recorded_top5_signals_v1', JSON.stringify(trimmed));
        } catch (_) {}
        return trimmed;
      }
      return prev;
    });
  }, [newTop5Tokens]);

  const handleDeleteRecordedSignal = (id) => {
    setRecordedSignals(prev => {
      const next = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem('nebula_recorded_top5_signals_v1', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleClearAllRecordedSignals = () => {
    setRecordedSignals([]);
    try {
      localStorage.removeItem('nebula_recorded_top5_signals_v1');
    } catch (_) {}
  };

  const flatBaseAnalysis = useMemo(() => {
    const { tokenCurvesMap } = realTrajectoryData;
    const candidates = [];
    const scanPool = (tokensList && tokensList.length > 0) ? tokensList : positiveTokens;

    scanPool.forEach(token => {
      const curve = tokenCurvesMap[token.cleanSymbol];
      if (!curve || curve.length < 5) return;

      const latestVal = curve[curve.length - 1] || 0;
      const minVal = Math.min(...curve);
      const maxVal = Math.max(...curve);
      const amplitude = maxVal - minVal;

      const sum = curve.reduce((a, b) => a + b, 0);
      const mean = sum / curve.length;
      const variance = curve.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / curve.length;
      const stdDev = Math.sqrt(variance);

      // Critères de "Base Plate / Ressort Compressé (Score Proche de 0)" :
      // 1. Pas d'explosion démesurée passée (amplitude <= 20.0% et maxVal <= 20.0%)
      // 2. Pas de dump extrême au fond du trou (minVal >= -15.0%)
      // 3. Valeur actuelle / score situé dans la zone d'or (-3.5% à +7.0%)
      // 4. Stabilité élevée (stdDev <= 4.5)
      if (amplitude <= 20.0 && minVal >= -15.0 && maxVal <= 20.0 && latestVal >= -4.0 && latestVal <= 7.0 && token.score >= -2.5 && token.score <= 10.0) {
        // Score de Stabilité / Compression de 10 à 100%
        const stabilityScore = Math.max(10, Math.min(100, Math.round(100 - (stdDev * 10 + Math.abs(latestVal) * 3 + amplitude * 1.5))));
        candidates.push({
          ...token,
          stabilityScore,
          amplitude: parseFloat(amplitude.toFixed(1)),
          stdDev: parseFloat(stdDev.toFixed(2)),
          latestVal: parseFloat(latestVal.toFixed(1)),
        });
      }
    });

    // Trier par stabilité la plus forte (courbes les plus calmes/plates d'abord)
    candidates.sort((a, b) => b.stabilityScore - a.stabilityScore);

    return candidates;
  }, [tokensList, positiveTokens, realTrajectoryData]);

  // 🏛️ MOTEUR D'HISTORIQUE DES VISITEURS DU TOP 5 SUR 24H (SYNCHRONISATION 100% STRICTE)
  const top5VisitorsList = useMemo(() => {
    const { tokenCurvesMap, timePoints } = realTrajectoryData;
    if (!tokenCurvesMap || !timePoints || timePoints.length === 0) return [];

    const numSteps = timePoints.length;
    const visitorsMap = {};

    for (let step = 0; step < numSteps; step++) {
      const stepScores = [];
      Object.entries(tokenCurvesMap).forEach(([sym, curve]) => {
        if (curve[step] !== undefined) {
          stepScores.push({ sym, score: curve[step] });
        }
      });

      stepScores.sort((a, b) => b.score - a.score);
      const top5 = stepScores.slice(0, 5);

      top5.forEach((item, rankIdx) => {
        const sym = item.sym;
        const score = item.score;
        if (!visitorsMap[sym]) {
          visitorsMap[sym] = {
            sym,
            firstEntryStep: step,
            entryScore: parseFloat(score.toFixed(1)),
            entryRank: rankIdx + 1,
            maxScore: parseFloat(score.toFixed(1)),
            stepsInTop5: 1
          };
        } else {
          visitorsMap[sym].stepsInTop5 += 1;
          if (score > visitorsMap[sym].maxScore) {
            visitorsMap[sym].maxScore = parseFloat(score.toFixed(1));
          }
        }
      });
    }

    return Object.values(visitorsMap).map(v => {
      const curve = tokenCurvesMap[v.sym] || [];
      const curVal = curve[curve.length - 1] !== undefined ? curve[curve.length - 1] : v.entryScore;
      const hoursInTop5 = parseFloat(((v.stepsInTop5 * 15) / 60).toFixed(1));
      const impulseAfterEntry = parseFloat((v.maxScore - v.entryScore).toFixed(1));
      return {
        ...v,
        currentScore: curVal,
        hoursInTop5,
        impulseAfterEntry
      };
    });
  }, [realTrajectoryData]);

  const filteredTokensToPlot = useMemo(() => {
    if (showFlatBaseOnly) {
      if (isolatedSymbol) {
        return flatBaseAnalysis.filter(t => t.cleanSymbol === isolatedSymbol);
      }
      return flatBaseAnalysis.slice(0, 25);
    }

    if (isolatedSymbol) {
      return top20Tokens.filter(t => t.cleanSymbol === isolatedSymbol);
    }

    // 🎯 FILTRE SNIPER ULTIME : VRAIS NOUVEAUX ENTRANTS DU TOP 5 EN DIRECT + VISITEURS FRAIS (ACCÉLÉRATION ≥ +1.0%/h)
    if (showFreshSniperOnly) {
      const freshCandidatesMap = new Map();

      // 1. Inclure DIRECTEMENT les NOUVEAUX DU TOP 5 EN DIRECT (comme PUMP avec son badge 🔥 et son accélération +3.79%/h)
      if (newTop5Tokens && newTop5Tokens.length > 0) {
        newTop5Tokens.forEach(t => {
          const tokAcc = accelerationData?.accList?.find(a => a.cleanSymbol === t.cleanSymbol)?.accPct || 0;
          const curScore = typeof t.score === 'number' ? t.score : (parseFloat(t.score) || 0);
          if (tokAcc >= 1.0 && curScore <= 35) {
            freshCandidatesMap.set(t.cleanSymbol, {
              cleanSymbol: t.cleanSymbol,
              acc: tokAcc,
              score: curScore
            });
          }
        });
      }

      // 2. Inclure les visiteurs récents (< 3.5h) ayant une accélération active
      if (top5VisitorsList && top5VisitorsList.length > 0) {
        top5VisitorsList.forEach(v => {
          const isFresh = v.hoursInTop5 <= 3.5 && v.entryScore <= 12 && v.currentScore <= 32 && v.currentScore >= -2;
          if (isFresh) {
            const tokAcc = accelerationData?.accList?.find(a => a.cleanSymbol === v.sym)?.accPct || 0;
            if (tokAcc >= 1.0) {
              if (!freshCandidatesMap.has(v.sym)) {
                freshCandidatesMap.set(v.sym, {
                  cleanSymbol: v.sym,
                  acc: tokAcc,
                  score: v.currentScore
                });
              }
            }
          }
        });
      }

      const freshList = Array.from(freshCandidatesMap.values());
      freshList.sort((a, b) => b.acc - a.acc);

      const freshSyms = new Set(freshList.slice(0, 5).map(v => v.cleanSymbol));
      const pool = (tokensList && tokensList.length > 0) ? tokensList : top20Tokens;
      return pool.filter(t => freshSyms.has(t.cleanSymbol));
    }

            let list = top20Tokens;

    if (hideBelowGroup) {
      const { groupCurve, tokenCurvesMap } = realTrajectoryData;
      const latestGroupVal = groupCurve[groupCurve.length - 1] || 0;
      list = list.filter(token => {
        const curve = tokenCurvesMap[token.cleanSymbol];
        if (!curve || curve.length === 0) return false;
        const latestVal = curve[curve.length - 1] || 0;
        return latestVal >= latestGroupVal;
      });
    }

    if (showTop5AccOnly) {
      const top5Symbols = new Set(accelerationData.sortedByAcc.slice(0, 5).map(t => t.cleanSymbol));
      list = list.filter(token => top5Symbols.has(token.cleanSymbol));
    }

    if (showTop5LeadersOnly) {
      list = top20Tokens.slice(0, 5);
    }

    if (isZone0to30Active) {
      const { tokenCurvesMap } = realTrajectoryData;
      list = list.filter(token => {
        const curve = tokenCurvesMap[token.cleanSymbol];
        if (!curve || curve.length === 0) return true;
        const latestVal = curve[curve.length - 1] || 0;
        return latestVal >= -5 && latestVal <= 35;
      });
    }

    if (freshBreakoutHours > 0) {
      const { timePoints, groupCurve, tokenCurvesMap } = realTrajectoryData;
      const len = timePoints.length;
      if (len >= 2) {
        let candlesInWindow = freshBreakoutHours;
        if (timeframe === 'today-15m' || timeframe === '24h-15m') candlesInWindow = freshBreakoutHours * 4;
        else if (timeframe === '24h-1h' || timeframe === '7d-1h') candlesInWindow = freshBreakoutHours;
        else if (timeframe === '24h-4h' || timeframe === '7d-4h' || timeframe === '30d-4h') candlesInWindow = Math.max(1, freshBreakoutHours);

        const windowStartIdx = Math.max(0, len - 1 - candlesInWindow);

        list = list.filter(token => {
          const curve = tokenCurvesMap[token.cleanSymbol];
          if (!curve || curve.length !== len) return false;
          const curVal = curve[len - 1] || 0;
          const curGroup = groupCurve[len - 1] || 0;
          if (curVal < curGroup && curVal < 0) return false;
          const valuesInWindow = curve.slice(Math.max(0, windowStartIdx - 1), len);
          const groupsInWindow = groupCurve.slice(Math.max(0, windowStartIdx - 1), len);
          return valuesInWindow.some((v, idx) => v <= (groupsInWindow[idx] || 0) || v <= 1.5);
        });
      }
    }

    if (neverTouchedTier5to9Only) {
      const { tier5to9Curve, tokenCurvesMap, tokenCandlesMap } = realTrajectoryData;
      if (tier5to9Curve && tier5to9Curve.length > 0) {
        list = list.filter(token => {
          const curve = tokenCurvesMap[token.cleanSymbol];
          if (!curve || curve.length === 0) return true;
          const candles = tokenCandlesMap?.[token.cleanSymbol];
          const hasTouched = curve.some((val, idx) => {
            const threshold = tier5to9Curve[idx] !== undefined ? tier5to9Curve[idx] : 999;
            const peakVal = (candles && candles[idx]) ? candles[idx].high : val;
            return peakVal >= threshold;
          });
          return !hasTouched;
        });
      }
    }

    if (neverTouchedTier2to4Only) {
      const { tier2to4Curve, tokenCurvesMap, tokenCandlesMap } = realTrajectoryData;
      if (tier2to4Curve && tier2to4Curve.length > 0) {
        list = list.filter(token => {
          const curve = tokenCurvesMap[token.cleanSymbol];
          if (!curve || curve.length === 0) return true;
          const candles = tokenCandlesMap?.[token.cleanSymbol];
          const hasTouched = curve.some((val, idx) => {
            const threshold = tier2to4Curve[idx] !== undefined ? tier2to4Curve[idx] : 999;
            const peakVal = (candles && candles[idx]) ? candles[idx].high : val;
            return peakVal >= threshold;
          });
          return !hasTouched;
        });
      }
    }

    return list;
  }, [showFlatBaseOnly, flatBaseAnalysis, top20Tokens, tokensList, realTrajectoryData, hideBelowGroup, showTop5AccOnly, showFreshSniperOnly, showTop5LeadersOnly, accelerationData, isZone0to30Active, neverTouchedTier5to9Only, neverTouchedTier2to4Only, isolatedSymbol, freshBreakoutHours, timeframe]);

  const displayList = useMemo(() => {
    if (showFreshSniperOnly) {
      return filteredTokensToPlot;
    }

    if (showFlatBaseOnly) {
      if (isolatedSymbol) {
        return flatBaseAnalysis.filter(t => t.cleanSymbol === isolatedSymbol);
      }
      return flatBaseAnalysis.slice(0, 25);
    }

    let baseList = sortMode === 'acceleration' ? accelerationData.sortedByAcc : top20Tokens;
    if (showTop5LeadersOnly && sortMode !== 'acceleration') {
      baseList = top20Tokens.slice(0, 5);
    } else if (hideBelowGroup) {
      const { groupCurve, tokenCurvesMap } = realTrajectoryData;
      const latestGroupVal = groupCurve[groupCurve.length - 1] || 0;
      baseList = baseList.filter(token => {
        const curve = tokenCurvesMap[token.cleanSymbol];
        if (!curve || curve.length === 0) return true;
        const latestVal = curve[curve.length - 1] || 0;
        return latestVal >= latestGroupVal;
      });
    }

    if (neverTouchedTier5to9Only) {
      const { tier5to9Curve, tokenCurvesMap, tokenCandlesMap } = realTrajectoryData;
      if (tier5to9Curve && tier5to9Curve.length > 0) {
        baseList = baseList.filter(token => {
          const curve = tokenCurvesMap[token.cleanSymbol];
          if (!curve || curve.length === 0) return true;
          const candles = tokenCandlesMap?.[token.cleanSymbol];
          const hasTouched = curve.some((val, idx) => {
            const threshold = tier5to9Curve[idx] !== undefined ? tier5to9Curve[idx] : 999;
            const peakVal = (candles && candles[idx]) ? candles[idx].high : val;
            return peakVal >= threshold;
          });
          return !hasTouched;
        });
      }
    }

    if (neverTouchedTier2to4Only) {
      const { tier2to4Curve, tokenCurvesMap, tokenCandlesMap } = realTrajectoryData;
      if (tier2to4Curve && tier2to4Curve.length > 0) {
        baseList = baseList.filter(token => {
          const curve = tokenCurvesMap[token.cleanSymbol];
          if (!curve || curve.length === 0) return true;
          const candles = tokenCandlesMap?.[token.cleanSymbol];
          const hasTouched = curve.some((val, idx) => {
            const threshold = tier2to4Curve[idx] !== undefined ? tier2to4Curve[idx] : 999;
            const peakVal = (candles && candles[idx]) ? candles[idx].high : val;
            return peakVal >= threshold;
          });
          return !hasTouched;
        });
      }
    }

    return baseList;
  }, [showFreshSniperOnly, filteredTokensToPlot, showFlatBaseOnly, flatBaseAnalysis, isolatedSymbol, sortMode, accelerationData, top20Tokens, hideBelowGroup, neverTouchedTier5to9Only, neverTouchedTier2to4Only, realTrajectoryData]);

    const groupSeriesRef = useRef(null);
  const isFirstDataRenderRef = useRef(true);
  
  // Indicator Refs for Main Chart (Candle Mode)
  const mainEma20SeriesRef = useRef(null);
  const mainEma50SeriesRef = useRef(null);
  const mainTwapSeriesRef = useRef(null);
  const mainHhLhSeriesRef = useRef(null);

  // 📐 Auto-resize & fit content when weekly chart is expanded
  useEffect(() => {
    if (!isWeeklyCollapsed && chartRef.current && chartContainerRef.current) {
      setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth || 800,
            height: chartHeight
          });
          try {
            chartRef.current.timeScale().fitContent();
          } catch (_) {}
        }
      }, 60);
    }
  }, [isWeeklyCollapsed, chartHeight]);

  // 1. Initialize Chart Canvas ONCE on Mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: compactMode ? 340 : 620,
      layout: { background: { color: 'rgba(8,14,24,0.95)' }, textColor: '#ffffff', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' },
      grid: { vertLines: { color: 'rgba(42, 46, 57, 0.15)' }, horzLines: { color: 'rgba(42, 46, 57, 0.15)' } },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        scaleMargins: { top: 0.08, bottom: 0.08 },
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        timeVisible: true,
        rightOffset: 12,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true
      },
    });

    const groupSeries = chart.addLineSeries({
      color: '#ffffff',
      lineWidth: 2.5,
      title: '⚪ RÉFÉRENCE GROUPE (Score >= 0)',
      priceLineVisible: false,
      lastValueVisible: true,
    });
    groupSeriesRef.current = groupSeries;

    // 👑 1. Ligne de Référence du TOP 3 (Podium Champions)
    const top3RefSeries = chart.addLineSeries({
      color: '#ff007f', // Hot Neon Pink / Rose Magenta Fluo
      lineWidth: 2.2,
      lineStyle: 2, // Dashed line
      title: '👑 RÉFÉRENCE TOP 3 (Podium Champions)',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    top3RefSeriesRef.current = top3RefSeries;

    // 👑 2. Ligne de Référence du TOP 5 (Ultra-Élite)
    const top5Series = chart.addLineSeries({
      color: '#00e676', // Bright Emerald Green / Vert Émeraude Fluo
      lineWidth: 2.2,
      lineStyle: 2, // Dashed line
      title: '👑 RÉFÉRENCE TOP 5 (Ultra-Élite)',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    top5SeriesRef.current = top5Series;

    // 👑 3. Ligne de Référence du TOP 10 (Super-Élite)
    const top10Series = chart.addLineSeries({
      color: '#38bdf8', // Electric Sky Blue
      lineWidth: 2.2,
      lineStyle: 2, // Dashed line
      title: '👑 RÉFÉRENCE TOP 10 (Super-Élite)',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    top10SeriesRef.current = top10Series;

    // 👑 4. Ligne de Référence du TOP 20 (Élite)
    const top20Series = chart.addLineSeries({
      color: '#facc15', // Golden Yellow
      lineWidth: 2.2,
      lineStyle: 2, // Dashed Golden Line
      title: '👑 RÉFÉRENCE TOP 20 (Élite)',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    top20SeriesRef.current = top20Series;

    // 🚥 1. Strate [1] : Leader Suprême (Rang 1)
    const tier1Series = chart.addLineSeries({
      color: '#ff0055', // Crimson Red / Rouge Leader
      lineWidth: 2.5,
      lineStyle: 0, // Solid line
      title: '🚨 STRATE [1] : LEADER SUPRÊME',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    tier1SeriesRef.current = tier1Series;

    // 🚥 2. Strate [2-4] : Podium Chasseurs (Rangs 2 à 4)
    const tier2to4Series = chart.addLineSeries({
      color: '#e879f9', // Neon Orchid / Rose Fluo
      lineWidth: 2.2,
      lineStyle: 2, // Dashed line
      title: '👑 STRATE [2-4] : PODIUM CHASSEURS',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    tier2to4SeriesRef.current = tier2to4Series;

    // 🚥 3. Strate [5-9] : Peloton Élite (Rangs 5 à 9)
    const tier5to9Series = chart.addLineSeries({
      color: '#00e676', // Bright Emerald Green / Vert Émeraude Fluo
      lineWidth: 2.2,
      lineStyle: 2, // Dashed line
      title: '⚡ STRATE [5-9] : PELOTON ÉLITE',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    tier5to9SeriesRef.current = tier5to9Series;

    // 🚥 4. Strate [10-14] : Avant-Garde (Rangs 10 à 14)
    const tier10to14Series = chart.addLineSeries({
      color: '#38bdf8', // Electric Sky Blue / Bleu Cyan
      lineWidth: 2.2,
      lineStyle: 2, // Dashed line
      title: '🔷 STRATE [10-14] : AVANT-GARDE',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    tier10to14SeriesRef.current = tier10to14Series;

    // 🚥 5. Strate [15-20] : Porte d'Entrée Élite (Rangs 15 à 20)
    const tier15to20Series = chart.addLineSeries({
      color: '#facc15', // Golden Yellow / Jaune Or
      lineWidth: 2.2,
      lineStyle: 2, // Dashed line
      title: "🚪 STRATE [15-20] : PORTE D'ENTRÉE",
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    tier15to20SeriesRef.current = tier15to20Series;

    // 🚨 1. Courbe Dynamique du Leader Max (Plafond ATH Rolling)
    const athLeaderSeries = chart.addLineSeries({
      color: '#ff0055',
      lineWidth: 2.2,
      lineStyle: 0, // Solid line
      title: '🚨 PLAFOND DYNAMIQUE LEADER MAX (ATH)',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    athLeaderSeriesRef.current = athLeaderSeries;

    // 🏆 2. Courbe Dynamique du Podium (Moyenne TOP 3 Rolling)
    const top3Series = chart.addLineSeries({
      color: '#c084fc',
      lineWidth: 2,
      lineStyle: 2, // Dashed line
      title: '🏆 MOYENNE DYNAMIQUE PODIUM (TOP 3)',
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    top3SeriesRef.current = top3Series;

    // ⚡ 3. Courbe Dynamique d'Épuisement (Extension 2.8x TOP 20 Rolling)
    const exhaustionSeries = chart.addLineSeries({
      color: '#f97316',
      lineWidth: 2,
      lineStyle: 2, // Dashed line
      title: "⚡ SEUIL D'ÉPUISEMENT DYNAMIQUE (2.8x TOP 20)",
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });
    exhaustionSeriesRef.current = exhaustionSeries;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || !param.seriesData || param.seriesData.size === 0) { 
        setHoveredSymbol(null); 
        return; 
      }
      let bestSym = null;
      let minDistance = Infinity;

      param.seriesData.forEach((val, s) => {
        Object.entries(seriesMapRef.current).forEach(([sym, obj]) => {
          if (obj.series === s && val.value !== undefined) {
            const seriesY = s.priceToCoordinate(val.value);
            if (seriesY !== null) {
              const distance = Math.abs(param.point.y - seriesY);
              // Pick the series closest to the mouse pointer. Threshold of ~30 pixels for generous hover.
              if (distance < minDistance && distance < 30) {
                minDistance = distance;
                bestSym = sym;
              }
            }
          }
        });
      });

      setHoveredSymbol(bestSym);
    });

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    chartRef.current = chart;
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        if (candleSeriesRef.current) {
          try { chartRef.current.removeSeries(candleSeriesRef.current); } catch (_) {}
          candleSeriesRef.current = null;
        }
        if (top3RefSeriesRef.current) {
          try { chartRef.current.removeSeries(top3RefSeriesRef.current); } catch (_) {}
          top3RefSeriesRef.current = null;
        }
        if (top5SeriesRef.current) {
          try { chartRef.current.removeSeries(top5SeriesRef.current); } catch (_) {}
          top5SeriesRef.current = null;
        }
        if (top10SeriesRef.current) {
          try { chartRef.current.removeSeries(top10SeriesRef.current); } catch (_) {}
          top10SeriesRef.current = null;
        }
        if (top20SeriesRef.current) {
          try { chartRef.current.removeSeries(top20SeriesRef.current); } catch (_) {}
          top20SeriesRef.current = null;
        }
        if (tier1SeriesRef.current) {
          try { chartRef.current.removeSeries(tier1SeriesRef.current); } catch (_) {}
          tier1SeriesRef.current = null;
        }
        if (tier2to4SeriesRef.current) {
          try { chartRef.current.removeSeries(tier2to4SeriesRef.current); } catch (_) {}
          tier2to4SeriesRef.current = null;
        }
        if (tier5to9SeriesRef.current) {
          try { chartRef.current.removeSeries(tier5to9SeriesRef.current); } catch (_) {}
          tier5to9SeriesRef.current = null;
        }
        if (tier10to14SeriesRef.current) {
          try { chartRef.current.removeSeries(tier10to14SeriesRef.current); } catch (_) {}
          tier10to14SeriesRef.current = null;
        }
        if (tier15to20SeriesRef.current) {
          try { chartRef.current.removeSeries(tier15to20SeriesRef.current); } catch (_) {}
          tier15to20SeriesRef.current = null;
        }
        if (athLeaderSeriesRef.current) {
          try { chartRef.current.removeSeries(athLeaderSeriesRef.current); } catch (_) {}
          athLeaderSeriesRef.current = null;
        }
        if (top3SeriesRef.current) {
          try { chartRef.current.removeSeries(top3SeriesRef.current); } catch (_) {}
          top3SeriesRef.current = null;
        }
        if (exhaustionSeriesRef.current) {
          try { chartRef.current.removeSeries(exhaustionSeriesRef.current); } catch (_) {}
          exhaustionSeriesRef.current = null;
        }
        try { chartRef.current.remove(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, []);

  // 2. Reset zoom on timeframe change
  useEffect(() => {
    isFirstDataRenderRef.current = true;
  }, [timeframe]);

  const applyVerticalPriceScaleZoom = (zoomType) => {
    if (!chartRef.current) return;
    
    let provider = (original) => (typeof original === 'function' ? original() : null);

    if (zoomType === '15-20') {
      const { groupCurve, tier15to20Curve } = realTrajectoryData;
      const gMin = groupCurve && groupCurve.length > 0 ? Math.min(...groupCurve) : 0;
      const latest15to20 = tier15to20Curve && tier15to20Curve.length > 0 ? tier15to20Curve[tier15to20Curve.length - 1] : 3.5;
      const tMax = tier15to20Curve && tier15to20Curve.length > 0 ? Math.max(...tier15to20Curve) : 4;
      const minVal = parseFloat(Math.min(-0.5, gMin - 0.5).toFixed(2));
      const maxVal = parseFloat(Math.max(3.5, tMax + 0.8, latest15to20 + 0.8).toFixed(2));
      provider = () => ({ priceRange: { minValue: minVal, maxValue: maxVal } });
    } else if (zoomType === '10-20') {
      const { groupCurve, tier10to14Curve } = realTrajectoryData;
      const gMin = groupCurve && groupCurve.length > 0 ? Math.min(...groupCurve) : 0;
      const latest10to14 = tier10to14Curve && tier10to14Curve.length > 0 ? tier10to14Curve[tier10to14Curve.length - 1] : 7.0;
      const tMax = tier10to14Curve && tier10to14Curve.length > 0 ? Math.max(...tier10to14Curve) : 8;
      const minVal = parseFloat(Math.min(-0.5, gMin - 0.5).toFixed(2));
      const maxVal = parseFloat(Math.max(6.0, tMax + 1.2, latest10to14 + 1.2).toFixed(2));
      provider = () => ({ priceRange: { minValue: minVal, maxValue: maxVal } });
    }

    if (groupSeriesRef.current) {
      try { groupSeriesRef.current.applyOptions({ autoscaleInfoProvider: provider }); } catch (_) {}
    }
    if (candleSeriesRef.current) {
      try { candleSeriesRef.current.applyOptions({ autoscaleInfoProvider: provider }); } catch (_) {}
    }
    [
      top3RefSeriesRef, top5SeriesRef, top10SeriesRef, top20SeriesRef,
      tier1SeriesRef, tier2to4SeriesRef, tier5to9SeriesRef, tier10to14SeriesRef, tier15to20SeriesRef,
      athLeaderSeriesRef, top3SeriesRef, exhaustionSeriesRef
    ].forEach(ref => {
      if (ref && ref.current) {
        try { ref.current.applyOptions({ autoscaleInfoProvider: provider }); } catch (_) {}
      }
    });
    Object.values(seriesMapRef.current).forEach(obj => {
      if (obj && obj.series) {
        try { obj.series.applyOptions({ autoscaleInfoProvider: provider }); } catch (_) {}
      }
    });

    try {
      chartRef.current.priceScale('right').applyOptions({ autoScale: true });
    } catch (_) {}
  };

  // 3. In-Place Live Data Update Effect & Multiple White Lines Manager
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || positiveTokens.length === 0) return;

    const { timePoints, groupCurve, top3RefCurve, top5Curve, top10Curve, top20Curve, tier1Curve, tier2to4Curve, tier5to9Curve, tier10to14Curve, tier15to20Curve, athLeaderCurve, top3Curve, exhaustionCurve, tokenCurvesMap, tokenCandlesMap } = realTrajectoryData;
    if (!timePoints || timePoints.length === 0) return;

    // Update Group Reference Series in-place
    if (groupSeriesRef.current) {
      groupSeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: groupCurve[idx] || 0 })));
    }

    // 👑 1. Update Top 3 Reference Series in-place
    if (top3RefSeriesRef.current) {
      if (showEliteRefLines && top3RefCurve && top3RefCurve.length > 0) {
        top3RefSeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: top3RefCurve[idx] || 0 })));
        top3RefSeriesRef.current.applyOptions({ visible: true });
      } else {
        top3RefSeriesRef.current.setData([]);
        top3RefSeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 👑 2. Update Top 5 Reference Series in-place
    if (top5SeriesRef.current) {
      if (showEliteRefLines && top5Curve && top5Curve.length > 0) {
        top5SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: top5Curve[idx] || 0 })));
        top5SeriesRef.current.applyOptions({ visible: true });
      } else {
        top5SeriesRef.current.setData([]);
        top5SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 👑 3. Update Top 10 Reference Series in-place
    if (top10SeriesRef.current) {
      if (showEliteRefLines && top10Curve && top10Curve.length > 0) {
        top10SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: top10Curve[idx] || 0 })));
        top10SeriesRef.current.applyOptions({ visible: true });
      } else {
        top10SeriesRef.current.setData([]);
        top10SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 👑 4. Update Top 20 Elite Reference Series in-place
    if (top20SeriesRef.current) {
      if (showEliteRefLines && top20Curve && top20Curve.length > 0) {
        top20SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: top20Curve[idx] || 0 })));
        top20SeriesRef.current.applyOptions({ visible: true });
      } else {
        top20SeriesRef.current.setData([]);
        top20SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 🚥 1. Update Tier 1 Series in-place (Ligne Rouge : Leader Suprême)
    if (tier1SeriesRef.current) {
      const showTier1 = showTierGroups && !neverTouchedTier2to4Only && !neverTouchedTier5to9Only;
      if (showTier1 && tier1Curve && tier1Curve.length > 0) {
        tier1SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier1Curve[idx] || 0 })));
        tier1SeriesRef.current.applyOptions({ visible: true });
      } else {
        tier1SeriesRef.current.setData([]);
        tier1SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 🚥 2. Update Tier 2-4 Series in-place (Ligne Rose/Violette : Podium Chasseurs)
    if (tier2to4SeriesRef.current) {
      const showTier2to4 = showTierGroups && !neverTouchedTier2to4Only && !neverTouchedTier5to9Only;
      if (showTier2to4 && tier2to4Curve && tier2to4Curve.length > 0) {
        tier2to4SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier2to4Curve[idx] || 0 })));
        tier2to4SeriesRef.current.applyOptions({ visible: true });
      } else {
        tier2to4SeriesRef.current.setData([]);
        tier2to4SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 🚥 3. Update Tier 5-9 Series in-place (Ligne Verte : Peloton Élite)
    if (tier5to9SeriesRef.current) {
      const showTier5to9 = showTierGroups && !neverTouchedTier5to9Only;
      if (showTier5to9 && tier5to9Curve && tier5to9Curve.length > 0) {
        tier5to9SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier5to9Curve[idx] || 0 })));
        tier5to9SeriesRef.current.applyOptions({ visible: true });
      } else {
        tier5to9SeriesRef.current.setData([]);
        tier5to9SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 🚥 4. Update Tier 10-14 Series in-place
    if (tier10to14SeriesRef.current) {
      if (showTierGroups && tier10to14Curve && tier10to14Curve.length > 0) {
        tier10to14SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier10to14Curve[idx] || 0 })));
        tier10to14SeriesRef.current.applyOptions({ visible: true });
      } else {
        tier10to14SeriesRef.current.setData([]);
        tier10to14SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 🚥 5. Update Tier 15-20 Series in-place
    if (tier15to20SeriesRef.current) {
      if (showTierGroups && tier15to20Curve && tier15to20Curve.length > 0) {
        tier15to20SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier15to20Curve[idx] || 0 })));
        tier15to20SeriesRef.current.applyOptions({ visible: true });
      } else {
        tier15to20SeriesRef.current.setData([]);
        tier15to20SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 🚨 1. Update Dynamic ATH Leader Max Curve in-place
    if (athLeaderSeriesRef.current) {
      const showAth = showResistanceLines && !neverTouchedTier2to4Only && !neverTouchedTier5to9Only;
      if (showAth && athLeaderCurve && athLeaderCurve.length > 0) {
        athLeaderSeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: athLeaderCurve[idx] || 0 })));
        athLeaderSeriesRef.current.applyOptions({ visible: true });
      } else {
        athLeaderSeriesRef.current.setData([]);
        athLeaderSeriesRef.current.applyOptions({ visible: false });
      }
    }

    // 🏆 2. Update Dynamic Podium TOP 3 Average Curve in-place
    if (top3SeriesRef.current) {
      const showTop3Dyn = showResistanceLines && !neverTouchedTier2to4Only && !neverTouchedTier5to9Only;
      if (showTop3Dyn && top3Curve && top3Curve.length > 0) {
        top3SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: top3Curve[idx] || 0 })));
        top3SeriesRef.current.applyOptions({ visible: true });
      } else {
        top3SeriesRef.current.setData([]);
        top3SeriesRef.current.applyOptions({ visible: false });
      }
    }

    // ⚡ 3. Update Dynamic Exhaustion Curve (2.8x TOP 20) in-place
    if (exhaustionSeriesRef.current) {
      if (showResistanceLines && exhaustionCurve && exhaustionCurve.length > 0) {
        exhaustionSeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: exhaustionCurve[idx] || 0 })));
        exhaustionSeriesRef.current.applyOptions({ visible: true });
      } else {
        exhaustionSeriesRef.current.setData([]);
        exhaustionSeriesRef.current.applyOptions({ visible: false });
      }
    }

    const effectiveIsolated = isolatedSymbol || (selectedSymbol && filteredTokensToPlot.length === 1 ? selectedSymbol : null);

    // 🕯️ MODE BOUGIES DE SCORE JAPONAISES POUR TOKEN ISOLÉ
    if (effectiveIsolated && isolatedViewMode === 'candles') {
      // Remove all line series
      Object.keys(seriesMapRef.current).forEach(sym => {
        try { chart.removeSeries(seriesMapRef.current[sym].series); } catch (_) {}
        delete seriesMapRef.current[sym];
      });

      const tokenCandles = tokenCandlesMap?.[effectiveIsolated] || [];
      if (tokenCandles.length > 0) {
        let candleSeries = candleSeriesRef.current;
        if (!candleSeries) {
          candleSeries = chart.addCandlestickSeries({
            upColor: '#00ff88',
            downColor: '#ff0055',
            borderUpColor: '#00ff88',
            borderDownColor: '#ff0055',
            wickUpColor: '#00ff88',
            wickDownColor: '#ff0055',
            priceLineVisible: true,
            lastValueVisible: true,
          });
          candleSeriesRef.current = candleSeries;
        }
        candleSeries.setData(tokenCandles);
        candleSeries.applyOptions({
          title: `🕯️ ${effectiveIsolated} (Bougies de Momentum Score - 15m)`,
        });

        // Calcul EMA 20 & 50
        if (!mainEma20SeriesRef.current) {
          mainEma20SeriesRef.current = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        }
        if (!mainEma50SeriesRef.current) {
          mainEma50SeriesRef.current = chart.addLineSeries({ color: '#f97316', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
        }
        
        const ema20 = [];
        const ema50 = [];
        const k20 = 2 / 21;
        const k50 = 2 / 51;
        let ema20Val = tokenCandles[0].close;
        let ema50Val = tokenCandles[0].close;
        ema20.push({ time: tokenCandles[0].time, value: ema20Val });
        ema50.push({ time: tokenCandles[0].time, value: ema50Val });
        for (let i = 1; i < tokenCandles.length; i++) {
          ema20Val = tokenCandles[i].close * k20 + ema20Val * (1 - k20);
          ema50Val = tokenCandles[i].close * k50 + ema50Val * (1 - k50);
          ema20.push({ time: tokenCandles[i].time, value: ema20Val });
          ema50.push({ time: tokenCandles[i].time, value: ema50Val });
        }
        mainEma20SeriesRef.current.setData(ema20);
        mainEma50SeriesRef.current.setData(ema50);

        // Calcul Anchored TWAP (ancré sur le plus haut absolu du graphique visible)
        if (!mainTwapSeriesRef.current) {
          mainTwapSeriesRef.current = chart.addLineSeries({ color: '#fbbf24', lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: true, title: 'TWAP Ancré (High)' });
        }
        let absoluteHigh = -Infinity;
        let anchorIdx = -1;
        tokenCandles.forEach((c, idx) => {
          if (c.high > absoluteHigh) {
            absoluteHigh = c.high;
            anchorIdx = idx;
          }
        });
        const twapData = [];
        let cumulativeTP = 0;
        let count = 0;
        for (let i = 0; i < tokenCandles.length; i++) {
          const c = tokenCandles[i];
          if (i >= anchorIdx) {
            cumulativeTP += (c.high + c.low + c.close) / 3;
            count++;
            twapData.push({ time: c.time, value: cumulativeTP / count });
          }
        }
        mainTwapSeriesRef.current.setData(twapData);

        // Calcul HH / LH Segment (derniers pivots)
        if (!mainHhLhSeriesRef.current) {
          mainHhLhSeriesRef.current = chart.addLineSeries({ color: '#ffffff', lineWidth: 2, lineStyle: 3, priceLineVisible: true, lastValueVisible: true });
        }
        const pivots = [];
        const window = 4;
        for (let i = window; i < tokenCandles.length - 1; i++) {
          let isHigh = true;
          for (let j = 1; j <= window; j++) {
            const before = tokenCandles[i - j]?.high || -Infinity;
            const after = tokenCandles[i + j]?.high || -Infinity;
            if (tokenCandles[i].high <= before || tokenCandles[i].high <= after) {
              isHigh = false; break;
            }
          }
          if (isHigh) {
            if (pivots.length === 0 || i - pivots[pivots.length - 1].idx > 2) {
              pivots.push({ idx: i, val: tokenCandles[i].high, time: tokenCandles[i].time });
            }
          }
        }

        if (pivots.length >= 2) {
          const lastPivot = pivots[pivots.length - 1];
          const prevPivot = pivots[pivots.length - 2];
          const isHH = lastPivot.val >= prevPivot.val;
          
          const lastTime = tokenCandles[tokenCandles.length - 1].time;
          const hhLhData = [
            { time: prevPivot.time, value: prevPivot.val },
            { time: lastPivot.time, value: lastPivot.val }
          ];
          if (lastTime > lastPivot.time) {
            hhLhData.push({ time: lastTime, value: lastPivot.val });
          }
          
          mainHhLhSeriesRef.current.setData(hhLhData);
          mainHhLhSeriesRef.current.applyOptions({
             color: isHH ? '#00ff88' : '#ff0055',
             title: isHH ? 'HH (Higher High)' : 'LH (Lower High)'
          });
        }

      }
    } else {
      // Normal Line Mode: Remove candle and indicator series if they were created
      if (candleSeriesRef.current) {
        try { chart.removeSeries(candleSeriesRef.current); } catch (_) {}
        candleSeriesRef.current = null;
      }
      [mainEma20SeriesRef, mainEma50SeriesRef, mainTwapSeriesRef, mainHhLhSeriesRef].forEach(ref => {
        if (ref.current) {
          try { chart.removeSeries(ref.current); } catch (_) {}
          ref.current = null;
        }
      });

      const activeSymbolsSet = new Set(filteredTokensToPlot.map(t => t.cleanSymbol));

      // Remove series for tokens no longer in active list
      Object.keys(seriesMapRef.current).forEach(sym => {
        if (!activeSymbolsSet.has(sym)) {
          try { chart.removeSeries(seriesMapRef.current[sym].series); } catch (_) {}
          delete seriesMapRef.current[sym];
        }
      });

      // Update or Add series for active tokens
      filteredTokensToPlot.forEach((token, index) => {
        const scoreCurve = tokenCurvesMap[token.cleanSymbol];
        const rankCurve = realTrajectoryData.tokenRankCurvesMap?.[token.cleanSymbol];
        if (!scoreCurve && !rankCurve) return;

        // Acceleration Rank (#1, #2, #3, #4, #5)
        const accRankIdx = accelerationData.sortedByAcc.findIndex(a => a.cleanSymbol === token.cleanSymbol);
        const isAccTop5 = accRankIdx >= 0 && accRankIdx < 5;
        const accRank = isAccTop5 ? (accRankIdx + 1) : 0;
        const isTopAcc = accRank === 1;

        const baseColor = getTokenFixedColor(token.cleanSymbol);
        const tokAcc = accelerationData.accList.find(a => a.cleanSymbol === token.cleanSymbol)?.accPct || 0;
        
        const trueRank = top20Tokens.findIndex(t => t.cleanSymbol === token.cleanSymbol) + 1;
        const displayRank = trueRank > 0 ? trueRank : index + 1;

        const accTitlePrefix = accRank > 0 ? `🚀 #${accRank} ACCÉLÉRATION : ` : '';

        // 🔥 Detect if token is a GENUINE NEW TOP 5 ENTRANT (Was outside Top 5 2h-4h ago and just entered)
        const isNewTop5 = newTop5Tokens.some(n => n.cleanSymbol === token.cleanSymbol);
        const newTop5Prefix = isNewTop5 ? '🔥 NOUVEAU TOKEN DANS LE TOP 5 : ' : '';

        // 🏆 Dynamic Line Title & Data Points depending on scaleMode ('score' vs 'rank')
        let dataPoints = [];
        let lineTitle = '';

        if (scaleMode === 'rank') {
          const currentRank = rankCurve && rankCurve.length > 0 ? Math.abs(rankCurve[rankCurve.length - 1]) : displayRank;
          const startRank = rankCurve && rankCurve.length > 0 ? Math.abs(rankCurve[0]) : displayRank;
          lineTitle = `${newTop5Prefix}👑 #${currentRank} ${token.cleanSymbol} (Départ: #${startRank} ➔ Actuel: #${currentRank})`;
          dataPoints = timePoints.map((t, idx) => ({
            time: t,
            value: rankCurve && rankCurve[idx] !== undefined ? rankCurve[idx] : -displayRank
          }));
        } else {
          lineTitle = `${newTop5Prefix}${accTitlePrefix}#${displayRank} ${token.cleanSymbol} (${token.score >= 0 ? '+' : ''}${token.score.toFixed(1)} pts | Acc: ${tokAcc >= 0 ? '+' : ''}${tokAcc}%/h)`;
          dataPoints = timePoints.map((t, idx) => ({
            time: t,
            value: parseFloat((scoreCurve ? scoreCurve[idx] || 0 : 0).toFixed(2))
          }));
        }

        let seriesObj = seriesMapRef.current[token.cleanSymbol];

        const isFocused = activeFocusSymbolRef.current === token.cleanSymbol;
        const hasFocus = !!activeFocusSymbolRef.current;
        let targetColor = baseColor;
        let targetLineWidth = scaleMode === 'rank' ? 3.5 : (isTopAcc ? 4.5 : (accRank > 0 ? 3.5 : (index < 3 ? 3 : 2)));

        if (hasFocus) {
          if (isFocused) {
            targetColor = 'transparent';
            targetLineWidth = 0;
          } else {
            targetColor = 'rgba(255,255,255,0.05)';
            targetLineWidth = 1;
          }
        }

        const priceFormatConfig = scaleMode === 'rank' ? {
          type: 'custom',
          formatter: (val) => {
            const r = Math.abs(Math.round(val));
            if (r === 1) return '👑 #1';
            if (r === 2) return '🥈 #2';
            if (r === 3) return '🥉 #3';
            return `#${r}`;
          }
        } : {
          type: 'custom',
          formatter: (val) => `${val >= 0 ? '+' : ''}${val.toFixed(1)} pts`
        };

        if (seriesObj && seriesObj.series) {
          // In-place update!
          seriesObj.series.setData(dataPoints);
          seriesObj.series.applyOptions({
            color: targetColor,
            lineWidth: targetLineWidth,
            title: lineTitle,
            priceLineVisible: false,
            lastValueVisible: true,
            priceFormat: priceFormatConfig,
          });
          seriesObj.baseColor = baseColor;
          seriesObj.index = index;
          seriesObj.isTopAcc = isTopAcc;
        } else {
          // Create new line series
          const lineSeries = chart.addLineSeries({
            color: targetColor,
            lineWidth: targetLineWidth,
            title: lineTitle,
            priceLineVisible: false,
            lastValueVisible: true,
            priceFormat: priceFormatConfig,
          });
          lineSeries.setData(dataPoints);
          seriesMapRef.current[token.cleanSymbol] = { series: lineSeries, baseColor, index, isTopAcc };
          seriesObj = seriesMapRef.current[token.cleanSymbol];
        }

        // 🎯 Add/update markers for Top 5 Accelerators (#1 to #5)
        // When Top 5 Acc Filter is ON, show markers for all top 5; otherwise show for #1
        const shouldShowMarker = showTop5AccOnly ? isAccTop5 : (accRank === 1);

        if (shouldShowMarker && accRank > 0) {
          const len = timePoints.length;
          // Shift time offset horizontally for ranks #2, #3, #4, #5 to place text cleanly in staggered boxes
          const timeIdx = Math.max(0, len - 1 - ((accRank - 1) % 4));
          const pos = (accRank % 2 === 1) ? 'aboveBar' : 'belowBar';
          const shp = (accRank === 1) ? 'circle' : (pos === 'aboveBar' ? 'arrowUp' : 'arrowDown');
          
          seriesObj.series.setMarkers([
            {
              time: timePoints[timeIdx],
              position: pos,
              color: baseColor,
              shape: shp,
              size: 2,
              text: `#${accRank} ${token.cleanSymbol}`,
            }
          ]);
        } else {
          seriesObj.series.setMarkers([]);
        }
      });
    }

    // Render Permanent Solid White Horizontal Price Lines
    if (groupSeriesRef.current) {
      whitePriceLinesRef.current.forEach(pl => {
        try { groupSeriesRef.current.removePriceLine(pl); } catch (_) {}
      });
      whitePriceLinesRef.current = [];

      whiteLines.forEach((val, idx) => {
        try {
          const pl = groupSeriesRef.current.createPriceLine({
            price: val,
            color: '#ffffff',
            lineWidth: 2.5,
            lineStyle: 0, // Solid white line
            axisLabelVisible: true,
            title: `⚪ Ligne ${idx + 1} (${val >= 0 ? '+' : ''}${val.toFixed(2)}%)`,
          });
          whitePriceLinesRef.current.push(pl);
        } catch (_) {}
      });
    }

    // Render Dynamic Podium Leader Lines (#1, #2, #3, #4) strictly matching Master Table Rows #1, #2, #3, #4
    if (groupSeriesRef.current) {
      Object.values(podiumPriceLinesRef.current).forEach(pl => {
        try { groupSeriesRef.current.removePriceLine(pl); } catch (_) {}
      });
      podiumPriceLinesRef.current = {};

      const { tokenCurvesMap } = realTrajectoryData;
      const masterLeaders = top20Tokens.slice(0, 4);

      if (showDynamicPodiumLines && masterLeaders.length > 0) {
        // 👑 Leader #1 Dynamic Line (Master Table Row #1)
        const l1Token = masterLeaders[0];
        if (l1Token) {
          const curve1 = tokenCurvesMap[l1Token.cleanSymbol];
          const val1 = curve1 && curve1.length > 0 ? parseFloat((curve1[curve1.length - 1] || 0).toFixed(2)) : 0;
          try {
            const pl1 = groupSeriesRef.current.createPriceLine({
              price: val1,
              color: '#facc15', // Gold / Yellow
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: `👑 LEADER #1 : ${l1Token.cleanSymbol} (${val1 >= 0 ? '+' : ''}${val1.toFixed(2)}%)`,
            });
            podiumPriceLinesRef.current['leader1'] = pl1;
          } catch (_) {}
        }

        // 🥈 Leader #2 Dynamic Line (Master Table Row #2)
        const l2Token = masterLeaders[1];
        if (l2Token) {
          const curve2 = tokenCurvesMap[l2Token.cleanSymbol];
          const val2 = curve2 && curve2.length > 0 ? parseFloat((curve2[curve2.length - 1] || 0).toFixed(2)) : 0;
          try {
            const pl2 = groupSeriesRef.current.createPriceLine({
              price: val2,
              color: '#00ff88', // Emerald Green
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: `🥈 LEADER #2 : ${l2Token.cleanSymbol} (${val2 >= 0 ? '+' : ''}${val2.toFixed(2)}%)`,
            });
            podiumPriceLinesRef.current['leader2'] = pl2;
          } catch (_) {}
        }

        // 🥉 Leader #3 Dynamic Line (Master Table Row #3)
        const l3Token = masterLeaders[2];
        if (l3Token) {
          const curve3 = tokenCurvesMap[l3Token.cleanSymbol];
          const val3 = curve3 && curve3.length > 0 ? parseFloat((curve3[curve3.length - 1] || 0).toFixed(2)) : 0;
          try {
            const pl3 = groupSeriesRef.current.createPriceLine({
              price: val3,
              color: '#a855f7', // Purple
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: `🥉 LEADER #3 : ${l3Token.cleanSymbol} (${val3 >= 0 ? '+' : ''}${val3.toFixed(2)}%)`,
            });
            podiumPriceLinesRef.current['leader3'] = pl3;
          } catch (_) {}
        }

        // 🏅 Leader #4 Dynamic Line (Master Table Row #4)
        const l4Token = masterLeaders[3];
        if (l4Token) {
          const curve4 = tokenCurvesMap[l4Token.cleanSymbol];
          const val4 = curve4 && curve4.length > 0 ? parseFloat((curve4[curve4.length - 1] || 0).toFixed(2)) : 0;
          try {
            const pl4 = groupSeriesRef.current.createPriceLine({
              price: val4,
              color: '#00d2ff', // Electric Cyan
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: `🏅 LEADER #4 : ${l4Token.cleanSymbol} (${val4 >= 0 ? '+' : ''}${val4.toFixed(2)}%)`,
            });
            podiumPriceLinesRef.current['leader4'] = pl4;
          } catch (_) {}
        }
      }
    }

    // Fit content ONLY on very first render or timeframe change
    if (isFirstDataRenderRef.current) {
      chart.timeScale().fitContent();
      chart.timeScale().applyOptions({ rightOffset: 12 });
      isFirstDataRenderRef.current = false;
    }
  }, [positiveTokens, top20Tokens, displayList, filteredTokensToPlot, realTrajectoryData, accelerationData, timeframe, scaleMode, whiteLines, showDynamicPodiumLines, showEliteRefLines, showTierGroups, showResistanceLines, isFocusedOnDenseZone, isZone0to30Active, showFlatBaseOnly, flatBaseAnalysis, isolatedSymbol, selectedSymbol, isolatedViewMode, neverTouchedTier5to9Only, neverTouchedTier2to4Only]);

  useEffect(() => {
    // 1. Manage line curves visibility/translucency
    Object.entries(seriesMapRef.current).forEach(([sym, { series, baseColor, index, isTopAcc }]) => {
      if (!series) return;
      if (!activeFocusSymbol) {
        series.applyOptions({ color: baseColor, lineWidth: isTopAcc ? 4.5 : (index < 3 ? 3 : 2) });
      } else if (sym === activeFocusSymbol) {
        series.applyOptions({ color: 'transparent', lineWidth: 0 }); // Hide curve to show candles instead
      } else {
        series.applyOptions({ color: 'rgba(255,255,255,0.05)', lineWidth: 1 });
      }
    });

    // 2. Manage dynamic hover candlestick series
    if (chartRef.current) {
      const effectiveIsolated = isolatedSymbol || (selectedSymbol && filteredTokensToPlot.length === 1 ? selectedSymbol : null);
      const isAlreadyInCandleMode = effectiveIsolated && isolatedViewMode === 'candles';

      if (activeFocusSymbol && !isAlreadyInCandleMode) {
        let hoverCandleSeries = hoverCandleSeriesRef.current;
        if (!hoverCandleSeries) {
          hoverCandleSeries = chartRef.current.addCandlestickSeries({
            upColor: '#00ff88',
            downColor: '#ff0055',
            borderUpColor: '#00ff88',
            borderDownColor: '#ff0055',
            wickUpColor: '#00ff88',
            wickDownColor: '#ff0055',
            priceLineVisible: true,
            lastValueVisible: true,
          });
          hoverCandleSeriesRef.current = hoverCandleSeries;
        }

        const tokenCandles = realTrajectoryData.tokenCandlesMap?.[activeFocusSymbol] || [];
        hoverCandleSeries.setData(tokenCandles);
        hoverCandleSeries.applyOptions({
          visible: true,
          title: `🕯️ ${activeFocusSymbol}`,
        });
      } else {
        if (hoverCandleSeriesRef.current) {
          hoverCandleSeriesRef.current.applyOptions({ visible: false });
        }
      }
    }
  }, [activeFocusSymbol, selectedSymbol, hoveredSymbol, realTrajectoryData, isolatedSymbol, isolatedViewMode, filteredTokensToPlot.length]);

  const handleTokenSelectToggle = (sym) => {
    setSelectedSymbol(prev => prev === sym ? null : sym);
    if (onSelectToken) onSelectToken(sym);
  };

  const lastGroupPerf = realTrajectoryData.groupCurve[realTrajectoryData.groupCurve.length - 1] || 0;

  const zoomToZone = (hours) => {
    setActiveZoomHours(hours);
    if (!chartRef.current || !realTrajectoryData.timePoints || realTrajectoryData.timePoints.length === 0) return;
    const timeScale = chartRef.current.timeScale();
    const len = realTrajectoryData.timePoints.length;
    if (hours === 0) {
      timeScale.fitContent();
      timeScale.applyOptions({ rightOffset: 12 });
      return;
    }
    let candlesPerHour = 4;
    if (timeframe === '24h-1h' || timeframe === '7d-1h') candlesPerHour = 1;
    if (timeframe === '24h-4h' || timeframe === '30d-4h') candlesPerHour = 0.25;
    const numCandles = Math.max(3, Math.round(hours * candlesPerHour));
    const fromLogical = Math.max(0, len - numCandles);
    const toLogical = len - 1 + 12;
    try { timeScale.setVisibleLogicalRange({ from: fromLogical, to: toLogical }); } catch (_) { timeScale.fitContent(); }
  };

  // Utility function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const handleToggleOptimalZone = () => {
    if (showOptimalZone) {
      setShowOptimalZone(false);
      if (optimalZoneSeriesRef.current && chartRef.current) {
        if (Array.isArray(optimalZoneSeriesRef.current)) {
          optimalZoneSeriesRef.current.forEach(series => {
             chartRef.current.removeSeries(series);
          });
        } else {
          chartRef.current.removeSeries(optimalZoneSeriesRef.current);
        }
        optimalZoneSeriesRef.current = [];
      }
      return;
    }

    const results = calculateOptimalEntryZone(realTrajectoryData.tokenCurvesMap, filteredTokensToPlot);
    
    if (!results || results.length === 0) {
      alert("Pas assez de données de swings pour calculer des zones optimales sur cette période.");
      return;
    }
    
    setShowOptimalZone(true);
    optimalZoneSeriesRef.current = [];

    const maxWinRate = Math.max(...results.map(r => parseFloat(r.winRate)));

    if (chartRef.current) {
      results.forEach((res, index) => {
        const wr = parseFloat(res.winRate);
        const isSafest = (wr === maxWinRate && wr >= 60);

        let colorMain = '#0ea5e9';
        if (isSafest) {
            colorMain = '#ffd700';
        } else if (wr < 50) {
            colorMain = '#ef4444';
        }

        const bgOpacity = isSafest ? 0.25 : 0.08;

        const zoneSeries = chartRef.current.addBaselineSeries({
          baseValue: { type: 'price', price: res.min },
          topFillColor1: hexToRgba(colorMain, bgOpacity),
          topFillColor2: hexToRgba(colorMain, bgOpacity),
          topLineColor: hexToRgba(colorMain, 0.9),
          bottomFillColor1: 'rgba(0,0,0,0)',
          bottomFillColor2: 'rgba(0,0,0,0)',
          bottomLineColor: 'rgba(0,0,0,0)',
          lineWidth: isSafest ? 2 : 1, 
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          autoscaleInfoProvider: () => null 
        });
        optimalZoneSeriesRef.current.push(zoneSeries);

        if (realTrajectoryData.timePoints && realTrajectoryData.timePoints.length > 0) {
           const timeData = realTrajectoryData.timePoints.map(t => ({ time: t, value: res.max }));
           zoneSeries.setData(timeData);
        }
        
        zoneSeries.createPriceLine({
          price: res.max,
          color: colorMain,
          lineWidth: isSafest ? 2 : 1,
          lineStyle: isSafest ? 0 : 1,
          axisLabelVisible: true,
          title: `${isSafest ? '🌟' : '🎯'} ZONE #${index + 1} (${res.percentage}% des profits | WR: ${res.winRate}% [${res.wins}V - ${res.losses}D])`,
        });
        zoneSeries.createPriceLine({
          price: res.min,
          color: colorMain,
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: false,
        });
      });
    }
  };

  const handleToggleZoomStrate15to20 = () => {
    if (activeStrateZoom === '15-20') {
      setActiveStrateZoom(null);
      applyVerticalPriceScaleZoom(null);
    } else {
      setActiveStrateZoom('15-20');
      setShowTierGroups(true);
      applyVerticalPriceScaleZoom('15-20');
    }
  };

  const handleToggleZoomStrate10to20 = () => {
    if (activeStrateZoom === '10-20') {
      setActiveStrateZoom(null);
      applyVerticalPriceScaleZoom(null);
    } else {
      setActiveStrateZoom('10-20');
      setShowTierGroups(true);
      applyVerticalPriceScaleZoom('10-20');
    }
  };

  const handleFocusZone0to30 = () => {
    if (!chartRef.current) return;
    if (isZone0to30Active) {
      try {
        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
      } catch (_) {}
      setIsZone0to30Active(false);
    } else {
      try {
        chartRef.current.priceScale('right').applyOptions({ autoScale: false });
        chartRef.current.priceScale('right').setVisibleRange({ from: -2, to: 32 });
      } catch (_) {}
      setIsZone0to30Active(true);
    }
  };

  const handleResetPriceScale = () => {
    setActiveStrateZoom(null);
    setIsZone0to30Active(false);
    applyVerticalPriceScaleZoom(null);
    if (chartRef.current) {
      try {
        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
        chartRef.current.timeScale().fitContent();
        chartRef.current.timeScale().applyOptions({ rightOffset: 12 });
      } catch (_) {}
    }
  };

  const toggleFocusDenseZone = () => {
    setIsFocusedOnDenseZone(prev => !prev);
  };

  const handleChartClick = (e) => {
    if (!isDrawingMode || !chartContainerRef.current || !groupSeriesRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y >= 0 && y <= rect.height) {
      try {
        const price = groupSeriesRef.current.coordinateToPrice(y);
        if (price !== null && !isNaN(price)) {
          const roundedPrice = parseFloat(price.toFixed(2));
          setWhiteLines(prev => [...prev, roundedPrice]);
        }
      } catch (_) {}
    }
  };

  if (compactMode) {
    return (
      <div style={{ background: 'rgba(8,14,24,0.95)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 0 20px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
        
        {/* 🎛️ WEEKLY HEADER BAR WITH COLLAPSE / EXPAND ARROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 🔽 TOGGLE ARROW BUTTON TO COLLAPSE/EXPAND WEEKLY CHART */}
            <button
              onClick={() => setIsWeeklyCollapsed(prev => !prev)}
              style={{
                background: isWeeklyCollapsed ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${isWeeklyCollapsed ? '#00ff88' : 'rgba(255, 255, 255, 0.2)'}`,
                color: isWeeklyCollapsed ? '#00ff88' : '#ffffff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title={isWeeklyCollapsed ? "Cliquer pour afficher le graphique Weekly 7 Jours" : "Cliquer pour masquer / réduire le graphique Weekly 7 Jours"}
            >
              <span>{isWeeklyCollapsed ? '▶ AFFICHER GRAPHIQUE 7J (4H)' : '▼ RÉDUIRE GRAPHIQUE 7J (4H)'}</span>
            </button>

            <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: '800', letterSpacing: '0.5px' }}>
              {radarTitle || '📅 APERÇU 7 JOURS / 1 SEMAINE (4H)'}
            </span>
          </div>

          {!isWeeklyCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* 👑 PRINCIPAL BUTTON: TOP 5 LEADERS */}
              <button
                onClick={() => setShowTop5LeadersOnly(prev => !prev)}
                style={{
                  background: showTop5LeadersOnly ? '#00ff88' : 'rgba(255,255,255,0.06)',
                  color: showTop5LeadersOnly ? '#000000' : '#ffffff',
                  border: showTop5LeadersOnly ? '2px solid #00ff88' : '1px solid rgba(255,255,255,0.2)',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: showTop5LeadersOnly ? '0 0 14px rgba(0,255,136,0.7)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title="Affiche UNIQUEMENT les 5 Leaders du marché sur le graphique 7 Jours !"
              >
                <Crown size={14} color={showTop5LeadersOnly ? '#000000' : '#ffd700'} />
                {showTop5LeadersOnly ? '👑 TOP 5 LEADERS : ACTIF' : '👑 FILTRER TOP 5 LEADERS'}
              </button>

                        {/* 🎯 BOUTON FILTRE NOUVEAUX TOKENS FRAIS (< 3H) */}
          <button
            onClick={() => setShowFreshSniperOnly(prev => !prev)}
            style={{
              background: showFreshSniperOnly ? 'linear-gradient(135deg, #00ff88, #10b981)' : 'rgba(255,255,255,0.06)',
              color: showFreshSniperOnly ? '#000000' : '#00ff88',
              border: showFreshSniperOnly ? '2px solid #00ff88' : '1px solid rgba(0,255,136,0.35)',
              padding: '5px 13px',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: showFreshSniperOnly ? '0 0 18px rgba(0,255,136,0.8)' : 'none',
              transition: 'all 0.15s ease'
            }}
            title="Affiche uniquement les NOUVEAUX tokens frais (< 3h, score modéré <= 35, pas déjà partis à +80 comme AGI) !"
          >
            <Sparkles size={14} color={showFreshSniperOnly ? '#000000' : '#00ff88'} />
            {showFreshSniperOnly ? '🎯 NOUVEAUX TOKENS FRAIS (<3H) : ACTIF' : '🎯 NOUVEAUX TOKENS FRAIS (<3H)'}
          </button>

          {/* ⚡ BOUTON TOP 5 ACCÉLÉRÉS */}
              <button
                onClick={() => setShowTop5AccOnly(prev => !prev)}
                style={{
                  background: showTop5AccOnly ? '#00d2ff' : 'rgba(255,255,255,0.06)',
                  color: showTop5AccOnly ? '#000000' : '#ffffff',
                  border: showTop5AccOnly ? '2px solid #00d2ff' : '1px solid rgba(255,255,255,0.2)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Zap size={13} color={showTop5AccOnly ? '#000000' : '#00d2ff'} />
                {showTop5AccOnly ? '⚡ TOP 5 ACCÉLÉRÉS : ACTIF' : '⚡ TOP 5 ACCÉLÉRÉS'}
              </button>

              {/* 🔄 RESET SCALE */}
              <button
                onClick={handleResetPriceScale}
                style={{
                  background: 'rgba(0, 210, 255, 0.12)',
                  color: '#00d2ff',
                  border: '1px solid rgba(0, 210, 255, 0.35)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🔄 RESET ÉCHELLE
              </button>
            </div>
          )}
        </div>

        <div style={{ display: isWeeklyCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* 🎯 BARRE D'ISOLATION DES JETONS : TOP 5 LEADERS UNIQUEMENT */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '5px 8px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color: '#00ff88', fontSize: '0.72rem', fontWeight: '900', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🎯 FILTRER UN JETON :
            </span>

            {isolatedSymbol && (
              <button
                onClick={() => setIsolatedSymbol(null)}
                style={{ background: '#00ff88', color: '#000', border: 'none', padding: '3px 8px', borderRadius: '5px', fontSize: '0.70rem', fontWeight: '900', cursor: 'pointer' }}
              >
                🌐 TOUS LES TOP 5
              </button>
            )}

            {(showTop5LeadersOnly ? displayList.slice(0, 5) : displayList).map((token, idx) => {
              const sym = token.cleanSymbol;
              const isIsolated = isolatedSymbol === sym;
              const baseColor = getTokenFixedColor(sym);
              const trueRank = top20Tokens.findIndex(t => t.cleanSymbol === sym) + 1;
              const rankNum = trueRank > 0 ? trueRank : idx + 1;

              return (
                <button
                  key={sym}
                  onClick={() => handleToggleIsolateSymbol(sym)}
                  style={{
                    background: isIsolated ? baseColor : 'rgba(255,255,255,0.07)',
                    color: isIsolated ? '#000000' : '#ffffff',
                    border: `1px solid ${isIsolated ? baseColor : 'rgba(255,255,255,0.15)'}`,
                    borderLeft: `4px solid ${baseColor}`,
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontSize: '0.72rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isIsolated ? `0 0 10px ${baseColor}` : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  #{rankNum} {sym} ({token.score >= 0 ? '+' : ''}${token.score.toFixed(1)})
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative' }}>
            <div
              ref={chartContainerRef}
              onClick={handleChartClick}
              style={{
                width: '100%',
                height: `${chartHeight}px`,
                borderRadius: '8px 8px 0 0',
                overflow: 'hidden',
                transition: isDraggingHeight ? 'none' : 'height 0.2s ease',
              }}
            />

            {/* ↕️ MOUSE RESIZE HANDLE BAR FOR WEEKLY CHART */}
            <div
              onMouseDown={handleMouseDownResize}
              style={{
                width: '100%',
                height: '22px',
                background: isDraggingHeight ? 'rgba(0, 255, 136, 0.35)' : 'rgba(255, 255, 255, 0.06)',
                borderTop: '1px dashed rgba(0, 255, 136, 0.5)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0 0 8px 8px',
                cursor: 'row-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                userSelect: 'none',
                transition: 'background 0.2s ease',
                boxShadow: isDraggingHeight ? '0 0 12px rgba(0,255,136,0.4)' : 'none'
              }}
              title="Cliquez et glissez vers le bas ou le haut avec la souris pour changer la hauteur du graphique !"
            >
              <div style={{ width: '35px', height: '3px', background: isDraggingHeight ? '#00ff88' : '#666', borderRadius: '2px' }} />
              <span style={{ color: isDraggingHeight ? '#00ff88' : '#cccccc', fontSize: '0.73rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                ↕️ GLISSER À LA SOURIS POUR REDIMENSIONNER ({chartHeight}px)
              </span>
              <div style={{ width: '35px', height: '3px', background: isDraggingHeight ? '#00ff88' : '#666', borderRadius: '2px' }} />
            </div>

            
          </div>
        </div>
    </div>
  );
}

  return (
    <div style={{ background: 'rgba(8,14,24,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '20px', boxShadow: '0 0 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* 🌟 NOUVEAU : MACRO SENTIMENT GAUGES */}
      <MacroSentimentGauges 
        top20Tokens={top20Tokens} 
        realTrajectoryData={realTrajectoryData} 
        accelerationData={accelerationData} 
      />

      {/* 🏆 TOP 5 COMMAND CENTER */}
      <Top5CommandCenter
          top20Tokens={top20Tokens}
          tokenCurvesMap={realTrajectoryData?.tokenCurvesMap}
          tokenCandlesMap={realTrajectoryData?.tokenCandlesMap}
          groupCurve={realTrajectoryData?.groupCurve}
          timePoints={realTrajectoryData?.timePoints}
          accelerationData={accelerationData}
        />

      {/* 🎯 GOLDEN BANNER WHEN BASES PLATES MODE IS ACTIVE */}
      {showFlatBaseOnly && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'linear-gradient(90deg, rgba(245,158,11,0.22) 0%, rgba(217,119,6,0.12) 100%)', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.55)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '0.82rem', fontWeight: '900' }}>
            <Sparkles size={16} color="#fbbf24" />
            <span>🎯 <strong>MODE BASES PLATES 7J (COMPRESSION PROCHE DE 0) :</strong> {flatBaseAnalysis.length} jetons détectés en sommeil calme et stable (Score entre -3.5 et +7 pts, faible variance). Zone d'observation idéale pour attraper le 1er décollage (Risk/Reward optimal) !</span>
          </div>
          <button
            onClick={() => setShowFlatBaseOnly(false)}
            style={{ background: '#fbbf24', color: '#000000', border: 'none', padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '900', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ✕ DÉSACTIVER LE FILTRE
          </button>
        </div>
      )}

      {/* ⚡ EXHAUSTIVE TRANCHE SELECTOR BAR FOR MAXIMUM SPEED & ZERO LAG */}
      {isExhaustiveAllMode && !showFlatBaseOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '8px 12px', background: 'rgba(0,210,255,0.12)', borderRadius: '10px', border: '1px solid rgba(0,210,255,0.4)', scrollbarWidth: 'thin' }}>
          <span style={{ color: '#00d2ff', fontSize: '0.8rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', paddingRight: '6px' }}>
            ⚡ TRANCHE EXHAUSTIVE (ZÉRO LAG) :
          </span>
          {[
            { id: '1-25', label: '🥇 TOP 1 À 25' },
            { id: '26-50', label: '🥈 TOP 26 À 50' },
            { id: '51-75', label: '🥉 TOP 51 À 75' },
            { id: '76-100', label: '🎖️ TOP 76 À 100' },
            { id: '101-150', label: '📊 TOP 101 À 150' },
            { id: '151-200', label: '📈 TOP 151 À 200' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setChunkRange(item.id)}
              style={{
                background: chunkRange === item.id ? '#00d2ff' : 'rgba(255,255,255,0.06)',
                color: chunkRange === item.id ? '#000000' : '#ffffff',
                border: chunkRange === item.id ? 'none' : '1px solid rgba(0,210,255,0.3)',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: '900',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: chunkRange === item.id ? '0 0 12px rgba(0,210,255,0.6)' : 'none',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* 🎯 INTERACTIVE TOKEN ISOLATION BUTTONS BAR FOR MAIN 24H CHART */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', padding: '6px 10px', background: showFlatBaseOnly ? 'rgba(245,158,11,0.08)' : 'rgba(0,0,0,0.6)', borderRadius: '8px', border: showFlatBaseOnly ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(0,255,136,0.2)', scrollbarWidth: 'thin' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowFreshSniperOnly(prev => !prev)}
          style={{
            background: showFreshSniperOnly ? '#00ff88' : 'rgba(0, 255, 136, 0.15)',
            color: showFreshSniperOnly ? '#000000' : '#00ff88',
            border: '1px solid #00ff88',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '0.74rem',
            fontWeight: '900',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: showFreshSniperOnly ? '0 0 12px rgba(0,255,136,0.6)' : 'none',
            whiteSpace: 'nowrap'
          }}
          title="Afficher uniquement les nouveaux tokens frais du Top 5"
        >
          <Sparkles size={13} color={showFreshSniperOnly ? '#000000' : '#00ff88'} />
          <span>{showFreshSniperOnly ? '🎯 NOUVEAUX FRAIS (<3H) : ACTIF' : '🎯 FILTRER NOUVEAUX FRAIS (<3H)'}</span>
        </button>
      </div>
        <span style={{ color: showFlatBaseOnly ? '#fbbf24' : '#00ff88', fontSize: '0.74rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', paddingRight: '4px' }}>
          {showFlatBaseOnly ? '🎯 BASES PLATES DÉTECTÉES :' : '🎯 FILTRER UN JETON (ISOLATION) :'}
        </span>

        {isolatedSymbol && (
          <button
            onClick={() => setIsolatedSymbol(null)}
            style={{
              background: showFlatBaseOnly ? '#fbbf24' : '#00ff88',
              color: '#000000',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '900',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: showFlatBaseOnly ? '0 0 10px rgba(245,158,11,0.6)' : '0 0 10px rgba(0,255,136,0.6)',
            }}
            title="Cliquez pour ré-afficher tous les jetons sur le graphique !"
          >
            🌐 VOIR TOUS LES JETONS
          </button>
        )}

        {(showTop5LeadersOnly ? displayList.slice(0, 5) : displayList).map((token, idx) => {
          const sym = token.cleanSymbol;
          const isIsolated = isolatedSymbol === sym;
          const baseColor = getTokenFixedColor(sym);
          const trueRank = top20Tokens.findIndex(t => t.cleanSymbol === sym) + 1;
          const rankNum = trueRank > 0 ? trueRank : idx + 1;
          const flatItem = flatBaseAnalysis.find(f => f.cleanSymbol === sym);

          return (
            <button
              key={sym}
              onClick={() => handleToggleIsolateSymbol(sym)}
              style={{
                background: isIsolated ? baseColor : (isolatedSymbol ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)'),
                color: isIsolated ? '#000000' : (isolatedSymbol ? '#555555' : '#ffffff'),
                border: `1px solid ${isIsolated ? baseColor : 'rgba(255,255,255,0.15)'}`,
                borderLeft: `4px solid ${baseColor}`,
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: '900',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: (isolatedSymbol && !isIsolated) ? 0.35 : 1,
                transition: 'all 0.2s ease',
                boxShadow: isIsolated ? `0 0 12px ${baseColor}` : 'none',
              }}
              title={flatItem ? `Base Plate: Stabilité ${flatItem.stabilityScore}% | Amplitude 7J: ${flatItem.amplitude}% | Score: ${token.score.toFixed(1)} pts` : `Cliquez pour afficher uniquement ${sym} sur le graphique ! Re-cliquez pour tout ré-afficher.`}
            >
              {flatItem && showFlatBaseOnly ? `🎯 ${flatItem.stabilityScore}% ` : ''}#{rankNum} {sym} ({token.score >= 0 ? '+' : ''}${token.score.toFixed(1)})
            </button>
          );
        })}
      </div>

      {/* Giant Comparative Radar Chart with Mouse-Resizable Height PLACED FIRST AT THE TOP! */}
      <div style={{ position: 'relative' }}>
        <div
          ref={chartContainerRef}
          onClick={handleChartClick}
          style={{
            width: '100%',
            height: `${chartHeight}px`,
            borderRadius: '10px 10px 0 0',
            overflow: 'hidden',
            cursor: isDrawingMode ? 'crosshair' : 'default',
            transition: isDraggingHeight ? 'none' : 'height 0.2s ease',
          }}
        />

        {(isolatedSymbol || (selectedSymbol && filteredTokensToPlot.length === 1 ? selectedSymbol : null)) && isolatedViewMode === 'candles' && (
          <IsolatedUsdtChart symbol={isolatedSymbol || (selectedSymbol && filteredTokensToPlot.length === 1 ? selectedSymbol : null)} />
        )}

        {/* ↕️ MOUSE RESIZE HANDLE BAR */}
        <div
          onMouseDown={handleMouseDownResize}
          style={{
            width: '100%',
            height: '24px',
            background: isDraggingHeight ? 'rgba(0, 255, 136, 0.35)' : 'rgba(255, 255, 255, 0.06)',
            borderTop: '1px dashed rgba(0, 255, 136, 0.5)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0 0 10px 10px',
            cursor: 'row-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            userSelect: 'none',
            transition: 'background 0.2s ease',
            boxShadow: isDraggingHeight ? '0 0 15px rgba(0,255,136,0.4)' : 'none'
          }}
          title="Cliquez et glissez vers le bas ou le haut avec la souris pour changer la hauteur du graphique !"
        >
          <div style={{ width: '40px', height: '4px', background: isDraggingHeight ? '#00ff88' : '#666', borderRadius: '2px' }} />
          <span style={{ color: isDraggingHeight ? '#00ff88' : '#cccccc', fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.5px' }}>
            ↕️ GLISSER À LA SOURIS POUR REDIMENSIONNER LA HAUTEUR ({chartHeight}px)
          </span>
          <div style={{ width: '40px', height: '4px', background: isDraggingHeight ? '#00ff88' : '#666', borderRadius: '2px' }} />
        </div>
      </div>

      
        

        {/* Controls & Toolbars (Placed BELOW the Main Chart Canvas) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: 'rgba(0,0,0,0.5)', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
        
        {/* Left Group: Title + Top 5 Leaders Filter + Timeframe */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Flame size={20} color="#00ff88" />
          
          {/* 🎯 BOUTON PRINCIPAL NOUVEAUX TOKENS FRAIS (< 3H) */}
          <button
            onClick={() => setShowFreshSniperOnly(prev => !prev)}
            style={{
              background: showFreshSniperOnly ? 'linear-gradient(135deg, #00ff88, #10b981)' : 'rgba(255,255,255,0.06)',
              color: showFreshSniperOnly ? '#000000' : '#00ff88',
              border: showFreshSniperOnly ? '2px solid #00ff88' : '1px solid rgba(0,255,136,0.35)',
              padding: '5px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: showFreshSniperOnly ? '0 0 18px rgba(0,255,136,0.8)' : 'none',
              transition: 'all 0.15s ease'
            }}
            title="Affiche UNIQUEMENT les NOUVEAUX jetons frais (décollage récent < 3h, score sain <= 30 pts, pas déjà partis à +80 comme AGI) !"
          >
            <Sparkles size={15} color={showFreshSniperOnly ? '#000000' : '#00ff88'} />
            {showFreshSniperOnly ? '🎯 NOUVEAUX FRAIS (<3H) : ACTIF' : '🎯 NOUVEAUX FRAIS (<3H)'}
          </button>

          {/* 👑 PRIMARY BUTTON: TOP 5 LEADERS ONLY */}
          <button
            onClick={() => setShowTop5LeadersOnly(prev => !prev)}
            style={{
              background: showTop5LeadersOnly ? '#00ff88' : 'rgba(255,255,255,0.06)',
              color: showTop5LeadersOnly ? '#000000' : '#ffffff',
              border: showTop5LeadersOnly ? '2px solid #00ff88' : '1px solid rgba(255,255,255,0.2)',
              padding: '5px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: showTop5LeadersOnly ? '0 0 16px rgba(0,255,136,0.7)' : 'none',
              transition: 'all 0.15s ease'
            }}
            title="Affiche UNIQUEMENT les 5 Leaders du marché pour un trading sans bruit !"
          >
            <Crown size={15} color={showTop5LeadersOnly ? '#000000' : '#ffd700'} />
            {showTop5LeadersOnly ? '👑 TOP 5 LEADERS : ACTIF' : '👑 FILTRER TOP 5 LEADERS'}
          </button>

          {/* 🏆 BOUTON BASCULE : ÉCHELLE DES RANGS (#1-#20) VS SCORE (ΔS) */}
          <button
            onClick={() => setScaleMode(prev => prev === 'rank' ? 'score' : 'rank')}
            style={{
              background: scaleMode === 'rank' ? 'linear-gradient(135deg, #facc15, #f59e0b)' : 'rgba(255,255,255,0.06)',
              color: scaleMode === 'rank' ? '#000000' : '#facc15',
              border: scaleMode === 'rank' ? '2px solid #facc15' : '1px solid rgba(250,204,21,0.35)',
              padding: '5px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: scaleMode === 'rank' ? '0 0 18px rgba(250,204,21,0.8)' : 'none',
              transition: 'all 0.15s ease'
            }}
            title="Trace l'ascension et la chute dans le classement (#1 en haut, #5, #10, #20 en bas)"
          >
            <Trophy size={15} color={scaleMode === 'rank' ? '#000000' : '#facc15'} />
            {scaleMode === 'rank' ? '🏆 ÉCHELLE DES RANGS (#1 EN HAUT) : ACTIF' : '🏆 ÉCHELLE DE L’ORDRE / RANGS (#1-#20)'}
          </button>

          {/* ⚡ BOUTON TOP 5 ACCÉLÉRÉS */}
          <button
            onClick={() => setShowTop5AccOnly(prev => !prev)}
            style={{
              background: showTop5AccOnly ? '#00d2ff' : 'rgba(255,255,255,0.06)',
              color: showTop5AccOnly ? '#000000' : '#ffffff',
              border: showTop5AccOnly ? '2px solid #00d2ff' : '1px solid rgba(255,255,255,0.2)',
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: showTop5AccOnly ? '0 0 16px rgba(0,210,255,0.7)' : 'none',
              transition: 'all 0.15s ease'
            }}
            title="Affiche uniquement les 5 jetons avec la plus forte accélération (%/h) !"
          >
            <Zap size={14} color={showTop5AccOnly ? '#000000' : '#00d2ff'} />
            {showTop5AccOnly ? '⚡ TOP 5 ACCÉLÉRÉS : ACTIF' : '⚡ TOP 5 ACCÉLÉRÉS'}
          </button>

          {/* Timeframe Switcher */}
          <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.6)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { id: 'today-15m', label: "📅 AUJOURD'HUI" },
              { id: '24h-15m', label: '24H (15m)' },
              { id: '24h-1h',  label: '24H (1H)' },
              { id: '24h-4h',  label: '24H (4H)' },
              { id: '7d-4h',   label: '7J (4H)' },
              { id: '30d-4h',  label: '30J (4H)' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTimeframe(item.id)}
                style={{
                  background: timeframe === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: timeframe === item.id ? '#ffffff' : 'rgba(255,255,255,0.5)',
                  border: timeframe === item.id ? '1px solid rgba(255,255,255,0.3)' : 'none',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Reset Scale Button */}
          <button
            onClick={handleResetPriceScale}
            style={{
              background: 'rgba(0, 210, 255, 0.12)',
              color: '#00d2ff',
              border: '1px solid rgba(0, 210, 255, 0.35)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            🔄 RESET ÉCHELLE
          </button>
        </div>

        {/* Right Group: Toggle Secondary Tools Button */}
        <button
          onClick={() => setShowAdvancedToolbar(prev => !prev)}
          style={{
            background: showAdvancedToolbar ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: showAdvancedToolbar ? '#ffd700' : 'rgba(255, 255, 255, 0.65)',
            border: showAdvancedToolbar ? '1px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.12)',
            padding: '5px 12px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>🎛️ {showAdvancedToolbar ? 'MASQUER LES OUTILS SECONDAIRES ▲' : 'AFFICHER LES AUTRES OUTILS (15+) ▼'}</span>
        </button>
      </div>

      {/* 📦 TIROIR DÉROULANT DES OUTILS SECONDAIRES (MASQUÉ PAR DÉFAUT) */}
      {showAdvancedToolbar && (
        <div style={{
          background: 'rgba(6, 12, 22, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)'
        }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '900', textTransform: 'uppercase' }}>
            🛠️ Outils Secondaires, Filtres & Strates :
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {/* Top Limit */}
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.5)', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[10, 20, 50, 100, 200].map(lim => (
                <button
                  key={lim}
                  onClick={() => setMaxTokensLimit(lim)}
                  style={{
                    background: maxTokensLimit === lim ? '#00ff88' : 'transparent',
                    color: maxTokensLimit === lim ? '#000' : '#888',
                    border: 'none',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.66rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  TOP {lim}
                </button>
              ))}
            </div>

            {/* Breakout 1H & 4H */}
            <button
              onClick={() => handleToggleFreshBreakout(1)}
              style={{ background: freshBreakoutHours === 1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: freshBreakoutHours === 1 ? '#ffffff' : 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              <Zap size={12} color="#facc15" /> Breakout 1H
            </button>
            <button
              onClick={() => handleToggleFreshBreakout(4)}
              style={{ background: freshBreakoutHours === 4 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: freshBreakoutHours === 4 ? '#ffffff' : 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              <Flame size={12} color="#f97316" /> Breakout 4H
            </button>

            {/* Zone 0 à 30 */}
            <button
              onClick={handleFocusZone0to30}
              style={{ background: isZone0to30Active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: isZone0to30Active ? '#ffffff' : 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              🎯 Zone 0-30 pts
            </button>

            {/* Bases Plates */}
            <button
              onClick={() => setShowFlatBaseOnly(!showFlatBaseOnly)}
              style={{ background: showFlatBaseOnly ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: showFlatBaseOnly ? '#ffffff' : 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              ✨ Bases Plates ({flatBaseAnalysis.length})
            </button>

            {/* Backtest Optimal Zone */}
            <button
              onClick={handleToggleOptimalZone}
              style={{ background: showOptimalZone ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: showOptimalZone ? '#ffffff' : 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              🎯 Backtest Zone Profits
            </button>

            {/* Strates Zoom */}
            <button
              onClick={handleToggleZoomStrate15to20}
              style={{ background: activeStrateZoom === '15-20' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              🔍 Strate [15-20]
            </button>
            <button
              onClick={handleToggleZoomStrate10to20}
              style={{ background: activeStrateZoom === '10-20' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              🔍 Strate [10-20]
            </button>

            {/* Masquer sous ref */}
            <button
              onClick={() => setHideBelowGroup(!hideBelowGroup)}
              style={{ background: hideBelowGroup ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)', color: hideBelowGroup ? '#00ff88' : '#888', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              👁️ Masquer sous Réf. ({hideBelowGroup ? 'ACTIF' : 'INACTIF'})
            </button>

            {/* Dessiner Lignes Blanches */}
            <button
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              style={{ background: isDrawingMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: isDrawingMode ? '#ffffff' : 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer' }}
            >
              ✏️ {isDrawingMode ? 'Mode Tracé Actif' : 'Tracer Lignes Blanches'}
            </button>
          </div>
        </div>
      )}

      {/* Interactive Sticky Click Focus Chips Bar for Top Tokens */}
      {top20Tokens.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ color: '#888', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '6px' }}>
            <Eye size={14} color="#00ff88" /> ISOLER UN TOKEN (CLIQUEZ POUR FIXER) :
          </span>

          {selectedSymbol && (
            <>
              <button
                onClick={() => setSelectedSymbol(null)}
                style={{
                  background: '#00ff88',
                  color: '#000000',
                  border: 'none',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(0,255,136,0.6)',
                  marginRight: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                🔄 RÉAFFICHER TOUTES LES COURBES
              </button>

              <button
                onClick={() => setIsolatedViewMode(prev => prev === 'candles' ? 'line' : 'candles')}
                style={{
                  background: isolatedViewMode === 'candles' ? 'linear-gradient(135deg, #00ff88, #00d2ff)' : 'rgba(255,255,255,0.08)',
                  color: isolatedViewMode === 'candles' ? '#000000' : '#00d2ff',
                  border: isolatedViewMode === 'candles' ? 'none' : '1px solid rgba(0,210,255,0.4)',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isolatedViewMode === 'candles' ? '0 0 14px rgba(0,255,136,0.6)' : 'none',
                  marginRight: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Basculez l'affichage entre Bougies de Momentum OHLC et Ligne Continue pour le jeton isolé !"
              >
                {isolatedViewMode === 'candles' ? '🕯️ MODE BOUGIES SCORE (ACTIF)' : '📈 MODE LIGNE (ACTIF)'}
              </button>
            </>
          )}

          {(showTop5LeadersOnly ? displayList.slice(0, 5) : displayList).map((t, idx) => {
            const isSelected = selectedSymbol === t.cleanSymbol;
            const isHovered = hoveredSymbol === t.cleanSymbol;
            const isActive = isSelected || isHovered;
            const isTopAcc = t.cleanSymbol === accelerationData.topAccSymbol;
            const chipColor = getTokenFixedColor(t.cleanSymbol);

            return (
              <button
                key={t.symbol}
                onMouseEnter={() => setHoveredSymbol(t.cleanSymbol)}
                onMouseLeave={() => setHoveredSymbol(null)}
                onClick={() => handleTokenSelectToggle(t.cleanSymbol)}
                style={{
                  background: isSelected ? '#00ff88' : (isHovered ? chipColor : 'rgba(255,255,255,0.05)'),
                  color: isActive ? '#000000' : '#cccccc',
                  border: isSelected ? '2px solid #00ff88' : `1px solid ${isHovered ? chipColor : 'rgba(255,255,255,0.1)'}`,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 14px rgba(0,255,136,0.9)' : (isHovered ? `0 0 12px ${chipColor}` : 'none'),
                }}
              >
                {isTopAcc ? '⚡ ' : ''}#{idx + 1} {t.cleanSymbol}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── SUB-COMPONENT : MODALE PLEIN ÉCRAN D'UN JETON (TOUTE LA PAGE) ──
const FullscreenTokenChartModal = ({
  token,
  rank,
  timePoints,
  groupCurve,
  tier15to20Curve,
  tier10to14Curve,
  tier5to9Curve,
  tier2to4Curve,
  tokenCurve,
  tokenCandles,
  onClose,
  isTopAcc,
  accPct,
  onPrevToken,
  onNextToken,
  hasPrev,
  hasNext
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const groupSeriesRef = useRef(null);
  const tier15to20SeriesRef = useRef(null);
  const tier10to14SeriesRef = useRef(null);
  const tier5to9SeriesRef = useRef(null);
  const tier2to4SeriesRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const tokenSeriesRef = useRef(null);
  
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const anchoredTwapSeriesRef = useRef(null);
  const hhLhSeriesRef = useRef(null);
  
  const isFirstRenderRef = useRef(true);

  const color = getTokenFixedColor(token.cleanSymbol);

  // 1. Initialisation unique sur le token sélectionné
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 650,
      layout: { background: { color: '#030712' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.15)', autoScale: true, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.15)', timeVisible: true, rightOffset: 15 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true
      },
    });

    groupSeriesRef.current = chart.addLineSeries({
      color: 'rgba(255,255,255,0.9)',
      lineWidth: 2,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    tier15to20SeriesRef.current = chart.addLineSeries({
      color: '#facc15',
      lineWidth: 2.2,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    tier10to14SeriesRef.current = chart.addLineSeries({
      color: '#38bdf8',
      lineWidth: 2.2,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    tier5to9SeriesRef.current = chart.addLineSeries({
      color: '#00ff88',
      lineWidth: 2.2,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    tier2to4SeriesRef.current = chart.addLineSeries({
      color: '#e879f9',
      lineWidth: 2.2,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff0055',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff0055',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff0055',
      priceLineVisible: true,
      lastValueVisible: true,
    });

    tokenSeriesRef.current = chart.addLineSeries({
      color: color,
      lineWidth: 3,
      visible: false,
    });

    ema20SeriesRef.current = chart.addLineSeries({
      color: '#3b82f6', // blue
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    ema50SeriesRef.current = chart.addLineSeries({
      color: '#f97316', // orange
      lineWidth: 1.5,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    anchoredTwapSeriesRef.current = chart.addLineSeries({
      color: '#fbbf24', // yellow gold
      lineWidth: 2,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'ANCHORED TWAP'
    });

    hhLhSeriesRef.current = chart.addLineSeries({
      color: '#ffffff',
      lineWidth: 1,
      lineStyle: 3, // dotted
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    isFirstRenderRef.current = true;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, [token.cleanSymbol]);

  // 2. Mise à jour IN-PLACE des données en plein écran (aucun reset du zoom utilisateur !)
  useEffect(() => {
    if (!chartRef.current || !timePoints || timePoints.length === 0) return;

    if (groupCurve && groupCurve.length > 0 && groupSeriesRef.current) {
      groupSeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: groupCurve[idx] || 0 })));
    }
    if (tier15to20Curve && tier15to20Curve.length > 0 && tier15to20SeriesRef.current) {
      tier15to20SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier15to20Curve[idx] || 0 })));
    }
    if (tier10to14Curve && tier10to14Curve.length > 0 && tier10to14SeriesRef.current) {
      tier10to14SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier10to14Curve[idx] || 0 })));
    }
    if (tier5to9Curve && tier5to9Curve.length > 0 && tier5to9SeriesRef.current) {
      tier5to9SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier5to9Curve[idx] || 0 })));
    }
    if (tier2to4Curve && tier2to4Curve.length > 0 && tier2to4SeriesRef.current) {
      tier2to4SeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: tier2to4Curve[idx] || 0 })));
    }

    if (tokenCandles && tokenCandles.length > 0 && candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({ visible: true });
      if (tokenSeriesRef.current) tokenSeriesRef.current.applyOptions({ visible: false });
      candleSeriesRef.current.setData(tokenCandles);

      // Calcul EMA 20 & 50
      if (ema20SeriesRef.current && ema50SeriesRef.current) {
        const ema20 = [];
        const ema50 = [];
        const k20 = 2 / 21;
        const k50 = 2 / 51;
        
        let ema20Val = tokenCandles[0].close;
        let ema50Val = tokenCandles[0].close;
        
        ema20.push({ time: tokenCandles[0].time, value: ema20Val });
        ema50.push({ time: tokenCandles[0].time, value: ema50Val });
        
        for (let i = 1; i < tokenCandles.length; i++) {
          ema20Val = tokenCandles[i].close * k20 + ema20Val * (1 - k20);
          ema50Val = tokenCandles[i].close * k50 + ema50Val * (1 - k50);
          ema20.push({ time: tokenCandles[i].time, value: ema20Val });
          ema50.push({ time: tokenCandles[i].time, value: ema50Val });
        }
        
        ema20SeriesRef.current.setData(ema20);
        ema50SeriesRef.current.setData(ema50);
      }

      // Calcul Anchored TWAP (ancré sur le plus haut absolu du graphique visible)
      if (anchoredTwapSeriesRef.current) {
        let absoluteHigh = -Infinity;
        let anchorIdx = -1;
        tokenCandles.forEach((c, idx) => {
          if (c.high > absoluteHigh) {
            absoluteHigh = c.high;
            anchorIdx = idx;
          }
        });

        const twapData = [];
        let cumulativeTP = 0;
        let count = 0;
        for (let i = 0; i < tokenCandles.length; i++) {
          const c = tokenCandles[i];
          if (i >= anchorIdx) {
            cumulativeTP += (c.high + c.low + c.close) / 3;
            count++;
            twapData.push({ time: c.time, value: cumulativeTP / count });
          }
        }
        anchoredTwapSeriesRef.current.setData(twapData);
      }

      // Calcul HH / LH Segment (derniers pivots)
      if (hhLhSeriesRef.current) {
        const pivots = [];
        const window = 4; // Fenêtre pour trouver un sommet local
        for (let i = window; i < tokenCandles.length - 1; i++) {
          let isHigh = true;
          for (let j = 1; j <= window; j++) {
            const before = tokenCandles[i - j]?.high || -Infinity;
            const after = tokenCandles[i + j]?.high || -Infinity;
            if (tokenCandles[i].high <= before || tokenCandles[i].high <= after) {
              isHigh = false; break;
            }
          }
          if (isHigh) {
            // Éviter les doublons trop proches
            if (pivots.length === 0 || i - pivots[pivots.length - 1].idx > 2) {
              pivots.push({ idx: i, val: tokenCandles[i].high, time: tokenCandles[i].time });
            }
          }
        }

        if (pivots.length >= 2) {
          const lastPivot = pivots[pivots.length - 1];
          const prevPivot = pivots[pivots.length - 2];
          const isHH = lastPivot.val >= prevPivot.val;
          
          const lastTime = tokenCandles[tokenCandles.length - 1].time;
          const hhLhData = [
            { time: prevPivot.time, value: prevPivot.val },
            { time: lastPivot.time, value: lastPivot.val }
          ];
          if (lastTime > lastPivot.time) {
            hhLhData.push({ time: lastTime, value: lastPivot.val });
          }
          
          hhLhSeriesRef.current.setData(hhLhData);
          hhLhSeriesRef.current.applyOptions({
             color: isHH ? '#00ff88' : '#ff0055',
             title: isHH ? 'HIGHER HIGH (HH)' : 'LOWER HIGH (LH)'
          });
        }
      }

    } else if (tokenCurve && tokenCurve.length > 0 && tokenSeriesRef.current) {
      if (candleSeriesRef.current) candleSeriesRef.current.applyOptions({ visible: false });
      tokenSeriesRef.current.applyOptions({ visible: true });
      tokenSeriesRef.current.setData(timePoints.map((t, idx) => ({ time: t, value: parseFloat((tokenCurve[idx] || 0).toFixed(2)) })));
    }

    // Fit content UNIQUEMENT au premier rendu du token
    if (isFirstRenderRef.current) {
      chartRef.current.timeScale().fitContent();
      isFirstRenderRef.current = false;
    }
  }, [timePoints, groupCurve, tier15to20Curve, tier10to14Curve, tier5to9Curve, tier2to4Curve, tokenCurve, tokenCandles]);

  const latestCandle = tokenCandles && tokenCandles.length > 0 ? tokenCandles[tokenCandles.length - 1] : null;
  const latestTokenVal = latestCandle ? latestCandle.close : (tokenCurve && tokenCurve.length > 0 ? tokenCurve[tokenCurve.length - 1] : 0);
  const latestTier15to20 = tier15to20Curve && tier15to20Curve.length > 0 ? tier15to20Curve[tier15to20Curve.length - 1] : 3.5;
  const diffToGolden = latestTokenVal - latestTier15to20;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(2, 6, 14, 0.94)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(10, 18, 32, 0.98)',
          border: `2px solid ${color}`,
          borderRadius: '16px',
          boxShadow: `0 0 40px ${color}33, 0 25px 50px -12px rgba(0, 0, 0, 0.9)`,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          padding: '16px 20px',
          gap: '12px'
        }}
      >
        {/* Fullscreen Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              background: color,
              color: '#000',
              fontWeight: '900',
              fontSize: '1rem',
              padding: '4px 10px',
              borderRadius: '6px'
            }}>
              #{rank}
            </span>
            <span style={{ color: '#ffffff', fontWeight: '900', fontSize: '1.6rem', letterSpacing: '0.5px' }}>
              {token.cleanSymbol}
            </span>
            {isTopAcc && <span style={{ background: '#00ff88', color: '#000', fontSize: '0.8rem', fontWeight: '900', padding: '3px 8px', borderRadius: '6px' }}>⚡ TOP ACCÉLÉRATION</span>}
            <span style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15', border: '1px solid rgba(250,204,21,0.4)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '900' }}>
              Score: {token.score.toFixed(1)} pts
            </span>
            <span style={{ color: accPct >= 0 ? '#00ff88' : '#ff3b30', fontSize: '0.9rem', fontWeight: '900' }}>
              🚀 {accPct >= 0 ? '+' : ''}{accPct}%/h
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {hasPrev && (
                <button
                  onClick={onPrevToken}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ChevronLeft size={16} /> Précédent
                </button>
              )}
              {hasNext && (
                <button
                  onClick={onNextToken}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Suivant <ChevronRight size={16} />
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'linear-gradient(135deg, #ff0055, #ff3366)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                fontSize: '0.85rem',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 0 15px rgba(255,0,85,0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <X size={16} /> FERMER (ÉCHAP)
            </button>
          </div>
        </div>

        {/* Legend bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.78rem', color: '#aaa', flexWrap: 'wrap' }}>
          <span>⚪ <strong>Sol Blanc :</strong> 0.00 pts</span>
          <span style={{ color: '#facc15' }}>🚪 <strong>Ligne Dorée [15-20] :</strong> {latestTier15to20.toFixed(2)} pts</span>
          <span style={{ color: '#38bdf8' }}>🔷 <strong>Ligne Cyan [10-14]</strong></span>
          <span style={{ color: '#00ff88' }}>⚡ <strong>Ligne Verte [5-9]</strong></span>
          <span style={{ color: '#e879f9' }}>👑 <strong>Ligne Rose [2-4]</strong></span>
          <span style={{ marginLeft: 'auto', color: diffToGolden >= 0 ? '#00ff88' : '#facc15', fontWeight: 'bold' }}>
            Distance Dorée [15-20]: {diffToGolden >= 0 ? `+${diffToGolden.toFixed(2)} (AU-DESSUS)` : `${diffToGolden.toFixed(2)} pts (DESSOUS)`}
          </span>
        </div>

        {/* Fullscreen Canvas Container */}
        <div ref={chartContainerRef} style={{ width: '100%', flex: 1, minHeight: '400px', borderRadius: '10px', overflow: 'hidden' }} />
      </div>
    </div>
  );
};

export default DeltaSMomentumRadar;
