/**
 * BTC VOLUME INDICATORS PRO
 * Module de calcul mathématique exact pour la 4ème famille VOLUME (CMF PRO, etc.)
 */

/**
 * 1️⃣ CMF PRO (Chaikin Money Flow + Niveaux Strong + Divergences Pivots + CMF MA)
 */
export function calculateCMFPro(candles, options = {}) {
  const {
    len = 20,
    strong = 0.2,
    showMA = false,
    maLen = 10,
    showDiv = true,
    lbR = 5,
    lbL = 5,
    showBG = true
  } = options;

  if (!candles || candles.length < len + 1) {
    return {
      cmfSeries: [],
      maSeries: [],
      bullDivs: [],
      bearDivs: [],
      curCMF: 0.10,
      zone: 'BULL FLOW',
      isBull: true
    };
  }

  const n = candles.length;
  const times = candles.map(c => c.time);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume || 1);

  const mfv = [];
  for (let i = 0; i < n; i++) {
    const hl = highs[i] - lows[i];
    const mfm = hl === 0 ? 0.0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / hl;
    mfv.push(mfm * volumes[i]);
  }

  const cmfValues = new Array(n).fill(null);
  const cmfSeries = [];

  for (let i = len - 1; i < n; i++) {
    let sumMFV = 0;
    let sumVol = 0;
    for (let j = 0; j < len; j++) {
      sumMFV += mfv[i - j];
      sumVol += volumes[i - j];
    }
    const val = sumVol === 0 ? 0 : sumMFV / sumVol;
    cmfValues[i] = val;

    let color;
    if (val >= strong) color = '#22c55e'; // Lime / Strong Bull
    else if (val <= -strong) color = '#ef4444'; // Red / Strong Bear
    else if (val > 0) color = '#15803d'; // Green
    else color = '#881337'; // Maroon

    cmfSeries.push({
      time: times[i],
      value: parseFloat(val.toFixed(3)),
      color
    });
  }

  // CMF MA (SMA maLen)
  const maSeries = [];
  for (let i = len - 1 + maLen - 1; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < maLen; j++) sum += cmfValues[i - j];
    maSeries.push({
      time: times[i],
      value: parseFloat((sum / maLen).toFixed(3))
    });
  }

  // Divergences Pivots (Lookback Left / Right)
  const bullDivs = [];
  const bearDivs = [];

  const pivotLows = [];
  const pivotHighs = [];

  for (let i = lbL; i < n - lbR; i++) {
    const curVal = cmfValues[i];
    if (curVal === null) continue;

    // Pivot Low
    let isPL = true;
    for (let j = i - lbL; j <= i + lbR; j++) {
      if (j !== i && cmfValues[j] !== null && cmfValues[j] <= curVal) {
        isPL = false;
        break;
      }
    }
    if (isPL) pivotLows.push({ index: i, time: times[i], cmf: curVal, priceLow: lows[i] });

    // Pivot High
    let isPH = true;
    for (let j = i - lbL; j <= i + lbR; j++) {
      if (j !== i && cmfValues[j] !== null && cmfValues[j] >= curVal) {
        isPH = false;
        break;
      }
    }
    if (isPH) pivotHighs.push({ index: i, time: times[i], cmf: curVal, priceHigh: highs[i] });
  }

  // Detect Bullish Divergences
  for (let k = 1; k < pivotLows.length; k++) {
    const prev = pivotLows[k - 1];
    const curr = pivotLows[k];
    if (curr.index - prev.index <= 60) {
      if (curr.priceLow < prev.priceLow && curr.cmf > prev.cmf) {
        bullDivs.push({ time: curr.time, value: curr.cmf });
      }
    }
  }

  // Detect Bearish Divergences
  for (let k = 1; k < pivotHighs.length; k++) {
    const prev = pivotHighs[k - 1];
    const curr = pivotHighs[k];
    if (curr.index - prev.index <= 60) {
      if (curr.priceHigh > prev.priceHigh && curr.cmf < prev.cmf) {
        bearDivs.push({ time: curr.time, value: curr.cmf });
      }
    }
  }

  const curCMF = cmfValues[n - 1] !== null ? parseFloat(cmfValues[n - 1].toFixed(2)) : 0.10;
  const isBull = curCMF > 0;
  const zone = curCMF >= strong 
    ? `STRONG BULL FLOW (> +${strong})` 
    : curCMF <= -strong 
    ? `STRONG BEAR FLOW (< -${strong})` 
    : curCMF > 0 
    ? 'BULL FLOW (Positif)' 
    : 'BEAR FLOW (Négatif)';

  return {
    len,
    strong,
    showMA,
    maLen,
    showDiv,
    lbR,
    lbL,
    showBG,
    cmfSeries,
    maSeries,
    bullDivs,
    bearDivs,
    curCMF,
    zone,
    isBull
  };
}


