(function(root){
 'use strict';
 const states=new Set(['CURRENT_RECORDED_CHECKS','EXPIRED','REVOKED','UNKNOWN']);
 const labels={CURRENT_RECORDED_CHECKS:'Recorded checks current (example)',EXPIRED:'Expired evidence (example)',REVOKED:'Revoked reference (example)',UNKNOWN:'Evidence missing or unavailable (example)'};
 function viewModel(document,key){
  if(document?.data_classification!=='SYNTHETIC_TEST_DATA_NOT_LIVE')throw Error('Invalid example');
  const row=document.cases?.[key];
  if(!row||row.schema_version!=='radar-research-passport-preview-v1'||!states.has(row.state)
    ||row.signed_attestation!==false||row.security_clearance!==false||row.transaction_authorized!==false
    ||!Array.isArray(row.checks)||row.checks.length!==3)throw Error('Invalid example');
  return {label:labels[row.state],row};
 }
 async function mount(){
  const region=root.document?.getElementById('passport-preview');if(!region)return;
  const select=root.document.getElementById('passport-scenario'),content=root.document.getElementById('passport-content');
  const status=root.document.getElementById('passport-status'),retry=root.document.getElementById('passport-retry');
  let document=null,busy=false;
  const element=(tag,text)=>{const el=root.document.createElement(tag);el.textContent=text;return el};
  function render(){
   try{
    const model=viewModel(document,select.value);status.textContent=model.label;
    content.replaceChildren();
    content.append(element('p','Controlled example clock: '+model.row.evaluated_at_utc),
     element('p','Network: '+model.row.identity.chain+' · Token: '+model.row.identity.token_address));
    for(const check of model.row.checks){
     const card=element('article','');card.className='passport-check';
     card.append(element('h4',check.kind.replaceAll('_',' ')),element('p',check.state),
      element('p','Source: '+(check.source||'Unavailable')),element('p','Recorded: '+(check.observed_at_utc||'Unavailable')),
      element('p','Expires: '+(check.expires_at_utc||'Unavailable')),element('p','Reason: '+check.reason));
     content.append(card);
    }
   }catch{content.replaceChildren();status.textContent='Example unavailable. Retry loading the preview.';retry.hidden=false;}
  }
  async function load(){
   if(busy)return;busy=true;retry.disabled=true;select.disabled=true;retry.hidden=true;
   status.textContent='Loading synthetic preview…';
   let timer;
   try{
    const controller=new AbortController();timer=setTimeout(()=>controller.abort(),5000);
    const response=await fetch('/passport-preview-fixture.json',{cache:'no-store',credentials:'same-origin',signal:controller.signal});
    if(!response.ok)throw Error('Unavailable');document=await response.json();render();
   }catch{document=null;content.replaceChildren();status.textContent='Example unavailable. Retry loading the preview.';retry.hidden=false;}
   finally{clearTimeout(timer);busy=false;retry.disabled=false;select.disabled=!document;}
  }
  select.addEventListener('change',render);retry.addEventListener('click',load);await load();
 }
 const api={viewModel,mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else {root.RadarPassportPreview=api;mount();}
})(typeof window!=='undefined'?window:globalThis);
