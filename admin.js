import {renderSessions,sessionId,hydrateSessionLocations,updateSessionNetwork} from './admin-sessions.js';
import {renderAuditTimeline} from './audit-timeline.js';
import {mountTraffic} from './visitor-traffic.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function deviceInfo(){return {userAgent:navigator.userAgent.slice(0,512),platform:navigator.userAgentData?.platform||navigator.platform,language:navigator.language,screen:`${screen.width} × ${screen.height}`,viewport:`${innerWidth} × ${innerHeight}`,pixelRatio:devicePixelRatio,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};}
export function openAdmin(db,host){
 let currentPage=0,selectedDays=30,disposed=false,statsTicket=0,request=0,statsCache=null;
 const tabs=[['traffic','Traffic'],['statistics','Statistics'],['accounts','Accounts'],['authentication','Authentication'],['sessions','Sessions'],['activity','Activity']];
 let selectedTab='traffic';try{const saved=sessionStorage.getItem('sugar-admin-section');if(tabs.some(([key])=>key===saved))selectedTab=saved;}catch{}
 let recordData=null,trafficMounted=false,statsMounted=false,sessionsMounted=false;
 let destroyCharts=()=>{},destroyTraffic=()=>{},destroySessions=()=>{};
 const panel=(key)=>'<section id="admin-panel-'+key+'" role="tabpanel" aria-labelledby="admin-tab-'+key+'" tabindex="0" hidden>';
 function activateTab(key,focus=false){
  selectedTab=key;try{sessionStorage.setItem('sugar-admin-section',key);}catch{}
  for(const [id] of tabs){const button=host.querySelector('#admin-tab-'+id),slot=host.querySelector('#admin-panel-'+id);if(!button||!slot)continue;button.setAttribute('aria-selected',String(id===key));button.tabIndex=id===key?0:-1;slot.hidden=id!==key;if(focus&&id===key)button.focus();}
  const pager=host.querySelector('[data-admin-pagination]');if(pager){pager.hidden=['traffic','statistics'].includes(key);const rows={accounts:recordData?.accounts,authentication:recordData?.authEvents,sessions:recordData?.authSessions,activity:recordData?.events}[key]||[];pager.querySelector('[data-admin="next"]').disabled=rows.length<50;}
  if(key==='traffic'&&!trafficMounted){trafficMounted=true;destroyTraffic=mountTraffic(db,host.querySelector('#adminTraffic'));}
  if(key==='statistics'&&!statsMounted){statsMounted=true;void loadStats();}
  if(key==='sessions'&&!sessionsMounted){sessionsMounted=true;const loader=hydrateSessionLocations(host.querySelector('#admin-panel-sessions'),async(ip,signal)=>{const {data}=await db.auth.getSession();const response=await fetch('/api/ip-info',{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({ip})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Lookup unavailable');return result;});destroySessions=()=>loader.destroy();}
 }

 async function loadStats(){
  const slot=host.querySelector('#adminStats');if(!slot||disposed)return;
  const ticket=++statsTicket;destroyCharts();destroyCharts=()=>{};
  slot.innerHTML='<div class="stats-loading" role="status">Loading statistics…</div>';
  const days=selectedDays;
  try{
   let stats=statsCache?.days===days?statsCache.data:null;
   if(!stats){const {data,error}=await db.rpc('inventory_admin_stats',{days});if(error)throw error;if(!data||!Array.isArray(data.daily))throw new Error('Apply the admin-stats.sql database upgrade to enable charts.');stats=data;}
   const {mountStats}=await import('./admin-charts.js');
   if(disposed||ticket!==statsTicket||!slot.isConnected)return;
   if(selectedTab!=='statistics'){statsMounted=false;return;}
   statsCache={days,data:stats};destroyCharts=mountStats(slot,stats);
  }catch(error){if(!disposed&&ticket===statsTicket&&slot.isConnected)slot.innerHTML='<p class="info" role="status">Statistics unavailable: '+escape(error.message)+'</p><button class="btn" data-admin="statsRetry">Retry statistics</button>';}
 }

 const networkLabel=n=>n?[n.isp,n.asn,n.country].filter(Boolean).map(escape).join(' · '):'';
 const date=v=>v?escape(new Date(v).toLocaleString()):'Not recorded';
 const table=(heads,rows,empty='No records on this page.')=>'<div class="table-scroll" tabindex="0"><table class="led"><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+heads.length+'" class="hint">'+escape(empty)+'</td></tr>')+'</tbody></table></div>';
 async function load(){
 trafficMounted=false;statsMounted=false;sessionsMounted=false;destroySessions();destroySessions=()=>{};
 const ticket=++request;++statsTicket;destroyCharts();destroyCharts=()=>{};destroyTraffic();destroyTraffic=()=>{};
 host.innerHTML='<p role="status">Loading private admin records…</p>';
 const [{data,error},auth]=await Promise.all([db.rpc('inventory_admin_dashboard',{page_number:currentPage}),db.auth.getSession().catch(()=>null)]);
 if(disposed||ticket!==request)return;
 if(error||!data||!Array.isArray(data.accounts)){host.innerHTML='<p class="alert" role="alert">'+escape(error?.message||'Admin setup is not installed.')+'</p><button class="btn" data-admin="retry">Retry</button>';return;}
 recordData=data;
 host.innerHTML='<div class="overview-heading"><div><h2>Superadmin</h2><p>Private account and security overview</p></div><button class="btn" data-admin="retry">Refresh admin records</button></div><p class="info">Authentication IPs are supplied by Supabase when available. Device details are browser-reported. IPs can represent VPNs or shared networks.</p><div class="admin-tabs" role="tablist" aria-label="Superadmin sections">'+tabs.map(([key,label])=>'<button type="button" role="tab" id="admin-tab-'+key+'" aria-controls="admin-panel-'+key+'" aria-selected="false" tabindex="-1" data-admin-tab="'+key+'">'+label+'</button>').join('')+'</div>'+panel('traffic')+'<section id="adminTraffic" aria-label="Visitor and page traffic"></section></section>'+panel('statistics')+'<section class="admin-statistics" aria-labelledby="adminStatisticsHeading"><div class="stats-toolbar"><div><h2 id="adminStatisticsHeading">Statistics</h2><p class="hint">Full-period totals, independent of the log pages below.</p></div><label class="f">Date range<select id="adminStatsRange"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label></div><div id="adminStats"></div></section></section>'+panel('accounts')+'<div class="sec"><h2>Accounts ('+escape(data.totalUsers)+')</h2></div>'+table(['Account','Registered / last sign-in','Inventory','Sharing'],data.accounts.map(a=>'<tr><td>'+escape(a.email)+'<small>'+escape(a.id)+'</small></td><td>'+date(a.created_at)+'<small>'+date(a.last_sign_in_at)+'</small></td><td>'+escape(a.receipts)+' SRO lines / '+escape(a.issues)+' issuance lines<small>Revision '+escape(a.revision??0)+'</small></td><td>'+ (a.sharing_enabled?'Enabled':'Disabled')+'</td></tr>'))+
 '</section>'+panel('authentication')+'<div class="sec"><h2>Authentication & IP history</h2></div>'+table(['Time','Account / action','IP address','Network'],data.authEvents.map(a=>'<tr><td>'+date(a.created_at)+'</td><td>'+escape(a.email||a.actor_id||'Unknown')+'<small>'+escape(a.action)+'</small></td><td>'+escape(a.ip_address||'Not provided')+'</td><td>'+(a.ip_address?'<small>'+networkLabel(a.network)+'</small><button class="btn" data-ip="'+escape(a.ip_address)+'">Look up ISP</button>':'Unavailable')+'</td></tr>'),currentPage===0?'No authentication audit records yet. New events appear here after Supabase database audit logging is enabled.':'No authentication audit records on this page.')+
 '</section>'+panel('sessions')+'<div class="sec"><h2>Where users are signed in</h2></div><p class="hint">Stored authentication sessions, grouped by account. Device names come from browser reports. IPs and approximate locations reflect the stored sign-in; a session record does not guarantee the device is online. Times use Philippine time (UTC+8).</p>'+renderSessions(data.authSessions||[],sessionId(auth?.data?.session?.access_token))+
 '</section>'+panel('activity')+'<div class="sec"><h2>Complete activity timeline</h2></div><p class="hint">Confirmed changes include before/after values from database triggers. Browser events cover pages, panels, controls, forms, filters, exports and visibility; delivery is best effort. Session IPs come from authentication and may differ from the current request. Browser event times and device reports can be spoofed. Timeline times use Philippine time (UTC+8).</p>'+renderAuditTimeline(data.events)+'</section><div class="btns" data-admin-pagination><button class="btn" data-admin="previous"'+(currentPage===0?' disabled':'')+'>Previous</button><span>Page '+(currentPage+1)+' · 50 records per page</span><button class="btn" data-admin="next"'+([data.accounts,data.authEvents,data.authSessions||[],data.events].every(a=>a.length<50)?' disabled':'')+'>Next</button></div>';
 host.querySelector('#adminStatsRange').value=String(selectedDays);activateTab(selectedTab);
 }
 host.onchange=e=>{if(e.target.id==='adminStatsRange'){selectedDays=Number(e.target.value);void loadStats();}};
 host.onclick=async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.adminTab){if(currentPage!==0){currentPage=0;selectedTab=b.dataset.adminTab;await load();host.querySelector('#admin-tab-'+selectedTab)?.focus();}else activateTab(b.dataset.adminTab,true);return;}
 if(b.dataset.admin==='statsRetry'){statsCache=null;await loadStats();return;}
 if(b.dataset.admin){if(b.dataset.admin==='retry')statsCache=null;if(b.dataset.admin==='next')currentPage++;if(b.dataset.admin==='previous')currentPage=Math.max(0,currentPage-1);await load();}
 if(b.dataset.ip){b.disabled=true;try{const {data}=await db.auth.getSession();const response=await fetch('/api/ip-info',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({ip:b.dataset.ip})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Lookup unavailable');const card=b.closest('.session-device');if(card)updateSessionNetwork(card,result);b.parentElement.textContent=[result.org,result.city,result.region,result.country].filter(Boolean).join(' · ')||'Network not provided';}catch(error){b.parentElement.append(document.createTextNode(' '+error.message));b.disabled=false;}}
 };
 host.onkeydown=e=>{const button=e.target.closest('[role="tab"]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=tabs.findIndex(([key])=>key===button.dataset.adminTab);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;host.querySelector('#admin-tab-'+tabs[next][0]).click();};
 void load();
 return ()=>{disposed=true;++request;++statsTicket;destroyCharts();destroyTraffic();destroySessions();host.onclick=null;host.onchange=null;host.onkeydown=null;};
}
