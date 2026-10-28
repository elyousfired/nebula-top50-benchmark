/**
 * BTC MOMENTUM INDICATORS PRO
 * Module de calcul mathématique exact pour la famille MOMENTUM (Wilder RSI PRO, MFI PRO, WaveTrend PRO, etc.)
 */

/**
 * 1️⃣ RSI PRO (Wilder RMA + Niveaux Sur-Achat/Sur-Vente + Divergences Pivots)
 */
export function calculateRSIPro(candles, options = {}) {
  const {
    len = 14,
    obLevel = 70,
    osLevel = 30,
    showMA = false,
    maLen = 14,
    showDiv = true,
    lbR = 5,
    lbL = 5,
    showBG = true
  } = options;

  if (!candles || candles.length < len + 1) {
    return {
      rsiSeries: [],
      maSeries: [],
      bullSignals: [],
      bearSignals: [],
      bullDivs: [],
      bearDivs: [],
      curRSI: 50,
      zone: 'NEUTRE',
      isBull: true
    };
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const times = candles.map(c => c.time);
  const n = closes.length;

  const gains = [0];
  const losses = [0];
  for (let i = 1; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }

  // RMA (Wilder)
  const rmaGains = new Array(n).fill(0);
  const rmaLosses = new Array(n).fill(0);
  const alpha = 1 / len;

  let sumG = 0, sumL = 0;
  for (let i = 1; i <= len; i++) {
    sumG += gains[i];
    sumL += losses[i];
  }
  rmaGains[len] = sumG / len;
  rmaLosses[len] = sumL / len;

  for (let i = len + 1; i < n; i++) {
    rmaGains[i] = alpha * gains[i] + (1 - alpha) * rmaGains[i - 1];
    rmaLosses[i] = alpha * losses[i] + (1 - alpha) * rmaLosses[i - 1];
  }

  const rsiValues = new Array(n).fill(null);
  const rsiSeries = [];

  for (let i = len; i < n; i++) {
    const g = rmaGains[i];
    const l = rmaLosses[i];
    let val = 50;
    if (l === 0) val = 100;
    else if (g === 0) val = 0;
    else {
      const rs = g / l;
      val = 100 - (100 / (1 + rs));
    }
    rsiValues[i] = val;
    rsiSeries.push({ time: times[i], value: parseFloat(val.toFixed(2)) });
  }

  // RSI MA (SMA)
  const maSeries = [];
  if (showMA) {
    for (let i = len + maLen - 1; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < maLen; j++) sum += (rsiValues[i - j] || 50);
      maSeries.push({ time: times[i], value: parseFloat((sum / maLen).toFixed(2)) });
    }
  }

  // Crosses
  const bullSignals = [];
  const bearSignals = [];
  for (let i = len + 1; i < n; i++) {
    const prev = rsiValues[i - 1];
    const cur = rsiValues[i];
    if (prev !== null && cur !== null) {
      if (prev <= osLevel && cur > osLevel) bullSignals.push({ time: times[i], value: cur });
      if (prev >= obLevel && cur < obLevel) bearSignals.push({ time: times[i], value: cur });
    }
  }

  // Pivot Divergences
  const bullDivs = [];
  const bearDivs = [];

  const pivotLows = [];
  const pivotHighs = [];

  for (let i = lbL + lbR; i < n; i++) {
    const pivotIdx = i - lbR;
    const pivotRsi = rsiValues[pivotIdx];
    if (pivotRsi === null) continue;

    // Check Pivot Low
    let isPL = true;
    for (let l = 1; l <= lbL; l++) {
      if (rsiValues[pivotIdx - l] === null || rsiValues[pivotIdx - l] <= pivotRsi) { isPL = false; break; }
    }
    if (isPL) {
      for (let r = 1; r <= lbR; r++) {
        if (rsiValues[pivotIdx + r] === null || rsiValues[pivotIdx + r] <= pivotRsi) { isPL = false; break; }
      }
    }
    if (isPL) {
      const curPLPrice = lows[pivotIdx];
      const curPLRsi = pivotRsi;
      if (pivotLows.length > 0) {
        const prevPL = pivotLows[pivotLows.length - 1];
        if (curPLPrice < prevPL.price && curPLRsi > prevPL.rsi) {
          bullDivs.push({ time: times[pivotIdx], value: curPLRsi });
        }
      }
      pivotLows.push({ idx: pivotIdx, time: times[pivotIdx], price: curPLPrice, rsi: curPLRsi });
    }

    // Check Pivot High
    let isPH = true;
    for (let l = 1; l <= lbL; l++) {
      if (rsiValues[pivotIdx - l] === null || rsiValues[pivotIdx - l] >= pivotRsi) { isPH = false; break; }
    }
    if (isPH) {
      for (let r = 1; r <= lbR; r++) {
        if (rsiValues[pivotIdx + r] === null || rsiValues[pivotIdx + r] >= pivotRsi) { isPH = false; break; }
      }
    }
    if (isPH) {
      const curPHPrice = highs[pivotIdx];
      const curPHRsi = pivotRsi;
      if (pivotHighs.length > 0) {
        const prevPH = pivotHighs[pivotHighs.length - 1];
        if (curPHPrice > prevPH.price && curPHRsi < prevPH.rsi) {
          bearDivs.push({ time: times[pivotIdx], value: curPHRsi });
        }
      }
      pivotHighs.push({ idx: pivotIdx, time: times[pivotIdx], price: curPHPrice, rsi: curPHRsi });
    }
  }

  const curRSI = rsiValues[n - 1] ? parseFloat(rsiValues[n - 1].toFixed(1)) : 50;
  const isBull = curRSI >= 50;
  const zone = curRSI >= obLevel ? 'SUR-ACHAT (Overbought)' : curRSI <= osLevel ? 'SUR-VENTE (Oversold)' : 'NEUTRE / TRANSITION';

  return {
    len,
    obLevel,
    osLevel,
    showMA,
    maLen,
    showDiv,
    lbR,
    lbL,
    showBG,
    rsiSeries,
    maSeries,
    bullSignals,
    bearSignals,
    bullDivs,
    bearDivs,
    curRSI,
    zone,
    isBull
  };
}

