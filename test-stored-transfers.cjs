"use strict";
const {test}=require('node:test');const assert=require('node:assert/strict');
const {loadHistory}=require('./radar-history.cjs');
const target={chain:'solana',address:'A'.repeat(32),pool:'B'.repeat(32)};
function fixture(){return {chain:'solana',token_address:target.address,pool_address:target.pool,
  holder_observations:[],swaps:[],reserves:[],
  token_transfer_coverage:{scope:'STORED_MINT_RECORDS_NOT_POOL_ATTRIBUTED',complete_history:false,record_limit:24},
  token_transfers:[{kind:'token_transfers',chain:'solana',token_address:target.address,pool_address:null,
    observed_at_utc:'2026-11-15T00:00:00Z',verification:'VERIFIED',source:'https://rpc.example.invalid/private?key=secret',
    reference:'F'.repeat(88),payload:{slot:17,block_time_unix:1710000000,transfers:[{
      outer_index:0,inner_index:1,source_account:'C'.repeat(32),destination_account:'D'.repeat(32),
      source_owner:'E'.repeat(32),destination_owner:'G'.repeat(32),amount_raw:'18446744073709551615'}]}}]};}
const run=data=>loadHistory(target,'fixture-key',async()=>Response.json(data),true);

test('saved transfer projection preserves exact raw amount, mint scope, original times and redacts RPC details',async()=>{
  const out=await run(fixture());assert.equal(out.status,'READY');
  const row=out.transfers[0];assert.equal(row.movements[0].amount_raw,'18446744073709551615');
  assert.equal(row.block_time_utc,'2024-03-09T16:00:00.000Z');
  assert.equal(row.observed_at_utc,'2026-11-15T00:00:00Z');
  assert.equal(row.scope,'STORED_MINT_RECORDS_NOT_POOL_ATTRIBUTED');assert.equal(row.complete_history,false);
  assert.equal(row.source,'https://rpc.example.invalid');assert.doesNotMatch(JSON.stringify(out),/secret|private/);
});

test('wrong mint, fabricated pool attribution, complete-history claim or malformed movements fail closed',async()=>{
  for(const mutate of [d=>d.token_transfers[0].token_address='H'.repeat(32),
    d=>d.token_transfers[0].pool_address=target.pool,d=>d.token_transfer_coverage.complete_history=true,
    d=>d.token_transfers[0].payload.block_time_unix=null,d=>d.token_transfers[0].payload.slot=true,
    d=>d.token_transfers[0].payload.transfers[0].amount_raw='18446744073709551616',
    d=>d.token_transfers[0].payload.transfers[0].outer_index=true,
    d=>d.token_transfers[0].payload.transfers[0].source_owner='<script>',
    d=>d.token_transfers[0].payload.transfers.push(d.token_transfers[0].payload.transfers[0]),
    d=>d.token_transfers[0].payload.transfers=Array(129).fill(d.token_transfers[0].payload.transfers[0])]) {
      const d=fixture();mutate(d);await assert.rejects(()=>run(d));
  }
});

test('journal errors stay visible without payload, and legacy responses have no fabricated transfers',async()=>{
  const d=fixture();d.token_transfers[0].verification='ERROR';d.token_transfers[0].payload=null;
  const out=await run(d);assert.equal(out.transfers[0].verification,'ERROR');assert.equal(out.transfers[0].movements,undefined);
  delete d.token_transfers;delete d.token_transfer_coverage;
  const legacy=await run(d);assert.equal(legacy.status,'EMPTY');assert.deepEqual(legacy.transfers,[]);
});


test('authenticated server withholds a malformed transfer response as503 without partial evidence',async t=>{
  const {testServer}=require('./website-test-server.cjs');const {once}=require('node:events');
  const d=fixture();let calls=0;
  const server=testServer({password:'fixture',radarKey:'backend-fixture',request:async()=>{calls++;return Response.json(d);}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+'/api/radar/onchain-history?'+new URLSearchParams(target);
  assert.equal((await fetch(url)).status,401);assert.equal(calls,0);
  const headers={authorization:'Basic '+Buffer.from('reviewer:fixture').toString('base64')};
  assert.equal((await fetch(url,{headers})).status,200);
  d.token_transfers[0].payload.transfers[0].amount_raw='PRIVATE_INVALID_VALUE';
  const withheld=await fetch(url,{headers});assert.equal(withheld.status,503);
  assert.deepEqual(await withheld.json(),{status:'UNAVAILABLE'});
});
