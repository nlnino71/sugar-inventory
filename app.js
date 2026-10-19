
import { stockReport, matchingIssues, changeSummary, clientDirectory, threshold } from './features.js';
import { createClient } from '@supabase/supabase-js';
(async function(){
'use strict';
/* ---------- helpers ---------- */
const $ = (s,r=document)=>r.querySelector(s);
const esc = s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf = n=>(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pad = n=>String(n).padStart(2,'0');
const today = ()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const M3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fd = s=>{ if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(s)) return esc(s||''); const p=s.split('-'); return (+p[2])+' '+M3[p[1]-1]+' '+p[0]; };
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const DEFAULT_TYPES=['Raw Sugar','Refined Sugar','Washed Sugar'];

/* ---------- storage ---------- */
const publicToken=new URLSearchParams(window.location.hash.slice(1)).get('view');
const slugPath=(window.location.pathname||'/').startsWith('/view/');
const publicSlug=slugPath?(window.location.pathname.split('/')[2]||''):'';
const validSlug=value=>value.length>=3&&value.length<=64&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const readOnly=!!publicToken||slugPath;
let shareSettings=null, shareError='', accountId=null;
let authMode='signin', authBusy=false;
const KEY='sugar-inventory.v1';
const blank = ()=>({unit:'bags (LKg)',receipts:[],issues:[],clients:[],seq:0,clientProfiles:{},activity:[],lowStockPercent:20});
let S=blank(), committed=structuredClone(S), revision=0, saving=false, ready=false;
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db=url&&key?createClient(url,key):null;
function lock(on){ document.body.inert=on; $('#cloudStatus').textContent=on?'Saving…':(readOnly?'Public view · Read only':ready?'Saved to Supabase':'Sign in to continue'); }
async function readCloud(){
  const {data,error}=await db.from('inventory').select('data,revision').eq('owner_id',accountId).single();
  if(error) throw error;
  S=Object.assign(blank(),data.data); revision=data.revision; committed=structuredClone(S);
}
async function save(){
  if(!ready||saving||readOnly) return false;
  saving=true; lock(true);
  const next=structuredClone(S);
  const summary=changeSummary(committed,next);
  if(summary) next.activity=[{id:uid(),at:new Date().toISOString(),summary},...(committed.activity||[])].slice(0,200);
  try {
    const {data,error}=await db.rpc('save_inventory',{expected_revision:revision,new_data:next});
    if(error) throw error;
    if(data===null) {
      await readCloud(); render();
      toast('Inventory changed on another device. Latest records loaded; please reapply your edit.');
      return false;
    }
    revision=data; S=next; committed=structuredClone(next); return true;
  } catch(error){
    S=structuredClone(committed); render();
    toast('Save failed. Your change was not confirmed: '+error.message); return false;
  } finally { saving=false; lock(false); }
}
async function showAccount(session){
  document.body.classList.toggle('login-screen',!session);
  if(accountId!==(session?.user?.id||null)){tab='dashboard';q='';rq='';clientQuery='';deliveryFilter={query:'',from:'',to:'',client:''};}
  accountId=session?.user?.id||null;shareSettings=null;shareError='';revision=0;
  ready=false; closeSheet(true); S=blank();committed=structuredClone(S); render();
  $('#account').hidden=false; $('#nav').hidden=true;
  if(!session){ lock(false); $('#main').hidden=true; $('#accountMessage').textContent='Sign in with your inventory account.'; return; }
  try { const {error:setupError}=await db.rpc('ensure_inventory');if(setupError)throw setupError; await readCloud(); ready=true; $('#main').hidden=false; $('#account').hidden=true; $('#nav').hidden=false; render(); }
  catch(error){ $('#main').hidden=true; $('#accountMessage').textContent=(error.code==='PGRST116'||error.code==='42501')?'Your private inventory could not be opened. Select Refresh to retry. If this continues, ask the site owner to finish the account-inventories database upgrade.':'Could not load inventory. Select Refresh to retry. '+error.message; }
  lock(false);
}

/* ---------- calculations ---------- */
function compute(){
  const by=Object.create(null);
  S.receipts.forEach(r=>{
    const o=by[r.sro]||(by[r.sro]={sro:r.sro,date:r.date,type:r.type,mill:r.mill,crop:r.crop||'',received:0,issued:0,lines:[],rids:[]});
    o.received+=+r.qty||0; o.rids.push(r.id);
  });
  const sorted=[...S.issues].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.seq-b.seq);
  const orphans=[], run=Object.create(null);
  sorted.forEach(i=>{ const o=by[i.sro]; if(o){ o.issued+=+i.qty||0; o.lines.push(i);} else orphans.push(i); });
  const list=Object.values(by);
  list.forEach(o=>{ let r=o.received; o.lines.forEach(l=>{ r-=+l.qty||0; run[l.id]=r; }); o.balance=o.received-o.issued; });
  return {by,list,orphans,run,sorted};
}
function status(o){
  if(o.balance<0) return {k:'over',t:'Over-issued'};
  if(o.balance===0) return {k:'empty',t:'Fully issued'};
  if(o.received>0 && o.balance/o.received<=threshold(S)/100) return {k:'low',t:'Low'};
  return {k:'ok',t:'In stock'};
}
function gauge(o){
  const pct=o.received>0?Math.max(0,Math.min(100,o.balance/o.received*100)):0;
  const s=status(o); return '<div class="gauge '+(s.k==='low'?'low':s.k==='over'?'over':'')+'"><i style="width:'+pct+'%"></i></div>';
}
function clientStats(){
  const m=Object.create(null);
  S.issues.forEach(i=>{ const n=(i.client||'').trim()||'(no client)';
    const c=m[n]||(m[n]={name:n,total:0,lines:0,atw:new Set(),bySro:Object.create(null),items:[],last:''});
    c.total+=+i.qty||0; c.lines++; if(i.atw) c.atw.add(i.atw); c.bySro[i.sro]=(c.bySro[i.sro]||0)+(+i.qty||0); c.items.push(i);
    if(i.date>c.last) c.last=i.date; });
  return Object.values(m).sort((a,b)=>b.total-a.total);
}
function typeStats(c){
  const m=Object.create(null); const T=n=>m[n]||(m[n]={name:n,received:0,issued:0});
  c.list.forEach(o=>{ T(o.type||'(no type)').received+=o.received; });
  S.issues.forEach(i=>{ const o=c.by[i.sro]; T(i.type||(o&&o.type)||'(no type)').issued+=+i.qty||0; });
  return Object.values(m).sort((a,b)=>b.received-a.received);
}
const knownClients=()=>[...new Set([...S.clients,...S.issues.map(i=>(i.client||'').trim())].filter(Boolean))].sort();
const knownTypes=()=>[...new Set([...DEFAULT_TYPES,...S.receipts.map(r=>r.type),...S.issues.map(i=>i.type)].filter(Boolean))];
const cropOf=d=>{ const y=+String(d||today()).slice(0,4), m=+String(d||today()).slice(5,7); const a=m>=9?y:y-1; return a+'-'+(a+1); };
const knownCrops=()=>[...new Set([cropOf(today()),...S.receipts.map(r=>r.crop)].filter(Boolean))].sort().reverse();
const knownMills=()=>[...new Set(S.receipts.map(r=>r.mill).filter(Boolean))].sort();

/* ---------- ui state ---------- */
let tab='dashboard', filter='all', q='';
const TITLES={dashboard:'Overview',stock:'Stock',receive:'SRO Quantity',issue:'Issuance',clients:'Clients',reports:'Reports',more:'More'};
const ICON={
 dashboard:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
 reports:'<svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h8"/></svg>',
 stock:'<svg viewBox="0 0 24 24"><rect x="4" y="12" width="4" height="8"/><rect x="10" y="7" width="4" height="13"/><rect x="16" y="4" width="4" height="16"/></svg>',
 receive:'<svg viewBox="0 0 24 24"><path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 15v4h16v-4"/></svg>',
 issue:'<svg viewBox="0 0 24 24"><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M4 15v4h16v-4"/></svg>',
 clients:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 5.5a3 3 0 010 5.5"/><path d="M18 14.5c2 .7 3 2.7 3 5.5"/></svg>',
 more:'<svg viewBox="0 0 24 24"><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/></svg>'
};
function renderNav(){
  $('#nav').innerHTML='<div class="nav-brand"><img src="/app-icon.svg" width="44" height="44" alt="">Sugar Inventory<small>'+ (readOnly?'Shared inventory':'Inventory workspace')+'</small></div>'+Object.keys(TITLES).filter(k=>!readOnly||['dashboard','stock','issue','reports'].includes(k)).map(k=>'<button class="'+(!readOnly&&['receive','clients','reports','more'].includes(k)?'nav-overflow':'')+'" data-act="tab" data-tab="'+k+'"'+(k===tab?' aria-current="page"':'')+'>'+ICON[k]+'<span>'+(k==='receive'?'SRO Qty':TITLES[k])+'</span></button>').join('')+(!readOnly?'<button class="nav-menu" data-act="navMenu" aria-haspopup="dialog"'+(['receive','clients','reports','more'].includes(tab)?' aria-current="page"':'')+'><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span></button>':'');
}
function render(){
  document.body.classList.toggle('workspace',ready);
  $('#main').dataset.view=tab;
  $('#title').textContent=TITLES[tab]; $('#unitLbl').textContent='Unit: '+S.unit;
  renderNav();
  $('#main').innerHTML=({dashboard:vDashboard,reports:vReports,stock:vStock,receive:vReceive,issue:vIssue,clients:vClients,more:vMore})[tab]();
  if(tab==='stock') updateList();
  if(tab==='receive') updateRList();
  if(readOnly){
    document.body.classList.add('public-view');
    restrictPublicControls();
  }
}

/* ---------- views ---------- */
function vStock(){
  const c=compute();
  if(!c.list.length && !c.orphans.length){
    if(readOnly)return '<div class="empty"><b>No stock yet</b>The owner has not added stock to this inventory.</div>';
    return '<div class="empty"><b>No stock yet</b>Add your first SRO quantity, or load sample data to see how the app works.'+
      '<div class="btns"><button class="btn primary" data-act="newReceipt">Add SRO quantity</button><button class="btn" data-act="sample">Load sample data</button></div></div>';
  }
  const over=c.list.filter(o=>o.balance<0).length;
  let h='';
  const msgs=[];
  if(over) msgs.push(over+' SRO'+(over>1?'s are':' is')+' over-issued');
  if(c.orphans.length) msgs.push(c.orphans.length+' issuance line'+(c.orphans.length>1?'s refer':' refers')+' to an SRO that is not in SRO Quantity');
  if(msgs.length) h+='<div class="alert" style="margin-top:0">'+esc(msgs.join('. '))+'. Check the Issuance tab.</div>';
  const ts=typeStats(c);
  h+='<div class="sec" style="margin-top:'+(msgs.length?'18px':'0')+'"><h2>Total per type of sugar</h2></div><div class="type-grid">'+ts.map(t=>{
    const b=t.received-t.issued, p=t.received>0?Math.max(0,Math.min(100,b/t.received*100)):0;
    return '<div class="typeCard"><div class="row"><span class="tname">'+esc(t.name)+'</span><span class="tbal"><b class="num">'+nf(b)+'</b><span>balance</span></span></div>'+
      '<div class="gauge"><i style="width:'+p+'%"></i></div>'+
      '<div class="nums"><div><span>Received</span><b>'+nf(t.received)+'</b></div><div><span>Issued</span><b>'+nf(t.issued)+'</b></div><div><span>Left</span><b>'+Math.round(p)+'%</b></div></div></div>';
  }).join('')+'</div>';
  h+='<div class="sec"><h2>Running balance per SRO, by sugar type</h2><span class="hint">'+c.list.length+' total</span></div>'+
    '<div class="search"><input id="q" aria-label="Search stock by SRO, type or mill" type="search" placeholder="Search SRO, type, mill" value="'+esc(q)+'" autocomplete="off"></div>'+
    '<div class="chips" id="chips"></div><div id="sroList"></div>';
  return h;
}
function updateList(){
  const box=$('#sroList'); if(!box) return;
  const c=compute();
  const F=[['all','All'],['ok','In stock'],['low','Low'],['empty','Fully issued'],['over','Over-issued']];
  $('#chips').innerHTML=F.map(f=>'<button class="chip-b" data-act="filter" data-f="'+f[0]+'" aria-pressed="'+(filter===f[0])+'">'+f[1]+'</button>').join('');
  const needle=q.trim().toLowerCase();
  const rows=c.list.filter(o=>(filter==='all'||status(o).k===filter)&&(!needle||(o.sro+' '+o.type+' '+o.mill).toLowerCase().includes(needle)))
    .sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:a.sro<b.sro?1:-1);
  const card=o=>{
    const s=status(o), p=o.received>0?Math.max(0,Math.round(o.balance/o.received*100)):0;
    return '<button class="card" data-act="sro" data-id="'+esc(o.sro)+'"><div class="row"><span class="sro-no">'+esc(o.sro)+'</span><span class="chip '+s.k+'">'+s.t+'</span></div>'+
      '<div class="sub">'+esc(o.mill||'No mill')+' · '+fd(o.date)+'</div>'+gauge(o)+'<div class="pct">'+p+'% left</div>'+
      '<div class="nums"><div><span>Received</span><b>'+nf(o.received)+'</b></div><div><span>Issued</span><b>'+nf(o.issued)+'</b></div><div class="bal"><span>Balance</span><b>'+nf(o.balance)+'</b></div></div></button>';
  };
  if(!rows.length){ box.innerHTML='<div class="empty">No SRO matches.</div>'; return; }
  const groups=Object.create(null); rows.forEach(o=>{ const k=o.type||'(no type)'; (groups[k]||(groups[k]=[])).push(o); });
  const order=typeStats(c).map(t=>t.name);
  const names=Object.keys(groups).sort((x,y)=>{ const i=order.indexOf(x), j=order.indexOf(y); return (i<0?99:i)-(j<0?99:j); });
  box.innerHTML=names.map(n=>{
    const g=groups[n], bal=g.reduce((t,o)=>t+o.balance,0);
    return '<div class="grp"><span class="gname">'+esc(n)+'</span><span class="gmeta">'+g.length+' SRO'+(g.length>1?'s':'')+' · balance '+nf(bal)+'</span></div>'+g.map(card).join('');
  }).join('');
}