/**
 * 2️⃣ PVT PRO (Price Volume Trend + Signal EMA + Oscillator Mode + Divergences)
 */
export function calculatePVTPro(candles, options = {}) {
  const {
    sigLen = 21,
    showSig = true,
    useOsc = false,
    showDiv = true,
    lbR = 5,
    lbL = 5,
    showBG = true
  } = options;

  if (!candles || candles.length < 2) {
    return {
      pvtSeries: [],
      sigSeries: [],
      bullDivs: [],
      bearDivs: [],
      curPVT: 0,
      curSig: 0,
      curOsc: 0,
      isBull: true,
      zone: 'BULL TREND (Au-dessus Signal)'
    };
  }

  const n = candles.length;
  const times = candles.map(c => c.time);
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume || 1);

  // PVT Cumulative Calculation
  const pvt = new Array(n).fill(0);
  pvt[0] = 0;

  for (let i = 1; i < n; i++) {
    const prevC = closes[i - 1];
    const curC = closes[i];
    const v = volumes[i];
    const change = prevC === 0 ? 0 : (curC - prevC) / prevC;
    pvt[i] = pvt[i - 1] + (v * change);
  }

  // Signal Line (EMA of PVT)
  const k = 2 / (sigLen + 1);
  const sig = new Array(n).fill(0);
  sig[0] = pvt[0];
  for (let i = 1; i < n; i++) {
    sig[i] = pvt[i] * k + sig[i - 1] * (1 - k);
  }

  const osc = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    osc[i] = pvt[i] - sig[i];
  }

  const pvtSeries = [];
  const sigSeries = [];
  const showVal = useOsc ? osc : pvt;

  for (let i = 0; i < n; i++) {
    const val = showVal[i];
    const isAbove = useOsc ? val >= 0 : pvt[i] >= sig[i];
    const color = isAbove ? '#0d9488' : '#ef4444'; // Teal vs Red

    pvtSeries.push({
      time: times[i],
      value: parseFloat(val.toFixed(1)),
      color
    });

    if (showSig && !useOsc) {
      sigSeries.push({
        time: times[i],
        value: parseFloat(sig[i].toFixed(1))
      });
    }
  }

  // Divergences Pivots
  const bullDivs = [];
  const bearDivs = [];
  const pivotLows = [];
  const pivotHighs = [];

  for (let i = lbL; i < n - lbR; i++) {
    const curVal = showVal[i];

    let isPL = true;
    for (let j = i - lbL; j <= i + lbR; j++) {
      if (j !== i && showVal[j] <= curVal) {
        isPL = false;
        break;
      }
    }
    if (isPL) pivotLows.push({ index: i, time: times[i], val: curVal, priceLow: lows[i] });

    let isPH = true;
    for (let j = i - lbL; j <= i + lbR; j++) {
      if (j !== i && showVal[j] >= curVal) {
        isPH = false;
        break;
      }
    }
    if (isPH) pivotHighs.push({ index: i, time: times[i], val: curVal, priceHigh: highs[i] });
  }

  for (let k = 1; k < pivotLows.length; k++) {
    const prev = pivotLows[k - 1];
    const curr = pivotLows[k];
    if (curr.index - prev.index <= 60 && curr.priceLow < prev.priceLow && curr.val > prev.val) {
      bullDivs.push({ time: curr.time, value: curr.val });
    }
  }

  for (let k = 1; k < pivotHighs.length; k++) {
    const prev = pivotHighs[k - 1];
    const curr = pivotHighs[k];
    if (curr.index - prev.index <= 60 && curr.priceHigh > prev.priceHigh && curr.val < prev.val) {
      bearDivs.push({ time: curr.time, value: curr.val });
    }
  }

  const lastPVT = parseFloat(pvt[n - 1].toFixed(1));
  const lastSig = parseFloat(sig[n - 1].toFixed(1));
  const lastOsc = parseFloat(osc[n - 1].toFixed(1));
  const isBull = lastPVT >= lastSig;

  return {
    sigLen,
    showSig,
    useOsc,
    showDiv,
    lbR,
    lbL,
    showBG,
    pvtSeries,
    sigSeries,
    bullDivs,
    bearDivs,
    curPVT: lastPVT,
    curSig: lastSig,
    curOsc: lastOsc,
    isBull,
    zone: isBull ? 'BULL TREND (PVT >= Signal)' : 'BEAR TREND (PVT < Signal)'
  };
}


