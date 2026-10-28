export function detectChannel(candles) {
  if (!candles || candles.length < 50) {
    return { status: "No clean channel", quality: 0, reason: "Not enough data for channel detection." };
  }

  const N = candles.length;
  const currentPrice = candles[N - 1].close;

  // Calculate ATR
  let trSum = 0;
  for (let i = 1; i < N; i++) {
    const k = candles[i];
    const pk = candles[i - 1];
    const tr = Math.max(k.high - k.low, Math.abs(k.high - pk.close), Math.abs(k.low - pk.close));
    trSum += tr;
  }
  const atr = trSum / (N - 1);
  const touchTolerance = atr * 0.5;

  // Find swing highs and lows (window = 4)
  const window = 4;
  const swingHighs = [];
  const swingLows = [];

  for (let i = window; i < N - window; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      if (candles[i - j].high > candles[i].high || candles[i + j].high > candles[i].high) isHigh = false;
      if (candles[i - j].low < candles[i].low || candles[i + j].low < candles[i].low) isLow = false;
    }
    if (isHigh) swingHighs.push({ i, val: candles[i].high });
    if (isLow) swingLows.push({ i, val: candles[i].low });
  }

  // Linear regression on (H+L)/2
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < N; i++) {
    const y = (candles[i].high + candles[i].low) / 2;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  }

  const m = (N * sumXY - sumX * sumY) / (N * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / N;

  // Calculate offsets for upper and lower lines using average of extreme deviations
  const highDevs = swingHighs.map(sh => sh.val - (m * sh.i + b)).sort((x, y) => y - x); // descending
  const lowDevs = swingLows.map(sl => sl.val - (m * sl.i + b)).sort((x, y) => x - y); // ascending

  // Take top 3 deviations (or fewer if not enough swings)
  const topCount = Math.min(3, highDevs.length);
  const botCount = Math.min(3, lowDevs.length);

  if (topCount < 2 || botCount < 2) {
    return { status: "No clean channel", quality: 0, reason: "Not enough swing points to establish channel." };
  }

  const b_upper = b + (highDevs.slice(0, topCount).reduce((a, c) => a + c, 0) / topCount);
  const b_lower = b + (lowDevs.slice(0, botCount).reduce((a, c) => a + c, 0) / botCount);

  // Count touches
  let upperTouches = 0;
  let lowerTouches = 0;

  for (let i = 0; i < N; i++) {
    const upperY = m * i + b_upper;
    const lowerY = m * i + b_lower;

    if (Math.abs(candles[i].high - upperY) <= touchTolerance) upperTouches++;
    if (Math.abs(candles[i].low - lowerY) <= touchTolerance) lowerTouches++;
  }

  // Determine Channel Slope Type
  const slopePct = (m / currentPrice) * 100; // % move per 1 candle
  let channelType = "Sideways";
  if (slopePct > 0.035) channelType = "Ascending";
  else if (slopePct < -0.035) channelType = "Descending";

  // Position
  const currentUpper = m * (N - 1) + b_upper;
  const currentLower = m * (N - 1) + b_lower;
  const positionPct = ((currentPrice - currentLower) / (currentUpper - currentLower)) * 100;

  // Channel Quality (0 to 100)
  let quality = 0;
  if (upperTouches >= 2 && lowerTouches >= 2) quality += 40;
  if (upperTouches >= 3) quality += 10;
  if (lowerTouches >= 3) quality += 10;
  
  // Penalize if price is way outside the channel for many candles
  let falseBreakouts = 0;
  for (let i = Math.floor(N/2); i < N; i++) {
    const uY = m * i + b_upper;
    const lY = m * i + b_lower;
    if (candles[i].close > uY + touchTolerance * 2 || candles[i].close < lY - touchTolerance * 2) {
      falseBreakouts++;
    }
  }
  quality += Math.max(0, 40 - (falseBreakouts * 5));

  if (quality < 40) {
    return { status: "No clean channel", quality, reason: "Channel quality is too low, lines are not respected.", channelType: "None", positionPct, slope: m, b_upper, b_lower, b_mid: b, candles };
  }

  // Action Logic
  let action = "Wait";
  let reason = "";
  let status = "Inside channel";

  if (positionPct > 100) {
    status = "Breakout";
    action = "Wait for retest";
    reason = `Price closed above the upper channel line with strong momentum. Breakout detected, but wait for retest.`;
  } else if (positionPct < 0) {
    status = "Breakdown";
    action = "Avoid";
    reason = `Price broke below the lower channel line. Channel structure is damaged. Avoid switching into this token.`;
  } else {
    if (channelType === "Ascending") {
      if (positionPct <= 35) {
        status = "Near channel support";
        action = "Watch for entry";
        reason = `Price is moving inside a valid ascending channel. Price is near the lower half, trend is healthy, risk is low. Watch for entry.`;
      } else if (positionPct <= 70) {
        status = "Middle of channel";
        action = "Neutral";
        reason = `Price is inside an ascending channel, currently in the middle. Wait for confirmation or pullback.`;
      } else {
        status = "Near channel resistance";
        action = "Watch only";
        reason = `Price is inside an ascending channel, but close to upper resistance. Token is strong, but entry is late. Watch only or wait for pullback.`;
      }
    } else if (channelType === "Descending") {
      status = "Inside descending channel";
      action = "Avoid";
      reason = `Price is in a descending channel. Avoid long rotation unless breakout and retest happen.`;
    } else {
      // Sideways
      if (positionPct <= 30) {
        status = "Near channel support";
        action = "Watch for entry";
        reason = `Price is ranging. Buy near lower range only.`;
      } else if (positionPct >= 70) {
        status = "Near channel resistance";
        action = "Avoid";
        reason = `Price is ranging. Avoid upper range.`;
      } else {
        status = "Middle of range";
        action = "Neutral";
        reason = `Price is in the middle of a sideways range.`;
      }
    }
  }

  return {
    status,
    action,
    reason,
    quality,
    channelType,
    positionPct,
    slope: m,
    b_upper,
    b_lower,
    b_mid: b,
    candles
  };
}
