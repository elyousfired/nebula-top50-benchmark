
import readline from 'readline';

// Initial Setup
const solInitial = 1.0;
const bsbTargetStrength = 4.83; 
const plumeTargetStrength = 1.53;
let currentBsb = 0;
let currentPlume = 0;
let seconds = 0;

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function drawProgressBar(value, max, color = '\x1b[32m') {
  const width = 20;
  const progress = Math.min(Math.floor((value / max) * width), width);
  const empty = width - progress;
  return `[${color}${'█'.repeat(progress)}\x1b[0m${'░'.repeat(empty)}]`;
}

function updateLivePnL() {
  clearScreen();
  seconds++;
  
  // Simulate live growth towards the target strength
  currentBsb = Math.min(bsbTargetStrength, currentBsb + (bsbTargetStrength / 100) * (Math.random() * 2));
  currentPlume = Math.min(plumeTargetStrength, currentPlume + (plumeTargetStrength / 100) * (Math.random() * 2));

  const bsbValue = (solInitial / 2) * (1 + currentBsb / 100);
  const plumeValue = (solInitial / 2) * (1 + currentPlume / 100);
  const totalValue = bsbValue + plumeValue;
  const pnl = totalValue - solInitial;
  const pnlPercent = (pnl / solInitial) * 100;

  console.log("\x1b[35m==================================================\x1b[0m");
  console.log("\x1b[1m\x1b[33m 🚀 NEBULA STRATEGIC TERMINAL - LIVE PnL \x1b[0m");
  console.log("\x1b[35m==================================================\x1b[0m");
  console.log(`⏱️  Duration: ${seconds}s  |  Base Asset: 1.0000 SOL`);
  console.log("--------------------------------------------------");
  
  console.log(`\x1b[1mASSET: BSB   \x1b[0m | Str: +${currentBsb.toFixed(2)}% | Value: ${bsbValue.toFixed(5)} SOL`);
  console.log(`               ${drawProgressBar(currentBsb, bsbTargetStrength)}`);
  
  console.log(`\x1b[1mASSET: PLUME \x1b[0m | Str: +${currentPlume.toFixed(2)}% | Value: ${plumeValue.toFixed(5)} SOL`);
  console.log(`               ${drawProgressBar(currentPlume, plumeTargetStrength, '\x1b[36m')}`);
  
  console.log("--------------------------------------------------");
  console.log(`\x1b[1m\x1b[32m TOTAL PnL:   +${pnl.toFixed(6)} SOL (${pnlPercent.toFixed(2)}%) \x1b[0m`);
  console.log("--------------------------------------------------");
  console.log("\x1b[2m (Press Ctrl+C to stop simulation) \x1b[0m");
}

console.log("Starting Live PnL Terminal...");
setInterval(updateLivePnL, 1000);
