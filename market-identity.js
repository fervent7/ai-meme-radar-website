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
  const api = {sameAddress, matchesToken, poolKey, tokenMetrics};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RadarIdentity = api;
})(typeof window !== 'undefined' ? window : globalThis);
