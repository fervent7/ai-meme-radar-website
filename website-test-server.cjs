'use strict';

const { createHash, timingSafeEqual } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { readTarget, loadHistory } = require('./radar-history.cjs');

const ASSETS = new Map([
  ['/','index.html'], ['/index.html','index.html'], ['/styles.css','styles.css'],
  ['/app.js','app.js'], ['/market-identity.js','market-identity.js'],
  ['/cached-history.js','cached-history.js'], ['/config.js','config.js'],
  ['/site.webmanifest','site.webmanifest'], ['/brand-wordmark.webp','brand-wordmark.webp'],
  ['/brand-icon-64.png','brand-icon-64.png'], ['/brand-icon-192.png','brand-icon-192.png'],
  ['/brand-icon-512.png','brand-icon-512.png']
]);
const TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8', webmanifest: 'application/manifest+json',
  webp: 'image/webp', png: 'image/png'
};
const digest = value => createHash('sha256').update(value).digest();
const TEST_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer'
};

function testServer({ password, radarKey, request, revision }) {
  if (!password || !radarKey || password === radarKey) throw Error('Set distinct website and Radar test credentials');
  const commit = typeof revision === 'string' && /^[a-f0-9]{40}$/.test(revision) ? revision : null;
  const expected = digest('Basic ' + Buffer.from('reviewer:' + password).toString('base64'));

  return createServer(async (req, res) => {
    const send = (code, type, body, headers = {}) => {
      res.writeHead(code, { ...TEST_HEADERS, 'Content-Type': type, ...headers });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    const json = (code, body) => send(code, 'application/json', JSON.stringify(body));
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { return json(400, { status: 'INVALID_URL' }); }
    if (url.pathname === '/healthz' && ['GET', 'HEAD'].includes(req.method)) return json(200, { status: 'OK', revision: commit });
    if (!timingSafeEqual(expected, digest(req.headers.authorization || ''))) {
      return send(401, 'text/plain', 'Sign in to the website test environment.', {
        'WWW-Authenticate': 'Basic realm="AI Meme Radar website test", charset="UTF-8"'
      });
    }

    try {
      if (url.pathname === '/api/radar/history') {
        if (req.method !== 'GET') return json(405, { status: 'METHOD_NOT_ALLOWED' });
        const target = readTarget(url.searchParams);
        if (!target) return json(400, { status: 'INVALID_TARGET' });
        const history = await loadHistory(target, radarKey, request);
        const code = {
          READY: 200, EMPTY: 200, RETRY_LATER: 429, BACKEND_TIMEOUT: 504
        }[history.status] ?? 503;
        return json(code, history);
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { status: 'METHOD_NOT_ALLOWED' });
      const file = ASSETS.get(url.pathname);
      if (!file) return json(404, { status: 'NOT_FOUND' });
      let body = await readFile(join(__dirname, file));
      if (file === 'config.js') {
        body = body + '\nwindow.RADAR_CACHED_HISTORY_ENABLED = true;\n';
      }
      return send(200, TYPES[file.split('.').pop()], body);
    } catch {
      return json(503, { status: 'UNAVAILABLE' });
    }
  });
}

if (require.main === module) {
  const server = testServer({
    password: process.env.RADAR_WEBSITE_TEST_PASSWORD,
    radarKey: process.env.RADAR_TEST_ACCESS_KEY,
    revision: process.env.RENDER_GIT_COMMIT
  });
  server.listen(Number(process.env.PORT) || 10000, '0.0.0.0');
}

module.exports = { testServer };