function grouped(c,items,typeOf,qtyOf,noun,cardFn){
  const G=Object.create(null); items.forEach(x=>{ const k=typeOf(x)||'(no type)'; (G[k]||(G[k]=[])).push(x); });
  const order=typeStats(c).map(t=>t.name);
  return Object.keys(G).sort((a,b)=>{ const i=order.indexOf(a), j=order.indexOf(b); return (i<0?99:i)-(j<0?99:j); }).map(n=>{
    const g=G[n], tot=g.reduce((t,x)=>t+qtyOf(x),0), pl=noun==='delivery'?'deliveries':noun+'s';
    return '<div class="grp"><span class="gname">'+esc(n)+'</span><span class="gmeta">'+g.length+' '+(g.length===1?noun:pl)+' · total '+nf(tot)+'</span></div><div class="delivery-grid">'+g.map(cardFn).join('')+'</div>';
  }).join('');
}
let rq='', rcrop='all', rtype='all';
function vReceive(){
  const c=compute();
  const h0='<button class="btn primary block" data-act="newReceipt">New SRO quantity</button>';
  if(!S.receipts.length) return h0+'<div class="empty" style="margin-top:14px"><b>No SRO quantities</b>Log each SRO and its quantity when the sugar is received.</div>';
  return h0+'<div class="sec"><h2>SRO register</h2><span class="hint">'+S.receipts.length+' logged</span></div>'+
    '<div class="tcards" id="rcards"></div>'+
    '<div class="search"><input id="rq" aria-label="Search SRO quantities by SRO, mill or crop year" type="search" placeholder="Search SRO, mill, crop year" value="'+esc(rq)+'" autocomplete="off"></div><div class="chips" id="rchips"></div><div id="rList"></div>';
}
function updateRList(){
  const box=$('#rList'); if(!box) return;
  const crops=[...new Set(S.receipts.map(r=>r.crop).filter(Boolean))].sort().reverse();
  if(rcrop!=='all'&&crops.indexOf(rcrop)<0) rcrop='all';
  $('#rchips').innerHTML=(crops.length?[['all','All crop years']].concat(crops.map(x=>[x,'CY '+x])):[]).map(f=>'<button class="chip-b" data-act="rcrop" data-c="'+esc(f[0])+'" aria-pressed="'+(rcrop===f[0])+'">'+esc(f[1])+'</button>').join('');
  const base=S.receipts.filter(r=>rcrop==='all'||r.crop===rcrop);
  const T=Object.create(null); base.forEach(r=>{ const k=r.type||'(no type)'; const t=T[k]||(T[k]={name:k,n:0,q:0}); t.n++; t.q+=+r.qty||0; });
  if(rtype!=='all'&&!T[rtype]) rtype='all';
  const ord=typeStats(compute()).map(t=>t.name);
  $('#rcards').innerHTML=Object.values(T).sort((x,y)=>ord.indexOf(x.name)-ord.indexOf(y.name)).map(t=>
    '<button class="tc'+(rtype===t.name?' on':'')+'" data-act="rtype" data-t="'+esc(t.name)+'" aria-pressed="'+(rtype===t.name)+'"><b>'+esc(t.name)+'</b><span class="num">'+nf(t.q)+'</span><small>'+t.n+' SRO'+(t.n>1?'s':'')+(rtype===t.name?' · showing':' · tap to view')+'</small></button>').join('')+
    (rtype!=='all'?'<button class="tc all" data-act="rtype" data-t="all"><b>Show all</b><small>sugar types</small></button>':'');
  const needle=rq.trim().toLowerCase();
  const rows=S.receipts.filter(r=>(rtype==='all'||(r.type||'(no type)')===rtype)&&(rcrop==='all'||r.crop===rcrop)&&(!needle||[r.sro,r.mill,r.crop,r.type].join(' ').toLowerCase().includes(needle)))
    .sort((x,y)=>String(x.sro).localeCompare(String(y.sro),undefined,{numeric:true,sensitivity:'base'}));
  if(!rows.length){ box.innerHTML='<div class="empty">No SRO matches.</div>'; return; }
  const G=Object.create(null); rows.forEach(r=>{ const k=r.type||'(no type)'; (G[k]||(G[k]=[])).push(r); });
  const order=typeStats(compute()).map(t=>t.name);
  box.innerHTML=Object.keys(G).sort((x,y)=>{ const i=order.indexOf(x), j=order.indexOf(y); return (i<0?99:i)-(j<0?99:j); }).map(n=>{
    const g=G[n], tot=g.reduce((t,r)=>t+(+r.qty||0),0);
    return '<div class="grp"><span class="gname">'+esc(n)+'</span><span class="gmeta">'+g.length+' SRO'+(g.length>1?'s':'')+' · total '+nf(tot)+'</span></div>'+
      '<div class="reg"><div class="rh"><span>SRO number</span><span>Crop yr</span><span>Quantity</span></div>'+
      g.map(r=>{ const dup=S.receipts.filter(x=>x.sro===r.sro).length>1;
        return '<button class="rr" data-act="editReceipt" data-id="'+esc(r.id)+'"><span class="a"><b>'+esc(r.sro)+'</b><small>'+esc(r.mill||'No mill')+' · '+fd(r.date).replace(/ \d{2}(\d{2})$/," '$1")+'</small>'+(dup?'<small class="bad">Duplicate SRO number</small>':'')+'</span><span class="b">'+esc(r.crop||'-')+'</span><span class="c num">'+nf(r.qty)+'</span></button>'; }).join('')+
      '<div class="rs"><span>'+esc(n)+' subtotal</span><span class="num">'+nf(tot)+'</span></div></div>';
  }).join('');
}

function issueGroups(c,items=S.issues){
  const g=Object.create(null);
  [...items].forEach(i=>{ const k=[i.date,i.atw,i.sro,i.client,i.waybill].join('|'); (g[k]||(g[k]={key:k,date:i.date,atw:i.atw,sro:i.sro,client:i.client,permit:i.permit,waybill:i.waybill,bol:i.bol,vessel:i.vessel,voy:i.voy,sail:i.sail,type:i.type,items:[],seq:0})).items.push(i); g[k].seq=Math.max(g[k].seq,i.seq); });
  return Object.values(g).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:b.seq-a.seq);
}
function vIssue(){
  const c=compute();
  let h='<button class="btn primary block" data-act="newIssue">New issuance</button>'+deliveryFilters()+'<div class="sec"><h2>Deliveries by sugar type</h2><span class="hint">'+S.issues.length+' batch lines</span></div>';
  if(!S.issues.length) return h+'<div class="empty"><b>Nothing issued yet</b>Record each delivery with its ATW, waybill and batch codes.</div>';
  const matches=matchingIssues(S.issues,deliveryFilter);
  if(!matches.length) return h+'<div class="empty">No deliveries match these filters.</div>';
  return h+grouped(c,issueGroups(c,matches),g=>g.type,g=>g.items.reduce((a,i)=>a+(+i.qty||0),0),'delivery',g=>{
    const tot=g.items.reduce((a,i)=>a+(+i.qty||0),0), missing=!c.by[g.sro];
    return '<div class="card"><div class="row"><span class="sro-no">'+esc(g.atw||'No ATW no.')+'</span><span class="sub" style="margin:0">'+fd(g.date)+'</span></div>'+
      '<div class="sub" style="margin-bottom:4px">'+esc(g.client||'No client')+' · '+esc(g.sro)+'</div>'+
      (missing?'<div class="err" style="margin:0 0 4px">This SRO is not in SRO Quantity.</div>':'')+
      '<div class="kv"><span>Permit <b>'+esc(g.permit||'-')+'</b></span><span>Waybill <b>'+esc(g.waybill||'-')+'</b></span></div>'+
      ((g.bol||g.vessel||g.voy||g.sail)?'<div class="kv"><span>B/L <b>'+esc(g.bol||'-')+'</b></span><span>Vessel <b>'+esc(g.vessel||'-')+(g.voy?' / '+esc(g.voy):'')+'</b></span><span>Sails <b>'+(g.sail?fd(g.sail):'-')+'</b></span></div>':'')+
      '<div class="lines">'+g.items.map(i=>'<button class="line" data-act="editIssue" data-id="'+esc(i.id)+'"><span>'+esc(i.batch||'No batch code')+'</span><b>'+nf(i.qty)+'</b></button>').join('')+'</div>'+
      '<div class="tot"><span>Total</span><span class="num" style="font-size:19px">'+nf(tot)+'</span></div></div>';
  });
}

let visibleClients=[];
function vClients(){
 const clients=visibleClients=clientDirectory(S);
 return '<div class="btns"><button class="btn primary" data-act="newClient">Add client</button></div><label class="f">Find a client<input id="clientQuery" type="search" value="'+esc(clientQuery)+'" placeholder="Name, contact, phone or email"></label><p class="hint">'+clients.length+' clients · '+nf(clients.reduce((n,c)=>n+c.total,0))+' '+esc(S.unit)+' issued</p><div id="clientResults">'+clientResults()+'</div>';
}
function clientResults(){
 const clients=visibleClients, needle=clientQuery.toLowerCase();
 const rows=clients.filter(c=>[c.name,c.contact,c.phone,c.email].join(' ').toLowerCase().includes(needle));
 return !rows.length?(clients.length?'<div class="empty" role="status">No clients match this search. Try another name, contact, phone or email.</div>':'<div class="empty"><b>Your client directory is empty</b>Add a client to keep contact details and delivery history together.</div>'):rows.map(c=>'<article class="card"><div class="row"><strong>'+esc(c.name)+'</strong><b class="num">'+nf(c.total)+'</b></div><p class="sub">'+esc([c.contact,c.phone,c.email].filter(Boolean).join(' · ')||'No contact details')+'</p><p class="hint">'+c.lines+' batch lines'+(c.last?' · Last delivery '+fd(c.last):' · No deliveries yet')+'</p><div class="btns"><button class="btn" data-act="editClient" data-name="'+esc(c.name)+'">Edit details</button>'+(c.lines?'<button class="btn" data-act="client" data-name="'+esc(c.name)+'">Delivery history</button>':'')+'</div></article>').join('');
}

let DL={async save({filename,data}){
 const blob=new Blob([data],{type:filename.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':filename.endsWith('.json')?'application/json':'text/csv;charset=utf-8'});
 const href=URL.createObjectURL(blob),a=document.createElement('a'); a.href=href; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(href),1000);
}};
function vMore(){
  const dl=!!DL;
  return sharingPanel()+'<div class="setting"><h2>Inventory preferences</h2><label class="f">Low-stock alert (% remaining)<input id="lowStockPercent" type="number" min="0" max="100" value="'+threshold(S)+'"></label><label class="f">Appearance<select id="appearance"><option value="auto">Use device setting</option><option value="light"'+(document.documentElement.dataset.theme==='light'?' selected':'')+'>Light</option><option value="dark"'+(document.documentElement.dataset.theme==='dark'?' selected':'')+'>Dark</option></select></label><label class="f">Quantity unit<input id="unit" value="'+esc(S.unit)+'" maxlength="24"></label><p>Shown next to totals. The app does not convert units.</p></div>'+
   '<div class="sec"><h2>Export</h2></div><div class="setting"><div class="stack">'+
   '<button class="btn block" data-act="xlsx"'+(dl?'':' disabled')+'>Excel workbook (.xlsx)</button>'+
   '<button class="btn block" data-act="csvRec"'+(dl?'':' disabled')+'>SRO Quantity (.csv)</button>'+
   '<button class="btn block" data-act="csvIss"'+(dl?'':' disabled')+'>Issuance (.csv)</button></div>'+
   '<p>The workbook opens with a Dashboard summary (totals per sugar type, running balance per SRO, issued per client, data checks), followed by SRO Quantity, Issuance with running balance, SRO Balance and Client Summary sheets.'+(dl?'':' Downloads are not available in this view.')+'</p></div>'+
   '<div class="sec"><h2>Backup and import</h2></div><div class="setting"><div class="stack">'+
   '<button class="btn block" data-act="backup"'+(dl?'':' disabled')+'>Save backup (.json)</button>'+
   '<button class="btn block" data-act="restore">Restore from backup</button>'+
   '<button class="btn block" data-act="import">Import SRO quantity or issuance CSV</button></div>'+
   '<p>CSV columns must match the Excel inventory file: SRO Date, SRO Number, Type of Sugar, Mill Source, Quantity for SRO quantity; Date, SRO Number, Ref ATW Number, Type of Sugar, Client, SRA Permit No., Mill Waybill Number, Batch Codes, Quantity per Batch Code for issuance, plus optional Bill of Lading No., Vessel, Voy No., Sailing Date.</p></div>'+
   '<div class="sec"><h2>Data</h2></div><div class="setting"><div class="stack"><button class="btn block" data-act="sample">Load sample data</button><button class="btn danger block" data-act="clear">Delete all data</button></div>'+
   '<p>Your records are saved to your private Supabase inventory. Public links are read-only and controlled by you. Export backups regularly.</p></div>';
}

/* ---------- sheet / dialog / toast ---------- */
let sheetTrigger=null, confirmationTrigger=null, priorBodyOverflow=null;
const priorInert=new Map();
const modalOpen=id=>$('#'+id).classList.contains('on');
function syncModalLayers(){
 const active=modalOpen('dlg')?$('#dlg'):modalOpen('sheet')?$('#sheet'):null;
 if(active){
  if(priorBodyOverflow===null){priorBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
  for(const el of document.body.children){
   if(['sheet','dlg','scrim','toast'].includes(el.id)||el.tagName==='SCRIPT')continue;
   if(!priorInert.has(el))priorInert.set(el,el.inert);
   el.inert=true;
  }
 }else{
  for(const [el,inert] of priorInert)el.inert=inert;
  priorInert.clear();
  if(priorBodyOverflow!==null){document.body.style.overflow=priorBodyOverflow;priorBodyOverflow=null;}
 }
 $('#sheet').inert=modalOpen('dlg');
 $('#scrim').classList.toggle('on',!!active);
}
function restoreFocus(trigger){
 if(trigger?.isConnected&&!trigger.closest('[inert]')&&trigger.getClientRects().length){trigger.focus({preventScroll:true});return;}
 const fallback=ready?$('#main'):$('#account');
 if(!fallback.hidden)fallback.focus({preventScroll:true});
}
function openSheet(html){
 if(!modalOpen('sheet'))sheetTrigger=document.activeElement;
 const sheet=$('#sheet');sheet.innerHTML=html;
 if(readOnly)restrictPublicControls();
 sheet.classList.add('on');sheet.scrollTop=0;syncModalLayers();
 const initial=sheet.querySelector('form input:not([type="hidden"])')||sheet.querySelector('#sheetTitle')||sheet;
 initial.focus({preventScroll:true});
}
function closeSheet(force=false){
 if(modalOpen('dlg')){$('#dNo')?.click();if(!force)return;}
 const wasOpen=modalOpen('sheet'),trigger=sheetTrigger;
 $('#sheet').classList.remove('on');$('#sheet').innerHTML='';sheetTrigger=null;syncModalLayers();
 if(wasOpen)queueMicrotask(()=>restoreFocus(trigger));
}
function modalKeyboard(e){
 const active=modalOpen('dlg')?$('#dlg'):modalOpen('sheet')?$('#sheet'):null;
 if(!active)return;
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!saving){if(modalOpen('dlg'))$('#dNo').click();else closeSheet();}return;}
 if(e.key!=='Tab')return;
 const stops=[...active.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length&&!el.closest('[inert]'));
 const current=stops.indexOf(document.activeElement);
 if(!stops.length){e.preventDefault();active.focus();}
 else if(e.shiftKey&&current<=0){e.preventDefault();stops.at(-1).focus();}
 else if(!e.shiftKey&&(current<0||current===stops.length-1)){e.preventDefault();stops[0].focus();}
}
let toastT; function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),3200); }
function ask(title,msg,okLabel,danger){
 return new Promise(res=>{
  const d=$('#dlg');confirmationTrigger=document.activeElement;let settled=false;
  d.innerHTML='<h3 id="dialogTitle" style="font-family:var(--display);font-size:22px;margin:0 0 6px">'+esc(title)+'</h3><p id="dialogDescription">'+esc(msg)+'</p><div class="btns"><button class="btn" id="dNo">Cancel</button><button class="btn '+(danger?'danger':'primary')+'" id="dYes">'+esc(okLabel)+'</button></div>';
  d.classList.add('on');syncModalLayers();
  const done=value=>{
   if(settled)return;settled=true;const trigger=confirmationTrigger;confirmationTrigger=null;
   d.classList.remove('on');d.innerHTML='';syncModalLayers();restoreFocus(trigger);res(value);
  };
  $('#dNo').onclick=()=>done(false);$('#dYes').onclick=()=>done(true);$('#dNo').focus();
 });
}
const sheetHead=(t,sub)=>'<div class="head"><div><h3 id="sheetTitle" tabindex="-1">'+esc(t)+'</h3>'+(sub?'<div class="sub" style="margin:4px 0 0">'+sub+'</div>':'')+'</div><button class="x" data-act="close" aria-label="Close">×</button></div>';
const ledgerAction=(act,id,label)=>readOnly?'':'<td><button type="button" class="ledger-edit" data-act="'+act+'" data-id="'+esc(id)+'" aria-label="'+esc(label)+'">Edit</button></td>';
function formError(form,message,fields=[]){
 const error=form.querySelector('#err');error.textContent=message;
 const controls=fields.flatMap(field=>typeof field==='string'?[...form.querySelectorAll('[name="'+field+'"]')]:[field]);
 controls.forEach(control=>{control.setAttribute('aria-invalid','true');control.setAttribute('aria-describedby','err');});
 (controls.find(control=>!control.value.trim())||controls[0]||error).focus();
}
function clearFormError(form){form.querySelectorAll('[aria-invalid]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');});}

