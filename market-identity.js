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
  const api = {sameAddress, matchesToken, poolKey};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RadarIdentity = api;
})(typeof window !== 'undefined' ? window : globalThis);
