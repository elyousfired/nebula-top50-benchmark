// src/logic/solScoreEngine.js
import { calculateSMA, calculateEMA, calculateRSI, calculateMACD, calculateVWAP, calculateADX, calculateOBV } from './indicators';

export const calculateSolScore = (klines, htfKlines) => {
  // klines and htfKlines should be chronologically sorted oldest to newest
  // format of kline: { time, open, high, low, close, volume }
  if (!klines || klines.length < 30) return null; // We need at least 30 candles for MACD and basic EMA
  
  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const volumes = klines.map(k => k.volume);

  const emaFast = calculateEMA(closes, 21);
  const emaMid = calculateEMA(closes, 50);
  const emaSlow = calculateEMA(closes, 200);
  const vwapVal = calculateVWAP(klines);
  const rsi = calculateRSI(closes, 14);
  const { macdLine, signalLine, hist } = calculateMACD(closes, 12, 26, 9);
  const volMA = calculateSMA(volumes, 20);
  const { plusDI, minusDI, adx } = calculateADX(highs, lows, closes, 14);
  const obv = calculateOBV(closes, volumes);
  const obvMA = calculateSMA(obv, 21);

  // HTF Calculations
  let htfBull = false;
  let htfBear = false;

  if (htfKlines && htfKlines.length > 0) {
    const htfCloses = htfKlines.map(k => k.close);
    const htfEma50 = calculateEMA(htfCloses, 50);
    const htfEma200 = calculateEMA(htfCloses, 200);

    const htfC = htfCloses[htfCloses.length - 1];
    const htfE50 = htfEma50.length > 0 ? htfEma50[htfEma50.length - 1] : null;
    const htfE200 = htfEma200.length > 0 ? htfEma200[htfEma200.length - 1] : null;

    if (htfE50 !== null && htfE200 !== null) {
      htfBull = htfC > htfE50 && htfE50 > htfE200;
      htfBear = htfC < htfE50 && htfE50 < htfE200;
    } else if (htfE50 !== null) {
      htfBull = htfC > htfE50;
      htfBear = htfC < htfE50;
    }
  }

  // Get latest values
  const i = closes.length - 1;
  const c = closes[i];
  const cPrev = closes[i - 1];

  const ef = emaFast.length > 0 ? emaFast[i] : null;
  const em = emaMid.length > 0 ? emaMid[i] : null;
  const es = emaSlow.length > 0 ? emaSlow[i] : null;
  const vw = vwapVal[i];
  const rs = rsi.length > 0 ? rsi[i] : 50;
  const ml = macdLine.length > 0 ? macdLine[i] : 0;
  const sl = signalLine.length > 0 ? signalLine[i] : 0;
  const h = hist.length > 0 ? hist[i] : 0;
  const hPrev = hist.length > 1 ? hist[i - 1] : 0;
  const highVol = volMA.length > 0 && volumes[i] > volMA[i];
  const pdi = plusDI.length > 0 ? plusDI[i] : 0;
  const mdi = minusDI.length > 0 ? minusDI[i] : 0;
  const adxVal = adx.length > 0 ? adx[i] : 0;
  const ob = obv.length > 0 ? obv[i] : 0;
  const oma = obvMA.length > 0 ? obvMA[i] : 0;

  // Market Regime
  const bullRegime = es !== null && em !== null && c > es && em > es;
  const bearRegime = es !== null && em !== null && c < es && em < es;

  // Bullish Score Conditions
  let bullScore = 0;
  const bullReasons = [];
  if (es !== null && c > es) { bullScore++; bullReasons.push("Price > EMA 200"); }
  if (ef !== null && em !== null && ef > em) { bullScore++; bullReasons.push("EMA 21 > EMA 50"); }
  if (em !== null && es !== null && em > es) { bullScore++; bullReasons.push("EMA 50 > EMA 200"); }
  if (c > vw) { bullScore++; bullReasons.push("Price > VWAP"); }
  if (rs > 50) { bullScore++; bullReasons.push("RSI > 50"); }
  if (em !== null && rs > 40 && rs < 60 && c > em) { bullScore++; bullReasons.push("RSI Neutral-Bullish & Price > EMA 50"); }
  if (ml > sl) { bullScore++; bullReasons.push("MACD > Signal"); }
  if (h > hPrev) { bullScore++; bullReasons.push("MACD Hist Rising"); }
  if (c > cPrev && highVol) { bullScore++; bullReasons.push("Bullish Candle with High Volume"); }
  if (oma !== 0 && ob > oma) { bullScore++; bullReasons.push("OBV > OBV MA"); }
  if (pdi > mdi && adxVal > 18) { bullScore++; bullReasons.push("ADX Bullish Trend"); }
  if (htfBull) { bullScore += 2; bullReasons.push("HTF Trend is Bullish (+2)"); }

  // Bearish Score Conditions
  let bearScore = 0;
  const bearReasons = [];
  if (es !== null && c < es) { bearScore++; bearReasons.push("Price < EMA 200"); }
  if (ef !== null && em !== null && ef < em) { bearScore++; bearReasons.push("EMA 21 < EMA 50"); }
  if (em !== null && es !== null && em < es) { bearScore++; bearReasons.push("EMA 50 < EMA 200"); }
  if (c < vw) { bearScore++; bearReasons.push("Price < VWAP"); }
  if (rs < 50) { bearScore++; bearReasons.push("RSI < 50"); }
  if (em !== null && rs < 60 && rs > 40 && c < em) { bearScore++; bearReasons.push("RSI Neutral-Bearish & Price < EMA 50"); }
  if (ml < sl) { bearScore++; bearReasons.push("MACD < Signal"); }
  if (h < hPrev) { bearScore++; bearReasons.push("MACD Hist Falling"); }
  if (c < cPrev && highVol) { bearScore++; bearReasons.push("Bearish Candle with High Volume"); }
  if (oma !== 0 && ob < oma) { bearScore++; bearReasons.push("OBV < OBV MA"); }
  if (mdi > pdi && adxVal > 18) { bearScore++; bearReasons.push("ADX Bearish Trend"); }
  if (htfBear) { bearScore += 2; bearReasons.push("HTF Trend is Bearish (+2)"); }

  const scoreDiff = bullScore - bearScore;
  const bullLimit = 7;
  const bearLimit = 7;

  const bullSignal = bullScore >= bullLimit && bullScore > bearScore + 2;
  const bearSignal = bearScore >= bearLimit && bearScore > bullScore + 2;

  let bias = "NEUTRAL";
  if (bullSignal) bias = "STRONG BULLISH";
  else if (bearSignal) bias = "STRONG BEARISH";
  else if (scoreDiff > 2) bias = "BULLISH";
  else if (scoreDiff < -2) bias = "BEARISH";

  return {
    bullScore,
    bearScore,
    bullReasons,
    bearReasons,
    scoreDiff,
    bias,
    bullRegime,
    bearRegime,
    htfBull,
    htfBear,
    rsi: rs,
    bullSignal,
    bearSignal,
    indicators: {
      emaFast, emaMid, emaSlow, vwapVal, macdLine, signalLine, hist, rsi
    }
  };
};
