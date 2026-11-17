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
  const configBody = await config.text();
  assert.match(configBody, /RADAR_CACHED_HISTORY_ENABLED = true/);
  assert.doesNotMatch(configBody, /upstream-fixture/);
  const document = await fetch(origin + '/research.html', { headers: { authorization } });
  const policy = document.headers.get('content-security-policy');
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
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
    if (!calls++) return new Response('upstream details', { status: 429, headers: { 'Retry-After': '45' } });
    const data = historyFixture();
    data.pools[0].observations[1].holder_count = 76;
    return Response.json(data);
  });
  const get = () => fetch(origin + path, { headers: { authorization } });
  const throttled = await get();
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers.get('Retry-After'), '45');
  assert.deepEqual(await throttled.json(), { status: 'RETRY_LATER', observations: [], retry_after_seconds: 45 });
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
  fixture.pools[0].observations[1].volume_5m_usd = 0.0001;
  let upstream = () => Response.json(fixture);
  const origin = await start(t, async () => upstream());
  function element(tag) {
    return { tag, children: [], get childElementCount() { return this.children.length; }, setAttribute() {}, append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      addEventListener(_event, callback) { this.activate = callback; } };
  }
  const window = { RADAR_CACHED_HISTORY_ENABLED: true };
  let calls = 0;
  let now = 0;
  const context = { Date: class extends Date { static now() { return now; } }, document: { createElement: element }, window, AbortController, AbortSignal, setTimeout, clearTimeout, URLSearchParams,
    fetch: async (url, options) => !calls++ ? new Response('', { status: 429 })
      : fetch(origin + url, { ...options, headers: { authorization } }) };
  vm.runInNewContext(readFileSync(require.resolve('./cached-history.js'), 'utf8'), context);
  const card = element('article');
  card.dataset = { chain, pool, token: address };
  window.RadarCachedHistory.mount(card);
  const [button, status, panel] = card.children[0].children;
  await button.activate();
  assert.match(status.textContent, /Try again in 30 seconds/);
  assert.equal(button.disabled, false);
  now = 29000;
  await button.activate();
  assert.equal(calls, 1);
  assert.match(status.textContent, /Try again in 1 second/);
  now = 30000;
  await button.activate();
  assert.equal(calls, 2);
  assert.match(status.textContent, /loaded/);
  const labels = panel.children[0].children.map(item => item.textContent);
  assert.match(labels[0], /^Verified holder owner addresses: 75.*2026-11-12T18:37:48/);
  assert.equal(labels[1], 'Verified holder trend: UNCHANGED · 75 → 75 (0%)');
  assert.equal(labels[2], 'Buyer growth: Unverified');
  assert.equal(labels[3], 'Holder observations: ' + first + ' → ' + latest);
  const marketRows = panel.children[2].children.map(item => item.textContent);
  assert.match(marketRows[0], /2026-11-12T18:41:00.*Liquidity .* · 5m volume \$0 · DexScreener/);
  assert.match(marketRows.at(-2), /5m volume Less than \$0\.01/);
  assert.match(marketRows.at(-1), /Liquidity Unavailable · 5m volume Unavailable · Source unavailable/);
  upstream = () => Response.json({ ...fixture, pools: [] });
  await button.activate();
  assert.match(status.textContent, /No saved observations/);
  assert.equal(panel.childElementCount, 0);

  upstream = () => Response.json(fixture);
  await button.activate();
  assert.equal(panel.childElementCount, 3);
  upstream = () => new Response('', { status: 403 });
  await button.activate();
  assert.match(status.textContent, /could not authenticate to the Radar backend/);
  assert.equal(panel.childElementCount, 0);

  upstream = () => Response.json(fixture);
  await button.activate();
  context.fetch = async () => new Response('', { status: 504 });
  await button.activate();
  assert.match(status.textContent, /Radar history request timed out/);
  assert.equal(panel.childElementCount, 3);
  assert.equal(button.disabled, false);
  context.fetch = async () => new Response('', { status: 503 });
  await button.activate();
  assert.match(status.textContent, /Showing the last saved observations/);
  assert.equal(panel.childElementCount, 3);
  let finish;
  let pendingCalls = 0;
  context.fetch = () => {
    pendingCalls++;
    return new Promise(resolve => { finish = resolve; });
  };
  const refresh = button.activate();
  await button.activate();
  assert.equal(pendingCalls, 1);
  assert.match(status.textContent, /Loading.*last saved observations/);
  finish(new Response('', { status: 401 }));
  await refresh;
  assert.match(status.textContent, /sign in/);
  assert.equal(panel.childElementCount, 0);

  const [onchainButton, onchainStatus] = card.children[0].children[3].children;
  context.fetch = async () => new Response('', { status: 401 });
  await onchainButton.activate();
  assert.match(onchainStatus.textContent, /sign in/);
  context.fetch = async () => Response.json({ status: 'BACKEND_AUTH_REQUIRED' }, { status: 503 });
  await onchainButton.activate();
  assert.match(onchainStatus.textContent, /could not authenticate to the Radar backend/);
  context.fetch = async () => new Response('', { status: 504 });
  await onchainButton.activate();
  assert.match(onchainStatus.textContent, /timed out/);
  context.fetch = async () => Response.json({ status: 'UNAVAILABLE' });
  await onchainButton.activate();
  assert.match(onchainStatus.textContent, /is unavailable/);
  context.fetch = async () => Response.json({ status: 'EMPTY' });
  await onchainButton.activate();
  assert.match(onchainStatus.textContent, /No saved on-chain evidence/);
  const unavailable = { verification: 'ERROR', observed_at_utc: latest };
  context.fetch = async () => Response.json({
    status: 'READY', holders: [unavailable], swaps: [], reserves: []
  });
  await onchainButton.activate();
  assert.match(onchainStatus.textContent, /could not be verified/);
  assert.ok(card.children[0].children[3].children[2].childElementCount > 0);
  let onchainCalls = 0;
  context.fetch = async () => ++onchainCalls === 1
    ? new Response('', { status: 429, headers: { 'Retry-After': '45' } })
    : Response.json({ status: 'EMPTY' });
  await onchainButton.activate();
  assert.match(onchainStatus.textContent, /Try again in 45 seconds/);
  now += 44000;
  await onchainButton.activate();
  assert.equal(onchainCalls, 1);
  assert.match(onchainStatus.textContent, /Try again in 1 second/);
  now += 1000;
  await onchainButton.activate();
  assert.equal(onchainCalls, 2);
  assert.match(onchainStatus.textContent, /No saved on-chain evidence/);
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