/* ---------- SRO detail ---------- */
function sroSheet(id){
  const c=compute(), o=c.by[id]; if(!o) return;
  const s=status(o), rcp=S.receipts.find(r=>r.sro===id);
  let rows='<tr><td>'+fd(o.date)+'</td><td>SRO quantity<small>'+esc(o.mill||'')+'</small></td><td class="r"><b>+'+nf(o.received)+'</b></td><td class="r"><b>'+nf(o.received)+'</b></td>'+ledgerAction('editReceipt',rcp?rcp.id:'','Edit SRO quantity '+o.sro)+'</tr>';
  rows+=o.lines.map(l=>'<tr><td>'+fd(l.date)+'</td><td>'+esc(l.client||'No client')+'<small>'+esc((l.atw||'')+(l.batch?' · '+l.batch:''))+'</small></td><td class="r"><b>−'+nf(l.qty)+'</b></td><td class="r"><b'+(c.run[l.id]<0?' style="color:var(--alert)"':'')+'>'+nf(c.run[l.id])+'</b></td>'+ledgerAction('editIssue',l.id,'Edit issuance '+(l.batch||l.atw||l.id))+'</tr>').join('');
  openSheet(sheetHead(o.sro,esc(o.type||'No type')+' · '+esc(o.mill||'No mill'))+
    gauge(o)+'<div class="nums"><div><span>Received</span><b>'+nf(o.received)+'</b></div><div><span>Issued</span><b>'+nf(o.issued)+'</b></div><div class="bal"><span>Balance</span><b>'+nf(o.balance)+'</b></div></div>'+
    '<div style="margin-top:8px"><span class="chip '+s.k+'">'+s.t+'</span></div>'+
    '<div class="btns"><button class="btn primary" data-act="newIssue" data-sro="'+esc(id)+'">Issue from this SRO</button></div>'+
    '<div class="sec" style="margin-top:18px"><h2>Ledger</h2><span class="hint">'+(readOnly?'Stock movements':'Use Edit to update a record')+'</span></div>'+
    '<div class="tabwrap" tabindex="0" role="region" aria-label="Stock ledger"><table class="led"><thead><tr><th>Date</th><th>Details</th><th class="r">Qty</th><th class="r">Balance</th>'+(!readOnly?'<th scope="col">Action</th>':'')+'</tr></thead><tbody>'+rows+'</tbody></table></div>');
}

/* ---------- receipt form ---------- */
const dl=(id,arr)=>'<datalist id="'+id+'">'+arr.map(v=>'<option value="'+esc(v)+'">').join('')+'</datalist>';
function receiptSheet(id){
  const r=id?S.receipts.find(x=>x.id===id):null;
  openSheet(sheetHead(r?'Edit SRO quantity':'New SRO quantity')+
   '<form id="fRec" data-id="'+esc(r?r.id:'')+'" novalidate>'+
   '<label class="f">SRO date<input type="date" name="date" value="'+esc(r?r.date:today())+'" required></label>'+
   '<label class="f">Crop year<input name="crop" list="dlCrop" value="'+esc(r?(r.crop||''):cropOf(today()))+'" placeholder="e.g. 2026-2027" autocomplete="off"></label>'+
   '<label class="f">SRO number<input name="sro" value="'+esc(r?r.sro:'')+'" autocomplete="off" required></label>'+
   '<label class="f">Type of sugar<input name="type" list="dlTypes" value="'+esc(r?r.type:'')+'" autocomplete="off"></label>'+
   '<label class="f">Mill source<input name="mill" list="dlMills" value="'+esc(r?r.mill:'')+'" autocomplete="off"></label>'+
   '<label class="f">Quantity<input name="qty" type="number" inputmode="decimal" step="any" min="0" value="'+esc(r?r.qty:'')+'" required></label>'+
   dl('dlTypes',knownTypes())+dl('dlMills',knownMills())+dl('dlCrop',knownCrops())+
   '<div class="err" id="err" role="alert" tabindex="-1"></div><div class="btns">'+(r?'<button type="button" class="btn danger" data-act="delReceipt" data-id="'+esc(r.id)+'">Delete</button>':'')+'<button type="submit" class="btn primary">Save SRO quantity</button></div></form>');
}
async function saveReceipt(f){
  const v=n=>f.elements[n].value.trim(), id=f.dataset.id, err=$('#err');
  clearFormError(f);
  const rec={date:v('date'),crop:v('crop'),sro:v('sro'),type:v('type'),mill:v('mill'),qty:parseFloat(v('qty'))};
  if(!rec.date||!rec.sro||!Number.isFinite(rec.qty)||rec.qty<0){formError(f,'Enter the date, SRO number and a finite quantity of zero or more.',[!rec.date&&'date',!rec.sro&&'sro',(!Number.isFinite(rec.qty)||rec.qty<0)&&'qty'].filter(Boolean));return;}
  const dup=S.receipts.some(r=>r.sro===rec.sro&&r.id!==id);
  if(dup && !(await ask('Duplicate SRO number',rec.sro+' is already in SRO Quantity. Each SRO should be logged once. Save anyway?','Save anyway'))) return;
  if(id){
    const r=S.receipts.find(x=>x.id===id);
    if(r.sro!==rec.sro){ const n=S.issues.filter(i=>i.sro===r.sro).length; if(n) S.issues.forEach(i=>{ if(i.sro===r.sro) i.sro=rec.sro; }); }
    Object.assign(r,rec);
  } else S.receipts.push(Object.assign({id:uid()},rec));
  if(!await save()) return; closeSheet(); render(); toast('SRO quantity saved');
}

/* ---------- issue form ---------- */
function batchRow(code,qty){
  return '<div class="batch"><input name="bcode" aria-label="Batch code" placeholder="Batch code" value="'+esc(code||'')+'" autocomplete="off"><input name="bqty" aria-label="Batch quantity" type="number" inputmode="decimal" step="any" min="0" placeholder="Qty" value="'+esc(qty==null?'':qty)+'"><button type="button" data-act="rmBatch" aria-label="Remove batch code">×</button></div>';
}
function issueSheet(opt){
  opt=opt||{}; const c=compute(), e=opt.edit||null;
  const list=[...c.list].sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  const sel=e?e.sro:(opt.sro||'');
  const orphanOpt=(e&&!c.by[e.sro])?'<option value="'+esc(e.sro)+'" selected>'+esc(e.sro)+' (not in SRO Quantity)</option>':'';
  openSheet(sheetHead(e?'Edit issuance line':'New issuance')+
   '<form id="fIss" data-id="'+esc(e?e.id:'')+'" novalidate>'+
   '<label class="f">Date<input type="date" name="date" value="'+esc(e?e.date:today())+'" required></label>'+
   '<label class="f">SRO number<select name="sro" required><option value="">Select SRO</option>'+orphanOpt+
     list.map(o=>'<option value="'+esc(o.sro)+'"'+(o.sro===sel?' selected':'')+'>'+esc(o.sro)+' · '+esc(o.type||'')+' · '+nf(o.balance)+' left</option>').join('')+'</select></label>'+
   '<div class="info" id="info">Select an SRO to see its type and balance.</div>'+
   '<div class="two"><label class="f">Ref ATW number<input name="atw" value="'+esc(e?e.atw:'')+'" autocomplete="off"></label>'+
   '<label class="f">Client<input name="client" list="dlClients" value="'+esc(e?e.client:'')+'" autocomplete="off" required></label></div>'+
   '<div class="two"><label class="f">SRA permit no.<input name="permit" value="'+esc(e?e.permit:'')+'" autocomplete="off"></label>'+
   '<label class="f">Mill waybill number<input name="waybill" value="'+esc(e?e.waybill:'')+'" autocomplete="off"></label></div>'+
   '<div class="two"><label class="f">Bill of lading no.<input name="bol" value="'+esc(e?e.bol:'')+'" autocomplete="off"></label>'+
   '<label class="f">Vessel<input name="vessel" value="'+esc(e?e.vessel:'')+'" autocomplete="off"></label></div>'+
   '<div class="two"><label class="f">Voy no.<input name="voy" value="'+esc(e?e.voy:'')+'" autocomplete="off"></label>'+
   '<label class="f">Sailing date<input type="date" name="sail" value="'+esc(e?e.sail:'')+'"></label></div>'+
   dl('dlClients',knownClients())+
   '<label class="f" style="margin-bottom:0">Batch codes and quantity</label><div id="batches">'+(e?batchRow(e.batch,e.qty):batchRow()+batchRow())+'</div>'+
   (e?'':'<button type="button" class="btn block" style="margin-top:8px" data-act="addBatch">Add batch code</button>')+
   '<div class="err" id="err" role="alert" tabindex="-1"></div><div class="btns">'+(e?'<button type="button" class="btn danger" data-act="delIssue" data-id="'+esc(e.id)+'">Delete</button>':'')+'<button type="submit" class="btn primary">Save</button></div></form>');
  updateIssueInfo();
}
function issueTotals(f){
  const q=[...f.querySelectorAll('[name=bqty]')].map(x=>parseFloat(x.value)||0); return q.reduce((a,b)=>a+b,0);
}
function updateIssueInfo(){
  const f=$('#fIss'); if(!f) return; const info=$('#info'), c=compute(), o=c.by[f.elements.sro.value];
  if(!o){ info.className='info'; info.textContent='Select an SRO to see its type and balance.'; return; }
  const cur=f.dataset.id?S.issues.find(i=>i.id===f.dataset.id):null;
  const avail=o.balance+(cur&&cur.sro===o.sro?(+cur.qty||0):0), tot=issueTotals(f), after=avail-tot;
  info.className='info'+(after<0?' bad':'');
  info.innerHTML='<b>'+esc(o.type||'No type')+'</b> · '+esc(o.mill||'No mill')+'<br>Available '+nf(avail)+' · this issue '+nf(tot)+' · balance after <b>'+nf(after)+'</b>'+(after<0?' (over-issued)':'');
}
async function saveIssue(f){
  const v=n=>f.elements[n].value.trim(), id=f.dataset.id, err=$('#err'), c=compute(), o=c.by[v('sro')];
  clearFormError(f);
  const codes=[...f.querySelectorAll('[name=bcode]')], qtys=[...f.querySelectorAll('[name=bqty]')];
  const lines=codes.map((x,i)=>({batch:x.value.trim(),qty:parseFloat(qtys[i].value)})).filter(l=>l.batch||!isNaN(l.qty));
  if(!v('date')||!v('sro')||!v('client')){formError(f,'Select the date, SRO number and client.',['date','sro','client'].filter(name=>!v(name)));return;}
  if(!lines.length||lines.some(l=>!Number.isFinite(l.qty)||l.qty<=0)){formError(f,'Every batch line needs a finite quantity above zero.',lines.length?qtys.filter((input,i)=>(input.value.trim()||codes[i].value.trim())&&(!Number.isFinite(input.valueAsNumber)||input.valueAsNumber<=0)):[qtys[0]]);return;}
  const tot=lines.reduce((a,l)=>a+l.qty,0), cur=id?S.issues.find(i=>i.id===id):null;
  const avail=o?o.balance+(cur&&cur.sro===o.sro?(+cur.qty||0):0):null;
  if(o && tot>avail && !(await ask('Over-issuing',nf(tot-avail)+' more than the '+nf(avail)+' available on '+o.sro+'. Save anyway?','Save anyway'))) return;
  const base={date:v('date'),sro:v('sro'),atw:v('atw'),type:o?o.type:(cur?cur.type:''),client:v('client'),permit:v('permit'),waybill:v('waybill'),bol:v('bol'),vessel:v('vessel'),voy:v('voy'),sail:v('sail')};
  if(cur) Object.assign(cur,base,{batch:lines[0].batch,qty:lines[0].qty});
  else lines.forEach(l=>S.issues.push(Object.assign({id:uid(),seq:++S.seq},base,{batch:l.batch,qty:l.qty})));
  if(base.client && !S.clients.includes(base.client)) S.clients.push(base.client);
  if(!await save()) return; closeSheet(); render(); toast(cur?'Issuance saved':'Issued '+nf(tot)+' from '+base.sro);
}

/* ---------- client detail ---------- */
function clientSheet(name){
  const c=clientStats().find(x=>x.name===name); if(!c) return;
  const sro=Object.entries(c.bySro).sort((a,b)=>b[1]-a[1]);
  const items=[...c.items].sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:b.seq-a.seq);
  openSheet(sheetHead(c.name,nf(c.total)+' issued in total')+
   '<div class="sec" style="margin-top:6px"><h2>By SRO number</h2></div><div class="card" style="padding:4px 14px">'+
   sro.map(e=>'<div class="typeRow" style="grid-template-columns:1fr auto"><b>'+esc(e[0])+'</b><b class="num" style="font-size:19px">'+nf(e[1])+'</b></div>').join('')+'</div>'+
   '<div class="sec"><h2>Deliveries</h2></div><div class="tabwrap" tabindex="0" role="region" aria-label="Client delivery history"><table class="led"><thead><tr><th>Date</th><th>Details</th><th class="r">Qty</th>'+(!readOnly?'<th scope="col">Action</th>':'')+'</tr></thead><tbody>'+
   items.map(i=>'<tr><td>'+fd(i.date)+'</td><td>'+esc(i.sro)+'<small>'+esc((i.atw||'')+(i.batch?' · '+i.batch:''))+'</small></td><td class="r"><b>'+nf(i.qty)+'</b></td>'+ledgerAction('editIssue',i.id,'Edit issuance '+(i.batch||i.atw||i.id))+'</tr>').join('')+'</tbody></table></div>');
}

