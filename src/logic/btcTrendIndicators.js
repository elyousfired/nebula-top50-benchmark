// src/logic/btcTrendIndicators.js
// Logique des 5 Indicateurs de Tendance (Trend Family) pour le Bitcoin

// ==========================================
// 1. MOVING AVERAGES & MA CROSS PRO
// ==========================================
export function calculateMA(data, length, type = 'EMA') {
  if (!data || data.length < length) return [];
  const closes = data.map(d => (typeof d === 'object' && d !== null ? d.close : d));
  const times  = data.map(d => (typeof d === 'object' && d !== null ? d.time  : 0));
  const results = [];

  switch (type) {
    case 'SMA': {
      for (let i = 0; i < closes.length; i++) {
        if (i < length - 1) continue;
        let sum = 0;
        for (let k = 0; k < length; k++) sum += closes[i - k];
        results.push({ time: times[i], value: parseFloat((sum / length).toFixed(2)) });
      }
      break;
    }
    case 'EMA':
    default: {
      const k = 2 / (length + 1);
      let ema = 0;
      for (let i = 0; i < closes.length; i++) {
        if (i < length - 1) {
          ema += closes[i];
          if (i === length - 2) ema = ema / (length - 1);
          continue;
        }
        if (results.length === 0) {
          let sum = 0;
          for (let j = 0; j < length; j++) sum += closes[i - j];
          ema = sum / length;
        } else {
          ema = (closes[i] * k) + (ema * (1 - k));
        }
        results.push({ time: times[i], value: parseFloat(ema.toFixed(2)) });
      }
      break;
    }
    case 'WMA': {
      const weightSum = (length * (length + 1)) / 2;
      for (let i = 0; i < closes.length; i++) {
        if (i < length - 1) continue;
        let weightedSum = 0;
        for (let k = 0; k < length; k++) {
          weightedSum += closes[i - k] * (length - k);
        }
        results.push({ time: times[i], value: parseFloat((weightedSum / weightSum).toFixed(2)) });
      }
      break;
    }
    case 'HMA': {
      const halfLen = Math.max(1, Math.floor(length / 2));
      const sqrtLen = Math.max(1, Math.floor(Math.sqrt(length)));
      const wmaHalf = calculateMA(data, halfLen, 'WMA');
      const wmaFull = calculateMA(data, length, 'WMA');
      
      const diffMap = new Map();
      wmaHalf.forEach(h => {
        const f = wmaFull.find(x => x.time === h.time);
        if (f) diffMap.set(h.time, (2 * h.value) - f.value);
      });

      const diffData = Array.from(diffMap.entries()).map(([time, close]) => ({ time, close }));
      return calculateMA(diffData, sqrtLen, 'WMA');
    }
  }

  return results;
}

