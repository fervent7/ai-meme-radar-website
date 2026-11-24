'use strict';
// Compare the backend Wallet DNA projection with independently validated saved
// transfers in THIS gateway response. Never trust a standalone relationship claim.
function projectRelationships(graph, transfers, target) {
 const base={scope:'STORED_MINT_TRANSFERS_NOT_POOL_ATTRIBUTED',historical_only:true,
  complete_history:false,fresh_evidence:false,common_owner_inferred:false,
  coordination_proven:false,security_clearance:false,transaction_authorized:false,coverage:null};
 if(graph===undefined)return {...base,status:'NOT_SUPPLIED',relationships:[]};
 const fail=()=>{throw Error('Invalid wallet relationship evidence');};
 if(!graph||graph.version!=='radar-wallet-relationships-v1'||graph.chain!=='solana'||
  graph.token_address!==target.address||graph.scope!==base.scope||
  ['complete_history','fresh_evidence','common_owner_inferred','coordination_proven',
   'security_clearance','transaction_authorized'].some(k=>graph[k]!==false)||
  !Array.isArray(graph.relationships)||graph.relationships.length>1000)fail();
 if(graph.status==='UNAVAILABLE'){
  if(graph.relationships.length)fail();
  return {...base,status:'UNAVAILABLE',relationships:[]};
 }
 const events=new Map(),points=new Map(),expected=new Map();
 for(const sample of transfers){
  if(sample.verification!=='VERIFIED')continue;
  const point=sample.slot+':'+sample.block_time_utc;
  if(points.has(sample.signature)&&points.get(sample.signature)!==point)fail();
  points.set(sample.signature,point);
  for(const move of sample.movements){
   const key=sample.signature+':'+move.outer_index+':'+(move.inner_index??-1);
   const proof={signature:sample.signature,slot:sample.slot,block_time_utc:sample.block_time_utc,
    observed_at_utc:sample.observed_at_utc,source:sample.source,...move};
   const encoded=JSON.stringify(proof);
   if(events.has(key)&&events.get(key)!==encoded)fail();
   if(events.has(key))continue;
   events.set(key,encoded);if(events.size>1000)fail();
   if(move.source_owner===move.destination_owner||BigInt(move.amount_raw)===0n)continue;
   const pair=move.source_owner+':'+move.destination_owner;
   if(!expected.has(pair))expected.set(pair,{source_owner:move.source_owner,
    destination_owner:move.destination_owner,amount:0n,proofs:new Map()});
   const edge=expected.get(pair);edge.amount+=BigInt(move.amount_raw);edge.proofs.set(key,proof);
  }
 }
 if(graph.relationships.length!==expected.size||graph.status!==
  (expected.size?'HISTORICAL_OBSERVED_RELATIONSHIPS':'NO_ATTRIBUTABLE_RELATIONSHIPS'))fail();
 const usable=transfers.filter(row=>row.verification==='VERIFIED');
 const slots=usable.map(row=>row.slot),times=usable.map(row=>Date.parse(row.block_time_utc)/1000);
 const coverage={input_records:transfers.length,available_records:usable.length,
  withheld_records:transfers.length-usable.length,unique_transactions:points.size,
  first_slot:slots.length?Math.min(...slots):null,last_slot:slots.length?Math.max(...slots):null,
  first_block_time_unix:times.length?Math.min(...times):null,last_block_time_unix:times.length?Math.max(...times):null};
 if(graph.coverage!==undefined&&graph.coverage!==null){
  if(typeof graph.coverage!=='object'||Array.isArray(graph.coverage)||
   Object.keys(coverage).some(key=>graph.coverage[key]!==coverage[key]))fail();
 } else coverage.unavailable=true;
 const seen=new Set();
 for(const edge of graph.relationships){
  const pair=edge?.source_owner+':'+edge?.destination_owner,known=expected.get(pair);
  if(!known||seen.has(pair)||edge.amount_raw!==known.amount.toString()||
   edge.transfer_count!==known.proofs.size||!Array.isArray(edge.evidence)||
   edge.evidence.length!==known.proofs.size)fail();
  seen.add(pair);const proofs=new Set();
  for(const proof of edge.evidence){
   const key=proof?.reference+':'+proof?.outer_index+':'+(proof?.inner_index??-1);
   const saved=known.proofs.get(key);
   if(!saved||proofs.has(key)||!Number.isSafeInteger(proof.block_time_unix)||
    proof.block_time_unix<=0||proof.block_time_unix>=253402300800)fail();
   const normalized={signature:proof.reference,slot:proof.slot,
    block_time_utc:new Date(proof.block_time_unix*1000).toISOString(),
    observed_at_utc:proof.observed_at_utc,source:proof.source,
    outer_index:proof.outer_index,inner_index:proof.inner_index,
    source_account:proof.source_account,destination_account:proof.destination_account,
    source_owner:proof.source_owner,destination_owner:proof.destination_owner,amount_raw:proof.amount_raw};
   if(JSON.stringify(normalized)!==JSON.stringify(saved))fail();
   proofs.add(key);
  }
 }
 return {...base,status:graph.status,coverage:coverage.unavailable?null:coverage,relationships:[...expected.entries()]
  .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,edge])=>({source_owner:edge.source_owner,
   destination_owner:edge.destination_owner,amount_raw:edge.amount.toString(),
   transfer_count:edge.proofs.size,evidence:[...edge.proofs.values()]}))};
}
module.exports={projectRelationships};
