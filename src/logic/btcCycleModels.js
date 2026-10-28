// ── ENGINE : BITCOIN CYCLES & MACRO MODELS (PI CYCLE, HALVING CLOCK, RAINBOW CHART) ──

// Historical Halvings
export const HALVINGS = [
  { num: 1, date: '2012-11-28', timestamp: 1354060800, topDate: '2013-11-29', topDays: 366, topPrice: 1150 },
  { num: 2, date: '2016-07-09', timestamp: 1468022400, topDate: '2017-12-16', topDays: 525, topPrice: 19700 },
  { num: 3, date: '2020-05-11', timestamp: 1589155200, topDate: '2021-11-08', topDays: 546, topPrice: 69000 },
  { num: 4, date: '2024-04-19', timestamp: 1713571200, topDate: '2025-10-25', topDays: 550, topPrice: null }, // Current Cycle
];

// 1. 🌈 BITCOIN RAINBOW CHART (LOGARITHMIC REGRESSION BANDS)
// Fitted Formula: ln(Price) = -37.1200 + 5.5780 * ln(days_since_genesis)
const GENESIS_TS = 1230940800; // Jan 3, 2009

export function calculateRainbowBands(weeklyCandles) {
  if (!weeklyCandles || weeklyCandles.length === 0) return {};

  const bands = {
    fireSale: [],       // 🟣 1. Basically a Fire Sale! (x 0.35)
    buy: [],            // 🔵 2. BUY! (x 0.50)
    accumulate: [],     // 🩵 3. Accumulate (x 0.70)
    stillCheap: [],     // 🟢 4. Still Cheap (x 1.00)
    hold: [],           // 🟡 5. HODL! (x 1.40)
    isBubble: [],       // 🟠 6. Is this a Bubble? (x 1.90)
    fomo: [],           // 🔴 7. FOMO Intensifies (x 2.60)
    maxBubble: []       // 🚨 8. Maximum Bubble Territory (x 3.50)
  };

  weeklyCandles.forEach(c => {
    const days = Math.max(10, (c.time - GENESIS_TS) / 86400);
    // Exact mathematical logarithmic regression fit
    const basePrice = Math.exp(-37.1200 + 5.5780 * Math.log(days));

    bands.fireSale.push({ time: c.time, value: parseFloat((basePrice * 0.35).toFixed(2)) });
    bands.buy.push({ time: c.time, value: parseFloat((basePrice * 0.50).toFixed(2)) });
    bands.accumulate.push({ time: c.time, value: parseFloat((basePrice * 0.70).toFixed(2)) });
    bands.stillCheap.push({ time: c.time, value: parseFloat((basePrice * 1.00).toFixed(2)) });
    bands.hold.push({ time: c.time, value: parseFloat((basePrice * 1.40).toFixed(2)) });
    bands.isBubble.push({ time: c.time, value: parseFloat((basePrice * 1.90).toFixed(2)) });
    bands.fomo.push({ time: c.time, value: parseFloat((basePrice * 2.60).toFixed(2)) });
    bands.maxBubble.push({ time: c.time, value: parseFloat((basePrice * 3.50).toFixed(2)) });
  });

  // Current Rainbow Zone of Latest Candle
  const latestC = weeklyCandles[weeklyCandles.length - 1];
  const p = latestC.close;
  const days = (latestC.time - GENESIS_TS) / 86400;
  const basePrice = Math.exp(-37.1200 + 5.5780 * Math.log(days));

  let currentZone = { name: '🟢 STILL CHEAP (ENCORE BON MARCHÉ)', color: '#00ff88', desc: 'Le prix est en pleine zone d\'achat et de progression saine du cycle' };

  if (p <= basePrice * 0.35) {
    currentZone = { name: '🟣 FIRE SALE (BRADERIE DU SIÈCLE)', color: '#c026d3', desc: 'Opportunité d\'achat générationnelle (Fond absolu du Bear Market)' };
  } else if (p <= basePrice * 0.50) {
    currentZone = { name: '🔵 BUY! (ACHAT TRÈS FORT)', color: '#38bdf8', desc: 'Zone de sous-évaluation historique majeure' };
  } else if (p <= basePrice * 0.70) {
    currentZone = { name: '🩵 ACCUMULATE (ACCUMULATION)', color: '#22d3ee', desc: 'Excellente zone d\'entrée long terme' };
  } else if (p <= basePrice * 1.00) {
    currentZone = { name: '🟢 STILL CHEAP (ENCORE BON MARCHÉ)', color: '#00ff88', desc: 'Le prix reste attractif sous la valeur centrale du cycle' };
  } else if (p <= basePrice * 1.40) {
    currentZone = { name: '🟡 HODL! (CONSERVER / FAIR VALUE)', color: '#facc15', desc: 'Zone d\'équilibre et de croissance saine du cycle' };
  } else if (p <= basePrice * 1.90) {
    currentZone = { name: '🟠 IS THIS A BUBBLE? (ATTENTION BULLE)', color: '#fb923c', desc: 'Surchauffe du marché, commencer à prendre des profits partiels' };
  } else if (p <= basePrice * 2.60) {
    currentZone = { name: '🔴 FOMO INTENSIFIES (PRISE DE TP FORTE)', color: '#f43f5e', desc: 'FOMO extrême du grand public, zone de vente stratégique' };
  } else {
    currentZone = { name: '🚨 MAX BUBBLE TERRITORY (SOMMET DU CYCLE / EXIT)', color: '#ef4444', desc: 'Euphorie totale, sommet imminent de cycle !' };
  }

  return { bands, currentZone };
}