export function calculateMACrossPro(candles, options = {}) {
  const {
    maType = 'EMA',
    fastLen = 50,
    medLen = 100,
    slowLen = 200,
    fastType = options.maType || 'EMA',
    medType = options.maType || 'SMA',
    slowType = options.maType || 'SMA',
    showFastMA = true,
    showMedMA = true,
    showSlowMA = true,
    useADX = false,
    adxMin = 20
  } = options;

  if (!candles || candles.length < Math.min(fastLen, slowLen)) {
    return {
      fastMA: [],
      medMA: [],
      slowMA: [],
      cloudFast: null,
      cloudSlow: null,
      adxSeries: [],
      goldenCrosses: [],
      deathCrosses: [],
      trendDir: 0,
      trendLabel: 'NEUTRAL',
      curFast: 0,
      curMed: 0,
      curSlow: 0,
      curADX: 25,
      cloudStatus: 'NEUTRAL',
      distancePct: 0,
      fastLen,
      medLen,
      slowLen,
      fastType,
      medType,
      slowType,
      showFastMA,
      showMedMA,
      showSlowMA,
      maType
    };
  }

  const fastMA = calculateMA(candles, fastLen, fastType);
  const medMA = calculateMA(candles, medLen, medType);
  const slowMA = calculateMA(candles, slowLen, slowType);
  const { adxSeries, curADX } = calculateADX(candles, 14);

  // 🎯 Sélection dynamique de la paire active pour le croisement & le nuage
  // Si Fast & Slow sont cochées (ex: 50 & 200) -> paire majeure classique (Golden / Death Cross)
  // Si l'utilisateur décoche une MA (ex: que 50 & 100, ou 100 & 200) -> croisement strict de ces 2 MAs visibles !
  let activeFastSeries = null;
  let activeSlowSeries = null;
  let pairLabel = '';

  if (showFastMA && showSlowMA) {
    activeFastSeries = fastMA;
    activeSlowSeries = slowMA;
    pairLabel = `${fastType} ${fastLen} / ${slowType} ${slowLen}`;
  } else if (showFastMA && showMedMA && !showSlowMA) {
    activeFastSeries = fastMA;
    activeSlowSeries = medMA;
    pairLabel = `${fastType} ${fastLen} / ${medType} ${medLen}`;
  } else if (!showFastMA && showMedMA && showSlowMA) {
    activeFastSeries = medMA;
    activeSlowSeries = slowMA;
    pairLabel = `${medType} ${medLen} / ${slowType} ${slowLen}`;
  }

  const goldenCrosses = [];
  const deathCrosses = [];
  let trendDir = 0;

  if (activeFastSeries && activeSlowSeries && activeFastSeries.length > 0 && activeSlowSeries.length > 0) {
    const slowMap = new Map();
    activeSlowSeries.forEach(s => slowMap.set(s.time, s.value));

    for (let i = 1; i < activeFastSeries.length; i++) {
      const t = activeFastSeries[i].time;
      const prevT = activeFastSeries[i - 1].time;

      const curFast = activeFastSeries[i].value;
      const prevFast = activeFastSeries[i - 1].value;

      const curSlow = slowMap.get(t);
      const prevSlow = slowMap.get(prevT);

      const adxOK = !useADX || curADX > adxMin;

      if (curSlow !== undefined && prevSlow !== undefined) {
        const isCrossover  = prevFast <= prevSlow && curFast > curSlow;
        const isCrossunder = prevFast >= prevSlow && curFast < curSlow;

        if (isCrossover && adxOK) {
          goldenCrosses.push({ 
            time: t, 
            price: curFast, 
            type: 'GC', 
            label: `★ GOLDEN CROSS * (${pairLabel})`,
            pair: pairLabel
          });
          trendDir = 1;
        } else if (isCrossunder && adxOK) {
          deathCrosses.push({ 
            time: t, 
            price: curFast, 
            type: 'DC', 
            label: `DEATH CROSS (${pairLabel})`,
            pair: pairLabel
          });
          trendDir = -1;
        } else {
          if (curFast > curSlow) trendDir = 1;
          else if (curFast < curSlow) trendDir = -1;
        }
      }
    }
  }

  const curFastVal = activeFastSeries && activeFastSeries.length > 0 ? activeFastSeries[activeFastSeries.length - 1].value : (fastMA.length > 0 ? fastMA[fastMA.length - 1].value : 0);
  const curMedVal  = medMA.length > 0 ? medMA[medMA.length - 1].value : 0;
  const curSlowVal = activeSlowSeries && activeSlowSeries.length > 0 ? activeSlowSeries[activeSlowSeries.length - 1].value : (slowMA.length > 0 ? slowMA[slowMA.length - 1].value : 0);
  const distancePct = curSlowVal > 0 ? parseFloat((((curFastVal - curSlowVal) / curSlowVal) * 100).toFixed(2)) : 0;

  const trendLabel = trendDir === 1 ? 'BULL TREND' : trendDir === -1 ? 'BEAR TREND' : 'NEUTRAL';
  const cloudStatus = curFastVal > curSlowVal ? 'BULLISH CLOUD (VERTE)' : 'BEARISH CLOUD (ROUGE)';

  return {
    fastMA,
    medMA,
    slowMA,
    cloudFast: activeFastSeries,
    cloudSlow: activeSlowSeries,
    adxSeries,
    goldenCrosses,
    deathCrosses,
    trendDir,
    trendLabel,
    curFast: curFastVal,
    curMed: curMedVal,
    curSlow: curSlowVal,
    curADX,
    cloudStatus,
    distancePct,
    fastLen,
    medLen,
    slowLen,
    fastType,
    medType,
    slowType,
    showFastMA,
    showMedMA,
    showSlowMA,
    maType
  };
}

