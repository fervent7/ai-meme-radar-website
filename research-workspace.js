(function(root){
 'use strict';
 const VIEWS=['overview','wallet-dna','holders','liquidity','risk','passport'];
 const LABELS=['Overview','Wallet DNA','Holders','Liquidity','Risk','Passport'];
 function viewFromHash(hash){const value=String(hash||'').replace(/^#view-/,'');return VIEWS.includes(value)?value:'overview';}
 function visibleFor(view,scopes){return view==='overview'||String(scopes||'').split(' ').includes(view);}
 function mount(){
  const doc=root.document,tabs=doc?.getElementById('research-view-tabs'),results=doc?.getElementById('researchResults');
  if(!tabs||!results)return;
  const status=doc.getElementById('research-view-status'),context=doc.getElementById('research-view-context');
  const buttons=[...tabs.querySelectorAll('[role="tab"]')];let active=viewFromHash(root.location.hash);
  const notes={overview:'Indexed market and saved research evidence. Labels and original times remain authoritative.',
   'wallet-dna':'Load finalized on-chain evidence for saved Solana relationships. Other-chain wallet evidence remains unavailable.',
   holders:'Load saved research or on-chain evidence. Exact holder counts and growth require their own verified source records.',
   liquidity:'Reported pool balances and saved reserves are research evidence. Executable depth and price impact remain unavailable.',
   risk:'Inspect the original evidence and unknowns. This view does not independently clear a token or authorize trading.',
   passport:'Token-specific passport service is unavailable. The separate passport example is synthetic and does not use this token.'};
  function apply(){
   for(const item of results.querySelectorAll('.research-primary > .research-stats'))item.setAttribute('data-research-views','overview');
   for(const item of results.querySelectorAll('.research-primary > section.research-note'))item.setAttribute('data-research-views','liquidity risk');
   for(const item of results.querySelectorAll('[data-research-views]'))item.hidden=!visibleFor(active,item.getAttribute('data-research-views'));
   results.setAttribute('aria-labelledby','research-tab-'+active);
   const card=results.querySelector('.research-primary');
   context.textContent=card?'Selected evidence context: '+card.dataset.chain+' · Token '+card.dataset.token+' · Pool '+card.dataset.pool:
    'No selected evidence context. Research a token to load indexed pools; missing evidence stays unavailable.';
  }
  function select(view,focus=false){
   active=VIEWS.includes(view)?view:'overview';
   for(const button of buttons){const selected=button.dataset.view===active;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
   status.textContent=notes[active];
   const sample=doc.getElementById('passport-example-link');sample.hidden=active!=='passport';
   apply();if(focus)doc.getElementById('research-tab-'+active).focus();
  }
  for(const button of buttons){
   button.addEventListener('click',()=>{select(button.dataset.view);root.history.replaceState(null,'',root.location.pathname+root.location.search+'#view-'+active);});
   button.addEventListener('keydown',event=>{
    const i=VIEWS.indexOf(button.dataset.view);let next;
    if(event.key==='ArrowRight')next=(i+1)%VIEWS.length;
    if(event.key==='ArrowLeft')next=(i+VIEWS.length-1)%VIEWS.length;
    if(event.key==='Home')next=0;if(event.key==='End')next=VIEWS.length-1;
    if(next===undefined)return;event.preventDefault();select(VIEWS[next],true);
    root.history.replaceState(null,'',root.location.pathname+root.location.search+'#view-'+active);
   });
  }
  results.setAttribute('role','tabpanel');
  new root.MutationObserver(apply).observe(results,{childList:true,subtree:true});
  root.addEventListener('hashchange',()=>select(viewFromHash(root.location.hash)));
  select(active);
 }
 const api={VIEWS,LABELS,viewFromHash,visibleFor,mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else{root.RadarResearchWorkspace=api;mount();}
})(typeof window!=='undefined'?window:globalThis);
