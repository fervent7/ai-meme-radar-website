'use strict';
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const {test} = require('node:test');

function fixture() {
  const buttons = ['all','individuals','researchers','developers','organizations'].map(audience => ({
    dataset: {audience}, pressed: audience === 'all' ? 'true' : 'false',
    setAttribute(key, value) { assert.equal(key, 'aria-pressed'); this.pressed = value; },
    addEventListener(key, listener) { assert.equal(key, 'click'); this.click = listener; }
  }));
  const html = readFileSync('index.html','utf8');
  const cards = [...html.matchAll(/data-service="([^"]+)" data-audiences="([^"]+)"/g)]
    .map(([,id,audiences])=>({id,dataset:{audiences},hidden:false}));
  const controls = {hidden:true, querySelectorAll:()=>buttons};
  const status = {};
  runInNewContext(readFileSync('ecosystem.js','utf8'), {
    document:{getElementById:id=>({'service-filter':controls,
      'service-cards':{querySelectorAll:()=>cards},'service-results':status}[id])}
  });
  return {buttons,cards,controls,status};
}

test('audience filtering preserves planned labels and resets to the complete catalog',()=>{
  const f=fixture();
  assert.equal(f.cards.length,6);
  assert.equal(f.controls.hidden,false);
  f.buttons.find(b=>b.dataset.audience==='developers').click();
  assert.deepEqual(f.cards.filter(c=>!c.hidden).map(c=>c.id),['rules','risk','developer','access']);
  assert.match(f.status.textContent,/4 service areas for developers/);
  assert.match(f.status.textContent,/does not mean a service is launched/);
  assert.equal(f.buttons.filter(b=>b.pressed==='true').length,1);
  f.buttons[0].click();
  assert.equal(f.cards.filter(c=>!c.hidden).length,6);
});

test('unknown filter values cannot mutate selection or content',()=>{
  const f=fixture();
  f.buttons[0].dataset.audience='__proto__';
  f.buttons[0].click();
  assert.equal(f.status.textContent,undefined);
  assert.equal(f.cards.filter(c=>!c.hidden).length,6);
});

test('no-JavaScript catalog and example retain explicit availability and test-data labels',()=>{
  const home=readFileSync('index.html','utf8');
  const catalog=home.split('id="service-cards"')[1].split('</section>')[0];
  assert.equal((catalog.match(/class="service-card"/g)||[]).length,6);
  assert.equal((catalog.match(/feature-state review/g)||[]).length,1);
  assert.equal((catalog.match(/feature-state testing/g)||[]).length,3);
  assert.equal((catalog.match(/feature-state planned/g)||[]).length,2);
  assert.ok(!catalog.includes('<article hidden'));
  assert.match(home,/id="service-filter" hidden/);
  const studio=readFileSync('intelligence.html','utf8');
  assert.match(studio,/id="developer-contract"/);
  assert.match(studio,/test data only/);
  assert.match(studio,/Public API access and subscriptions are not launched/);
  assert.match(home,/Personal BSC Auto-Trader is a separate private project/);
});
