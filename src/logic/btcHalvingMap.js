
// ── ENGINE : BTC HALVING CYCLE MAP (PINE SCRIPT TIME-ACCURATE ENGINE) ──
const HALVING_EVENTS = [
  { year: 2012, timestamp: 1354060800, name: 'Halving 2012' },
  { year: 2016, timestamp: 1468022400, name: 'Halving 2016' },
  { year: 2020, timestamp: 1589155200, name: 'Halving 2020' },
  { year: 2024, timestamp: 1713571200, name: 'Halving 2024' },
];

const WEEK_SEC = 7 * 24 * 60 * 60;
const NEXT_HALVING_2028 = 1713571200 + (210000 * 10 * 60); // approx 2028-04-18

export function generateHalvingCycleMarkers(weeklyCandles) {
  if (!weeklyCandles || weeklyCandles.length === 0) return [];
  const markers = [];

  HALVING_EVENTS.forEach(h => {
    // 1. Halving Event Marker
    const hCandle = weeklyCandles.find(c => Math.abs(c.time - h.timestamp) < WEEK_SEC * 1.5) || { time: h.timestamp };
    markers.push({
      time: hCandle.time,
      position: 'belowBar',
      color: '#f59e0b',
      shape: 'arrowUp',
      text: `🔶 ${h.name}`,
      size: 2
    });

    // 2. Key Week Markers (+20w, +40w, +80w, +135w, +156w)
    const keyWeeks = [
      { w: 20, label: 'A (+20w)', color: '#94a3b8' },
      { w: 40, label: 'B (+40w)', color: '#38bdf8' },
      { w: 80, label: 'C (+80w)', color: '#00ff88' },
      { w: 135, label: 'D (+135w)', color: '#facc15' },
      { w: 156, label: 'E (+156w)', color: '#a855f7' },
    ];

    keyWeeks.forEach(kw => {
      const targetTs = h.timestamp + (kw.w * WEEK_SEC);
      const matchC = weeklyCandles.find(c => Math.abs(c.time - targetTs) < WEEK_SEC * 1.2);
      if (matchC) {
        markers.push({
          time: matchC.time,
          position: 'aboveBar',
          color: kw.color,
          shape: 'circle',
          text: kw.label,
          size: 1
        });
      }
    });
  });

  return markers.sort((a, b) => a.time - b.time);
}
