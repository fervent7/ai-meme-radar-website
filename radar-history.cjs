'use strict';

const HISTORY_URL = 'https://ai-meme-radar-verify-test.onrender.com/api/research/risk-history';
const ONCHAIN_URL = new URL('/api/research/onchain-history', HISTORY_URL);
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
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
}

function projectOnchain(data, target) {
  if (data?.chain !== 'solana' || data.token_address !== target.address ||
      data.pool_address !== target.pool) throw Error('Invalid on-chain history identity');

  function projectRows(rows, kind, pool, project) {
    if (!Array.isArray(rows) || rows.length > 24) throw Error('Invalid on-chain history');
    return rows.map(row => {
      if (row?.kind !== kind || row.chain !== 'solana' || row.token_address !== target.address ||
          row.pool_address !== pool || !timestamp(row.observed_at_utc) ||
          !['VERIFIED', 'UNAVAILABLE', 'ERROR'].includes(row.verification)) {
        throw Error('Invalid on-chain observation');
      }
      const observed = { observed_at_utc: row.observed_at_utc, verification: row.verification };
      if (row.verification !== 'VERIFIED') return observed;
      const source = new URL(row.source);
      if (source.protocol !== 'https:' || source.username || source.password ||
          !Number.isSafeInteger(row.payload?.slot) || row.payload.slot < 1 ||
          !timestamp(row.payload.block_time_utc)) throw Error('Invalid on-chain provenance');
      return { ...observed, source: source.origin, slot: row.payload.slot,
        block_time_utc: row.payload.block_time_utc, ...project(row.payload, row.reference) };
    });
  }

  const raw = value => {
    if (typeof value !== 'string' || !/^\d{1,20}$/.test(value) ||
        BigInt(value) > 0xffffffffffffffffn) throw Error('Invalid raw amount');
    return value;
  };
  const holders = projectRows(data.holder_observations, 'holder_distribution', null, (value, ref) => {
    if (!Number.isSafeInteger(value.holder_count) || value.holder_count < 0 ||
        value.method_version !== 'top-10-positive-owner-balances-v1' || ref !== String(value.slot)) {
      throw Error('Invalid holder evidence');
    }
    const supply = BigInt(raw(value.total_supply_raw));
    const top = BigInt(raw(value.top_10_balance_raw));
    if (supply <= 0n || top > supply) throw Error('Invalid holder concentration');
    return { holder_count: value.holder_count, concentration_pct: Number((top * 10000n + supply / 2n) / supply) / 100 };
  });
  const swaps = projectRows(data.swaps, 'pool_swaps', target.pool, (value, ref) => {
    if (!['BUY', 'SELL'].includes(value.direction) || typeof ref !== 'string' ||
        !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(ref)) throw Error('Invalid swap evidence');
    return { direction: value.direction, signature: ref, organic: 'UNVERIFIED' };
  });
  const reserves = projectRows(data.reserves, 'pool_reserves', target.pool, (value, ref) => {
    if (value.protocol !== 'raydium-cpmm' || ref !== String(value.slot) ||
        !Array.isArray(value.vaults) || value.vaults.length !== 2 ||
        new Set(value.vaults.map(vault => vault.mint)).size !== 2 ||
        !value.vaults.some(vault => vault.mint === target.address)) throw Error('Invalid pool reserves');
    return { vaults: value.vaults.map(vault => {
      if (!validAddress('solana', vault.mint) || !Number.isInteger(vault.decimals) ||
          vault.decimals < 0 || vault.decimals > 255) throw Error('Invalid vault evidence');
      return { mint: vault.mint, reserve_raw: raw(vault.reserve_raw), decimals: vault.decimals };
    }) };
  });
  return { status: holders.length || swaps.length || reserves.length ? 'READY' : 'EMPTY',
    holders, swaps, reserves };
}

async function loadHistory(target, key, request = fetch, onchain = false) {
  const upstream = new URL(onchain ? ONCHAIN_URL : HISTORY_URL);
  upstream.search = new URLSearchParams(onchain ? { address: target.address, pool: target.pool }
    : { chain: target.chain, address: target.address });
  const signal = AbortSignal.timeout(6500);
  try {
    const response = await request(upstream, {
      headers: { Accept: 'application/json', 'X-Radar-Test-Key': key },
      redirect: 'manual',
      signal
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) {
        return { status: 'BACKEND_AUTH_REQUIRED', observations: [] };
      }
      if (response.status === 429) {
        const header = response.headers.get('Retry-After') ?? '';
        const seconds = /^\d+$/.test(header) ? Number(header)
          : Math.ceil((Date.parse(header) - Date.now()) / 1000);
        const retryAfter = Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 30;
        return { status: 'RETRY_LATER', observations: [], retry_after_seconds: retryAfter };
      }
      return { status: 'UNAVAILABLE', observations: [] };
    }
    const data = await readBounded(response);
    return onchain ? projectOnchain(data, target) : projectHistory(data, target);
  } catch (error) {
    if (signal.aborted || error?.name === 'TimeoutError') {
      return { status: 'BACKEND_TIMEOUT', observations: [] };
    }
    throw error;
  }
}

module.exports = { readTarget, loadHistory };
