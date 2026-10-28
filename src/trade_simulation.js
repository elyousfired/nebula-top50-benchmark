
const solInitial = 1.0;
const bsbStrength = 4.83; // +4.83% vs SOL
const plumeStrength = 1.53; // +1.53% vs SOL

console.log("=========================================");
console.log("🚀 SOLANA STRATEGIC TRADE SIMULATION");
console.log("=========================================");
console.log(`Starting Balance: ${solInitial} SOL`);
console.log("Action: Swap SOL for BSB & PLUME (50/50 Split)");
console.log("-----------------------------------------");

// Calculation
const bsbAllocation = solInitial / 2;
const plumeAllocation = solInitial / 2;

const bsbResult = bsbAllocation * (1 + bsbStrength / 100);
const plumeResult = plumeAllocation * (1 + plumeStrength / 100);

const totalFinalValue = bsbResult + plumeResult;
const netProfitSOL = totalFinalValue - solInitial;
const profitPercentage = (netProfitSOL / solInitial) * 100;

console.log(`BSB Result:   ${bsbResult.toFixed(4)} SOL`);
console.log(`PLUME Result: ${plumeResult.toFixed(4)} SOL`);
console.log("-----------------------------------------");
console.log(`TOTAL VALUE:  ${totalFinalValue.toFixed(4)} SOL`);
console.log(`NET PnL:      +${netProfitSOL.toFixed(4)} SOL`);
console.log(`GROWTH:       +${profitPercentage.toFixed(2)}% (Relative to SOL)`);
console.log("=========================================");
console.log("💡 CONCLUSION:");
console.log(`Staying in SOL: 1.0000 SOL`);
console.log(`Strategic Move: ${totalFinalValue.toFixed(4)} SOL`);
console.log(`You outsmarted the market by ${profitPercentage.toFixed(2)}%!`);
console.log("=========================================");
