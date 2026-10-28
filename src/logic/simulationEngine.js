// ============================================================
// PAPER TRADING SIMULATION ENGINE
// Capital: 1 BTC, split into 3 slots of 0.333 BTC each
// Entry: when a fresh signal fires on 1H
// Exit: when signal disappears on next scan
// P&L measured in BTC
// ============================================================

const STORAGE_KEY = 'nebula_simulation_v1';
const SLOT_SIZE = 1 / 3; // 0.333 BTC per slot

export function loadSimulation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return createFreshSimulation();
}

export function saveSimulation(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export function resetSimulation() {
  const fresh = createFreshSimulation();
  saveSimulation(fresh);
  return fresh;
}

function createFreshSimulation() {
  return {
    initialBtc: 1,
    slots: [null, null, null],  // 3 position slots
    closedTrades: [],
    startedAt: Date.now(),
  };
}

// Returns current total BTC value (free slots + open positions at current prices)
export function getTotalBtc(sim, currentPrices) {
  let total = 0;
  for (const slot of sim.slots) {
    if (!slot) {
      // Empty slot = 0.333 BTC free
      total += SLOT_SIZE;
    } else {
      // Open position: valued at current Token/BTC ratio
      const currentRatio = currentPrices[slot.symbol];
      if (currentRatio && currentRatio > 0) {
        total += slot.tokensHeld * currentRatio;
      } else {
        // Fallback: use entry price
        total += slot.btcInvested;
      }
    }
  }
  return total;
}

// Called each scan cycle with the new list of signal tokens
// Returns updated simulation state + events (entries/exits for display)
export function processSimulationCycle(sim, signalTokens, currentPrices) {
  const events = [];
  let updated = { ...sim, slots: [...sim.slots], closedTrades: [...sim.closedTrades] };

  const signalSymbols = new Set(signalTokens.map(t => t.symbol));

  // 1. EXIT: close positions where signal disappeared
  for (let i = 0; i < updated.slots.length; i++) {
    const pos = updated.slots[i];
    if (!pos) continue;
    if (!signalSymbols.has(pos.symbol)) {
      // Signal gone → close position
      const exitRatio = currentPrices[pos.symbol];
      const btcReturned = exitRatio ? pos.tokensHeld * exitRatio : pos.btcInvested;
      const pnlBtc = btcReturned - pos.btcInvested;
      const pnlPct = (pnlBtc / pos.btcInvested) * 100;

      const trade = {
        symbol: pos.symbol,
        entryRatio: pos.entryRatio,
        exitRatio: exitRatio || pos.entryRatio,
        btcInvested: pos.btcInvested,
        btcReturned,
        pnlBtc,
        pnlPct,
        entryTime: pos.entryTime,
        exitTime: Date.now(),
      };
      updated.closedTrades.unshift(trade); // newest first
      updated.slots[i] = null;
      events.push({ type: 'EXIT', ...trade });
    }
  }

  // 2. ENTER: fill empty slots with fresh signals (sorted by freshness)
  const openSymbols = new Set(updated.slots.filter(Boolean).map(s => s.symbol));
  const freshSignals = signalTokens
    .filter(t => !openSymbols.has(t.symbol)) // not already open
    .sort((a, b) => {
      const aMin = a.signals[0]?.candleTime ? Math.round((Date.now() / 1000 - a.signals[0].candleTime) / 60) : 9999;
      const bMin = b.signals[0]?.candleTime ? Math.round((Date.now() / 1000 - b.signals[0].candleTime) / 60) : 9999;
      return aMin - bMin;
    });

  for (const token of freshSignals) {
    const emptySlot = updated.slots.findIndex(s => s === null);
    if (emptySlot === -1) break; // all slots occupied

    const entryRatio = currentPrices[token.symbol];
    if (!entryRatio || entryRatio <= 0) continue;

    const position = {
      symbol: token.symbol,
      entryRatio,
      btcInvested: SLOT_SIZE,
      tokensHeld: SLOT_SIZE / entryRatio,
      entryTime: Date.now(),
      signalCandleTime: token.signals[0]?.candleTime,
    };
    updated.slots[emptySlot] = position;
    openSymbols.add(token.symbol);
    events.push({ type: 'ENTRY', symbol: token.symbol, entryRatio, btcInvested: SLOT_SIZE });
  }

  saveSimulation(updated);
  return { simulation: updated, events };
}
