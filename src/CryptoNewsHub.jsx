import React, { useState, useEffect, Component } from 'react';
import { Twitter, Globe, Clock, FileText, ChevronRight } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ color: 'red', padding: '50px', background: 'black', height: '100vh' }}>
        <h1>Crash React !</h1>
        <pre>{this.state.error.toString()}</pre>
        <pre>{this.state.error.stack}</pre>
      </div>;
    }
    return this.props.children;
  }
}

export default function CryptoNewsHubWrapper() {
  return (
    <ErrorBoundary>
      <CryptoNewsHub />
    </ErrorBoundary>
  );
}

function CryptoNewsHub() {
  const [topCoins, setTopCoins] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [coinDetails, setCoinDetails] = useState(null);
  const [news, setNews] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Top 100 on mount
  useEffect(() => {
    const fetchTop100 = async () => {
      try {
        const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false';
        let res;
        try {
          res = await fetch(url);
        } catch (e) {
          // Fallback if blocked by CORS or Adblocker
          res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url));
        }

        if (!res.ok) throw new Error("Erreur API CoinGecko. Réessayez plus tard.");
        
        const data = await res.json();
        const safeData = Array.isArray(data) ? data : [];
        setTopCoins(safeData);
        if (safeData.length > 0) {
          handleSelectCoin(safeData[0]);
        } else if (!Array.isArray(data)) {
          throw new Error(data.error || data.status?.error_message || "Rate Limit CoinGecko atteint.");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingList(false);
      }
    };
    fetchTop100();
  }, []);

  const handleSelectCoin = async (coin) => {
    setSelectedCoin(coin);
    setLoadingDetails(true);
    setCoinDetails(null);
    setNews([]);
    try {
      // Fetch details for Official Links
      const detailsUrl = `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
      let detailsRes;
      try {
        detailsRes = await fetch(detailsUrl);
      } catch (e) {
        detailsRes = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(detailsUrl));
      }
      
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        setCoinDetails(detailsData);
      }

      // Fetch News from Cointelegraph RSS via rss2json
      const coinSlug = coin.name.toLowerCase().replace(/ /g, '-');
      const rssUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://cointelegraph.com/rss/tag/${coinSlug}`;
      let newsRes;
      try {
        newsRes = await fetch(rssUrl);
      } catch (e) {
        newsRes = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(rssUrl));
      }
      
      // Fallback to general crypto news if the coin tag doesn't exist
      if (!newsRes.ok) {
        newsRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=https://cointelegraph.com/rss`);
      }

      if (newsRes.ok) {
        const newsData = await newsRes.json();
        if (newsData.items && Array.isArray(newsData.items)) {
          setNews(newsData.items);
        }
      }
    } catch (err) {
      console.error("Failed to fetch details or news", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Sidebar Top 100 */}
      <div style={{ width: '300px', borderRight: '1px solid #1f2937', display: 'flex', flexDirection: 'column', backgroundColor: '#111827' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #1f2937' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#e2e8f0' }}>Top 100 Crypto</h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '5px 0 0 0' }}>Actualités & Infos Officielles</p>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px' }}>
          {loadingList ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Chargement du Top 100...</div>
          ) : error ? (
            <div style={{ color: '#ef4444', textAlign: 'center', padding: '20px' }}>{error}</div>
          ) : (
            topCoins.map((coin, index) => (
              <div 
                key={coin.id}
                onClick={() => handleSelectCoin(coin)}
                style={{
                  display: 'flex', alignItems: 'center', padding: '12px', cursor: 'pointer',
                  borderRadius: '8px', marginBottom: '4px',
                  backgroundColor: selectedCoin?.id === coin.id ? '#1e293b' : 'transparent',
                  border: selectedCoin?.id === coin.id ? '1px solid #3b82f6' : '1px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ color: '#64748b', fontSize: '0.8rem', width: '25px' }}>{index + 1}</span>
                <img src={coin.image} alt={coin.name} style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '12px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{coin.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>{coin.symbol}</div>
                </div>
                <ChevronRight size={16} color={selectedCoin?.id === coin.id ? '#3b82f6' : '#475569'} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '30px', backgroundColor: '#0f172a' }}>
        {selectedCoin && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            
            {/* Header: Coin Info & Links */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #1f2937' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <img src={selectedCoin.image} alt={selectedCoin.name} style={{ width: '48px', height: '48px', marginRight: '20px' }} />
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{selectedCoin.name} <span style={{ color: '#64748b', fontSize: '1.25rem', textTransform: 'uppercase' }}>{selectedCoin.symbol}</span></h1>
                  <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '5px' }}>
                    ${selectedCoin.current_price ? selectedCoin.current_price.toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                {coinDetails?.links?.homepage?.[0] && (
                  <a href={coinDetails.links.homepage[0]} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#1e293b', borderRadius: '8px', color: '#e2e8f0', textDecoration: 'none', fontWeight: '500', transition: 'background 0.2s' }}>
                    <Globe size={18} /> Site Officiel
                  </a>
                )}
                {coinDetails?.links?.twitter_screen_name && (
                  <a href={`https://twitter.com/${coinDetails.links.twitter_screen_name}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#1da1f2', borderRadius: '8px', color: '#fff', textDecoration: 'none', fontWeight: '500', transition: 'opacity 0.2s' }}>
                    <Twitter size={18} /> Twitter
                  </a>
                )}
              </div>
            </div>

            {/* News Feed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <FileText color="#3b82f6" />
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Derniers Articles de Presse</h3>
            </div>

            {loadingDetails ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px', fontSize: '1.2rem' }}>Recherche des articles en cours...</div>
            ) : news.length === 0 ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px', backgroundColor: '#1e293b', borderRadius: '12px' }}>
                Aucune actualité récente trouvée pour {selectedCoin.name}.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {news.map((item, idx) => (
                  <a 
                    key={idx} 
                    href={item.link} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ 
                      display: 'block', backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', 
                      textDecoration: 'none', color: 'inherit', border: '1px solid #334155',
                      transition: 'transform 0.2s, borderColor 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#334155'; }}
                  >
                    <div style={{ height: '160px', overflow: 'hidden', position: 'relative', backgroundColor: '#0f172a' }}>
                      <img 
                        src={item.enclosure?.link || item.thumbnail} 
                        alt="" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
                        onError={(e) => e.target.style.display = 'none'} 
                      />
                      <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={12} />
                        {new Date(item.pubDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                        {item.author || "Cointelegraph"}
                      </div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', lineHeight: '1.4', fontWeight: '600', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.title}
                      </h4>
                    </div>
                  </a>
                ))}
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
