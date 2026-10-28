export const fetchLiveTransactions = async (targetAddress, apiKey) => {
  const url = `https://api.helius.xyz/v0/addresses/${targetAddress}/transactions?api-key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Helius API Error: ${response.statusText}`);
    
    const data = await response.json();
    
    // Convertir les données Helius en un format compatible avec notre moteur CSV
    const mappedData = data.map(tx => {
      // Pour les SWAPS
      if (tx.type === 'SWAP') {
        // Helius donne souvent le montant dans la description, sinon on utilise les tokenTransfers
        let price = 0;
        let action = 'SWAP';
        let amount = 0;
        
        // Essayer d'extraire depuis la description (ex: "swapped 17 JUP for 2.6 USDT")
        if (tx.description) {
          const match = tx.description.match(/swapped ([\d.]+) (\w+) for ([\d.]+) (\w+)/);
          if (match) {
            const [, amountIn, tokenIn, amountOut, tokenOut] = match;
            
            // Est-ce un achat ou une vente par rapport au jeton cible ?
            // Si on ne connait pas le jeton cible (on explore un wallet), on suppose que USDT/USDC est l'argent
            if (tokenOut.includes('USD') || tokenOut === 'SOL') {
              action = 'SELL';
              amount = parseFloat(amountIn);
              price = parseFloat(amountOut) / amount;
            } else {
              action = 'BUY';
              amount = parseFloat(amountOut);
              price = parseFloat(amountIn) / amount;
            }
          }
        }
        let actor = tx.feePayer;
        if (tx.tokenTransfers && tx.tokenTransfers.some(t => t.fromUserAccount === targetAddress || t.toUserAccount === targetAddress)) {
          actor = targetAddress;
        } else if (tx.nativeTransfers && tx.nativeTransfers.some(t => t.fromUserAccount === targetAddress || t.toUserAccount === targetAddress)) {
          actor = targetAddress;
        }

        return {
          From: actor,
          To: actor,
          Action: action,
          Amount: amount || 1, // Fallback
          Price: price || 0,
          "Token In": "UNKNOWN",
          "Token Out": "UNKNOWN",
          Txhash: tx.signature
        };
      }
      
      // Pour les Transferts simples
      if (tx.type === 'TRANSFER') {
        let amount = 0;
        let from = tx.feePayer;
        let to = tx.feePayer; // Valeur par défaut
        
        if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
          amount = tx.tokenTransfers[0].tokenAmount;
          from = tx.tokenTransfers[0].fromUserAccount;
          to = tx.tokenTransfers[0].toUserAccount;
        } else if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
          amount = tx.nativeTransfers[0].amount / 1e9;
          from = tx.nativeTransfers[0].fromUserAccount;
          to = tx.nativeTransfers[0].toUserAccount;
        }
        
        return {
          From: from,
          To: to,
          Action: 'TRANSFER',
          Amount: amount,
          Price: 0,
          Txhash: tx.signature
        };
      }
      
      // Autres types ignorés (MINT, BURN, etc.)
      return null;
    }).filter(x => x !== null);

    return mappedData;
  } catch (error) {
    console.error("Erreur ApiConnector:", error);
    throw error;
  }
};

export const runAutoDiscovery = async (apiKey) => {
  if (!apiKey) throw new Error("Clé API Helius manquante");
  
  // On va scanner JUP
  const targetToken = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
  const url = `https://api.helius.xyz/v0/addresses/${targetToken}/transactions?api-key=${apiKey}&type=SWAP`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Erreur réseau Helius");
    const data = await response.json();
    
    // On extrait les portefeuilles qui ont fait les swaps
    const candidates = {};
    
    data.forEach(tx => {
      if (tx.type === 'SWAP') {
        const signer = tx.feePayer;
        if (!candidates[signer]) {
          candidates[signer] = { address: signer, txCount: 0, swapsCount: 0, lastAction: null };
        }
        
        candidates[signer].txCount++;
        candidates[signer].swapsCount++;
        
        // Determiner si achat ou vente
        const desc = tx.description || "";
        if (desc.includes('swapped') && desc.includes('for JUP')) {
          candidates[signer].lastAction = 'ACHAT';
        } else {
          candidates[signer].lastAction = 'VENTE';
        }
      }
    });
    
    // On garde que le top
    return Object.values(candidates)
      .sort((a, b) => b.swapsCount - a.swapsCount)
      .slice(0, 50);
      
  } catch (error) {
    console.error("Erreur Discovery:", error);
    throw error;
  }
};
