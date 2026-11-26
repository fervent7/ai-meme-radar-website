'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
test('prelaunch showcase links into research and labels concepts and delivery states',()=>{
 const home=readFileSync('index.html','utf8');
 assert.match(home,/id="showcase-title"/);
 assert.match(home,/Concept illustration—not live token data/);
 assert.match(home,/href="research.html">Research a token/);
 assert.match(home,/Launch gate · Not passed/);
 assert.match(home,/github.com\/fervent7\/ai-meme-radar\/actions\/runs\/45403472994/);
 const products=readFileSync('products.html','utf8');
 for(const id of ['wallet-dna','token-passport','rules-marketplace','institutional-api',
  'capital-protection','intelligent-otc','commercial-model','launch-gate','early-access'])
  assert.ok(products.includes('id="'+id+'"'));
 assert.match(products,/No pay-for-rating/);
 assert.match(products,/No live trading or settlement service/);
 assert.match(products,/No email form or personal-data collection/);
 assert.equal(/<form[ >]|type="email"/.test(products),false);
 assert.match(products,/Current unit\/browser tests and synthetic examples do not satisfy/);
});
