export const detectDemandZone = (candles, rangePercent = 0.03) => {
  if (!candles || candles.length < 20) return null;
  
  // 1. Find swing lows (bottoms)
  const swingLows = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const currentLow = candles[i].low;
    if (
      currentLow < candles[i-1].low && 
      currentLow < candles[i-2].low &&
      currentLow < candles[i+1].low && 
      currentLow < candles[i+2].low
    ) {
      swingLows.push({
        price: currentLow,
        time: candles[i].time,
        index: i
      });
    }
  }

  if (swingLows.length === 0) return null;

  // 2. Group swing lows that are close to each other
  const clusters = [];
  swingLows.forEach(low => {
    let added = false;
    for (let cluster of clusters) {
      const avg = cluster.reduce((sum, item) => sum + item.price, 0) / cluster.length;
      if (Math.abs(low.price - avg) / avg <= rangePercent) {
        cluster.push(low);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push([low]);
    }
  });

  // 3. Find the cluster with the most touches (strongest demand zone)
  clusters.sort((a, b) => b.length - a.length);
  const bestCluster = clusters[0];

  if (!bestCluster || bestCluster.length < 2) return null; // Need at least 2 touches for a valid zone

  // 4. Calculate zone boundaries
  const prices = bestCluster.map(item => item.price);
  const zoneBottom = Math.min(...prices);
  const zoneTop = Math.max(...prices) * 1.01; // Slightly above the highest touch to form a zone

  return {
    top: zoneTop,
    bottom: zoneBottom,
    touches: bestCluster.length,
    lastTouchTime: Math.max(...bestCluster.map(item => item.time))
  };
};
