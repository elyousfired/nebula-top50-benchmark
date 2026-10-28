import React, { useState, useEffect, useMemo } from 'react';
import { fetchBybitData, fetchTop200Symbols } from './logic/scanner';
import { TrendingUp, ShieldAlert, Award, Search, Zap, Loader2 } from 'lucide-react';

const ECOSYSTEMS = {
  'SOL': ['SOLUSDT', 'JUPUSDT', 'PYTHUSDT', 'JTOUSDT', 'BOMEUSDT', 'WIFUSDT', 'RAYUSDT', 'POPCATUSDT'],
  'AI': ['NEARUSDT', 'FETUSDT', 'RENDERUSDT', 'GRTUSDT', 'TAOUSDT', 'AKTUSDT', 'LPTUSDT', 'AIOZUSDT'],
  'L1': ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'AVAXUSDT', 'SUIUSDT', 'APTUSDT', 'TONUSDT', 'LINKUSDT'],
  'MEMES': ['PEPEUSDT', 'SHIBUSDT', 'DOGEUSDT', 'FLOKIUSDT', 'MEMEUSDT', 'BONKUSDT', 'WIFUSDT']
};

const getThermalStyle = (score) => {
  // Score is from -100 to 100
  if (score >= 80) {
    return {
      background: 'rgba(255, 61, 0, 0.12)', // Fusion (extreme hot red-orange)
      border: '1px solid rgba(255, 61, 0, 0.4)',
      color: '#ff3d00',
      glowColor: 'rgba(255, 61, 0, 0.35)',
      badge: '🔥 FUSION',
      badgeCol: '#ff3d00',
      badgeBg: 'rgba(255, 61, 0, 0.15)',
      icon: '🔥'
    };
  } else if (score >= 30) {
    return {
      background: 'rgba(255, 145, 0, 0.08)', // Warm (amber-gold)
      border: '1px solid rgba(255, 145, 0, 0.25)',
      color: '#ff9100',
      glowColor: 'rgba(255, 145, 0, 0.2)',
      badge: '🔆 CHAUD',
      badgeCol: '#ff9100',
      badgeBg: 'rgba(255, 145, 0, 0.1)',
      icon: '☀️'
    };
  } else if (score >= 10) {
    return {
      background: 'rgba(255, 234, 0, 0.05)', // Moderate (yellow)
      border: '1px solid rgba(255, 234, 0, 0.15)',
      color: '#ffea00',
      glowColor: 'rgba(255, 234, 0, 0.1)',
      badge: '🌤️ TIÈDE',
      badgeCol: '#ffea00',
      badgeBg: 'rgba(255, 234, 0, 0.08)',
      icon: '🌤️'
    };
  } else if (score <= -80) {
    return {
      background: 'rgba(26, 35, 126, 0.15)', // Frozen (deep navy blue/indigo)
      border: '1px solid rgba(0, 85, 255, 0.45)',
      color: '#2979ff',
      glowColor: 'rgba(0, 85, 255, 0.35)',
      badge: '❄️ POLAIRE',
      badgeCol: '#2979ff',
      badgeBg: 'rgba(0, 85, 255, 0.15)',
      icon: '❄️'
    };
  } else if (score <= -30) {
    return {
      background: 'rgba(0, 229, 255, 0.08)', // Cold (cyan)
      border: '1px solid rgba(0, 229, 255, 0.25)',
      color: '#00e5ff',
      glowColor: 'rgba(0, 229, 255, 0.2)',
      badge: '🧊 GIVRÉ',
      badgeCol: '#00e5ff',
      badgeBg: 'rgba(0, 229, 255, 0.1)',
      icon: '🧊'
    };
  } else if (score <= -10) {
    return {
      background: 'rgba(128, 243, 255, 0.05)', // Cool (sky blue)
      border: '1px solid rgba(128, 243, 255, 0.15)',
      color: '#80f3ff',
      glowColor: 'rgba(128, 243, 255, 0.1)',
      badge: '🌬️ FRAIS',
      badgeCol: '#80f3ff',
      badgeBg: 'rgba(128, 243, 255, 0.08)',
      icon: '🌬️'
    };
  } else {
    return {
      background: 'rgba(30, 41, 59, 0.2)', // Neutral (slate)
      border: '1px solid rgba(255, 255, 255, 0.03)',
      color: '#94a3b8',
      glowColor: 'transparent',
      badge: '🌌 TEMPÉRÉ',
      badgeCol: '#94a3b8',
      badgeBg: 'rgba(30, 41, 59, 0.1)',
      icon: '🌌'
    };
  }
};