test('invalid upstream text encoding makes saved history unavailable', async t => {
  const fixture = historyFixture();
  const payload = Buffer.from(JSON.stringify(fixture).replace('backend-only', 'invalid-encoding'));
  payload[payload.indexOf('invalid-encoding')] = 0xff;
  const origin = await start(t, async () => new Response(payload));
  const response = await fetch(origin + path, { headers: { authorization } });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'UNAVAILABLE' });
});

test('history gateway refuses upstream redirects and withholds destination details', async t => {
  let calls = 0;
  const origin = await start(t, async (_url, options) => {
    calls++;
    assert.equal(options.redirect, 'manual');
    return Response.redirect('https://example.invalid/private-location', 307);
  });
  const response = await fetch(origin + path, { headers: { authorization }, redirect: 'manual' });
  assert.equal(calls, 1);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('location'), null);
  assert.deepEqual(await response.json(), { status: 'UNAVAILABLE', observations: [] });
});

test('gateway preserves the authenticated Radar SQLite response contract', async t => {
  // Synthetic observations returned by Radar's local ASGI app after SQLite restore.
  const { target, history } = require('./test-fixtures/radar-restored-history.json');
  const origin = await start(t, async () => Response.json(history));
  const params = new URLSearchParams({
    chain: target.chain, address: target.token_address, pool: target.pool_address
  });
  const get = () => fetch(origin + '/api/radar/history?' + params, { headers: { authorization } });
  const response = await get();
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.status, 'READY');
  assert.deepEqual(saved.observations.map(row => row.observed_at_utc),
    history.pools[0].observations.map(row => row.observed_at_utc).reverse());
  assert.equal(saved.holder_trend.verified_observations, 2);
  assert.equal(saved.holder_trend.growth_pct, 20);
  params.set('pool', '11111111111111111111111111111111');
  const other = await get();
  assert.equal(other.status, 200);
  assert.equal((await other.json()).status, 'EMPTY');
});

test('on-chain gateway serves finalized evidence for the selected mint and pool only', async t => {
  const sample = (kind, pool_address, reference, payload) => ({
    kind, chain, token_address: address, pool_address, reference,
    observed_at_utc: latest, verification: 'VERIFIED', source: 'https://rpc.example.invalid/path',
    payload: { slot: 10, block_time_utc: first, ...payload }
  });
  const reply = { chain, token_address: address, pool_address: pool,
    holder_observations: [sample('holder_distribution', null, '10', {
      method_version: 'top-10-positive-owner-balances-v1', holder_count: 73,
      total_supply_raw: '10000', top_10_balance_raw: '9864'
    })],
    swaps: [sample('pool_swaps', pool, 'A'.repeat(88), { direction: 'SELL' })],
    reserves: [sample('pool_reserves', pool, '10', { protocol: 'raydium-cpmm', vaults: [
      { mint: address, decimals: 6, reserve_raw: '152' },
      { mint: 'So11111111111111111111111111111111111111112', decimals: 9, reserve_raw: '31' }
    ] })]
  };
  let calls = 0;
  const origin = await start(t, async (url, options) => {
    calls++;
    assert.equal(url.pathname, '/api/research/onchain-history');
    assert.deepEqual([...url.searchParams], [['address', address], ['pool', pool]]);
    assert.equal(options.redirect, 'manual');
    return Response.json(reply);
  });
  const endpoint = origin + path.replace('/history?', '/onchain-history?');
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal(calls, 0);
  const response = await fetch(endpoint, { headers: { authorization } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.holders[0].concentration_pct, 98.64);
  assert.equal(body.holders[0].source, 'https://rpc.example.invalid');
  assert.equal(body.swaps[0].organic, 'UNVERIFIED');
  assert.equal(body.reserves[0].vaults[0].reserve_raw, '152');

  const get = () => fetch(endpoint, { headers: { authorization } });
  const vault = reply.reserves[0].payload.vaults[0];
  vault.reserve_raw = '18446744073709551615';
  const max = await get();
  assert.equal(max.status, 200);
  assert.equal((await max.json()).reserves[0].vaults[0].reserve_raw, vault.reserve_raw);
  vault.reserve_raw = '18446744073709551616';
  assert.equal((await get()).status, 503);
  vault.reserve_raw = '152';

  reply.reserves[0].pool_address = '1'.repeat(32);
  assert.equal((await fetch(endpoint, { headers: { authorization } })).status, 503);
});
