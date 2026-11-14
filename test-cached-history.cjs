'use strict';

const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { testServer } = require('./website-test-server.cjs');

const chain = 'solana';
const address = '22oDtUuTerJC5sbiYD8UQngsJaGe9pgiMxX3RA3mjJCh';
const pool = 'DH2nkUP6GA85ydDjo8Rz7smVcUkq841frwmNwfVCRBhC';
const first = '2026-11-12T18:10:46.104810+00:00';
const latest = '2026-11-12T18:37:48.240216+00:00';
const authorization = 'Basic ' + Buffer.from('reviewer:website-fixture').toString('base64');
const path = '/api/radar/history?' + new URLSearchParams({ chain, address, pool });

function historyFixture() {
  const row = (observed, holderTime) => ({
    chain, contract_address: address, pool_address: pool, observed_at_utc: observed,
    holder_count: 75, holder_status: 'VERIFIED', holder_source: 'Helius getTokenAccounts',
    holder_observed_at_utc: holderTime, address_identity_version: 2,
    source: 'DexScreener token-pairs API', liquidity_usd: 3164.21, volume_5m_usd: 0,
    internal: 'backend-only'
  });
  return { chain, contract_address: address, pools: [{ pool_address: pool, observations: [
    row('2026-11-12T18:10:45.705362+00:00', first),
    row('2026-11-12T18:14:06.010301+00:00', first),
    row('2026-11-12T18:37:47.937202+00:00', latest),
    { ...row('2026-11-12T18:41:00.000000+00:00', null), holder_status: 'UNAVAILABLE' }
  ] }] };
}

async function start(t, request, revision) {
  const server = testServer({ password: 'website-fixture', radarKey: 'upstream-fixture', request, revision });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:' + server.address().port;
}

test('the test server authenticates and retrieves only exact saved pool evidence', async t => {
  const calls = [];
  const origin = await start(t, async (url, options) => {
    calls.push({ url, options });
    return Response.json(historyFixture());
  });
  const denied = await fetch(origin + path, { headers: { 'oai-authenticated-user-id': 'untrusted' } });
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('www-authenticate'), /^Basic /);
  const invalid = await fetch(origin + path + '&pool=duplicate', { headers: { authorization } });
  assert.equal(invalid.status, 400);
  assert.equal(calls.length, 0);

  const config = await fetch(origin + '/config.js', { headers: { authorization } });
  assert.match(await config.text(), /RADAR_CACHED_HISTORY_ENABLED = true/);
  const response = await fetch(origin + path, { headers: { authorization } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  assert.deepEqual(data.holder_trend, {
    status: 'UNCHANGED', verified_observations: 2,
    first: { count: 75, observed_at_utc: first },
    latest: { count: 75, observed_at_utc: latest },
    growth_pct: 0
  });
  assert.equal(data.observations[0].observed_at_utc, '2026-11-12T18:41:00.000000+00:00');
  assert.equal(data.observations[0].holder_count, null);
  assert.equal(data.observations[0].volume_5m_usd, 0);
  assert.doesNotMatch(JSON.stringify(data), /backend-only|fixture/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, 'https://ai-meme-radar-verify-test.onrender.com');
  assert.equal(calls[0].url.pathname, '/api/research/risk-history');
  assert.deepEqual([...calls[0].url.searchParams], [['chain', chain], ['address', address]]);
  assert.equal(calls[0].options.headers['X-Radar-Test-Key'], 'upstream-fixture');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.redirect, 'manual');
});

test('throttling and conflicting saved evidence produce controlled error states', async t => {
  let calls = 0;
  const origin = await start(t, async () => {
    if (!calls++) return new Response('upstream details', { status: 429 });
    const data = historyFixture();
    data.pools[0].observations[1].holder_count = 76;
    return Response.json(data);
  });
  const get = () => fetch(origin + path, { headers: { authorization } });
  const throttled = await get();
  assert.equal(throttled.status, 429);
  assert.equal((await throttled.json()).status, 'RETRY_LATER');
  const conflict = await get();
  assert.equal(conflict.status, 503);
  assert.deepEqual(await conflict.json(), { status: 'UNAVAILABLE' });
});

test('Radar authentication failure is separate from website sign-in', async t => {
  const origin = await start(t, async () => new Response('upstream details', { status: 401 }));
  const response = await fetch(origin + path, { headers: { authorization } });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('www-authenticate'), null);
  assert.deepEqual(await response.json(), { status: 'BACKEND_AUTH_REQUIRED', observations: [] });
});

test('the test gateway identifies its revision and recovers from an upstream timeout', async t => {
  let attempts = 0;
  const revision = 'a'.repeat(40);
  const origin = await start(t, async () => {
    if (attempts++ === 0) {
      return new Response(new ReadableStream({
        start(controller) { controller.error(new DOMException('Timed out', 'TimeoutError')); }
      }));
    }
    return Response.json(historyFixture());
  }, revision);
  const health = await fetch(origin + '/healthz');
  assert.deepEqual(await health.json(), { status: 'OK', revision });
  assert.equal(attempts, 0);
  const get = () => fetch(origin + path, { headers: { authorization } });
  const timeout = await get();
  assert.equal(timeout.status, 504);
  assert.deepEqual(await timeout.json(), { status: 'BACKEND_TIMEOUT', observations: [] });
  assert.equal((await (await get()).json()).status, 'READY');
});

