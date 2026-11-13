'use strict';

const HISTORY_URL = 'https://ai-meme-radar-verify-test.onrender.com/api/research/risk-history';
const CHAINS = new Set(['solana', 'bsc', 'base', 'ethereum']);
const MAX_BYTES = 1024 * 1024;

function validAddress(chain, value) {
  return typeof value === 'string' && (chain === 'solana'
    ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    : /^0x[a-fA-F0-9]{40}$/).test(value);
}

function readTarget(params) {
  const chain = params.get('chain');
  const address = params.get('address');
  const pool = params.get('pool');
  if (params.size !== 3 || !CHAINS.has(chain) ||
      !validAddress(chain, address) || !validAddress(chain, pool)) return null;
  return { chain, address, pool };
}

function matches(chain, actual, expected) {
  if (!validAddress(chain, actual)) return false;
  return chain === 'solana' ? actual === expected : actual.toLowerCase() === expected.toLowerCase();
}

function timestamp(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return null;
  // Date.parse can silently normalize a nonexistent calendar date.
  const day = new Date(match[1] + 'T00:00:00Z');
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === match[1]
    ? value : null;
}

function instantKey(value) {
  const fraction = /\.(\d+)(?:Z|[+-]\d\d:\d\d)$/.exec(value)?.[1] ?? '';
  return Date.parse(value) + ':' + fraction.padEnd(6, '0').slice(3, 6);
}

function compareInstants(left, right) {
  return Date.parse(left) - Date.parse(right) ||
    instantKey(left).localeCompare(instantKey(right));
}

function marketNumber(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function projectHistory(data, { chain, address, pool }) {
  if (data?.chain !== chain || !matches(chain, data.contract_address, address) ||
      !Array.isArray(data.pools) || data.pools.length > 200) throw Error('Invalid history');
  if (data.storage_error) throw Error('Storage unavailable');
  const matching = data.pools.filter(item => matches(chain, item?.pool_address, pool));
  if (!matching.length) return { status: 'EMPTY', observations: [], holder_trend: null };
  if (matching.length !== 1 || !Array.isArray(matching[0].observations) ||
      matching[0].observations.length > 24) throw Error('Invalid pool history');

  const observations = [];
  const holderCounts = new Map();
  const marketTimes = new Map();
  for (const row of matching[0].observations) {
    if (row?.chain !== chain || !matches(chain, row.contract_address, address) ||
        !matches(chain, row.pool_address, pool)) throw Error('Observation identity mismatch');
    const observed = timestamp(row.observed_at_utc);
    if (!observed) throw Error('Invalid market timestamp');
    const marketTime = instantKey(observed);
    const holderTime = timestamp(row.holder_observed_at_utc);
    const verified = chain === 'solana' && row.address_identity_version === 2 &&
      row.holder_status === 'VERIFIED' && row.holder_source === 'Helius getTokenAccounts' &&
      holderTime && Number.isSafeInteger(row.holder_count) && row.holder_count >= 0;
    const count = verified ? row.holder_count : null;
    if (verified) {
      const key = instantKey(holderTime);
      if (holderCounts.has(key) && holderCounts.get(key).count !== count) throw Error('Conflicting holder evidence');
      holderCounts.set(key, { count, observed_at_utc: holderTime });
    }
    const marketSource = row.source === 'DexScreener token-pairs API' ? row.source : null;
    const observation = {
      observed_at_utc: observed,
      market_source: marketSource,
      liquidity_usd: marketSource ? marketNumber(row.liquidity_usd) : null,
      volume_5m_usd: marketSource ? marketNumber(row.volume_5m_usd) : null,
      holder_count: count,
      holder_observed_at_utc: verified ? holderTime : null
    };
    const evidence = JSON.stringify([
      observation.market_source, observation.liquidity_usd, observation.volume_5m_usd,
      observation.holder_count, verified ? instantKey(holderTime) : null
    ]);
    if (marketTimes.has(marketTime)) {
      if (marketTimes.get(marketTime) !== evidence) throw Error('Conflicting market evidence');
      continue;
    }
    marketTimes.set(marketTime, evidence);
    observations.push(observation);
  }

  const samples = [...holderCounts.values()].sort((left, right) =>
    compareInstants(left.observed_at_utc, right.observed_at_utc));
  const first = samples[0];
  const latest = samples.at(-1);
  const change = samples.length >= 2 ? latest.count - first.count : null;
  const holderTrend = change === null ? null : {
    status: change === 0 ? 'UNCHANGED' : change > 0 ? 'INCREASING' : 'DECLINING',
    verified_observations: samples.length,
    first, latest, growth_pct: first.count > 0 ? (change / first.count) * 100 : null
  };

  observations.sort((left, right) => compareInstants(right.observed_at_utc, left.observed_at_utc));
  return {
    status: observations.length ? 'READY' : 'EMPTY',
    observations, holder_trend: holderTrend, latest_holder_observation: latest ?? null
  };
}

async function readBounded(response) {
  if (!response.body) throw Error('Missing history');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw Error('History too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
}

async function loadHistory(target, key, request = fetch) {
  const upstream = new URL(HISTORY_URL);
  upstream.search = new URLSearchParams({ chain: target.chain, address: target.address });
  const response = await request(upstream, {
    headers: { Accept: 'application/json', 'X-Radar-Test-Key': key },
    redirect: 'manual',
    signal: AbortSignal.timeout(6500)
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) {
      return { status: 'BACKEND_AUTH_REQUIRED', observations: [] };
    }
    return { status: response.status === 429 ? 'RETRY_LATER' : 'UNAVAILABLE', observations: [] };
  }
  return projectHistory(await readBounded(response), target);
}

module.exports = { readTarget, loadHistory };
