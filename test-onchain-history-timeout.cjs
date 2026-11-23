'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

function harness(reply) {
  function element(tag) {
    return { tag, children: [], get childElementCount() { return this.children.length; },
      attributes: {}, setAttribute(key,value) { this.attributes[key]=value; }, append(...items) { this.children.push(...items); },
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



test('refresh failures retain original evidence with explicit stale-refresh status', async () => {
  for (const reply of [() => new Response('',{status:429}),
                       () => new Response('',{status:504}),
                       () => new Response('bad json'),
                       () => Response.json({status:'READY',holders:[]})]) {
    const h=harness(async()=>reply());
    const original={textContent:'Original evidence · 2026-11-12T18:37:48.240216Z'};
    h.panel.append(original);
    await h.button.activate();
    assert.equal(h.panel.children.length,1);
    assert.equal(h.panel.children[0],original);
    assert.match(h.status.textContent,/Showing previously loaded saved evidence; refresh not confirmed/);
    assert.equal(h.panel.attributes['aria-busy'],'false');
    assert.equal(h.button.disabled,false);
    assert.equal(h.timers.size,0);
  }
});

test('timeout retains prior evidence and busy state clears after abort', async () => {
  const h=harness((_url,{signal})=>rejectOnAbort(signal));
  const original={textContent:'original timestamp'};
  h.panel.append(original);
  const pending=h.button.activate();
  assert.equal(h.panel.attributes['aria-busy'],'true');
  assert.match(h.status.textContent,/Loading.*previously loaded/);
  h.fireTimeout();
  await pending;
  assert.equal(h.panel.children[0],original);
  assert.match(h.status.textContent,/timed out.*refresh not confirmed/);
  assert.equal(h.panel.attributes['aria-busy'],'false');
});

test('authentication loss or an authoritative empty response clears retained evidence', async () => {
  for (const reply of [()=>new Response('',{status:401}),()=>new Response('',{status:403}),
                      ()=>Response.json({status:'BACKEND_AUTH_REQUIRED'},{status:503}),
                      ()=>Response.json({status:'EMPTY'})]) {
    const h=harness(async()=>reply());
    h.panel.append({textContent:'private retained data'});
    await h.button.activate();
    assert.equal(h.panel.childElementCount,0);
    assert.doesNotMatch(h.status.textContent,/Showing previously/);
    assert.equal(h.panel.attributes['aria-busy'],'false');
  }
});

test('successful refresh atomically replaces rather than appends prior evidence', async () => {
  const h=harness(async()=>Response.json({status:'READY',holders:[],swaps:[],reserves:[]}));
  const original={textContent:'prior'};
  h.panel.append(original);
  await h.button.activate();
  assert.ok(!h.panel.children.includes(original));
  assert.equal(h.panel.childElementCount,6);
  await h.button.activate();
  assert.equal(h.panel.childElementCount,6);
  assert.equal(h.panel.attributes['aria-busy'],'false');
});
