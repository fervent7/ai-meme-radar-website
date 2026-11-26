(function(root){
 'use strict';
 function endpointModel(trend){
  if(!trend)return null;
  const {first,latest}=trend;
  if(!first||!latest||![first.count,latest.count,trend.verified_observations].every(Number.isSafeInteger)
   ||first.count<0||latest.count<0||trend.verified_observations<2
   ||![first.observed_at_utc,latest.observed_at_utc].every(t=>typeof t==='string'&&/(Z|\+00:00)$/.test(t)&&Number.isFinite(Date.parse(t)))
   ||Date.parse(first.observed_at_utc)>=Date.parse(latest.observed_at_utc))return null;
  const delta=latest.count-first.count,pct=first.count===0?null:delta/first.count*100;
  const status=delta===0?'UNCHANGED':delta>0?'INCREASING':'DECLINING';
  if(trend.status!==status||trend.growth_pct!==pct)return null;
  return {points:[{...first,label:'First saved endpoint'},{...latest,label:'Latest saved endpoint'}],delta,pct,status,max:Math.max(1,first.count,latest.count)};
 }
 function mount(container,trend){
  const doc=container.ownerDocument,el=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const section=el('section');section.className='holder-endpoints';section.setAttribute('data-research-views','holders');
  section.setAttribute('aria-label','Saved holder endpoint comparison');
  section.append(el('h5','Saved holder endpoint comparison'));
  const model=endpointModel(trend);
  if(!model){section.append(el('p','Comparison unavailable: two valid saved endpoints are required.'));container.append(section);return;}
  section.append(el('p',model.status+' · '+model.delta+' owner-address change · '+(model.pct===null?'Percentage unavailable: zero baseline':Number(model.pct.toFixed(2))+'%')));
  const detail=el('p','Select an endpoint to inspect its original lookup time.');detail.setAttribute('role','status');
  for(const point of model.points){
   const row=el('div');row.className='holder-endpoint-row';
   const button=el('button',point.label+' · '+point.count+' owner addresses');button.type='button';button.setAttribute('aria-pressed','false');
   const meter=el('meter');meter.min=0;meter.max=model.max;meter.value=point.count;meter.setAttribute('aria-label',point.label+' owner addresses');
   button.addEventListener('click',()=>{for(const b of section.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));detail.textContent=point.label+' · '+point.count+' owner addresses · '+point.observed_at_utc+' · Saved Helius getTokenAccounts lookup';});
   row.append(button,meter);section.append(row);
  }
  section.append(detail,el('p','Two saved endpoints only; intermediate activity is not drawn or inferred. Owner addresses are not people. Buyer growth remains unverified. Counts retain the upstream evidence limits; this chart does not independently reconcile supply or prove current holdings.'));
  container.append(section);
 }
 const api={endpointModel,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RadarHolderHistory=api;
})(typeof window==='object'?window:globalThis);
