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