// ==========================================
// 2. ADX PRO (Average Directional Index + DMI + Histogram)
// ==========================================
export function calculateADXPro(candles, options = {}) {
  const {
    diLen = 14,
    adxLen = 14,
    adxMin = 25,
    showHist = true,
    showBG = true
  } = options;

  if (!candles || candles.length < Math.max(diLen, adxLen) + 2) {
    return {
      adxSeries: [],
      plusDISeries: [],
      minusDISeries: [],
      histSeries: [],
      bullSignals: [],
      bearSignals: [],
      curADX: 25,
      curPlusDI: 20,
      curMinusDI: 20,
      curDiff: 0,
      diLen,
      adxLen,
      adxMin
    };
  }

  const tr = [];
  const plusDM = [];
  const minusDM = [];
  const times = [];

  for (let i = 1; i < candles.length; i++) {
    times.push(candles[i].time);
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;

    const currentTR = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    tr.push(currentTR);

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Smooth Wilder's
  const smoothedTR = [];
  const smoothedPlusDM = [];
  const smoothedMinusDM = [];

  let trSum = 0, plusSum = 0, minusSum = 0;
  for (let i = 0; i < diLen; i++) {
    trSum += tr[i];
    plusSum += plusDM[i];
    minusSum += minusDM[i];
  }
  smoothedTR.push(trSum);
  smoothedPlusDM.push(plusSum);
  smoothedMinusDM.push(minusSum);

  for (let i = diLen; i < tr.length; i++) {
    const lastTR = smoothedTR[smoothedTR.length - 1];
    const lastP  = smoothedPlusDM[smoothedPlusDM.length - 1];
    const lastM  = smoothedMinusDM[smoothedMinusDM.length - 1];

    smoothedTR.push(lastTR - (lastTR / diLen) + tr[i]);
    smoothedPlusDM.push(lastP - (lastP / diLen) + plusDM[i]);
    smoothedMinusDM.push(lastM - (lastM / diLen) + minusDM[i]);
  }

  const plusDISeries = [];
  const minusDISeries = [];
  const dxSeries = [];

  for (let i = 0; i < smoothedTR.length; i++) {
    const str = smoothedTR[i];
    const sp = smoothedPlusDM[i];
    const sm = smoothedMinusDM[i];

    const plusDI = str > 0 ? (sp / str) * 100 : 0;
    const minusDI = str > 0 ? (sm / str) * 100 : 0;
    const sumDI = plusDI + minusDI;
    const dx = sumDI > 0 ? (Math.abs(plusDI - minusDI) / sumDI) * 100 : 0;
    
    const time = times[diLen - 1 + i];
    if (time) {
      plusDISeries.push({ time, value: parseFloat(plusDI.toFixed(2)) });
      minusDISeries.push({ time, value: parseFloat(minusDI.toFixed(2)) });
    }
    dxSeries.push(dx);
  }

  // ADX Smoothing
  const adxSeries = [];
  let adxVal = 25;
  if (dxSeries.length >= adxLen) {
    let sum = 0;
    for (let i = 0; i < adxLen; i++) sum += dxSeries[i];
    adxVal = sum / adxLen;
    const t0 = times[diLen - 1 + adxLen - 1];
    if (t0) adxSeries.push({ time: t0, value: parseFloat(adxVal.toFixed(2)) });

    for (let i = adxLen; i < dxSeries.length; i++) {
      adxVal = ((adxVal * (adxLen - 1)) + dxSeries[i]) / adxLen;
      const t = times[diLen - 1 + i];
      if (t) adxSeries.push({ time: t, value: parseFloat(adxVal.toFixed(2)) });
    }
  }

  // DI Histogram (diDiff = diPlus - diMinus) & Signals
  const adxMap = new Map();
  adxSeries.forEach(a => adxMap.set(a.time, a.value));

  const minusMap = new Map();
  minusDISeries.forEach(m => minusMap.set(m.time, m.value));

  const histSeries = [];
  const bullSignals = [];
  const bearSignals = [];

  for (let i = 1; i < plusDISeries.length; i++) {
    const t = plusDISeries[i].time;
    const prevT = plusDISeries[i - 1].time;

    const curPlus = plusDISeries[i].value;
    const prevPlus = plusDISeries[i - 1].value;

    const curMinus = minusMap.get(t);
    const prevMinus = minusMap.get(prevT);

    const curADXVal = adxMap.get(t) || 20;

    if (curMinus !== undefined && prevMinus !== undefined) {
      const diDiff = parseFloat((curPlus - curMinus).toFixed(2));
      const isStrong = curADXVal > adxMin;

      const histColor = isStrong 
        ? (diDiff > 0 ? 'rgba(34, 197, 94, 0.75)' : 'rgba(239, 68, 68, 0.75)')
        : 'rgba(148, 163, 184, 0.4)';

      histSeries.push({
        time: t,
        value: diDiff,
        color: histColor
      });

      // Signals : crossover / crossunder
      const isCrossUp = prevPlus <= prevMinus && curPlus > curMinus;
      const isCrossDown = prevPlus >= prevMinus && curPlus < curMinus;

      if (isCrossUp && isStrong) {
        bullSignals.push({ time: t, price: curPlus, type: 'bull', label: 'ADX Bull' });
      } else if (isCrossDown && isStrong) {
        bearSignals.push({ time: t, price: curMinus, type: 'bear', label: 'ADX Bear' });
      }
    }
  }

  const curADX = adxSeries.length > 0 ? adxSeries[adxSeries.length - 1].value : 25;
  const curPlusDI = plusDISeries.length > 0 ? plusDISeries[plusDISeries.length - 1].value : 20;
  const curMinusDI = minusDISeries.length > 0 ? minusDISeries[minusDISeries.length - 1].value : 20;
  const curDiff = parseFloat((curPlusDI - curMinusDI).toFixed(2));

  return {
    adxSeries,
    plusDISeries,
    minusDISeries,
    histSeries,
    bullSignals,
    bearSignals,
    curADX,
    curPlusDI,
    curMinusDI,
    curDiff,
    diLen,
    adxLen,
    adxMin
  };
}

// Backward compatibility helper
export function calculateADX(candles, len = 14) {
  return calculateADXPro(candles, { diLen: len, adxLen: len, adxMin: 25 });
}

// ==========================================
// 3. ICHIMOKU PRO (Tenkan, Kijun, Cloud, Chikou, TK Crosses)
// ==========================================
const WEEK_SEC = 7 * 24 * 60 * 60;

export function calculateIchimokuPro(candles, options = {}) {
  const {
    convLen = 9,
    baseLen = 26,
    spanBLen = 52,
    disp = 26,
    showChikou = true,
    showBG = true,
    showFill = true
  } = options;

  if (!candles || candles.length < spanBLen) {
    return {
      tenkan: [],
      kijun: [],
      spanA: [],
      spanB: [],
      chikou: [],
      tkBullSignals: [],
      tkBearSignals: [],
      curTenkan: 0,
      curKijun: 0,
      curSpanA: 0,
      curSpanB: 0,
      isAboveCloud: false,
      isBelowCloud: false,
      cloudState: 'NEUTRAL',
      convLen,
      baseLen,
      spanBLen,
      disp
    };
  }

  const getDonchianMid = (slice) => {
    let minL = Infinity, maxH = -Infinity;
    slice.forEach(c => {
      if (c.high > maxH) maxH = c.high;
      if (c.low < minL) minL = c.low;
    });
    return (maxH + minL) / 2;
  };

  const tenkan = [];
  const kijun = [];
  const rawSpanA = [];
  const rawSpanB = [];
  const spanA = [];
  const spanB = [];
  const chikou = [];
  const tkBullSignals = [];
  const tkBearSignals = [];

  const len = candles.length;

  for (let i = 0; i < len; i++) {
    const t = candles[i].time;

    // Tenkan-sen (Conversion Line)
    let curTVal = null;
    if (i >= convLen - 1) {
      curTVal = parseFloat(getDonchianMid(candles.slice(i - convLen + 1, i + 1)).toFixed(2));
      tenkan.push({ time: t, value: curTVal });
    }

    // Kijun-sen (Base Line)
    let curKVal = null;
    if (i >= baseLen - 1) {
      curKVal = parseFloat(getDonchianMid(candles.slice(i - baseLen + 1, i + 1)).toFixed(2));
      kijun.push({ time: t, value: curKVal });
    }

    // Raw Span A and Span B (avant décalage)
    if (curTVal !== null && curKVal !== null) {
      rawSpanA.push({ time: t, value: parseFloat(((curTVal + curKVal) / 2).toFixed(2)) });
    }

    if (i >= spanBLen - 1) {
      const bVal = parseFloat(getDonchianMid(candles.slice(i - spanBLen + 1, i + 1)).toFixed(2));
      rawSpanB.push({ time: t, value: bVal });
    }

    // Chikou Span (offset = -disp)
    if (showChikou && i >= disp) {
      chikou.push({ time: candles[i - disp].time, value: candles[i].close });
    }
  }

  // Appliquer le décalage (offset = +disp) pour Senkou Span A et Span B
  rawSpanA.forEach(p => {
    spanA.push({ time: p.time + disp * WEEK_SEC, value: p.value });
  });

  rawSpanB.forEach(p => {
    spanB.push({ time: p.time + disp * WEEK_SEC, value: p.value });
  });

  // Détection des croisements TK (Tenkan / Kijun)
  const kijunMap = new Map();
  kijun.forEach(k => kijunMap.set(k.time, k.value));

  for (let i = 1; i < tenkan.length; i++) {
    const t = tenkan[i].time;
    const prevT = tenkan[i - 1].time;

    const curT = tenkan[i].value;
    const prevTVal = tenkan[i - 1].value;

    const curK = kijunMap.get(t);
    const prevK = kijunMap.get(prevT);

    if (curK !== undefined && prevK !== undefined) {
      const isCrossUp = prevTVal <= prevK && curT > curK;
      const isCrossDown = prevTVal >= prevK && curT < curK;

      if (isCrossUp) {
        tkBullSignals.push({ time: t, price: curT, type: 'bull', label: 'TK' });
      } else if (isCrossDown) {
        tkBearSignals.push({ time: t, price: curT, type: 'bear', label: 'TK' });
      }
    }
  }

  const curTenkan = tenkan.length > 0 ? tenkan[tenkan.length - 1].value : 0;
  const curKijun = kijun.length > 0 ? kijun[kijun.length - 1].value : 0;
  const curSpanA = spanA.length > 0 ? spanA[spanA.length - 1].value : 0;
  const curSpanB = spanB.length > 0 ? spanB[spanB.length - 1].value : 0;

  const lastClose = candles[len - 1].close;
  const cloudTop = Math.max(curSpanA, curSpanB);
  const cloudBottom = Math.min(curSpanA, curSpanB);

  const isAboveCloud = lastClose > cloudTop;
  const isBelowCloud = lastClose < cloudBottom;
  const cloudState = isAboveCloud ? 'AU-DESSUS DU NUAGE (BULLISH)' : isBelowCloud ? 'EN-DESSOUS DU NUAGE (BEARISH)' : 'DANS LE NUAGE (NEUTRE / KUZURE)';

  return {
    tenkan,
    kijun,
    spanA,
    spanB,
    rawSpanA,
    rawSpanB,
    chikou,
    tkBullSignals,
    tkBearSignals,
    curTenkan,
    curKijun,
    curSpanA,
    curSpanB,
    isAboveCloud,
    isBelowCloud,
    cloudState,
    convLen,
    baseLen,
    spanBLen,
    disp
  };
}

export function calculateIchimoku(candles, tenkanLen = 9, kijunLen = 26, senkouBLen = 52) {
  return calculateIchimokuPro(candles, { convLen: tenkanLen, baseLen: kijunLen, spanBLen: senkouBLen, disp: 26 });
}

// ==========================================
// 4. SCHAFF TREND CYCLE PRO (STC PRO)
// ==========================================
export function calculateSTCPro(candles, options = {}) {
  const {
    fastLen = 23,
    slowLen = 50,
    cycleLen = 10,
    smooth1 = 3,
    smooth2 = 3,
    obLevel = 75,
    osLevel = 25
  } = options;

  if (!candles || candles.length < slowLen + cycleLen * 2 + smooth1 + smooth2) {
    return {
      stcSeries: [],
      bullSignals: [],
      bearSignals: [],
      curSTC: 50,
      zone: 'NEUTRAL',
      fastLen,
      slowLen,
      cycleLen,
      smooth1,
      smooth2,
      obLevel,
      osLevel
    };
  }

  // 1. MACD = EMA(fastLen) - EMA(slowLen)
  const fastEMA = calculateMA(candles, fastLen, 'EMA');
  const slowEMA = calculateMA(candles, slowLen, 'EMA');

  const slowMap = new Map();
  slowEMA.forEach(s => slowMap.set(s.time, s.value));

  const macd = [];
  fastEMA.forEach(f => {
    const s = slowMap.get(f.time);
    if (s !== undefined) {
      macd.push({ time: f.time, value: f.value - s });
    }
  });

  // 2. k1 = ta.stoch(macd, macd, macd, cycleLen)
  const k1 = [];
  for (let i = cycleLen - 1; i < macd.length; i++) {
    const slice = macd.slice(i - cycleLen + 1, i + 1);
    let minM = Infinity, maxM = -Infinity;
    slice.forEach(m => {
      if (m.value < minM) minM = m.value;
      if (m.value > maxM) maxM = m.value;
    });
    const denom = maxM - minM;
    const v = denom > 0 ? ((macd[i].value - minM) / denom) * 100 : 50;
    k1.push({ time: macd[i].time, value: v });
  }

  // 3. d1 = ta.sma(k1, smooth1)
  const d1 = [];
  for (let i = smooth1 - 1; i < k1.length; i++) {
    let sum = 0;
    for (let k = 0; k < smooth1; k++) sum += k1[i - k].value;
    d1.push({ time: k1[i].time, value: sum / smooth1 });
  }

  // 4. k2 = ta.stoch(d1, d1, d1, cycleLen)
  const k2 = [];
  for (let i = cycleLen - 1; i < d1.length; i++) {
    const slice = d1.slice(i - cycleLen + 1, i + 1);
    let minD = Infinity, maxD = -Infinity;
    slice.forEach(m => {
      if (m.value < minD) minD = m.value;
      if (m.value > maxD) maxD = m.value;
    });
    const denom = maxD - minD;
    const v = denom > 0 ? ((d1[i].value - minD) / denom) * 100 : 50;
    k2.push({ time: d1[i].time, value: v });
  }

  // 5. stc = ta.sma(k2, smooth2)
  const stcSeries = [];
  const bullSignals = [];
  const bearSignals = [];

  for (let i = smooth2 - 1; i < k2.length; i++) {
    let sum = 0;
    for (let k = 0; k < smooth2; k++) sum += k2[i - k].value;
    const finalVal = parseFloat((sum / smooth2).toFixed(2));
    const t = k2[i].time;

    let color = '#a855f7'; // Purple
    if (finalVal >= obLevel) color = '#ef4444'; // Red
    else if (finalVal <= osLevel) color = '#22c55e'; // Green

    stcSeries.push({ time: t, value: finalVal, color });
  }

  // Signaux : crossover(stc, osLevel) & crossunder(stc, obLevel)
  for (let i = 1; i < stcSeries.length; i++) {
    const prev = stcSeries[i - 1].value;
    const cur = stcSeries[i].value;
    const t = stcSeries[i].time;

    if (prev <= osLevel && cur > osLevel) {
      bullSignals.push({ time: t, price: cur, type: 'bull', label: 'STC Bull' });
    } else if (prev >= obLevel && cur < obLevel) {
      bearSignals.push({ time: t, price: cur, type: 'bear', label: 'STC Bear' });
    }
  }

  const curSTC = stcSeries.length > 0 ? stcSeries[stcSeries.length - 1].value : 50;
  const zone = curSTC >= obLevel ? 'SUR-ACHAT (CYCLE MATURE)' : curSTC <= osLevel ? 'SUR-VENTE (CYCLE BAS)' : 'TRANSITION NEUTRE';

  return {
    stcSeries,
    bullSignals,
    bearSignals,
    curSTC,
    zone,
    fastLen,
    slowLen,
    cycleLen,
    smooth1,
    smooth2,
    obLevel,
    osLevel
  };
}

export function calculateSTC(candles, fastLen = 23, slowLen = 50, cycleLen = 10, factor = 0.5) {
  return calculateSTCPro(candles, { fastLen, slowLen, cycleLen, smooth1: 3, smooth2: 3, obLevel: 75, osLevel: 25 });
}

// ==========================================
// 5. DONCHIAN CHANNEL PRO
// ==========================================
export function calculateDonchianPro(candles, options = {}) {
  const {
    length = 20,
    useBody = false,
    showMid = true,
    showFill = true,
    showBG = true
  } = options;

  if (!candles || candles.length < length) {
    return {
      upper: [],
      lower: [],
      middle: [],
      breakUpSignals: [],
      breakDownSignals: [],
      curUpper: 0,
      curLower: 0,
      curMid: 0,
      length,
      useBody
    };
  }

  const upper = [];
  const lower = [];
  const middle = [];
  const breakUpSignals = [];
  const breakDownSignals = [];

  for (let i = length - 1; i < candles.length; i++) {
    const slice = candles.slice(i - length + 1, i + 1);
    let maxH = -Infinity;
    let minL = Infinity;

    slice.forEach(c => {
      const h = useBody ? c.close : c.high;
      const l = useBody ? c.close : c.low;
      if (h > maxH) maxH = h;
      if (l < minL) minL = l;
    });

    const mid = (maxH + minL) / 2;
    const t = candles[i].time;

    upper.push({ time: t, value: parseFloat(maxH.toFixed(2)) });
    lower.push({ time: t, value: parseFloat(minL.toFixed(2)) });
    if (showMid) {
      middle.push({ time: t, value: parseFloat(mid.toFixed(2)) });
    }
  }

  // Breakout detection : crossover(close, upper[1]) & crossunder(close, lower[1])
  for (let i = 1; i < upper.length; i++) {
    const t = upper[i].time;
    const curClose = candles[length - 1 + i].close;
    const prevClose = candles[length - 1 + i - 1].close;

    const prevUpper = upper[i - 1].value;
    const prevLower = lower[i - 1].value;

    const isBreakUp = prevClose <= prevUpper && curClose > prevUpper;
    const isBreakDown = prevClose >= prevLower && curClose < prevLower;

    if (isBreakUp) {
      breakUpSignals.push({ time: t, price: curClose, type: 'bull', text: 'BO' });
    } else if (isBreakDown) {
      breakDownSignals.push({ time: t, price: curClose, type: 'bear', text: 'BD' });
    }
  }

  const curUpper = upper.length > 0 ? upper[upper.length - 1].value : 0;
  const curLower = lower.length > 0 ? lower[lower.length - 1].value : 0;
  const curMid = middle.length > 0 ? middle[middle.length - 1].value : (curUpper + curLower) / 2;

  return {
    upper,
    lower,
    middle,
    breakUpSignals,
    breakDownSignals,
    curUpper,
    curLower,
    curMid,
    length,
    useBody
  };
}

export function calculateDonchian(candles, len = 20) {
  return calculateDonchianPro(candles, { length: len, useBody: false, showMid: true, showFill: true, showBG: true });
}