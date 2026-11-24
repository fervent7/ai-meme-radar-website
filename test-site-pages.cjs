'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { testServer } = require('./website-test-server.cjs');

const routes = ['index.html', 'research.html', 'intelligence.html', 'liquidity.html', 'roadmap.html', 'community.html', 'products.html'];

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
    assert.match(html, /href="roadmap.html#wallet-portfolio"/);
    assert.match(html, /href="roadmap.html#automated-trading"/);
    assert.ok(html.includes('Research Before Risk'));
    const sidebar = html.match(/<nav id="nav"[\s\S]*?<\/nav>/)[0];
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
    const main = html.match(/<main[\s\S]*?<\/main>/)[0];
    for (const [name, url] of [
      ['X', 'https://x.com/aimemeradar'],
      ['Telegram', 'https://t.me/AIMemeRadarCommunity']
    ]) {
      const link = `href="${url}">${name}</a>`;
      assert.ok(sidebar.includes(link), `${route} sidebar ${name}`);
      assert.ok(footer.includes(link), `${route} footer ${name}`);
      if (route === 'index.html') assert.ok(main.includes(link), `Dashboard ${name}`);
      if (route === 'community.html') assert.ok(main.includes(`href="${url}"`), `Community ${name}`);
    }
    assert.equal(html.includes('src="cached-history.js"'), route === 'research.html');
  }
  const roadmap = await fetch(origin + '/roadmap.html', { headers }).then(response => response.text());
  assert.equal([...roadmap.matchAll(/Planned — Not Available Yet/g)].length, 2);
  for (const section of ['wallet-portfolio', 'automated-trading']) {
    assert.match(roadmap, new RegExp('id="' + section + '"'));
  }
  assert.equal((await fetch(origin + '/site.js', { headers })).status, 200);
});

function verifyMobileNavigation(useLegacyListener) {
  const { readFileSync } = require('node:fs');
  const { runInNewContext } = require('node:vm');
  const listeners = {};
  let expanded = 'false';
  let open = false;
  const elements = {
    menu: {
      addEventListener: (_, listener) => { listeners.click = listener; },
      getAttribute: () => expanded,
      setAttribute: (_, value) => { expanded = value; }
    },
    nav: {
      addEventListener() {},
      classList: { toggle: (_, value) => { open = value; } }
    },
    year: {}
  };
  runInNewContext(readFileSync(require.resolve('./site.js'), 'utf8'), {
    document: { getElementById: id => elements[id], addEventListener() {} },
    window: { matchMedia: query => {
      assert.equal(query, '(max-width: 1024px)');
      return useLegacyListener
        ? { addListener: listener => { listeners.change = listener; } }
        : { addEventListener: (_, listener) => { listeners.change = listener; } };
    } }
  });
  listeners.click();
  assert.equal(open, true);
  assert.equal(expanded, 'true');
  listeners.change({ matches: false });
  listeners.change({ matches: true });
  assert.equal(open, false);
  assert.equal(expanded, 'false');
}

test('mobile navigation resets when switching to the desktop layout', () => {
  verifyMobileNavigation(false);
});

test('mobile navigation works with legacy media-query listeners', () => {
  verifyMobileNavigation(true);
});
