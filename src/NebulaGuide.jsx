import React, { useState } from 'react';
import { BookOpen, Activity, Target, Droplet, Server, Flame, Link, Cpu, Scale, Newspaper, Brain, Crown, Rocket, Layers, Scissors, History, LayoutGrid, Award, Radar, BarChart2, Zap } from 'lucide-react';

const categories = [
  {
    title: "1. INFRASTRUCTURE & TENDANCES",
    color: "#00f0ff",
    items: [
      { icon: Activity, label: "COURBES / COURBES PRO", desc: "Analyse visuelle multi-timeframe de l'évolution des prix et des moyennes mobiles.", trade: "Détecter les croisements (Golden Cross) pour se positionner dans le sens du momentum principal." },
      { icon: Radar, label: "RADAR", desc: "Visualisation en nuage de points des tokens du marché selon leur force.", trade: "Cliquer sur les points les plus hauts à droite pour identifier les tokens qui surperforment actuellement le marché." },
      { icon: Rocket, label: "PARABOLIC MACRO", desc: "Détection algorithmique des trajectoires paraboliques et des croissances exponentielles en cours.", trade: "Jouer la continuation de la tendance explosive avec un trailing stop très serré pour éviter la correction." },
    ]
  },
  {
    title: "2. LIQUIDITÉ & ZONES CLÉS",
    color: "#ff3366",
    items: [
      { icon: Scissors, label: "LIQUIDITY SWEEPS", desc: "Repérage des chasses à la liquidité (balayage brutal des anciens plus hauts ou plus bas).", trade: "Idéal pour trader les retournements (reversals) massifs après le déclenchement des stop-loss des particuliers." },
      { icon: Layers, label: "DAILY LEVELS", desc: "Affichage des niveaux psychologiques quotidiens, hebdomadaires et mensuels institutionnels.", trade: "Acheter sur les re-tests chirurgicaux des niveaux de support et sécuriser ses profits sur les résistances." },
      { icon: BarChart2, label: "VOLUME PROFILE", desc: "Analyse du volume échangé par niveau de prix pour trouver le Point of Control (POC).", trade: "Utiliser le POC comme un aimant à liquidité ou une zone de rebond majeur incontournable." },
    ]
  },
  {
    title: "3. FLUX & SMART MONEY",
    color: "#8b5cf6",
    items: [
      { icon: Droplet, label: "MACRO FLOW", desc: "Visualisation globale de l'injection ou du retrait massif de capital sur le marché crypto.", trade: "Confirmer la solidité d'une hausse. Si le flux est vendeur malgré un prix qui monte, restez extrêmement méfiant." },
      { icon: Zap, label: "FLOW INTENSITY", desc: "La pression d'achat ou de vente mesurée de façon algorithmique par intensité.", trade: "Acheter aveuglément lorsque l'intensité acheteuse entre en zone d'extrême après une capitulation vendeuse." },
      { icon: Droplet, label: "NET FLOW (BTC)", desc: "Suivi des flux institutionnels spécifiquement orientés sur le Bitcoin en temps réel.", trade: "Anticiper les mouvements du marché entier en repérant la rotation des capitaux depuis le BTC vers les Altcoins." },
    ]
  },
  {
    title: "4. SCALPING & TERMINAUX IA",
    color: "#ffcc00",
    items: [
      { icon: Cpu, label: "MONAD / HYPE TERMINAL", desc: "Moteurs d'inférence ultra-rapides se concentrant sur les narratifs du moment.", trade: "Suivre la 'smart money' en temps réel pour capturer des mouvements ultra-courts et explosifs." },
      { icon: Target, label: "BREAKOUT SCANNER", desc: "Détection temps-réel des franchissements de lignes de cou et de résistances historiques.", trade: "Entrer agressivement en position dès la cassure avec une confirmation par une forte hausse des volumes." },
      { icon: Brain, label: "PRO SWITCH / ALPHA", desc: "Outils quantitatifs avancés analysant le ratio risque/récompense pour détecter l'alpha caché.", trade: "Suivre les signaux quantitatifs pour une prise de position mécanique, optimisée mathématiquement et dénuée d'émotion." },
    ]
  },
  {
    title: "5. MACRO ÉCOSYSTÈME & CORRÉLATIONS",
    color: "#00ff88",
    items: [
      { icon: Crown, label: "MACRO SOL (1D/4H)", desc: "Analyse approfondie des patterns de récupération de Solana et son écosystème sur les grandes UT.", trade: "L'outil roi pour l'investissement long-terme ou le swing trading en achetant agressivement en bas de cycle." },
      { icon: Link, label: "BTC CORRELATION", desc: "Mesure algorithmique de la dépendance d'un altcoin par rapport au Bitcoin.", trade: "Trader les actifs totalement décorrélés pour maximiser le potentiel de hausse lorsque le Bitcoin consolide." },
      { icon: Newspaper, label: "TOP 100 NEWS", desc: "Agrégation IA des informations les plus impactantes et du sentiment global.", trade: "Comprendre le narratif (narrative) du jour pour filtrer vos setups techniques de manière fondamentale." },
    ]
  }
];

