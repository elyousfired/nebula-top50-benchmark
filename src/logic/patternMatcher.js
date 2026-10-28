/**
 * Detects the "3-Stage Compression" pattern in a rolling strength array.
 * Stage 1: Deep Red (value <= -5%)
 * Stage 2: Compression (recovering from the deep red)
 * Stage 3: Armed (Current value between -2% and 2%)
 */
export const detectCompressionStages = (strengthArray) => {
  if (!strengthArray || strengthArray.length < 10) return false;

  // Analyze the last 24 periods (e.g., 24 hours)
  const recent = strengthArray.slice(-24);
  if (recent.length === 0) return false;

  // Stage 3: Armed (Current value is near zero)
  const currentVal = recent[recent.length - 1].value;
  if (currentVal < -2 || currentVal > 2) return false;

  // Find the deepest trough (Stage 1)
  let minIndex = -1;
  let minValue = 0;
  for (let i = 0; i < recent.length - 2; i++) {
    if (recent[i].value < minValue) {
      minValue = recent[i].value;
      minIndex = i;
    }
  }

  // Stage 1: Deep Red threshold
  if (minValue > -5) return false;

  // Stage 2: Compression
  // Ensure that after the deep red, the values are compressing (getting closer to 0)
  // and not making lower lows.
  for (let i = minIndex + 1; i < recent.length - 1; i++) {
    if (recent[i].value < minValue) return false;
  }

  return true;
};

/**
 * Detects the multi-timeframe alignment "perfect storm".
 * @param {Array} str4H - 4H rolling strength array
 * @param {Array} str1H - 1H rolling strength array
 * @param {Array} str15m - 15m rolling strength array
 * @returns {boolean} true if all conditions are met
 */
export const detectMultiTimeframeAlignment = (str4H, str1H, str15m) => {
  if (!str4H || !str1H || !str15m) return false;
  if (str4H.length < 10 || str1H.length < 10 || str15m.length < 10) return false;

  // --- 4H Evaluation (Stage 2: Deep Red Recovery) ---
  const recent4H = str4H.slice(-24);
  let min4H = 0;
  for (let i = 0; i < recent4H.length; i++) {
    if (recent4H[i].value < min4H) min4H = recent4H[i].value;
  }
  // Condition 4H: Must have had a deep red (<= -10%) and currently recovering (not near the absolute bottom anymore, but still negative or close to 0)
  if (min4H > -10) return false;
  const current4H = recent4H[recent4H.length - 1].value;
  if (current4H <= min4H + 2) return false; // Must be recovering

  // --- 1H Evaluation (Stage 3: Armed / Near Zero) ---
  const recent1H = str1H.slice(-10);
  const current1H = recent1H[recent1H.length - 1].value;
  // Condition 1H: Current value is hovering near zero (tight armed zone)
  if (current1H < -3 || current1H > 3) return false;

  // --- 15m Evaluation (The Trigger: Crossing Zero) ---
  const recent15m = str15m.slice(-10);
  const current15m = recent15m[recent15m.length - 1].value;
  // Condition 15m: Must be slightly positive or exactly 0 (franchissement zéro)
  // and coming from a tight compression (we check that the max value in the last 10 periods wasn't a huge spike)
  if (current15m < 0 || current15m > 4) return false; 
  
  let max15m = -100;
  let min15m = 100;
  for (let i = 0; i < recent15m.length - 1; i++) {
    if (recent15m[i].value > max15m) max15m = recent15m[i].value;
    if (recent15m[i].value < min15m) min15m = recent15m[i].value;
  }
  // Check that before the zero cross, it was compressed (not swinging wildly)
  if (max15m > 5 || min15m < -10) return false;

  return true;
};
