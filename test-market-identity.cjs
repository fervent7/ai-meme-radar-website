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


test('network address format rejects mismatched known networks without claiming contract existence',()=>{
 const evm='0x'+'a'.repeat(40),solana='A'.repeat(32);
 for(const chain of ['bsc','base','ethereum','robinhood','arbitrum']){
  assert.equal(identity.addressMatchesNetwork(chain,evm),true);
  assert.equal(identity.addressMatchesNetwork(chain,solana),false);
 }
 assert.equal(identity.addressMatchesNetwork('solana',evm),false);
 assert.equal(identity.addressMatchesNetwork('solana',solana),true);
 for(const chain of ['', 'another-indexed-chain']){
  assert.equal(identity.addressMatchesNetwork(chain,evm),true);
  assert.equal(identity.addressMatchesNetwork(chain,solana),true);
 }
 assert.equal(identity.addressMatchesNetwork('bsc',null),false);
});
