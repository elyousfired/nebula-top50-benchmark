import React, { useState } from 'react';

const VolumeProfileChart = ({ profileResults }) => {
  const [hoveredElement, setHoveredElement] = useState(null);

  if (!profileResults) return null;

  const {
    bins,
    dayHigh,
    dayLow,
    dayOpen,
    dayClose,
    pocPrice,
    vah,
    val,
    maxVol,
    allCandles,
    startOfDayTs
  } = profileResults;

  const width = 850;
  const height = 480;
  const padding = { top: 25, right: 80, bottom: 35, left: 10 };

  const visibleCandles = allCandles;
  const maxVal = Math.max(...visibleCandles.map(c => c.high));
  const minVal = Math.min(...visibleCandles.map(c => c.low));
  const priceRange = maxVal - minVal;
  
  const yMax = maxVal + priceRange * 0.07;
  const yMin = minVal - priceRange * 0.07;

  const getY = (price) => {
    const chartHeight = height - padding.top - padding.bottom;
    return padding.top + (1 - (price - yMin) / (yMax - yMin)) * chartHeight;
  };

  const profileXStart = padding.left;
  const profileWidth = 140;
  
  const chartXStart = padding.left + 160;
  const chartWidth = width - padding.right - chartXStart;

  const getX = (index) => {
    const denom = Math.max(1, visibleCandles.length - 1);
    return chartXStart + (index / denom) * chartWidth;
  };

  const candleWidth = Math.max(2, (chartWidth / visibleCandles.length) * 0.7);

  const gridCount = 6;
  const gridPrices = Array.from({ length: gridCount }, (_, i) => {
    return yMin + (i / (gridCount - 1)) * (yMax - yMin);
  });

  const dailyIsBullish = dayClose >= dayOpen;
  const dailyColor = dailyIsBullish ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 59, 48, 0.12)';
  const dailyBorder = dailyIsBullish ? '#00ff88' : '#ff3b30';

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#050505', userSelect: 'none', overflow: 'visible' }}
      onMouseLeave={() => setHoveredElement(null)}
    >
      {/* Grid lines */}
      {gridPrices.map((p, i) => (
        <g key={i}>
          <line
            x1={profileXStart}
            y1={getY(p)}
            x2={width - padding.right}
            y2={getY(p)}
            stroke="#111"
            strokeWidth="1"
          />
          <text
            x={width - padding.right + 8}
            y={getY(p) + 4}
            fill="#555"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            ${p.toLocaleString(undefined, { minimumFractionDigits: p < 1 ? 5 : 2, maximumFractionDigits: p < 1 ? 5 : 2 })}
          </text>
        </g>
      ))}

      {/* Vertical Separation */}
      <line
        x1={chartXStart - 10}
        y1={padding.top}
        x2={chartXStart - 10}
        y2={height - padding.bottom}
        stroke="#1a1a1a"
        strokeDasharray="4,4"
      />

      {/* Daily Open Divider */}
      {(() => {
        const todayStartIndex = visibleCandles.findIndex(c => c.time >= startOfDayTs);
        if (todayStartIndex !== -1) {
          const openX = getX(todayStartIndex);
          return (
            <g>
              <line
                x1={openX}
                y1={padding.top}
                x2={openX}
                y2={height - padding.bottom}
                stroke="rgba(0, 208, 255, 0.4)"
                strokeWidth="1.5"
                strokeDasharray="5,5"
              />
              <text
                x={openX + 5}
                y={padding.top + 10}
                fill="#00d0ff"
                fontSize="8"
                fontWeight="bold"
                opacity="0.8"
              >
                DAILY OPEN (00:00 UTC)
              </text>
            </g>
          );
        }
        return null;
      })()}

      {/* Volume Profile Bars (Left overlay) */}
      {bins.map((bin) => {
        const binYHigh = getY(bin.high);
        const binYLow = getY(bin.low);
        const binHeight = Math.max(1, binYLow - binYHigh);
        const barWidth = maxVol > 0 ? (bin.volume / maxVol) * profileWidth : 0;
        
        const isInValueArea = bin.high <= vah && bin.low >= val;
        const barColor = isInValueArea 
          ? 'rgba(255, 255, 255, 0.08)' 
          : 'rgba(255, 255, 255, 0.025)';

        const isHovered = hoveredElement?.type === 'bin' && hoveredElement.data.idx === bin.idx;

        return (
          <rect
            key={bin.idx}
            x={profileXStart}
            y={binYHigh}
            width={barWidth}
            height={binHeight - 0.5}
            fill={isHovered ? 'rgba(0, 208, 255, 0.25)' : barColor}
            stroke={isHovered ? '#00d0ff' : 'none'}
            strokeWidth="0.5"
            style={{ transition: 'fill 0.15s ease, width 0.3s ease' }}
            onMouseEnter={() => {
              setHoveredElement({
                type: 'bin',
                data: bin,
                x: profileXStart + barWidth + 10,
                y: binYHigh + binHeight / 2
              });
            }}
          />
        );
      })}

      {/* Daily Candlestick (Left Overlay) */}
      {(() => {
        const candleX = profileXStart + profileWidth / 2;
        const yOpen = getY(dayOpen);
        const yClose = getY(dayClose);
        const yHigh = getY(dayHigh);
        const yLow = getY(dayLow);

        const bodyY = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));

        const isHovered = hoveredElement?.type === 'daily';

        return (
          <g
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => {
              setHoveredElement({
                type: 'daily',
                data: { dayOpen, dayHigh, dayLow, dayClose, dayVolume: profileResults.dayVolume },
                x: candleX + 40,
                y: bodyY + bodyHeight / 2
              });
            }}
          >
            <line
              x1={candleX}
              y1={yHigh}
              x2={candleX}
              y2={yLow}
              stroke={dailyBorder}
              strokeWidth={isHovered ? 3 : 2}
              opacity="0.8"
            />
            <rect
              x={candleX - 25}
              y={bodyY}
              width="50"
              height={bodyHeight}
              fill={dailyColor}
              stroke={dailyBorder}
              strokeWidth={isHovered ? 2.5 : 1.5}
              rx="4"
              style={{ transition: 'stroke-width 0.15s ease' }}
            />
          </g>
        );
      })()}

      {/* POC Horizontal Highlight & Line */}
      {(() => {
        const yPoc = getY(pocPrice);
        const isHovered = hoveredElement?.type === 'poc';
        
        return (
          <g>
            <rect
              x={profileXStart}
              y={yPoc - 4}
              width={width - padding.right - profileXStart}
              height="8"
              fill="rgba(247, 147, 26, 0.08)"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredElement({
                  type: 'poc',
                  data: { price: pocPrice },
                  x: width / 2,
                  y: yPoc
                });
              }}
            />
            <line
              x1={profileXStart}
              y1={yPoc}
              x2={width - padding.right}
              y2={yPoc}
              stroke="#F7931A"
              strokeWidth={isHovered ? 2.5 : 1.5}
              strokeDasharray="4,3"
              style={{ filter: 'drop-shadow(0 0 3px rgba(247, 147, 26, 0.5))' }}
            />
            <rect
              x={width - padding.right + 2}
              y={yPoc - 8}
              width="72"
              height="16"
              fill="#F7931A"
              rx="3"
            />
            <text
              x={width - padding.right + 38}
              y={yPoc + 4}
              fill="#000"
              fontSize="8"
              fontWeight="900"
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              POC: ${pocPrice.toLocaleString(undefined, { minimumFractionDigits: pocPrice < 1 ? 4 : 2, maximumFractionDigits: pocPrice < 1 ? 4 : 2 })}
            </text>
          </g>
        );
      })()}

      {/* VAH/VAL Bounds */}
      <line
        x1={profileXStart}
        y1={getY(vah)}
        x2={width - padding.right}
        y2={getY(vah)}
        stroke="rgba(255, 255, 255, 0.35)"
        strokeWidth="1"
        strokeDasharray="4,4"
      />
      <text
        x={profileXStart + 5}
        y={getY(vah) - 5}
        fill="rgba(255, 255, 255, 0.5)"
        fontSize="7"
        fontWeight="bold"
      >
        VAH: ${vah.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </text>

      <line
        x1={profileXStart}
        y1={getY(val)}
        x2={width - padding.right}
        y2={getY(val)}
        stroke="rgba(255, 255, 255, 0.35)"
        strokeWidth="1"
        strokeDasharray="4,4"
      />
      <text
        x={profileXStart + 5}
        y={getY(val) + 12}
        fill="rgba(255, 255, 255, 0.5)"
        fontSize="7"
        fontWeight="bold"
      >
        VAL: ${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </text>

      {/* 15m Candlestick series */}
      {visibleCandles.map((c, idx) => {
        const cX = getX(idx);
        const cOpen = getY(c.open);
        const cClose = getY(c.close);
        const cHigh = getY(c.high);
        const cLow = getY(c.low);

        const isToday = c.time >= startOfDayTs;
        const baseColor = c.close >= c.open ? '#00ff88' : '#ff3b30';
        
        const opacity = isToday ? '1' : '0.25';

        const bodyY = Math.min(cOpen, cClose);
        const bodyHeight = Math.max(1.5, Math.abs(cOpen - cClose));

        const isHovered = hoveredElement?.type === 'candle' && hoveredElement.data.time === c.time;

        return (
          <g
            key={c.time}
            opacity={opacity}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => {
              setHoveredElement({
                type: 'candle',
                data: c,
                x: cX,
                y: bodyY
              });
            }}
          >
            <line
              x1={cX}
              y1={cHigh}
              x2={cX}
              y2={cLow}
              stroke={baseColor}
              strokeWidth={isHovered ? 2 : 1}
            />
            <rect
              x={cX - candleWidth / 2}
              y={bodyY}
              width={candleWidth}
              height={bodyHeight}
              fill={baseColor}
              stroke={isHovered ? '#fff' : 'none'}
              strokeWidth="0.5"
            />
          </g>
        );
      })}

      {/* Interactive hover tooltip popup */}
      {hoveredElement && (() => {
        const { type, data, x, y } = hoveredElement;
        const tooltipWidth = type === 'daily' ? 180 : 150;
        const tooltipHeight = type === 'daily' ? 110 : 80;
        
        let tx = x + 15;
        let ty = y - tooltipHeight / 2;

        if (tx + tooltipWidth > width) {
          tx = x - tooltipWidth - 15;
        }
        if (ty < 10) ty = 10;
        if (ty + tooltipHeight > height - 10) ty = height - tooltipHeight - 10;

        return (
          <g>
            <rect
              x={tx}
              y={ty}
              width={tooltipWidth}
              height={tooltipHeight}
              fill="rgba(10, 10, 15, 0.95)"
              stroke="#222"
              strokeWidth="1"
              rx="6"
              style={{ backdropFilter: 'blur(4px)' }}
            />
            {type === 'candle' && (
              <>
                <text x={tx + 10} y={ty + 20} fill="#888" fontSize="10" fontWeight="bold">
                  {new Date(data.time).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </text>
                <text x={tx + 10} y={ty + 40} fill="#fff" fontSize="10">O: ${data.open.toFixed(4)}</text>
                <text x={tx + 10} y={ty + 55} fill="#fff" fontSize="10">H: ${data.high.toFixed(4)}</text>
                <text x={tx + 75} y={ty + 40} fill="#fff" fontSize="10">L: ${data.low.toFixed(4)}</text>
                <text x={tx + 75} y={ty + 55} fill="#fff" fontSize="10">C: ${data.close.toFixed(4)}</text>
                <text x={tx + 10} y={ty + 70} fill="#00d0ff" fontSize="10">Vol: {Math.round(data.volume).toLocaleString()}</text>
              </>
            )}
            {type === 'bin' && (
              <>
                <text x={tx + 10} y={ty + 20} fill="#888" fontSize="10" fontWeight="bold">PRICE LEVEL</text>
                <text x={tx + 10} y={ty + 40} fill="#fff" fontSize="11" fontWeight="bold">
                  ${data.low.toFixed(4)} - ${data.high.toFixed(4)}
                </text>
                <text x={tx + 10} y={ty + 60} fill="#F7931A" fontSize="10" fontWeight="bold">
                  VOL: {Math.round(data.volume).toLocaleString()}
                </text>
              </>
            )}
            {type === 'poc' && (
              <>
                <text x={tx + 10} y={ty + 25} fill="#F7931A" fontSize="11" fontWeight="900">POINT OF CONTROL</text>
                <text x={tx + 10} y={ty + 45} fill="#fff" fontSize="12" fontWeight="bold">
                  ${data.price.toFixed(4)}
                </text>
                <text x={tx + 10} y={ty + 60} fill="#aaa" fontSize="10">
                  Highest volume traded level
                </text>
              </>
            )}
            {type === 'daily' && (
              <>
                <text x={tx + 10} y={ty + 20} fill="#00d0ff" fontSize="11" fontWeight="900">TODAY'S SESSION</text>
                <text x={tx + 10} y={ty + 40} fill="#fff" fontSize="10">Open: ${data.dayOpen.toFixed(4)}</text>
                <text x={tx + 10} y={ty + 55} fill="#fff" fontSize="10">High: ${data.dayHigh.toFixed(4)}</text>
                <text x={tx + 10} y={ty + 70} fill="#fff" fontSize="10">Low: ${data.dayLow.toFixed(4)}</text>
                <text x={tx + 10} y={ty + 85} fill="#fff" fontSize="10">Close: ${data.dayClose.toFixed(4)}</text>
                <text x={tx + 10} y={ty + 100} fill="#F7931A" fontSize="10" fontWeight="bold">
                  Vol: {Math.round(data.dayVolume).toLocaleString()}
                </text>
              </>
            )}
          </g>
        );
      })()}
    </svg>
  );
};

export default VolumeProfileChart;
