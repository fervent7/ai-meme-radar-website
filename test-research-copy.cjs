const {test}=require('node:test');const assert=require('node:assert/strict');
const {copyAddress}=require('./research-copy.js');
test('identity copy keeps full case and reports success only after clipboard resolves',async()=>{
 const token='AbCd'+'E'.repeat(40),status={textContent:''},button={disabled:false};
 let resolve,writes=[];
 const clipboard={writeText:address=>{writes.push(address);return new Promise(r=>{resolve=r})}};
 const pending=copyAddress(token,'Token address',button,status,clipboard);
 assert.equal(button.disabled,true);assert.equal(status.textContent,'Copying token address…');
 await copyAddress(token,'Token address',button,status,clipboard);assert.equal(writes.length,1);
 resolve();await pending;
 assert.deepEqual(writes,[token]);assert.equal(status.textContent,'Token address copied.');assert.equal(button.disabled,false);
});
test('denied or unavailable clipboard retains retry and actionable full-address selection',async()=>{
 for(const clipboard of [undefined,{writeText:()=>Promise.reject(Error('PRIVATE_DETAIL'))}]){
  const button={disabled:false},status={textContent:''};
  await copyAddress('0x'+'a'.repeat(40),'Pool address',button,status,clipboard);
  assert.equal(button.disabled,false);
  assert.equal(status.textContent,'Copy unavailable. Select the full pool address shown above.');
  assert.doesNotMatch(status.textContent,/PRIVATE_DETAIL|copied/);
 }
});
