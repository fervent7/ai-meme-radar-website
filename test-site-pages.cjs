'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { testServer } = require('./website-test-server.cjs');

const routes = ['index.html', 'research.html', 'intelligence.html', 'liquidity.html', 'roadmap.html', 'community.html'];

test('review pages and shared navigation are served behind the existing sign-in', async t => {
  const server = testServer({ password: 'website-fixture', radarKey: 'radar-fixture',
    request: async () => assert.fail('Page loads must not invoke Radar history') });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const headers = { authorization: 'Basic ' + Buffer.from('reviewer:website-fixture').toString('base64') };
  for (const route of routes) {
    assert.equal((await fetch(origin + '/' + route)).status, 401);
    const response = await fetch(origin + '/' + route, { headers });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /aria-controls="nav" aria-expanded="false"/);
    assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);
    assert.ok(html.includes('href="' + route + '" aria-current="page"'));
    assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1, route);
    for (const link of routes) assert.ok(html.includes('href="' + link + '"'));
    assert.ok(html.includes('Research Before Risk'));
    assert.equal(html.includes('src="cached-history.js"'), route === 'research.html');
  }
  assert.equal((await fetch(origin + '/site.js', { headers })).status, 200);
});
