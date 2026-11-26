const {test}=require('node:test');const assert=require('node:assert/strict');
const {pageModel}=require('./wallet-network.js');
const rows=n=>Array.from({length:n},(_,index)=>({index,edge:{source_owner:'E'.repeat(32),
 destination_owner:('FGHJKLMNPQRSTUVWXYZ'[index%19]).repeat(32),amount_raw:'9007199254740993'}}));
test('graph pagination bounds geometry and retains original evidence indices',()=>{
 const entries=rows(25);const page=pageModel(entries,1);
 assert.equal(page.pages,3);assert.equal(page.edges.length,12);assert.equal(page.edges[0].index,12);
 assert.equal(page.total,25);assert.ok(page.nodes.length<=24);
 for(const n of page.nodes){assert.ok(n.x>=75&&n.x<=565);assert.ok(n.y>=60&&n.y<=360);}
 assert.equal(pageModel(entries,999).edges.length,1);
 assert.equal(entries[0].edge.amount_raw,'9007199254740993');
});
test('graph filters retain the exact source edge identity and do not invent missing links',()=>{
 const entries=rows(20);const page=pageModel(entries.filter(r=>r.index===18));
 assert.equal(page.edges[0].index,18);assert.equal(page.total,1);assert.equal(page.nodes.length,2);
 assert.deepEqual(pageModel([]).edges,[]);assert.equal(pageModel([]).total,0);
});
test('malformed or unbounded graph data fails closed before drawing',()=>{
 for(const value of [rows(1001),[...rows(1),...rows(1)],
  [{index:0,edge:{source_owner:'<script>',destination_owner:'F'.repeat(32),amount_raw:'1'}}],
  [{index:0,edge:{source_owner:'E'.repeat(32),destination_owner:'F'.repeat(32),amount_raw:'0'}}]])
  assert.throws(()=>pageModel(value));
 assert.throws(()=>pageModel(rows(1),-1));
});
test('public research copy retains native workflows without external project case studies',()=>{
 const {readFileSync}=require('node:fs');
 for(const name of ['index','products','research','intelligence','liquidity','roadmap','community']){
  const html=readFileSync(name+'.html','utf8');
  assert.doesNotMatch(html,/MukLDtJ8|c60ba256b44334a0|Programmable V4|OTC on Solana|Two project case studies/);
 }
 const roadmap=readFileSync('roadmap.html','utf8');
 assert.match(roadmap,/Public Multichain Trading Engine · future/);
 assert.match(roadmap,/Optional Token Utility Layer · feasibility only/);
 assert.match(roadmap,/private wallets and credentials are never reused/);
});
