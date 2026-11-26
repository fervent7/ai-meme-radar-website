const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

test('a cancelled refresh cannot replace cards or overwrite the next refresh status', async () => {
  const source = readFileSync(join(__dirname, 'app.js'), 'utf8');
  const start = source.indexOf('const LIVE_INTERVAL_MS');
  const end = source.indexOf('function radarPreviewLink', start);
  assert.ok(start >= 0 && end > start);
  const status = {textContent: ''};
  const pending = [];
  const replaced = [];
  let cards = [card('old')];
  function card(pool) {
    return {dataset: {chain: 'solana', pool, token: 'mint'},
      replaceWith() { replaced.push(pool); }};
  }
  const context = {
    AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
    results: {querySelectorAll: () => cards},
    document: {hidden: false, getElementById: () => status},
    window: {RadarIdentity: require('./market-identity.js')},
    fetch: (url, options) => new Promise(resolve => pending.push({resolve, signal: options.signal}))
  };
  const api = vm.runInNewContext(source.slice(start, end) +
    '\nrenderLivePair = pair => pair; ({refreshLive, stopLive})', context);
  const first = api.refreshLive();
  api.stopLive();
  assert.equal(pending[0].signal.aborted, true);
  cards = [card('new')];
  const second = api.refreshLive();
  assert.equal(pending.length, 2);
  const reply = pool => ({ok: true, json: async () => ({pairs: [
    {chainId: 'solana', pairAddress: pool, baseToken: {address: 'mint'}}
  ]})});
  pending[1].resolve(reply('new'));
  await second;
  const currentStatus = status.textContent;
  assert.match(currentStatus, /updated/);
  pending[0].resolve(reply('old'));
  await first;
  assert.deepEqual(replaced, ['new']);
  assert.equal(status.textContent, currentStatus);
});

test('live research stops the pool refresh on 429 and resumes after cooldown', async () => {
  const source = readFileSync(join(__dirname, 'app.js'), 'utf8');
  const start = source.indexOf('const LIVE_INTERVAL_MS');
  const end = source.indexOf('function radarPreviewLink', start);
  const status = {textContent: ''};
  let now = 0;
  let rateLimited = true;
  const requests = [];
  const cards = ['first', 'limited', 'last'].map(pool => ({
    dataset: {chain: 'solana', pool, token: 'mint'}, replaceWith() {}
  }));
  const context = {
    AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
    Date: class extends Date { static now() { return now; } },
    results: {querySelectorAll: () => cards},
    document: {hidden: false, getElementById: () => status},
    window: {RadarIdentity: require('./market-identity.js')},
    fetch: async url => {
      const pool = url.split('/').at(-1);
      requests.push(pool);
      if (rateLimited && pool === 'limited') return {ok: false, status: 429};
      return {ok: true, json: async () => ({pairs: [
        {chainId: 'solana', pairAddress: pool, baseToken: {address: 'mint'}}
      ]})};
    }
  };
  const api = vm.runInNewContext(source.slice(start, end) +
    '\nrenderLivePair = pair => pair; ({refreshLive, stopLive})', context);
  await api.refreshLive();
  assert.deepEqual(requests, ['first', 'limited']);
  assert.deepEqual(cards.map(card => card.dataset.stale), [undefined, 'true', 'true']);
  assert.match(status.textContent, /rate limited/);
  api.stopLive();
  now = 30000;
  await api.refreshLive();
  assert.equal(requests.length, 2);
  rateLimited = false;
  now = 60000;
  await api.refreshLive();
  assert.deepEqual(requests, ['first', 'limited', 'first', 'limited', 'last']);
  assert.match(status.textContent, /updated/);
});