export const NebulaGuide = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#e2e8f0' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', marginBottom: '1rem' }}>
          <BookOpen size={40} color="#00f0ff" />
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#fff', textShadow: '0 0 20px rgba(0, 240, 255, 0.3)' }}>NEBULA SCANNER <span style={{ color: '#00f0ff' }}>CORE</span></h1>
        <p style={{ fontSize: '1.1rem', color: '#94a3b8', maxWidth: '700px', margin: '0 auto', lineHeight: '1.6' }}>
          Bienvenue dans le moteur d'inférence Nebula. Ce système est conçu pour traquer la liquidité, détecter les algorithmes institutionnels et analyser la structure du marché en temps réel.
          Lisez attentivement ce manuel pour exploiter chaque terminal à son plein potentiel.
        </p>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {categories.map((cat, idx) => (
          <div key={idx}>
            <h2 style={{ fontSize: '1.4rem', color: cat.color, borderBottom: `1px solid ${cat.color}40`, paddingBottom: '0.8rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', background: cat.color, borderRadius: '50%', boxShadow: `0 0 10px ${cat.color}` }}></span>
              {cat.title}
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {cat.items.map((item, i) => (
                <div key={i} style={{ 
                  background: 'rgba(15, 23, 42, 0.4)', 
                  border: '1px solid rgba(255, 255, 255, 0.05)', 
                  borderRadius: '12px', 
                  padding: '1.5rem',
                  transition: 'all 0.3s ease',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = cat.color + '80';
                  e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
                  e.currentTarget.style.transform = 'none';
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                    <div style={{ padding: '8px', background: `${cat.color}15`, borderRadius: '8px', color: cat.color }}>
                      <item.icon size={20} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: '600' }}>{item.label}</h3>
                  </div>
                  
                  <div style={{ marginBottom: '1.2rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>FONCTIONNEMENT ALGORITHMIQUE</div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5' }}>{item.desc}</p>
                  </div>
                  
                  <div style={{ background: `${cat.color}0a`, padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${cat.color}` }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: cat.color, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>STRATÉGIE DE TRADING</div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#e2e8f0', lineHeight: '1.5' }}>{item.trade}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '4rem', textAlign: 'center', padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#64748b', fontSize: '0.85rem' }}>
        <p>
          [ SYSTEM READY ] &nbsp;&nbsp;|&nbsp;&nbsp; 
          <span style={{ color: '#00f0ff' }}>STATUS: ONLINE</span> &nbsp;&nbsp;|&nbsp;&nbsp; 
          V1.0.4 NEBULA ENGINE
        </p>
      </div>

    </div>
  );
};
