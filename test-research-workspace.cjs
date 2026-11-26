const {test}=require('node:test');const assert=require('node:assert/strict');
const {VIEWS,viewFromHash,visibleFor}=require('./research-workspace.js');
test('only six known workspace views are selected, unknown hashes fail to overview',()=>{
 assert.deepEqual(VIEWS,['overview','wallet-dna','holders','liquidity','risk','passport']);
 assert.equal(viewFromHash('#view-wallet-dna'),'wallet-dna');
 for(const hash of ['#unknown','#view-<script>','https://example.invalid',''])assert.equal(viewFromHash(hash),'overview');
});
test('evidence filtering retains overview and does not promote other research scopes',()=>{
 assert.equal(visibleFor('overview','wallet-dna'),true);
 assert.equal(visibleFor('wallet-dna','wallet-dna'),true);
 assert.equal(visibleFor('holders','wallet-dna'),false);
 assert.equal(visibleFor('risk','liquidity risk'),true);
 assert.equal(visibleFor('passport','wallet-dna'),false);
});
