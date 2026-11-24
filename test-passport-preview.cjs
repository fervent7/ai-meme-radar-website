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