/**
 * 2️⃣ MFI PRO (Money Flow Index + Volume + Niveaux Sur-Achat/Sur-Vente + Divergences Pivots)
 */
export function calculateMFIPro(candles, options = {}) {
  const {
    len = 14,
    obLevel = 80,
    osLevel = 20,
    showDiv = true,
    lbR = 5,
    lbL = 5,
    showBG = true
  } = options;

  if (!candles || candles.length < len + 1) {
    return {
      mfiSeries: [],
      bullSignals: [],
      bearSignals: [],
      bullDivs: [],
      bearDivs: [],
      curMFI: 50,
      zone: 'NEUTRE',
      isBull: true
    };
  }

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume || 1);
  const times = candles.map(c => c.time);
  const n = closes.length;

  const tp = candles.map(c => (c.high + c.low + c.close) / 3);
  const mf = tp.map((t, i) => t * volumes[i]);

  const posMF = new Array(n).fill(0);
  const negMF = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    posMF[i] = tp[i] > tp[i - 1] ? mf[i] : 0;
    negMF[i] = tp[i] < tp[i - 1] ? mf[i] : 0;
  }

  const mfiValues = new Array(n).fill(null);
  const mfiSeries = [];

  for (let i = len; i < n; i++) {
    let sumPos = 0, sumNeg = 0;
    for (let j = 0; j < len; j++) {
      sumPos += posMF[i - j];
      sumNeg += negMF[i - j];
    }
    let val = 50;
    if (sumNeg === 0) val = 100;
    else {
      const mr = sumPos / sumNeg;
      val = 100 - (100 / (1 + mr));
    }
    mfiValues[i] = val;
    mfiSeries.push({ time: times[i], value: parseFloat(val.toFixed(2)) });
  }

  // Crosses
  const bullSignals = [];
  const bearSignals = [];
  for (let i = len + 1; i < n; i++) {
    const prev = mfiValues[i - 1];
    const cur = mfiValues[i];
    if (prev !== null && cur !== null) {
      if (prev <= osLevel && cur > osLevel) bullSignals.push({ time: times[i], value: cur });
      if (prev >= obLevel && cur < obLevel) bearSignals.push({ time: times[i], value: cur });
    }
  }

  // Pivot Divergences
  const bullDivs = [];
  const bearDivs = [];

  const pivotLows = [];
  const pivotHighs = [];

  for (let i = lbL + lbR; i < n; i++) {
    const pivotIdx = i - lbR;
    const pivotMfi = mfiValues[pivotIdx];
    if (pivotMfi === null) continue;

    // Check Pivot Low
    let isPL = true;
    for (let l = 1; l <= lbL; l++) {
      if (mfiValues[pivotIdx - l] === null || mfiValues[pivotIdx - l] <= pivotMfi) { isPL = false; break; }
    }
    if (isPL) {
      for (let r = 1; r <= lbR; r++) {
        if (mfiValues[pivotIdx + r] === null || mfiValues[pivotIdx + r] <= pivotMfi) { isPL = false; break; }
      }
    }
    if (isPL) {
      const curPLPrice = lows[pivotIdx];
      const curPLMfi = pivotMfi;
      if (pivotLows.length > 0) {
        const prevPL = pivotLows[pivotLows.length - 1];
        if (curPLPrice < prevPL.price && curPLMfi > prevPL.mfi) {
          bullDivs.push({ time: times[pivotIdx], value: curPLMfi });
        }
      }
      pivotLows.push({ idx: pivotIdx, time: times[pivotIdx], price: curPLPrice, mfi: curPLMfi });
    }

    // Check Pivot High
    let isPH = true;
    for (let l = 1; l <= lbL; l++) {
      if (mfiValues[pivotIdx - l] === null || mfiValues[pivotIdx - l] >= pivotMfi) { isPH = false; break; }
    }
    if (isPH) {
      for (let r = 1; r <= lbR; r++) {
        if (mfiValues[pivotIdx + r] === null || mfiValues[pivotIdx + r] >= pivotMfi) { isPH = false; break; }
      }
    }
    if (isPH) {
      const curPHPrice = highs[pivotIdx];
      const curPHMfi = pivotMfi;
      if (pivotHighs.length > 0) {
        const prevPH = pivotHighs[pivotHighs.length - 1];
        if (curPHPrice > prevPH.price && curPHMfi < prevPH.mfi) {
          bearDivs.push({ time: times[pivotIdx], value: curPHMfi });
        }
      }
      pivotHighs.push({ idx: pivotIdx, time: times[pivotIdx], price: curPHPrice, mfi: curPHMfi });
    }
  }

  const curMFI = mfiValues[n - 1] ? parseFloat(mfiValues[n - 1].toFixed(1)) : 50;
  const isBull = curMFI >= 50;
  const zone = curMFI >= obLevel ? 'SUR-ACHAT (Overbought)' : curMFI <= osLevel ? 'SUR-VENTE (Oversold)' : 'NEUTRE / TRANSITION';

  return {
    len,
    obLevel,
    osLevel,
    showDiv,
    lbR,
    lbL,
    showBG,
    mfiSeries,
    bullSignals,
    bearSignals,
    bullDivs,
    bearDivs,
    curMFI,
    zone,
    isBull
  };
}

