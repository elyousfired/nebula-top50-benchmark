import { fetchBaseAssetCandles, buildSyntheticCandles, detectPivots } from './momentumScanner';
import { detectChannel } from './channelDetector';
import { fetchBybitData, fetchBinanceData } from './scanner';
import { evaluateCurrentTokenEvolution } from './evolutionEngine';

export const findBestToken = async (topTokens) => {
  if (!topTokens || topTokens.length === 0) return null;

  let bestToken = null;
  let bestScore = -Infinity;

  let evolutionRules = [];
  try {
    const parsed = JSON.parse(localStorage.getItem('nebula_evolution_rules') || '[]');
    if (Array.isArray(parsed)) evolutionRules = parsed;
  } catch (e) {}

  for (const token of topTokens) {
    try {
      // 1. Fetch 1H candles for precise RR and Support/Resistance
      const tf = '60'; // 1H timeframe
      const fetchSymbol = token.symbol.includes('USDT') ? token.symbol : `${token.symbol}USDT`;
      
      const [solMap, rawTokenData] = await Promise.all([
        fetchBaseAssetCandles('SOLUSDT', tf, 'bybit'),
        token.exchange === 'binance' ? fetchBinanceData(fetchSymbol, tf, 200) : fetchBybitData(fetchSymbol, tf, 200)
      ]);

      if (!rawTokenData || rawTokenData.length === 0 || !solMap || solMap.size === 0) {
        continue;
      }

      const tokenCandles = [...rawTokenData].reverse().map(k => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
        turnover: Number(k[6] || 0)
      }));

      const syntheticCandles = buildSyntheticCandles(tokenCandles, solMap);
      if (syntheticCandles.length < 50) continue;

      // 2. Channel Analysis
      const channel = detectChannel(syntheticCandles);
      
      // 3. Support and Resistance (Pivots)
      const pivots = detectPivots(syntheticCandles, 5); // Window 5 for stronger pivots on 1H
      const currentPrice = syntheticCandles[syntheticCandles.length - 1].close;
      
      let nearestSupport = null;
      let nearestResistance = null;

      // Find highest pivot below current price
      const lows = pivots.filter(p => p.type === 'L' && p.value < currentPrice);
      if (lows.length > 0) {
        nearestSupport = lows[lows.length - 1].value;
      }

      // Find lowest pivot above current price
      const highs = pivots.filter(p => p.type === 'H' && p.value > currentPrice);
      if (highs.length > 0) {
        nearestResistance = highs[0].value;
      }

      // Fallbacks if pivots are not perfectly formed around current price
      if (!nearestSupport) nearestSupport = currentPrice * 0.90; // Fallback 10% SL
      if (!nearestResistance) nearestResistance = currentPrice * 1.20; // Fallback 20% TP

      // 4. Calculate Risk/Reward
      const risk = currentPrice - nearestSupport;
      const reward = nearestResistance - currentPrice;
      const rr = risk > 0 ? (reward / risk) : 0;

      // 5. Score Calculation
      let aiScore = token.score; // Base score from momentum table (0-100)
      
      // Bonus for RR
      if (rr > 3) aiScore += 15;
      else if (rr > 2) aiScore += 10;
      else if (rr > 1.5) aiScore += 5;
      else aiScore -= 10; // Penalize bad RR

      // Bonus for Channel Trend
      if (channel.status !== "No clean channel") {
        if (channel.quality > 30) {
          aiScore += 5; // Clean channel
        }
      }

      // Bonus if very close to support (Dip buying)
      const distToSupportPct = risk / currentPrice;
      let dipBonus = false;
      if (distToSupportPct < 0.05 && distToSupportPct > 0.01) {
        aiScore += 10; // Within 1-5% of support
        dipBonus = true;
      }

      if (aiScore > bestScore) {
        bestScore = aiScore;
        
        // Generate Detailed Reason Text
        const riskPct = ((risk / currentPrice) * 100).toFixed(1);
        const rewardPct = ((reward / currentPrice) * 100).toFixed(1);
        
        let reasonStr = `🎯 **Configuration Idéale Repérée**\n\n`;
        reasonStr += `• **Momentum (Score: ${token.score})** : Le token affiche une force impressionnante contre le Solana. Les algorithmes confirment une forte pression acheteuse.\n`;
        
        if (channel.status !== "No clean channel") {
          reasonStr += `• **Tendance** : Évolue dans un canal ${channel.status === 'Ascending' ? 'haussier' : 'clair'} avec une structure de prix propre.\n`;
        }
        
        reasonStr += `• **Point d'Entrée Stratégique** : ${dipBonus ? "Le prix a corrigé et se trouve exactement sur une zone de support clé (Achat du creux / Dip Buying)." : "La structure actuelle permet une entrée avec un risque maîtrisé."}\n`;
        reasonStr += `• **Risk/Reward Exceptionnel (${rr.toFixed(1)}x)** : Le potentiel de gain est de +${rewardPct}% jusqu'à la prochaine résistance, pour un risque de perte limité à -${riskPct}% sous le support majeur.`;
        
        // Market Evolution Matching
        const evolutionMatch = evaluateCurrentTokenEvolution(syntheticCandles, evolutionRules);
        if (evolutionMatch && evolutionMatch.matchedCluster) {
          const winRate = evolutionMatch.matchedCluster.winRate.toFixed(1);
          reasonStr += `\n🧬 **Évolution Génétique** : Ce token suit actuellement la séquence évolutive "${evolutionMatch.sequence}", qui possède un taux de réussite historique de **${winRate}%** !`;
          aiScore += (evolutionMatch.matchedCluster.winRate > 60) ? 15 : 0;
        }

        bestToken = {
          ...token,
          aiScore,
          entryPrice: currentPrice,
          stopLoss: nearestSupport,
          takeProfit: nearestResistance,
          rr: rr.toFixed(2),
          channelStatus: channel.status,
          reason: reasonStr
        };
      }

    } catch (e) {
      console.error("AI Auto-pick error on token", token.symbol, e);
    }
  }

  return bestToken;
};
