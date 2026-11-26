(function(root){
 'use strict';
 async function copyAddress(address,label,button,status,clipboard){
  if(button.disabled)return;
  button.disabled=true;status.textContent='Copying '+label.toLowerCase()+'…';
  try{
   if(!clipboard||typeof clipboard.writeText!=='function')throw Error('Clipboard unavailable');
   await clipboard.writeText(address);
   status.textContent=label+' copied.';
  }catch{
   status.textContent='Copy unavailable. Select the full '+label.toLowerCase()+' shown above.';
  }finally{button.disabled=false;}
 }
 function mount(card,pair,token){
  const doc=card.ownerDocument;
  const actions=doc.createElement('div');actions.className='research-identity-actions';
  const status=doc.createElement('p');status.className='research-mini';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  for(const [label,address] of [['Token address',token?.address],['Pool address',pair?.pairAddress]]){
   if(!root.RadarIdentity?.addressMatchesNetwork(pair.chainId,address))continue;
   const button=doc.createElement('button');button.type='button';button.className='outline';
   button.textContent='Copy '+label.toLowerCase();
   button.addEventListener('click',()=>copyAddress(address,label,button,status,root.navigator?.clipboard));
   actions.append(button);
  }
  if(actions.childElementCount){card.append(actions,status);}
 }
 const api={copyAddress,mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RadarResearchCopy=api;
})(typeof window!=='undefined'?window:globalThis);