test('foreground timeout, retry, rate limit and private errors produce safe research states', async () => {
  const source = readFileSync(join(__dirname, 'app.js'), 'utf8');
  const start = source.indexOf('async function research(');
  const end = source.indexOf("} finally {\n clearTimeout(deadline);", start);
  assert.ok(start >= 0 && end > start);
  const functionEnd = source.indexOf('}}', end) + 2;
  const searchBtn = {disabled: false};
  const messages = {};
  let note;
  let deadline;
  let requests = 0;
  let notifyBodyStarted;
  const bodyStarted = new Promise(resolve => { notifyBodyStarted = resolve; });
  const context = {
    AbortController, researchController: undefined,
    $: id => id === 'searchBtn' ? searchBtn : {value: 'valid-address'},
    valid: () => true, set: (key, value) => { messages[key] = value; },
    stopLive() {}, liveMessage() {},
    node: (_tag, textContent) => ({textContent}),
    results: {replaceChildren(child) { note = child; }},
    setTimeout(callback) { deadline = callback; },
    clearTimeout() {},
    fetch: async (_url, {signal}) => ({
      ok: true,
      json: () => ++requests === 1
        ? new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {once: true});
          notifyBodyStarted();
        })
        : Promise.resolve({pairs: []})
    })
  };
  const research = vm.runInNewContext(source.slice(start, functionEnd) + '\nresearch', context);
  const first = research();
  await bodyStarted;
  assert.equal(searchBtn.disabled, true);
  deadline();
  await first;
  assert.equal(searchBtn.disabled, false);
  assert.match(messages.searchHelp, /timed out.*retry/);
  assert.match(note.textContent, /did not respond in time/);
  await research();
  assert.equal(searchBtn.disabled, false);
  assert.match(messages.searchHelp, /No exact-address indexed trading pool found/);
  context.fetch = async () => ({ok: false, status: 429});
  await research();
  assert.match(note.textContent, /rate limiting requests/);
  context.fetch = async () => { throw new Error('private upstream diagnostic'); };
  await research();
  assert.equal(note.textContent, 'Indexed trading pools could not be retrieved. Try again later.');
});



function pauseHarness(request){
  const source=readFileSync(join(__dirname,'app.js'),'utf8');
  const start=source.indexOf('const LIVE_INTERVAL_MS'),end=source.indexOf('function radarPreviewLink',start);
  const timers=new Set(),status={textContent:''},attrs={},control={
    setAttribute(k,v){attrs[k]=v;},addEventListener(_event,fn){this.click=fn;}};
  let timer=0,now=0,replacements=0;
  const cards=[{dataset:{chain:'solana',pool:'pool',token:'mint'},replaceWith(){replacements++;}}];
  const context={AbortController,setTimeout,clearTimeout,
    setInterval(){timers.add(++timer);return timer;},clearInterval(id){timers.delete(id);},
    Date:class extends Date{static now(){return now;}},
    document:{hidden:false,getElementById:id=>id==='liveRefreshToggle'?control:status},
    results:{querySelectorAll:()=>cards},window:{RadarIdentity:require('./market-identity.js')},fetch:request};
  const api=vm.runInNewContext(source.slice(start,end)+
    '\nrenderLivePair=pair=>pair;({startLive,refreshLive,setLivePaused})',context);
  return {api,timers,status,attrs,control,cards,get replacements(){return replacements;},set now(value){now=value;}};
}

test('pause suppresses automatic requests, survives a new search timer and resumes once',async()=>{
  let calls=0;
  const h=pauseHarness(async()=>{calls++;return {ok:true,json:async()=>({pairs:[
    {chainId:'solana',pairAddress:'pool',baseToken:{address:'mint'}}]})};});
  h.api.startLive();assert.equal(h.timers.size,1);
  h.control.click();assert.equal(h.attrs['aria-pressed'],'true');
  assert.equal(h.control.textContent,'Resume automatic refresh');
  assert.equal(h.timers.size,0);
  await h.api.refreshLive();h.api.startLive();await h.api.refreshLive();
  assert.equal(calls,0);assert.equal(h.timers.size,0);
  assert.match(h.status.textContent,/paused.*saved history remain available/);
  await h.control.click();assert.equal(calls,1);assert.equal(h.replacements,1);
  assert.equal(h.timers.size,1);assert.equal(h.attrs['aria-pressed'],'false');
  await h.api.setLivePaused(false);assert.equal(calls,1);assert.equal(h.timers.size,1);
  h.api.setLivePaused(true);
});

test('pause aborts a pending refresh and a late reply cannot replace saved evidence',async()=>{
  let pending,signal;
  const h=pauseHarness((_url,options)=>{signal=options.signal;return new Promise(resolve=>{pending=resolve;});});
  h.api.startLive();const refresh=h.api.refreshLive();
  h.control.click();assert.equal(signal.aborted,true);
  const message=h.status.textContent;
  pending({ok:true,json:async()=>({pairs:[{chainId:'solana',pairAddress:'pool',baseToken:{address:'mint'}}]})});
  await refresh;
  assert.equal(h.replacements,0);assert.equal(h.status.textContent,message);
  assert.equal(h.cards[0].dataset.stale,'true');assert.equal(h.timers.size,0);
});

test('pause and resume cannot bypass the existing rate-limit cooldown',async()=>{
  let calls=0;
  const h=pauseHarness(async()=>{calls++;return {ok:false,status:429};});
  await h.api.refreshLive();assert.equal(calls,1);
  h.api.setLivePaused(true);h.now=30000;await h.api.setLivePaused(false);
  assert.equal(calls,1);
  h.now=60000;await h.api.refreshLive();assert.equal(calls,2);
  h.api.setLivePaused(true);
});