/**
 * 3️⃣ Volume Profile PRO (VPVR / VPFR + POC Line + Value Area 70% + Bins)
 */
export function calculateVolumeProfilePro(candles, options = {}) {
  const {
    lookback = 200,
    rows = 24,
    vaPercent = 70,
    profileWidth = 30,
    upColor = 'rgba(13, 148, 136, 0.45)', // Teal
    vaColor = 'rgba(37, 99, 235, 0.65)',   // Blue
    pocColor = '#ef4444'                  // Red
  } = options;

  if (!candles || candles.length < 5) {
    return {
      bins: [],
      pocPrice: 0,
      vahPrice: 0,
      valPrice: 0,
      totalVol: 0,
      maxVol: 0,
      lookback: 200,
      isAbovePOC: true,
      isInsideVA: true
    };
  }

  const lb = Math.min(lookback, candles.length);
  const sub = candles.slice(candles.length - lb);

  let highest = -Infinity;
  let lowest = Infinity;
  sub.forEach(c => {
    if (c.high > highest) highest = c.high;
    if (c.low < lowest) lowest = c.low;
  });

  const step = (highest - lowest) / rows;
  const binVol = new Array(rows).fill(0);

  for (let i = 0; i < lb; i++) {
    const c = sub[i];
    const barMid = (c.high + c.low) / 2;
    let binIdx = Math.floor((barMid - lowest) / step);
    binIdx = Math.max(0, Math.min(rows - 1, binIdx));
    binVol[binIdx] += (c.volume || 1);
  }

  let maxVol = 0;
  let pocIdx = 0;
  let totalVol = 0;

  for (let i = 0; i < rows; i++) {
    totalVol += binVol[i];
    if (binVol[i] > maxVol) {
      maxVol = binVol[i];
      pocIdx = i;
    }
  }

  // Value Area calculation (expand outward from POC)
  const vaTarget = totalVol * (vaPercent / 100);
  let vaVol = binVol[pocIdx];
  let upIdx = pocIdx;
  let downIdx = pocIdx;

  while (vaVol < vaTarget && (upIdx < rows - 1 || downIdx > 0)) {
    const upNext = upIdx < rows - 1 ? binVol[upIdx + 1] : -1;
    const downNext = downIdx > 0 ? binVol[downIdx - 1] : -1;
    if (upNext >= downNext) {
      upIdx++;
      vaVol += Math.max(upNext, 0);
    } else {
      downIdx--;
      vaVol += Math.max(downNext, 0);
    }
  }

  const bins = [];
  for (let i = 0; i < rows; i++) {
    const binLow = lowest + step * i;
    const binHigh = binLow + step;
    const vol = binVol[i];
    const inVA = i >= downIdx && i <= upIdx;
    const isPOC = i === pocIdx;
    const col = isPOC ? pocColor : (inVA ? vaColor : upColor);

    bins.push({
      index: i,
      binLow,
      binHigh,
      vol,
      ratio: maxVol > 0 ? vol / maxVol : 0,
      inVA,
      isPOC,
      color: col
    });
  }

  const pocPrice = parseFloat((lowest + step * pocIdx + step / 2).toFixed(1));
  const vahPrice = parseFloat((lowest + step * (upIdx + 1)).toFixed(1));
  const valPrice = parseFloat((lowest + step * downIdx).toFixed(1));
  const currentPrice = candles[candles.length - 1].close;

  const isAbovePOC = currentPrice >= pocPrice;
  const isInsideVA = currentPrice >= valPrice && currentPrice <= vahPrice;

  return {
    lookback: lb,
    rows,
    vaPercent,
    profileWidth,
    highest,
    lowest,
    step,
    bins,
    pocPrice,
    vahPrice,
    valPrice,
    totalVol,
    maxVol,
    pocIdx,
    upIdx,
    downIdx,
    isAbovePOC,
    isInsideVA,
    startCandleTime: sub[0].time,
    endCandleTime: sub[sub.length - 1].time
  };
}