test('the history panel renders authenticated gateway evidence and supports retry', async t => {
  const fixture = historyFixture();
  delete fixture.pools[0].observations[0].source;
  const origin = await start(t, async () => Response.json(fixture));
  function element(tag) {
    return { tag, children: [], get childElementCount() { return this.children.length; }, setAttribute() {}, append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      addEventListener(_event, callback) { this.activate = callback; } };
  }
  const window = { RADAR_CACHED_HISTORY_ENABLED: true };
  let calls = 0;
  const context = { document: { createElement: element }, window, AbortController, setTimeout, clearTimeout, URLSearchParams,
    fetch: async (url, options) => !calls++ ? new Response('', { status: 429 })
      : fetch(origin + url, { ...options, headers: { authorization } }) };
  vm.runInNewContext(readFileSync(require.resolve('./cached-history.js'), 'utf8'), context);
  const card = element('article');
  card.dataset = { chain, pool, token: address };
  window.RadarCachedHistory.mount(card);
  const [button, status, panel] = card.children[0].children;
  await button.activate();
  assert.match(status.textContent, /busy/);
  assert.equal(button.disabled, false);
  await button.activate();
  assert.match(status.textContent, /loaded/);
  const labels = panel.children[0].children.map(item => item.textContent);
  assert.match(labels[0], /75.*2026-11-12T18:37:48/);
  assert.equal(labels[1], 'Verified holder trend: UNCHANGED · 75 → 75 (0%)');
  assert.equal(labels[2], 'Buyer growth: Unverified');
  assert.equal(labels[3], 'Holder observations: ' + first + ' → ' + latest);
  const marketRows = panel.children[2].children.map(item => item.textContent);
  assert.match(marketRows[0], /2026-11-12T18:41:00.*Liquidity .* · 5m volume \$0 · DexScreener/);
  assert.match(marketRows.at(-1), /Liquidity Unavailable · 5m volume Unavailable · Source unavailable/);
  context.fetch = async () => new Response('', { status: 504 });
  await button.activate();
  assert.match(status.textContent, /Radar history request timed out/);
  assert.equal(panel.childElementCount, 3);
  assert.equal(button.disabled, false);
  context.fetch = async () => new Response('', { status: 503 });
  await button.activate();
  assert.match(status.textContent, /Showing the last saved observations/);
  assert.equal(panel.childElementCount, 3);
  context.fetch = async () => new Response('', { status: 401 });
  await button.activate();
  assert.match(status.textContent, /sign in/);
  assert.equal(panel.childElementCount, 0);
});

test('duplicate market timestamps coalesce only when projected evidence agrees', async t => {
  let conflict = false;
  const origin = await start(t, async () => {
    const data = historyFixture();
    const rows = data.pools[0].observations;
    rows.push({ ...rows[0], observed_at_utc: '2026-11-12T19:10:45.705362+01:00',
      liquidity_usd: conflict ? 1 : rows[0].liquidity_usd });
    return Response.json(data);
  });
  const get = () => fetch(origin + path, { headers: { authorization } });
  const consistent = await get();
  assert.equal(consistent.status, 200);
  assert.equal((await consistent.json()).observations.length, 4);
  conflict = true;
  const inconsistent = await get();
  assert.equal(inconsistent.status, 503);
  assert.deepEqual(await inconsistent.json(), { status: 'UNAVAILABLE' });
});

test('distinct microsecond observations within a millisecond remain distinct', async t => {
  const origin = await start(t, async () => {
    const data = historyFixture();
    const rows = data.pools[0].observations;
    rows.push({ ...rows[0], observed_at_utc: '2026-11-12T18:10:45.705363Z',
      holder_observed_at_utc: '2026-11-12T18:10:46.104811Z', holder_count: 76 });
    return Response.json(data);
  });
  const response = await fetch(origin + path, { headers: { authorization } });
  assert.equal(response.status, 200);
  const history = await response.json();
  assert.equal(history.observations.length, 5);
  assert.equal(history.holder_trend.verified_observations, 3);
  assert.equal(history.observations.at(-2).holder_count, 76);
});

test('unreadable market timestamps withhold an otherwise populated history', async t => {
  let stamp;
  const origin = await start(t, async () => {
    const data = historyFixture();
    data.pools[0].observations[0].observed_at_utc = stamp;
    return Response.json(data);
  });
  for (stamp of ['2026-11-12T18:10:45', '2026-02-30T18:10:45Z', '2026-11-12T24:00:00Z']) {
    const response = await fetch(origin + path, { headers: { authorization } });
    assert.equal(response.status, 503, stamp);
    assert.deepEqual(await response.json(), { status: 'UNAVAILABLE' });
  }
});

test('cached market figures require recognized provenance independently of holder evidence', async t => {
  const fixture = historyFixture();
  const rows = fixture.pools[0].observations;
  delete rows[0].source;
  rows[1].source = 'Unrecognized market feed';
  const origin = await start(t, async () => Response.json(fixture));
  const response = await fetch(origin + path, { headers: { authorization } });
  assert.equal(response.status, 200);
  const data = await response.json();
  for (const row of data.observations.slice(-2)) {
    assert.equal(row.market_source, null);
    assert.equal(row.liquidity_usd, null);
    assert.equal(row.volume_5m_usd, null);
    assert.equal(row.holder_count, 75);
  }
  assert.equal(data.observations[0].volume_5m_usd, 0);
  assert.equal(data.holder_trend.verified_observations, 2);
});

test('oversized upstream history is discarded without returning partial evidence', async t => {
  let cancelled = false;
  let chunks = 0;
  const upstream = new ReadableStream({
    pull(controller) {
      chunks++;
      controller.enqueue(new Uint8Array(600 * 1024));
    },
    cancel() { cancelled = true; }
  });
  const origin = await start(t, async () => new Response(upstream));
  const response = await fetch(origin + path, { headers: { authorization } });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'UNAVAILABLE' });
  assert.equal(cancelled, true);
  assert.ok(chunks <= 3, 'the gateway stops consuming the oversized response');
});
