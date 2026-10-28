# Nebula SOL Accumulator (Standalone Project)

This project is designed to implement the **SOL Accumulation Rotation** strategy. 

## Strategy Logic
The dashboard calculates the `TOKEN/SOL` ratio in real-time. 
- **Relative Change > 0**: The token is outperforming SOL. Buying this token with SOL and selling back later will increase your total SOL count.
- **Relative Change < 0**: SOL is stronger. It is better to hold SOL.

## How to Run
Since this project is currently inside your `src/SOL-Accumulator` directory for compatibility, you can run it in two ways:

### Option 1: Integration (Quickest)
Change your main `src/main.jsx` (or wherever your entry point is) to import `App-SOL.jsx` instead of the original `App.jsx`.

```javascript
import AppSOL from './SOL-Accumulator/App-SOL';
// ... render AppSOL
```

### Option 2: Standalone (Recommended)
1. Copy the folder `src/SOL-Accumulator` to a new location on your Desktop.
2. Run `npm init vite@latest` in that new folder.
3. Move the files to the `src` of the new project.
4. Enjoy a dedicated terminal for SOL accumulation.

## Key Features
- **SOL Benchmark**: Real-time SOL price and change tracking.
- **Relative Performance**: Instant calculation of gain/loss against SOL.
- **Rotation Tags**: HOT/WARM/COOL signals based on momentum.
- **Premium Design**: Optimized for high-conviction trading.
