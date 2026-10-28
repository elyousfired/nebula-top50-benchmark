const STORAGE_KEY = 'nebula_signal_history';
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown for the same token

export const getSignalHistory = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error reading signal history", e);
    return [];
  }
};

export const saveSignal = (symbol, price) => {
  const history = getSignalHistory();
  const now = Date.now();
  
  // Check if we recently signaled this token
  const recentSignal = history.find(s => s.symbol === symbol && (now - s.timestamp < COOLDOWN_MS));
  if (recentSignal) {
    return false; // Skip saving to prevent spam
  }

  const newSignal = {
    id: Math.random().toString(36).substring(2, 9),
    symbol,
    price,
    timestamp: now,
    type: 'BUY'
  };

  const updatedHistory = [newSignal, ...history].slice(0, 500); // Keep last 500
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  return true;
};

export const clearSignalHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};
