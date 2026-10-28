// src/logic/roadmapEngine.js

const TF_WEIGHTS = {
  '1W': 5,
  '1D': 4,
  '4H': 3,
  '1H': 2,
  '15m': 1
};

export const calculateZonePower = (zone, currentPrice, allZones) => {
  const tfWeight = TF_WEIGHTS[zone.timeframe] || 1;
  
  // Confluence Bonus
  let overlappingZones = 0;
  for (const other of allZones) {
    if (other !== zone && other.timeframe !== zone.timeframe) {
      // Overlap check
      if (zone.bottom <= other.top && zone.top >= other.bottom) {
        overlappingZones++;
      }
    }
  }
  const confluenceBonus = 1 + 0.25 * overlappingZones;

  // Freshness Score
  let freshnessScore = 0.50;
  if (zone.touchCount === 0) freshnessScore = 1.20;
  else if (zone.touchCount === 1) freshnessScore = 1.00;
  else if (zone.touchCount === 2) freshnessScore = 0.75;

  // Source Score (Assuming BOS for all right now)
  let sourceScore = 1.00;
  if (zone.source === 'CHoCH') sourceScore = 1.15;

  // Touch Penalty
  const touchPenalty = 1 / (1 + zone.touchCount);

  // Distance Penalty
  let nearestBoundary = zone.top;
  if (currentPrice > zone.top) nearestBoundary = zone.top;
  else if (currentPrice < zone.bottom) nearestBoundary = zone.bottom;
  else nearestBoundary = currentPrice;

  let distancePercent = 0;
  if (currentPrice > 0) {
    distancePercent = Math.abs((currentPrice - nearestBoundary) / currentPrice) * 100;
  }
  const distancePenalty = 1 / (distancePercent + 0.20);

  const zonePower = tfWeight * confluenceBonus * freshnessScore * sourceScore * touchPenalty * distancePenalty;
  
  return {
    ...zone,
    mid: (zone.top + zone.bottom) / 2,
    zonePower,
    distanceToZone: distancePercent,
    confluenceCount: overlappingZones
  };
};

