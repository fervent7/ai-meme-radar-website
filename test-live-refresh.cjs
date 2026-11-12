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

test('foreground timeout re-enables research and a retry can complete', async () => {
  const source = readFileSync(join(__dirname, 'app.js'), 'utf8');
  const start = source.indexOf('async function research(');
  const end = source.indexOf("} finally {\n clearTimeout(deadline);", start);
  assert.ok(start >= 0 && end > start);
  const functionEnd = source.indexOf('}}', end) + 2;
  const searchBtn = {disabled: false};
  const messages = {};
  let deadline;
  let requests = 0;
  let notifyBodyStarted;
  const bodyStarted = new Promise(resolve => { notifyBodyStarted = resolve; });
  const context = {
    AbortController, researchController: undefined,
    $: id => id === 'searchBtn' ? searchBtn : {value: 'valid-address'},
    valid: () => true, set: (key, value) => { messages[key] = value; },
    stopLive() {}, liveMessage() {}, esc: value => value,
    results: {replaceChildren() {}},
    setTimeout(callback) { deadline = callback; },
    clearTimeout() {},
    fetch: async (_url, {signal}) => ({
      ok: true,
      json: () => ++requests === 1
        ? new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {once: true});
          notifyBodyStarted();
        })
        : Promise.resolve({pairs: []})
    })
  };
  const research = vm.runInNewContext(source.slice(start, functionEnd) + '\nresearch', context);
  const first = research();
  await bodyStarted;
  assert.equal(searchBtn.disabled, true);
  deadline();
  await first;
  assert.equal(searchBtn.disabled, false);
  assert.match(messages.searchHelp, /timed out.*retry/);
  await research();
  assert.equal(searchBtn.disabled, false);
  assert.match(messages.searchHelp, /No exact-address indexed trading pool found/);
});
