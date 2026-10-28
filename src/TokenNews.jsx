import React, { useState, useEffect } from 'react';
import { Clock, Newspaper } from 'lucide-react';

const TokenNews = ({ symbol }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;

    const fetchNews = async () => {
      setLoading(true);
      try {
        const coin = symbol.replace('USDT', '').toUpperCase();
        
        // Fetch from Google News RSS converted to JSON
        const rssUrl = `https://news.google.com/rss/search?q=${coin}+crypto+when:7d&hl=en-US&gl=US&ceid=US:en`;
        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const res = await fetch(url);
        const json = await res.json();
        
        if (json && json.status === 'ok' && json.items && json.items.length > 0) {
          setNews(json.items.slice(0, 8));
        } else {
          setNews([]);
        }
      } catch (e) {
        console.error("Erreur lors de la récupération des news pour", symbol, e);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [symbol]);

  if (!symbol) return null;

  return (
    <div style={{ marginTop: '2rem', padding: '1rem', background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#00d0ff', fontSize: '1.2rem', textTransform: 'uppercase' }}>
        <Newspaper size={20} /> Derniers Articles : {symbol}
      </h3>
      
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px', fontSize: '1rem' }}>
          Recherche des actualités en cours pour {symbol}...
        </div>
      ) : news.length === 0 ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px', backgroundColor: '#1e293b', borderRadius: '12px' }}>
          Aucune actualité récente trouvée pour {symbol}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {news.map((item, idx) => {
            // Extraire la source du titre Google News
            let title = item.title || '';
            let source = 'Google News';
            const parts = title.split(' - ');
            if (parts.length > 1) {
              source = parts.pop();
              title = parts.join(' - ');
            }

            // Fallback image si pas d'image dans l'article
            const defaultImage = "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=600&q=80";

            return (
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
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = '#00d0ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#334155'; }}
              >
                <div style={{ height: '140px', overflow: 'hidden', position: 'relative', backgroundColor: '#0f172a' }}>
                  <img 
                    src={item.enclosure?.link || item.thumbnail || defaultImage} 
                    alt="" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
                    onError={(e) => { e.target.src = defaultImage; }} 
                  />
                  <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={12} />
                    {new Date(item.pubDate).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ padding: '16px' }}>
                  <div style={{ color: '#00d0ff', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                    {source}
                  </div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', lineHeight: '1.4', fontWeight: '600', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {title}
                  </h4>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TokenNews;
