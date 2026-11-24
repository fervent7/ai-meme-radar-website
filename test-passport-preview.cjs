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
