'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

function harness(reply) {
  function element(tag) {
    return { tag, children: [], get childElementCount() { return this.children.length; },
      setAttribute() {}, append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      addEventListener(_name, callback) { this.activate = callback; } };
  }
  const timers = new Map();
  let next = 0;
  const requests = [];
  const context = {
    window: { RADAR_CACHED_HISTORY_ENABLED: true }, document: { createElement: element },
    AbortController, URLSearchParams,
    // Deliberately no AbortSignal global or timeout static method.
    setTimeout(callback, delay) { const id = ++next; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) { requests.push({ url, options }); return reply(url, options); }
  };
  vm.runInNewContext(readFileSync(require.resolve('./cached-history.js'), 'utf8'), context);
  const card = element('article');
  card.dataset = { chain: 'solana', token: 'mint-fixture', pool: 'pool-fixture' };
  context.window.RadarCachedHistory.mount(card);
  const [button, status, panel] = card.children[0].children[3].children;
  return { button, status, panel, requests, timers, context,
    fireTimeout() {
      assert.equal(timers.size, 1);
      const [id, timer] = [...timers][0];
      assert.equal(timer.delay, 8500);
      timers.delete(id);
      timer.callback();
    } };
}

function rejectOnAbort(signal) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('synthetic timeout')), { once: true });
  });
}

test('on-chain history loads without AbortSignal.timeout and clears its timer', async () => {
  const h = harness(async () => Response.json({ status: 'EMPTY' }));
  await h.button.activate();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.credentials, 'same-origin');
  assert.equal(h.requests[0].options.cache, 'no-store');
  assert.match(h.status.textContent, /No saved on-chain evidence/);
  assert.equal(h.button.disabled, false);
  assert.equal(h.timers.size, 0);
});

test('a hung request aborts once, rejects duplicate clicks and permits manual retry', async () => {
  const h = harness((_url, { signal }) => rejectOnAbort(signal));
  const pending = h.button.activate();
  await h.button.activate();
  assert.equal(h.requests.length, 1);
  assert.equal(h.button.disabled, true);
  h.fireTimeout();
  await pending;
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.match(h.status.textContent, /timed out.*Try again/);
  assert.equal(h.button.disabled, false);
  assert.equal(h.panel.childElementCount, 0);
  assert.equal(h.timers.size, 0);
  h.context.fetch = async () => Response.json({ status: 'EMPTY' });
  await h.button.activate();
  assert.match(h.status.textContent, /No saved on-chain evidence/);
  assert.equal(h.timers.size, 0);
});

test('timeout also covers reading the response body', async () => {
  let reading;
  const bodyStarted = new Promise(resolve => { reading = resolve; });
  const h = harness(async (_url, { signal }) => ({ status: 200, ok: true,
    json() { reading(); return rejectOnAbort(signal); } }));
  const pending = h.button.activate();
  await Promise.race([bodyStarted, pending.then(() => { throw new Error('Request ended before reading body'); })]);
  h.fireTimeout();
  await pending;
  assert.match(h.status.textContent, /timed out/);
  assert.equal(h.timers.size, 0);
  assert.equal(h.button.disabled, false);
});

test('auth, cooldown, backend timeout and malformed responses always clean up', async () => {
  const responses = [
    [() => new Response('', { status: 401 }), /sign in/],
    [() => new Response('', { status: 403 }), /sign in/],
    [() => new Response('', { status: 429, headers: { 'Retry-After': '30' } }), /busy/],
    [() => new Response('', { status: 504 }), /timed out/],
    [() => Response.json({ status: 'BACKEND_AUTH_REQUIRED' }, { status: 503 }), /could not authenticate/],
    [() => new Response('bad json'), /unavailable/]
  ];
  for (const [reply, message] of responses) {
    const h = harness(async () => reply());
    await h.button.activate();
    assert.match(h.status.textContent, message);
    assert.equal(h.timers.size, 0);
    assert.equal(h.button.disabled, false);
  }
});
