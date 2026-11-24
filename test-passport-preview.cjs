const {test}=require('node:test');const assert=require('node:assert/strict');
const fixture=require('./passport-preview-fixture.json');
const {viewModel}=require('./passport-preview.js');
test('shared backend example exposes expiry, revocation and unknowns without issuing authority',()=>{
 for(const state of ['current','expired','revoked','unknown']){
  const model=viewModel(fixture,state);
  assert.equal(model.row.transaction_authorized,false);assert.equal(model.row.security_clearance,false);
  assert.equal(model.row.signed_attestation,false);assert.match(model.label,/example/);
 }
 assert.match(viewModel(fixture,'unknown').label,/missing/);
});
test('preview rejects live-looking fixtures, unknown cases and authorization claims',()=>{
 for(const change of [f=>f.data_classification='LIVE',f=>f.cases.current.transaction_authorized=true,
   f=>f.cases.current.schema_version='another',f=>f.cases.current.checks=[]]){
  const f=structuredClone(fixture);change(f);assert.throws(()=>viewModel(f,'current'));
 }
 assert.throws(()=>viewModel(fixture,'unknown-case'));
});
test('passport cards translate backend codes and timestamps into readable explanations',()=>{
 const {explain,displayTime}=require('./passport-preview.js');
 assert.deepEqual(explain({state:'CURRENT_RECORDED_CHECK',reason:'PRODUCER_ASSERTION_NOT_INDEPENDENT_ATTESTATION'}),{
  state:'Current source record',reason:'The preview has not independently verified this provider assertion.'});
 assert.equal(explain({state:'UNKNOWN',reason:'EVIDENCE_MISSING'}).reason,'This required check has no source record.');
 assert.doesNotMatch(explain({state:'UNKNOWN',reason:'PRIVATE_INTERNAL_VALUE'}).reason,/PRIVATE_INTERNAL_VALUE/);
 assert.equal(displayTime(null),'Unavailable');assert.match(displayTime('2026-11-24T10:00:00Z'),/24 Nov 2026.*10:00:00 UTC/);
});
test('a current label cannot hide revoked/unknown checks or duplicated required categories',()=>{
 for(const change of [f=>f.cases.current.checks[0].state='REVOKED',
  f=>f.cases.current.checks[2].state='UNKNOWN',
  f=>f.cases.current.checks[1].kind='holder_distribution']){
  const f=structuredClone(fixture);change(f);assert.throws(()=>viewModel(f,'current'));
 }
});
test('current preview requires coherent chain time and finite source-based expiry',()=>{
 for(const change of [
  r=>{r.checks[1].block_time_utc='2026-11-24T09:59:59Z';r.checks[1].expires_at_utc='2026-11-24T10:01:29Z';},
  r=>r.checks[0].chain_point.block_hash='0x'+'0'.repeat(64),
  r=>r.checks[0].chain_point.block++,
  r=>r.checks[0].expires_at_utc='2026-11-24T10:00:30Z',
  r=>r.checks[0].observed_at_utc='2026-11-24T10:00:31Z',
  r=>r.checks[0].observed_at_utc='2026-11-24T10:00:00',
  r=>r.max_age_seconds=true]){
  const f=structuredClone(fixture);change(f.cases.current);
  assert.throws(()=>viewModel(f,'current'));
 }
});
