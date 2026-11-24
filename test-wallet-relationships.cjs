'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {loadHistory}=require('./radar-history.cjs');
const {projectRelationships}=require('./wallet-relationships.cjs');
const fixture=require('./test-fixtures/wallet_relationships_gateway_v1.json');
const target={chain:fixture.chain,address:fixture.token_address,pool:fixture.pool_address};
const run=data=>loadHistory(target,'fixture-key',async()=>Response.json(data),true);
test('different transactions sharing one slot cannot claim different block times',async()=>{
 const out=await run(fixture),first=out.transfers[0],second=structuredClone(first);
 second.signature='C'.repeat(88);
 const graph=structuredClone(fixture.wallet_relationships);
 const edge=graph.relationships[0],proof=structuredClone(edge.evidence[0]);
 proof.reference=second.signature;edge.evidence.push(proof);
 edge.transfer_count=2;edge.amount_raw=(2n*BigInt(edge.amount_raw)).toString();
 Object.assign(graph.coverage,{input_records:2,available_records:2,unique_transactions:2});
 assert.equal(projectRelationships(graph,[first,second],target).relationships[0].transfer_count,2);
 // Make every signature/proof/count/window agree with the claimed conflicting
 // time. Only the shared-slot invariant should reject this internally matched graph.
 proof.block_time_unix++;
 second.block_time_utc=new Date(proof.block_time_unix*1000).toISOString();
 graph.coverage.last_block_time_unix=proof.block_time_unix;
 assert.throws(()=>projectRelationships(graph,[first,second],target),
  /Invalid wallet relationship evidence/);
});
test('gateway validates backend relationships against the same scoped saved transfers',async()=>{
 assert.equal(fixture.fixture_scope,'SYNTHETIC_CONTRACT_ONLY_NOT_CHAIN_OBSERVATION');
 const out=await run(fixture);const graph=out.wallet_relationships;
 assert.equal(graph.status,'HISTORICAL_OBSERVED_RELATIONSHIPS');
 assert.equal(graph.relationships[0].amount_raw,'492719579834');
 assert.equal(graph.relationships[0].evidence[0].signature,'B'.repeat(88));
 assert.equal(graph.relationships[0].evidence[0].slot,469496016);
 assert.equal(graph.coverage.input_records,1);
 assert.equal(graph.coverage.withheld_records,0);
 assert.equal(graph.coverage.first_block_time_unix,1794695488);
 assert.equal(graph.synthetic_example,true);
 assert.equal(graph.coordination_proven,false);assert.equal(graph.fresh_evidence,false);
});
test('wrong scope, invented relationship, changed evidence and authorization claims fail closed',async()=>{
 for(const change of [d=>d.wallet_relationships.token_address='G'.repeat(32),
  d=>d.wallet_relationships.complete_history=true,d=>d.wallet_relationships.coverage.last_block_time_unix++,
  d=>d.wallet_relationships.coverage.withheld_records++,d=>d.wallet_relationships.coordination_proven=true,
  d=>d.wallet_relationships.relationships[0].amount_raw='1',
  d=>d.wallet_relationships.relationships[0].evidence[0].slot++,
  d=>d.wallet_relationships.relationships[0].evidence[0].reference='C'.repeat(88),
  d=>d.wallet_relationships.relationships[0].evidence[0].source='https://wrong.example',
  d=>d.wallet_relationships.relationships.push(d.wallet_relationships.relationships[0])]){
   const d=structuredClone(fixture);change(d);await assert.rejects(()=>run(d));
 }
});
test('legacy or withheld backend graph does not manufacture relationships from transfer rows',async()=>{
 const d=structuredClone(fixture);delete d.wallet_relationships;
 assert.equal((await run(d)).wallet_relationships.status,'NOT_SUPPLIED');
 d.wallet_relationships={...fixture.wallet_relationships,status:'UNAVAILABLE',relationships:[]};
 assert.equal((await run(d)).wallet_relationships.relationships.length,0);
});