export const clusterZones = (zones, currentPrice, atr4H) => {
  // Sort zones by top price
  const sorted = [...zones].sort((a, b) => b.top - a.top);
  const clusters = [];
  
  const threshold = Math.max(0.25 * atr4H, currentPrice * 0.005);

  for (const zone of sorted) {
    let added = false;
    for (const cluster of clusters) {
      // Check overlap or closeness
      const isOverlapping = zone.bottom <= cluster.top && zone.top >= cluster.bottom;
      const isClose = Math.min(Math.abs(zone.top - cluster.bottom), Math.abs(cluster.top - zone.bottom)) < threshold;
      
      if (isOverlapping || isClose) {
        cluster.zones.push(zone);
        cluster.top = Math.max(cluster.top, zone.top);
        cluster.bottom = Math.min(cluster.bottom, zone.bottom);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({
        top: zone.top,
        bottom: zone.bottom,
        zones: [zone]
      });
    }
  }

  // Calculate cluster properties
  return clusters.map(c => {
    let bullPower = 0;
    let bearPower = 0;
    let highestWeight = 0;
    let dominantTimeframe = '15m';

    c.zones.forEach(z => {
      if (z.type === 'BULLISH') bullPower += z.zonePower;
      else bearPower += z.zonePower;
      
      const w = TF_WEIGHTS[z.timeframe];
      if (w > highestWeight) {
        highestWeight = w;
        dominantTimeframe = z.timeframe;
      }
    });

    const totalPower = bullPower + bearPower;
    
    let clusterType = 'mixed';
    if (totalPower > 0) {
      if (Math.abs(bullPower - bearPower) / totalPower < 0.20) {
        clusterType = 'mixed';
      } else if (bullPower > bearPower) {
        clusterType = 'support';
      } else {
        clusterType = 'resistance';
      }
    }

    return {
      ...c,
      mid: (c.top + c.bottom) / 2,
      totalPower,
      bullPower,
      bearPower,
      dominantTimeframe,
      clusterType,
      distanceToZone: Math.abs(currentPrice - (c.top + c.bottom) / 2) / currentPrice * 100 // approximation
    };
  });
};

export const calculateForces = (zones, currentPrice) => {
  let supportForce = 0;
  let resistanceForce = 0;

  zones.forEach(z => {
    const dist = z.distanceToZone;
    if (z.type === 'BULLISH' && (z.top <= currentPrice || dist === 0 || dist <= 0.5)) {
      supportForce += z.zonePower;
    }
    if (z.type === 'BEARISH' && (z.bottom >= currentPrice || dist === 0 || dist <= 0.5)) {
      resistanceForce += z.zonePower;
    }
  });

  return { supportForce, resistanceForce, biasScore: supportForce - resistanceForce };
};

export const buildRoadmap = (symbol, klinesBase, allZones, baseTf = '4H') => {
  if (!klinesBase || klinesBase.length < 2) return null;
  const currentCandle = klinesBase[klinesBase.length - 1];
  const prevCandle = klinesBase[klinesBase.length - 2];
  const currentPrice = Number(currentCandle[4]);

  // Calculate ATR 14 and EMAs
  let trSum = 0;
  let count = 0;
  
  let ema20 = currentPrice;
  let ema50 = currentPrice;
  
  const k20 = 2 / 21;
  const k50 = 2 / 51;
  
  if (klinesBase.length > 50) {
    ema20 = Number(klinesBase[0][4]);
    ema50 = Number(klinesBase[0][4]);
    for (let i = 1; i < klinesBase.length; i++) {
      const close = Number(klinesBase[i][4]);
      ema20 = close * k20 + ema20 * (1 - k20);
      ema50 = close * k50 + ema50 * (1 - k50);
    }
  }

  for (let i = klinesBase.length - 14; i < klinesBase.length; i++) {
    const k = klinesBase[i];
    const pk = klinesBase[i-1];
    if(!k || !pk) continue;
    const kHigh = Number(k[2]);
    const kLow = Number(k[3]);
    const pkClose = Number(pk[4]);
    const tr = Math.max(kHigh - kLow, Math.abs(kHigh - pkClose), Math.abs(kLow - pkClose));
    trSum += tr;
    count++;
  }
  const atrBase = count > 0 ? trSum / count : currentPrice * 0.02;

  const poweredZones = allZones.map(z => calculateZonePower(z, currentPrice, allZones));
  const clusters = clusterZones(poweredZones, currentPrice, atrBase);
  
  const { supportForce, resistanceForce, biasScore } = calculateForces(poweredZones, currentPrice);

  const nearestBullZoneBelow = poweredZones.filter(z => z.type === 'BULLISH' && z.top <= currentPrice).sort((a,b) => b.top - a.top)[0];
  const nearestBearZoneAbove = poweredZones.filter(z => z.type === 'BEARISH' && z.bottom >= currentPrice).sort((a,b) => a.bottom - b.bottom)[0];
  
  const nearestSupportCluster = clusters.filter(c => c.clusterType === 'support' && c.top <= currentPrice).sort((a,b) => b.top - a.top)[0];
  const nearestResistanceCluster = clusters.filter(c => c.clusterType === 'resistance' && c.bottom >= currentPrice).sort((a,b) => a.bottom - b.bottom)[0];

  let scenario = 'low_confidence_no_clean_roadmap';
  let confidence = 35;
  let targetZone = null;
  let invalidation = { level: 0, rule: '' };
  let mainPath = [];
  let altPath = [];
  let reason = [];
  
  // 1. Bearish Breakdown Retest Check
  // If 4H just closed below a Bull OB
  const brokenBullOB = poweredZones.find(z => z.type === 'BULLISH' && Number(prevCandle[4]) > z.bottom && currentPrice < z.bottom);
  // 2. Bullish Breakout Retest Check
  const brokenBearOB = poweredZones.find(z => z.type === 'BEARISH' && Number(prevCandle[4]) < z.top && currentPrice > z.top);

  const distToBull = nearestBullZoneBelow ? nearestBullZoneBelow.distanceToZone : Infinity;
  const distToBear = nearestBearZoneAbove ? nearestBearZoneAbove.distanceToZone : Infinity;

  const emaTrend = currentPrice > ema20 && ema20 > ema50 ? 'bullish' : (currentPrice < ema20 && ema20 < ema50 ? 'bearish' : 'neutral');

  const totalForce = supportForce + resistanceForce;
  const forceBalance = totalForce > 0 ? Math.abs(supportForce - resistanceForce) / totalForce : 0;

  if (brokenBullOB) {
    scenario = 'bearish_breakdown_retest';
    confidence = 50;
    targetZone = nearestSupportCluster || nearestBullZoneBelow || null;
    invalidation = { level: brokenBullOB.top, rule: `${baseTf} close back above ${brokenBullOB.top.toFixed(4)}` };
    mainPath = [
      { offsetCandles: 0, price: currentPrice, label: 'current' },
      { offsetCandles: 2, price: brokenBullOB.bottom, label: 'retest broken zone' },
      { offsetCandles: 12, price: targetZone ? targetZone.top : currentPrice * 0.9, label: 'next target' }
    ];
    reason.push(`${baseTf} closed below a strong Bullish OB.`);
  } else if (brokenBearOB) {
    scenario = 'bullish_breakout_retest';
    confidence = 50;
    targetZone = nearestResistanceCluster || nearestBearZoneAbove || null;
    invalidation = { level: brokenBearOB.bottom, rule: `${baseTf} close back below ${brokenBearOB.bottom.toFixed(4)}` };
    mainPath = [
      { offsetCandles: 0, price: currentPrice, label: 'current' },
      { offsetCandles: 2, price: brokenBearOB.top, label: 'retest broken zone' },
      { offsetCandles: 12, price: targetZone ? targetZone.bottom : currentPrice * 1.1, label: 'next target' }
    ];
    reason.push(`${baseTf} closed above a strong Bearish OB.`);
  } else if (forceBalance < 0.20 && nearestResistanceCluster && nearestSupportCluster) {
    scenario = 'range_chop';
    confidence = 50;
    targetZone = nearestResistanceCluster;
    invalidation = { level: nearestResistanceCluster.top, rule: `${baseTf} close outside range boundaries` };
    mainPath = [
      { offsetCandles: 0, price: currentPrice, label: 'current' },
      { offsetCandles: 4, price: nearestResistanceCluster.bottom, label: 'range high' },
      { offsetCandles: 12, price: nearestSupportCluster.top, label: 'range low' }
    ];
    reason.push('Support and Resistance forces are almost equal, indicating a range.');
  } else if (nearestBullZoneBelow && (distToBull <= 2 || Math.abs(currentPrice - nearestBullZoneBelow.top) <= atrBase) && supportForce > resistanceForce) {
    scenario = 'bullish_bounce';
    confidence = 55;
    targetZone = nearestBearZoneAbove || nearestResistanceCluster;
    invalidation = { level: nearestBullZoneBelow.bottom, rule: `${baseTf} close below ${nearestBullZoneBelow.bottom.toFixed(4)}` };
    mainPath = [
      { offsetCandles: 0, price: currentPrice, label: 'current' },
      { offsetCandles: 2, price: nearestBullZoneBelow.mid, label: 'test Bull OB' },
      { offsetCandles: 8, price: currentPrice + atrBase, label: 'bounce' },
      { offsetCandles: 12, price: targetZone ? targetZone.bottom : currentPrice * 1.1, label: 'target' }
    ];
    reason.push('Price is near a Bullish OB and support force is stronger.');
    if (emaTrend === 'bullish') {
      reason.push('EMA 20 and 50 alignment confirms a strong bullish trend.');
      confidence += 10;
    }
  } else if (nearestBearZoneAbove && (distToBear <= 2 || Math.abs(nearestBearZoneAbove.bottom - currentPrice) <= atrBase) && resistanceForce > supportForce) {
    scenario = 'bearish_rejection';
    confidence = 55;
    targetZone = nearestBullZoneBelow || nearestSupportCluster;
    invalidation = { level: nearestBearZoneAbove.top, rule: `${baseTf} close above ${nearestBearZoneAbove.top.toFixed(4)}` };
    mainPath = [
      { offsetCandles: 0, price: currentPrice, label: 'current' },
      { offsetCandles: 2, price: nearestBearZoneAbove.mid, label: 'test Bear OB' },
      { offsetCandles: 8, price: currentPrice - atrBase, label: 'rejection' },
      { offsetCandles: 12, price: targetZone ? targetZone.top : currentPrice * 0.9, label: 'target' }
    ];
    reason.push('Price is near a Bearish OB and resistance force is stronger.');
    if (emaTrend === 'bearish') {
      reason.push('EMA 20 and 50 alignment confirms a strong bearish trend.');
      confidence += 10;
    }
  }

  // Calculate Risk / Reward
  let riskReward = 0;
  let quality = 'low quality setup';
  if (targetZone && invalidation.level !== 0) {
    const riskDistance = Math.abs(currentPrice - invalidation.level);
    const rewardDistance = Math.abs(targetZone.top - currentPrice); // Approximation
    if (riskDistance > 0) {
      riskReward = rewardDistance / riskDistance;
      if (riskReward >= 2) { quality = 'good roadmap'; confidence += 5; }
      else if (riskReward >= 1.5) { quality = 'acceptable roadmap'; confidence += 3; }
      else if (riskReward >= 1.2) quality = 'weak roadmap';
      else { confidence -= 8; }
    }
  } else {
    confidence -= 15;
  }

  // Hit-First Logic
  let upperScore = 0;
  let lowerScore = 0;
  let likelyFirstHit = 'none';

  if (nearestBearZoneAbove && nearestBullZoneBelow) {
    const distUp = nearestBearZoneAbove.distanceToZone;
    const distDown = nearestBullZoneBelow.distanceToZone;
    upperScore = resistanceForce / (distUp + 0.20);
    lowerScore = supportForce / (distDown + 0.20);
    
    const hfDiff = Math.abs(upperScore - lowerScore) / (upperScore + lowerScore);
    if (hfDiff < 0.20) likelyFirstHit = 'range/chop';
    else if (upperScore > lowerScore) likelyFirstHit = 'upperTarget';
    else likelyFirstHit = 'lowerTarget';
  }

  // Clamp Confidence
  if (confidence > 80) confidence = 80;
  if (confidence < 35) confidence = 35;

  let altScenarioName = 'none';
  if (scenario === 'bullish_bounce') altScenarioName = 'bearish_breakdown_retest';
  if (scenario === 'bearish_rejection') altScenarioName = 'bullish_breakout_retest';

  return {
    symbol,
    chartTimeframe: baseTf,
    currentPrice,
    mainScenario: scenario,
    confidence,
    quality,
    reason,
    supportForce,
    resistanceForce,
    biasScore,
    hitFirst: {
      upperScore,
      lowerScore,
      likelyFirstHit
    },
    targetZone,
    invalidation,
    mainPath,
    alternativeScenario: {
      name: altScenarioName,
      condition: `Alternative path if invalidation is triggered.`,
      path: [] // To be rendered dynamically
    },
    poweredZones
  };
};
