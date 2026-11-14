(()=>{'use strict';const $=id=>document.getElementById(id);const base=String(window.RADAR_API_BASE||'').trim().replace(/\/+$/,'');const configured=/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base);const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0}):'Unavailable';const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=String(text);return e};async function load(){if(!configured){set('healthBadge','SET API URL');set('connection','Not connected');return}set('connection','Connecting…');set('healthBadge','CONNECTING');try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),14000);let data;try{const response=await fetch(base+'/api/status',{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('Backend HTTP '+response.status);data=await response.json()}finally{clearTimeout(timer)}set('connection','Connected');set('healthBadge','BACKEND ONLINE');set('statusText','Monitoring');set('scansText',data.scans??'—');set('alertsText',data.successes??'—');set('fresh',data.telegram?.discovered_count??data.discovery?.unique_addresses??'—');set('candidates',data.telegram?.candidate_count??'—');set('eligible',data.telegram?.pipeline?.final_eligible_count??'—');set('updated','Updated '+new Date().toLocaleTimeString());set('radarNotice','Live data from the configured Radar backend. Eligibility and safety are determined independently by its verification gates.');const tbody=$('tokenRows');tbody.replaceChildren();const tokens=Array.isArray(data.tokens)?data.tokens.slice(0,12):[];if(!tokens.length){const tr=node('tr','');const td=node('td','No recent token snapshots available.');td.colSpan=6;td.className='empty';tr.append(td);tbody.append(tr)}for(const t of tokens){const tr=document.createElement('tr');const identity=node('td',t.symbol||'Unknown');identity.append(node('small',t.name&&t.name!==t.symbol?' · '+t.name:''));tr.append(identity,node('td',t.chain||'—'),node('td',money(t.liquidity_usd)),node('td',money(t.volume_5m_usd)),node('td',t.safety_status||'UNKNOWN'));const td=document.createElement('td');const link=node('a','View ↗');link.className='tablelink';link.href='research.html?'+new URLSearchParams({address:t.address||'',chain:t.chain||''})+'#research';td.append(link);tr.append(td);tbody.append(tr)}}catch(e){set('connection','Unavailable');set('healthBadge','BACKEND OFFLINE');set('statusText','Unavailable');set('radarNotice','Could not load live Radar data. Check the backend URL, service availability and cross-origin access (CORS). '+(e.name==='AbortError'?'Request timed out.':'Request failed.'))}}const refresh=$('refresh');if(refresh){refresh.addEventListener('click',load);load()}const results=$('researchResults');if(!results)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined||n===''||!Number.isFinite(Number(n))?'Unavailable':'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const short=s=>String(s||'—').length>22?String(s).slice(0,10)+'…'+String(s).slice(-8):String(s||'—');
const valid=s=>/^0x[a-fA-F0-9]{40}$/.test(s)||(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s));
let researchController;
const LIVE_INTERVAL_MS=30000;
let liveTimer=null;
let liveRun=null;
function stopLive(){
 if(liveTimer){clearInterval(liveTimer);liveTimer=null}
 const previous=liveRun;
 liveRun=null;
 previous?.controller?.abort();
}
const liveStatus=()=>document.getElementById('liveResearchStatus');
function liveMessage(message){const el=liveStatus();if(el)el.textContent=message}
async function refreshLive(){
 if(liveRun||document.hidden)return;
 const cards=[...results.querySelectorAll('.research-primary[data-pool][data-chain]')];
 if(!cards.length){stopLive();return}
 const run={controller:null};
 liveRun=run;
 try{
  let successful=0;
  for(const card of cards){
   const chain=card.dataset.chain,pool=card.dataset.pool;
   if(liveRun!==run)return;
   const controller=new AbortController();
   run.controller=controller;
   const timer=setTimeout(()=>controller.abort(),12000);
   try{
    const url='https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(chain)+'/'+encodeURIComponent(pool);
    const res=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!res.ok)throw Error('HTTP '+res.status);
    const data=await res.json();
    if(liveRun!==run)return;
    if(controller.signal.aborted)throw Error('Refresh timed out');
    const pair=(Array.isArray(data.pairs)?data.pairs:[]).find(p=>String(p.chainId).toLowerCase()===chain.toLowerCase()&&window.RadarIdentity.sameAddress(chain,String(p.pairAddress),pool));
    if(!pair)throw Error('Exact pool not returned');
    const token=card.dataset.token;
    if(!window.RadarIdentity.matchesToken(pair,token))throw Error('Token mismatch');
    const replacement=renderLivePair(pair,token);
    const history = card.querySelector?.('.cached-research');
    const nextHistory = replacement.querySelector?.('.cached-research');
    if (history && nextHistory) nextHistory.replaceWith(history);
    card.replaceWith(replacement);successful++;
   }catch(e){if(liveRun!==run)return;card.dataset.stale='true'}finally{clearTimeout(timer)}
  }
  liveMessage(successful===cards.length?'● Live market snapshots · updated '+new Date().toLocaleTimeString()+' · refresh every 30s':
   '⚠ Some prices are stale · '+successful+'/'+cards.length+' pools updated · retrying in 30s');
 }finally{if(liveRun===run)liveRun=null}
}
let renderLivePair=()=>{throw Error('Research card renderer not ready')};
function startLive(){stopLive();liveMessage('● Live updates enabled · refresh every 30s');liveTimer=setInterval(refreshLive,LIVE_INTERVAL_MS)}

