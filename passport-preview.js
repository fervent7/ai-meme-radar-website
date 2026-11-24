(function(root){
 'use strict';
 const states=new Set(['CURRENT_RECORDED_CHECKS','EXPIRED','REVOKED','UNKNOWN']);
 const labels={CURRENT_RECORDED_CHECKS:'Recorded checks current (example)',EXPIRED:'Expired evidence (example)',REVOKED:'Revoked reference (example)',UNKNOWN:'Evidence missing or unavailable (example)'};
 const checkLabels={CURRENT_RECORDED_CHECK:'Current source record',EXPIRED:'Expired',REVOKED:'Revoked',UNKNOWN:'Unavailable'};
 const reasons={
  EVIDENCE_MISSING:'This required check has no source record.',
  AMBIGUOUS_EVIDENCE_RECORDS:'Conflicting or duplicated records need review.',
  RECORDED_REFERENCE_REVOKED:'This source reference was revoked in the example.',
  EVIDENCE_EXPIRED:'This source record is older than the example freshness limit.',
  PRODUCER_ASSERTION_NOT_INDEPENDENT_ATTESTATION:'The preview has not independently verified this provider assertion.',
  EVIDENCE_INVALID_OR_UNAVAILABLE:'The record could not be validated for this token, pool and time.',
  CHAIN_POINT_MISMATCH:'The checks refer to different blocks or slots.',
  CHAIN_POINT_TIME_MISMATCH:'The checks disagree on the time of the same block or slot.'
 };
 function explain(check){return {state:checkLabels[check?.state]||'Unavailable',
  reason:reasons[check?.reason]||'The reason for this unavailable check is not recognised.'};}
 function displayTime(value){
  const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return 'Unavailable';
  return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(date)+' UTC';
 }

 function viewModel(document,key){
  if(document?.data_classification!=='SYNTHETIC_TEST_DATA_NOT_LIVE')throw Error('Invalid example');
  const row=document.cases?.[key];
  if(!row||row.schema_version!=='radar-research-passport-preview-v1'||!states.has(row.state)
    ||row.signed_attestation!==false||row.security_clearance!==false||row.transaction_authorized!==false
    ||!Array.isArray(row.checks)||row.checks.length!==3)throw Error('Invalid example');
  const kinds=['holder_distribution','pool_reserves','token_security'];
  const childStates=new Set(['CURRENT_RECORDED_CHECK','EXPIRED','REVOKED','UNKNOWN']);
  if(new Set(row.checks.map(check=>check?.kind)).size!==3
    ||row.checks.some(check=>!kinds.includes(check?.kind)||!childStates.has(check?.state)))throw Error('Invalid example');
  const statusSet=new Set(row.checks.map(check=>check.state));
  const derived=statusSet.has('REVOKED')?'REVOKED':statusSet.has('UNKNOWN')?'UNKNOWN':statusSet.has('EXPIRED')?'EXPIRED':'CURRENT_RECORDED_CHECKS';
  if(row.state!==derived)throw Error('Inconsistent example');
  if(row.state==='CURRENT_RECORDED_CHECKS'){
   const stamp=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
   const evaluated=stamp(row.evaluated_at_utc),ttl=row.max_age_seconds;
   if(!Number.isFinite(evaluated)||!Number.isInteger(ttl)||ttl<1||ttl>300)throw Error('Invalid example clock');
   let pointKey=null,chainTime=null;
   for(const check of row.checks){
    const point=check.chain_point,kind=row.identity?.chain==='solana'?'slot':'block';
    if(!point||!Number.isSafeInteger(point[kind])||point[kind]<0
      ||(kind==='block'&&(!/^0x[0-9a-fA-F]{64}$/.test(point.block_hash)||BigInt(point.block_hash)===0n)))throw Error('Invalid example point');
    const key=kind+':'+point[kind]+':'+(point.block_hash||'').toLowerCase();
    const block=stamp(check.block_time_utc),observed=stamp(check.observed_at_utc),expires=stamp(check.expires_at_utc);
    if(!Number.isFinite(block)||!Number.isFinite(observed)||!Number.isFinite(expires)
      ||block>observed||observed>evaluated||evaluated>=expires||expires!==block+ttl*1000
      ||(pointKey!==null&&(key!==pointKey||block!==chainTime)))throw Error('Inconsistent example evidence');
    pointKey=key;chainTime=block;
   }
  }
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
    content.append(element('p','Controlled example clock: '+displayTime(model.row.evaluated_at_utc)),
     element('p','Network: '+model.row.identity.chain+' · Token: '+model.row.identity.token_address));
    for(const check of model.row.checks){
     const card=element('article','');card.className='passport-check';
     const human=explain(check);
     card.append(element('h3',check.kind.replaceAll('_',' ')),element('p',human.state),
      element('p','Source: '+(check.source||'Unavailable')),element('p','Recorded: '+displayTime(check.observed_at_utc)),
      element('p','Expires: '+displayTime(check.expires_at_utc)),element('p',human.reason));
     if(check.chain_point){
      const details=element('details','');details.append(element('summary','View chain reference'));
      const point=check.chain_point;
      details.append(element('p',point.slot!==undefined?'Solana slot '+point.slot:'Block '+point.block),
       element('code',point.block_hash||'Block hash unavailable in this source record'));
      card.append(details);
     }
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
 const api={viewModel,mount,explain,displayTime};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else {root.RadarPassportPreview=api;mount();}
})(typeof window!=='undefined'?window:globalThis);
