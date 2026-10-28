// Massive Ecosystem Categorization Database for Top 300 Tokens
export const TOKEN_DB = {
  // ─── L1 CHAINS (Ecosystem Roots) ───
  BTC: { layer: 'L1', name: 'Bitcoin', parent: null },
  ETH: { layer: 'L1', name: 'Ethereum', parent: null },
  SOL: { layer: 'L1', name: 'Solana', parent: null },
  BNB: { layer: 'L1', name: 'BNB Chain', parent: null },
  ATOM: { layer: 'L1', name: 'Cosmos', parent: null },
  AVAX: { layer: 'L1', name: 'Avalanche', parent: null },
  DOT: { layer: 'L1', name: 'Polkadot', parent: null },
  ADA: { layer: 'L1', name: 'Cardano', parent: null },
  NEAR: { layer: 'L1', name: 'NEAR Protocol', parent: null },
  APT: { layer: 'L1', name: 'Aptos', parent: null },
  SUI: { layer: 'L1', name: 'Sui', parent: null },
  FTM: { layer: 'L1', name: 'Fantom', parent: null },
  TRX: { layer: 'L1', name: 'TRON', parent: null },
  XRP: { layer: 'L1', name: 'XRP Ledger', parent: null },
  TON: { layer: 'L1', name: 'Toncoin', parent: null },
  KAS: { layer: 'L1', name: 'Kaspa', parent: null },
  ICP: { layer: 'L1', name: 'Internet Computer', parent: null },
  HBAR: { layer: 'L1', name: 'Hedera', parent: null },
  EGLD: { layer: 'L1', name: 'MultiversX', parent: null },
  FLOW: { layer: 'L1', name: 'Flow', parent: null },
  MINA: { layer: 'L1', name: 'Mina', parent: null },
  XTZ: { layer: 'L1', name: 'Tezos', parent: null },
  EOS: { layer: 'L1', name: 'EOS', parent: null },
  NEO: { layer: 'L1', name: 'NEO', parent: null },
  IOTA: { layer: 'L1', name: 'IOTA', parent: null },
  ALGO: { layer: 'L1', name: 'Algorand', parent: null },
  VET: { layer: 'L1', name: 'VeChain', parent: null },
  FIL: { layer: 'L1', name: 'Filecoin', parent: null },
  AR: { layer: 'L1', name: 'Arweave', parent: null },
  TAO: { layer: 'L1', name: 'Bittensor', parent: null },
  ETC: { layer: 'L1', name: 'Ethereum Classic', parent: null },
  BCH: { layer: 'L1', name: 'Bitcoin Cash', parent: null },
  BSV: { layer: 'L1', name: 'Bitcoin SV', parent: null },
  XMR: { layer: 'L1', name: 'Monero', parent: null },
  ZEC: { layer: 'L1', name: 'Zcash', parent: null },
  DASH: { layer: 'L1', name: 'Dash', parent: null },
  THETA: { layer: 'L1', name: 'Theta', parent: null },
  CHZ: { layer: 'L1', name: 'Chiliz', parent: null },
  RON: { layer: 'L1', name: 'Ronin', parent: null },
  ROSE: { layer: 'L1', name: 'Oasis', parent: null },
  KSM: { layer: 'L1', name: 'Kusama', parent: null },
  WAVES: { layer: 'L1', name: 'Waves', parent: null },
  ONT: { layer: 'L1', name: 'Ontology', parent: null },
  QTUM: { layer: 'L1', name: 'Qtum', parent: null },
  ZIL: { layer: 'L1', name: 'Zilliqa', parent: null },
  KLAY: { layer: 'L1', name: 'Klaytn', parent: null },
  DOGE: { layer: 'L1', name: 'Dogecoin', parent: null },
  LTC: { layer: 'L1', name: 'Litecoin', parent: null },
  CRO: { layer: 'L1', name: 'Cronos', parent: null },

  // ─── COSMOS ECOSYSTEM (L1 AppChains) ───
  INJ: { layer: 'L1', name: 'Injective', parent: 'ATOM' },
  TIA: { layer: 'L1', name: 'Celestia', parent: 'ATOM' },
  SEI: { layer: 'L1', name: 'Sei', parent: 'ATOM' },
  KAVA: { layer: 'L1', name: 'Kava', parent: 'ATOM' },
  RUNE: { layer: 'L1', name: 'THORChain', parent: 'ATOM' },
  AKT: { layer: 'L1', name: 'Akash', parent: 'ATOM' },
  AXL: { layer: 'L1', name: 'Axelar', parent: 'ATOM' },
  OSMO: { layer: 'dApp', name: 'Osmosis', parent: 'ATOM' },
  DYDX: { layer: 'dApp', name: 'dYdX', parent: 'ATOM' },
  NTRN: { layer: 'dApp', name: 'Neutron', parent: 'ATOM' },
  STRD: { layer: 'dApp', name: 'Stride', parent: 'ATOM' },

  // ─── ETHEREUM L2s ───
  ARB: { layer: 'L2', name: 'Arbitrum', parent: 'ETH' },
  OP: { layer: 'L2', name: 'Optimism', parent: 'ETH' },
  MATIC: { layer: 'L2', name: 'Polygon', parent: 'ETH' },
  POL: { layer: 'L2', name: 'Polygon', parent: 'ETH' },
  MNT: { layer: 'L2', name: 'Mantle', parent: 'ETH' },
  IMX: { layer: 'L2', name: 'Immutable X', parent: 'ETH' },
  STRK: { layer: 'L2', name: 'StarkNet', parent: 'ETH' },
  ZK: { layer: 'L2', name: 'zkSync', parent: 'ETH' },
  METIS: { layer: 'L2', name: 'Metis', parent: 'ETH' },
  LRC: { layer: 'L2', name: 'Loopring', parent: 'ETH' },
  SKL: { layer: 'L2', name: 'SKALE', parent: 'ETH' },
  MANTA: { layer: 'L2', name: 'Manta', parent: 'ETH' },
  BOBA: { layer: 'L2', name: 'Boba', parent: 'ETH' },
  CTSI: { layer: 'L2', name: 'Cartesi', parent: 'ETH' },
  CELR: { layer: 'L2', name: 'Celer', parent: 'ETH' },

  // ─── ETHEREUM dApps ───
  UNI: { layer: 'dApp', name: 'Uniswap', parent: 'ETH' },
  LINK: { layer: 'dApp', name: 'Chainlink', parent: 'ETH' },
  LDO: { layer: 'dApp', name: 'Lido', parent: 'ETH' },
  MKR: { layer: 'dApp', name: 'Maker', parent: 'ETH' },
  AAVE: { layer: 'dApp', name: 'Aave', parent: 'ETH' },
  CRV: { layer: 'dApp', name: 'Curve', parent: 'ETH' },
  SNX: { layer: 'dApp', name: 'Synthetix', parent: 'ETH' },
  ENS: { layer: 'dApp', name: 'Ethereum Name Service', parent: 'ETH' },
  FET: { layer: 'dApp', name: 'Fetch.ai', parent: 'ETH' },
  AGIX: { layer: 'dApp', name: 'SingularityNET', parent: 'ETH' },
  WLD: { layer: 'dApp', name: 'Worldcoin', parent: 'ETH' },
  BLUR: { layer: 'dApp', name: 'Blur', parent: 'ETH' },
  COMP: { layer: 'dApp', name: 'Compound', parent: 'ETH' },
  ENA: { layer: 'dApp', name: 'Ethena', parent: 'ETH' },
  ETHFI: { layer: 'dApp', name: 'ether.fi', parent: 'ETH' },
  GRT: { layer: 'dApp', name: 'The Graph', parent: 'ETH' },
  QNT: { layer: 'dApp', name: 'Quant', parent: 'ETH' },
  SAND: { layer: 'dApp', name: 'The Sandbox', parent: 'ETH' },
  MANA: { layer: 'dApp', name: 'Decentraland', parent: 'ETH' },
  APE: { layer: 'dApp', name: 'ApeCoin', parent: 'ETH' },
  AXS: { layer: 'dApp', name: 'Axie Infinity', parent: 'ETH' },
  GALA: { layer: 'dApp', name: 'Gala', parent: 'ETH' },
  YFI: { layer: 'dApp', name: 'Yearn', parent: 'ETH' },
  '1INCH': { layer: 'dApp', name: '1inch', parent: 'ETH' },
  SUSHI: { layer: 'dApp', name: 'SushiSwap', parent: 'ETH' },
  ZRX: { layer: 'dApp', name: '0x', parent: 'ETH' },
  BAT: { layer: 'dApp', name: 'Basic Attention Token', parent: 'ETH' },
  ENJ: { layer: 'dApp', name: 'Enjin', parent: 'ETH' },
  AUDIO: { layer: 'dApp', name: 'Audius', parent: 'ETH' },
  ILV: { layer: 'dApp', name: 'Illuvium', parent: 'ETH' },
  LPT: { layer: 'dApp', name: 'Livepeer', parent: 'ETH' },
  SSV: { layer: 'dApp', name: 'SSV Network', parent: 'ETH' },
  RPL: { layer: 'dApp', name: 'Rocket Pool', parent: 'ETH' },
  GNO: { layer: 'dApp', name: 'Gnosis', parent: 'ETH' },
  OMNI: { layer: 'dApp', name: 'Omni', parent: 'ETH' },
  ALT: { layer: 'dApp', name: 'AltLayer', parent: 'ETH' },
  REZ: { layer: 'dApp', name: 'Renzo', parent: 'ETH' },
  BICO: { layer: 'dApp', name: 'Biconomy', parent: 'ETH' },
  CVX: { layer: 'dApp', name: 'Convex', parent: 'ETH' },
  FXS: { layer: 'dApp', name: 'Frax', parent: 'ETH' },
  LQTY: { layer: 'dApp', name: 'Liquity', parent: 'ETH' },
  MAGIC: { layer: 'dApp', name: 'Magic', parent: 'ETH' },
  MASK: { layer: 'dApp', name: 'Mask Network', parent: 'ETH' },

  // ─── ETHEREUM MEMES ───
  PEPE: { layer: 'Meme', name: 'Pepe', parent: 'ETH' },
  SHIB: { layer: 'Meme', name: 'Shiba Inu', parent: 'ETH' },
  FLOKI: { layer: 'Meme', name: 'Floki', parent: 'ETH' },
  MOG: { layer: 'Meme', name: 'Mog Coin', parent: 'ETH' },
  TURBO: { layer: 'Meme', name: 'Turbo', parent: 'ETH' },
  MEME: { layer: 'Meme', name: 'Memecoin', parent: 'ETH' },

  // ─── ARBITRUM dApps ───
  GMX: { layer: 'dApp', name: 'GMX', parent: 'ARB' },
  RDNT: { layer: 'dApp', name: 'Radiant', parent: 'ARB' },
  PENDLE: { layer: 'dApp', name: 'Pendle', parent: 'ARB' }, // Heavy on ARB

  // ─── OPTIMISM dApps ───
  VELO: { layer: 'dApp', name: 'Velodrome', parent: 'OP' },

  // ─── SOLANA ECOSYSTEM ───
  JUP: { layer: 'dApp', name: 'Jupiter', parent: 'SOL' },
  PYTH: { layer: 'dApp', name: 'Pyth', parent: 'SOL' },
  RAY: { layer: 'dApp', name: 'Raydium', parent: 'SOL' },
  JTO: { layer: 'dApp', name: 'Jito', parent: 'SOL' },
  TNSR: { layer: 'dApp', name: 'Tensor', parent: 'SOL' },
  DRIFT: { layer: 'dApp', name: 'Drift', parent: 'SOL' },
  RNDR: { layer: 'dApp', name: 'Render', parent: 'SOL' }, // Migrated to SOL
  HNT: { layer: 'dApp', name: 'Helium', parent: 'SOL' }, // Migrated to SOL
  MOBILE: { layer: 'dApp', name: 'Helium Mobile', parent: 'SOL' },
  HONEY: { layer: 'dApp', name: 'Hivemapper', parent: 'SOL' },
  POLIS: { layer: 'dApp', name: 'Star Atlas DAO', parent: 'SOL' },
  ATLAS: { layer: 'dApp', name: 'Star Atlas', parent: 'SOL' },
  ORCA: { layer: 'dApp', name: 'Orca', parent: 'SOL' },
  
  // SOLANA MEMES
  WIF: { layer: 'Meme', name: 'Dogwifhat', parent: 'SOL' },
  BONK: { layer: 'Meme', name: 'Bonk', parent: 'SOL' },
  BOME: { layer: 'Meme', name: 'BOOK OF MEME', parent: 'SOL' },
  MEW: { layer: 'Meme', name: 'cat in a dogs world', parent: 'SOL' },
  POPCAT: { layer: 'Meme', name: 'Popcat', parent: 'SOL' },
  MYRO: { layer: 'Meme', name: 'Myro', parent: 'SOL' },
  PONKE: { layer: 'Meme', name: 'Ponke', parent: 'SOL' },
  SLERF: { layer: 'Meme', name: 'Slerf', parent: 'SOL' },
  WEN: { layer: 'Meme', name: 'Wen', parent: 'SOL' },

  // ─── BITCOIN L2s & MEMES ───
  STX: { layer: 'L2', name: 'Stacks', parent: 'BTC' },
  ORDI: { layer: 'Meme', name: 'ORDI', parent: 'BTC' },
  SATS: { layer: 'Meme', name: 'SATS', parent: 'BTC' },
  RATS: { layer: 'Meme', name: 'RATS', parent: 'BTC' },
  PUPS: { layer: 'Meme', name: 'PUPS', parent: 'BTC' },

  // ─── BNB CHAIN dApps ───
  CAKE: { layer: 'dApp', name: 'PancakeSwap', parent: 'BNB' },
  XVS: { layer: 'dApp', name: 'Venus', parent: 'BNB' },
  BAKE: { layer: 'dApp', name: 'BakeryToken', parent: 'BNB' },
  TWT: { layer: 'dApp', name: 'Trust Wallet', parent: 'BNB' },
  ID: { layer: 'dApp', name: 'Space ID', parent: 'BNB' },
  SFP: { layer: 'dApp', name: 'SafePal', parent: 'BNB' },

  // ─── AVALANCHE dApps ───
  JOE: { layer: 'dApp', name: 'Trader Joe', parent: 'AVAX' },
  PNG: { layer: 'dApp', name: 'Pangolin', parent: 'AVAX' },
  QI: { layer: 'dApp', name: 'BENQI', parent: 'AVAX' },

  // ─── STABLECOINS & FIAT (Usually filtered out, but just in case) ───
  USDT: { layer: 'Stablecoin', name: 'Tether', parent: null },
  USDC: { layer: 'Stablecoin', name: 'USDC', parent: null },
  DAI: { layer: 'Stablecoin', name: 'Dai', parent: 'ETH' },
  FDUSD: { layer: 'Stablecoin', name: 'First Digital USD', parent: null },
  TUSD: { layer: 'Stablecoin', name: 'TrueUSD', parent: null },
  USDE: { layer: 'Stablecoin', name: 'Ethena USDe', parent: 'ETH' }
};

export const getTokenLayer = (symbol) => {
  const base = symbol.replace('USDT', '');
  return TOKEN_DB[base]?.layer || null;
};

export const getTokenInfo = (symbol) => {
  const base = symbol.replace('USDT', '');
  return TOKEN_DB[base] || { layer: 'Standalone', name: base, parent: null, type: 'Unknown' };
};
