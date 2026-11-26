'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadHistory}=require('./radar-history.cjs');
const fixture=require('./test-fixtures/history-coverage-gateway-contract-v1.json');
const valid=fixture.valid_response;
const target={chain:valid.chain,address:valid.contract_address,pool:valid.pools[0].pool_address};
const run=payload=>loadHistory(target,'synthetic-backend-key',async()=>Response.json(payload));

test('actual-handler synthetic contract remains compatible without promoting metadata claims',async()=>{
  assert.equal(fixture.fixture_scope,'SYNTHETIC_CONTRACT_ONLY_NOT_CHAIN_EVIDENCE');
  const data=structuredClone(valid);
  data.pools[0].evidence_coverage.metrics.holder_count.value=999;
  const out=await run(data);
  assert.equal(out.status,'READY');
  assert.equal(out.holder_trend.growth_pct,0);
  assert.equal(out.latest_holder_observation.count,75);
  assert.equal(out.evidence_coverage,undefined); // Not an unvalidated metadata pass-through.
});

test('upstream storage conflict is withheld, not mislabelled empty or verified',async()=>{
  const out=await run(fixture.held_response);
  assert.equal(out.status,'EVIDENCE_HELD');
  assert.deepEqual(out.observations,[]);
  assert.equal(out.holder_trend,undefined);
});

test('wrong identity or authorization-like projection flags fail closed',async()=>{
  for (const change of [c=>c.identity.pool_address='C'.repeat(32),
                         c=>c.identity.chain='bsc',c=>c.schema_version=true,
                         c=>c.transaction_authorized=true,c=>c.current_security_clearance=true,
                         c=>c.evidence_reason='NO_CACHED_OBSERVATIONS',c=>c.status='SAFE']) {
    const data=structuredClone(valid);
    change(data.pools[0].evidence_coverage);
    const out=await run(data);
    assert.equal(out.status,'EVIDENCE_HELD');
    assert.deepEqual(out.observations,[]);
  }
});

test('unknown reason is never reflected and legacy row validation stays compatible',async()=>{
  const data=structuredClone(valid);
  data.pools[0].evidence_coverage.evidence_reason='PRIVATE_UPSTREAM_DETAIL';
  const out=await run(data);
  assert.equal(out.status,'EVIDENCE_HELD');
  assert.ok(!JSON.stringify(out).includes('PRIVATE_UPSTREAM_DETAIL'));
  delete data.pools[0].evidence_coverage;
  assert.equal((await run(data)).status,'READY');
});


test('saved liquidity decline uses validated rows rather than a promoted backend claim',async()=>{
  const data=structuredClone(valid);
  data.pools[0].observations[1].liquidity_usd=2000;
  data.pools[0].evidence_coverage.reported_liquidity_window={direction:'SAFE',change_pct:999};
  const out=await run(data), w=out.reported_liquidity_window;
  assert.equal(w.direction,'DECREASED');
  assert.equal(w.change_pct,-50);
  assert.equal(w.change_usd,-2000);
  assert.equal(w.verification,'REPORTED');
  assert.equal(w.security_inference,'NOT_ESTABLISHED');
  assert.equal(w.historical_only,true);
});

test('liquidity gaps, conflicting history and zero or tiny baselines do not create certainty',async()=>{
  for (const change of [{liquidity_usd:null},{liquidity_usd:true},{liquidity_usd:-1},{source:'Other provider'}]) {
    const data=structuredClone(valid);
    data.pools[0].observations[0]={...data.pools[0].observations[0],...change};
    assert.equal((await run(data)).reported_liquidity_window,null);
  }
  for (const baseline of [0,1e-320]) {
    const data=structuredClone(valid);
    data.pools[0].observations[0].liquidity_usd=baseline;
    const w=(await run(data)).reported_liquidity_window;
    assert.equal(w.change_pct,null);
    assert.equal(w.direction,'INCREASED');
  }
});


test('future-dated market history cannot provide a historical liquidity comparison',async()=>{
  const data=structuredClone(valid);
  data.pools[0].observations[1].observed_at_utc='2099-01-01T00:00:00Z';
  assert.equal((await run(data)).reported_liquidity_window,null);
});
