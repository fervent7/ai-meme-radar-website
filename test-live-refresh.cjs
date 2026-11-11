const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

test('a cancelled refresh cannot replace cards or overwrite the next refresh status', async () => {
  const source = readFileSync(join(__dirname, 'app.js'), 'utf8');
  const start = source.indexOf('const LIVE_INTERVAL_MS');
  const end = source.indexOf('function radarPreviewLink', start);
  assert.ok(start >= 0 && end > start);
  const status = {textContent: ''};
  const pending = [];
  const replaced = [];
  let cards = [card('old')];
  function card(pool) {
    return {dataset: {chain: 'solana', pool, token: 'mint'},
      replaceWith() { replaced.push(pool); }};
  }
  const context = {
    AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
    results: {querySelectorAll: () => cards},
    document: {hidden: false, getElementById: () => status},
    window: {RadarIdentity: require('./market-identity.js')},
    fetch: (url, options) => new Promise(resolve => pending.push({resolve, signal: options.signal}))
  };
  const api = vm.runInNewContext(source.slice(start, end) +
    '\nrenderLivePair = pair => pair; ({refreshLive, stopLive})', context);
  const first = api.refreshLive();
  api.stopLive();
  assert.equal(pending[0].signal.aborted, true);
  cards = [card('new')];
  const second = api.refreshLive();
  assert.equal(pending.length, 2);
  const reply = pool => ({ok: true, json: async () => ({pairs: [
    {chainId: 'solana', pairAddress: pool, baseToken: {address: 'mint'}}
  ]})});
  pending[1].resolve(reply('new'));
  await second;
  const currentStatus = status.textContent;
  assert.match(currentStatus, /updated/);
  pending[0].resolve(reply('old'));
  await first;
  assert.deepEqual(replaced, ['new']);
  assert.equal(status.textContent, currentStatus);
});