// 2. ⏳ HALVING CYCLE CLOCK
export function calculateHalvingClock(latestCandleTime) {
  const currentTs = latestCandleTime || Math.floor(Date.now() / 1000);
  const lastHalving = HALVINGS[3]; // Halving 4: April 19, 2024
  const nextHalvingTs = lastHalving.timestamp + (4 * 365.25 * 86400); // ~ April 2028

  const daysSinceHalving = Math.floor((currentTs - lastHalving.timestamp) / 86400);
  const daysToNextHalving = Math.max(0, Math.floor((nextHalvingTs - currentTs) / 86400));
  const totalCycleDays = Math.floor((nextHalvingTs - lastHalving.timestamp) / 86400);
  const cycleProgressPct = Math.min(100, parseFloat(((daysSinceHalving / totalCycleDays) * 100).toFixed(1)));

  // Historical Top Window: Days 500 to 580 post-halving
  const avgHistoricalTopDay = 540;
  const isTopWindow = daysSinceHalving >= 480 && daysSinceHalving <= 600;

  return {
    daysSinceHalving,
    daysToNextHalving,
    cycleProgressPct,
    isTopWindow,
    avgHistoricalTopDay,
    lastHalvingDate: lastHalving.date,
    historicalComparisons: [
      { cycle: 'Cycle 2012', daysToTop: 366, multiplier: '98x' },
      { cycle: 'Cycle 2016', daysToTop: 525, multiplier: '29x' },
      { cycle: 'Cycle 2020', daysToTop: 546, multiplier: '7.5x' },
      { cycle: 'Cycle 2024 (Actuel)', daysElapsed: daysSinceHalving, status: isTopWindow ? '🎯 FENÊTRE DE SOMMET' : (daysSinceHalving < 480 ? '🚀 EXPANSION DU CYCLE' : '📉 PHASE POST-SOMMET') }
    ]
  };
}

// 3. 🥧 PI CYCLE TOP INDICATOR
export function calculatePiCycleTop(weeklyCandles) {
  if (!weeklyCandles || weeklyCandles.length < 50) return { pi111: [], pi350x2: [], proximityPct: 0, isCrossed: false };

  const pi111 = [];    // 16 weeks SMA (approx 111 days)
  const pi350x2 = [];  // 2 * (50 weeks SMA) (approx 2 * 350 days)

  for (let i = 0; i < weeklyCandles.length; i++) {
    const t = weeklyCandles[i].time;

    if (i >= 15) {
      let sum16 = 0;
      for (let k = 0; k < 16; k++) sum16 += weeklyCandles[i - k].close;
      pi111.push({ time: t, value: parseFloat((sum16 / 16).toFixed(2)) });
    }

    if (i >= 49) {
      let sum50 = 0;
      for (let k = 0; k < 50; k++) sum50 += weeklyCandles[i - k].close;
      const ma50Val = sum50 / 50;
      pi350x2.push({ time: t, value: parseFloat((ma50Val * 2.0).toFixed(2)) });
    }
  }

  const latest111 = pi111.length > 0 ? pi111[pi111.length - 1].value : 0;
  const latest350x2 = pi350x2.length > 0 ? pi350x2[pi350x2.length - 1].value : 0;

  const isCrossed = latest111 >= latest350x2 && latest350x2 > 0;
  const proximityPct = latest350x2 > 0 ? parseFloat(((latest111 / latest350x2) * 100).toFixed(1)) : 0;

  return {
    pi111,
    pi350x2,
    latest111,
    latest350x2,
    isCrossed,
    proximityPct
  };
}
