import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { BTC_WEEKLY_HISTORY } from './data/btcHistoricalData';
import { 
  calculateMACrossPro, 
  calculateADXPro, 
  calculateIchimokuPro, 
  calculateSTCPro, 
  calculateDonchianPro 
} from './logic/btcTrendIndicators';
import {
  calculateRSIPro,
  calculateMFIPro,
  calculateWaveTrendPro
} from './logic/btcMomentumIndicators';
import {
  calculateBPercentPro,
  calculateATRPercentPro,
  calculateTTMSqueezePro
} from './logic/btcVolatilityIndicators';
import {
  calculateCMFPro,
  calculatePVTPro,
  calculateVolumeProfilePro
} from './logic/btcVolumeIndicators';
import { 
  Trophy, TrendingUp, Zap, Waves, BarChart2, Link, 
  Settings, CheckCircle, RotateCcw, Eye, Sliders, ChevronRight, Activity, Flame, Cloud, RefreshCw, Radio,
  Vote, Check, X, ShieldAlert, Sparkles, ArrowUpRight, ArrowDownRight, DollarSign, Percent, Gauge, Minimize2, LineChart, Layers
} from 'lucide-react';

export default function BtcWeeklyConfluenceSection() {
  // 1. LES 4 FAMILLES MAJEURES (MACRO SUPPRIMÉ)
  const [activeFamily, setActiveFamily] = useState('trend');

  // 2. SOUS-NAVIGATION POUR CHAQUE FAMILLE
  const [activeTrendIndicator, setActiveTrendIndicator] = useState('macross');
  const [activeMomentumIndicator, setActiveMomentumIndicator] = useState('rsi');
  const [activeVolatilityIndicator, setActiveVolatilityIndicator] = useState('bpercent');
  const [activeVolumeIndicator, setActiveVolumeIndicator] = useState('cmf');

  // Données historiques complètes BTC + Dernière bougie LIVE Bybit
  const [weeklyCandles, setWeeklyCandles] = useState(() => BTC_WEEKLY_HISTORY || []);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());

  const fetchLiveLatestWeeklyCandle = useCallback(async () => {
    try {
      const res = await fetch('https://api.bybit.com/v5/market/kline?category=spot&symbol=BTCUSDT&interval=W&limit=200');
      const data = await res.json();
      if (data?.result?.list && data.result.list.length > 0) {
        const bybitList = data.result.list.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5])
        })).reverse();

        setWeeklyCandles(prev => {
          const baseHistory = prev && prev.length > 200 ? prev : BTC_WEEKLY_HISTORY;
          const merged = [...baseHistory];
          const timeMap = new Map();
          merged.forEach((c, idx) => timeMap.set(c.time, idx));

          bybitList.forEach(bc => {
            if (timeMap.has(bc.time)) {
              merged[timeMap.get(bc.time)] = bc;
            } else if (bc.time > merged[merged.length - 1].time) {
              merged.push(bc);
              timeMap.set(bc.time, merged.length - 1);
            }
          });
          return merged;
        });

        setIsLiveActive(true);
        setLastSyncTime(Date.now());
      }
    } catch (e) {
      console.warn('Fallback to full static BTC_WEEKLY_HISTORY:', e);
    }
  }, []);

  useEffect(() => {
    fetchLiveLatestWeeklyCandle();
    const interval = setInterval(fetchLiveLatestWeeklyCandle, 3600000);
    return () => clearInterval(interval);
  }, [fetchLiveLatestWeeklyCandle]);

  const latestCandle = weeklyCandles[weeklyCandles.length - 1] || { close: 0, open: 0, high: 0, low: 0, time: 0 };
  const currentPrice = latestCandle.close;

  // 1️⃣ PARAMÈTRES FAMILLE TREND (3 MOVING AVERAGES: MA 50, MA 100, MA 200 / EMA & SMA)
  const [maType, setMaType] = useState('EMA');
  const [showFastMA, setShowFastMA] = useState(true);
  const [fastLen, setFastLen] = useState(50);
  const [fastType, setFastType] = useState('EMA');

  const [showMedMA, setShowMedMA] = useState(true);
  const [medLen, setMedLen] = useState(100);
  const [medType, setMedType] = useState('SMA');

  const [showSlowMA, setShowSlowMA] = useState(true);
  const [slowLen, setSlowLen] = useState(200);
  const [slowType, setSlowType] = useState('SMA');

  const [useADXFilter, setUseADXFilter] = useState(false);
  const [adxMin, setAdxMin] = useState(20);
  const [showCloudFill, setShowCloudFill] = useState(true);
  const [showBgColor, setShowBgColor] = useState(true);
  const [showTrendLabel, setShowTrendLabel] = useState(true);
  const [showGcDcMarkers, setShowGcDcMarkers] = useState(true);
  const [showMaSettingsModal, setShowMaSettingsModal] = useState(false);

  const [diLen, setDiLen] = useState(14);
  const [adxSmoothLen, setAdxSmoothLen] = useState(14);
  const [adxTrendThreshold, setAdxTrendThreshold] = useState(25);
  const [showAdxHist, setShowAdxHist] = useState(true);
  const [showAdxBg, setShowAdxBg] = useState(true);
  const [showAdxSettingsModal, setShowAdxSettingsModal] = useState(false);

  const [convLen, setConvLen] = useState(9);
  const [baseLen, setBaseLen] = useState(26);
  const [spanBLen, setSpanBLen] = useState(52);
  const [disp, setDisp] = useState(26);
  const [showChikou, setShowChikou] = useState(true);
  const [showIchimokuBg, setShowIchimokuBg] = useState(true);
  const [showIchimokuFill, setShowIchimokuFill] = useState(true);
  const [showIchimokuSettingsModal, setShowIchimokuSettingsModal] = useState(false);

  const [stcFastLen, setStcFastLen] = useState(23);
  const [stcSlowLen, setStcSlowLen] = useState(50);
  const [stcCycleLen, setStcCycleLen] = useState(10);
  const [stcSmooth1, setStcSmooth1] = useState(3);
  const [stcSmooth2, setStcSmooth2] = useState(3);
  const [stcObLevel, setStcObLevel] = useState(75);
  const [stcOsLevel, setStcOsLevel] = useState(25);
  const [showStcBg, setShowStcBg] = useState(true);
  const [showStcSettingsModal, setShowStcSettingsModal] = useState(false);

  const [donchianLen, setDonchianLen] = useState(20);
  const [donchianUseBody, setDonchianUseBody] = useState(false);
  const [showDonchianMid, setShowDonchianMid] = useState(true);
  const [showDonchianFill, setShowDonchianFill] = useState(true);
  const [showDonchianBg, setShowDonchianBg] = useState(true);
  const [showDonchianSettingsModal, setShowDonchianSettingsModal] = useState(false);

  // 2️⃣ PARAMÈTRES FAMILLE MOMENTUM (3 INDICATEURS)
  const [rsiLen, setRsiLen] = useState(14);
  const [rsiObLevel, setRsiObLevel] = useState(70);
  const [rsiOsLevel, setRsiOsLevel] = useState(30);
  const [showRsiMA, setShowRsiMA] = useState(false);
  const [rsiMaLen, setRsiMaLen] = useState(14);
  const [showRsiDiv, setShowRsiDiv] = useState(true);
  const [rsiLbR, setRsiLbR] = useState(5);
  const [rsiLbL, setRsiLbL] = useState(5);
  const [showRsiBg, setShowRsiBg] = useState(true);
  const [showRsiSettingsModal, setShowRsiSettingsModal] = useState(false);

  const [mfiLen, setMfiLen] = useState(14);
  const [mfiObLevel, setMfiObLevel] = useState(80);
  const [mfiOsLevel, setMfiOsLevel] = useState(20);
  const [showMfiDiv, setShowMfiDiv] = useState(true);
  const [mfiLbR, setMfiLbR] = useState(5);
  const [mfiLbL, setMfiLbL] = useState(5);
  const [showMfiBg, setShowMfiBg] = useState(true);
  const [showMfiSettingsModal, setShowMfiSettingsModal] = useState(false);

  const [wtN1, setWtN1] = useState(10);
  const [wtN2, setWtN2] = useState(21);
  const [wtObLevel1, setWtObLevel1] = useState(60);
  const [wtObLevel2, setWtObLevel2] = useState(53);
  const [wtOsLevel1, setWtOsLevel1] = useState(-60);
  const [wtOsLevel2, setWtOsLevel2] = useState(-53);
  const [showWtSignals, setShowWtSignals] = useState(true);
  const [showWtCross, setShowWtCross] = useState(false);
  const [showWtBg, setShowWtBg] = useState(true);
  const [showWtSettingsModal, setShowWtSettingsModal] = useState(false);

  // 3️⃣ PARAMÈTRES FAMILLE VOLATILITY (3 INDICATEURS)
  const [bPercentLen, setBPercentLen] = useState(20);
  const [bPercentMult, setBPercentMult] = useState(2.0);
  const [bPercentWalkLen, setBPercentWalkLen] = useState(6);
  const [showBPercentBg, setShowBPercentBg] = useState(true);
  const [showBPercentShapes, setShowBPercentShapes] = useState(true);
  const [showBPercentSettingsModal, setShowBPercentSettingsModal] = useState(false);

  const [atrLen, setAtrLen] = useState(14);
  const [atrAvgLen, setAtrAvgLen] = useState(100);
  const [atrRankLen, setAtrRankLen] = useState(200);
  const [atrHiRank, setAtrHiRank] = useState(80);
  const [atrLoRank, setAtrLoRank] = useState(20);
  const [showAtrBg, setShowAtrBg] = useState(true);
  const [showAtrTable, setShowAtrTable] = useState(true);
  const [showAtrSettingsModal, setShowAtrSettingsModal] = useState(false);

  const [ttmBbLen, setTtmBbLen] = useState(20);
  const [ttmBbMult, setTtmBbMult] = useState(2.0);
  const [ttmKcLen, setTtmKcLen] = useState(20);
  const [ttmKcMult, setTtmKcMult] = useState(1.5);
  const [ttmUseTR, setTtmUseTR] = useState(true);
  const [ttmKcMultX, setTtmKcMultX] = useState(1.0);
  const [showTtmBg, setShowTtmBg] = useState(true);
  const [showTtmTable, setShowTtmTable] = useState(true);
  const [showTtmSettingsModal, setShowTtmSettingsModal] = useState(false);

  // 4️⃣ PARAMÈTRES FAMILLE VOLUME (3 INDICATEURS)
  const [cmfLen, setCmfLen] = useState(20);
  const [cmfStrong, setCmfStrong] = useState(0.2);
  const [showCmfMA, setShowCmfMA] = useState(false);
  const [cmfMaLen, setCmfMaLen] = useState(10);
  const [showCmfDiv, setShowCmfDiv] = useState(true);
  const [cmfLbR, setCmfLbR] = useState(5);
  const [cmfLbL, setCmfLbL] = useState(5);
  const [showCmfBg, setShowCmfBg] = useState(true);
  const [showCmfSettingsModal, setShowCmfSettingsModal] = useState(false);

  const [pvtSigLen, setPvtSigLen] = useState(21);
  const [showPvtSig, setShowPvtSig] = useState(true);
  const [pvtUseOsc, setPvtUseOsc] = useState(false);
  const [showPvtDiv, setShowPvtDiv] = useState(true);
  const [pvtLbR, setPvtLbR] = useState(5);
  const [pvtLbL, setPvtLbL] = useState(5);
  const [showPvtBg, setShowPvtBg] = useState(true);
  const [showPvtSettingsModal, setShowPvtSettingsModal] = useState(false);

  const [vpLookback, setVpLookback] = useState(200);
  const [vpRows, setVpRows] = useState(24);
  const [vpVaPercent, setVpVaPercent] = useState(70);
  const [vpProfileWidth, setVpProfileWidth] = useState(30);
  const [showVpSettingsModal, setShowVpSettingsModal] = useState(false);

  const [isLogScale, setIsLogScale] = useState(true);

  // Références Graphiques
  const chartContainerRef = useRef(null);
  const canvasOverlayRef = useRef(null);
  const oscCanvasOverlayRef = useRef(null);
  const redrawRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const mainOverlaySeriesRef = useRef([]);

  const oscChartContainerRef = useRef(null);
  const oscChartRef = useRef(null);

  // Calculs des Indicateurs
  const maCrossPro = useMemo(() => calculateMACrossPro(weeklyCandles, { 
    maType, 
    fastLen, 
    medLen, 
    slowLen, 
    fastType, 
    medType, 
    slowType, 
    showFastMA,
    showMedMA,
    showSlowMA,
    useADX: useADXFilter, 
    adxMin 
  }), [weeklyCandles, maType, fastLen, medLen, slowLen, fastType, medType, slowType, showFastMA, showMedMA, showSlowMA, useADXFilter, adxMin]);
  const adxProData = useMemo(() => calculateADXPro(weeklyCandles, { diLen, adxLen: adxSmoothLen, adxMin: adxTrendThreshold, showHist: showAdxHist, showBG: showAdxBg }), [weeklyCandles, diLen, adxSmoothLen, adxTrendThreshold, showAdxHist, showAdxBg]);
  const ichimokuProData = useMemo(() => calculateIchimokuPro(weeklyCandles, { convLen, baseLen, spanBLen, disp, showChikou, showBG: showIchimokuBg, showFill: showIchimokuFill }), [weeklyCandles, convLen, baseLen, spanBLen, disp, showChikou, showIchimokuBg, showIchimokuFill]);
  const stcProData = useMemo(() => calculateSTCPro(weeklyCandles, { fastLen: stcFastLen, slowLen: stcSlowLen, cycleLen: stcCycleLen, smooth1: stcSmooth1, smooth2: stcSmooth2, obLevel: stcObLevel, osLevel: stcOsLevel }), [weeklyCandles, stcFastLen, stcSlowLen, stcCycleLen, stcSmooth1, stcSmooth2, stcObLevel, stcOsLevel]);
  const donchianProData = useMemo(() => calculateDonchianPro(weeklyCandles, { length: donchianLen, useBody: donchianUseBody, showMid: showDonchianMid, showFill: showDonchianFill, showBG: showDonchianBg }), [weeklyCandles, donchianLen, donchianUseBody, showDonchianMid, showDonchianFill, showDonchianBg]);

  const rsiProData = useMemo(() => calculateRSIPro(weeklyCandles, { len: rsiLen, obLevel: rsiObLevel, osLevel: rsiOsLevel, showMA: showRsiMA, maLen: rsiMaLen, showDiv: showRsiDiv, lbR: rsiLbR, lbL: rsiLbL, showBG: showRsiBg }), [weeklyCandles, rsiLen, rsiObLevel, rsiOsLevel, showRsiMA, rsiMaLen, showRsiDiv, rsiLbR, rsiLbL, showRsiBg]);
  const mfiProData = useMemo(() => calculateMFIPro(weeklyCandles, { len: mfiLen, obLevel: mfiObLevel, osLevel: mfiOsLevel, showDiv: showMfiDiv, lbR: mfiLbR, lbL: mfiLbL, showBG: showMfiBg }), [weeklyCandles, mfiLen, mfiObLevel, mfiOsLevel, showMfiDiv, mfiLbR, mfiLbL, showMfiBg]);
  const waveTrendProData = useMemo(() => calculateWaveTrendPro(weeklyCandles, { n1: wtN1, n2: wtN2, obLevel1: wtObLevel1, obLevel2: wtObLevel2, osLevel1: wtOsLevel1, osLevel2: wtOsLevel2, showWtSignals, showWtCross, showWtBg }), [weeklyCandles, wtN1, wtN2, wtObLevel1, wtObLevel2, wtOsLevel1, wtOsLevel2, showWtSignals, showWtCross, showWtBg]);

  const bPercentProData = useMemo(() => calculateBPercentPro(weeklyCandles, { len: bPercentLen, mult: bPercentMult, walkLen: bPercentWalkLen, showBG: showBPercentBg, showShapes: showBPercentShapes }), [weeklyCandles, bPercentLen, bPercentMult, bPercentWalkLen, showBPercentBg, showBPercentShapes]);
  const atrPercentProData = useMemo(() => calculateATRPercentPro(weeklyCandles, { len: atrLen, avgLen: atrAvgLen, rankLen: atrRankLen, hiRank: atrHiRank, loRank: atrLoRank, showBG: showAtrBg, showTable: showAtrTable }), [weeklyCandles, atrLen, atrAvgLen, atrRankLen, atrHiRank, atrLoRank, showAtrBg, showAtrTable]);
  const ttmSqueezeProData = useMemo(() => calculateTTMSqueezePro(weeklyCandles, { bbLength: ttmBbLen, bbMult: ttmBbMult, kcLength: ttmKcLen, kcMult: ttmKcMult, useTrueRange: ttmUseTR, kcMultX: ttmKcMultX, showBG: showTtmBg, showTable: showTtmTable }), [weeklyCandles, ttmBbLen, ttmBbMult, ttmKcLen, ttmKcMult, ttmUseTR, ttmKcMultX, showTtmBg, showTtmTable]);

  const cmfProData = useMemo(() => calculateCMFPro(weeklyCandles, { len: cmfLen, strong: cmfStrong, showMA: showCmfMA, maLen: cmfMaLen, showDiv: showCmfDiv, lbR: cmfLbR, lbL: cmfLbL, showBG: showCmfBg }), [weeklyCandles, cmfLen, cmfStrong, showCmfMA, cmfMaLen, showCmfDiv, cmfLbR, cmfLbL, showCmfBg]);
  const pvtProData = useMemo(() => calculatePVTPro(weeklyCandles, { sigLen: pvtSigLen, showSig: showPvtSig, useOsc: pvtUseOsc, showDiv: showPvtDiv, lbR: pvtLbR, lbL: pvtLbL, showBG: showPvtBg }), [weeklyCandles, pvtSigLen, showPvtSig, pvtUseOsc, showPvtDiv, pvtLbR, pvtLbL, showPvtBg]);
  const volumeProfileProData = useMemo(() => calculateVolumeProfilePro(weeklyCandles, { lookback: vpLookback, rows: vpRows, vaPercent: vpVaPercent, profileWidth: vpProfileWidth }), [weeklyCandles, vpLookback, vpRows, vpVaPercent, vpProfileWidth]);

  // 🗳️ TABLEAUX DE VOTE DES 4 FAMILLES
  const trendVotingMatrix = useMemo(() => {
    const votes = [];
    const isMaBull = maCrossPro?.trendDir === 1;
    votes.push({ 
      id: 'macross', 
      name: '1. MA Cross PRO (3 MAs)', 
      params: `${fastType}(${fastLen}) / ${medType}(${medLen}) / ${slowType}(${slowLen})`, 
      currentValue: `$${maCrossPro?.fastMA?.[maCrossPro.fastMA.length-1]?.value?.toLocaleString() || 0}`, 
      condition: 'Fast MA > Slow MA', 
      isBull: isMaBull, 
      statusLabel: isMaBull ? 'BULL TREND (Zone Dorée)' : 'BEAR TREND' 
    });
    const isAdxBull = (adxProData?.curDiff || 0) > 0;
    votes.push({ id: 'adx', name: '2. ADX PRO', params: `DI(${diLen}) Thr(${adxTrendThreshold})`, currentValue: `ADX: ${adxProData?.curADX}`, condition: '+DI &gt; -DI', isBull: isAdxBull, statusLabel: isAdxBull ? 'BULL TREND' : 'BEAR TREND' });
    const isIchiBull = ichimokuProData?.isAboveCloud;
    votes.push({ id: 'ichimoku', name: '3. Ichimoku PRO', params: `${convLen}/${baseLen}/${spanBLen}`, currentValue: `$${currentPrice.toLocaleString()}`, condition: 'Prix &gt; Nuage Kumo', isBull: isIchiBull, statusLabel: isIchiBull ? 'BULL TREND' : 'BEAR TREND' });
    const isStcBull = (stcProData?.curSTC || 50) >= 50;
    votes.push({ id: 'stc', name: '4. STC PRO', params: `${stcFastLen}/${stcSlowLen}/${stcCycleLen}`, currentValue: `STC: ${stcProData?.curSTC}`, condition: 'STC &gt;= 50', isBull: isStcBull, statusLabel: isStcBull ? 'BULL TREND' : 'BEAR TREND' });
    const isDonchianBull = currentPrice >= (donchianProData?.curMid || 0);
    votes.push({ id: 'donchian', name: '5. Donchian PRO', params: `Canal (${donchianLen})`, currentValue: `Mid: $${donchianProData?.curMid?.toLocaleString() || 0}`, condition: 'Prix &gt; Milieu', isBull: isDonchianBull, statusLabel: isDonchianBull ? 'BULL TREND' : 'BEAR TREND' });

    const bullCount = votes.filter(v => v.isBull).length;
    const bearCount = votes.filter(v => !v.isBull).length;
    const bullPercentage = Math.round((bullCount / votes.length) * 100);
    return { votes, bullCount, bearCount, bullPercentage, verdict: bullPercentage >= 60 ? '🔥 STRONG BULLISH TREND' : '🚨 BEARISH TREND' };
  }, [maCrossPro, adxProData, ichimokuProData, stcProData, donchianProData, currentPrice, maType, fastLen, medLen, slowLen, fastType, medType, slowType, diLen, adxTrendThreshold, convLen, baseLen, spanBLen, stcFastLen, stcSlowLen, stcCycleLen, donchianLen]);

  const momentumVotingMatrix = useMemo(() => {
    const votes = [];
    const isRsiBull = (rsiProData?.curRSI || 50) >= 50;
    votes.push({ id: 'rsi', name: '1. RSI PRO', params: `RSI(${rsiLen})`, currentValue: `RSI: ${rsiProData?.curRSI}`, condition: 'RSI &gt;= 50', isBull: isRsiBull, statusLabel: isRsiBull ? 'BULL MOMENTUM' : 'BEAR MOMENTUM' });
    const isMfiBull = (mfiProData?.curMFI || 50) >= 50;
    votes.push({ id: 'mfi', name: '2. MFI PRO', params: `MFI(${mfiLen})`, currentValue: `MFI: ${mfiProData?.curMFI}`, condition: 'MFI &gt;= 50', isBull: isMfiBull, statusLabel: isMfiBull ? 'BULL MOMENTUM' : 'BEAR MOMENTUM' });
    const isWtBull = (waveTrendProData?.curWT1 || 0) >= (waveTrendProData?.curWT2 || 0);
    votes.push({ id: 'wavetrend', name: '3. WaveTrend PRO', params: `${wtN1}/${wtN2}`, currentValue: `WT1: ${waveTrendProData?.curWT1} | WT2: ${waveTrendProData?.curWT2}`, condition: 'WT1 &gt;= WT2', isBull: isWtBull, statusLabel: isWtBull ? 'BULL MOMENTUM' : 'BEAR MOMENTUM' });

    const bullCount = votes.filter(v => v.isBull).length;
    const bearCount = votes.filter(v => !v.isBull).length;
    const bullPercentage = Math.round((bullCount / votes.length) * 100);
    return { votes, bullCount, bearCount, bullPercentage, verdict: bullPercentage >= 60 ? '🔥 STRONG POSITIVE MOMENTUM' : '🚨 NEGATIVE MOMENTUM' };
  }, [rsiProData, rsiLen, mfiProData, mfiLen, waveTrendProData, wtN1, wtN2]);

  const volatilityVotingMatrix = useMemo(() => {
    const votes = [];
    const isBBull = (bPercentProData?.curBPercent || 0.5) >= 0.5;
    votes.push({ id: 'bpercent', name: '1. %B PRO', params: `BB(${bPercentLen}, ${bPercentMult})`, currentValue: `%B: ${bPercentProData?.curBPercent}`, condition: '%B &gt;= 0.5', isBull: isBBull, statusLabel: isBBull ? 'BULL VOLATILITY' : 'BEAR VOLATILITY' });
    const isAtrHealthy = (atrPercentProData?.curRank || 25) <= 80;
    votes.push({ id: 'atrpct', name: '2. ATR% PRO', params: `ATR(${atrLen}) Rank(${atrRankLen})`, currentValue: `ATR%: ${atrPercentProData?.curATRPct}% (Rank: ${atrPercentProData?.curRank}%)`, condition: 'Rank &lt;= 80%', isBull: isAtrHealthy, statusLabel: isAtrHealthy ? 'VOLATILITÉ SAINE' : 'SURCHAUFFE' });
    const isTtmBull = (ttmSqueezeProData?.curVal || 0) >= 0;
    votes.push({ id: 'ttm', name: '3. TTM Squeeze PRO', params: `BB(${ttmBbLen}) KC(${ttmKcLen})`, currentValue: `Val: ${ttmSqueezeProData?.curVal} (${ttmSqueezeProData?.sqzStatus})`, condition: 'Momentum &gt;= 0', isBull: isTtmBull, statusLabel: isTtmBull ? 'BULL MOMENTUM' : 'BEAR MOMENTUM' });

    const bullCount = votes.filter(v => v.isBull).length;
    const bearCount = votes.filter(v => !v.isBull).length;
    const bullPercentage = Math.round((bullCount / votes.length) * 100);
    return { votes, bullCount, bearCount, bullPercentage, verdict: bullPercentage >= 60 ? '🔥 HEALTHY BULLISH VOLATILITY' : '🚨 COMPRESSED / BEARISH' };
  }, [bPercentProData, bPercentLen, bPercentMult, atrPercentProData, atrLen, atrRankLen, ttmSqueezeProData, ttmBbLen, ttmKcLen]);

  const volumeVotingMatrix = useMemo(() => {
    const votes = [];
    const curCMF = cmfProData?.curCMF || 0.10;
    const isCmfBull = curCMF > 0;
    votes.push({ id: 'cmf', name: '1. CMF PRO', params: `CMF(${cmfLen})`, currentValue: `CMF: ${curCMF}`, condition: 'CMF &gt; 0', isBull: isCmfBull, statusLabel: isCmfBull ? 'BULL FLOW' : 'BEAR FLOW' });
    const isPvtBull = pvtProData?.isBull;
    votes.push({ id: 'pvt', name: '2. PVT PRO', params: `EMA(${pvtSigLen})`, currentValue: `PVT: ${pvtProData?.curPVT?.toLocaleString()}`, condition: 'PVT &gt;= Signal', isBull: isPvtBull, statusLabel: isPvtBull ? 'BULL ACCUMULATION' : 'BEAR DISTRIBUTION' });
    const isAbovePOC = volumeProfileProData?.isAbovePOC;
    votes.push({ id: 'vp', name: '3. Volume Profile', params: `Lookback(${vpLookback})`, currentValue: `POC: $${volumeProfileProData?.pocPrice?.toLocaleString()}`, condition: 'Prix &gt;= POC', isBull: isAbovePOC, statusLabel: isAbovePOC ? 'BULL STRUCTURE' : 'BEAR STRUCTURE' });

    const bullCount = votes.filter(v => v.isBull).length;
    const bearCount = votes.filter(v => !v.isBull).length;
    const bullPercentage = Math.round((bullCount / votes.length) * 100);
    return { votes, bullCount, bearCount, bullPercentage, verdict: bullPercentage >= 60 ? '🔥 STRONG ACCUMULATION & VALUE STRUCTURE' : '🚨 DISTRIBUTION' };
  }, [cmfProData, cmfLen, pvtProData, pvtSigLen, volumeProfileProData, vpLookback]);

  // Oscillator Canvas Overlay Redraw
  const redrawOscCanvasOverlay = useCallback(() => {
    if (!activeFamily) return;
    const isTrendOsc = activeFamily === 'trend' && (activeTrendIndicator === 'adx' || activeTrendIndicator === 'stc');
    const isOscActive = isTrendOsc || activeFamily === 'momentum' || activeFamily === 'volatility' || (activeFamily === 'volume' && (activeVolumeIndicator === 'cmf' || activeVolumeIndicator === 'pvt'));
    if (!isOscActive) return;

    const chart = oscChartRef.current;
    if (!chart) return;
    const timeScale = chart.timeScale();
    const container = oscChartContainerRef.current;
    const canvas = oscCanvasOverlayRef.current;
    if (!canvas || !container) return;

    const lw = chart.options().timeScale?.barSpacing || 6;
    const candleW = Math.max(1, Math.floor(lw * 0.8));

    if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight || 180;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (activeFamily === 'trend' && activeTrendIndicator === 'stc' && showStcBg && stcProData) {
        const signals = [...(stcProData.bullSignals || []), ...(stcProData.bearSignals || [])].sort((a,b) => a.time - b.time);
        let sigIdx = 0;
        let currentState = null;
        const stcSeries = stcProData.stcSeries || [];

        // Fill background zones
        stcSeries.forEach(stcPoint => {
           while (sigIdx < signals.length && signals[sigIdx].time <= stcPoint.time) {
               currentState = signals[sigIdx].type;
               sigIdx++;
           }
           if (currentState) {
               const x = timeScale.timeToCoordinate(stcPoint.time);
               if (x !== null) {
                   ctx.fillStyle = currentState === 'bull' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)';
                   ctx.fillRect(x - candleW / 2, 0, candleW, height);
               }
           }
        });

    // Draw solid thin vertical lines at the exact signals
        signals.forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath();
               ctx.moveTo(x, 0);
               ctx.lineTo(x, height);
               ctx.lineWidth = 1;
               ctx.strokeStyle = sig.type === 'bull' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
               ctx.stroke();
           }
        });
    }


        
    // RSI PRO Divergence Backgrounds
    if (activeFamily === 'momentum' && activeMomentumIndicator === 'rsi' && showRsiBg && rsiProData) {
        (rsiProData.bullDivs || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'; ctx.stroke();
           }
        });
        (rsiProData.bearDivs || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.stroke();
           }
        });
    }
    
    // MFI PRO Divergence Backgrounds
    if (activeFamily === 'momentum' && activeMomentumIndicator === 'mfi' && showMfiBg && mfiProData) {
        (mfiProData.bullDivs || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'; ctx.stroke();
           }
        });
        (mfiProData.bearDivs || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.stroke();
           }
        });
    }

    // %B PRO Walk Backgrounds
    if (activeFamily === 'volatility' && activeVolatilityIndicator === 'bpercent' && bPercentProData) {
        (bPercentProData.bearWalkSignals || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.stroke();
           }
        });
        (bPercentProData.bullWalkSignals || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'; ctx.stroke();
           }
        });
    }

  }, [activeFamily, activeTrendIndicator, activeVolumeIndicator, showStcBg, stcProData]);

  // Master Canvas Overlay Redraw
  const redrawMasterCanvasOverlay = useCallback(() => {
    try {
      const canvas = canvasOverlayRef.current;
      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      if (!canvas || !chart || !candleSeries || !weeklyCandles || weeklyCandles.length === 0) return;

      const container = chartContainerRef.current;
      if (container) {
        if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight || 540;
        }
      }

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const timeScale = chart.timeScale();

      // 1️⃣ Trend MA Cloud Fill (entre les 2 MAs actives sélectionnées)
      const cloudFast = maCrossPro?.cloudFast || (showFastMA && showSlowMA ? maCrossPro?.fastMA : null);
      const cloudSlow = maCrossPro?.cloudSlow || (showFastMA && showSlowMA ? maCrossPro?.slowMA : null);
      if (activeFamily === 'trend' && activeTrendIndicator === 'macross' && showCloudFill && cloudFast && cloudSlow) {
        const fastMap = new Map();
        cloudFast.forEach(f => fastMap.set(f.time, f.value));
        const slowMap = new Map();
        cloudSlow.forEach(s => slowMap.set(s.time, s.value));

        const validPoints = [];
        weeklyCandles.forEach(c => {
          const fVal = fastMap.get(c.time);
          const sVal = slowMap.get(c.time);
          if (fVal !== undefined && sVal !== undefined) {
            const x = timeScale.timeToCoordinate(c.time);
            const yFast = candleSeries.priceToCoordinate(fVal);
            const ySlow = candleSeries.priceToCoordinate(sVal);
            if (x !== null && yFast !== null && ySlow !== null && x >= -30 && x <= width + 30) {
              validPoints.push({ x, yFast, ySlow, isBull: fVal >= sVal });
            }
          }
        });

        for (let i = 0; i < validPoints.length - 1; i++) {
          const p1 = validPoints[i];
          const p2 = validPoints[i + 1];
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.yFast);
          ctx.lineTo(p2.x, p2.yFast);
          ctx.lineTo(p2.x, p2.ySlow);
          ctx.lineTo(p1.x, p1.ySlow);
          ctx.closePath();
          ctx.fillStyle = p1.isBull ? 'rgba(0, 255, 136, 0.22)' : 'rgba(239, 68, 68, 0.22)';
          ctx.fill();
          ctx.restore();
        }
      }

      // 🌟 Golden Cross Point Dahbiya (*) & Death Cross sur le Croisement Exact
      if (activeFamily === 'trend' && activeTrendIndicator === 'macross' && showGcDcMarkers) {
        // 1. Golden Cross (Point Dahbiya *)
        if (maCrossPro?.goldenCrosses?.length > 0) {
          maCrossPro.goldenCrosses.forEach(gc => {
            const x = timeScale.timeToCoordinate(gc.time);
            const y = candleSeries.priceToCoordinate(gc.price);
            if (x !== null && y !== null && x >= -40 && x <= width + 40) {
              ctx.save();
              // A. Halo lumineux doré
              const gradient = ctx.createRadialGradient(x, y, 1, x, y, 18);
              gradient.addColorStop(0, 'rgba(255, 215, 0, 0.95)');
              gradient.addColorStop(0.4, 'rgba(250, 204, 21, 0.4)');
              gradient.addColorStop(0.8, 'rgba(234, 179, 8, 0.12)');
              gradient.addColorStop(1, 'rgba(250, 204, 21, 0)');
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(x, y, 18, 0, Math.PI * 2);
              ctx.fill();

              // B. Point Dahbiya (Cercle Doré étincelant)
              ctx.beginPath();
              ctx.arc(x, y, 7, 0, Math.PI * 2);
              ctx.fillStyle = '#ffd700'; // Or pur
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#ffffff';
              ctx.stroke();

              // C. Symbole de l'étoile / Point d'or (*)
              ctx.fillStyle = '#060c18';
              ctx.font = '900 10px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('★', x, y);

              // D. Micro-pill élégant et compact "★ GOLDEN CROSS"
              const badgeText = '★ GOLDEN CROSS';
              ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              const textW = ctx.measureText(badgeText).width;
              const pillW = textW + 10;
              const pillH = 16;
              const pillY = y - 24;
              const pillX = x - pillW / 2;

              ctx.fillStyle = 'rgba(6, 12, 24, 0.88)';
              ctx.strokeStyle = '#ffd700';
              ctx.lineWidth = 1;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(pillX, pillY, pillW, pillH, 4);
              } else {
                ctx.rect(pillX, pillY, pillW, pillH);
              }
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#ffd700';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(badgeText, x, pillY + pillH / 2);

              ctx.restore();
            }
          });
        }

        // 2. Death Cross
        if (maCrossPro?.deathCrosses?.length > 0) {
          maCrossPro.deathCrosses.forEach(dc => {
            const x = timeScale.timeToCoordinate(dc.time);
            const y = candleSeries.priceToCoordinate(dc.price);
            if (x !== null && y !== null && x >= -40 && x <= width + 40) {
              ctx.save();
              // A. Halo lumineux rouge
              const gradient = ctx.createRadialGradient(x, y, 1, x, y, 18);
              gradient.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
              gradient.addColorStop(0.4, 'rgba(239, 68, 68, 0.4)');
              gradient.addColorStop(0.8, 'rgba(239, 68, 68, 0.12)');
              gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(x, y, 18, 0, Math.PI * 2);
              ctx.fill();

              // B. Cercle rouge
              ctx.beginPath();
              ctx.arc(x, y, 7, 0, Math.PI * 2);
              ctx.fillStyle = '#ef4444';
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#ffffff';
              ctx.stroke();

              // C. Symbole ✕
              ctx.fillStyle = '#ffffff';
              ctx.font = '900 9px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('✕', x, y);

              // D. Micro-pill élégant "DEATH CROSS"
              const badgeText = 'DEATH CROSS';
              ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              const textW = ctx.measureText(badgeText).width;
              const pillW = textW + 10;
              const pillH = 16;
              const pillY = y - 24;
              const pillX = x - pillW / 2;

              ctx.fillStyle = 'rgba(6, 12, 24, 0.88)';
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(pillX, pillY, pillW, pillH, 4);
              } else {
                ctx.rect(pillX, pillY, pillW, pillH);
              }
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#ef4444';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(badgeText, x, pillY + pillH / 2);

              ctx.restore();
            }
          });
        }
      }

      // 2️⃣ Trend Ichimoku Kumo Cloud Fill
      if (activeFamily === 'trend' && activeTrendIndicator === 'stc' && showStcBg && stcProData) {
        const signals = [...(stcProData.bullSignals || []), ...(stcProData.bearSignals || [])].sort((a,b) => a.time - b.time);
        let sigIdx = 0;
        let currentState = null;
        const stcSeries = stcProData.stcSeries || [];

        // Fill background zones
        stcSeries.forEach(stcPoint => {
           while (sigIdx < signals.length && signals[sigIdx].time <= stcPoint.time) {
               currentState = signals[sigIdx].type;
               sigIdx++;
           }
           if (currentState) {
               const x = timeScale.timeToCoordinate(stcPoint.time);
               if (x !== null) {
                   ctx.fillStyle = currentState === 'bull' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)';
                   ctx.fillRect(x - candleW / 2, 0, candleW, height);
               }
           }
        });

    // Draw solid thin vertical lines at the exact signals
        signals.forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath();
               ctx.moveTo(x, 0);
               ctx.lineTo(x, height);
               ctx.lineWidth = 1;
               ctx.strokeStyle = sig.type === 'bull' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
               ctx.stroke();
           }
        });
      }

      if (activeFamily === 'trend' && activeTrendIndicator === 'ichimoku' && showIchimokuFill && ichimokuProData?.spanA && ichimokuProData?.spanB) {
        const aMap = new Map();
        ichimokuProData.spanA.forEach(a => aMap.set(a.time, a.value));
        const bMap = new Map();
        ichimokuProData.spanB.forEach(b => bMap.set(b.time, b.value));

        const validPoints = [];
        weeklyCandles.forEach(c => {
          const aVal = aMap.get(c.time);
          const bVal = bMap.get(c.time);
          if (aVal !== undefined && bVal !== undefined) {
            const x = timeScale.timeToCoordinate(c.time);
            const yA = candleSeries.priceToCoordinate(aVal);
            const yB = candleSeries.priceToCoordinate(bVal);
            if (x !== null && yA !== null && yB !== null && x >= -30 && x <= width + 30) {
              validPoints.push({ x, yA, yB, isBull: aVal >= bVal });
            }
          }
        });

        for (let i = 0; i < validPoints.length - 1; i++) {
          const p1 = validPoints[i];
          const p2 = validPoints[i + 1];
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.yA);
          ctx.lineTo(p2.x, p2.yA);
          ctx.lineTo(p2.x, p2.yB);
          ctx.lineTo(p1.x, p1.yB);
          ctx.closePath();
          ctx.fillStyle = p1.isBull ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)';
          ctx.fill();
          ctx.restore();
        }
      }

      // 2.5️⃣ Trend Ichimoku Background Color (above/below cloud)
      if (activeFamily === 'trend' && activeTrendIndicator === 'ichimoku' && showIchimokuBg && ichimokuProData?.rawSpanA && ichimokuProData?.rawSpanB) {
        const topMap = new Map();
        const botMap = new Map();
        const bMap = new Map();
        
        ichimokuProData.rawSpanB.forEach(b => bMap.set(b.time, b.value));
        ichimokuProData.rawSpanA.forEach(a => {
          const bVal = bMap.get(a.time);
          if (bVal !== undefined) {
            topMap.set(a.time, Math.max(a.value, bVal));
            botMap.set(a.time, Math.min(a.value, bVal));
          }
        });

        weeklyCandles.forEach((c, idx) => {
          const top = topMap.get(c.time);
          const bot = botMap.get(c.time);
          if (top !== undefined && bot !== undefined) {
            const above = c.close > top;
            const below = c.close < bot;
            if (above || below) {
              const x = timeScale.timeToCoordinate(c.time);
              if (x !== null && x >= -30 && x <= width + 30) {
                // approximate width of 1 candle on screen
                let nextX = x + 10;
                if (idx < weeklyCandles.length - 1) {
                  const nX = timeScale.timeToCoordinate(weeklyCandles[idx + 1].time);
                  if (nX !== null) nextX = nX;
                }
                const candleW = Math.max(2, nextX - x);
                ctx.save();
                ctx.fillStyle = above ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)';
                ctx.fillRect(x - candleW / 2, 0, candleW, height);
                ctx.restore();
              }
            }
          }
        });
      }

      // 3️⃣ Trend Donchian Channel Fill
      if (activeFamily === 'trend' && activeTrendIndicator === 'donchian' && showDonchianFill && donchianProData?.upper && donchianProData?.lower) {
        const uMap = new Map();
        donchianProData.upper.forEach(u => uMap.set(u.time, u.value));
        const lMap = new Map();
        donchianProData.lower.forEach(l => lMap.set(l.time, l.value));

        const validPoints = [];
        weeklyCandles.forEach(c => {
          const uVal = uMap.get(c.time);
          const lVal = lMap.get(c.time);
          if (uVal !== undefined && lVal !== undefined) {
            const x = timeScale.timeToCoordinate(c.time);
            const yU = candleSeries.priceToCoordinate(uVal);
            const yL = candleSeries.priceToCoordinate(lVal);
            if (x !== null && yU !== null && yL !== null && x >= -30 && x <= width + 30) {
              validPoints.push({ x, yU, yL });
            }
          }
        });

        for (let i = 0; i < validPoints.length - 1; i++) {
          const p1 = validPoints[i];
          const p2 = validPoints[i + 1];
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.yU);
          ctx.lineTo(p2.x, p2.yU);
          ctx.lineTo(p2.x, p2.yL);
          ctx.lineTo(p1.x, p1.yL);
          ctx.closePath();
          ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
          ctx.fill();
          ctx.restore();
        }
      }

        
    // RSI PRO Divergence Backgrounds
    if (activeFamily === 'momentum' && activeMomentumIndicator === 'rsi' && showRsiBg && rsiProData) {
        (rsiProData.bullDivs || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'; ctx.stroke();
           }
        });
        (rsiProData.bearDivs || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.stroke();
           }
        });
    }
    
    // MFI PRO Divergence Backgrounds
    if (activeFamily === 'momentum' && activeMomentumIndicator === 'mfi' && showMfiBg && mfiProData) {
        (mfiProData.bullDivs || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'; ctx.stroke();
           }
        });
        (mfiProData.bearDivs || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.stroke();
           }
        });
    }
    // %B PRO Walk Backgrounds
    if (activeFamily === 'volatility' && activeVolatilityIndicator === 'bpercent' && bPercentProData) {
        (bPercentProData.bearWalkSignals || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.stroke();
           }
        });
        (bPercentProData.bullWalkSignals || []).forEach(sig => {
           const x = timeScale.timeToCoordinate(sig.time);
           if (x !== null) {
               ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'; ctx.stroke();
           }
        });
    }


      // 4️⃣ VOLUME PROFILE RENDERING
      if (activeFamily === 'volume' && activeVolumeIndicator === 'vp' && volumeProfileProData?.bins?.length > 0) {
        const vp = volumeProfileProData;
        const maxBarWidthPx = Math.min(260, width * 0.28);
        const rightEdgeX = width - 15;

        vp.bins.forEach(bin => {
          const yTop = candleSeries.priceToCoordinate(bin.binHigh);
          const yBottom = candleSeries.priceToCoordinate(bin.binLow);
          if (yTop !== null && yBottom !== null) {
            const binHeight = Math.max(2, Math.abs(yBottom - yTop) - 1);
            const binY = Math.min(yTop, yBottom);
            const barW = Math.max(4, bin.ratio * maxBarWidthPx);
            const barX = rightEdgeX - barW;

            ctx.save();
            ctx.fillStyle = bin.color;
            ctx.fillRect(barX, binY, barW, binHeight);
            ctx.strokeStyle = bin.isPOC ? '#ef4444' : bin.inVA ? 'rgba(59, 130, 246, 0.8)' : 'rgba(13, 148, 136, 0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, binY, barW, binHeight);
            ctx.restore();
          }
        });

        const pocY = candleSeries.priceToCoordinate(vp.pocPrice);
        const startX = timeScale.timeToCoordinate(vp.startCandleTime);
        if (pocY !== null) {
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(startX !== null ? Math.max(0, startX) : 0, pocY);
          ctx.lineTo(width, pocY);
          ctx.stroke();

          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.rect(width - 120, pocY - 10, 110, 20);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`POC $${vp.pocPrice.toLocaleString()}`, width - 65, pocY + 4);
          ctx.restore();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeFamily, activeTrendIndicator, activeVolumeIndicator, showCloudFill, showGcDcMarkers, showIchimokuFill, showDonchianFill, maCrossPro, ichimokuProData, donchianProData, volumeProfileProData, weeklyCandles]);

  useEffect(() => {
    redrawRef.current = redrawMasterCanvasOverlay;
    if (canvasOverlayRef.current) requestAnimationFrame(redrawMasterCanvasOverlay);
  }, [redrawMasterCanvasOverlay]);

  // Initialisation du Grand Graphique
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch (_) {}
      chartRef.current = null;
      mainOverlaySeriesRef.current = [];
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 540,
      layout: { background: { color: 'rgba(4, 8, 16, 0.98)' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)', autoScale: true, mode: isLogScale ? 1 : 0, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, secondsVisible: false, rightOffset: 12 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff88', downColor: '#ef4444', borderUpColor: '#00ff88', borderDownColor: '#ef4444',
      wickUpColor: '#00ff88', wickDownColor: '#ef4444', priceLineVisible: true, lastValueVisible: true
    });
    candleSeries.setData(weeklyCandles);
    candleSeriesRef.current = candleSeries;
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const triggerRedraw = () => { if (redrawRef.current) requestAnimationFrame(redrawRef.current); };
    chart.timeScale().subscribeVisibleLogicalRangeChange(triggerRedraw);
    chart.timeScale().subscribeVisibleTimeRangeChange(triggerRedraw);

    const handleResize = () => {
      if (container && chartRef.current && canvasOverlayRef.current) {
        chartRef.current.applyOptions({ width: container.clientWidth });
        canvasOverlayRef.current.width = container.clientWidth;
        canvasOverlayRef.current.height = 540;
        triggerRedraw();
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
  }, [weeklyCandles, isLogScale]);

  // Synchronisation dynamique des séries sur le Grand Graphique (MA Cross, Ichimoku, Donchian, Bollinger)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (mainOverlaySeriesRef.current.length > 0) {
      mainOverlaySeriesRef.current.forEach(s => {
        try { chart.removeSeries(s); } catch (_) {}
      });
      mainOverlaySeriesRef.current = [];
    }

    // 1️⃣ MA Cross PRO (3 Moving Averages: Fast, Med, Slow)
    if (activeFamily === 'trend' && activeTrendIndicator === 'macross' && maCrossPro) {
      if (showFastMA && maCrossPro.fastMA?.length > 0) {
        const sFast = chart.addLineSeries({ color: '#00ff88', lineWidth: 2, title: `MA 1 (${fastType} ${fastLen})`, priceLineVisible: false });
        sFast.setData(maCrossPro.fastMA);
        mainOverlaySeriesRef.current.push(sFast);
      }
      if (showMedMA && maCrossPro.medMA?.length > 0) {
        const sMed = chart.addLineSeries({ color: '#facc15', lineWidth: 2, title: `MA 2 (${medType} ${medLen})`, priceLineVisible: false });
        sMed.setData(maCrossPro.medMA);
        mainOverlaySeriesRef.current.push(sMed);
      }
      if (showSlowMA && maCrossPro.slowMA?.length > 0) {
        const sSlow = chart.addLineSeries({ color: '#ef4444', lineWidth: 2, title: `MA 3 (${slowType} ${slowLen})`, priceLineVisible: false });
        sSlow.setData(maCrossPro.slowMA);
        mainOverlaySeriesRef.current.push(sSlow);
      }
    }

    // 2️⃣ Ichimoku Cloud PRO
    if (activeFamily === 'trend' && activeTrendIndicator === 'ichimoku' && ichimokuProData) {
      if (ichimokuProData.tenkan?.length > 0) {
        try {
          const sTenkan = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, title: `Tenkan (${convLen})`, priceLineVisible: false });
          sTenkan.setData(ichimokuProData.tenkan);
          mainOverlaySeriesRef.current.push(sTenkan);
        } catch(e) { console.warn('tenkan err', e); }
      }
      if (ichimokuProData.kijun?.length > 0) {
        try {
          const sKijun = chart.addLineSeries({ color: '#ef4444', lineWidth: 2, title: `Kijun (${baseLen})`, priceLineVisible: false });
          sKijun.setData(ichimokuProData.kijun);
          mainOverlaySeriesRef.current.push(sKijun);
        } catch(e) { console.warn('kijun err', e); }
      }
      if (ichimokuProData.spanA?.length > 0) {
        try {
          const sSpanA = chart.addLineSeries({ color: '#22c55e', lineWidth: 1.5, lineStyle: 2, title: 'Span A', priceLineVisible: false });
          sSpanA.setData(ichimokuProData.spanA);
          mainOverlaySeriesRef.current.push(sSpanA);
        } catch(e) { console.warn('spanA err', e); }
      }
      if (ichimokuProData.spanB?.length > 0) {
        try {
          const sSpanB = chart.addLineSeries({ color: '#f43f5e', lineWidth: 1.5, lineStyle: 2, title: `Span B (${spanBLen})`, priceLineVisible: false });
          sSpanB.setData(ichimokuProData.spanB);
          mainOverlaySeriesRef.current.push(sSpanB);
        } catch(e) { console.warn('spanB err', e); }
      }
      if (showChikou && ichimokuProData.chikou?.length > 0) {
        try {
          const sChikou = chart.addLineSeries({ color: '#a855f7', lineWidth: 1.5, title: 'Chikou', priceLineVisible: false });
          sChikou.setData(ichimokuProData.chikou);
          mainOverlaySeriesRef.current.push(sChikou);
        } catch(e) { console.warn('chikou err', e); }
      }
    }

    // 3️⃣ Donchian Channel PRO
    if (activeFamily === 'trend' && activeTrendIndicator === 'donchian' && donchianProData) {
      if (donchianProData.upper?.length > 0) {
        const sUp = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, title: `Donchian Upper (${donchianLen})`, priceLineVisible: false });
        sUp.setData(donchianProData.upper);
        mainOverlaySeriesRef.current.push(sUp);
      }
      if (showDonchianMid && donchianProData.middle?.length > 0) {
        const sMid = chart.addLineSeries({ color: '#f97316', lineWidth: 1.5, lineStyle: 2, title: 'Mid', priceLineVisible: false });
        sMid.setData(donchianProData.middle);
        mainOverlaySeriesRef.current.push(sMid);
      }
      if (donchianProData.lower?.length > 0) {
        const sLow = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, title: 'Lower', priceLineVisible: false });
        sLow.setData(donchianProData.lower);
        mainOverlaySeriesRef.current.push(sLow);
      }
    }

    // 4️⃣ Bollinger Bands (%B PRO)
    if (activeFamily === 'volatility' && activeVolatilityIndicator === 'bpercent' && bPercentProData) {
      if (bPercentProData.basisSeries?.length > 0) {
        const sBasis = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, lineStyle: 2, title: `BB Basis (${bPercentLen})`, priceLineVisible: false });
        sBasis.setData(bPercentProData.basisSeries);
        mainOverlaySeriesRef.current.push(sBasis);
      }
      if (bPercentProData.upperBBSeries?.length > 0) {
        const sUp = chart.addLineSeries({ color: '#38bdf8', lineWidth: 1.5, title: `Upper BB (${bPercentMult})`, priceLineVisible: false });
        sUp.setData(bPercentProData.upperBBSeries);
        mainOverlaySeriesRef.current.push(sUp);
      }
      if (bPercentProData.lowerBBSeries?.length > 0) {
        const sLow = chart.addLineSeries({ color: '#38bdf8', lineWidth: 1.5, title: 'Lower BB', priceLineVisible: false });
        sLow.setData(bPercentProData.lowerBBSeries);
        mainOverlaySeriesRef.current.push(sLow);
      }
    }

    // 🏷️ Configuration des markers bougies (TK Cross pour Ichimoku, nettoyage sinon)
    if (candleSeriesRef.current) {
      try {
        let markers = [];
        if (activeFamily === 'trend' && activeTrendIndicator === 'ichimoku' && ichimokuProData) {
          if (ichimokuProData.tkBullSignals) {
            ichimokuProData.tkBullSignals.forEach(s => {
              markers.push({ time: s.time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'TK Bull' });
            });
          }
          if (ichimokuProData.tkBearSignals) {
            ichimokuProData.tkBearSignals.forEach(s => {
              markers.push({ time: s.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'TK Bear' });
            });
          }
          markers.sort((a, b) => a.time - b.time);
        }

        if (activeFamily === 'trend' && activeTrendIndicator === 'donchian' && donchianProData) {
          if (donchianProData.breakUpSignals) {
            donchianProData.breakUpSignals.forEach(s => {
              markers.push({ time: s.time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'BO' });
            });
          }
          if (donchianProData.breakDownSignals) {
            donchianProData.breakDownSignals.forEach(s => {
              markers.push({ time: s.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'BD' });
            });
          }
          markers.sort((a, b) => a.time - b.time);
        }

        candleSeriesRef.current.setMarkers(markers);
      } catch (err) {
        console.warn('Error setting candle markers:', err);
      }
    }

    if (redrawRef.current) requestAnimationFrame(redrawRef.current);
  }, [activeFamily, activeTrendIndicator, activeVolatilityIndicator, maCrossPro, ichimokuProData, donchianProData, bPercentProData, fastLen, medLen, slowLen, fastType, medType, slowType, showFastMA, showMedMA, showSlowMA, showGcDcMarkers, maType, convLen, baseLen, spanBLen, showChikou, donchianLen, showDonchianMid, bPercentLen, bPercentMult]);

  // Sous-graphique dédié Oscillateurs
  useEffect(() => {
    if (!oscChartContainerRef.current) return;
    const isTrendOsc = activeFamily === 'trend' && (activeTrendIndicator === 'adx' || activeTrendIndicator === 'stc');
    const isMomentumOsc = activeFamily === 'momentum';
    const isVolatilityOsc = activeFamily === 'volatility';
    const isVolumeOsc = activeFamily === 'volume' && (activeVolumeIndicator === 'cmf' || activeVolumeIndicator === 'pvt');
    const isOscActive = isTrendOsc || isMomentumOsc || isVolatilityOsc || isVolumeOsc;

    if (!isOscActive) {
      if (oscChartRef.current) { try { oscChartRef.current.remove(); } catch (_) {} oscChartRef.current = null; }
      return;
    }

    if (oscChartRef.current) { try { oscChartRef.current.remove(); } catch (_) {} oscChartRef.current = null; }

    const container = oscChartContainerRef.current;
    const oscChart = createChart(container, {
      width: container.clientWidth,
      height: 180,
      layout: { background: { color: 'rgba(4, 8, 16, 0.98)' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)', autoScale: true, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, secondsVisible: false, rightOffset: 12 }
    });

    // ⚡ ADX PRO
    if (activeFamily === 'trend' && activeTrendIndicator === 'adx' && adxProData) {
      if (showAdxHist && adxProData.histSeries.length > 0) {
        const hist = oscChart.addHistogramSeries({ title: 'DI Hist', priceFormat: { type: 'volume' } });
        hist.setData(adxProData.histSeries);
      }
      if (adxProData.plusDISeries.length > 0) {
        const p = oscChart.addLineSeries({ color: '#22c55e', lineWidth: 1.5, title: '+DI', priceLineVisible: false });
        p.setData(adxProData.plusDISeries);
      }
      if (adxProData.minusDISeries.length > 0) {
        const m = oscChart.addLineSeries({ color: '#ef4444', lineWidth: 1.5, title: '-DI', priceLineVisible: false });
        m.setData(adxProData.minusDISeries);
      }
      if (adxProData.adxSeries.length > 0) {
        const a = oscChart.addLineSeries({ color: '#a855f7', lineWidth: 2.5, title: 'ADX', priceLineVisible: false });
        a.setData(adxProData.adxSeries);
      }
    }

    // 🔄 STC PRO
    if (activeFamily === 'trend' && activeTrendIndicator === 'stc' && stcProData?.stcSeries) {
      const s = oscChart.addLineSeries({ color: '#00ff88', lineWidth: 2.5, title: 'STC', priceLineVisible: false });
      s.setData(stcProData.stcSeries);
      if (stcProData.bullSignals || stcProData.bearSignals) {
         const m = [];
         (stcProData.bullSignals || []).forEach(sig => m.push({ time: sig.time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', size: 1 }));
         (stcProData.bearSignals || []).forEach(sig => m.push({ time: sig.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', size: 1 }));
         m.sort((a,b) => a.time - b.time);
         s.setMarkers(m);
      }
    }

    // 🌊 RSI PRO
    if (activeFamily === 'momentum' && activeMomentumIndicator === 'rsi' && rsiProData?.rsiSeries) {
const r = oscChart.addLineSeries({ color: '#a855f7', lineWidth: 2.5, title: 'RSI', priceLineVisible: false });
      const coloredRsi = rsiProData.rsiSeries.map(p => {
         let color = '#a855f7';
         if (p.value >= rsiObLevel) color = '#ef4444';
         if (p.value <= rsiOsLevel) color = '#22c55e';
         return { ...p, color };
      });
      r.setData(coloredRsi);

      let rsiMarkers = [];
      if (rsiProData.bullDivs) {
         rsiProData.bullDivs.forEach(s => {
           rsiMarkers.push({ time: s.time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'Bull Div' });
         });
      }
      if (rsiProData.bearDivs) {
         rsiProData.bearDivs.forEach(s => {
           rsiMarkers.push({ time: s.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'Bear Div' });
         });
      }
      rsiMarkers.sort((a,b) => a.time - b.time);
      r.setMarkers(rsiMarkers);
      const l70 = oscChart.addLineSeries({ color: 'rgba(239,68,68,0.7)', lineWidth: 1.5, lineStyle: 2, title: 'OB 70', priceLineVisible: false });
      l70.setData(rsiProData.rsiSeries.map(p => ({ time: p.time, value: rsiObLevel })));
      const l30 = oscChart.addLineSeries({ color: 'rgba(34,197,94,0.7)', lineWidth: 1.5, lineStyle: 2, title: 'OS 30', priceLineVisible: false });
      l30.setData(rsiProData.rsiSeries.map(p => ({ time: p.time, value: rsiOsLevel })));
    }

    // 💵 MFI PRO
    if (activeFamily === 'momentum' && activeMomentumIndicator === 'mfi' && mfiProData?.mfiSeries) {
      const m = oscChart.addLineSeries({ color: '#06b6d4', lineWidth: 2.5, title: 'MFI', priceLineVisible: false });
      const coloredMfi = mfiProData.mfiSeries.map(p => {
         let color = '#06b6d4';
         if (p.value >= mfiObLevel) color = '#ef4444';
         if (p.value <= mfiOsLevel) color = '#22c55e';
         return { ...p, color };
      });
      m.setData(coloredMfi);

      const m80 = oscChart.addLineSeries({ color: 'rgba(239,68,68,0.7)', lineWidth: 1.5, lineStyle: 2, title: 'OB 80', priceLineVisible: false });
      m80.setData(mfiProData.mfiSeries.map(p => ({ time: p.time, value: mfiObLevel })));
      const m20 = oscChart.addLineSeries({ color: 'rgba(34,197,94,0.7)', lineWidth: 1.5, lineStyle: 2, title: 'OS 20', priceLineVisible: false });
      m20.setData(mfiProData.mfiSeries.map(p => ({ time: p.time, value: mfiOsLevel })));

      let mfiMarkers = [];
      if (mfiProData.bullDivs) {
         mfiProData.bullDivs.forEach(s => {
           mfiMarkers.push({ time: s.time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'Bull Div' });
         });
      }
      if (mfiProData.bearDivs) {
         mfiProData.bearDivs.forEach(s => {
           mfiMarkers.push({ time: s.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'Bear Div' });
         });
      }
      mfiMarkers.sort((a,b) => a.time - b.time);
      m.setMarkers(mfiMarkers);
    }

    // 🌊 WAVETREND PRO
    if (activeFamily === 'momentum' && activeMomentumIndicator === 'wavetrend' && waveTrendProData?.wt1Series) {
      if (waveTrendProData.waveSeries.length > 0) {
        const w = oscChart.addHistogramSeries({ title: 'WT Wave', priceFormat: { type: 'volume' } });
        w.setData(waveTrendProData.waveSeries);
      }
      const wt1 = oscChart.addLineSeries({ color: '#38bdf8', lineWidth: 2, title: 'WT1', priceLineVisible: false });
      wt1.setData(waveTrendProData.wt1Series);
      const wt2 = oscChart.addLineSeries({ color: '#f97316', lineWidth: 2, title: 'WT2', priceLineVisible: false });
      wt2.setData(waveTrendProData.wt2Series);
      
      const l60 = oscChart.addLineSeries({ color: 'rgba(239, 68, 68, 0.8)', lineWidth: 1, title: 'OB 60', priceLineVisible: false });
      l60.setData(waveTrendProData.wt1Series.map(p => ({ time: p.time, value: waveTrendProData.obLevel1 || 60 })));
      const l53 = oscChart.addLineSeries({ color: 'rgba(239, 68, 68, 0.6)', lineWidth: 1, lineStyle: 2, title: 'OB 53', priceLineVisible: false });
      l53.setData(waveTrendProData.wt1Series.map(p => ({ time: p.time, value: waveTrendProData.obLevel2 || 53 })));
      
      const l0 = oscChart.addLineSeries({ color: 'rgba(148, 163, 184, 0.5)', lineWidth: 1, title: 'Mid 0', priceLineVisible: false });
      l0.setData(waveTrendProData.wt1Series.map(p => ({ time: p.time, value: 0 })));

      const lN53 = oscChart.addLineSeries({ color: 'rgba(34, 197, 94, 0.6)', lineWidth: 1, lineStyle: 2, title: 'OS -53', priceLineVisible: false });
      lN53.setData(waveTrendProData.wt1Series.map(p => ({ time: p.time, value: waveTrendProData.osLevel2 || -53 })));
      const lN60 = oscChart.addLineSeries({ color: 'rgba(34, 197, 94, 0.8)', lineWidth: 1, title: 'OS -60', priceLineVisible: false });
      lN60.setData(waveTrendProData.wt1Series.map(p => ({ time: p.time, value: waveTrendProData.osLevel1 || -60 })));

      let wtMarkers = [];
      if (waveTrendProData.buySignals) {
         waveTrendProData.buySignals.forEach(s => {
           wtMarkers.push({ time: s.time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'BUY' });
         });
      }
      if (waveTrendProData.sellSignals) {
         waveTrendProData.sellSignals.forEach(s => {
           wtMarkers.push({ time: s.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'SELL' });
         });
      }
      wtMarkers.sort((a,b) => a.time - b.time);
      wt1.setMarkers(wtMarkers);
    }

    // 🌊 %B PRO
    if (activeFamily === 'volatility' && activeVolatilityIndicator === 'bpercent' && bPercentProData?.bPercentSeries) {
      const b = oscChart.addLineSeries({ color: '#2962ff', lineWidth: 2, title: '%B', priceLineVisible: false });
      
      const coloredData = bPercentProData.bPercentSeries.map(p => ({
         ...p,
         color: p.value >= 1.0 ? '#ef4444' : p.value <= 0.0 ? '#22c55e' : '#2962ff'
      }));
      b.setData(coloredData);

      const l1 = oscChart.addLineSeries({ color: 'rgba(239, 68, 68, 0.6)', lineWidth: 1, lineStyle: 2, title: 'Upper (1)', priceLineVisible: false });
      l1.setData(bPercentProData.bPercentSeries.map(p => ({ time: p.time, value: 1.0 })));
      const l0 = oscChart.addLineSeries({ color: 'rgba(34, 197, 94, 0.6)', lineWidth: 1, lineStyle: 2, title: 'Lower (0)', priceLineVisible: false });
      l0.setData(bPercentProData.bPercentSeries.map(p => ({ time: p.time, value: 0.0 })));
      
      let markers = [];
      for (let i = 1; i < bPercentProData.bPercentSeries.length; i++) {
         const prev = bPercentProData.bPercentSeries[i-1].value;
         const cur = bPercentProData.bPercentSeries[i].value;
         const time = bPercentProData.bPercentSeries[i].time;
         
         if (prev < 1.0 && cur >= 1.0) {
            markers.push({ time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown' });
         }
         if (prev > 0.0 && cur <= 0.0) {
            markers.push({ time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp' });
         }
      }
      
      if (bPercentProData.bullWalkSignals) {
         bPercentProData.bullWalkSignals.forEach(s => {
            markers.push({ time: s.time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'WALK' });
         });
      }
      if (bPercentProData.bearWalkSignals) {
         bPercentProData.bearWalkSignals.forEach(s => {
            markers.push({ time: s.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'WALK' });
         });
      }
      
      markers.sort((a,b) => a.time - b.time);
      b.setMarkers(markers);
    }

    // 📊 ATR% PRO
    if (activeFamily === 'volatility' && activeVolatilityIndicator === 'atrpct' && atrPercentProData?.atrPctSeries) {
      const a = oscChart.addLineSeries({ color: '#f97316', lineWidth: 2.5, title: 'ATR%', priceLineVisible: false });
      a.setData(atrPercentProData.atrPctSeries);
      if (atrPercentProData.atrAvgSeries.length > 0) {
        const avg = oscChart.addLineSeries({ color: 'rgba(148,163,184,0.7)', lineWidth: 1.5, title: 'Avg', priceLineVisible: false });
        avg.setData(atrPercentProData.atrAvgSeries);
      }
    }

    // 🎯 TTM SQUEEZE PRO
    if (activeFamily === 'volatility' && activeVolatilityIndicator === 'ttm' && ttmSqueezeProData?.histSeries) {
      const t = oscChart.addHistogramSeries({ title: 'Momentum', priceFormat: { type: 'volume' } });
      t.setData(ttmSqueezeProData.histSeries);
    }

    // 📊 1. CMF PRO
    if (activeFamily === 'volume' && activeVolumeIndicator === 'cmf' && cmfProData?.cmfSeries) {
      const cmfHist = oscChart.addHistogramSeries({ title: `CMF (${cmfLen})`, priceFormat: { type: 'volume' } });
      cmfHist.setData(cmfProData.cmfSeries);
      const lineTop = oscChart.addLineSeries({ color: 'rgba(34, 197, 94, 0.6)', lineWidth: 1.5, lineStyle: 2, title: 'Strong Bull', priceLineVisible: false });
      lineTop.setData(cmfProData.cmfSeries.map(p => ({ time: p.time, value: cmfStrong })));
      const lineZero = oscChart.addLineSeries({ color: 'rgba(148, 163, 184, 0.5)', lineWidth: 1, lineStyle: 1, title: 'Zero', priceLineVisible: false });
      lineZero.setData(cmfProData.cmfSeries.map(p => ({ time: p.time, value: 0 })));
    }

    // 📈 2. PVT PRO
    if (activeFamily === 'volume' && activeVolumeIndicator === 'pvt' && pvtProData?.pvtSeries) {
      const pvtLine = oscChart.addLineSeries({ color: '#0d9488', lineWidth: 2.5, title: 'PVT', priceLineVisible: false });
      pvtLine.setData(pvtProData.pvtSeries);
      if (showPvtSig && !pvtUseOsc && pvtProData.sigSeries.length > 0) {
        const sigLine = oscChart.addLineSeries({ color: '#f97316', lineWidth: 2, title: 'Signal', priceLineVisible: false });
        sigLine.setData(pvtProData.sigSeries);
      }
    }

    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && oscChart) oscChart.timeScale().setVisibleLogicalRange(range);
      });
      oscChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && chartRef.current) chartRef.current.timeScale().setVisibleLogicalRange(range);
        if (redrawOscCanvasOverlay) requestAnimationFrame(redrawOscCanvasOverlay);
      });
      oscChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (redrawOscCanvasOverlay) requestAnimationFrame(redrawOscCanvasOverlay);
      });
    }

    const handleOscResize = () => {
      if (oscChartContainerRef.current && oscChart && oscCanvasOverlayRef.current) {
        oscChart.applyOptions({ width: oscChartContainerRef.current.clientWidth });
        oscCanvasOverlayRef.current.width = oscChartContainerRef.current.clientWidth;
        if (redrawOscCanvasOverlay) requestAnimationFrame(redrawOscCanvasOverlay);
      }
    };
    window.addEventListener('resize', handleOscResize);
    oscChartRef.current = oscChart;

    return () => {
      window.removeEventListener('resize', handleOscResize);
      if (oscChartRef.current) {
        try { oscChartRef.current.remove(); } catch (_) {}
        oscChartRef.current = null;
      }
    };
  }, [activeFamily, activeTrendIndicator, activeMomentumIndicator, activeVolatilityIndicator, activeVolumeIndicator, adxProData, stcProData, rsiProData, mfiProData, waveTrendProData, bPercentProData, atrPercentProData, ttmSqueezeProData, cmfProData, pvtProData, redrawOscCanvasOverlay]);

  // Listes des 4 familles
  const mainFamilies = [
    { id: 'trend', label: 'TREND (الاتجاه)', icon: '📈', color: '#00ff88' },
    { id: 'momentum', label: 'MOMENTUM (الزخم)', icon: '⚡', color: '#38bdf8' },
    { id: 'volatility', label: 'VOLATILITY (التقلب)', icon: '🌊', color: '#a855f7' },
    { id: 'volume', label: 'VOLUME (الحجم)', icon: '📊', color: '#facc15' },
    { id: 'onchain', label: 'ON-CHAIN (البلوكشين)', icon: '⛓️', color: '#f43f5e' }
  ];

  const trendIndicatorsList = [
    { id: 'macross', label: '1. MA Cross (3 MAs: 50 / 100 / 200 + Cloud)', icon: '📈' },
    { id: 'adx', label: '2. ADX (Average Directional Index + DMI)', icon: '⚡' },
    { id: 'ichimoku', label: '3. Ichimoku Cloud (Tenkan, Kijun, Kumo)', icon: '☁️' },
    { id: 'stc', label: '4. STC (Schaff Trend Cycle PRO)', icon: '🔄' },
    { id: 'donchian', label: '5. Donchian Channel (Haut, Bas, Milieu)', icon: '📊' }
  ];

  const momentumIndicatorsList = [
    { id: 'rsi', label: '1. RSI PRO (Wilder + Niveaux + Divergences)', icon: '⚡' },
    { id: 'mfi', label: '2. MFI PRO (Money Flow Index + Volume)', icon: '💵' },
    { id: 'wavetrend', label: '3. WaveTrend PRO (WT1, WT2, Vague & Signaux)', icon: '🌊' }
  ];

  const volatilityIndicatorsList = [
    { id: 'bpercent', label: '1. %B PRO (Bollinger %B + Bandwalk)', icon: '🌊' },
    { id: 'atrpct', label: '2. ATR% PRO (Normalized ATR / Prix + Rank 200)', icon: '📊' },
    { id: 'ttm', label: '3. TTM Squeeze PRO (Bollinger vs Keltner)', icon: '🎯' }
  ];

  const volumeIndicatorsList = [
    { id: 'cmf', label: '1. CMF PRO (Chaikin Money Flow + Divergences + Zones)', icon: '📊' },
    { id: 'pvt', label: '2. PVT PRO (Price Volume Trend + Signal EMA + Divergences)', icon: '📈' },
    { id: 'vp', label: '3. Volume Profile PRO (VPVR / VPFR + POC + Value Area 70%)', icon: '📊' }
  ];

  const activeFamilyTitle = activeFamily === 'trend'
    ? trendIndicatorsList.find(t => t.id === activeTrendIndicator)?.label
    : activeFamily === 'momentum'
    ? momentumIndicatorsList.find(m => m.id === activeMomentumIndicator)?.label
    : activeFamily === 'volatility'
    ? volatilityIndicatorsList.find(v => v.id === activeVolatilityIndicator)?.label
    : volumeIndicatorsList.find(vo => vo.id === activeVolumeIndicator)?.label;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#040810',
      color: '#ffffff',
      padding: '24px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* 👑 HEADER PRINCIPAL */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(8, 16, 32, 0.98) 0%, rgba(4, 8, 16, 0.99) 100%)',
        border: '2px solid rgba(250, 204, 21, 0.35)',
        borderRadius: '18px',
        padding: '20px 26px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 0 35px rgba(250, 204, 21, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #facc15, #f59e0b)',
            padding: '10px',
            borderRadius: '12px',
            boxShadow: '0 0 20px rgba(250, 204, 21, 0.6)'
          }}>
            <Trophy size={28} color="#000" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#facc15' }}>
                👑 BITCOIN WEEKLY MULTI-FAMILY INDICATORS MATRIX
              </h1>
              {isLiveActive && (
                <span style={{
                  background: 'rgba(0, 255, 136, 0.15)',
                  border: '1px solid #00ff88',
                  color: '#00ff88',
                  fontSize: '0.68rem',
                  fontWeight: '900',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Radio size={12} className="animate-pulse" /> LIVE BYBIT SPOT
                </span>
              )}
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.80rem', color: '#94a3b8' }}>
              استكشاف وإسقاط مؤشرات العائلات الـ 4 المعتمدة مباشرة على شارت البيتكوين مع مصفوفة التصويت الإجمالية
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>PRIX ACTUEL BTC :</span>
          <strong style={{ fontSize: '1.25rem', color: '#00ff88' }}>${currentPrice.toLocaleString()}</strong>
        </div>
      </div>

      {/* 🌟 1. LES BOUTONS DES 4 FAMILLES MAJEURES */}
      <div style={{
        background: 'rgba(8, 16, 28, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '14px',
        padding: '8px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '8px'
      }}>
        {mainFamilies.map((fam) => {
          const isActive = activeFamily === fam.id;
          return (
            <button
              key={fam.id}
              onClick={() => setActiveFamily(fam.id)}
              style={{
                background: isActive ? `linear-gradient(135deg, ${fam.color}, #059669)` : 'rgba(255,255,255,0.03)',
                color: isActive ? '#000000' : '#cccccc',
                border: isActive ? `2px solid ${fam.color}` : '1px solid rgba(255,255,255,0.06)',
                padding: '12px 14px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? `0 0 20px ${fam.color}50` : 'none'
              }}
            >
              <span>{fam.icon}</span> {fam.label}
            </button>
          );
        })}
      </div>

      {/* 📁 2. SOUS-NAVIGATION DE LA FAMILLE TREND */}
      {activeFamily === 'trend' && (
        <div style={{ background: 'rgba(10, 20, 36, 0.95)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '14px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>📈 مؤشرات عائلة الاتجاه (TREND) :</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            {trendIndicatorsList.map(ind => (
              <button key={ind.id} onClick={() => setActiveTrendIndicator(ind.id)} style={{ background: activeTrendIndicator === ind.id ? 'linear-gradient(135deg, #00ff88, #059669)' : 'rgba(255,255,255,0.03)', color: activeTrendIndicator === ind.id ? '#000' : '#fff', border: activeTrendIndicator === ind.id ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{ind.icon} {ind.label}</span>
                {activeTrendIndicator === ind.id && <CheckCircle size={14} color="#000" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 📁 2. SOUS-NAVIGATION DE LA FAMILLE MOMENTUM */}
      {activeFamily === 'momentum' && (
        <div style={{ background: 'rgba(10, 20, 36, 0.95)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '14px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>⚡ مؤشرات عائلة الزخم (MOMENTUM) :</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
            {momentumIndicatorsList.map(ind => (
              <button key={ind.id} onClick={() => setActiveMomentumIndicator(ind.id)} style={{ background: activeMomentumIndicator === ind.id ? 'linear-gradient(135deg, #38bdf8, #0284c7)' : 'rgba(255,255,255,0.03)', color: activeMomentumIndicator === ind.id ? '#000' : '#fff', border: activeMomentumIndicator === ind.id ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{ind.icon} {ind.label}</span>
                {activeMomentumIndicator === ind.id && <CheckCircle size={14} color="#000" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 📁 2. SOUS-NAVIGATION DE LA FAMILLE VOLATILITY */}
      {activeFamily === 'volatility' && (
        <div style={{ background: 'rgba(10, 20, 36, 0.95)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '14px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>🌊 مؤشرات عائلة التقلب (VOLATILITY) :</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
            {volatilityIndicatorsList.map(ind => (
              <button key={ind.id} onClick={() => setActiveVolatilityIndicator(ind.id)} style={{ background: activeVolatilityIndicator === ind.id ? 'linear-gradient(135deg, #a855f7, #7e22ce)' : 'rgba(255,255,255,0.03)', color: activeVolatilityIndicator === ind.id ? '#000' : '#fff', border: activeVolatilityIndicator === ind.id ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{ind.icon} {ind.label}</span>
                {activeVolatilityIndicator === ind.id && <CheckCircle size={14} color="#000" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 📁 2. SOUS-NAVIGATION DE LA FAMILLE VOLUME */}
      {activeFamily === 'volume' && (
        <div style={{ background: 'rgba(10, 20, 36, 0.95)', border: '1px solid rgba(250, 204, 21, 0.3)', borderRadius: '14px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>📊 مؤشرات عائلة الحجم والسيولة (VOLUME) :</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
            {volumeIndicatorsList.map(ind => (
              <button key={ind.id} onClick={() => setActiveVolumeIndicator(ind.id)} style={{ background: activeVolumeIndicator === ind.id ? 'linear-gradient(135deg, #facc15, #eab308)' : 'rgba(255,255,255,0.03)', color: activeVolumeIndicator === ind.id ? '#000' : '#fff', border: activeVolumeIndicator === ind.id ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{ind.icon} {ind.label}</span>
                {activeVolumeIndicator === ind.id && <CheckCircle size={14} color="#000" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 📊 3. GRAND GRAPHIQUE BITCOIN */}
      <div style={{ background: 'rgba(6, 12, 24, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 0 35px rgba(0, 0, 0, 0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={18} color="#facc15" />
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>CHARTE BITCOIN (1W) — {activeFamilyTitle}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => chartRef.current?.timeScale().fitContent()} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer' }}><RotateCcw size={13} /> FIT ZOOM</button>
            <button onClick={() => setIsLogScale(!isLogScale)} style={{ background: isLogScale ? 'linear-gradient(135deg, #facc15, #f59e0b)' : 'rgba(255,255,255,0.05)', color: isLogScale ? '#000' : '#ccc', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer' }}>📐 ÉCHELLE LOG ({isLogScale ? 'ON' : 'OFF'})</button>

            {activeFamily === 'trend' && activeTrendIndicator === 'macross' && (
              <button onClick={() => setShowMaSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #00ff88, #059669)', color: '#000', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات MA Cross (3 MAs)
              </button>
            )}

            {activeFamily === 'trend' && activeTrendIndicator === 'adx' && (
              <button onClick={() => setShowAdxSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #a855f7, #7e22ce)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات ADX PRO
              </button>
            )}

            {activeFamily === 'trend' && activeTrendIndicator === 'ichimoku' && (
              <button onClick={() => setShowIchimokuSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات Ichimoku Cloud
              </button>
            )}

            {activeFamily === 'trend' && activeTrendIndicator === 'stc' && (
              <button onClick={() => setShowStcSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #00ff88, #059669)', color: '#000', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات STC PRO
              </button>
            )}

            {activeFamily === 'trend' && activeTrendIndicator === 'donchian' && (
              <button onClick={() => setShowDonchianSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات Donchian Channel
              </button>
            )}

            {activeFamily === 'momentum' && activeMomentumIndicator === 'rsi' && (
              <button onClick={() => setShowRsiSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #a855f7, #7e22ce)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات RSI PRO
              </button>
            )}

            {activeFamily === 'momentum' && activeMomentumIndicator === 'mfi' && (
              <button onClick={() => setShowMfiSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#000', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات MFI PRO
              </button>
            )}

            {activeFamily === 'momentum' && activeMomentumIndicator === 'wavetrend' && (
              <button onClick={() => setShowWtSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: '#000', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات WaveTrend PRO
              </button>
            )}

            {activeFamily === 'volatility' && activeVolatilityIndicator === 'bpercent' && (
              <button onClick={() => setShowBPercentSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: '#000', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات %B PRO
              </button>
            )}

            {activeFamily === 'volatility' && activeVolatilityIndicator === 'atrpct' && (
              <button onClick={() => setShowAtrSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات ATR% PRO
              </button>
            )}

            {activeFamily === 'volatility' && activeVolatilityIndicator === 'ttm' && (
              <button onClick={() => setShowTtmSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #a855f7, #7e22ce)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات TTM Squeeze
              </button>
            )}

            {activeFamily === 'volume' && activeVolumeIndicator === 'cmf' && (
              <button onClick={() => setShowCmfSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #facc15, #eab308)', color: '#000', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات CMF PRO
              </button>
            )}

            {activeFamily === 'volume' && activeVolumeIndicator === 'pvt' && (
              <button onClick={() => setShowPvtSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات PVT PRO
              </button>
            )}

            {activeFamily === 'volume' && activeVolumeIndicator === 'vp' && (
              <button onClick={() => setShowVpSettingsModal(true)} style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Settings size={13} /> إعدادات Volume Profile
              </button>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '540px', borderRadius: '10px', overflow: 'hidden' }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
          <canvas ref={canvasOverlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} />
        </div>

        {/* ⚡ SOUS-GRAPHIQUE DÉDIÉ OSCILLATEURS POUR TOUTES LES FAMILLES */}
        {activeFamily === 'volume' && activeVolumeIndicator === 'vp' ? (
          <div style={{ background: 'rgba(4, 8, 16, 0.98)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.80rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ color: '#fff', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} color="#3b82f6" /> Volume Profile PRO ({vpLookback} bars, {vpRows} bins, {vpVaPercent}% VA) :
              </span>
              <span style={{ color: '#ef4444', fontWeight: '900', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ef4444' }}>
                POC (Point of Control): ${volumeProfileProData?.pocPrice?.toLocaleString()}
              </span>
              <span style={{ color: '#3b82f6', fontWeight: '900' }}>
                VAH: ${volumeProfileProData?.vahPrice?.toLocaleString()} | VAL: ${volumeProfileProData?.valPrice?.toLocaleString()}
              </span>
            </div>
            <span style={{ color: volumeProfileProData?.isAbovePOC ? '#00ff88' : '#ef4444', fontWeight: 'bold' }}>
              {volumeProfileProData?.isAbovePOC ? '🟢 PRIX AU-DESSUS DU POC (STRUCTURE HAUSSIÈRE FORTE)' : '🔴 PRIX EN-DESSOUS DU POC'}
            </span>
          </div>
        ) : (
          ((activeFamily === 'trend' && (activeTrendIndicator === 'adx' || activeTrendIndicator === 'stc')) ||
           (activeFamily === 'momentum') ||
           (activeFamily === 'volatility') ||
           (activeFamily === 'volume' && (activeVolumeIndicator === 'cmf' || activeVolumeIndicator === 'pvt'))) && (
            <div style={{ background: 'rgba(4, 8, 16, 0.98)', border: '1px solid rgba(250, 204, 21, 0.4)', borderRadius: '10px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '0.74rem' }}>
                {activeFamily === 'trend' && activeTrendIndicator === 'adx' && (
                  <span style={{ color: '#a855f7', fontWeight: '900' }}>⚡ ADX: {adxProData?.curADX} (+DI: {adxProData?.curPlusDI} | -DI: {adxProData?.curMinusDI})</span>
                )}
                {activeFamily === 'trend' && activeTrendIndicator === 'stc' && (
                  <span style={{ color: '#00ff88', fontWeight: '900' }}>🔄 STC (Schaff Trend Cycle): {stcProData?.curSTC}</span>
                )}
                {activeFamily === 'momentum' && activeMomentumIndicator === 'rsi' && (
                  <span style={{ color: '#a855f7', fontWeight: '900' }}>⚡ RSI ({rsiLen}): {rsiProData?.curRSI}</span>
                )}
                {activeFamily === 'momentum' && activeMomentumIndicator === 'mfi' && (
                  <span style={{ color: '#06b6d4', fontWeight: '900' }}>💵 MFI ({mfiLen}): {mfiProData?.curMFI}</span>
                )}
                {activeFamily === 'momentum' && activeMomentumIndicator === 'wavetrend' && (
                  <span style={{ color: '#38bdf8', fontWeight: '900' }}>🌊 WaveTrend: WT1 ({waveTrendProData?.curWT1}) | WT2 ({waveTrendProData?.curWT2})</span>
                )}
                {activeFamily === 'volatility' && activeVolatilityIndicator === 'bpercent' && (
                  <span style={{ color: '#38bdf8', fontWeight: '900' }}>🌊 Bollinger %B: {bPercentProData?.curBPercent}</span>
                )}
                {activeFamily === 'volatility' && activeVolatilityIndicator === 'atrpct' && (
                  <span style={{ color: '#f97316', fontWeight: '900' }}>📊 ATR% Normalized: {atrPercentProData?.curATRPct}% (Percentile Rank: {atrPercentProData?.curRank}%)</span>
                )}
                {activeFamily === 'volatility' && activeVolatilityIndicator === 'ttm' && (
                  <span style={{ color: ttmSqueezeProData?.curVal >= 0 ? '#00ff88' : '#ef4444', fontWeight: '900' }}>🎯 TTM Squeeze Momentum: {ttmSqueezeProData?.curVal} ({ttmSqueezeProData?.sqzStatus})</span>
                )}
                {activeFamily === 'volume' && activeVolumeIndicator === 'cmf' && (
                  <span style={{ color: cmfProData?.curCMF >= cmfStrong ? '#22c55e' : cmfProData?.curCMF > 0 ? '#15803d' : '#ef4444', fontWeight: '900' }}>💵 CMF ({cmfLen}): {cmfProData?.curCMF} ({cmfProData?.zone})</span>
                )}
                {activeFamily === 'volume' && activeVolumeIndicator === 'pvt' && (
                  <span style={{ color: '#0d9488', fontWeight: '900' }}>📈 PVT: {pvtProData?.curPVT?.toLocaleString()} vs Signal: {pvtProData?.curSig?.toLocaleString()}</span>
                )}
              </div>
              <div style={{ position: 'relative', width: '100%', height: '180px' }}>
                <canvas ref={oscCanvasOverlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} />
                <div ref={oscChartContainerRef} style={{ width: '100%', height: '100%', borderRadius: '6px', overflow: 'hidden' }} />
              </div>
            </div>
          )
        )}
      </div>

      {/* 🗳️ 4. TABLEAU DE VOTE DE LA FAMILLE ACTIVE */}
      <div style={{ background: 'linear-gradient(135deg, rgba(8, 16, 32, 0.98) 0%, rgba(4, 8, 16, 0.99) 100%)', border: '1px solid rgba(250, 204, 21, 0.35)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 0 35px rgba(250, 204, 21, 0.08)' }}>
        {(() => {
          const currentMatrix = activeFamily === 'trend'
            ? trendVotingMatrix
            : activeFamily === 'momentum'
            ? momentumVotingMatrix
            : activeFamily === 'volatility'
            ? volatilityVotingMatrix
            : volumeVotingMatrix;

          const activeIndId = activeFamily === 'trend'
            ? activeTrendIndicator
            : activeFamily === 'momentum'
            ? activeMomentumIndicator
            : activeFamily === 'volatility'
            ? activeVolatilityIndicator
            : activeVolumeIndicator;

          const setActiveInd = (id) => {
            if (activeFamily === 'trend') setActiveTrendIndicator(id);
            else if (activeFamily === 'momentum') setActiveMomentumIndicator(id);
            else if (activeFamily === 'volatility') setActiveVolatilityIndicator(id);
            else if (activeFamily === 'volume') setActiveVolumeIndicator(id);
          };

          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(250, 204, 21, 0.15)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(250, 204, 21, 0.4)' }}>
                    <Vote size={20} color="#facc15" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#fff' }}>
                      🗳️ مصفوفة تصويت عائلة {mainFamilies.find(f => f.id === activeFamily)?.label} ({activeFamily.toUpperCase()} VOTING MATRIX)
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                      تصويت تفصيلي وتراكمي لجميع مؤشرات هذه العائلة لتحديد الاتجاه الإجمالي بدقة رياضية
                    </p>
                  </div>
                </div>

                <div style={{ background: currentMatrix.bullPercentage >= 60 ? 'rgba(0, 255, 136, 0.12)' : 'rgba(239, 68, 68, 0.12)', border: currentMatrix.bullPercentage >= 60 ? '1px solid #00ff88' : '1px solid #ef4444', padding: '8px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 'bold' }}>إجماع العائلة :</span>
                  <strong style={{ fontSize: '0.92rem', color: currentMatrix.bullPercentage >= 60 ? '#00ff88' : '#ef4444' }}>{currentMatrix.verdict}</strong>
                  <span style={{ background: currentMatrix.bullPercentage >= 60 ? '#00ff88' : '#ef4444', color: '#000', fontSize: '0.74rem', fontWeight: '900', padding: '2px 8px', borderRadius: '6px' }}>
                    {currentMatrix.bullCount} BULL / {currentMatrix.bearCount} BEAR ({currentMatrix.bullPercentage}%)
                  </span>
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.80rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                      <th style={{ padding: '12px 16px' }}>المؤشر (INDICATEUR)</th>
                      <th style={{ padding: '12px 16px' }}>الإعدادات (PARAMÈTRES)</th>
                      <th style={{ padding: '12px 16px' }}>القيمة الحالية (VALEUR ACTUELLE)</th>
                      <th style={{ padding: '12px 16px' }}>شرط الصعود (CONDITION BULL)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>التصويت (VOTE)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>الحالة (STATUS)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>إسقاط على الشارت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMatrix.votes.map((vote, idx) => (
                      <tr key={vote.id} style={{ background: activeIndId === vote.id ? 'rgba(250, 204, 21, 0.06)' : idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '900', color: activeIndId === vote.id ? '#facc15' : '#fff' }}>{vote.name}</td>
                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontFamily: 'monospace' }}>{vote.params}</td>
                        <td style={{ padding: '12px 16px', color: '#facc15', fontWeight: 'bold' }}>{vote.currentValue}</td>
                        <td style={{ padding: '12px 16px', color: '#cbd5e1' }} dangerouslySetInnerHTML={{ __html: vote.condition }} />
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ background: vote.isBull ? 'rgba(0, 255, 136, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: vote.isBull ? '1px solid #00ff88' : '1px solid #ef4444', color: vote.isBull ? '#00ff88' : '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '900', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {vote.isBull ? <><ArrowUpRight size={13} /> 🟢 BULL</> : <><ArrowDownRight size={13} /> 🔴 BEAR</>}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: vote.isBull ? '#00ff88' : '#ef4444', fontWeight: 'bold' }}>{vote.statusLabel}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button onClick={() => setActiveInd(vote.id)} style={{ background: activeIndId === vote.id ? 'linear-gradient(135deg, #facc15, #eab308)' : 'rgba(255,255,255,0.05)', color: activeIndId === vote.id ? '#000' : '#ccc', border: activeIndId === vote.id ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: '900', cursor: 'pointer' }}>
                            <Eye size={12} /> {activeIndId === vote.id ? 'معروض حالياً' : 'عرض المؤشر'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </div>

      {/* ⚙️ 1. MODALE MA CROSS PRO */}
      {showMaSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '520px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>MA Cross Settings (3 Moving Averages)</h3>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Configuration des 3 Moyennes Mobiles (EMA / SMA / Hybride)</span>
              </div>
              <button onClick={() => setShowMaSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Raccourcis Rapides Presets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>PRESETS RAPIDES :</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <button 
                    onClick={() => { setFastType('EMA'); setMedType('EMA'); setSlowType('EMA'); setMaType('EMA'); }}
                    style={{ background: fastType === 'EMA' && medType === 'EMA' && slowType === 'EMA' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255,255,255,0.05)', border: fastType === 'EMA' && medType === 'EMA' && slowType === 'EMA' ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    ⚡ Tout en EMA
                  </button>
                  <button 
                    onClick={() => { setFastType('SMA'); setMedType('SMA'); setSlowType('SMA'); setMaType('SMA'); }}
                    style={{ background: fastType === 'SMA' && medType === 'SMA' && slowType === 'SMA' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255,255,255,0.05)', border: fastType === 'SMA' && medType === 'SMA' && slowType === 'SMA' ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    📊 Tout en SMA (MA)
                  </button>
                  <button 
                    onClick={() => { setFastType('EMA'); setMedType('SMA'); setSlowType('SMA'); }}
                    style={{ background: fastType === 'EMA' && medType === 'SMA' && slowType === 'SMA' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)', border: fastType === 'EMA' && medType === 'SMA' && slowType === 'SMA' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🎯 Hybride (EMA/SMA)
                  </button>
                </div>
              </div>

              {/* Les 3 Moyennes Mobiles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>LES 3 COURBES DE MOYENNES MOBILES</span>

                {/* MA 1 (Rapide - Vert) */}
                <div style={{ background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#00ff88' }}>
                    <input type="checkbox" checked={showFastMA} onChange={(e) => setShowFastMA(e.target.checked)} style={{ accentColor: '#00ff88' }} />
                    MA 1 (Rapide)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select value={fastType} onChange={(e) => setFastType(e.target.value)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '5px 10px', borderRadius: '4px', outline: 'none', fontSize: '0.82rem' }}>
                      <option value="EMA">EMA</option>
                      <option value="SMA">SMA (MA)</option>
                      <option value="WMA">WMA</option>
                      <option value="HMA">HMA</option>
                    </select>
                    <input type="number" value={fastLen} onChange={(e) => setFastLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '5px 10px', borderRadius: '4px', outline: 'none', width: '75px', fontSize: '0.82rem' }} />
                  </div>
                </div>

                {/* MA 2 (Moyenne - Jaune / Or) */}
                <div style={{ background: 'rgba(250, 204, 21, 0.05)', border: '1px solid rgba(250, 204, 21, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#facc15' }}>
                    <input type="checkbox" checked={showMedMA} onChange={(e) => setShowMedMA(e.target.checked)} style={{ accentColor: '#facc15' }} />
                    MA 2 (Moyenne)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select value={medType} onChange={(e) => setMedType(e.target.value)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '5px 10px', borderRadius: '4px', outline: 'none', fontSize: '0.82rem' }}>
                      <option value="EMA">EMA</option>
                      <option value="SMA">SMA (MA)</option>
                      <option value="WMA">WMA</option>
                      <option value="HMA">HMA</option>
                    </select>
                    <input type="number" value={medLen} onChange={(e) => setMedLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '5px 10px', borderRadius: '4px', outline: 'none', width: '75px', fontSize: '0.82rem' }} />
                  </div>
                </div>

                {/* MA 3 (Lente - Rouge) */}
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#ef4444' }}>
                    <input type="checkbox" checked={showSlowMA} onChange={(e) => setShowSlowMA(e.target.checked)} style={{ accentColor: '#ef4444' }} />
                    MA 3 (Lente)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select value={slowType} onChange={(e) => setSlowType(e.target.value)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '5px 10px', borderRadius: '4px', outline: 'none', fontSize: '0.82rem' }}>
                      <option value="EMA">EMA</option>
                      <option value="SMA">SMA (MA)</option>
                      <option value="WMA">WMA</option>
                      <option value="HMA">HMA</option>
                    </select>
                    <input type="number" value={slowLen} onChange={(e) => setSlowLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '5px 10px', borderRadius: '4px', outline: 'none', width: '75px', fontSize: '0.82rem' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>ADX FILTER</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={useADXFilter} onChange={(e) => setUseADXFilter(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Filter Crosses with ADX
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Min ADX Strength</span>
                  <input type="number" value={adxMin} onChange={(e) => setAdxMin(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>VISUALS</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showCloudFill} onChange={(e) => setShowCloudFill(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  MA Cloud (Fill entre MA 1 & MA 3)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showBgColor} onChange={(e) => setShowBgColor(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Background Color
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showTrendLabel} onChange={(e) => setShowTrendLabel(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Show Trend Label
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showGcDcMarkers} onChange={(e) => setShowGcDcMarkers(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Golden / Death Cross Markers
                </label>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMaSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 2. MODALE ADX PRO */}
      {showAdxSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>ADX PRO Settings</h3>
              <button onClick={() => setShowAdxSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>ADX / DMI SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>DI Length</span>
                  <input type="number" value={diLen} onChange={(e) => setDiLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>ADX Smoothing</span>
                  <input type="number" value={adxSmoothLen} onChange={(e) => setAdxSmoothLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Strong Trend Threshold</span>
                  <input type="number" value={adxTrendThreshold} onChange={(e) => setAdxTrendThreshold(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>VISUALS</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showAdxHist} onChange={(e) => setShowAdxHist(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  DI Difference Histogram
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showAdxBg} onChange={(e) => setShowAdxBg(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Background (Strong Trend)
                </label>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdxSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 3. MODALE ICHIMOKU CLOUD PRO */}
      {showIchimokuSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>Ichimoku Cloud Settings</h3>
              <button onClick={() => setShowIchimokuSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px', textTransform: 'uppercase' }}>ICHIMOKU SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#d1d4dc' }}>Conversion (Tenkan)</span>
                  <input type="number" value={convLen} onChange={(e) => setConvLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#d1d4dc' }}>Base (Kijun)</span>
                  <input type="number" value={baseLen} onChange={(e) => setBaseLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#d1d4dc' }}>Span B Length</span>
                  <input type="number" value={spanBLen} onChange={(e) => setSpanBLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#d1d4dc' }}>Displacement</span>
                  <input type="number" value={disp} onChange={(e) => setDisp(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px', textTransform: 'uppercase' }}>VISUALS</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: '#d1d4dc' }}>
                  <input type="checkbox" checked={showChikou} onChange={(e) => setShowChikou(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Show Chikou
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: '#d1d4dc' }}>
                  <input type="checkbox" checked={showIchimokuBg} onChange={(e) => setShowIchimokuBg(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Background
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: '#d1d4dc' }}>
                  <input type="checkbox" checked={showIchimokuFill} onChange={(e) => setShowIchimokuFill(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Cloud Fill
                </label>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowIchimokuSettingsModal(false)} style={{ background: 'transparent', color: '#d1d4dc', border: '1px solid #434651', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => setShowIchimokuSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 4. MODALE STC PRO */}
      {showStcSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>STC PRO Settings</h3>
              <button onClick={() => setShowStcSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>STC SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Fast Length</span>
                  <input type="number" value={stcFastLen} onChange={(e) => setStcFastLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Slow Length</span>
                  <input type="number" value={stcSlowLen} onChange={(e) => setStcSlowLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Cycle Length</span>
                  <input type="number" value={stcCycleLen} onChange={(e) => setStcCycleLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Overbought Level</span>
                  <input type="number" value={stcObLevel} onChange={(e) => setStcObLevel(parseInt(e.target.value) || 75)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Oversold Level</span>
                  <input type="number" value={stcOsLevel} onChange={(e) => setStcOsLevel(parseInt(e.target.value) || 25)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowStcSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 5. MODALE DONCHIAN CHANNEL PRO */}
      {showDonchianSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>Donchian Channel Settings</h3>
              <button onClick={() => setShowDonchianSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Length</span>
                  <input type="number" value={donchianLen} onChange={(e) => setDonchianLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={donchianUseBody} onChange={(e) => setDonchianUseBody(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Use Close (instead of High/Low)
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>VISUALS</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showDonchianMid} onChange={(e) => setShowDonchianMid(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Show Mid Line
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showDonchianFill} onChange={(e) => setShowDonchianFill(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Channel Fill
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showDonchianBg} onChange={(e) => setShowDonchianBg(e.target.checked)} style={{ accentColor: '#2962ff' }} />
                  Background (Breakouts)
                </label>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDonchianSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 6. MODALE RSI PRO */}
      {showRsiSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>RSI PRO Settings</h3>
              <button onClick={() => setShowRsiSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>RSI SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>RSI Length</span>
                  <input type="number" value={rsiLen} onChange={(e) => setRsiLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Overbought Level</span>
                  <input type="number" value={rsiObLevel} onChange={(e) => setRsiObLevel(parseInt(e.target.value) || 70)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Oversold Level</span>
                  <input type="number" value={rsiOsLevel} onChange={(e) => setRsiOsLevel(parseInt(e.target.value) || 30)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRsiSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 7. MODALE MFI PRO */}
      {showMfiSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>MFI PRO Settings</h3>
              <button onClick={() => setShowMfiSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>MFI SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>MFI Length</span>
                  <input type="number" value={mfiLen} onChange={(e) => setMfiLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Overbought Level</span>
                  <input type="number" value={mfiObLevel} onChange={(e) => setMfiObLevel(parseInt(e.target.value) || 80)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Oversold Level</span>
                  <input type="number" value={mfiOsLevel} onChange={(e) => setMfiOsLevel(parseInt(e.target.value) || 20)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMfiSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 8. MODALE WAVETREND PRO */}
      {showWtSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>WaveTrend PRO Settings</h3>
              <button onClick={() => setShowWtSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>WAVETREND SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Channel Length (N1)</span>
                  <input type="number" value={wtN1} onChange={(e) => setWtN1(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Average Length (N2)</span>
                  <input type="number" value={wtN2} onChange={(e) => setWtN2(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowWtSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 9. MODALE %B PRO */}
      {showBPercentSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>Bollinger %B Settings</h3>
              <button onClick={() => setShowBPercentSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>BOLLINGER BANDS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Length</span>
                  <input type="number" value={bPercentLen} onChange={(e) => setBPercentLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Multiplier</span>
                  <input type="number" step="0.1" value={bPercentMult} onChange={(e) => setBPercentMult(Math.max(0.1, parseFloat(e.target.value) || 2.0))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBPercentSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 10. MODALE ATR% PRO */}
      {showAtrSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>ATR% PRO Settings</h3>
              <button onClick={() => setShowAtrSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>ATR Length</span>
                  <input type="number" value={atrLen} onChange={(e) => setAtrLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>ATR SMA Length</span>
                  <input type="number" value={atrAvgLen} onChange={(e) => setAtrAvgLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Rank Lookback</span>
                  <input type="number" value={atrRankLen} onChange={(e) => setAtrRankLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAtrSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 11. MODALE TTM SQUEEZE PRO */}
      {showTtmSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>TTM Squeeze PRO Settings</h3>
              <button onClick={() => setShowTtmSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>BB Length</span>
                  <input type="number" value={ttmBbLen} onChange={(e) => setTtmBbLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>BB Mult</span>
                  <input type="number" step="0.1" value={ttmBbMult} onChange={(e) => setTtmBbMult(Math.max(0.1, parseFloat(e.target.value) || 2.0))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>KC Length</span>
                  <input type="number" value={ttmKcLen} onChange={(e) => setTtmKcLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>KC Mult</span>
                  <input type="number" step="0.1" value={ttmKcMult} onChange={(e) => setTtmKcMult(Math.max(0.1, parseFloat(e.target.value) || 1.5))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTtmSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 12. MODALE CMF PRO */}
      {showCmfSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>CMF PRO Settings</h3>
              <button onClick={() => setShowCmfSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>CMF SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>CMF Length</span>
                  <input type="number" value={cmfLen} onChange={(e) => setCmfLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Strong Flow Level</span>
                  <input type="number" step="0.05" value={cmfStrong} onChange={(e) => setCmfStrong(parseFloat(e.target.value) || 0.2)} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCmfSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 13. MODALE PVT PRO */}
      {showPvtSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>PVT PRO Settings</h3>
              <button onClick={() => setShowPvtSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>PVT SETTINGS</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Signal Length (EMA)</span>
                  <input type="number" value={pvtSigLen} onChange={(e) => setPvtSigLen(Math.max(1, parseInt(e.target.value) || 1))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPvtSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ 14. MODALE VOLUME PROFILE PRO */}
      {showVpSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#131722', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '460px', color: '#d1d4dc', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>Volume Profile Settings</h3>
              <button onClick={() => setShowVpSettingsModal(false)} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#787b86', letterSpacing: '0.5px' }}>VOLUME PROFILE (VPVR / VPFR)</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Lookback Bars</span>
                  <input type="number" value={vpLookback} onChange={(e) => setVpLookback(Math.max(10, parseInt(e.target.value) || 200))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Number of Rows (Bins)</span>
                  <input type="number" value={vpRows} onChange={(e) => setVpRows(Math.max(5, parseInt(e.target.value) || 24))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Value Area %</span>
                  <input type="number" value={vpVaPercent} onChange={(e) => setVpVaPercent(Math.max(10, parseInt(e.target.value) || 70))} style={{ background: '#1e222d', border: '1px solid #434651', color: '#fff', padding: '6px 12px', borderRadius: '4px', outline: 'none', width: '100px' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowVpSettingsModal(false)} style={{ background: '#2962ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Ok</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
