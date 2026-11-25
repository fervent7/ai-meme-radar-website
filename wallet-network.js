(function(root){
 'use strict';
 const PAGE=12,ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 function pageModel(entries,page=0){
  if(!Array.isArray(entries)||entries.length>1000||!Number.isSafeInteger(page)||page<0)throw Error('Invalid diagram');
  const indices=new Set();
  for(const {edge,index} of entries){
   if(!edge||!Number.isSafeInteger(index)||index<0||index>=1000||indices.has(index)
     ||typeof edge.source_owner!=='string'||typeof edge.destination_owner!=='string'
     ||!ADDRESS.test(edge.source_owner)||!ADDRESS.test(edge.destination_owner)||edge.source_owner===edge.destination_owner
     ||typeof edge.amount_raw!=='string'||!/^\d{1,78}$/.test(edge.amount_raw)||BigInt(edge.amount_raw)===0n)throw Error('Invalid diagram');
   indices.add(index);
  }
  const pages=Math.max(1,Math.ceil(entries.length/PAGE));page=Math.min(page,pages-1);
  const edges=entries.slice(page*PAGE,(page+1)*PAGE);
  const addresses=[...new Set(edges.flatMap(({edge})=>[edge.source_owner,edge.destination_owner]))];
  const nodes=addresses.map((address,i)=>({address,label:i+1,
   x:320+245*Math.cos(-Math.PI/2+2*Math.PI*i/addresses.length),
   y:210+150*Math.sin(-Math.PI/2+2*Math.PI*i/addresses.length)}));
  return {page,pages,total:entries.length,nodes,edges};
 }
 function mount(container,initial,{onOwner,onEvidence,synthetic=false}){
  const doc=container.ownerDocument,section=doc.createElement('section');section.className='wallet-network';
  section.setAttribute('aria-label','Wallet DNA relationship diagram');
  container.append(section);let entries=initial,page=0,selected=null;
  const el=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const svgEl=(tag,attributes)=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',tag);
   for(const [k,v]of Object.entries(attributes))e.setAttribute(k,String(v));return e;};
  function render(){
   section.replaceChildren();const model=pageModel(entries,page);page=model.page;
   section.append(el('strong',synthetic?'Synthetic contract test graph · not chain evidence':'Historical saved links · incomplete evidence'),
    el('h6','Explore the saved transfer graph'),
    el('p','Select an owner to filter. Select a link to inspect its original transaction evidence. Node positions show connectivity only, not wealth, influence or common ownership.'));
   const status=el('p',model.total?`Diagram page ${page+1} of ${model.pages} · ${model.edges.length} of ${model.total} matching saved links`:'No links match this filter.');
   status.setAttribute('role','status');section.append(status);
   if(!model.edges.length)return;
   const svg=svgEl('svg',{viewBox:'0 0 640 420',role:'img','aria-label':'Directed owner-address transfer diagram. Corresponding controls follow.'});
   const nodes=new Map(model.nodes.map(n=>[n.address,n]));
   for(const {edge,index}of model.edges){
    const from=nodes.get(edge.source_owner),to=nodes.get(edge.destination_owner);
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
    const x=to.x-ux*22,y=to.y-uy*22;
    svg.append(svgEl('line',{x1:from.x,y1:from.y,x2:x,y2:y,class:index===selected?'selected':'',
     'data-edge-index':index}));
    svg.append(svgEl('polygon',{points:`${x},${y} ${x-ux*12-uy*5},${y-uy*12+ux*5} ${x-ux*12+uy*5},${y-uy*12-ux*5}`,class:index===selected?'selected':''}));
   }
   for(const n of model.nodes){
    svg.append(svgEl('circle',{cx:n.x,cy:n.y,r:20}));
    const text=svgEl('text',{x:n.x,y:n.y+5,'text-anchor':'middle'});text.textContent=n.label;svg.append(text);
   }
   section.append(svg);
   const owners=el('div');owners.className='wallet-network-owners';
   for(const n of model.nodes){
    const button=el('button',`${n.label} · ${n.address.slice(0,6)}…${n.address.slice(-5)}`);button.type='button';
    button.title=n.address;button.setAttribute('aria-label','Filter graph by owner '+n.address);
    button.addEventListener('click',()=>onOwner(n.address));owners.append(button);
   }
   const links=el('div');links.className='wallet-network-links';
   for(const {edge,index}of model.edges){
    const from=nodes.get(edge.source_owner).label,to=nodes.get(edge.destination_owner).label;
    const button=el('button',`Inspect link ${index+1} · owner ${from} → ${to}`);button.type='button';
    button.setAttribute('aria-pressed',String(selected===index));
    button.addEventListener('click',()=>{selected=index;render();onEvidence(index);});links.append(button);
   }
   const pager=el('div');pager.className='wallet-network-pager';
   for(const [label,next,disabled]of [['Previous graph page',page-1,page===0],['Next graph page',page+1,page===model.pages-1]]){
    const button=el('button',label);button.type='button';button.disabled=disabled;
    button.addEventListener('click',()=>{page=next;selected=null;render();section.querySelector('h6').scrollIntoView({block:'nearest'});});pager.append(button);
   }
   section.append(owners,links,pager,el('p','Only saved links are drawn. Missing links and unobserved wallets remain unknown. Raw amounts and timestamps are in the evidence cards below.'));
  }
  render();return {update(next){entries=next;page=0;selected=null;render();}};
 }
 const api={pageModel,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RadarWalletNetwork=api;
})(typeof window!=='undefined'?window:globalThis);
