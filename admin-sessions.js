import {browserInfo} from './audit-timeline.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>{const d=new Date(value);return value&&!Number.isNaN(+d)?d.toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}):'Not recorded';};
export function sessionId(token){try{const part=String(token).split('.')[1];const claims=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));return typeof claims.session_id==='string'?claims.session_id:'';}catch{return '';}}
export function deviceType(agent=''){
 if(/iPad/i.test(agent)||(/Macintosh/i.test(agent)&&/Mobile/i.test(agent)))return 'Tablet';
 if(/iPhone|iPod|Android.*Mobile/i.test(agent))return 'Phone';
 if(/Android/i.test(agent))return 'Tablet';
 if(/Macintosh|Mac OS X|Windows|Linux|CrOS/i.test(agent))return 'Computer';
 return 'Device not identified';
}
const icon=type=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(type==='Phone'?'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>':type==='Tablet'?'<rect x="3" y="2" width="18" height="20" rx="2"/><path d="M11 18h2"/>':'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>')+'</svg>';
export function locationLabel(network={}){
 const location=[network.city,network.region,network.country].filter(Boolean).join(', ');
 if(location)return location;
 if(/^[A-Z]{2}$/.test(network.country_code||'')){try{return new Intl.DisplayNames(['en'],{type:'region'}).of(network.country_code)||network.country_code;}catch{return network.country_code;}}
 return '';
}
export function updateSessionNetwork(card,network){
 card.querySelector('[data-session-network]').textContent=[network.isp||network.org,network.asn].filter(Boolean).join(' · ')||'Not recorded';
 card.querySelector('[data-session-location]').textContent=locationLabel(network)||'Location unavailable';
}
export function hydrateSessionLocations(host,lookup){
 let stopped=false;const controller=new AbortController(),jobs=new Map();
 for(const card of host.querySelectorAll('.session-device[data-session-ip]')){
  const ip=card.dataset.sessionIp;if(!ip||card.dataset.locationKnown==='true')continue;
  if(!jobs.has(ip))jobs.set(ip,[]);jobs.get(ip).push(card);
 }
 const pending=[...jobs];let next=0;
 const worker=async()=>{while(!stopped&&next<pending.length){
  const [ip,cards]=pending[next++];for(const card of cards)card.querySelector('[data-session-location]').textContent='Looking up location…';
  try{const result=await lookup(ip,controller.signal);if(stopped)return;for(const card of cards){if(!card.isConnected)continue;updateSessionNetwork(card,result);card.dataset.locationKnown=String(!!locationLabel(result));}}
  catch{if(stopped)return;for(const card of cards)if(card.isConnected)card.querySelector('[data-session-location]').textContent='Location unavailable';}
 }};
 const done=Promise.all(Array.from({length:Math.min(3,pending.length)},worker));
 return {done,destroy(){stopped=true;controller.abort();}};
}
export function renderSessions(sessions=[],current=''){
 if(!sessions.length)return '<div class="setting dashboard-empty">No stored sign-in sessions on this page.</div>';
 const groups=new Map();for(const row of sessions){const key=row.user_id||row.email||'Unknown account';if(!groups.has(key))groups.set(key,{account:row.email||row.user_id||'Unknown account',rows:[]});groups.get(key).rows.push(row);}
 return [...groups.values()].map(({account,rows},group)=>'<section class="session-account" aria-labelledby="session-account-'+group+'"><div class="session-account-heading"><h3 id="session-account-'+group+'">'+esc(account)+'</h3><span>'+rows.length+' stored session'+(rows.length===1?'':'s')+' on this page</span></div><div class="session-devices">'+rows.map(row=>{
  const type=deviceType(row.user_agent),network=row.network||{},location=locationLabel(network),isCurrent=!!current&&row.id===current;
  return '<article class="session-device" data-session-ip="'+esc(row.ip_address||'')+'" data-location-known="'+!!location+'"><div class="session-device-heading"><span class="session-device-icon">'+icon(type)+'</span><div><h4>'+esc(browserInfo(row.user_agent||''))+'</h4><p>'+esc(type)+'</p></div>'+(isCurrent?'<span class="session-current">This session</span>':'')+'</div><dl class="session-facts"><div><dt>Approximate location</dt><dd data-session-location>'+esc(location||'Location unavailable')+'</dd></div><div><dt>IP address</dt><dd>'+esc(row.ip_address?row.ip_address.replace(/\/(?:32|128)$/,''):'Not provided')+'</dd></div><div><dt>Network provider</dt><dd data-session-network>'+esc([network.isp,network.asn].filter(Boolean).join(' · ')||'Not recorded')+'</dd></div><div><dt>Signed in</dt><dd>'+esc(date(row.created_at))+'</dd></div><div><dt>Session last updated</dt><dd>'+esc(date(row.updated_at))+'</dd></div></dl>'+(row.ip_address?'<div class="session-lookup"><button type="button" class="btn" data-ip="'+esc(row.ip_address)+'">Look up ISP</button></div>':'')+'<details class="session-technical"><summary>Session details</summary><dl class="session-facts"><div><dt>Session ID</dt><dd>'+esc(row.id||'Not recorded')+'</dd></div><div><dt>User agent</dt><dd>'+esc(row.user_agent||'Not provided')+'</dd></div></dl></details></article>';
 }).join('')+'</div></section>').join('');
}
