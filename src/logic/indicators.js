// src/logic/indicators.js

export const calculateSMA = (data, length) => {
  if (data.length < length) return [];
  const sma = new Array(data.length).fill(0);
  for (let i = length - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < length; j++) {
      sum += data[i - j];
    }
    sma[i] = sum / length;
  }
  return sma;
};

export const calculateEMA = (data, length) => {
  if (data.length < length) return [];
  const k = 2 / (length + 1);
  const ema = new Array(data.length).fill(0);
  // Initial SMA
  let sum = 0;
  for (let i = 0; i < length; i++) sum += data[i];
  ema[length - 1] = sum / length;

  for (let i = length; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
};

export const calculateRMA = (data, length) => {
  if (data.length < length) return [];
  const rma = new Array(data.length).fill(0);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += data[i];
  rma[length - 1] = sum / length;
  const alpha = 1 / length;

  for (let i = length; i < data.length; i++) {
    rma[i] = alpha * data[i] + (1 - alpha) * rma[i - 1];
  }
  return rma;
};

export const calculateRSI = (data, length) => {
  if (data.length <= length) return [];
  const rsi = new Array(data.length).fill(0);
  let gains = [];
  let losses = [];
  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }

  // Prepend a 0 to match indices
  gains = [0, ...gains];
  losses = [0, ...losses];

  const avgGains = calculateRMA(gains, length);
  const avgLosses = calculateRMA(losses, length);

  for (let i = length; i < data.length; i++) {
    if (avgLosses[i] === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGains[i] / avgLosses[i];
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  return rsi;
};

export const calculateMACD = (data, fastLen, slowLen, sigLen) => {
  const fastEma = calculateEMA(data, fastLen);
  const slowEma = calculateEMA(data, slowLen);
  
  const macdLine = new Array(data.length).fill(0);
  for (let i = slowLen - 1; i < data.length; i++) {
    macdLine[i] = fastEma[i] - slowEma[i];
  }
  
  const signalLine = new Array(data.length).fill(0);
  const macdToSmooth = macdLine.slice(slowLen - 1);
  const sigEma = calculateEMA(macdToSmooth, sigLen);
  
  for (let i = 0; i < sigEma.length; i++) {
    signalLine[slowLen - 1 + i] = sigEma[i];
  }

  const hist = new Array(data.length).fill(0);
  for (let i = slowLen + sigLen - 2; i < data.length; i++) {
    hist[i] = macdLine[i] - signalLine[i];
  }

  return { macdLine, signalLine, hist };
};

export const calculateVWAP = (klines) => {
  // klines: {high, low, close, volume}
  const vwap = new Array(klines.length).fill(0);
  let cumVol = 0;
  let cumVolPrice = 0;
  
  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    const typPrice = (k.high + k.low + k.close) / 3;
    cumVol += k.volume;
    cumVolPrice += typPrice * k.volume;
    vwap[i] = cumVolPrice / cumVol;
  }
  // Note: Standard VWAP is daily reset, but TradingView's ta.vwap(close) 
  // without anchor is typically cumulative over the dataset or session.
  // We'll calculate a cumulative one, or session based. We'll use cumulative 
  // as it's the simplest equivalent if not anchored.
  return vwap;
};

export const calculateADX = (highs, lows, closes, length) => {
  const tr = new Array(closes.length).fill(0);
  const plusDM = new Array(closes.length).fill(0);
  const minusDM = new Array(closes.length).fill(0);

  for (let i = 1; i < closes.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const prevC = closes[i - 1];
    const prevH = highs[i - 1];
    const prevL = lows[i - 1];

    tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    
    const upMove = h - prevH;
    const downMove = prevL - l;

    if (upMove > downMove && upMove > 0) plusDM[i] = upMove;
    if (downMove > upMove && downMove > 0) minusDM[i] = downMove;
  }

  const trRma = calculateRMA(tr, length);
  const plusDmRma = calculateRMA(plusDM, length);
  const minusDmRma = calculateRMA(minusDM, length);

  const plusDI = new Array(closes.length).fill(0);
  const minusDI = new Array(closes.length).fill(0);
  const dx = new Array(closes.length).fill(0);

  for (let i = length; i < closes.length; i++) {
    if (trRma[i] > 0) {
      plusDI[i] = 100 * (plusDmRma[i] / trRma[i]);
      minusDI[i] = 100 * (minusDmRma[i] / trRma[i]);
      dx[i] = 100 * Math.abs(plusDI[i] - minusDI[i]) / (plusDI[i] + minusDI[i] || 1);
    }
  }

  const adx = calculateRMA(dx, length);

  return { plusDI, minusDI, adx };
};

export const calculateOBV = (closes, volumes) => {
  const obv = new Array(closes.length).fill(0);
  let currentObv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      currentObv += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      currentObv -= volumes[i];
    }
    obv[i] = currentObv;
  }
  return obv;
};
