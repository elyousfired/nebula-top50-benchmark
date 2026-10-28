const PORTFOLIO_KEY = 'nebula_demo_portfolio';

const getInitialPortfolio = () => ({
  balance: 10, // 10 SOL
  positions: [],
  history: []
});

export const getPortfolio = () => {
  try {
    const data = localStorage.getItem(PORTFOLIO_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {
    console.error('Error reading portfolio', err);
  }
  return getInitialPortfolio();
};

const savePortfolio = (portfolio) => {
  try {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
  } catch (err) {
    console.error('Error saving portfolio', err);
  }
};

export const buyToken = (symbol, tokenPriceUsdt, solPriceUsdt) => {
  const portfolio = getPortfolio();
  
  if (portfolio.balance < 1) {
    return { success: false, message: 'Fonds insuffisants. Balance < 1 SOL.' };
  }

  if (portfolio.positions.find(p => p.symbol === symbol)) {
    return { success: false, message: 'Position déjà ouverte sur ce token.' };
  }

  const investmentSol = 1; // 1 SOL
  // Conversion: 1 SOL = X USDT. Donc on investit X USDT.
  const investmentUsdt = investmentSol * solPriceUsdt;
  const amount = investmentUsdt / tokenPriceUsdt; // Quantité de tokens achetée
  
  portfolio.balance -= investmentSol;
  portfolio.positions.push({
    symbol,
    entryPriceUsdt: tokenPriceUsdt,
    solPriceAtEntry: solPriceUsdt,
    amount,
    investmentSol,
    timestamp: Date.now()
  });

  savePortfolio(portfolio);
  return { success: true, message: `Achat de ${symbol} réussi !` };
};

export const sellToken = (symbol, currentTokenPriceUsdt, currentSolPriceUsdt) => {
  const portfolio = getPortfolio();
  const positionIndex = portfolio.positions.findIndex(p => p.symbol === symbol);
  
  if (positionIndex === -1) {
    return { success: false, message: 'Position introuvable.' };
  }

  const position = portfolio.positions[positionIndex];
  
  // Compatibilité avec les anciennes positions
  if (!position.entryPriceUsdt) {
    portfolio.positions.splice(positionIndex, 1);
    portfolio.balance += position.investment || 1;
    savePortfolio(portfolio);
    return { success: true, message: `Ancienne position fermée, SOL remboursé.` };
  }

  const valueNowUsdt = position.amount * currentTokenPriceUsdt;
  const valueNowSol = valueNowUsdt / currentSolPriceUsdt;
  
  const pnlSol = valueNowSol - position.investmentSol;
  const pnlPercent = (pnlSol / position.investmentSol) * 100;
  
  // Update balance
  portfolio.balance += valueNowSol;
  
  // Remove from positions
  portfolio.positions.splice(positionIndex, 1);
  
  // Add to history
  portfolio.history.push({
    symbol: position.symbol,
    entryPriceUsdt: position.entryPriceUsdt,
    exitPriceUsdt: currentTokenPriceUsdt,
    entrySolPrice: position.solPriceAtEntry,
    exitSolPrice: currentSolPriceUsdt,
    pnlSol,
    pnlPercent,
    entryTime: position.timestamp,
    exitTime: Date.now()
  });

  savePortfolio(portfolio);
  return { success: true, message: `Vente de ${symbol} réussie ! PnL: ${pnlSol > 0 ? '+' : ''}${pnlSol.toFixed(4)} SOL`, pnl: pnlSol };
};

export const resetPortfolio = () => {
  savePortfolio(getInitialPortfolio());
  return getInitialPortfolio();
};