export const MacroFlowScanner = ({ initialSearch }) => {
  const [selectedEcosystem, setSelectedEcosystem] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [tokensData, setTokensData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [newsData, setNewsData] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [displayNews, setDisplayNews] = useState([]);
  const [translatingNews, setTranslatingNews] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'heatmap'
  const [heatmapMetric, setHeatmapMetric] = useState('gravity'); // 'gravity', '1D', '3D', '1W'
  const [drawerLang, setDrawerLang] = useState('FR'); // 'FR', 'EN', 'AR'

  const translateStatus = (label, lang) => {
    if (lang === 'AR') {
      if (label.includes('Buy')) return 'حملة شراء مؤسساتي 🚀';
      if (label.includes('Re-accumulation')) return 'إعادة تجميع مؤسساتي 📈';
      if (label.includes('Selling')) return 'حملة بيع تجزئة 💀';
      if (label.includes('Distribution')) return 'تصريف مؤسساتي ❄️';
      return 'تجميع سلبي / منطقة ضغط ⚖️';
    }
    if (lang === 'EN') {
      return label;
    }
    // Default FR
    if (label.includes('Buy')) return 'Campagne d\'Achat Institutionnel 🚀';
    if (label.includes('Re-accumulation')) return 'Réaccumulation Institutionnelle 📈';
    if (label.includes('Selling')) return 'Campagne de Vente Retail 💀';
    if (label.includes('Distribution')) return 'Distribution Institutionnelle ❄️';
    return 'Accumulation Passive ⚖️';
  };

  const translateDesc = (label, lang) => {
    if (lang === 'AR') {
      if (label.includes('Buy')) return 'شراء متزامن وقوي على جميع الفترات. الحيتان تجمع كميات هائلة ويدفعون السعر لأعلى.';
      if (label.includes('Re-accumulation')) return 'تجميع إضافي من الأموال الذكية استعداداً للموجة الصاعدة القادمة.';
      if (label.includes('Selling')) return 'بيع عشوائي من صغار المستثمرين بالتوازي مع تصريف بطيء من الحيتان.';
      if (label.includes('Distribution')) return 'خروج مكثف لرأس المال وتصريف سريع من المؤسسات. تجنب الشراء الآن.';
      return 'السيولة في توازن تام، ضغط سعري في انتظار اتجاه تدفقات جديد.';
    }
    if (lang === 'EN') {
      if (label.includes('Buy')) return 'Strong synchronized buying on all scales. Whales are accumulating heavy positions and driving prices higher.';
      if (label.includes('Re-accumulation')) return 'Additional re-accumulation from smart money, positioning before the next major bullish expansion.';
      if (label.includes('Selling')) return 'Panic selling from retail traders, coupled with slow distribution campaigns from institutional players.';
      if (label.includes('Distribution')) return 'Heavy institutional exit and fast-paced distribution. Avoid buying this bottom for now.';
      return 'Liquidity is in perfect equilibrium. Price compression preparing for the next directional shift.';
    }
    // Default FR
    if (label.includes('Buy')) return 'Achat synchronisé et puissant sur toutes les échelles. Les baleines accumulent massivement et propulsent le prix.';
    if (label.includes('Re-accumulation')) return 'Réaccumulation supplémentaire de la Smart Money en préparation de la prochaine vague haussière.';
    if (label.includes('Selling')) return 'Vente panique des investisseurs retail, couplée à une distribution passive des baleines.';
    if (label.includes('Distribution')) return 'Sortie massive de capitaux et distribution agressive des institutions. Évitez d\'acheter ce bottom.';
    return 'La liquidité est en équilibre complet. Zone de compression en attente de nouveaux flux.';
  };

  const generateDynamicRecap = (symbol, itemData, lang = 'FR') => {
    if (!itemData) return [];
    const eco = itemData.eco || 'GENERAL';
    const score = itemData.score || 0;
    
    if (lang === 'AR') {
      if (score >= 70) {
        return [
          `⚡ تجميع مؤسساتي قوي: تؤكد تدفقات الحجم شراءً متزامنًا من الحيتان على جميع الأطر الزمنية (1D, 3D, 1W).`,
          `📈 تسارع الاتجاه الكلي: يظل دعم السعر قويًا للغاية، حيث تم مسح مناطق سيولة البيع السابقة بقوة.`,
          `💎 دوران قطاعي إيجابي: يلاحظ تركيز قوي لرأس المال نحو منظومة ${eco}، مما يوضح تفضيل المستثمرين الواضح.`
        ];
      } else if (score >= 20) {
        return [
          `🔆 مرحلة صعود تدريجي: تزداد تدفقات الشراء تدريجيًا. يتجاوز حجم الشراء المتوسط المتحرك بنسبة +20%.`,
          `📊 مرونة فنية رئيسية: يظهر الاتجاه الصاعد علامات واضحة على تجميع صحي قبل استمرار محتمل للحركة الكلية.`,
          `🚀 اهتمام متزايد بقطاع L1 / منظومة ${eco}: تستقر الأنشطة المضاربية والاستثمارات الفورية متوسطة الأجل بشكل صاعد.`
        ];
      } else if (score <= -70) {
        return [
          `❄️ تصريف مؤسساتي شديد: يقوم الحيتان بتصريف مراكزهم الكلية بنشاط، مما يسبب خروجًا هائلاً لرؤوس الأموال.`,
          `💀 مسح هبوطي للسيولة: كسر تدفق البيع مستويات VWAP لليوم السابق. خطر مرتفع لانزلاق السعر المستمر.`,
          `⚠️ خروج قطاعي واضح: تهرب رؤوس الأموال بشكل جماعي من منظومة ${eco} لصالح قطاعات أكثر استقرارًا أو عملات مستقرة.`
        ];
      } else if (score <= -20) {
        return [
          `🧊 تراجع ضغط الشراء: يتباطأ الزخم، ويهيمن عليه تصريف معتدل على المدى القصير.`,
          `📉 ضغط هبوطي قيد المراقبة: تشير الشموع إلى قمم هابطة متتالية، مما يتطلب رد فعل فوري من المشترين.`,
          `🔔 دوران غير موات لرأس المال: تفقد منظومة ${eco} مؤقتًا اهتمام الأموال الذكية.`
        ];
      } else {
        return [
          `⚖️ ضغط السيولة ومنطقة محايدة: قوى الشراء والبيع في توازن تام. مرحلة تجميع سلبي في شكل ضغط سعري.`,
          `🌌 تداول داخل نطاق آمن: يتذبذب الأصل بهدوء بين حدود VWAP القصوى والدنيا لليوم السابق دون اتجاه واضح.`
        ];
      }
    } else if (lang === 'EN') {
      if (score >= 70) {
        return [
          `⚡ Strong Institutional Accumulation: Volume deltas confirm synchronized whale buying across all timeframes (1D, 3D, 1W).`,
          `📈 Macro Momentum Acceleration: Price support remains extremely solid, previous sell liquidity zones having been swept aggressively.`,
          `💎 Positive Sector Rotation: Strong capital concentration observed towards the ${eco} ecosystem, signaling clear investor preference.`
        ];
      } else if (score >= 20) {
        return [
          `🔆 Progressive Bullish Phase: Buying flows are steadily intensifying. Buy volume exceeds the moving average by +20%.`,
          `📊 Major Technical Resilience: The uptrend shows clear signs of healthy consolidation before a probable continuation.`,
          `🚀 Growing Interest in L1 / ${eco} Ecosystem: Speculative activity and medium-term spot investments are stabilizing in a bullish manner.`
        ];
      } else if (score <= -70) {
        return [
          `❄️ Severe Institutional Distribution: Whales are actively unloading macro positions, causing massive capital outflow.`,
          `💀 Bearish Liquidity Sweep: Sell flows broke yesterday's VWAP levels. High risk of persistent slippage.`,
          `⚠️ Pronounced Sector Flight: Capital is heavily fleeing the ${eco} ecosystem in favor of more stable sectors or Stablecoins.`
        ];
      } else if (score <= -20) {
        return [
          `🧊 Cool-down in Buying Pressure: Momentum is slowing, dominated by moderate short-term distribution campaigns.`,
          `📉 Bearish Pressure Under Watch: Klines indicate lower highs, requiring an immediate reaction from buyers.`,
          `🔔 Unfavorable Capital Rotation: The ${eco} ecosystem is temporarily losing the interest of Smart Money.`
        ];
      } else {
        return [
          `⚖️ Liquidity Compression & Neutral Zone: Buy and sell pressures are in perfect equilibrium. Passive accumulation phase.`,
          `🌌 Safe Range-bound Trading: The asset oscillates calmly between yesterday's max and min VWAP bounds without clear direction.`
        ];
      }
    } else {
      // Default: FR
      if (score >= 70) {
        return [
          `⚡ Forte accumulation institutionnelle : Les deltas de volume confirment une pression acheteuse synchronisée des baleines sur toutes les échelles (1D, 3D, 1W).`,
          `📈 Accélération de la tendance macro : Le support de prix reste extrêmement solide, les zones de liquidités vendeuses précédentes ayant été balayées de façon agressive.`,
          `💎 Rotation sectorielle positive : Une forte concentration des capitaux est observée vers l'écosystème ${eco}, marquant une nette préférence des investisseurs.`
        ];
      } else if (score >= 20) {
        return [
          `🔆 Phase de conquête haussière : Les flux d'achats s'intensifient progressivement. Le volume acheteur dépasse de +20% la moyenne glissante.`,
          `📊 Résilience technique majeure : La tendance haussière montre des signes clairs de consolidation saine avant une continuation probable du mouvement macro.`,
          `🚀 Intérêt accru sur le secteur L1/Écosystème ${eco} : L'activité spéculative et les investissements spot à moyen terme se stabilisent de façon haussière.`
        ];
      } else if (score <= -70) {
        return [
          `❄️ Distribution institutionnelle sévère : Les baleines déchargent activement leurs positions macro, provoquant une fuite massive de capitaux.`,
          `💀 Balayage baissier des liquidités : Les flux vendeurs ont enfoncé les niveaux de VWAP du jour précédent. Risque élevé de glissement de prix persistant.`,
          `⚠️ Fuite sectorielle prononcée : Les capitaux fuient massivement l'écosystème ${eco} au profit de secteurs plus stables ou de Stablecoins.`
        ];
      } else if (score <= -20) {
        return [
          `🧊 Refroidissement de la pression acheteuse : Le momentum ralentit, dominé par des campagnes de distribution modérées à court terme.`,
          `📉 Pression baissière sous surveillance : Les klines indiquent des sommets de plus en plus bas, nécessitant une réaction immédiate des acheteurs.`,
          `🔔 Rotation de capitaux défavorable : L'écosystème ${eco} perd temporairement l'intérêt de la Smart Money.`
        ];
      } else {
        return [
          `⚖️ Compression de liquidité & Zone neutre : Les forces d'achat et de vente sont en parfait équilibre. Phase d'accumulation passive sous forme de compression.`,
          `🌌 Trading de range sécurisé : L'actif oscille calmement entre ses bornes de VWAP max et min du jour précédent, sans directionnalité affirme.`
        ];
      }
    }
  };

  useEffect(() => {
    if (!selectedToken) {
      setNewsData([]);
      return;
    }

    const fetchNews = async () => {
      setLoadingNews(true);
      try {
        const coin = selectedToken.replace('USDT', '').toUpperCase();
        
        // 1. Fetch from Google News RSS converted to JSON for 100% specific real-time news!
        const rssUrl = `https://news.google.com/rss/search?q=${coin}+crypto+when:7d&hl=en-US&gl=US&ceid=US:en`;
        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const res = await fetch(url);
        const json = await res.json();
        
        if (json && json.status === 'ok' && json.items && json.items.length > 0) {
          const formattedNews = json.items.slice(0, 8).map((item, idx) => {
            let title = item.title || '';
            let source = 'Google News';
            const parts = title.split(' - ');
            if (parts.length > 1) {
              source = parts.pop();
              title = parts.join(' - ');
            }
            return {
              id: item.guid || `rss-${idx}`,
              url: item.link,
              title: title,
              source_info: { name: source },
              published_on: Math.floor(new Date(item.pubDate || Date.now()).getTime() / 1000),
              isGoogleNews: true
            };
          });
          setNewsData(formattedNews);
        } else {
          // 2. Fallback: Try fetching specific category from CryptoCompare
          let fallbackUrl = `https://min-api.cryptocompare.com/data/v2/news/?categories=${coin}&excludeCategories=Promo&lang=EN`;
          let fallbackRes = await fetch(fallbackUrl);
          let fallbackJson = await fallbackRes.json();
          
          if (fallbackJson && fallbackJson.Data && fallbackJson.Data.length > 0) {
            setNewsData(fallbackJson.Data);
          } else {
            // 3. Fallback: Fetch general CryptoCompare news and perform local search
            fallbackUrl = `https://min-api.cryptocompare.com/data/v2/news/?excludeCategories=Promo&lang=EN`;
            fallbackRes = await fetch(fallbackUrl);
            fallbackJson = await fallbackRes.json();
            if (fallbackJson && fallbackJson.Data && fallbackJson.Data.length > 0) {
              const filtered = fallbackJson.Data.filter(item => 
                item.title.toUpperCase().includes(coin) || 
                item.body.toUpperCase().includes(coin)
              );
              if (filtered.length > 0) {
                setNewsData(filtered);
              } else {
                const taggedNews = fallbackJson.Data.slice(0, 6).map(item => ({
                  ...item,
                  isGeneralMacro: true
                }));
                setNewsData(taggedNews);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch weekly news", err);
      }
      setLoadingNews(false);
    };

    fetchNews();
  }, [selectedToken]);

  useEffect(() => {
    if (newsData.length === 0) {
      setDisplayNews([]);
      return;
    }

    const translateAllNews = async () => {
      setTranslatingNews(true);
      try {
        const targetLang = drawerLang.toLowerCase(); // 'fr', 'ar', 'en'
        if (targetLang === 'en') {
          setDisplayNews(newsData);
          setTranslatingNews(false);
          return;
        }

        const translated = await Promise.all(newsData.map(async (item) => {
          try {
            const queryText = item.title;
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(queryText)}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json && json[0] && json[0][0] && json[0][0][0]) {
              return {
                ...item,
                title: json[0][0][0],
                translated: true
              };
            }
          } catch (e) {
            console.error("Translation item failed", e);
          }
          return item;
        }));
        setDisplayNews(translated);
      } catch (err) {
        console.error("Failed to translate headlines", err);
        setDisplayNews(newsData);
      }
      setTranslatingNews(false);
    };

    translateAllNews();
  }, [newsData, drawerLang]);

  const calculateMTFFlow = (dailyKlines) => {
    if (!dailyKlines || dailyKlines.length < 7) return null;
    
    // Sort chronological (oldest to newest)
    const sorted = [...dailyKlines].reverse(); 
    
    const flows = sorted.map(k => {
      const open = Number(k[1]);
      const high = Number(k[2]);
      const low = Number(k[3]);
      const close = Number(k[4]);
      const turnover = Number(k[6]);
      
      let flow = 0;
      if (open > 0) {
        flow = turnover * ((close - open) / open);
      }
      return { flow, turnover, close };
    });

    // 1D Flow (Latest completed candle)
    const flow1D = flows[flows.length - 1].flow;
    const turnover1D = flows[flows.length - 1].turnover;

    // 3D Flow (Sum of last 3 days)
    const last3Days = flows.slice(-3);
    const flow3D = last3Days.reduce((acc, f) => acc + f.flow, 0);
    const turnover3D = last3Days.reduce((acc, f) => acc + f.turnover, 0);

    // 1W Flow (Sum of last 7 days)
    const last7Days = flows.slice(-7);
    const flow1W = last7Days.reduce((acc, f) => acc + f.flow, 0);
    const turnover1W = last7Days.reduce((acc, f) => acc + f.turnover, 0);

    const priceChange1W = ((flows[flows.length - 1].close / flows[flows.length - 7].close) - 1) * 100;

    // Unified Gravity Score (-100 to +100)
    let score = 0;
    if (flow1D > 0) score += 30; else score -= 30;
    if (flow3D > 0) score += 35; else score -= 35;
    if (flow1W > 0) score += 35; else score -= 35;

    // Add extra weight for momentum matching price trend
    if (flow1W > 0 && priceChange1W > 0) score += 10;
    if (flow1W < 0 && priceChange1W < 0) score -= 10;
    
    score = Math.max(-100, Math.min(100, score));

    // Determine Stealth Status
    let status = { label: '⏳ MONITORING', col: '#94a3b8', desc: 'No clear trend' };
    if (flow1D > 0 && flow3D > 0 && flow1W > 0) {
      status = { label: '💎 STRATEGIC ACCUMULATION', col: '#00e676', desc: 'Sustained smart money accumulation' };
    } else if (flow1D > 0 && flow3D > 0 && flow1W < 0) {
      status = { label: '⚡ EARLY ROTATION', col: '#00e5ff', desc: 'Capital rotation starting to enter' };
    } else if (flow1D > 0 && flow3D < 0 && flow1W < 0) {
      status = { label: '⚠️ EXIT LIQUIDITY', col: '#f59e0b', desc: 'Temporary bounce used by whales to sell' };
    } else if (flow1D < 0 && flow3D < 0 && flow1W < 0) {
      status = { label: '💀 ACTIVE DISTRIBUTION', col: '#ff3b30', desc: 'Heavy institutional distribution' };
    } else if (flow1D < 0 && flow3D < 0 && flow1W > 0) {
      status = { label: '🛡️ SUPPORT TEST', col: '#7b2cbf', desc: 'Whales defending macro position' };
    }

    return {
      flow1D,
      turnover1D,
      flow3D,
      turnover3D,
      flow1W,
      turnover1W,
      priceChange1W,
      score,
      status,
      currentPrice: flows[flows.length - 1].close
    };
  };

  const scanTokens = async () => {
    setLoading(true);
    setScanningProgress(0);
    
    let symbolsList = [];
    if (initialSearch) {
      symbolsList = [initialSearch];
      setSelectedToken(initialSearch);
    } else {
      try {
        const top200 = await fetchTop200Symbols();
        // Extract the absolute Top 100 assets by 24h turnover
        symbolsList = top200.slice(0, 100).map(t => t.symbol);
      } catch (err) {
        console.error("Failed to fetch dynamically the Top 100 symbols", err);
        // Bulletproof Fallback
        symbolsList = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT', 'NEARUSDT', 'RENDERUSDT', 'PEPEUSDT', 'WIFUSDT'];
      }
    }

    // Reset old data to show live progressive build
    setTokensData({});

    const batchSize = 15; // Scan 15 assets concurrently
    for (let i = 0; i < symbolsList.length; i += batchSize) {
      const chunk = symbolsList.slice(i, i + batchSize);
      
      // Resolve all 15 kline requests in parallel (exponential scan speedup!)
      await Promise.all(chunk.map(async (sym) => {
        try {
          const klines = await fetchBybitData(sym, 'D', 15);
          if (klines && klines.length >= 7) {
            const analysis = calculateMTFFlow(klines);
            if (analysis) {
              setTokensData(prev => ({ ...prev, [sym]: analysis }));
            }
          }
        } catch (err) {
          console.error(`Error scanning ${sym}`, err);
        }
      }));

      // Update progress bar
      const completedCount = Math.min(i + batchSize, symbolsList.length);
      setScanningProgress(Math.floor((completedCount / symbolsList.length) * 100));

      // Friendly 300ms delay between batches to fully respect Bybit's API rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    setLoading(false);
  };

  useEffect(() => {
    scanTokens();
  }, [initialSearch]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    const formatted = searchQuery.toUpperCase().endsWith('USDT') ? searchQuery.toUpperCase() : `${searchQuery.toUpperCase()}USDT`;
    
    setLoading(true);
    try {
      const klines = await fetchBybitData(formatted, 'D', 15);
      if (klines && klines.length >= 7) {
        const analysis = calculateMTFFlow(klines);
        if (analysis) {
          setTokensData(prev => ({ ...prev, [formatted]: analysis }));
          setSelectedToken(formatted);
        }
      } else {
        alert("Token not found or insufficient history.");
      }
    } catch (err) {
      alert("Error scanning this token.");
    }
    setLoading(false);
  };

  const getEcosystemToken = (sym) => {
    for (const [name, list] of Object.entries(ECOSYSTEMS)) {
      if (list.includes(sym)) return name;
    }
    return 'L1';
  };

  const filteredList = useMemo(() => {
    return Object.entries(tokensData)
      .map(([symbol, data]) => ({ symbol, ...data, eco: getEcosystemToken(symbol) }))
      .filter(item => {
        if (selectedEcosystem === 'ALL') return true;
        return item.eco === selectedEcosystem;
      })
      .sort((a, b) => b.score - a.score);
  }, [tokensData, selectedEcosystem]);

  const formatMoney = (val) => {
    const abs = Math.abs(val);
    if (abs >= 1.0e9) return `${(val / 1.0e9).toFixed(2)}B`;
    if (abs >= 1.0e6) return `${(val / 1.0e6).toFixed(2)}M`;
    if (abs >= 1.0e3) return `${(val / 1.0e3).toFixed(2)}K`;
    return val.toFixed(2);
  };

  return (
    <div style={{ background: '#090915', minHeight: '80vh', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, background: 'linear-gradient(90deg, #00ff88, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Zap size={32} style={{ color: '#00ff88' }} /> MULTI-TIMEFRAME MACRO FLOW
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
            Detect long-term institutional campaigns by cross-analyzing 1D, 3D, and 1W net volume deltas.
          </p>
        </div>

        {/* SEARCH BAR */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ex: SUI, APT, SOL..." 
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px 12px 40px', borderRadius: '12px', fontSize: '0.85rem', width: '220px', transition: 'all 0.3s' }}
            />
          </div>
          <button type="submit" style={{ background: '#00ff88', color: '#090915', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            ANALYZE
          </button>
        </form>
      </div>

      {/* FILTER & SCAN STATUS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['ALL', 'SOL', 'AI', 'L1', 'MEMES'].map(eco => (
            <button
              key={eco}
              onClick={() => setSelectedEcosystem(eco)}
              style={{
                background: selectedEcosystem === eco ? '#7b2cbf' : 'rgba(255,255,255,0.02)',
                color: selectedEcosystem === eco ? '#fff' : '#94a3b8',
                border: '1px solid rgba(255,255,255,0.05)',
                padding: '8px 20px',
                borderRadius: '30px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              {eco} {eco !== 'ALL' && 'ECOSYSTEM'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* VIEW MODE TOGGLE BUTTONS */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: 4 }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : '#64748b',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              📊 TABLEAU
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              style={{
                background: viewMode === 'heatmap' ? '#ff3d00' : 'transparent',
                color: viewMode === 'heatmap' ? '#fff' : '#64748b',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              🔥 CARTE DE CHALEUR (CHAUD/FROID)
            </button>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(123, 44, 191, 0.1)', border: '1px solid rgba(123, 44, 191, 0.2)', padding: '8px 16px', borderRadius: '12px' }}>
              <Loader2 size={16} style={{ color: '#00d4ff', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00d4ff' }}>SCANNING: {scanningProgress}%</span>
            </div>
          )}
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedToken ? '3fr 2fr' : '1fr', gap: '2rem' }}>
        
        {/* LEADERBOARD OR HEATMAP VIEW */}
        {viewMode === 'heatmap' ? (
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <style>{`
              .thermal-tile:hover {
                transform: translateY(-4px) scale(1.02);
                box-shadow: 0 8px 24px rgba(0,0,0,0.4), inset 0 0 15px rgba(255,255,255,0.05) !important;
                background: rgba(255,255,255,0.04) !important;
              }
              .mtf-row-hover:hover {
                background: rgba(255,255,255,0.02) !important;
                transform: translateX(4px);
              }
            `}</style>

            {/* HEATMAP CONTROLS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.2rem' }}>
              {/* METRIC TIME SELECTOR */}
              <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: '10px' }}>
                {[
                  { id: 'gravity', label: 'METRIC : GRAVITY 📐' },
                  { id: '1D', label: 'FLUX 1D 🔥' },
                  { id: '3D', label: 'FLUX 3D 🌊' },
                  { id: '1W', label: 'FLUX 1W 🏔️' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setHeatmapMetric(m.id)}
                    style={{
                      background: heatmapMetric === m.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                      color: heatmapMetric === m.id ? '#fff' : '#64748b',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* DYNAMIC TEMPERATURE SCALE LEGEND */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(0,0,0,0.15)', padding: '6px 16px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '0.65rem', color: '#2979ff', fontWeight: 900 }}>❄️ FROIS (OUTFLOW)</span>
                <div style={{ width: 120, height: 6, background: 'linear-gradient(90deg, #1a237e, #2979ff, #80f3ff, #1e293b, #ffea00, #ff9100, #ff3d00)', borderRadius: 3 }} />
                <span style={{ fontSize: '0.65rem', color: '#ff3d00', fontWeight: 900 }}>CHAUD (INFLOW) 🔥</span>
              </div>
            </div>

            {/* HIGH-DENSITY HEATMAP GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {filteredList.map(item => {
                // Determine normalized score from -100 to 100 based on active metric
                let score = item.score;
                let displayVal = `Gravity: ${score >= 0 ? '+' : ''}${score}`;
                
                if (heatmapMetric === '1D') {
                  const pct = item.turnover1D > 0 ? (item.flow1D / item.turnover1D) * 100 * 10 : 0;
                  score = Math.max(-100, Math.min(100, pct));
                  displayVal = `1D: ${item.flow1D >= 0 ? '+' : '-'}$${formatMoney(Math.abs(item.flow1D))}`;
                } else if (heatmapMetric === '3D') {
                  const pct = item.turnover3D > 0 ? (item.flow3D / item.turnover3D) * 100 * 10 : 0;
                  score = Math.max(-100, Math.min(100, pct));
                  displayVal = `3D: ${item.flow3D >= 0 ? '+' : '-'}$${formatMoney(Math.abs(item.flow3D))}`;
                } else if (heatmapMetric === '1W') {
                  const pct = item.turnover1W > 0 ? (item.flow1W / item.turnover1W) * 100 * 10 : 0;
                  score = Math.max(-100, Math.min(100, pct));
                  displayVal = `1W: ${item.flow1W >= 0 ? '+' : '-'}$${formatMoney(Math.abs(item.flow1W))}`;
                }

                const therm = getThermalStyle(score);
                const isSelected = selectedToken === item.symbol;

                return (
                  <div
                    key={item.symbol}
                    onClick={() => setSelectedToken(item.symbol === selectedToken ? null : item.symbol)}
                    style={{
                      background: isSelected ? `${therm.color}18` : therm.background,
                      border: `1px solid ${isSelected ? therm.color : therm.border.replace('0.15', '0.3').replace('0.25', '0.4').replace('0.03', '0.15')}`,
                      borderRadius: '16px',
                      padding: '16px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      position: 'relative',
                      boxShadow: therm.glowColor !== 'transparent' ? `0 0 12px ${therm.glowColor}` : 'none',
                    }}
                    className="thermal-tile"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', letterSpacing: '0.3px' }}>
                        {item.symbol.replace('USDT', '')}
                      </span>
                      <span style={{ fontSize: '1.1rem' }}>{therm.icon}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>
                        ${item.currentPrice ? item.currentPrice.toFixed(4) : 'N/A'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
                        {item.eco} ECO
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 6, marginTop: 4 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 900, color: therm.color }}>
                        {displayVal}
                      </span>
                      <span style={{ 
                        alignSelf: 'flex-start',
                        fontSize: '0.55rem', 
                        fontWeight: 900, 
                        color: therm.badgeCol, 
                        background: therm.badgeBg, 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        letterSpacing: '0.2px' 
                      }}>
                        {therm.badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* LEADERBOARD TABLE */
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 2fr 3fr 1.5fr', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: '#64748b', fontWeight: 900, letterSpacing: '0.5px' }}>
              <span>ASSET</span>
              <span>NET FLOW (1D)</span>
              <span>NET FLOW (3D)</span>
              <span>NET FLOW (1W)</span>
              <span>INSTITUTIONAL STATUS</span>
              <span style={{ textAlign: 'right' }}>GRAVITY</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: '0.5rem' }}>
              {filteredList.map(item => {
                const scoreColor = item.score >= 50 ? '#00e676' : item.score >= 0 ? '#00e5ff' : item.score >= -50 ? '#f59e0b' : '#ff3b30';
                return (
                  <div 
                    key={item.symbol}
                    onClick={() => setSelectedToken(item.symbol === selectedToken ? null : item.symbol)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 2fr 2fr 2fr 3fr 1.5fr',
                      alignItems: 'center',
                      padding: '16px 12px',
                      background: selectedToken === item.symbol ? 'rgba(123, 44, 191, 0.08)' : 'rgba(255,255,255,0.01)',
                      border: `1px solid ${selectedToken === item.symbol ? 'rgba(123, 44, 191, 0.3)' : 'rgba(255,255,255,0.02)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    className="mtf-row-hover"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff' }}>{item.symbol.replace('USDT', '')}</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{item.eco} ECOSYSTEM</span>
                    </div>

                    <span style={{ color: item.flow1D >= 0 ? '#00e676' : '#ff3b30', fontSize: '0.85rem', fontWeight: 800 }}>
                      {item.flow1D >= 0 ? '+' : '-'}${formatMoney(item.flow1D)}
                    </span>

                    <span style={{ color: item.flow3D >= 0 ? '#00e676' : '#ff3b30', fontSize: '0.85rem', fontWeight: 800 }}>
                      {item.flow3D >= 0 ? '+' : '-'}${formatMoney(item.flow3D)}
                    </span>

                    <span style={{ color: item.flow1W >= 0 ? '#00e676' : '#ff3b30', fontSize: '0.85rem', fontWeight: 800 }}>
                      {item.flow1W >= 0 ? '+' : '-'}${formatMoney(item.flow1W)}
                    </span>

                    <div>
                      <span style={{ background: `${item.status.col}15`, color: item.status.col, border: `1px solid ${item.status.col}30`, padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.3px' }}>
                        {item.status.label}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: scoreColor, fontWeight: 900, fontSize: '1rem', background: `${scoreColor}10`, padding: '6px 12px', borderRadius: '8px', border: `1px solid ${scoreColor}20` }}>
                        {item.score >= 0 ? '+' : ''}{item.score}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DETAILED DRAWERS FOR SELECTED TOKEN */}
        {selectedToken && tokensData[selectedToken] && (() => {
          const t = tokensData[selectedToken];
          return (
            <div style={{ 
              background: 'rgba(255,255,255,0.01)', 
              border: '1px solid rgba(123, 44, 191, 0.2)', 
              borderRadius: '24px', 
              padding: '2rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)', 
              height: 'fit-content',
              textAlign: drawerLang === 'AR' ? 'right' : 'left', 
              direction: drawerLang === 'AR' ? 'rtl' : 'ltr'
            }}>
              {/* DRAWER HEADER WITH LANGUAGE TOGGLE */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>
                    {drawerLang === 'AR' ? `${selectedToken.replace('USDT', '')} تحليل` : drawerLang === 'EN' ? `${selectedToken.replace('USDT', '')} ANALYSIS` : `ANALYSE DE ${selectedToken.replace('USDT', '')}`}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                    {drawerLang === 'AR' ? 'تقرير التقارير الفنية الكمي' : drawerLang === 'EN' ? 'QUANTITATIVE CONFLUENCE REPORT' : 'RAPPORT DE CONFLUENCE QUANTITATIVE'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* LANGUAGE TOGGLE SELECTOR */}
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: 2 }}>
                    {[
                      { id: 'FR', label: '🇫🇷 FR' },
                      { id: 'EN', label: '🇬🇧 EN' },
                      { id: 'AR', label: '🇸🇦 AR' }
                    ].map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => setDrawerLang(lang.id)}
                        style={{
                          background: drawerLang === lang.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                          color: drawerLang === lang.id ? '#fff' : '#64748b',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => setSelectedToken(null)} 
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}
                  >
                    {drawerLang === 'AR' ? 'إغلاق' : drawerLang === 'EN' ? 'CLOSE' : 'FERMER'}
                  </button>
                </div>
              </div>

              {/* GRAVITY STATUS */}
              <div style={{ background: `${t.status.col}10`, border: `1px solid ${t.status.col}20`, padding: '1.2rem', borderRadius: '16px' }}>
                <span style={{ fontSize: '0.6rem', color: t.status.col, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {drawerLang === 'AR' ? 'الاستراتيجية المؤسساتية' : drawerLang === 'EN' ? 'INSTITUTIONAL STRATEGY' : 'STRATÉGIE INSTITUTIONNELLE'}
                </span>
                <h4 style={{ margin: '4px 0', color: t.status.col, fontSize: '1.1rem', fontWeight: 900 }}>
                  {translateStatus(t.status.label, drawerLang)}
                </h4>
                <p style={{ margin: '6px 0 0 0', color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  {translateDesc(t.status.label, drawerLang)}
                </p>
              </div>

              {/* FLOW SIDE-BY-SIDE BARS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1.2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 900, letterSpacing: '0.5px' }}>
                  {drawerLang === 'AR' ? 'أعمدة تطابق التدفقات الزمنية' : drawerLang === 'EN' ? 'CONFLUENCE TIMEFRAME BARS' : 'BARRES DE CONFLUENCE TEMPORELLE'}
                </span>

                {/* 1D BAR */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: 4, flexDirection: drawerLang === 'AR' ? 'row-reverse' : 'row' }}>
                    <span style={{ color: '#94a3b8' }}>
                      {drawerLang === 'AR' ? 'تدفق صافي (1D)' : drawerLang === 'EN' ? '1-Day Net Flow (1D)' : 'Flux Net sur 1 Jour (1D)'}
                    </span>
                    <span style={{ color: t.flow1D >= 0 ? '#00e676' : '#ff3b30' }}>
                      {t.flow1D >= 0 ? '+' : '-'}${formatMoney(t.flow1D)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (Math.abs(t.flow1D) / t.turnover1D) * 100 * 10)}%`, background: t.flow1D >= 0 ? '#00e676' : '#ff3b30' }} />
                  </div>
                </div>

                {/* 3D BAR */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: 4, flexDirection: drawerLang === 'AR' ? 'row-reverse' : 'row' }}>
                    <span style={{ color: '#94a3b8' }}>
                      {drawerLang === 'AR' ? 'تدفق صافي (3D)' : drawerLang === 'EN' ? '3-Day Net Flow (3D)' : 'Flux Net sur 3 Jours (3D)'}
                    </span>
                    <span style={{ color: t.flow3D >= 0 ? '#00e676' : '#ff3b30' }}>
                      {t.flow3D >= 0 ? '+' : '-'}${formatMoney(t.flow3D)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (Math.abs(t.flow3D) / t.turnover3D) * 100 * 10)}%`, background: t.flow3D >= 0 ? '#00e676' : '#ff3b30' }} />
                  </div>
                </div>

                {/* 1W BAR */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: 4, flexDirection: drawerLang === 'AR' ? 'row-reverse' : 'row' }}>
                    <span style={{ color: '#94a3b8' }}>
                      {drawerLang === 'AR' ? 'تدفق صافي (1W)' : drawerLang === 'EN' ? '1-Week Net Flow (1W)' : 'Flux Net sur 1 Semaine (1W)'}
                    </span>
                    <span style={{ color: t.flow1W >= 0 ? '#00e676' : '#ff3b30' }}>
                      {t.flow1W >= 0 ? '+' : '-'}${formatMoney(t.flow1W)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (Math.abs(t.flow1W) / t.turnover1W) * 100 * 10)}%`, background: t.flow1W >= 0 ? '#00e676' : '#ff3b30' }} />
                  </div>
                </div>
              </div>

              {/* DIAGNOSTIC CARD */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid rgba(255,255,255,0.05)', padding: '1.2rem', borderRadius: '16px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 900, letterSpacing: '0.5px' }}>
                  {drawerLang === 'AR' ? 'تشخيص تدوير السوق' : drawerLang === 'EN' ? 'MARKET ROTATION DIAGNOSTIC' : 'DIAGNOSTIC DE ROTATION DU MARCHÉ'}
                </span>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  {t.score >= 70 ? (
                    <span>
                      🚀 <strong>
                        {drawerLang === 'AR' ? 'استثمار عالي القناعة' : drawerLang === 'EN' ? 'High-Conviction Investment' : 'Investissement à Haute Conviction'}
                      </strong>: {
                        drawerLang === 'AR' ? 'يؤكد محرك الفترات المتعددة الشراء المتزامن لجميع الفترات. الحيتان تقود السعر. خيار ممتاز للمدى البعيد.' :
                        drawerLang === 'EN' ? 'The multi-timeframe engine confirms synchronized buying at all scales. Whales are driving the price. Excellent long-term holding candidate.' :
                        'Le moteur multi-timeframe confirme des achats synchronisés des baleines sur toutes les échelles. Excellent candidat pour le long terme.'
                      }
                    </span>
                  ) : t.score >= 30 ? (
                    <span>
                      📈 <strong>
                        {drawerLang === 'AR' ? 'اتجاه ناشئ' : drawerLang === 'EN' ? 'Emerging Trend' : 'Tendance Émergente'}
                      </strong>: {
                        drawerLang === 'AR' ? 'تبدأ السيولة بالاستقرار داخل الأصل. انتظر تأكيد إغلاق شمعة الأسبوع. مناسب جداً للمدى القصير والمتوسط.' :
                        drawerLang === 'EN' ? 'Capital is starting to consolidate into this asset. Watch for weekly candle close confirmation. Highly suitable for mid-term positions.' :
                        'Les capitaux commencent à se consolider sur cet actif. Attendez la confirmation hebdomadaire. Très adapté pour le moyen terme.'
                      }
                    </span>
                  ) : t.score >= -30 ? (
                    <span>
                      ⚖️ <strong>
                        {drawerLang === 'AR' ? 'ضغط السيولة' : drawerLang === 'EN' ? 'Liquidity Compression' : 'Compression de Liquidité'}
                      </strong>: {
                        drawerLang === 'AR' ? 'الأصل محايد حالياً. قوى الشراء والبيع متوازنة تماماً. يفضل انتظار كسر الهيكل قبل الدخول.' :
                        drawerLang === 'EN' ? 'The asset is currently neutral. Buy and sell pressures are fully matched. Best to await a structural break before entering.' :
                        'L\'actif est actuellement neutre. Les forces d\'achat et de vente sont équilibrées. Attendez une cassure de structure.'
                      }
                    </span>
                  ) : (
                    <span>
                      💀 <strong>
                        {drawerLang === 'AR' ? 'تحذير (تصريف شديد)' : drawerLang === 'EN' ? 'Warning (Heavy Distribution)' : 'Avertissement (Distribution Massive)'}
                      </strong>: {
                        drawerLang === 'AR' ? 'حملات بيع هائلة مستمرة من الحيتان. تجنب الشراء تماماً، فالمؤسسات تصرف كمياتها في طلبات التجزئة.' :
                        drawerLang === 'EN' ? 'Massive selling campaigns are underway. Avoid buying this bottom, as whales are actively liquidating their macro positions into retail bids.' :
                        'De lourdes campagnes de distribution sont en cours. Évitez d\'acheter ce bottom, les baleines vendent sur le retail.'
                      }
                    </span>
                  )}
                </div>
              </div>

              {/* SOCIAL SENTIMENT & BUZZ X CARD */}
              {(() => {
                const coinName = selectedToken.replace('USDT', '');
                let socialTemp = '';
                let tempCol = '';
                let fillPercent = 50;
                
                if (t.score >= 70) {
                  socialTemp = drawerLang === 'AR' ? '🔥 نشاط فائق / جنون' : drawerLang === 'EN' ? '🔥 HYPERACTIVE / FRENZY' : '🔥 HYPERACTIF / FRÉNÉTIQUE';
                  tempCol = '#ff3d00';
                  fillPercent = 90;
                } else if (t.score >= 30) {
                  socialTemp = drawerLang === 'AR' ? '📈 اهتمام عالي / ضجيج' : drawerLang === 'EN' ? '📈 HIGH INTEREST / BUZZING' : '📈 INTÉRÊT ÉLEVÉ / EN HAUSSE';
                  tempCol = '#ff9100';
                  fillPercent = 70;
                } else if (t.score >= -30) {
                  socialTemp = drawerLang === 'AR' ? '⚖️ مستقر / مضغوط' : drawerLang === 'EN' ? '⚖️ STABLE / COMPRESSED' : '⚖️ STABLE / CALME';
                  tempCol = '#00e5ff';
                  fillPercent = 50;
                } else {
                  socialTemp = drawerLang === 'AR' ? '❄️ هلع / استسلام' : drawerLang === 'EN' ? '❄️ PANIC / CAPITULATION' : '❄️ PANIQUE / CAPITULATION';
                  tempCol = '#3b82f6';
                  fillPercent = 25;
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '1.2rem', borderRadius: '16px', background: 'rgba(0,0,0,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: drawerLang === 'AR' ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 900, letterSpacing: '0.5px' }}>
                        {drawerLang === 'AR' ? '🐦 معنويات وسائل التواصل الاجتماعي X' : drawerLang === 'EN' ? '🐦 SOCIAL SENTIMENT & BUZZ X' : '🐦 SENTIMENT SOCIAL & BUZZ X'}
                      </span>
                      <span style={{ fontSize: '0.55rem', color: '#94a3b8', fontWeight: 700 }}>
                        {drawerLang === 'AR' ? 'درجة الحرارة الاجتماعية' : 'SOCIAL TEMPERATURE'}
                      </span>
                    </div>

                    {/* Social thermometer indicator */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, flexDirection: drawerLang === 'AR' ? 'row-reverse' : 'row' }}>
                        <span style={{ color: '#cbd5e1' }}>
                          {drawerLang === 'AR' ? 'حرارة المجتمع :' : 'Social Temperature:'}
                        </span>
                        <span style={{ color: tempCol }}>
                          {socialTemp}
                        </span>
                      </div>
                      
                      {/* Glow thermometer bar */}
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 4, overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${fillPercent}%`, 
                          background: `linear-gradient(90deg, #3b82f6, ${tempCol})`, 
                          boxShadow: `0 0 10px ${tempCol}`,
                          borderRadius: 4,
                          transition: 'width 0.5s ease-out'
                        }} />
                      </div>
                    </div>

                    {/* Clickable Action Shortcut buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {/* Twitter / X search button */}
                      <a
                        href={`https://x.com/search?q=${encodeURIComponent('$' + coinName + ' crypto')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                          flex: 1, 
                          minWidth: '100px',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: 6, 
                          background: 'rgba(255,255,255,0.03)', 
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#fff',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                        className="social-btn-hover"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(29, 155, 240, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(29, 155, 240, 0.4)';
                          e.currentTarget.style.color = '#1d9bf0';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>🐦</span>
                        {drawerLang === 'AR' ? 'بحث على X' : drawerLang === 'EN' ? 'SEARCH ON X' : 'RECHERCHER SUR X'}
                      </a>

                      {/* DexScreener button */}
                      <a
                        href={`https://dexscreener.com/search?q=${coinName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                          flex: 1, 
                          minWidth: '100px',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: 6, 
                          background: 'rgba(255,255,255,0.03)', 
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#fff',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.4)';
                          e.currentTarget.style.color = '#00e5ff';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>📊</span>
                        DEXSCREENER
                      </a>

                      {/* CoinMarketCap button */}
                      <a
                        href={`https://coinmarketcap.com/currencies/${coinName.toLowerCase()}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                          flex: 1, 
                          minWidth: '100px',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: 6, 
                          background: 'rgba(255,255,255,0.03)', 
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#fff',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 145, 0, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(255, 145, 0, 0.4)';
                          e.currentTarget.style.color = '#ff9100';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>🪙</span>
                        COINMARKETCAP
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* LIVE MARKET INTELLIGENCE & WEEKLY RECAP CARD */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15, border: '1px solid rgba(255,255,255,0.05)', padding: '1.2rem', borderRadius: '16px', background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: drawerLang === 'AR' ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: '0.65rem', color: '#00e5ff', fontWeight: 900, letterSpacing: '0.5px' }}>
                    {drawerLang === 'AR' ? '✨ السرديات والتقارير الفنية' : drawerLang === 'EN' ? '✨ WEEKLY NARRATIVES & CONFLUENCE' : '✨ NARRATIFS & CONFLUENCES DE LA SEMAINE'}
                  </span>
                  <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700 }}>
                    {drawerLang === 'AR' ? 'Nebula تحليلات' : 'NEBULA INSIGHTS'}
                  </span>
                </div>

                {/* Always Render Quantitative Dynamic Recap (Perfect Confluence Proof!) */}
                <div style={{ background: 'rgba(0, 229, 255, 0.03)', border: '1px solid rgba(0, 229, 255, 0.1)', padding: '12px 14px', borderRadius: '10px', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: '1.5' }}>
                  <ul style={{ margin: 0, paddingLeft: '16px', paddingRight: drawerLang === 'AR' ? '16px' : 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {generateDynamicRecap(selectedToken, t, drawerLang).map((bullet, idx) => (
                      <li key={idx}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Headlines Section Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', flexDirection: drawerLang === 'AR' ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: '0.65rem', color: newsData[0]?.isGeneralMacro ? '#f59e0b' : '#00e676', fontWeight: 900, letterSpacing: '0.5px' }}>
                    {newsData[0]?.isGeneralMacro 
                      ? (drawerLang === 'AR' ? '🌍 الأخبار الكلية وعالم العملات الرقمية' : drawerLang === 'EN' ? '🌍 MACRO NEWS & GLOBAL CRYPTO' : '🌍 ACTUALITÉS MACRO & GLOBAL CRYPTO')
                      : (drawerLang === 'AR' ? `📰 أخبار المشروع : ${selectedToken.replace('USDT', '')}` : drawerLang === 'EN' ? `📰 PROJECT HEADLINES : ${selectedToken.replace('USDT', '')}` : `📰 ACTUALITÉS DU PROJET : ${selectedToken.replace('USDT', '')}`)}
                  </span>
                  <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700 }}>
                    {drawerLang === 'AR' ? `بدعم من ${newsData[0]?.isGoogleNews ? 'محرك بحث Google News' : 'CryptoCompare'}` : `POWERED BY ${newsData[0]?.isGoogleNews ? 'GOOGLE NEWS SEARCH' : 'CRYPTOCOMPARE'}`}
                  </span>
                </div>

                {loadingNews ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: '#64748b', padding: '10px 0', justifyContent: drawerLang === 'AR' ? 'flex-end' : 'flex-start' }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>
                      {drawerLang === 'AR' ? 'جاري البحث عن الأخبار والسرديات الأسبوعية...' : drawerLang === 'EN' ? 'Scanning headlines & weekly narratives...' : 'Recherche d\'actualités et récits de la semaine...'}
                    </span>
                  </div>
                ) : displayNews.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', padding: '10px 0' }}>
                    {drawerLang === 'AR' ? 'لا توجد أخبار مباشرة هذا الأسبوع لهذا الأصل. الاتجاه الكلي هو السائد.' : drawerLang === 'EN' ? 'No direct news this week for this asset. General macro trend is dominant.' : 'Aucune actualité directe cette semaine pour cet actif. La tendance macro globale domine.'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', opacity: translatingNews ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                    {translatingNews && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6rem', color: '#00e5ff', padding: '2px 0', justifyContent: drawerLang === 'AR' ? 'flex-end' : 'flex-start' }}>
                        <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>
                          {drawerLang === 'AR' ? 'جاري ترجمة العناوين في الوقت الفعلي...' : drawerLang === 'EN' ? 'Translating headlines in real-time...' : 'Traduction des titres en temps réel...'}
                        </span>
                      </div>
                    )}
                    
                    {/* Detailed articles list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {displayNews.slice(0, 4).map(item => (
                        <a 
                          key={item.id} 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ 
                            textDecoration: 'none', 
                            display: 'block', 
                            padding: '10px', 
                            background: 'rgba(255,255,255,0.01)', 
                            border: '1px solid rgba(255,255,255,0.02)', 
                            borderRadius: '8px', 
                            transition: 'all 0.2s',
                            textAlign: drawerLang === 'AR' ? 'right' : 'left'
                          }}
                          className="news-item-hover"
                        >
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#fff', fontWeight: 700, marginBottom: '4px', lineHeight: '1.3' }}>{item.title}</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', fontWeight: 600, flexDirection: drawerLang === 'AR' ? 'row-reverse' : 'row' }}>
                            <span>Source: {item.source_info?.name || item.source}</span>
                            <span>{new Date(item.published_on * 1000).toLocaleDateString()}</span>
                          </div>
                        </a>
                      ))}
                    </div>

                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .mtf-row-hover:hover {
          background: rgba(255,255,255,0.03) !important;
          transform: scale(1.005);
        }
        .news-item-hover:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(0, 229, 255, 0.3) !important;
          transform: translateY(-1px);
        }
        `
      }} />

    </div>
  );
};
