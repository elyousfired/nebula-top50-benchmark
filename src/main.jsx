import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Auto-purge stale browser cache for version 3.0.9 (%B PRO markers fix)
(function purgeStaleCache() {
  try {
    const CURRENT_VER = '3.0.9';
    const storedVer = localStorage.getItem('nebula_app_version');
    if (storedVer !== CURRENT_VER) {
      console.log('Purging stale browser caches for Nebula Version:', CURRENT_VER);
      localStorage.setItem('nebula_app_version', CURRENT_VER);
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(reg => reg.unregister());
        });
      }
      if (storedVer) {
        window.location.reload(true);
      }
    }
  } catch (err) {
    console.error('Cache purge error:', err);
  }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
