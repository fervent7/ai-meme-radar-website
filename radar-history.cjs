'use strict';

const {projectRelationships} = require('./wallet-relationships.cjs');

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

function coverageHold(value, {chain,address,pool}, observationCount) {
  if (value === undefined) return null; // Legacy backend: own row validation still applies.
  const id = value?.identity;
  const valid = value && !Array.isArray(value) && value.schema_version === 1 &&
    value.scope === 'RESEARCH_ONLY' && value.input_basis === 'SAVED_HISTORY' &&
    value.transaction_authorized === false && value.current_security_clearance === false &&
    id?.chain === chain && matches(chain,id.token_address,address) && matches(chain,id.pool_address,pool);
  if (!valid) return {status:'EVIDENCE_HELD',reason:'COVERAGE_INVALID',observations:[]};
  const reason = value.evidence_reason;
  if (value.status !== undefined || (reason !== undefined && reason !== 'NO_CACHED_OBSERVATIONS') ||
      (reason === 'NO_CACHED_OBSERVATIONS' && observationCount !== 0)) {
    return {status:'EVIDENCE_HELD',reason:'SAVED_EVIDENCE_NOT_VALIDATED',observations:[]};
  }
  return null;
}

function reportedLiquidityWindow(observations) {
  const samples = [];
  for (const row of observations) { // Most recent first; stop at any evidence gap.
    if (Date.parse(row.observed_at_utc) > Date.now() ||
        row.market_source !== 'DexScreener token-pairs API' ||
        !Number.isFinite(row.liquidity_usd) || row.liquidity_usd < 0 || row.liquidity_usd > 1e18) break;
    samples.push(row);
  }
  if (samples.length < 2) return null;
  const first = samples.at(-1), latest = samples[0];
  const change = latest.liquidity_usd - first.liquidity_usd;
  const percent = first.liquidity_usd > 0 ? 100 * (change / first.liquidity_usd) : null;
  const sample = row => ({liquidity_usd:row.liquidity_usd, observed_at_utc:row.observed_at_utc});
  return {verification:'REPORTED', historical_only:true, source:'DexScreener token-pairs API',
    observations:samples.length, first:sample(first), latest:sample(latest), change_usd:change,
    change_pct:Number.isFinite(percent) ? percent : null,
    direction:change < 0 ? 'DECREASED' : change > 0 ? 'INCREASED' : 'UNCHANGED',
    security_inference:'NOT_ESTABLISHED'};
}

function projectHistory(data, { chain, address, pool }) {
  if (data?.chain !== chain || !matches(chain, data.contract_address, address) ||
      !Array.isArray(data.pools) || data.pools.length > 200) throw Error('Invalid history');
  if (data.storage_error) throw Error('Storage unavailable');
  const matching = data.pools.filter(item => matches(chain, item?.pool_address, pool));
  if (!matching.length) return { status: 'EMPTY', observations: [], holder_trend: null };
  if (matching.length !== 1 || !Array.isArray(matching[0].observations) ||
      matching[0].observations.length > 24) throw Error('Invalid pool history');
  const held = coverageHold(matching[0].evidence_coverage,{chain,address,pool},matching[0].observations.length);
  if (held) return held;

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
    observations, reported_liquidity_window: reportedLiquidityWindow(observations),
    holder_trend: holderTrend, latest_holder_observation: latest ?? null
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

  function projectRows(rows, kind, pool, project, blockTime = value => timestamp(value?.block_time_utc)) {
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
      const chainTime = blockTime(row.payload);
      if (source.protocol !== 'https:' || source.username || source.password ||
          !Number.isSafeInteger(row.payload?.slot) || row.payload.slot < 1 ||
          !chainTime || Date.parse(chainTime)-Date.parse(row.observed_at_utc)>300000) {
        // Original clock consistency only; never refresh or authenticate evidence.
        throw Error('Invalid on-chain provenance');
      }
      return { ...observed, source: source.origin, slot: row.payload.slot,
        block_time_utc: chainTime, ...project(row.payload, row.reference) };
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
    return { holder_count: value.holder_count, method_version: value.method_version,
      supply_basis: 'total_mint_supply',
      concentration_pct: Number((top * 10000n + supply / 2n) / supply) / 100 };
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
  const scope = 'STORED_MINT_RECORDS_NOT_POOL_ATTRIBUTED';
  let transfers = [];
  if (data.token_transfers !== undefined) {
    const coverage = data.token_transfer_coverage;
    if (coverage?.scope !== scope || coverage.complete_history !== false ||
        !Number.isSafeInteger(coverage.record_limit) || coverage.record_limit < 1 || coverage.record_limit > 256 ||
        !Array.isArray(data.token_transfers) || data.token_transfers.length > coverage.record_limit) {
      throw Error('Invalid stored transfer coverage');
    }
    transfers = projectRows(data.token_transfers, 'token_transfers', null, (value, ref) => {
      if (typeof ref !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(ref) ||
          !Array.isArray(value.transfers) || value.transfers.length > 128) throw Error('Invalid transfer evidence');
      const seen = new Set();
      const movements = value.transfers.map(item => {
        if (!Number.isSafeInteger(item.outer_index) || item.outer_index < 0 ||
            !(item.inner_index === null || Number.isSafeInteger(item.inner_index) && item.inner_index >= 0) ||
            !['source_account','destination_account','source_owner','destination_owner'].every(k=>validAddress('solana',item[k]))) {
          throw Error('Invalid transfer movement');
        }
        const key = item.outer_index + ':' + (item.inner_index ?? -1);
        if (seen.has(key)) throw Error('Duplicate transfer movement');
        seen.add(key);
        return {outer_index:item.outer_index,inner_index:item.inner_index,
          source_account:item.source_account,destination_account:item.destination_account,
          source_owner:item.source_owner,destination_owner:item.destination_owner,
          amount_raw:raw(item.amount_raw)};
      });
      return {signature:ref,movements,scope,complete_history:false};
    }, value => Number.isSafeInteger(value?.block_time_unix) && value.block_time_unix > 0 &&
      value.block_time_unix < 253402300800 ? new Date(value.block_time_unix * 1000).toISOString() : null);
  }
  return { status: holders.length || swaps.length || reserves.length || transfers.length ? 'READY' : 'EMPTY',
    holders, swaps, reserves, transfers,
    wallet_relationships: {...projectRelationships(data.wallet_relationships,transfers,target),
      synthetic_example:data.fixture_scope==='SYNTHETIC_CONTRACT_ONLY_NOT_CHAIN_OBSERVATION'} };
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

