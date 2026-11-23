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
function render(address, market=pair){
  const source=readFileSync(require('node:path').join(__dirname,'app.js'),'utf8');
  const start=source.indexOf('const pairCard=');
  const end=source.indexOf('\nrenderLivePair=',start);
  assert.ok(start>=0&&end>start,'Card renderer must be present');
  const fields={};
  const context={address,window:{RadarIdentity:identity},Date,
    document:{createElement:()=>({dataset:{},append(){}})},
    esc:value=>String(value),
    stat:(label,value)=>{fields[label]=value;return '';},liquidityEvidence:()=>({})};
  const formatter=source.split('\n').find(line=>line.startsWith('const fmt='));
  assert.ok(formatter,'Market formatter must be present');
  const numeric=source.split('\n').find(line=>line.startsWith('const num='));
  const price=source.split('\n').find(line=>line.startsWith('const pairPrice='));
  assert.ok(numeric&&price,'Use the actual market numeric/price formatters');
  const card=vm.runInNewContext(formatter+'\n'+numeric+'\n'+price+'\n'+source.slice(start,end)+'\npairCard',context);
  card(market,true);
  return fields;
}
test('research card withholds invalid transaction counts and preserves zero',()=>{
  for(const invalid of [-1, 1.5, true, '12', Infinity, Number.MAX_SAFE_INTEGER+1]){
    const fields=render(target,{...pair,txns:{m5:{buys:invalid,sells:0}}});
    assert.equal(fields['5m buy / sell transactions'],'— / 0');
  }
});
test('research card withholds quote-token price, change, valuation and direction',()=>{
  const fields=render(pair.quoteToken.address);
  for(const label of ['Price USD','5m price change','5m buy / sell transactions'])
    assert.equal(fields[label],'Unavailable for quote token');
  for(const label of ['Market cap (reported)','FDV (reported)'])assert.equal(fields[label],'Unavailable');
  assert.equal(fields['Liquidity (reported)'],'$5,000');
  assert.equal(fields['5m volume'],'$700');
});
test('research card keeps base-token direction and market evidence',()=>{
  const fields=render(target);
  assert.equal(fields['Price USD'],'$2');
  assert.equal(fields['5m price change'],'+10%');
  assert.equal(fields['5m buy / sell transactions'],'12 / 4');
  assert.equal(fields['Market cap (reported)'],'$100,000');
});

test('research card does not display malformed market amounts as dollars',()=>{
  for(const invalid of [false, true, [], ' ', '0', -1, Infinity, null]){
    const fields=render(target,{...pair,liquidity:{usd:invalid},volume:{m5:invalid,h24:0}});
    assert.equal(fields['Liquidity (reported)'],'Unavailable');
    assert.equal(fields['5m volume'],'Unavailable');
    assert.equal(fields['24h volume'],'$0');
  }
  assert.equal(render(target,{...pair,volume:{m5:0.001}})['5m volume'],'Less than $0.01');
});

test('research handoff displays only the link label and uses the exact token URL', () => {
  const source = readFileSync(require.resolve('./app.js'), 'utf8');
  const builder = source.match(/const node=.*?return e};/)[0];
  const linkBuilder = source.slice(source.indexOf('function radarPreviewLink'), source.indexOf('async function research'));
  const mount = source.match(/const preview=radarPreviewLink\(chain,address\);if\(preview\)\{[^}]+\}/)[0];
  const section = { children: [], append(child) { this.children.push(child); } };
  const document = { createElement: () => ({
    textContent: '', append(child) { this.textContent += child.textContent; }
  }) };
  vm.runInNewContext(builder + linkBuilder + mount, { document, URL, section, chain: 'bsc', address: target });
  assert.equal(section.children[0].textContent, 'Open Radar test research (sign-in required)');
  const link = vm.runInNewContext(builder + linkBuilder + "radarPreviewLink('bsc', address)", { document, URL, address: target });
  assert.equal(new URL(link.href).searchParams.get('address'), target);
  assert.equal(new URL(link.href).searchParams.get('chain'), 'bsc');
  assert.equal(vm.runInNewContext(builder + "node('p').textContent", { document }), '');
});

test('actual card formatters withhold malformed price, change and valuation fields',()=>{
  for(const invalid of [false,true,[],{},' ','0x10','Infinity',Infinity,null,undefined]){
    const fields=render(target,{...pair,priceUsd:invalid,priceChange:{m5:invalid},
      marketCap:invalid,fdv:invalid});
    for(const label of ['Price USD','5m price change','Market cap (reported)','FDV (reported)'])
      assert.equal(fields[label],'Unavailable',label+' must withhold malformed input');
  }
  assert.equal(render(target,{...pair,priceUsd:-1})['Price USD'],'Unavailable');
  assert.equal(render(target,{...pair,priceUsd:'-0.01'})['Price USD'],'Unavailable');
});
test('actual formatters preserve zero, small decimal prices and negative price changes',()=>{
  const zero=render(target,{...pair,priceUsd:'0',priceChange:{m5:0},marketCap:0,fdv:'0'});
  assert.equal(zero['Price USD'],'$0');
  assert.equal(zero['5m price change'],'0%');
  assert.equal(zero['Market cap (reported)'],'$0');
  assert.equal(zero['FDV (reported)'],'$0');
  const small=render(target,{...pair,priceUsd:'0.00000001',priceChange:{m5:'-2.5'}});
  assert.equal(small['Price USD'],'$0.00000001');
  assert.equal(small['5m price change'],'-2.5%');
  assert.equal(render(target,{...pair,priceUsd:'1e-8'})['Price USD'],'$1e-8');
});