/* ---------- export / import ---------- */
const stamp=()=>today();
function csv(rows){ return '\ufeff'+rows.map(r=>r.map(v=>{ v=v==null?'':String(v); return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(',')).join('\r\n'); }
const REC_H=['SRO Date','SRO Number','Type of Sugar','Mill Source','Quantity','Crop Year'];
const ISS_H=['Date','SRO Number','Ref ATW Number','Type of Sugar','Client','SRA Permit No.','Mill Waybill Number','Batch Codes','Quantity per Batch Code','Bill of Lading No.','Vessel','Voy No.','Sailing Date'];
const recRows=()=>[...S.receipts].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).map(r=>[r.date,r.sro,r.type,r.mill,r.qty,r.crop]);
const issRows=()=>compute().sorted.map(i=>[i.date,i.sro,i.atw,i.type,i.client,i.permit,i.waybill,i.batch,i.qty,i.bol,i.vessel,i.voy,i.sail]);
async function saveFile(name,data){
  if(!DL){ toast('Downloads are not available in this view.'); return; }
  try{ await DL.save({filename:name,data}); toast('Saved '+name); }
  catch(e){ if(e&&e.code==='declined') return; toast('Could not save: '+((e&&e.message)||'unknown error')); }
}
const serial=s=>{ const p=s.split('-'); return (Date.UTC(+p[0],+p[1]-1,+p[2])-Date.UTC(1899,11,30))/86400000; };
const THIN={style:'thin',color:{rgb:'BFBFBF'}}, BOX={top:THIN,bottom:THIN,left:THIN,right:THIN};
const FILL=rgb=>({patternType:'solid',fgColor:{rgb:rgb}});
const YELLOW='FFFF00';
const SH={
  head:{font:{bold:true,color:{rgb:'000000'}},fill:FILL(YELLOW),alignment:{horizontal:'center',vertical:'center',wrapText:true},border:BOX},
  text:{alignment:{horizontal:'justify',vertical:'center'},border:BOX},
  num:{alignment:{horizontal:'center',vertical:'center'},border:BOX},
  date:{alignment:{horizontal:'center',vertical:'center'},border:BOX},
  qty:{alignment:{horizontal:'right',vertical:'center',indent:1},border:BOX}
};
const isDateCell=c=>c.t==='n'&&c.z&&/mmm/.test(c.z);
const bodyStyle=c=>c.t==='n'?(isDateCell(c)?SH.date:(c.z==='#,##0.00'?SH.qty:SH.num)):SH.text;
const cellLen=c=>{ if(c.v==null||c.v==='') return 0; if(c.t==='n') return isDateCell(c)?11:(c.z&&c.z.indexOf('%')>=0?7:(c.z==='0'?String(c.v).length:nf(c.v).length)); return String(c.v).length; };
function fmtSheet(ws){
  const X=window.XLSX, rg=X.utils.decode_range(ws['!ref']), w=[];
  for(let R=rg.s.r;R<=rg.e.r;R++) for(let C=rg.s.c;C<=rg.e.c;C++){
    const a=X.utils.encode_cell({r:R,c:C}); let cell=ws[a]; if(!cell) cell=ws[a]={t:'s',v:''};
    if(R>0&&cell.t==='n'&&!cell.z) cell.z='#,##0.00';
    cell.s=R===0?SH.head:bodyStyle(cell);
    w[C]=Math.max(w[C]||10,Math.min(cellLen(cell)+3,44));
  }
  ws['!cols']=w.map(x=>({wch:x})); ws['!autofilter']={ref:ws['!ref']};
}
function xlsxBook(){
  const X=window.XLSX; if(!X) return null; const c=compute();
  const mk=(rows,dateCols,w,pctCols,intCols)=>{ const ws=X.utils.aoa_to_sheet(rows); rows.forEach((r,ri)=>{ if(!ri) return; dateCols.forEach(ci=>{ const a=X.utils.encode_cell({r:ri,c:ci}); const cell=ws[a]; if(cell&&/^\d{4}-\d{2}-\d{2}$/.test(String(cell.v))){ cell.v=serial(cell.v); cell.t='n'; cell.z='dd-mmm-yyyy'; } }); }); (pctCols||[]).concat(intCols||[]).forEach(ci=>{ const z=(pctCols||[]).indexOf(ci)>=0?'0.0%':'0'; rows.forEach((r,ri)=>{ if(!ri) return; const cell=ws[X.utils.encode_cell({r:ri,c:ci})]; if(cell&&cell.t==='n') cell.z=z; }); });
    fmtSheet(ws); return ws; };
  const wb=X.utils.book_new();
  X.utils.book_append_sheet(wb,dashSheet(c),'Dashboard');
  X.utils.book_append_sheet(wb,sroQuantitySheet(c),'SRO Quantity');
  X.utils.book_append_sheet(wb,issuanceSheet(c),'Issuance');
  X.utils.book_append_sheet(wb,sroBalanceSheet(c),'SRO Balance');
  X.utils.book_append_sheet(wb,clientSummarySheet(c),'Client Summary');
  return wb;
}
function dashSheet(c){
  const X=window.XLSX, ws={}, merges=[], H={};
  const GREEN='1B5E4A', LG='E2EFDA', AMB='FFE699', LAMB='FFF2CC', BAND='F3F7F4';
  const T={style:'thin',color:{rgb:'BFBFBF'}}, BOX={top:T,bottom:T,left:T,right:T};
  const fnt=(sz,bold,rgb,it)=>({name:'Calibri',sz:sz,bold:!!bold,italic:!!it,color:{rgb:rgb||'000000'}});
  const set=(r,col,v,o)=>{
    o=o||{}; let cell;
    if(v===''||v==null) cell={t:'s',v:''};
    else if(typeof v==='number') cell={t:'n',v:v,z:o.z||'#,##0.00'};
    else cell={t:'s',v:String(v)};
    const st={font:o.font||fnt(10),alignment:o.al||{horizontal:'justify',vertical:'center'}};
    if(o.fill) st.fill=FILL(o.fill);
    if(o.border!==0) st.border=o.border||BOX;
    if(typeof v==='number'&&(!o.z||o.z==='#,##0.00')) st.alignment={horizontal:'right',vertical:'center',indent:1};
    else if(typeof v==='number'&&!o.al) st.alignment={horizontal:'center',vertical:'center'};
    cell.s=st; ws[X.utils.encode_cell({r:r,c:col})]=cell;
  };
  const span=(r,c1,c2,v,o)=>{ for(let k=c1;k<=c2;k++) set(r,k,k===c1?v:'',o); if(c2>c1) merges.push({s:{r:r,c:c1},e:{r:r,c:c2}}); };
  const ts=typeStats(c), cs=clientStats(), sum=(a,f)=>a.reduce((t,x)=>t+f(x),0);
  const bar=p=>{ const n=Math.max(0,Math.min(10,Math.round(p/10))); return '█'.repeat(n)+'░'.repeat(10-n); };
  const left=(rec,bal)=>rec?Math.max(0,Math.min(100,bal/rec*100)):0;
  const ncols=Math.max(12,ts.length+5);
  const CENTER={horizontal:'center',vertical:'center',wrapText:true};
  const headRow=(r,labels)=>{ labels.forEach((l,i)=>set(r,i,l,{font:fnt(10,true,'000000'),fill:YELLOW,al:CENTER})); H[r]=30; };
  const sec=(r,t,n)=>{ span(r,0,(n||ncols)-1,t,{font:fnt(12,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=22; };
  const STAT={ok:['C6EFCE','006100'],low:['FFEB9C','9C5700'],empty:['D9D9D9','404040'],over:['FFC7CE','9C0006']};
  let r=0;
  span(r,0,ncols-1,'SUGAR INVENTORY DASHBOARD',{font:fnt(20,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=38; r++;
  span(r,0,ncols-1,'As of '+fd(today())+'   |   Unit: '+S.unit+'   |   SROs with balance: '+c.list.filter(o=>o.balance>0).length+'   |   Clients served: '+cs.length,
       {font:fnt(10,false,'404040',true),fill:LG,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=20; r+=2;
  /* total per type of sugar: highlighted cards */
  sec(r,'TOTAL PER TYPE OF SUGAR'); r++;
  const per=Math.max(1,Math.floor(ncols/2));
  for(let b0=0;b0<ts.length;b0+=per){
    ts.slice(b0,b0+per).forEach((t,i)=>{
      const c0=i*2, c1=c0+1, bal=t.received-t.issued, p=left(t.received,bal);
      span(r,c0,c1,t.name,{font:fnt(13,true,'FFFFFF'),fill:GREEN,al:{horizontal:'center',vertical:'center'},border:BOX});
      span(r+1,c0,c1,'BALANCE',{font:fnt(9,true,'7F6000'),fill:LAMB,al:{horizontal:'center',vertical:'center'},border:BOX});
      span(r+2,c0,c1,bal,{font:fnt(22,true,GREEN),fill:AMB,al:{horizontal:'center',vertical:'center'},border:BOX});
      set(r+3,c0,'Received',{border:BOX}); set(r+3,c1,t.received,{border:BOX});
      set(r+4,c0,'Issued',{border:BOX});   set(r+4,c1,t.issued,{border:BOX});
      set(r+5,c0,'% Left',{border:BOX});   set(r+5,c1,p/100,{z:'0.0%',border:BOX});
      span(r+6,c0,c1,bar(p),{font:fnt(11,false,GREEN),al:{horizontal:'center',vertical:'center'},border:BOX});
    });
    H[r]=24; H[r+1]=16; H[r+2]=40; H[r+6]=20; r+=8;
  }
  if(!ts.length) r++;
  /* running balance per SRO: one separate block per sugar type */
  sec(r,'RUNNING BALANCE PER SRO (BY SUGAR TYPE)',9); r+=2;
  ts.forEach(t=>{
    const g=c.list.filter(o=>(o.type||'(no type)')===t.name).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
    if(!g.length) return;
    span(r,0,8,t.name.toUpperCase()+'   |   '+g.length+' SRO'+(g.length>1?'s':''),{font:fnt(12,true,GREEN),fill:'A9D08E',al:{horizontal:'left',vertical:'center',indent:1},border:BOX}); H[r]=24; r++;
    headRow(r,['SRO Number','SRO Date','Mill Source','Received','Issued','Balance','% Issued','Stock Level','Status']); r++;
    g.forEach((o,ix)=>{
      const f=ix%2?BAND:'FFFFFF', st=status(o), sc=STAT[st.k]||STAT.ok;
      set(r,0,o.sro,{fill:f,font:fnt(10,true)});
      set(r,1,o.date?serial(o.date):'',{z:'dd-mmm-yyyy',fill:f,al:{horizontal:'center',vertical:'center'}});
      set(r,2,o.mill,{fill:f}); set(r,3,o.received,{fill:f}); set(r,4,o.issued,{fill:f});
      set(r,5,o.balance,{fill:f,font:fnt(10,true,GREEN)});
      set(r,6,o.received?o.issued/o.received:0,{z:'0.0%',fill:f});
      set(r,7,bar(left(o.received,o.balance)),{fill:f,font:fnt(10,false,GREEN),al:{horizontal:'center',vertical:'center'}});
      set(r,8,st.t,{fill:sc[0],font:fnt(10,true,sc[1]),al:{horizontal:'center',vertical:'center'}});
      r++;
    });
    const gr=sum(g,o=>o.received), gi=sum(g,o=>o.issued), o2={fill:AMB,font:fnt(10,true,'000000')};
    span(r,0,2,t.name+' SUBTOTAL',o2);
    set(r,3,gr,o2); set(r,4,gi,o2); set(r,5,gr-gi,{fill:AMB,font:fnt(11,true,GREEN)});
    set(r,6,gr?gi/gr:0,Object.assign({z:'0.0%'},o2));
    set(r,7,bar(left(gr,gr-gi)),{fill:AMB,font:fnt(10,false,GREEN),al:{horizontal:'center',vertical:'center'}});
    set(r,8,'',o2); r+=2;
  });
  /* issued per client */
  const cc=ts.length+5;
  sec(r,'ISSUED PER CLIENT (BY SUGAR TYPE)',Math.max(cc,6)); r++;
  headRow(r,['Client'].concat(ts.map(t=>t.name),['Total Issued','% of Total','Deliveries','Last Issuance'])); r++;
  const tot=sum(cs,k=>k.total);
  cs.forEach((k,ix)=>{
    const f=ix%2?BAND:'FFFFFF';
    set(r,0,k.name,{fill:f,font:fnt(10,true)});
    ts.forEach((t,j)=>set(r,1+j,sum(k.items.filter(i=>(i.type||(c.by[i.sro]&&c.by[i.sro].type)||'(no type)')===t.name),i=>+i.qty||0),{fill:f}));
    const b=1+ts.length;
    set(r,b,k.total,{fill:AMB,font:fnt(10,true,GREEN)});
    set(r,b+1,tot?k.total/tot:0,{z:'0.0%',fill:f});
    set(r,b+2,k.atw.size||k.lines,{z:'0',fill:f,al:{horizontal:'center',vertical:'center'}});
    set(r,b+3,k.last?serial(k.last):'',{z:'dd-mmm-yyyy',fill:f,al:{horizontal:'center',vertical:'center'}});
    r++;
  });
  r++;
  /* data checks */
  sec(r,'DATA CHECKS',6); r++;
  const dup=S.receipts.filter(x=>S.receipts.filter(y=>y.sro===x.sro).length>1).length;
  const mis=S.issues.filter(i=>c.by[i.sro]&&i.type&&i.type!==c.by[i.sro].type).length;
  [['SROs over-issued',c.list.filter(o=>o.balance<0).length],
   ['Issuance lines with SRO not in SRO Quantity',c.orphans.length],
   ['Duplicate SRO numbers in SRO Quantity',dup],
   ['Issuance lines with sugar type different from SRO',mis]].forEach(x=>{
    const okk=x[1]===0, col=okk?['C6EFCE','006100']:['FFC7CE','9C0006'];
    span(r,0,3,x[0],{}); set(r,4,x[1],{z:'0',al:{horizontal:'center',vertical:'center'}});
    set(r,5,okk?'OK':'Review',{fill:col[0],font:fnt(10,true,col[1]),al:{horizontal:'center',vertical:'center'}}); r++;
  });
  /* white canvas so gridlines are hidden, and layout */
  const endR=r+2, endC=ncols+1;
  for(let R=0;R<=endR;R++) for(let C=0;C<=endC;C++){
    const a=X.utils.encode_cell({r:R,c:C});
    if(!ws[a]) ws[a]={t:'s',v:'',s:{fill:FILL('FFFFFF')}};
  }
  ws['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:endR,c:endC}});
  ws['!merges']=merges;
  ws['!cols']=[];
  for(let C=0;C<=endC;C++) ws['!cols'].push({wch:C===0?26:C===9||C===3?17:16});
  ws['!rows']=[];
  Object.keys(H).forEach(k=>{ ws['!rows'][+k]={hpt:H[k]}; });
  return ws;
}
function sroBalanceSheet(c){
  const X=window.XLSX, ws={}, merges=[], H={};
  const GREEN='1B5E4A', LG='E2EFDA', AMB='FFE699', BAND='F3F7F4';
  const T={style:'thin',color:{rgb:'BFBFBF'}}, BOX={top:T,bottom:T,left:T,right:T};
  const fnt=(sz,bold,rgb,it)=>({name:'Calibri',sz:sz,bold:!!bold,italic:!!it,color:{rgb:rgb||'000000'}});
  const CEN={horizontal:'center',vertical:'center'};
  const set=(r,col,v,o)=>{
    o=o||{}; let cell;
    if(v===''||v==null) cell={t:'s',v:''};
    else if(typeof v==='number') cell={t:'n',v:v,z:o.z||'#,##0.00'};
    else cell={t:'s',v:String(v)};
    const st={font:o.font||fnt(10),alignment:o.al||{horizontal:'justify',vertical:'center'}};
    if(o.fill) st.fill=FILL(o.fill);
    if(o.border!==0) st.border=BOX;
    if(typeof v==='number'&&(!o.z||o.z==='#,##0.00')) st.alignment={horizontal:'right',vertical:'center',indent:1};
    else if(typeof v==='number'&&!o.al) st.alignment={horizontal:'center',vertical:'center'};
    cell.s=st; ws[X.utils.encode_cell({r:r,c:col})]=cell;
  };
  const span=(r,c1,c2,v,o)=>{ for(let k=c1;k<=c2;k++) set(r,k,k===c1?v:'',o); if(c2>c1) merges.push({s:{r:r,c:c1},e:{r:r,c:c2}}); };
  const ts=typeStats(c), sum=(a,f)=>a.reduce((t,x)=>t+f(x),0);
  const STAT={ok:['C6EFCE','006100'],low:['FFEB9C','9C5700'],empty:['D9D9D9','404040'],over:['FFC7CE','9C0006']};
  let r=0;
  span(r,0,7,'RUNNING BALANCE PER SRO (BY SUGAR TYPE)',{font:fnt(16,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=32; r++;
  span(r,0,7,'As of '+fd(today())+'   |   Unit: '+S.unit,{font:fnt(10,false,'404040',true),fill:LG,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=20; r+=2;
  ts.forEach(t=>{
    const g=c.list.filter(o=>(o.type||'(no type)')===t.name).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
    if(!g.length) return;
    span(r,0,7,t.name.toUpperCase()+'   |   '+g.length+' SRO'+(g.length>1?'s':''),{font:fnt(12,true,GREEN),fill:'A9D08E',al:{horizontal:'left',vertical:'center',indent:1}}); H[r]=24; r++;
    ['SRO Number','SRO Date','Mill Source','Qty Received','Qty Issued','Running Balance','% Issued','Status'].forEach((l,i)=>set(r,i,l,{font:fnt(10,true),fill:YELLOW,al:{horizontal:'center',vertical:'center',wrapText:true}})); H[r]=28; r++;
    g.forEach((o,ix)=>{
      const f=ix%2?BAND:'FFFFFF', st=status(o), sc=STAT[st.k]||STAT.ok;
      set(r,0,o.sro,{fill:f,font:fnt(10,true)});
      set(r,1,o.date?serial(o.date):'',{z:'dd-mmm-yyyy',fill:f,al:CEN});
      set(r,2,o.mill,{fill:f}); set(r,3,o.received,{fill:f}); set(r,4,o.issued,{fill:f});
      set(r,5,o.balance,{fill:f,font:fnt(10,true,GREEN)});
      set(r,6,o.received?o.issued/o.received:0,{z:'0.0%',fill:f});
      set(r,7,st.t,{fill:sc[0],font:fnt(10,true,sc[1]),al:CEN});
      r++;
    });
    const gr=sum(g,o=>o.received), gi=sum(g,o=>o.issued), o2={fill:AMB,font:fnt(10,true)};
    span(r,0,2,t.name+' SUBTOTAL',o2);
    set(r,3,gr,o2); set(r,4,gi,o2); set(r,5,gr-gi,{fill:AMB,font:fnt(11,true,GREEN)});
    set(r,6,gr?gi/gr:0,Object.assign({z:'0.0%'},o2)); set(r,7,'',o2); r+=2;
  });
  const endR=r+1, endC=9;
  for(let R=0;R<=endR;R++) for(let C=0;C<=endC;C++){ const a=X.utils.encode_cell({r:R,c:C}); if(!ws[a]) ws[a]={t:'s',v:'',s:{fill:FILL('FFFFFF')}}; }
  ws['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:endR,c:endC}});
  ws['!merges']=merges;
  ws['!cols']=[20,14,18,16,16,18,12,16,6,6].map(w=>({wch:w}));
  ws['!rows']=[]; Object.keys(H).forEach(k=>{ ws['!rows'][+k]={hpt:H[k]}; });
  return ws;
}
function sroQuantitySheet(c){
  const X=window.XLSX, ws={}, merges=[], H={};
  const GREEN='1B5E4A', LG='E2EFDA', AMB='FFE699', LAMB='FFF2CC', BAND='F3F7F4', LAST=4;
  const T={style:'thin',color:{rgb:'BFBFBF'}}, BOX={top:T,bottom:T,left:T,right:T};
  const fnt=(sz,bold,rgb,it)=>({name:'Calibri',sz:sz,bold:!!bold,italic:!!it,color:{rgb:rgb||'000000'}});
  const CEN={horizontal:'center',vertical:'center'};
  const set=(r,col,v,o)=>{
    o=o||{}; let cell;
    if(v===''||v==null) cell={t:'s',v:''};
    else if(typeof v==='number') cell={t:'n',v:v,z:o.z||'#,##0.00'};
    else cell={t:'s',v:String(v)};
    const st={font:o.font||fnt(10),alignment:o.al||{horizontal:'justify',vertical:'center'}};
    if(o.fill) st.fill=FILL(o.fill);
    if(o.border!==0) st.border=BOX;
    if(typeof v==='number'&&(!o.z||o.z==='#,##0.00')) st.alignment={horizontal:'right',vertical:'center',indent:1};
    else if(typeof v==='number'&&!o.al) st.alignment={horizontal:'center',vertical:'center'};
    cell.s=st; ws[X.utils.encode_cell({r:r,c:col})]=cell;
  };
  const span=(r,c1,c2,v,o)=>{ for(let k=c1;k<=c2;k++) set(r,k,k===c1?v:'',o); if(c2>c1) merges.push({s:{r:r,c:c1},e:{r:r,c:c2}}); };
  const head=(r,labels)=>{ labels.forEach((l,i)=>set(r,i,l,{font:fnt(10,true),fill:YELLOW,al:{horizontal:'center',vertical:'center',wrapText:true}})); H[r]=28; };
  const ts=typeStats(c), sum=(a,f)=>a.reduce((t,x)=>t+f(x),0);
  const groups=ts.map(t=>({t:t,g:c.list.filter(o=>(o.type||'(no type)')===t.name).sort((a,b)=>String(a.sro).localeCompare(String(b.sro),undefined,{numeric:true,sensitivity:'base'}))})).filter(x=>x.g.length);
  let r=0;
  span(r,0,LAST,'SRO QUANTITY (BY SUGAR TYPE)',{font:fnt(16,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=32; r++;
  span(r,0,LAST,'As of '+fd(today())+'   |   Unit: '+S.unit,{font:fnt(10,false,'404040',true),fill:LG,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=20; r+=2;
  span(r,0,LAST,'SUMMARY BY SUGAR TYPE',{font:fnt(12,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=22; r++;
  head(r,['Type of Sugar','Crop Year','No. of SROs','SRO Quantity']); r++;
  groups.forEach(x=>{
    set(r,0,x.t.name,{fill:AMB,font:fnt(10,true)});
    set(r,1,[...new Set(x.g.map(o=>o.crop).filter(Boolean))].sort().join(', '),{fill:LAMB,al:CEN});
    set(r,2,x.g.length,{z:'0',fill:LAMB,al:CEN});
    set(r,3,sum(x.g,o=>o.received),{fill:AMB,font:fnt(11,true,GREEN)});
    r++;
  });
  r++;
  const crops=[...new Set(c.list.map(o=>o.crop).filter(Boolean))].sort().reverse();
  if(crops.length){
    const mx=Math.max(LAST,groups.length);
    span(r,0,mx,'QUANTITY BY CROP YEAR AND SUGAR TYPE',{font:fnt(12,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=22; r++;
    head(r,['Crop Year'].concat(groups.map(x=>x.t.name))); r++;
    crops.forEach((cy,ix)=>{
      const f=ix%2?BAND:'FFFFFF';
      set(r,0,cy,{fill:f,font:fnt(10,true),al:CEN});
      groups.forEach((x,j)=>set(r,1+j,sum(x.g.filter(o=>o.crop===cy),o=>o.received),{fill:f}));
      r++;
    });
    r++;
  }
  groups.forEach(x=>{
    const g=x.g;
    span(r,0,LAST,x.t.name.toUpperCase()+'   |   '+g.length+' SRO'+(g.length>1?'s':''),{font:fnt(12,true,GREEN),fill:'A9D08E',al:{horizontal:'left',vertical:'center',indent:1}}); H[r]=24; r++;
    head(r,['SRO Date','Crop Year','SRO Number','Mill Source','SRO Quantity']); r++;
    g.forEach((o,ix)=>{
      const f=ix%2?BAND:'FFFFFF';
      set(r,0,o.date?serial(o.date):'',{z:'dd-mmm-yyyy',fill:f,al:CEN});
      set(r,1,o.crop||'',{fill:f,al:CEN});
      set(r,2,o.sro,{fill:f,font:fnt(10,true)}); set(r,3,o.mill,{fill:f});
      set(r,4,o.received,{fill:f,font:fnt(10,true)});
      r++;
    });
    const o2={fill:AMB,font:fnt(10,true)};
    span(r,0,3,x.t.name+' SUBTOTAL',o2);
    set(r,4,sum(g,o=>o.received),{fill:AMB,font:fnt(11,true,GREEN)}); r+=2;
  });
  const endR=r+1, endC=LAST+2;
  for(let R=0;R<=endR;R++) for(let C=0;C<=endC;C++){ const a=X.utils.encode_cell({r:R,c:C}); if(!ws[a]) ws[a]={t:'s',v:'',s:{fill:FILL('FFFFFF')}}; }
  ws['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:endR,c:endC}});
  ws['!merges']=merges;
  ws['!cols']=[20,14,18,20,18,6,6].map(w=>({wch:w}));
  ws['!rows']=[]; Object.keys(H).forEach(k=>{ ws['!rows'][+k]={hpt:H[k]}; });
  return ws;
}
function issuanceSheet(c){
  const X=window.XLSX, ws={}, merges=[], H={};
  const GREEN='1B5E4A', LG='E2EFDA', AMB='FFE699', LAMB='FFF2CC', BAND='F3F7F4', LAST=12;
  const T={style:'thin',color:{rgb:'BFBFBF'}}, BOX={top:T,bottom:T,left:T,right:T};
  const fnt=(sz,bold,rgb,it)=>({name:'Calibri',sz:sz,bold:!!bold,italic:!!it,color:{rgb:rgb||'000000'}});
  const CEN={horizontal:'center',vertical:'center'};
  const set=(r,col,v,o)=>{
    o=o||{}; let cell;
    if(v===''||v==null) cell={t:'s',v:''};
    else if(typeof v==='number') cell={t:'n',v:v,z:o.z||'#,##0.00'};
    else cell={t:'s',v:String(v)};
    const st={font:o.font||fnt(10),alignment:o.al||{horizontal:'justify',vertical:'center'}};
    if(o.fill) st.fill=FILL(o.fill);
    if(o.border!==0) st.border=BOX;
    if(typeof v==='number'&&(!o.z||o.z==='#,##0.00')) st.alignment={horizontal:'right',vertical:'center',indent:1};
    else if(typeof v==='number'&&!o.al) st.alignment={horizontal:'center',vertical:'center'};
    cell.s=st; ws[X.utils.encode_cell({r:r,c:col})]=cell;
  };
  const span=(r,c1,c2,v,o)=>{ for(let k=c1;k<=c2;k++) set(r,k,k===c1?v:'',o); if(c2>c1) merges.push({s:{r:r,c:c1},e:{r:r,c:c2}}); };
  const head=(r,labels)=>{ labels.forEach((l,i)=>set(r,i,l,{font:fnt(10,true),fill:YELLOW,al:{horizontal:'center',vertical:'center',wrapText:true}})); H[r]=30; };
  const ts=typeStats(c), sum=(a,f)=>a.reduce((t,x)=>t+f(x),0);
  const typeOf=i=>i.type||(c.by[i.sro]&&c.by[i.sro].type)||'(no type)';
  const groups=ts.map(t=>({t:t,g:c.sorted.filter(i=>typeOf(i)===t.name)})).filter(x=>x.g.length);
  let r=0;
  span(r,0,LAST,'ISSUANCE (BY SUGAR TYPE)',{font:fnt(16,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=32; r++;
  span(r,0,LAST,'As of '+fd(today())+'   |   Unit: '+S.unit,{font:fnt(10,false,'404040',true),fill:LG,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=20; r+=2;
  span(r,0,3,'SUMMARY BY SUGAR TYPE',{font:fnt(12,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=22; r++;
  head(r,['Type of Sugar','Batch Codes','Quantity Issued','Clients']); r++;
  groups.forEach(x=>{
    set(r,0,x.t.name,{fill:AMB,font:fnt(10,true)});
    set(r,1,x.g.length,{z:'0',fill:LAMB,al:CEN});
    set(r,2,sum(x.g,i=>+i.qty||0),{fill:AMB,font:fnt(11,true,GREEN)});
    set(r,3,new Set(x.g.map(i=>(i.client||'').trim()).filter(Boolean)).size,{z:'0',fill:LAMB,al:CEN});
    r++;
  });
  r++;
  span(r,0,6,'TOTAL ISSUANCE PER ATW NUMBER',{font:fnt(12,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=22; r++;
  head(r,['Ref ATW Number','Date','Client','SRO Number','Type of Sugar','Batch Codes','Total Quantity']); r++;
  const am0=Object.create(null), al=[];
  c.sorted.forEach(i=>{ const k=i.atw||'(no ATW)'; if(!am0[k]){ am0[k]={k:k,items:[]}; al.push(am0[k]); } am0[k].items.push(i); });
  al.forEach((a,ix)=>{
    const f=ix%2?BAND:'FFFFFF', it=a.items, uniq=fn=>[...new Set(it.map(fn).filter(Boolean))].join(', ');
    set(r,0,a.k,{fill:f,font:fnt(10,true)});
    set(r,1,it[0].date?serial(it[0].date):'',{z:'dd-mmm-yyyy',fill:f,al:CEN});
    set(r,2,uniq(i=>(i.client||'').trim()),{fill:f}); set(r,3,uniq(i=>i.sro),{fill:f}); set(r,4,uniq(typeOf),{fill:f});
    set(r,5,it.length,{z:'0',fill:f,al:CEN});
    set(r,6,sum(it,i=>+i.qty||0),{fill:AMB,font:fnt(10,true,GREEN)});
    r++;
  });
  r++;
  groups.forEach(x=>{
    const g=x.g;
    span(r,0,LAST,x.t.name.toUpperCase()+'   |   '+g.length+' batch code'+(g.length>1?'s':''),{font:fnt(12,true,GREEN),fill:'A9D08E',al:{horizontal:'left',vertical:'center',indent:1}}); H[r]=24; r++;
    head(r,['Date','SRO Number','Ref ATW Number','Client','SRA Permit No.','Mill Waybill Number','Batch Codes','Quantity per Batch Code','Bill of Lading No.','Vessel','Voy No.','Sailing Date','SRO Balance After This Line']); r++;
    const ag=[], amm=Object.create(null);
    g.forEach(i=>{ const k=i.atw||'(no ATW)'; if(!amm[k]){ amm[k]={k:k,items:[]}; ag.push(amm[k]); } amm[k].items.push(i); });
    let ix=0;
    ag.forEach(a=>{
      a.items.forEach(i=>{
        const f=ix++%2?BAND:'FFFFFF';
        set(r,0,i.date?serial(i.date):'',{z:'dd-mmm-yyyy',fill:f,al:CEN});
        set(r,1,i.sro,{fill:f,font:fnt(10,true)}); set(r,2,i.atw,{fill:f}); set(r,3,i.client,{fill:f});
        set(r,4,i.permit,{fill:f}); set(r,5,i.waybill,{fill:f}); set(r,6,i.batch,{fill:f});
        set(r,7,+i.qty||0,{fill:f,font:fnt(10,true)});
        set(r,8,i.bol,{fill:f}); set(r,9,i.vessel,{fill:f}); set(r,10,i.voy,{fill:f});
        set(r,11,i.sail?serial(i.sail):'',{z:'dd-mmm-yyyy',fill:f,al:CEN});
        set(r,12,c.run[i.id]==null?'':c.run[i.id],{fill:f,font:fnt(10,true,GREEN)});
        r++;
      });
      const o4={fill:LAMB,font:fnt(10,true)};
      span(r,0,6,a.k+' TOTAL',o4); set(r,7,sum(a.items,i=>+i.qty||0),{fill:LAMB,font:fnt(10,true,GREEN)}); span(r,8,LAST,'',o4); r++;
    });
    const o2={fill:AMB,font:fnt(10,true)};
    span(r,0,6,x.t.name+' SUBTOTAL',o2);
    set(r,7,sum(g,i=>+i.qty||0),{fill:AMB,font:fnt(11,true,GREEN)});
    span(r,8,LAST,'',o2); r+=2;
  });
  const endR=r+1, endC=LAST+2;
  for(let R=0;R<=endR;R++) for(let C=0;C<=endC;C++){ const a=X.utils.encode_cell({r:R,c:C}); if(!ws[a]) ws[a]={t:'s',v:'',s:{fill:FILL('FFFFFF')}}; }
  ws['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:endR,c:endC}});
  ws['!merges']=merges;
  ws['!cols']=[20,18,17,20,17,18,16,16,18,18,10,14,18,6,6].map(w=>({wch:w}));
  ws['!rows']=[]; Object.keys(H).forEach(k=>{ ws['!rows'][+k]={hpt:H[k]}; });
  return ws;
}
function clientSummarySheet(c){
  const X=window.XLSX, ws={}, merges=[], H={};
  const GREEN='1B5E4A', LG='E2EFDA', AMB='FFE699', LAMB='FFF2CC', BAND='F3F7F4';
  const T={style:'thin',color:{rgb:'BFBFBF'}}, BOX={top:T,bottom:T,left:T,right:T};
  const fnt=(sz,bold,rgb,it)=>({name:'Calibri',sz:sz,bold:!!bold,italic:!!it,color:{rgb:rgb||'000000'}});
  const CEN={horizontal:'center',vertical:'center',wrapText:true};
  const set=(r,col,v,o)=>{
    o=o||{}; let cell;
    if(v===''||v==null) cell={t:'s',v:''};
    else if(typeof v==='number') cell={t:'n',v:v,z:o.z||'#,##0.00'};
    else cell={t:'s',v:String(v)};
    const st={font:o.font||fnt(10),alignment:o.al||{horizontal:'justify',vertical:'center'}};
    if(o.fill) st.fill=FILL(o.fill);
    if(o.border!==0) st.border=BOX;
    if(typeof v==='number'&&(!o.z||o.z==='#,##0.00')) st.alignment={horizontal:'right',vertical:'center',indent:1};
    else if(typeof v==='number'&&!o.al) st.alignment={horizontal:'center',vertical:'center'};
    cell.s=st; ws[X.utils.encode_cell({r:r,c:col})]=cell;
  };
  const span=(r,c1,c2,v,o)=>{ for(let k=c1;k<=c2;k++) set(r,k,k===c1?v:'',o); if(c2>c1) merges.push({s:{r:r,c:c1},e:{r:r,c:c2}}); };
  const head=(r,labels)=>{ labels.forEach((l,i)=>set(r,i,l,{font:fnt(10,true),fill:YELLOW,al:CEN})); H[r]=30; };
  const D=d=>d?serial(d):'';
  const DZ={z:'dd-mmm-yyyy'};
  const cs=clientStats(), ts=typeStats(c), sum=(a,f)=>a.reduce((t,x)=>t+f(x),0);
  const typeOf=i=>i.type||(c.by[i.sro]&&c.by[i.sro].type)||'(no type)';
  const ncols=Math.max(7,ts.length+5), LAST=ncols-1;
  const dcount=items=>new Set(items.map(i=>i.atw||i.waybill||i.id)).size;
  const tot=sum(cs,k=>k.total);
  let r=0;
  span(r,0,LAST,'CLIENT SUMMARY (BY SUGAR TYPE)',{font:fnt(16,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=32; r++;
  span(r,0,LAST,'As of '+fd(today())+'   |   Unit: '+S.unit+'   |   Clients served: '+cs.length,{font:fnt(10,false,'404040',true),fill:LG,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=20; r+=2;
  /* 1) matrix: client x sugar type */
  span(r,0,LAST,'ISSUED PER CLIENT, BY SUGAR TYPE',{font:fnt(12,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=22; r++;
  head(r,['Client'].concat(ts.map(t=>t.name),['Total Issued','% of Total','Deliveries','Last Issuance'])); r++;
  cs.forEach((k,ix)=>{
    const f=ix%2?BAND:'FFFFFF';
    set(r,0,k.name,{fill:f,font:fnt(10,true)});
    ts.forEach((t,j)=>set(r,1+j,sum(k.items.filter(i=>typeOf(i)===t.name),i=>+i.qty||0),{fill:f}));
    const b=1+ts.length;
    set(r,b,k.total,{fill:AMB,font:fnt(11,true,GREEN)});
    set(r,b+1,tot?k.total/tot:0,{z:'0.0%',fill:f});
    set(r,b+2,dcount(k.items),{z:'0',fill:f});
    set(r,b+3,D(k.last),{z:'dd-mmm-yyyy',fill:f});
    r++;
  });
  r++;
  /* 2) detail: one row per batch code, by sugar type, per client */
  span(r,0,LAST,'SUGAR TYPE PER CLIENT (DETAIL BY BATCH CODE)',{font:fnt(12,true,'FFFFFF'),fill:GREEN,al:{horizontal:'left',vertical:'center',indent:1},border:0}); H[r]=22; r+=2;
  cs.forEach(k=>{
    const nd=dcount(k.items);
    span(r,0,5,k.name.toUpperCase()+'   |   '+nd+' deliver'+(nd===1?'y':'ies')+'   |   '+k.lines+' batch code'+(k.lines===1?'':'s'),{font:fnt(12,true,GREEN),fill:'A9D08E',al:{horizontal:'left',vertical:'center',indent:1}}); H[r]=24; r++;
    head(r,['Type of Sugar','SRO Number','Ref ATW Number','Batch Code','Quantity Issued','Date']); r++;
    ts.forEach(t=>{
      const it=k.items.filter(i=>typeOf(i)===t.name).sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:x.seq-y.seq);
      if(!it.length) return;
      it.forEach((i,ix)=>{
        const f=ix%2?BAND:'FFFFFF';
        set(r,0,t.name,{fill:f,font:fnt(10,true)}); set(r,1,i.sro,{fill:f}); set(r,2,i.atw,{fill:f});
        set(r,3,i.batch||'(no batch code)',{fill:f,font:fnt(10,true)});
        set(r,4,+i.qty||0,{fill:f});
        set(r,5,D(i.date),{z:'dd-mmm-yyyy',fill:f});
        r++;
      });
      const o3={fill:LAMB,font:fnt(10,true)};
      span(r,0,3,t.name+' SUBTOTAL',o3); set(r,4,sum(it,i=>+i.qty||0),{fill:LAMB,font:fnt(10,true,GREEN)}); set(r,5,'',o3); r++;
    });
    const o2={fill:AMB,font:fnt(10,true)};
    span(r,0,3,k.name+' TOTAL',o2); set(r,4,k.total,{fill:AMB,font:fnt(11,true,GREEN)}); set(r,5,'',o2);
    r+=2;
  });
  const endR=r+1, endC=ncols+1;
  for(let R=0;R<=endR;R++) for(let C=0;C<=endC;C++){ const a=X.utils.encode_cell({r:R,c:C}); if(!ws[a]) ws[a]={t:'s',v:'',s:{fill:FILL('FFFFFF')}}; }
  ws['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:endR,c:endC}});
  ws['!merges']=merges;
  ws['!cols']=[]; for(let C=0;C<=endC;C++) ws['!cols'].push({wch:C===0?26:C<=ncols-1?18:6});
  ws['!rows']=[]; Object.keys(H).forEach(k=>{ ws['!rows'][+k]={hpt:H[k]}; });
  return ws;
}
let exportingXlsx=false;
async function exportXlsx(){
  if(readOnly||exportingXlsx)return;
  exportingXlsx=true;
  const button=document.querySelector('[data-act="xlsx"]');
  const label=button?.textContent;
  if(button){button.disabled=true;button.textContent='Preparing Excel…';}
  try{
    const module=await import('xlsx-js-style');
    window.XLSX=module.default||module;
    const wb=xlsxBook();
    const buf=window.XLSX.write(wb,{bookType:'xlsx',type:'array'});
    await saveFile('Sugar_Inventory_'+stamp()+'.xlsx',buf);
  }catch(error){toast('Excel export could not finish. Please retry, or export CSV.');}
  finally{exportingXlsx=false;if(button){button.disabled=false;button.textContent=label;}}
}
function parseCSV(t){
  t=t.replace(/^\ufeff/,''); const rows=[]; let row=[],cur='',q=false;
  for(let i=0;i<t.length;i++){ const ch=t[i];
    if(q){ if(ch==='"'){ if(t[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else if(ch==='"') q=true; else if(ch===','){ row.push(cur);cur=''; }
    else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&t[i+1]==='\n') i++; row.push(cur);cur=''; rows.push(row);row=[]; }
    else cur+=ch; }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r=>r.some(x=>String(x).trim()!==''));
}
function normDate(v){
  v=String(v||'').trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  let m=v.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[A-Za-z]*[-\/ ,]*(\d{4})$/);
  if(m){ const mi=M3.map(x=>x.toLowerCase()).indexOf(m[2].toLowerCase()); if(mi>=0) return m[3]+'-'+pad(mi+1)+'-'+pad(m[1]); }
  m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(m) return m[3]+'-'+pad(m[1])+'-'+pad(m[2]);
  const d=new Date(v); if(!isNaN(d)) return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  return '';
}
async function importCSV(text){
  const rows=parseCSV(text); if(rows.length<2) return 'The file has no data rows.';
  const H=rows[0].map(h=>h.trim().toLowerCase()), ix=n=>H.indexOf(n.toLowerCase());
  const num=v=>parseFloat(String(v||'').replace(/,/g,''));
  const ixa=(...n)=>{ for(const x of n){ const k=ix(x); if(k>=0) return k; } return -1; };
  if(ix('Ref ATW Number')>=0){
    const ci={date:ix('Date'),sro:ix('SRO Number'),atw:ix('Ref ATW Number'),type:ix('Type of Sugar'),client:ix('Client'),permit:ix('SRA Permit No.'),waybill:ix('Mill Waybill Number'),batch:ix('Batch Codes'),qty:ix('Quantity per Batch Code'),bol:ixa('Bill of Lading No.','Bill of Lading #','Bill of Lading','B/L No.'),vessel:ix('Vessel'),voy:ixa('Voy No.','Voy No','Voyage No.'),sail:ix('Sailing Date')};
    if(ci.date<0||ci.sro<0||ci.qty<0) return 'Issuance CSV needs Date, SRO Number and Quantity per Batch Code columns.';
    let n=0,skip=0; const g=(r,k)=>ci[k]>=0?String(r[ci[k]]||'').trim():'';
    rows.slice(1).forEach(r=>{ const qty=num(r[ci.qty]), sro=g(r,'sro'), date=normDate(r[ci.date]);
      if(!sro||!(qty>0)||!date){ skip++; return; }
      S.issues.push({id:uid(),seq:++S.seq,date,sro,atw:g(r,'atw'),type:g(r,'type'),client:g(r,'client'),permit:g(r,'permit'),waybill:g(r,'waybill'),batch:g(r,'batch'),qty,bol:g(r,'bol'),vessel:g(r,'vessel'),voy:g(r,'voy'),sail:(ci.sail>=0&&String(r[ci.sail]||'').trim())?normDate(r[ci.sail]):''}); n++;
      const cl=g(r,'client'); if(cl&&!S.clients.includes(cl)) S.clients.push(cl); });
    if(!await save()) return; return 'Imported '+n+' issuance line'+(n===1?'':'s')+(skip?', skipped '+skip+' incomplete':'')+'.';
  }
  const ci={date:ix('SRO Date'),sro:ix('SRO Number'),type:ix('Type of Sugar'),mill:ix('Mill Source'),qty:ix('Quantity'),crop:ix('Crop Year')};
  if(ci.date<0||ci.sro<0||ci.qty<0) return 'SRO quantity CSV needs SRO Date, SRO Number and Quantity columns.';
  let n=0,skip=0,dup=0; const g=(r,k)=>ci[k]>=0?String(r[ci[k]]||'').trim():'';
  rows.slice(1).forEach(r=>{ const qty=num(r[ci.qty]), sro=g(r,'sro'), date=normDate(r[ci.date]);
    if(!sro||!(qty>=0)||!date){ skip++; return; }
    if(S.receipts.some(x=>x.sro===sro)){ dup++; return; }
    S.receipts.push({id:uid(),date,sro,type:g(r,'type'),mill:g(r,'mill'),qty,crop:g(r,'crop')}); n++; });
  if(!await save()) return; return 'Imported '+n+' SRO'+(n===1?'':'s')+(dup?', skipped '+dup+' duplicate SRO':'')+(skip?', skipped '+skip+' incomplete':'')+'.';
}
let fileMode='';
function pickFile(mode,accept){ fileMode=mode; const f=$('#file'); f.accept=accept; f.value=''; f.click(); }
$('#file').addEventListener('change',async e=>{
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  let text; try{ text=await file.text(); }catch(err){ toast('Could not read that file.'); return; }
  if(fileMode==='import'){ const message=await importCSV(text); if(message) toast(message); render(); }
  else if(fileMode==='restore'){
    let o; try{ o=JSON.parse(text); }catch(err){ toast('That is not a valid backup file.'); return; }
    if(!o||!Array.isArray(o.receipts)||!Array.isArray(o.issues)){ toast('That is not a valid backup file.'); return; }
    if(await ask('Restore backup','This replaces all data in your inventory with the backup ('+o.receipts.length+' SRO quantities, '+o.issues.length+' issuance lines).','Restore',true)){
      S=Object.assign(blank(),o); S.seq=Math.max(S.seq||0,...S.issues.map(i=>i.seq||0)); if(!await save()) return; render(); toast('Backup restored');
    }
  }
});

/* ---------- sample data ---------- */
async function loadSample(){
  const R=[['2026-09-01','SRO-2026-001','Raw Sugar','Mill A',10000],['2026-09-03','SRO-2026-002','Refined Sugar','Mill B',8000],['2026-09-08','SRO-2026-003','Washed Sugar','Mill C',6000],['2026-09-10','SRO-2026-004','Raw Sugar','Mill A',12000],['2026-09-15','SRO-2026-005','Refined Sugar','Mill D',5000],['2026-09-18','SRO-2026-006','Raw Sugar','Mill B',9000],['2026-09-22','SRO-2026-007','Washed Sugar','Mill C',4000],['2026-09-25','SRO-2026-008','Refined Sugar','Mill A',7000]];
  const T=Object.create(null); R.forEach(r=>T[r[1]]=r[2]);
  const I=[['09-02','001','0001','Client A',[['B-0901-A',1500],['B-0901-B',1500]]],['09-04','002','0002','Client B',[['B-0903-A',2000],['B-0903-B',1000]]],['09-05','001','0003','Client C',[['B-0901-C',2000]]],['09-09','003','0004','Client A',[['B-0908-A',1200],['B-0908-B',1300]]],['09-12','004','0005','Client D',[['B-0910-A',3000],['B-0910-B',2500]]],['09-14','002','0006','Client E',[['B-0903-C',1800]]],['09-16','005','0007','Client B',[['B-0915-A',2500],['B-0915-B',2500]]],['09-19','006','0008','Client C',[['B-0918-A',2000],['B-0918-B',1500]]],['09-20','001','0009','Client D',[['B-0901-D',1000]]],['09-23','004','0010','Client A',[['B-0910-C',2000]]],['09-24','003','0011','Client F',[['B-0908-C',1500]]],['09-26','006','0012','Client E',[['B-0918-C',2500]]],['09-27','007','0013','Client B',[['B-0922-A',1000],['B-0922-B',1000]]],['09-28','002','0014','Client F',[['B-0903-D',1200]]],['09-29','008','0015','Client C',[['B-0925-A',1500]]],['09-30','004','0016','Client E',[['B-0910-D',1500]]],['09-30','001','0017','Client B',[['B-0901-E',1000]]]];
  const SH={'0005':{bol:'BL-MNL-88101',vessel:'MV Pacific Star',voy:'V.012',sail:'2026-09-15'},'0010':{bol:'BL-MNL-88117',vessel:'MV Visayas Trader',voy:'V.044',sail:'2026-09-25'},'0016':{bol:'BL-MNL-88130',vessel:'MV Pacific Star',voy:'V.013',sail:'2026-10-03'}};
  S=blank();
  R.forEach(r=>S.receipts.push({id:uid(),date:r[0],crop:'2026-2027',sro:r[1],type:r[2],mill:r[3],qty:r[4]}));
  I.forEach(x=>{ const sro='SRO-2026-'+x[1]; x[4].forEach(b=>S.issues.push(Object.assign({id:uid(),seq:++S.seq,date:'2026-'+x[0],sro,atw:'ATW-2026-'+x[2],type:T[sro],client:x[3],permit:'SRA-P-'+x[2],waybill:'WB-'+(1000+ +x[2]),batch:b[0],qty:b[1]},SH[x[2]]||{}))); if(!S.clients.includes(x[3])) S.clients.push(x[3]); });
  if(!await save()) return false; render(); return true;
}

/* ---------- overview, reporting and directory ---------- */
let deliveryFilter={query:'',from:'',to:'',client:''}, clientQuery='';
let reportFilter={from:today().slice(0,7)+'-01',to:today(),type:''};
function refreshPreservingInput(id){
 const input=$('#'+id), position=input.selectionStart;
 render(); const next=$('#'+id); next.focus(); if(position!==null)next.setSelectionRange(position,position);
}
const options=(values,selected,empty)=>'<option value="">'+empty+'</option>'+values.map(v=>'<option value="'+esc(v)+'"'+(v===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
function deliveryFilters(){
 return '<div class="filter-panel"><label class="f wide">Find deliveries<input id="deliveryQuery" type="search" value="'+esc(deliveryFilter.query)+'" placeholder="ATW, SRO, client, batch, vessel…"></label><label class="f">From<input type="date" data-delivery="from" value="'+esc(deliveryFilter.from)+'"></label><label class="f">To<input type="date" data-delivery="to" value="'+esc(deliveryFilter.to)+'"></label><label class="f wide">Client<select data-delivery="client">'+options(knownClients(),deliveryFilter.client,'All clients')+'</select></label><button class="btn" data-act="resetDelivery">Clear filters</button></div>';
}
function vDashboard(){
 const c=compute(), received=S.receipts.reduce((n,r)=>n+(+r.qty||0),0), issued=S.issues.reduce((n,i)=>n+(+i.qty||0),0);
 const low=c.list.filter(o=>status(o).k==='low'), over=c.list.filter(o=>o.balance<0);
 const todayIssues=S.issues.filter(i=>i.date===today()), dateLimit=new Date(today()+'T12:00:00');dateLimit.setDate(dateLimit.getDate()+14);
 const limit=dateLimit.getFullYear()+'-'+pad(dateLimit.getMonth()+1)+'-'+pad(dateLimit.getDate());
 const sailings=issueGroups(c).filter(g=>g.sail&&g.sail>=today()&&g.sail<=limit).sort((a,b)=>a.sail.localeCompare(b.sail));
 const aged=c.list.filter(o=>o.balance>0&&o.date&&Math.floor((new Date(today()+'T12:00:00')-new Date(o.date+'T12:00:00'))/86400000)>=90);
 let h='<div class="overview-heading"><div><h2>Inventory at a glance</h2><p>'+fd(today())+' · '+esc(S.unit)+'</p></div><div class="btns"><button class="btn primary" data-act="newReceipt">Receive stock</button><button class="btn" data-act="newIssue">New issuance</button></div></div>';
 h+='<dl class="metrics"><div><dt>On hand</dt><dd>'+nf(received-issued)+'</dd></div><div><dt>Total received</dt><dd>'+nf(received)+'</dd></div><div><dt>Total issued</dt><dd>'+nf(issued)+'</dd></div><div><dt>Issued today</dt><dd>'+nf(todayIssues.reduce((n,i)=>n+(+i.qty||0),0))+'</dd></div></dl>';
 h+='<div class="overview-columns"><section><div class="sec"><h2>Stock needs attention</h2><span class="hint">Alert at '+threshold(S)+'%</span></div>';
 if(!low.length&&!over.length&&!c.orphans.length)h+='<p class="setting dashboard-empty">'+(c.list.length?'No low or over-issued SROs.':'Add your first SRO quantity to start monitoring stock.')+'</p>';
 h+=[...over,...low].slice(0,8).map(o=>'<button class="attention-row" data-act="sro" data-id="'+esc(o.sro)+'"><span><strong>'+esc(o.sro)+'</strong><small>'+esc(o.type)+' · '+status(o).t+'</small></span><b>'+nf(o.balance)+'</b></button>').join('');
 if(c.orphans.length)h+='<p class="alert">'+c.orphans.length+' issuance lines have no matching SRO. Review them in Issuance.</p>';
 h+='<div class="sec"><h2>Stock aging</h2></div><p class="hint">'+aged.length+' SROs received at least 90 days ago still have stock on hand.</p>'+aged.slice(0,5).map(o=>'<button class="attention-row" data-act="sro" data-id="'+esc(o.sro)+'"><span>'+esc(o.sro)+'<small>Received '+fd(o.date)+'</small></span><b>'+nf(o.balance)+'</b></button>').join('')+'</section>';
 h+='<section><div class="sec"><h2>Sailing in the next 14 days</h2></div>'+(sailings.length?sailings.slice(0,8).map(g=>'<button class="attention-row" data-act="editIssue" data-id="'+esc(g.items[0].id)+'"><span><strong>'+esc(g.vessel||'Vessel not recorded')+'</strong><small>'+esc(g.client||'No client')+' · '+esc(g.atw||g.sro)+'</small></span><b>'+fd(g.sail)+'</b></button>').join(''):'<p class="setting dashboard-empty">No upcoming sailings recorded. Add sailing details when you create an issuance.</p>')+'</section></div>';
 if(readOnly)return h;
 h+='<div class="sec"><h2>Recent changes</h2><span class="hint">Latest 200 saved changes</span></div><p class="hint">Shared operational history; not an immutable audit log.</p>';
 h+=(S.activity||[]).length?'<ol class="activity-list">'+(S.activity||[]).slice(0,12).map(a=>'<li><span>'+esc(a.summary)+'</span><time datetime="'+esc(a.at)+'">'+esc(new Date(a.at).toLocaleString())+'</time></li>').join('')+'</ol>':'<p class="setting dashboard-empty">New inventory changes will appear here after they are saved.</p>';
 return h;
}
function vReports(){
 const invalid=reportFilter.from&&reportFilter.to&&reportFilter.from>reportFilter.to;
 const rows=invalid?[]:stockReport(S,reportFilter), sums=rows.reduce((a,r)=>{for(const k of ['opening','received','issued','closing'])a[k]+=r[k];return a;},{opening:0,received:0,issued:0,closing:0});
 let h='<h2>Stock movement report</h2><p class="hint">Opening stock is the balance before the start date. Closing stock includes all movements through the end date.</p><div class="filter-panel"><label class="f">From<input type="date" data-report="from" value="'+esc(reportFilter.from)+'"></label><label class="f">To<input type="date" data-report="to" value="'+esc(reportFilter.to)+'"></label><label class="f wide">Sugar type<select data-report="type">'+options(knownTypes(),reportFilter.type,'All sugar types')+'</select></label></div>';
 if(invalid)return h+'<p class="alert" role="alert">The start date must be on or before the end date.</p>';
 h+='<div class="btns"><button class="btn primary" data-act="reportCsv"'+(!rows.length?' disabled':'')+'>Export report CSV</button></div><dl class="metrics">'+Object.entries(sums).map(([label,total])=>'<div><dt>'+label[0].toUpperCase()+label.slice(1)+'</dt><dd>'+nf(total)+'</dd></div>').join('')+'</dl>';
 h+='<div class="table-scroll" tabindex="0" role="region" aria-label="SRO movement report"><table class="led"><caption>SRO movement · '+esc(S.unit)+'</caption><thead><tr><th>SRO / Sugar type</th><th class="r">Opening</th><th class="r">Received</th><th class="r">Issued</th><th class="r">Closing</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.sro)+'<small>'+esc(r.type)+'</small></td><td class="r">'+nf(r.opening)+'</td><td class="r">'+nf(r.received)+'</td><td class="r">'+nf(r.issued)+'</td><td class="r">'+nf(r.closing)+'</td></tr>').join('')+'</tbody></table></div>';
 if(!rows.length)h+='<p class="empty">No stock movements in this period.</p>';
 const receiptTypes=new Map();
 for(const r of S.receipts)if(!receiptTypes.has(r.sro))receiptTypes.set(r.sro,r.type);
 const selected=matchingIssues(S.issues,{from:reportFilter.from,to:reportFilter.to}).filter(i=>!reportFilter.type||(i.type||receiptTypes.get(i.sro))===reportFilter.type), clients=new Map();
 selected.forEach(i=>clients.set(i.client||'No client',(clients.get(i.client||'No client')||0)+(+i.qty||0)));
 h+='<div class="sec"><h2>Issued per client in this period</h2></div>'+[...clients].sort((a,b)=>b[1]-a[1]).map(([name,total])=>'<div class="attention-row"><span>'+esc(name)+'</span><b>'+nf(total)+'</b></div>').join('');
 if(!clients.size)h+='<p class="hint">No client issuances in this period.</p>';
 return h;
}
function exportReport(){
 if(reportFilter.from&&reportFilter.to&&reportFilter.from>reportFilter.to){toast('Choose a valid date range.');return;}
 const safe=v=>typeof v==='string'&&/^[=+@\-\t\r]/.test(v)?"'"+v:v;
 const rows=stockReport(S,reportFilter).map(r=>[r.sro,r.type,r.mill,r.opening,r.received,r.issued,r.closing,S.unit].map(safe));
 saveFile('Stock_Movement_'+(reportFilter.from||'start')+'_'+(reportFilter.to||today())+'.csv',csv([['SRO','Sugar Type','Mill','Opening','Received','Issued','Closing','Unit'],...rows]));
}
function clientEditor(name=''){
 const profile=(S.clientProfiles||{})[name]||{};
 openSheet(sheetHead(name?'Edit client':'New client')+'<form id="clientForm" data-original="'+esc(name)+'"><label class="f">Client name<input name="name" required maxlength="120" value="'+esc(name)+'"></label><label class="f">Contact person<input name="contact" maxlength="120" value="'+esc(profile.contact||'')+'"></label><label class="f">Phone<input name="phone" type="tel" maxlength="50" value="'+esc(profile.phone||'')+'"></label><label class="f">Email<input name="email" type="email" maxlength="160" value="'+esc(profile.email||'')+'"></label><label class="f">Address / notes<textarea name="notes" rows="3" maxlength="1000">'+esc(profile.notes||'')+'</textarea></label><p class="hint">Renaming a client updates their existing issuance records.</p><p id="clientError" class="err" role="alert"></p><button class="btn primary block">Save client</button></form>');
}
async function saveClient(form){
 const value=k=>form.elements[k].value.trim(),name=value('name'),original=form.dataset.original;
 if(!name||['__proto__','prototype','constructor'].includes(name)){ $('#clientError').textContent='Enter a valid client name.';return; }
 if(knownClients().some(n=>n.toLowerCase()===name.toLowerCase()&&n!==original)){ $('#clientError').textContent='This client already exists. Edit their existing details.';return; }
 S.clients=[...new Set([...S.clients.filter(n=>n!==original),name])];S.clientProfiles=S.clientProfiles||{};
 if(original&&original!==name){S.issues.forEach(i=>{if(i.client===original)i.client=name;});delete S.clientProfiles[original];}
 S.clientProfiles[name]={contact:value('contact'),phone:value('phone'),email:value('email'),notes:value('notes')};
 if(!await save())return;closeSheet();render();toast('Client details saved');
}

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  if(!ready||saving) return; const t=e.target.closest('[data-act]'); if(!t) return; const a=t.dataset.act, d=t.dataset;
  if(readOnly&&!['tab','filter','sro','close','resetDelivery'].includes(a))return;
  switch(a){
    case 'saveSlug': await editSharingCode(true);break;
    case 'toggleSharing': await updateSharing({enabled:!shareSettings.enabled}); break;
    case 'rotateSharing': if(await ask('Replace public link','The previous link will stop working. A new random 6-character address will replace it. Your sharing setting stays the same.','Replace link'))await replaceSharingLink(); break;
    case 'copySharing': try{await navigator.clipboard.writeText(publicLink());toast('View-only link copied');}catch{ $('#publicLink').select();toast('Select and copy the link above.');} break;
    case 'navMenu': openSheet(sheetHead('Menu')+'<div class="section-menu">'+['receive','clients','reports','more'].map(k=>'<button class="btn" data-act="tab" data-tab="'+k+'"'+(tab===k?' aria-current="page"':'')+'>'+ICON[k]+'<span>'+(k==='more'?'Settings & sharing':TITLES[k])+'</span></button>').join('')+'</div>');break;
    case 'newClient': clientEditor(); break;
    case 'editClient': clientEditor(d.name); break;
    case 'reportCsv': exportReport(); break;
    case 'resetDelivery': deliveryFilter={query:'',from:'',to:'',client:''}; render(); break;
    case 'tab': if(readOnly&&!['dashboard','stock','issue','reports'].includes(d.tab))return; tab=d.tab; if(tab==='more')await loadSharing(); closeSheet(); render(); window.scrollTo(0,0); break;
    case 'filter': filter=d.f; updateList(); break;
    case 'rcrop': rcrop=d.c; updateRList(); break;
    case 'rtype': rtype=(rtype===d.t&&d.t!=='all')?'all':d.t; updateRList(); if(rtype!=='all'){ const el=$('#rList'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); } break;
    case 'close': closeSheet(); break;
    case 'sro': sroSheet(d.id); break;
    case 'newReceipt': receiptSheet(); break;
    case 'editReceipt': if(d.id) receiptSheet(d.id); break;
    case 'newIssue': issueSheet({sro:d.sro||''}); break;
    case 'editIssue': { const i=S.issues.find(x=>x.id===d.id); if(i) issueSheet({edit:i}); break; }
    case 'client': clientSheet(d.name); break;
    case 'addBatch': $('#batches').insertAdjacentHTML('beforeend',batchRow()); break;
    case 'rmBatch': { const b=$('#batches'); if(b.children.length>1){ t.closest('.batch').remove(); updateIssueInfo(); } break; }
    case 'delReceipt': { const r=S.receipts.find(x=>x.id===d.id); if(!r) break; const n=S.issues.filter(i=>i.sro===r.sro).length;
      if(await ask('Delete SRO quantity',(n?n+' issuance line'+(n>1?'s':'')+' refer to '+r.sro+' and will be flagged as unmatched. ':'')+'Delete '+r.sro+'?','Delete',true)){ S.receipts=S.receipts.filter(x=>x.id!==r.id); if(!await save()) return; closeSheet(); render(); toast('SRO quantity deleted'); } break; }
    case 'delIssue': { if(await ask('Delete issuance line','This removes the batch line permanently.','Delete',true)){ S.issues=S.issues.filter(x=>x.id!==d.id); if(!await save()) return; closeSheet(); render(); toast('Line deleted'); } break; }
    case 'xlsx': exportXlsx(); break;
    case 'csvRec': saveFile('SRO_Quantity_'+stamp()+'.csv',csv([REC_H,...recRows()])); break;
    case 'csvIss': saveFile('Issuance_'+stamp()+'.csv',csv([ISS_H,...issRows()])); break;
    case 'backup': saveFile('Sugar_Inventory_backup_'+stamp()+'.json',JSON.stringify(S)); break;
    case 'restore': pickFile('restore','.json,application/json'); break;
    case 'import': pickFile('import','.csv,text/csv'); break;
    case 'sample':
      if(!S.receipts.length&&!S.issues.length || await ask('Load sample data','This replaces your current data with fictitious examples.','Replace',true)){ if(await loadSample()) toast('Sample data loaded'); } break;
    case 'clear':
      if(await ask('Delete all data','All SRO quantities and issuances in your inventory will be removed. Save a backup first if you need one.','Delete everything',true)){ S=blank(); if(!await save()) return; render(); toast('All data deleted'); } break;
  }
});
document.addEventListener('submit',e=>{ e.preventDefault(); if(!ready||saving||readOnly) return; if(e.target.id==='clientForm') saveClient(e.target); if(e.target.id==='fRec') saveReceipt(e.target); if(e.target.id==='fIss') saveIssue(e.target); });
document.addEventListener('input',async e=>{
  if(e.target.id==='publicCode'){
   codeRequest++;clearTimeout(codeTimer);e.target.removeAttribute('aria-invalid');
   const code=e.target.value.trim(),status=$('#codeStatus');
   if(!/^[a-zA-Z0-9]{3,6}$/.test(code)){status.textContent=code?'Use 3–6 letters or numbers.':'';}
   else{status.textContent='Checking availability…';codeTimer=setTimeout(()=>editSharingCode(false),350);}
  }
  else if(e.target.id==='deliveryQuery'){ deliveryFilter.query=e.target.value; refreshPreservingInput('deliveryQuery'); }
  else if(e.target.id==='clientQuery'){clientQuery=e.target.value;$('#clientResults').innerHTML=clientResults();}
  else if(e.target.closest&&e.target.closest('#fRec')){
    const f=$('#fRec');
    if(e.target.name==='crop') e.target.dataset.manual='1';
    else if(e.target.name==='date'&&!f.dataset.id&&f.elements.crop&&!f.elements.crop.dataset.manual&&e.target.value) f.elements.crop.value=cropOf(e.target.value);
  }
  else if(e.target.id==='q'){ q=e.target.value; updateList(); }
  else if(e.target.id==='rq'){ rq=e.target.value; updateRList(); }
  
  else if(e.target.closest&&e.target.closest('#fIss')) updateIssueInfo();
});
document.addEventListener('change',async e=>{ if(!ready||saving) return; if(readOnly&&!e.target.dataset.delivery&&!e.target.dataset.report)return; if(e.target.id==='appearance'){ const theme=e.target.value; document.documentElement.dataset.theme=theme; try{localStorage.setItem('sugar-theme',theme);}catch{} return; }
 if(e.target.id==='lowStockPercent'){const value=Number(e.target.value); if(!Number.isFinite(value)||value<0||value>100){toast('Enter a percentage from 0 to 100.');e.target.value=threshold(S);return;} S.lowStockPercent=value;if(!await save())return;render();}
 if(e.target.dataset.delivery){deliveryFilter[e.target.dataset.delivery]=e.target.value;render();}
 if(e.target.dataset.report){reportFilter[e.target.dataset.report]=e.target.value;render();}
 if(e.target.id==='unit'){ S.unit=e.target.value.trim()||'units'; if(!await save()) return; render(); } if(e.target.closest&&e.target.closest('#fIss')) updateIssueInfo(); });
document.addEventListener('keydown',modalKeyboard,true);

function restrictPublicControls(){
 const allowed=['tab','filter','sro','close','resetDelivery'];
 document.querySelectorAll('[data-act]').forEach(el=>{
  if(['editIssue','editReceipt'].includes(el.dataset.act)){
   if(el.tagName==='BUTTON'){const display=document.createElement('div');display.className=el.className;display.innerHTML=el.innerHTML;el.replaceWith(display);}
   else{el.removeAttribute('data-act');el.removeAttribute('data-id');}
  }else if(!allowed.includes(el.dataset.act))el.remove();
 });
}
function publicLink(){return shareSettings.slug?window.location.origin+'/view/'+shareSettings.slug:window.location.origin+'/#view='+shareSettings.token;}
async function loadSharing(){
 const {data,error}=await db.from('inventory_shares').select('token,enabled,slug').eq('owner_id',accountId).single();
 shareSettings=data; shareError=error?'Public sharing could not be loaded. Try refreshing your inventory.':'';
}
function sharingPanel(){
 return '<section class="setting"><h2>Public view-only sharing</h2><p>Anyone with the link can view stock, client names, quantities and delivery references. Client contacts, notes and change history stay private. Visitors cannot edit or export records.</p>'+(shareError?'<p role="status">'+esc(shareError)+'</p>':!shareSettings?'<p>Open More again to load sharing settings.</p>':'<p><strong>'+(shareSettings.enabled?'Sharing is enabled':'Sharing is disabled')+'</strong></p>'+(shareSettings.enabled?'<label class="f">View-only link<input id="publicLink" readonly value="'+esc(publicLink())+'"></label><button class="btn" data-act="copySharing">Copy public link</button>':'')+'<label class="f">Public link code<input id="publicCode" maxlength="6" minlength="3" value="'+esc(shareSettings.slug||'')+'" autocapitalize="none" autocomplete="off" spellcheck="false" aria-describedby="codeHelp codeStatus"></label><p class="hint" id="codeHelp">Use 3–6 letters or numbers. Availability updates as you type. Saving a different code invalidates your previous link. Sharing stays off until you enable it.</p><div class="btns"><button class="btn" data-act="saveSlug">Save code</button></div><p id="codeStatus" role="status" class="hint"></p><div class="btns"><button class="btn" data-act="toggleSharing">'+(shareSettings.enabled?'Disable public sharing':'Enable public sharing')+'</button><button class="btn" data-act="rotateSharing">Replace link</button></div>')+'</section>';
}
let codeRequest=0,codeTimer;
async function editSharingCode(saveCode){
 const input=$('#publicCode'),status=$('#codeStatus');
 if(readOnly||!ready||saving||!shareSettings||!input)return;
 const code=input.value.trim().toLowerCase();if(saveCode)input.value=code;
 if(!/^[a-z0-9]{3,6}$/.test(code)){status.textContent='Use 3–6 letters or numbers.';input.setAttribute('aria-invalid','true');input.focus();return;}
 input.removeAttribute('aria-invalid');
 const request=++codeRequest;status.textContent=saveCode?'Saving code…':'Checking availability…';
 if(saveCode){saving=true;lock(true);}
 try{
  const {data,error}=await db.rpc(saveCode?'set_inventory_slug':'inventory_slug_available',{requested_slug:code});
  if(!status.isConnected||request!==codeRequest||input.value.trim().toLowerCase()!==code)return;
  if(error){status.textContent=error.code==='23505'?'This code is taken. Try another.':saveCode?'Code could not be saved. Please retry.':'Availability could not be checked. Please retry.';return;}
  if(!saveCode){status.textContent=data?'This code is available.':'This code is taken. Try another.';return;}
  await loadSharing();render();$('#codeStatus').textContent=shareError||'Code saved. Your sharing setting is unchanged.';
 }catch{if(status.isConnected)status.textContent='Could not complete the request. Please retry.';}
 finally{if(saveCode){saving=false;lock(false);}}
}
async function replaceSharingLink(){
 if(readOnly||!ready||saving||!shareSettings)return;
 saving=true;lock(true);
 try{const {error}=await db.rpc('replace_inventory_link');if(error)throw error;await loadSharing();render();toast(shareError||'Public link replaced');}
 catch(error){toast('Link could not be replaced: '+error.message);}
 finally{saving=false;lock(false);}
}
async function updateSharing(changes){
 if(readOnly||!ready||saving||!shareSettings)return;
 saving=true;lock(true);
 try{const {data,error}=await db.from('inventory_shares').update(changes).eq('owner_id',accountId).select('token,enabled,slug').single();if(error)throw error;shareSettings=data;render();toast(data.enabled?'Public link is ready':'Public sharing disabled');}
 catch(error){toast('Sharing could not be updated: '+error.message);}
 finally{saving=false;lock(false);}
}
async function showPublic(){
 document.body.classList.remove('login-screen');
 ready=false;$('#account').hidden=true;$('#nav').hidden=true;$('#signOut').hidden=true;$('#main').hidden=false;
 $('#cloudStatus').textContent='Loading public inventory…';
 $('#main').innerHTML='<p class="setting" role="status">Loading shared inventory…</p>';
 try{
  if(slugPath&&!validSlug(publicSlug))throw new Error('This sharing address is invalid.');
  if(!slugPath&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicToken))throw new Error('This sharing link is invalid.');
  const {data,error}=await db.rpc(slugPath?'get_public_inventory_by_slug':'get_public_inventory',slugPath?{share_slug:publicSlug}:{share_token:publicToken});
  if(error)throw new Error('Public sharing is not available. Ask the owner to finish sharing setup.');
  if(!data)throw new Error('This link is disabled or has been replaced. Ask the owner for a new link.');
  S=Object.assign(blank(),data);ready=true;$('#nav').hidden=false;render();lock(false);
 }catch(error){$('#main').innerHTML='<div class="empty"><b>Shared inventory unavailable</b>'+esc(error.message)+'</div>';$('#cloudStatus').textContent='Public view unavailable';}
}

function setAuthMode(mode){
 authMode=mode; const signup=mode==='signup';
 $('#accountTitle').textContent=signup?'Create your account':'Sign in to Sugar Inventory';
 $('#loginButton').textContent=signup?'Create account':'Sign in';
 $('#switchAuth').textContent=signup?'Already registered? Sign in':'Create an account';
 $('#signupNote').hidden=!signup;
 $('#password').autocomplete=signup?'new-password':'current-password';
 $('#password').minLength=signup?8:0;
 $('#accountMessage').textContent=signup?'Register with your email and a password of at least 8 characters.':'Sign in with your inventory account.';
 $('#password').value='';
}
$('#switchAuth').addEventListener('click',()=>{if(!authBusy)setAuthMode(authMode==='signup'?'signin':'signup');});
$('#loginForm').addEventListener('submit',async e=>{
 e.preventDefault(); if(!db||authBusy||readOnly)return;
 const signup=authMode==='signup'; authBusy=true;
 const button=$('#loginButton');button.disabled=true;$('#switchAuth').disabled=true;
 $('#accountMessage').textContent=signup?'Creating account…':'Signing in…';
 try{
  const credentials={email:$('#email').value.trim(),password:$('#password').value};
  const {data,error}=signup?await db.auth.signUp({...credentials,options:{emailRedirectTo:window.location.origin+'/'} }):await db.auth.signInWithPassword(credentials);
  if(error)throw error;
  $('#password').value='';
  if(signup&&!data.session){setAuthMode('signin');$('#accountMessage').textContent='Check your email for a confirmation link. After confirming, sign in to open your own private inventory.';}
  else await showAccount(data.session);
 }catch(error){$('#accountMessage').textContent=error.message;}
 finally{authBusy=false;button.disabled=false;$('#switchAuth').disabled=false;}
});
$('#signOut').addEventListener('click',async()=>{ if(saving||!db) return; const {error}=await db.auth.signOut(); if(error){toast(error.message);return;} await showAccount(null); });
$('#reloadCloud').addEventListener('click',async()=>{ if(!db||saving) return; if(readOnly){await showPublic();return;} const {data,error}=await db.auth.getSession(); if(error){toast(error.message);return;} await showAccount(data.session); });
try{document.documentElement.dataset.theme=localStorage.getItem('sugar-theme')||'auto';}catch{}
render();
if(!db){ $('#accountMessage').textContent='Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before building.'; $('#loginButton').disabled=true; }
else if(readOnly){await showPublic();}
else {
 db.auth.onAuthStateChange((event,session)=>{ if(event==='SIGNED_OUT') setTimeout(()=>showAccount(null),0); });
 const {data,error}=await db.auth.getSession();
 if(error) $('#accountMessage').textContent=error.message;
 else await showAccount(data.session);
}
})();
