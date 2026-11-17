const test = require('node:test');
const assert = require('node:assert/strict');
const identity = require('./market-identity.js');
test('Solana token addresses are case-sensitive', () => {
  const pair = {chainId: 'solana', baseToken: {address: 'AbCd'}, quoteToken: {address: 'Other'}};
  assert.equal(identity.matchesToken(pair, 'AbCd'), true);
  assert.equal(identity.matchesToken(pair, 'abcd'), false);
});
test('EVM token addresses are case-insensitive', () => {
  assert.equal(identity.matchesToken({chainId: 'bsc', baseToken: {address: '0xAbCd'}}, '0xabcd'), true);
});
test('Solana pools are not merged by case', () => {
  assert.notEqual(identity.poolKey({chainId: 'solana', pairAddress: 'Pool'}), identity.poolKey({chainId: 'solana', pairAddress: 'pool'}));
});
test('Missing addresses never match', () => {
  assert.equal(identity.sameAddress('solana', '', ''), false);
  assert.equal(identity.matchesToken({chainId: 'bsc'}, ''), false);
});

test('indexed-pool DEX labels preserve recognizable names and retain full address IDs', () => {
  assert.deepEqual(identity.dexDisplay({dexId: 'pancakeswap'}), {label: 'PancakeSwap', fullId: null});
  assert.deepEqual(identity.dexDisplay({dexId: 'other-venue'}), {label: 'other-venue', fullId: null});
  const fullId = '0x123456789012345678901234567890123456abcd';
  assert.deepEqual(identity.dexDisplay({dexId: fullId}), {label: '0x123456…56abcd', fullId});
  assert.deepEqual(identity.dexDisplay({}), {label: 'Unknown DEX', fullId: null});
});