function radarPreviewLink(chain,address){
 const supported=['solana','base','ethereum','bsc','robinhood','arbitrum','polygon','avalanche','optimism','linea','zksync_era','fantom','mantle','cronos'];
 const radarChain=chain==='zksync'?'zksync_era':chain;
 const addressPattern=radarChain==='solana'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/:/^0x[a-fA-F0-9]{40}$/;
 if(!supported.includes(radarChain)||!addressPattern.test(address))return null;
 const url=new URL('https://ai-meme-radar-verify-test.onrender.com/research');
 url.searchParams.set('chain',radarChain);
 url.searchParams.set('address',address);
 const link=node('a','Open Radar test research (sign-in required)');
 link.href=url.href;
 link.target='_blank';
 link.rel='noopener noreferrer';
 return link;
}

async function research({chain: selectedChain} = {}){const address=$('address').value.trim();if(!valid(address)){set('searchHelp','Paste a valid 0x EVM address (42 characters) or Solana-style base58 mint (32–44 characters).');return}
stopLive();
researchController?.abort();
const controller = new AbortController();
researchController = controller;
const {signal} = controller;
let timedOut = false;
const deadline = setTimeout(() => {
 timedOut = true;
 controller.abort();
}, 12000);
set('searchHelp','Searching indexed trading pairs across networks…');results.replaceChildren();liveMessage('Searching…');$('searchBtn').disabled=true;
try{const response=await fetch('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(address),{signal,cache:'no-store'});if(!response.ok)throw Error('Market provider returned HTTP '+response.status);const data=await response.json();
if(researchController!==controller)return;
if(signal.aborted)throw new Error('Market research timed out');
const matches=(Array.isArray(data.pairs)?data.pairs:[]).filter(x=>(!selectedChain||x.chainId===selectedChain)&&window.RadarIdentity.matchesToken(x,address));
if(!matches.length){set('searchHelp','No exact-address indexed trading pool found. This does NOT prove the contract does not exist or that liquidity is zero.');results.innerHTML='<div class="research-note">No indexed pool matched this exact address. Contract existence, holder count and sellability remain unverified.</div>';return}
const groups=new Map();const seen=new Set();for(const pair of matches){const chain=String(pair.chainId||'unknown');const key=window.RadarIdentity.poolKey(pair);if(seen.has(key))continue;seen.add(key);if(!groups.has(chain))groups.set(chain,[]);groups.get(chain).push(pair)}
const total=[...groups.values()].reduce((n,arr)=>n+arr.length,0);
set('searchHelp',total+' exact-address indexed pool(s) on '+groups.size+' network(s). Showing the strongest reported-liquidity pool on each network; other pools are collapsed.');
const num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const stat=(label,value)=>'<div><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>';
const pairPrice=x=>num(x)===null?'Unavailable':'$'+String(x);
const reserveAmount=(raw,symbol)=>{
 const amount=num(raw);
 if((typeof raw!=='number'&&typeof raw!=='string')||String(raw).trim()===''||amount===null||amount<0)return 'Unavailable';
 return amount.toLocaleString('en-US',{maximumSignificantDigits:8})+(symbol?' '+symbol:'');
};
function liquidityEvidence(pair){
 const section=document.createElement('section');
 section.className='research-note';
 section.append(node('h5','Liquidity and execution risk'));
 const reserves=document.createElement('div');
 reserves.className='research-stats';
 reserves.innerHTML=stat('Base balance (reported)',reserveAmount(pair.liquidity?.base,pair.baseToken?.symbol))
  +stat('Quote balance (reported)',reserveAmount(pair.liquidity?.quote,pair.quoteToken?.symbol))
  +stat('Price impact for a trade size','Quote required');
 section.append(reserves);
 const fetched=node('p','Market source: DexScreener · Fetched '+new Date().toLocaleString());
 fetched.className='research-mini';
 section.append(fetched,node('p','The reported pool balances give market context. A size-specific route quote is needed to estimate executable depth, fees and price impact.'));
 return section;
}
const pairCard=(pair,primary)=>{const tx=pair.txns?.m5||{};const name=(pair.baseToken?.symbol||'?')+' / '+(pair.quoteToken?.symbol||'?');const created=num(pair.pairCreatedAt);const age=created!==null?new Date(created).toLocaleString():'Unavailable';const tokenMetrics=window.RadarIdentity.tokenMetrics(pair,address);const marketCap=num(tokenMetrics.marketCap);const fdv=num(tokenMetrics.fdv);const tokenSide=window.RadarIdentity.sameAddress(pair.chainId,pair.baseToken?.address,address)?pair.baseToken:pair.quoteToken;const el=document.createElement('article');el.className='research-pool'+(primary?' research-primary':'');if(primary){el.dataset.chain=String(pair.chainId||'');el.dataset.pool=String(pair.pairAddress||'');el.dataset.token=address};el.innerHTML='<div class="research-pool-head"><strong>'+esc(tokenSide?.name||tokenSide?.symbol||'Token')+' · '+esc(name)+'</strong>'+(primary?'<span class="research-pill">Top liquidity pool</span>':'')+'</div><div class="research-mini">DEX: '+esc(pair.dexId||'Unknown')+' · Network: '+esc(pair.chainId||'Unknown')+'</div><div class="research-mini">Token: <code>'+esc(tokenSide?.address||'Unavailable')+'</code></div><div class="research-mini">Pool: <code>'+esc(pair.pairAddress||'Unavailable')+'</code></div><div class="research-stats">'+stat('Liquidity (reported)',fmt(pair.liquidity?.usd))+stat('Market cap (reported)',marketCap===null?'Unavailable':fmt(marketCap))+stat('Price USD',tokenMetrics.isBase?pairPrice(tokenMetrics.priceUsd):'Unavailable for quote token')+stat('5m price change',!tokenMetrics.isBase?'Unavailable for quote token':num(tokenMetrics.priceChange5mPct)===null?'Unavailable':(num(tokenMetrics.priceChange5mPct)>0?'+':'')+num(tokenMetrics.priceChange5mPct)+'%')+stat('5m volume',fmt(pair.volume?.m5))+stat('5m buy / sell transactions',tokenMetrics.isBase?(tokenMetrics.buys5m??'—')+' / '+(tokenMetrics.sells5m??'—'):'Unavailable for quote token')+stat('24h volume',fmt(pair.volume?.h24))+stat('Unique buyers / sellers','Not verified')+stat('Unique traders','Not verified')+stat('Token holders','Not verified')+stat('Holder growth','Not verified')+stat('FDV (reported)',fdv===null?'Unavailable':fmt(fdv))+stat('Pool created',age)+'</div><p class="research-warning">Liquidity and market cap are provider-reported snapshots, not independently verified reserves. Buy/sell figures count transactions, not unique wallets. Holders, wallet activity, sellability and contract safety require separate on-chain checks. No safety guarantee.</p>';el.append(liquidityEvidence(pair));if(primary)window.RadarCachedHistory?.mount(el);return el};
renderLivePair=(pair)=>pairCard(pair,true);for(const [chain,pairs] of groups){pairs.sort((a,b)=>(num(b.liquidity?.usd)??-1)-(num(a.liquidity?.usd)??-1));const section=document.createElement('section');section.className='research-chain';const heading=document.createElement('h4');heading.textContent=chain.toUpperCase()+' · '+pairs.length+' indexed pool(s)';section.append(heading);section.append(pairCard(pairs[0],true));const preview=radarPreviewLink(chain,address);if(preview){const handoff=node('p');handoff.append(preview);section.append(handoff)}if(pairs.length>1){const details=document.createElement('details');details.className='research-other';const summary=document.createElement('summary');summary.textContent='View other '+(pairs.length-1)+' pools';details.append(summary);const note=document.createElement('p');note.className='research-mini';note.textContent='These are other indexed markets for this exact address. They may be inactive, illiquid or duplicated by data providers.';details.append(note);for(const pair of pairs.slice(1)){const row=document.createElement('button');row.type='button';row.className='research-other-row';row.textContent=(pair.baseToken?.symbol||'?')+' / '+(pair.quoteToken?.symbol||'?')+' · '+(pair.dexId||'DEX')+' · '+fmt(pair.liquidity?.usd);row.addEventListener('click',()=>{const old=section.querySelector('.research-primary');old.replaceWith(pairCard(pair,true));section.scrollIntoView({behavior:'smooth',block:'start'})});details.append(row)}section.append(details)}results.append(section)}startLive();
} catch (error) {
 if (researchController !== controller) return;
 stopLive();
 liveMessage('⚠ Live updates unavailable');
 set('searchHelp', timedOut ? 'Market research timed out. Tap Research token to retry.' :
  'Market research unavailable. Try again later. No safety conclusion can be drawn.');
 results.innerHTML = '<div class="research-note">Could not retrieve indexed pools: ' +
  esc(timedOut ? 'Request timed out' : error.message) + '</div>';
} finally {
 clearTimeout(deadline);
 if (researchController === controller) $('searchBtn').disabled = false;
}}
$('searchBtn').addEventListener('click',()=>research());
$('address').addEventListener('keydown',e=>{if(e.key==='Enter')research()});
if (typeof window.location?.search === 'string') {
 const params = new URLSearchParams(window.location.search);
 const address = params.get('address');
 const chain = params.get('chain');
 if (address && valid(address)) {
  $('address').value = address;
  if (chain && /^[a-z0-9_-]{1,32}$/.test(chain)) {
   research({chain});
  } else {
   research();
  }
 }
}
})();
