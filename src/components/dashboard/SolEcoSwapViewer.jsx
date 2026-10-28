import React, { useState, useEffect } from 'react';
import MiniSyntheticChart from './MiniSyntheticChart';
import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import RelativePerformanceChart from './RelativePerformanceChart';
import DynamicBasketSimulator from './DynamicBasketSimulator';

const SolEcoSwapViewer = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [combinationsData, setCombinationsData] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [activeTimeframe, setActiveTimeframe] = useState('4h');
  const [activeDay, setActiveDay] = useState(0);
  const [pricesMap, setPricesMap] = useState(null);
  const [globalTimes, setGlobalTimes] = useState([]);
  const [macroResetDaily, setMacroResetDaily] = useState(false);
  const [filterDailyCrossovers, setFilterDailyCrossovers] = useState(false);

  const TOKENS = ['SOL', 'JUP', 'ORCA', 'JTO', 'RAY', 'MET'];
  const TIMEFRAMES = ['1M', '1w', '1d', '4h', '1h', '15m'];
  
  // Target start date: Jan 1st, 2024 (or whenever the newest token was listed)
  const TARGET_TIME = new Date('2024-01-01T00:00:00Z').getTime();

  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const fetchPromises = TOKENS.map(async (token) => {
          const symbol = `${token}USDT`;
          let allCandles = [];
          let currentEndTime = Date.now();
          const limit = 1000;
          let passes = 0;
          const MAX_PASSES = 10; // 10000 candles max (~416 days in 1h, ~27 years in 1d)

          while (passes < MAX_PASSES) {
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${activeTimeframe}&limit=${limit}&endTime=${currentEndTime}`);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${symbol}`);
            }
            const data = await response.json();
            
            if (data.length === 0) break;
            
            // Prepend older data
            allCandles = [...data, ...allCandles];
            
            // Set end time for next batch to 1ms before the oldest candle in the current batch
            currentEndTime = data[0][0] - 1;
            
            // Stop if we reached October 2025
            if (data[0][0] <= TARGET_TIME) {
              break;
            }
            
            // Stop if Binance didn't return a full page (meaning we hit the very beginning of the coin's history)
            if (data.length < limit) {
              break;
            }
            
            passes++;
          }
          
          return { token, data: allCandles };
        });

        const results = await Promise.all(fetchPromises);

        if (!isMounted) return;

        // Map data by timestamp
        const pricesByTime = {};
        const allTimes = new Set();

        results.forEach(({ token, data }) => {
          data.forEach(candle => {
            const time = Math.floor(candle[0] / 1000); // lightweight-charts expects seconds for timestamp
            const close = parseFloat(candle[4]);
            if (!pricesByTime[time]) pricesByTime[time] = {};
            pricesByTime[time][token] = close;
            allTimes.add(time);
          });
        });

        const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

        // Filter times where all tokens have data
        const alignedTimes = sortedTimes.filter(t => {
          return TOKENS.every(token => pricesByTime[t][token] !== undefined);
        });

        if (alignedTimes.length === 0) {
          throw new Error("Aucune donnée superposée trouvée pour tous les tokens sur cette période.");
        }

        setPricesMap(pricesByTime);
        setGlobalTimes(alignedTimes);

        // Generate combinations (n * (n-1)) / 2 = 15 pairs for 6 tokens
        const pairs = [];
        for (let i = 0; i < TOKENS.length; i++) {
          for (let j = i + 1; j < TOKENS.length; j++) {
            pairs.push({ base: TOKENS[i], quote: TOKENS[j] });
          }
        }

        // Calculate synthetic prices
        const combos = pairs.map(pair => {
          const comboData = alignedTimes.map(time => {
            const priceBase = pricesByTime[time][pair.base];
            const priceQuote = pricesByTime[time][pair.quote];
            return {
              time,
              value: priceBase / priceQuote
            };
          });

          return {
            name: `${pair.base} / ${pair.quote}`,
            data: comboData
          };
        });

        setCombinationsData(combos);

        // Generate leaderboard by intervals for all loaded days
        try {
          const current = alignedTimes[alignedTimes.length - 1];
          const daysData = [];
          
          const maxDays = Math.min(60, Math.floor((current - alignedTimes[0]) / (24 * 3600)) + 1);
          
          for (let d = 0; d < maxDays; d++) {
            const dayCurrent = current - d * 24 * 3600;
            const t0 = dayCurrent - 24 * 3600;
            
            let t0Time = alignedTimes[0];
            let minDiffT0 = Math.abs(t0Time - t0);
            for(let j=1; j < alignedTimes.length; j++) {
               const diff = Math.abs(alignedTimes[j] - t0);
               if (diff < minDiffT0) {
                  minDiffT0 = diff;
                  t0Time = alignedTimes[j];
               }
            }
            
            let currentDayTime = alignedTimes[0];
            let minDiffCurrent = Math.abs(currentDayTime - dayCurrent);
            for(let j=1; j < alignedTimes.length; j++) {
               const diff = Math.abs(alignedTimes[j] - dayCurrent);
               if (diff < minDiffCurrent) {
                  minDiffCurrent = diff;
                  currentDayTime = alignedTimes[j];
               }
            }
            
            const lData = [];
            
            // Collect times for the chart for this specific day
            const chartTimes = [];
            for (let j = 0; j < alignedTimes.length; j++) {
               if (alignedTimes[j] >= t0 && alignedTimes[j] <= dayCurrent) {
                  chartTimes.push(alignedTimes[j]);
               }
            }
            // Ensure they are sorted (they should be, but just in case)
            chartTimes.sort((a,b) => a - b);
            
            // If T0 is too far away (e.g. 1M timeframe) or we don't have history for this day
            if (minDiffT0 > 3 * 3600 || minDiffCurrent > 3 * 3600) {
              daysData.push({ dayIndex: d, label: d === 0 ? "Aujourd'hui" : d === 1 ? "Hier" : `Jour -${d}`, rows: [], chartTimes: [], valid: false });
              continue;
            }
            
            const offsets = [4, 8, 12, 16, 20, 24];
            
            for (let i = 0; i < offsets.length; i++) {
              const offset = offsets[i];
              const label = `+${offset}h`;
              
              const targetTime = t0 + offset * 3600;
              let closestTime = alignedTimes[0];
              let minDiff = Math.abs(closestTime - targetTime);
              for(let j = 1; j < alignedTimes.length; j++) {
                 const diff = Math.abs(alignedTimes[j] - targetTime);
                 if (diff < minDiff) {
                   minDiff = diff;
                   closestTime = alignedTimes[j];
                 }
              }
              
              if (minDiff > 30 * 60) {
                 lData.push({ label, valid: false });
                 continue;
              }
              
              const tokens = {};
              let maxGain = -Infinity;
              let leader = null;
              
              TOKENS.forEach(tok => {
                 const p0 = pricesByTime[t0Time][tok];
                 const pNow = pricesByTime[closestTime][tok];
                 const gain = ((pNow / p0) - 1) * 100;
                 tokens[tok] = gain;
                 
                 if (gain > maxGain) {
                   maxGain = gain;
                   leader = tok;
                 }
              });
              
              const ranking = TOKENS.slice().sort((a, b) => tokens[b] - tokens[a]);
              lData.push({ label, valid: true, tokens, leader: ranking[0], ranking });
            }
            
            // Row for the last 1 hour of this day
            const lastHourTime = dayCurrent - 3600;
            let closestLastHour = alignedTimes[0];
            let minDiffLastHour = Math.abs(closestLastHour - lastHourTime);
            for(let j=1; j < alignedTimes.length; j++) {
               const diff = Math.abs(alignedTimes[j] - lastHourTime);
               if (diff < minDiffLastHour) {
                 minDiffLastHour = diff;
                 closestLastHour = alignedTimes[j];
               }
            }
            
            if (minDiffLastHour <= 30 * 60) {
               const tokensLast1h = {};
               let maxGain1h = -Infinity;
               let leader1h = null;
               
               TOKENS.forEach(tok => {
                 const pOld = pricesByTime[closestLastHour][tok];
                 const pNow = pricesByTime[currentDayTime][tok];
                 const gain = ((pNow / pOld) - 1) * 100;
                 tokensLast1h[tok] = gain;
                 
                 if (gain > maxGain1h) {
                   maxGain1h = gain;
                   leader1h = tok;
                 }
               });
               const ranking1h = TOKENS.slice().sort((a, b) => tokensLast1h[b] - tokensLast1h[a]);
               lData.unshift({ label: 'Dernière 1h', valid: true, tokens: tokensLast1h, leader: ranking1h[0], ranking: ranking1h });
            } else {
               lData.unshift({ label: 'Dernière 1h', valid: false });
            }
            
            daysData.push({ dayIndex: d, label: d === 0 ? "Aujourd'hui" : d === 1 ? "Hier" : `Jour -${d}`, rows: lData, chartTimes, valid: true });
          }
          
          setLeaderboardData(daysData);
        } catch(e) {
          console.error("Leaderboard calculation error", e);
        }
      } catch (err) {
        console.error("Error building swap viewer data:", err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [activeTimeframe]);

  const calculate24hChange = (data) => {
    if (!data || data.length < 2) return null;
    const current = data[data.length - 1];
    const targetTime = current.time - 86400; // 24 hours ago in seconds
    
    let closest = data[0];
    let minDiff = Math.abs(closest.time - targetTime);
    
    for (let i = 1; i < data.length; i++) {
      const diff = Math.abs(data[i].time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = data[i];
      }
    }
    
    // If the closest point is more than 3 days away (e.g., 1w or 1M timeframe), we don't have accurate 24h data
    if (minDiff > 86400 * 3) return null;

    const gain = (current.value / closest.value) - 1;
    return gain;
  };

  const formatPercent = (val) => {
    return (val * 100).toFixed(2) + '%';
  };

  return (
    <div style={{ padding: '20px', color: '#fff', minHeight: '100vh', background: 'transparent', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px', background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#00d2ff' }}>
            ECOSYSTEM SWAP VIEWER (Reference Zone)
          </h1>
          
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '4px' }}>
            {TIMEFRAMES.map((tf) => (
              <button 
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                style={{ 
                  padding: '6px 12px', 
                  background: activeTimeframe === tf ? '#00d2ff' : 'transparent', 
                  color: activeTimeframe === tf ? '#000' : '#888', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
          Analyse de toutes les combinaisons synthétiques de l'écosystème Solana (SOL, JUP, ORCA, JTO, RAY, MET).
          Cette vue sous forme de grille permet de comparer la force relative entre chaque paire de jetons en un coup d'œil.
        </p>

        <div style={{ marginTop: '15px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#cbd5e1' }}>Matrice de contrôle de l'écosystème :</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', maxWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', color: '#94a3b8', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '6px 10px' }}>Pair 1</th>
                  <th style={{ padding: '6px 10px' }}>Pair 2</th>
                  <th style={{ padding: '6px 10px', color: '#00d2ff' }}>Pair de contrôle</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { p1: "JUP/SOL", p2: "ORCA/SOL", control: "JUP/ORCA" },
                  { p1: "JUP/SOL", p2: "JTO/SOL", control: "JUP/JTO" },
                  { p1: "JUP/SOL", p2: "RAY/SOL", control: "JUP/RAY" },
                  { p1: "JUP/SOL", p2: "MET/SOL", control: "JUP/MET" },
                  { p1: "ORCA/SOL", p2: "JTO/SOL", control: "ORCA/JTO" },
                  { p1: "ORCA/SOL", p2: "RAY/SOL", control: "ORCA/RAY" },
                  { p1: "ORCA/SOL", p2: "MET/SOL", control: "ORCA/MET" },
                  { p1: "JTO/SOL", p2: "RAY/SOL", control: "JTO/RAY" },
                  { p1: "JTO/SOL", p2: "MET/SOL", control: "JTO/MET" },
                  { p1: "RAY/SOL", p2: "MET/SOL", control: "RAY/MET" }
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '4px 10px' }}>{row.p1}</td>
                    <td style={{ padding: '4px 10px' }}>{row.p2}</td>
                    <td style={{ padding: '4px 10px', fontWeight: 'bold', color: '#e2e8f0' }}>{row.control}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MACRO CHART */}
        {pricesMap && globalTimes.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', color: '#00d2ff', margin: '0 0 5px 0' }}>Macro Analysis (Tous les historiques chargés)</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '15px', marginTop: 0 }}>
                  Ce graphique affiche la performance relative de l'écosystème sur toute la période chargée ({globalTimes.length} bougies de {activeTimeframe}).
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <input 
                  type="checkbox" 
                  checked={macroResetDaily} 
                  onChange={(e) => setMacroResetDaily(e.target.checked)} 
                  style={{ accentColor: '#00d2ff' }}
                />
                Isoler les jours (Reset 0%)
              </label>
            </div>
            
            <RelativePerformanceChart 
               pricesByTime={pricesMap} 
               alignedTimes={globalTimes}
               tokens={['SOL', 'JUP', 'ORCA', 'JTO', 'RAY', 'MET']}
               referenceToken="SOL"
               resetDaily={macroResetDaily}
            />
          </div>
        )}

        {/* SIMULATOR */}
        {pricesMap && globalTimes.length > 0 && (
           <DynamicBasketSimulator 
              pricesMap={pricesMap}
              globalTimes={globalTimes}
              tokens={TOKENS}
           />
        )}

        {leaderboardData && leaderboardData.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#00d2ff', margin: 0 }}>Analyse Quotidienne ({leaderboardData.length} jours)</h2>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <input 
                  type="checkbox" 
                  checked={filterDailyCrossovers} 
                  onChange={(e) => setFilterDailyCrossovers(e.target.checked)} 
                  style={{ accentColor: '#00d2ff' }}
                />
                Afficher uniquement les tokens avec Crossover (Zero-Cross)
              </label>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
              {leaderboardData.map((day) => {
                if (!day.valid) return null;
                
                // Determine which tokens to show
                let tokensToPass = ['SOL', 'JUP', 'ORCA', 'JTO', 'RAY', 'MET'];
                if (filterDailyCrossovers && pricesMap && day.chartTimes.length > 0) {
                   const t0 = day.chartTimes[0];
                   const filteredAlts = ['JUP', 'ORCA', 'JTO', 'RAY', 'MET'].filter(tok => {
                       let hasBeenNegative = false;
                       let validCrossover = false;
                       const p0Sol = pricesMap[t0]['SOL'];
                       const p0Tok = pricesMap[t0][tok];
                       
                       for (let i = 0; i < day.chartTimes.length; i++) {
                           const t = day.chartTimes[i];
                           const pNowSol = pricesMap[t]['SOL'];
                           const solReturn = (pNowSol - p0Sol) / p0Sol;
                           
                           const pNowTok = pricesMap[t][tok];
                           const tokReturn = (pNowTok - p0Tok) / p0Tok;
                           
                           const rel = tokReturn - solReturn;
                           if (rel < -0.0001) hasBeenNegative = true;
                           if (hasBeenNegative && rel > 0.0001) validCrossover = true;
                       }
                       return validCrossover;
                   });
                   tokensToPass = ['SOL', ...filteredAlts];
                }
                
                // If filter is active and NO altcoin crossed, maybe we don't even render the chart?
                // The user said "qui laisse juste les tokens". If no token crossed, the chart would just be SOL. We can render it with just SOL or skip it. Let's render it with just SOL.
                
                return (
                  <div key={day.dayIndex} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: '#cbd5e1' }}>{day.label}</h3>
                      {day.rows && day.rows.length > 0 && day.rows[day.rows.length - 1].leader && (
                         <span style={{ fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '3px 8px', borderRadius: '12px' }}>
                           Gagnant: {day.rows[day.rows.length - 1].leader}
                         </span>
                      )}
                    </div>
                    <RelativePerformanceChart 
                       pricesByTime={pricesMap} 
                       alignedTimes={day.chartTimes}
                       tokens={tokensToPass}
                       referenceToken="SOL"
                       height={220}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#94a3b8' }}>
          <Loader2 size={32} color="#00d2ff" style={{ animation: 'spin 1s linear infinite', marginBottom: '15px' }} />
          <p>Construction des prix synthétiques...</p>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '20px', borderRadius: '8px', color: '#f87171', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>Erreur lors de la récupération des données :</h2>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {!loading && !error && combinationsData.length > 0 && (
        <>
          {/* Tableau de bord 24h */}
          <div style={{ marginBottom: '25px', background: 'rgba(25, 30, 40, 0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#cbd5e1' }}>Performances 24h (Paires Synthétiques)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {combinationsData.map((combo, index) => {
                const gain = calculate24hChange(combo.data);
                const isPositive = gain > 0;
                const isNeutral = gain === 0 || gain === null;
                const color = isNeutral ? '#94a3b8' : isPositive ? '#10b981' : '#ef4444';
                const bg = isNeutral ? 'rgba(148, 163, 184, 0.1)' : isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

                return (
                  <div key={index} style={{ background: bg, border: `1px solid ${color}40`, borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '4px' }}>{combo.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: color, fontWeight: 'bold' }}>
                      {gain !== null ? (
                        <>
                          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {isPositive ? '+' : ''}{formatPercent(gain)}
                        </>
                      ) : (
                        <span style={{ fontSize: '0.8rem' }}>N/A (Tf trop grand)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grille des graphiques */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px',
            width: '100%',
            paddingBottom: '40px'
          }}>
          {combinationsData.map((combo, index) => (
            <div key={index}>
              <MiniSyntheticChart 
                title={combo.name} 
                data={combo.data} 
              />
            </div>
          ))}
        </div>
        </>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default SolEcoSwapViewer;
