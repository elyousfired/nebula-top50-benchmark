import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const formatMoney = (val) => {
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(2) + 'k';
  return val.toFixed(2);
};

const CvdCandlesScanner = () => {
  const [symbol, setSymbol] = useState('MONUSDT');
  const [customSymbol, setCustomSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('15m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const chartContainer1 = useRef(null);
  const chartContainer2 = useRef(null);
  const chartRef1 = useRef(null);
  const chartRef2 = useRef(null);
  const seriesRef1 = useRef(null);
  const seriesRef2 = useRef(null);

  const activeSymbol = customSymbol.trim().toUpperCase() || symbol;

  useEffect(() => {
    let active = true;
    let isInitialLoad = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let subInterval = '5';
        let blockMs = 15 * 60 * 1000;
        
        if (timeframe === '15m') { subInterval = '5'; blockMs = 15 * 60 * 1000; }
        else if (timeframe === '1h') { subInterval = '15'; blockMs = 60 * 60 * 1000; }
        else if (timeframe === '4H') { subInterval = '15'; blockMs = 4 * 60 * 60 * 1000; }
        else if (timeframe === '1D') { subInterval = '60'; blockMs = 24 * 60 * 60 * 1000; }
        else if (timeframe === '1W') { subInterval = 'D'; blockMs = 7 * 24 * 60 * 60 * 1000; }

        // Fetch up to 15,000 candles (15 pages) to get maximum history
        let allList = [];
        let end = Date.now();
        const MAX_PAGES = 15;
        
        for (let i = 0; i < MAX_PAGES; i++) {
          const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${activeSymbol}&interval=${subInterval}&limit=1000&end=${end}`;
          const response = await fetch(url);
          const json = await response.json();
          
          if (json.retCode !== 0 || !json.result || !json.result.list || json.result.list.length === 0) {
            if (i === 0) throw new Error(json.retMsg || "Erreur de chargement des données");
            break; // Stop if no more data
          }
          
          allList.push(...json.result.list);
          
          const oldestInBatch = parseInt(json.result.list[json.result.list.length - 1][0]);
          end = oldestInBatch - 1; // Next page starts right before the oldest candle of this batch
        }

        const subKlines = [...allList].reverse(); // Oldest first

        // Fetch Daily data for PDH and PDL before processing subKlines
        let pdh = null;
        let pdl = null;
        let yesterdayStartMs = null;
        let yesterdayEndMs = null;

        try {
          const dailyUrl = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${activeSymbol}&interval=D&limit=2`;
          const dailyResponse = await fetch(dailyUrl);
          const dailyJson = await dailyResponse.json();
          if (dailyJson.retCode === 0 && dailyJson.result && dailyJson.result.list && dailyJson.result.list.length >= 2) {
            yesterdayStartMs = parseInt(dailyJson.result.list[1][0]);
            yesterdayEndMs = yesterdayStartMs + 86400000;
            pdh = parseFloat(dailyJson.result.list[1][2]); // Index 2 is High
            pdl = parseFloat(dailyJson.result.list[1][3]); // Index 3 is Low
          }
        } catch (err) {
          console.error("Failed to fetch PDH/PDL", err);
        }

        const blocks = {};
        const blockOrder = [];
        let globalSubCumulativeFlow = 0;
        
        let cvdAtPdh = null;
        let cvdAtPdl = null;
        let closestPdhDiff = Infinity;
        let closestPdlDiff = Infinity;

        subKlines.forEach(k => {
          const timeMs = parseInt(k[0]);
          const open = parseFloat(k[1]);
          const high = parseFloat(k[2]);
          const low = parseFloat(k[3]);
          const close = parseFloat(k[4]);
          const volume = parseFloat(k[5]);
          const turnover = parseFloat(k[6]);
          
          let flow = 0;
          if (open > 0) {
            flow = turnover * ((close - open) / open);
          }
          
          globalSubCumulativeFlow += flow;
          
          // Precise PDH/PDL tracking on the lowest timeframe
          if (yesterdayStartMs !== null && timeMs >= yesterdayStartMs && timeMs < yesterdayEndMs) {
            const diffToPdh = Math.abs(high - pdh);
            if (diffToPdh < closestPdhDiff) {
              closestPdhDiff = diffToPdh;
              cvdAtPdh = globalSubCumulativeFlow; // Capture CVD at exact high
            }
            
            const diffToPdl = Math.abs(low - pdl);
            if (diffToPdl < closestPdlDiff) {
              closestPdlDiff = diffToPdl;
              cvdAtPdl = globalSubCumulativeFlow; // Capture CVD at exact low
            }
          }
          
          let blockTime;
          if (timeframe === '1W') {
             blockTime = Math.floor((timeMs - 345600000) / 604800000) * 604800000 + 345600000; // Monday alignment
          } else {
             blockTime = Math.floor(timeMs / blockMs) * blockMs;
          }

          if (!blocks[blockTime]) {
            blocks[blockTime] = {
              time: blockTime,
              open: open,
              high: high,
              low: low,
              close: close,
              totalFlow: 0,
              maxAbsFlow: -1,
              pocPrice: close,
              cvdPocValue: globalSubCumulativeFlow - (flow / 2)
            };
            blockOrder.push(blockTime);
          }
          
          const b = blocks[blockTime];
          b.close = close; // Updates to the last sub-candle
          b.high = Math.max(b.high, high);
          b.low = Math.min(b.low, low);
          b.totalFlow += flow;
          
          // POC Logic: the price level of the sub-candle with the largest net flow
          if (Math.abs(flow) > b.maxAbsFlow) {
            b.maxAbsFlow = Math.abs(flow);
            b.pocPrice = (high + low + close) / 3;
            b.cvdPocValue = globalSubCumulativeFlow - (flow / 2);
          }
        });

        let cumulativeFlow = 0;
        const cvdData = [];
        const cvdPocData = [];
        const priceData = [];
        const pocData = []; // True Flow POC

        blockOrder.forEach(bt => {
          const b = blocks[bt];
          
          const prevFlow = cumulativeFlow;
          cumulativeFlow += b.totalFlow;
          
          const cvdHigh = Math.max(prevFlow, cumulativeFlow);
          const cvdLow = Math.min(prevFlow, cumulativeFlow);

          cvdData.push({
            time: bt / 1000,
            open: prevFlow,
            high: cvdHigh,
            low: cvdLow,
            close: cumulativeFlow
          });

          priceData.push({
            time: bt / 1000,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close
          });
          
          cvdPocData.push({
            time: bt / 1000,
            value: b.cvdPocValue
          });
          
          pocData.push({
            time: bt / 1000,
            value: b.pocPrice
          });
        });

        if (!active) return;

        let prec = 2;
        let minM = 0.01;
        if (priceData.length > 0) {
          const samplePrice = priceData[0].close;
          if (samplePrice < 0.01) { prec = 6; minM = 0.000001; }
          else if (samplePrice < 1) { prec = 5; minM = 0.00001; }
          else if (samplePrice < 10) { prec = 4; minM = 0.0001; }
          else if (samplePrice < 100) { prec = 3; minM = 0.001; }
        }

        // Render charts
        if (chartContainer1.current && chartContainer2.current) {
          if (!chartRef1.current) {
            // CVD Candlestick Chart
            const chart1 = createChart(chartContainer1.current, {
              height: 400,
              layout: { background: { type: 'solid', color: '#1e293b' }, textColor: '#cbd5e1' },
              grid: { vertLines: { color: '#334155' }, horzLines: { color: '#334155' } },
              timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#334155' },
              rightPriceScale: { borderColor: '#334155' }
            });
            
            const cvdSeries = chart1.addCandlestickSeries({
              upColor: '#22c55e',
              downColor: '#ef4444',
              borderVisible: false,
              wickUpColor: '#22c55e',
              wickDownColor: '#ef4444'
            });

            if (cvdAtPdh !== null) {
              cvdSeries.createPriceLine({
                price: cvdAtPdh,
                color: '#22c55e',
                lineWidth: 2,
                lineStyle: 2,
                axisLabelVisible: true,
                title: 'CVD at PDH',
              });
            }
            if (cvdAtPdl !== null) {
              cvdSeries.createPriceLine({
                price: cvdAtPdl,
                color: '#ef4444',
                lineWidth: 2,
                lineStyle: 2,
                axisLabelVisible: true,
                title: 'CVD at PDL',
              });
            }

            const cvdPocSeries = chart1.addLineSeries({
              color: '#fbbf24', // Gold color for POC
              lineWidth: 2,
              lineStyle: 2, // Dotted line
              title: 'POC (Net Flow)',
              priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
              }
            });

            // Price Candlestick Chart
            const chart2 = createChart(chartContainer2.current, {
              height: 200,
              layout: { background: { type: 'solid', color: '#1e293b' }, textColor: '#cbd5e1' },
              grid: { vertLines: { color: '#334155' }, horzLines: { color: '#334155' } },
              timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#334155' },
              rightPriceScale: { borderColor: '#334155' }
            });

            const priceSeries = chart2.addCandlestickSeries({
              upColor: '#22c55e',
              downColor: '#ef4444',
              borderVisible: false,
              wickUpColor: '#22c55e',
              wickDownColor: '#ef4444',
              priceFormat: {
                type: 'price',
                precision: prec,
                minMove: minM,
              }
            });

            if (pdh !== null) {
              priceSeries.createPriceLine({
                price: pdh,
                color: '#22c55e',
                lineWidth: 2,
                lineStyle: 2,
                axisLabelVisible: true,
                title: 'PDH',
              });
            }
            if (pdl !== null) {
              priceSeries.createPriceLine({
                price: pdl,
                color: '#ef4444',
                lineWidth: 2,
                lineStyle: 2,
                axisLabelVisible: true,
                title: 'PDL',
              });
            }

            const pocSeries = chart2.addLineSeries({
              color: '#fbbf24', // Gold color for POC
              lineWidth: 2,
              lineStyle: 2, // Dotted line
              title: 'POC (Vol Node)',
              priceFormat: {
                type: 'price',
                precision: prec,
                minMove: minM,
              }
            });

            chartRef1.current = chart1;
            chartRef2.current = chart2;
            seriesRef1.current = { cvdSeries, cvdPocSeries };
            seriesRef2.current = { priceSeries, pocSeries };
            
            // Sync crosshairs
            chart1.subscribeCrosshairMove(param => {
              if (param.time) {
                chart2.setCrosshairPosition(param.point.value, param.time, priceSeries);
              }
            });
            chart2.subscribeCrosshairMove(param => {
              if (param.time) {
                chart1.setCrosshairPosition(param.point.value, param.time, cvdSeries);
              }
            });

            // Synchronize charts
            const timeScale1 = chartRef1.current.timeScale();
            const timeScale2 = chartRef2.current.timeScale();
            
            timeScale1.subscribeVisibleTimeRangeChange((logicalRange) => {
              timeScale2.setVisibleLogicalRange(logicalRange);
            });
            timeScale2.subscribeVisibleTimeRangeChange((logicalRange) => {
              timeScale1.setVisibleLogicalRange(logicalRange);
            });
          }

          seriesRef1.current.cvdSeries.setData(cvdData);
          seriesRef1.current.cvdPocSeries.setData(cvdPocData);
          seriesRef2.current.priceSeries.setData(priceData);
          seriesRef2.current.pocSeries.setData(pocData);
          
          if (cvdData.length > 0 && isInitialLoad) {
            chartRef1.current.timeScale().fitContent();
            chartRef2.current.timeScale().fitContent();
            isInitialLoad = false;
          }
        }

      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 60000); // 1 min update

    return () => {
      active = false;
      clearInterval(interval);
      if (chartRef1.current) {
        chartRef1.current.remove();
        chartRef1.current = null;
      }
      if (chartRef2.current) {
        chartRef2.current.remove();
        chartRef2.current = null;
      }
    };
  }, [activeSymbol, timeframe]);

  return (
    <div style={{ padding: '20px', color: '#fff', background: '#0f172a', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>📊</span>
          <span>CVD Candlesticks ({timeframe})</span>
        </h2>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{ padding: '10px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '1rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="15m">15m Candles</option>
            <option value="1h">1h Candles</option>
            <option value="4H">4H Candles</option>
            <option value="1D">1D (Daily)</option>
            <option value="1W">1W (Weekly)</option>
          </select>

          <select 
            value={symbol}
            onChange={(e) => { setSymbol(e.target.value); setCustomSymbol(''); }}
            style={{ padding: '10px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '1rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="MONUSDT">MONAD (MONUSDT)</option>
            <option value="HYPEUSDT">HYPE (HYPEUSDT)</option>
            <option value="ASTERUSDT">ASTAR (ASTERUSDT)</option>
            <option value="BTCUSDT">BITCOIN (BTCUSDT)</option>
            <option value="ETHUSDT">ETHEREUM (ETHUSDT)</option>
            <option value="SOLUSDT">SOLANA (SOLUSDT)</option>
          </select>

          <input 
            type="text" 
            placeholder="Custom (ex: XRPUSDT)" 
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
            style={{ padding: '10px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '1rem', outline: 'none', width: '180px' }}
          />
        </div>
      </div>

      {error && (
        <div style={{ background: '#ef444420', color: '#ef4444', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ef444450' }}>
          ❌ Error loading data for {activeSymbol}: {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
        
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', fontSize: '1.2rem', color: '#38bdf8' }}>
            Aggregating {timeframe === '15m' ? '1-minute' : timeframe === '1h' ? '5-minute' : timeframe === '4H' ? '15-minute' : timeframe === '1D' ? '1-hour' : '4-hour'} Net Flow into {timeframe} CVD Candles...
          </div>
        )}

        {/* CVD Candlestick Chart */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>{activeSymbol} Net Flow (CVD)</h3>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Aggregated {timeframe} Candles | Y-Axis: Cumulative Flow ($)</span>
          </div>
          <div ref={chartContainer1} style={{ width: '100%', height: '400px' }} />
        </div>

        {/* Price Line Chart */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>{activeSymbol} Price</h3>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{timeframe} Close Price | Y-Axis: Price ($)</span>
          </div>
          <div ref={chartContainer2} style={{ width: '100%', height: '200px' }} />
        </div>
      </div>
    </div>
  );
};

export default CvdCandlesScanner;
