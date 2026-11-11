const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const identity = require('./market-identity.js');
const target = '0x' + 'aB'.repeat(20);
const pair = {chainId:'bsc', pairAddress:'pool', baseToken:{address:target,symbol:'BASE'},
  quoteToken:{address:'0x'+'cD'.repeat(20),symbol:'QUOTE'}, liquidity:{usd:5000},
  priceUsd:'2', priceChange:{m5:10}, marketCap:100000, fdv:200000,
  volume:{m5:700,h24:3000}, txns:{m5:{buys:12,sells:4}}};

test('base-token evidence is preserved including zero values',()=>{
  assert.deepEqual(identity.tokenMetrics(pair,target),{isBase:true,priceUsd:'2',priceChange5mPct:10,
    marketCap:100000,fdv:200000,buys5m:12,sells5m:4});
  assert.equal(identity.tokenMetrics({...pair,txns:{m5:{buys:0,sells:0}}},target).buys5m,0);
});
test('quote token cannot inherit base valuation or buy/sell direction',()=>{
  const result=identity.tokenMetrics(pair,pair.quoteToken.address);
  assert.equal(result.isBase,false);
  for(const [key,value] of Object.entries(result))if(key!=='isBase')assert.equal(value,null);
});
test('EVM matches ignore case while Solana matches preserve it',()=>{
  assert.equal(identity.tokenMetrics(pair,target.toLowerCase()).isBase,true);
  const sol={...pair,chainId:'solana',baseToken:{address:'A'.repeat(32)}};
  assert.equal(identity.tokenMetrics(sol,'A'.repeat(32)).isBase,true);
  assert.equal(identity.tokenMetrics(sol,'a'.repeat(32)).isBase,false);
});
test('missing token identity does not promote metrics',()=>{
  assert.equal(identity.tokenMetrics(null,target).isBase,false);
  assert.equal(identity.tokenMetrics(pair,'other').priceUsd,null);
});

// Exercise the actual card-rendering function without a DOM or network dependency.
function render(address){
  const source=readFileSync(require('node:path').join(__dirname,'app.js'),'utf8');
  const start=source.indexOf('const pairCard=');
  const end=source.indexOf('\nrenderLivePair=',start);
  assert.ok(start>=0&&end>start,'Card renderer must be present');
  const fields={};
  const context={address,window:{RadarIdentity:identity},Date,
    document:{createElement:()=>({dataset:{},append(){}})},
    num:value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null,
    esc:value=>String(value),fmt:value=>String(value),pairPrice:value=>String(value),
    stat:(label,value)=>{fields[label]=value;return '';},liquidityEvidence:()=>({})};
  const card=vm.runInNewContext(source.slice(start,end)+'\npairCard',context);
  card(pair,true);
  return fields;
}
test('research card withholds quote-token price, change, valuation and direction',()=>{
  const fields=render(pair.quoteToken.address);
  for(const label of ['Price USD','5m price change','5m buy / sell transactions'])
    assert.equal(fields[label],'Unavailable for quote token');
  for(const label of ['Market cap (reported)','FDV (reported)'])assert.equal(fields[label],'Unavailable');
  assert.equal(fields['Liquidity (reported)'],'5000');
  assert.equal(fields['5m volume'],'700');
});
test('research card keeps base-token direction and market evidence',()=>{
  const fields=render(target);
  assert.equal(fields['Price USD'],'2');
  assert.equal(fields['5m price change'],'+10%');
  assert.equal(fields['5m buy / sell transactions'],'12 / 4');
  assert.equal(fields['Market cap (reported)'],'100000');
});
