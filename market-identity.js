(function (root) {
  'use strict';
  function sameAddress(chain, a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
    return String(chain).toLowerCase() === 'solana' ? a === b : a.toLowerCase() === b.toLowerCase();
  }
  function matchesToken(pair, address) {
    return [pair.baseToken?.address, pair.quoteToken?.address].some(a => sameAddress(pair.chainId, a, address));
  }
  function poolKey(pair) {
    const chain = String(pair.chainId || 'unknown').toLowerCase();
    const pool = String(pair.pairAddress || '');
    return chain + ':' + (chain === 'solana' ? pool : pool.toLowerCase());
  }
  function transactionCount(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  // Provider price, valuation and transaction direction describe the base token.
  function tokenMetrics(pair, address) {
    const isBase = sameAddress(pair?.chainId, pair?.baseToken?.address, address);
    return {
      isBase,
      priceUsd: isBase ? pair.priceUsd : null,
      priceChange5mPct: isBase ? pair.priceChange?.m5 : null,
      marketCap: isBase ? pair.marketCap : null,
      fdv: isBase ? pair.fdv : null,
      buys5m: isBase ? transactionCount(pair.txns?.m5?.buys) : null,
      sells5m: isBase ? transactionCount(pair.txns?.m5?.sells) : null
    };
  }
  const dexNames = new Map([
    ['pancakeswap', 'PancakeSwap'], ['uniswap', 'Uniswap'],
    ['raydium', 'Raydium'], ['orca', 'Orca'], ['meteora', 'Meteora'],
    ['aerodrome', 'Aerodrome'], ['sushiswap', 'SushiSwap']
  ]);
  function dexDisplay(pair) {
    const id = typeof pair.dexId === 'string' ? pair.dexId.trim() : '';
    if (/^0x[0-9a-f]{40}$/i.test(id)) {
      return { label: id.slice(0, 8) + '…' + id.slice(-6), fullId: id };
    }
    return { label: dexNames.get(id.toLowerCase()) ?? (id || 'Unknown DEX'), fullId: null };
  }
  function addressMatchesNetwork(chain, address) {
    if (typeof address !== 'string') return false;
    const evm = /^0x[a-fA-F0-9]{40}$/.test(address);
    const solana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    const network = String(chain || '').toLowerCase();
    if (network === 'solana') return solana;
    const evmNetworks = ['bsc','base','ethereum','arbitrum','polygon','avalanche','optimism',
      'linea','zksync','zksync_era','fantom','mantle','cronos','robinhood'];
    return evmNetworks.includes(network) ? evm : evm || solana;
  }
  const api = {sameAddress, matchesToken, poolKey, tokenMetrics, dexDisplay, addressMatchesNetwork};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RadarIdentity = api;
})(typeof window !== 'undefined' ? window : globalThis);