/**
 * 3️⃣ WAVETREND PRO (Channel, Average, WT1, WT2, Vague & Signaux Extrêmes)
 */
export function calculateWaveTrendPro(candles, options = {}) {
  const {
    n1 = 10,
    n2 = 21,
    obLevel1 = 60,
    obLevel2 = 53,
    osLevel1 = -60,
    osLevel2 = -53,
    showSignals = true,
    showCross = false,
    showBG = true
  } = options;

  if (!candles || candles.length < n2 + 5) {
    return {
      wt1Series: [],
      wt2Series: [],
      waveSeries: [],
      buySignals: [],
      sellSignals: [],
      crossUpSignals: [],
      crossDnSignals: [],
      curWT1: 0,
      curWT2: 0,
      curWave: 0,
      zone: 'NEUTRE',
      isBull: true
    };
  }

  const n = candles.length;
  const times = candles.map(c => c.time);
  const ap = candles.map(c => (c.high + c.low + c.close) / 3);

  // EMA helper
  function calcEMA(arr, period) {
    const res = new Array(arr.length).fill(0);
    const k = 2 / (period + 1);
    res[0] = arr[0];
    for (let i = 1; i < arr.length; i++) {
      res[i] = arr[i] * k + res[i - 1] * (1 - k);
    }
    return res;
  }

  const esa = calcEMA(ap, n1);
  const diff = ap.map((val, i) => Math.abs(val - esa[i]));
  const dArr = calcEMA(diff, n1);
  const ci = ap.map((val, i) => dArr[i] === 0 ? 0 : (val - esa[i]) / (0.015 * dArr[i]));
  const tci = calcEMA(ci, n2);

  const wt1 = tci;
  const wt2 = new Array(n).fill(0);
  for (let i = 3; i < n; i++) {
    wt2[i] = (wt1[i] + wt1[i - 1] + wt1[i - 2] + wt1[i - 3]) / 4;
  }

  const wt1Series = [];
  const wt2Series = [];
  const waveSeries = [];

  const buySignals = [];
  const sellSignals = [];
  const crossUpSignals = [];
  const crossDnSignals = [];

  for (let i = 4; i < n; i++) {
    const val1 = parseFloat(wt1[i].toFixed(2));
    const val2 = parseFloat(wt2[i].toFixed(2));
    const wave = parseFloat((val1 - val2).toFixed(2));

    wt1Series.push({ time: times[i], value: val1 });
    wt2Series.push({ time: times[i], value: val2 });
    waveSeries.push({
      time: times[i],
      value: wave,
      color: wave >= 0 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
    });

    const prev1 = wt1[i - 1];
    const prev2 = wt2[i - 1];
    const cur1 = wt1[i];
    const cur2 = wt2[i];

    const isCrossUp = prev1 <= prev2 && cur1 > cur2;
    const isCrossDn = prev1 >= prev2 && cur1 < cur2;

    if (isCrossUp) {
      crossUpSignals.push({ time: times[i], value: val2 });
      if (val2 < osLevel1) {
        buySignals.push({ time: times[i], value: val2 });
      }
    }

    if (isCrossDn) {
      crossDnSignals.push({ time: times[i], value: val2 });
      if (val2 > obLevel1) {
        sellSignals.push({ time: times[i], value: val2 });
      }
    }
  }

  const curWT1 = parseFloat(wt1[n - 1].toFixed(1));
  const curWT2 = parseFloat(wt2[n - 1].toFixed(1));
  const curWave = parseFloat((curWT1 - curWT2).toFixed(1));

  const isBull = curWT1 >= curWT2;
  const zone = curWT1 >= obLevel1 ? 'SUR-ACHAT (Overbought)' : curWT1 <= osLevel1 ? 'SUR-VENTE (Oversold)' : 'NEUTRE / TRANSITION';

  return {
    n1,
    n2,
    obLevel1,
    obLevel2,
    osLevel1,
    osLevel2,
    showSignals,
    showCross,
    showBG,
    wt1Series,
    wt2Series,
    waveSeries,
    buySignals,
    sellSignals,
    crossUpSignals,
    crossDnSignals,
    curWT1,
    curWT2,
    curWave,
    zone,
    isBull
  };
}
