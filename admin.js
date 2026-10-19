const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function deviceInfo(){return {userAgent:navigator.userAgent.slice(0,512),platform:navigator.userAgentData?.platform||navigator.platform,language:navigator.language,screen:`${screen.width} × ${screen.height}`,viewport:`${innerWidth} × ${innerHeight}`,pixelRatio:devicePixelRatio,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};}
export function openAdmin(db,host){
 let currentPage=0,selectedDays=30,disposed=false,statsTicket=0,request=0,statsCache=null;
 let destroyCharts=()=>{};
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
   statsCache={days,data:stats};destroyCharts=mountStats(slot,stats);
  }catch(error){if(!disposed&&ticket===statsTicket&&slot.isConnected)slot.innerHTML='<p class="info" role="status">Statistics unavailable: '+escape(error.message)+'</p><button class="btn" data-admin="statsRetry">Retry statistics</button>';}
 }

 const networkLabel=n=>n?[n.isp,n.asn,n.country].filter(Boolean).map(escape).join(' · '):'';
 const date=v=>v?escape(new Date(v).toLocaleString()):'Not recorded';
 const table=(heads,rows)=>'<div class="table-scroll" tabindex="0"><table class="led"><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
 async function load(){
 const ticket=++request;++statsTicket;destroyCharts();destroyCharts=()=>{};
 host.innerHTML='<p role="status">Loading private admin records…</p>';
 const {data,error}=await db.rpc('inventory_admin_dashboard',{page_number:currentPage});
 if(disposed||ticket!==request)return;
 if(error||!data||!Array.isArray(data.accounts)){host.innerHTML='<p class="alert" role="alert">'+escape(error?.message||'Admin setup is not installed.')+'</p><button class="btn" data-admin="retry">Retry</button>';return;}
 host.innerHTML='<div class="overview-heading"><div><h2>Superadmin</h2><p>Private account and security overview</p></div><button class="btn" data-admin="retry">Refresh admin records</button></div><p class="info">Authentication IPs are supplied by Supabase when available. Device details are browser-reported. IPs can represent VPNs or shared networks.</p><section class="admin-statistics" aria-labelledby="adminStatisticsHeading"><div class="stats-toolbar"><div><h2 id="adminStatisticsHeading">Statistics</h2><p class="hint">Full-period totals, independent of the log pages below.</p></div><label class="f">Date range<select id="adminStatsRange"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label></div><div id="adminStats"></div></section><div class="sec"><h2>Accounts ('+escape(data.totalUsers)+')</h2></div>'+table(['Account','Registered / last sign-in','Inventory','Sharing'],data.accounts.map(a=>'<tr><td>'+escape(a.email)+'<small>'+escape(a.id)+'</small></td><td>'+date(a.created_at)+'<small>'+date(a.last_sign_in_at)+'</small></td><td>'+escape(a.receipts)+' SRO lines / '+escape(a.issues)+' issuance lines<small>Revision '+escape(a.revision??0)+'</small></td><td>'+ (a.sharing_enabled?'Enabled':'Disabled')+'</td></tr>'))+
 '<div class="sec"><h2>Authentication & IP history</h2></div>'+table(['Time','Account / action','IP address','Network'],data.authEvents.map(a=>'<tr><td>'+date(a.created_at)+'</td><td>'+escape(a.email||a.actor_id||'Unknown')+'<small>'+escape(a.action)+'</small></td><td>'+escape(a.ip_address||'Not provided')+'</td><td>'+(a.ip_address?'<small>'+networkLabel(a.network)+'</small><button class="btn" data-ip="'+escape(a.ip_address)+'">Look up ISP</button>':'Unavailable')+'</td></tr>'))+
 '<div class="sec"><h2>Complete activity timeline</h2></div><p class="hint">Confirmed changes include before/after values from database triggers. Browser events cover pages, panels, controls, forms, filters, exports and visibility; delivery is best effort. Session IPs come from authentication and may differ from the current request. Browser event times and device reports can be spoofed.</p>'+table(['Time / account','Event','Details','IP address'],data.events.map(a=>'<tr><td>'+date(a.occurred_at)+'<small>'+escape(a.email||a.actor_id||(a.event?.startsWith('guest.')?'Guest':'System'))+'</small></td><td>'+escape(a.event)+'</td><td>'+Object.entries(a.details?.device||a.details||{}).map(([k,v])=>'<div><strong>'+escape(k)+':</strong> '+escape(typeof v==='object'?JSON.stringify(v):v)+'</div>').join('')+'</td><td>'+escape(a.details?.request_network?.ip||a.details?.server_session?.ip||'Not provided')+'<small>'+networkLabel(a.network||a.details?.network)+'</small>'+((a.details?.request_network?.ip||a.details?.server_session?.ip)?'<div><button class="btn" data-ip="'+escape(a.details.request_network?.ip||a.details.server_session?.ip)+'">Look up ISP</button></div>':'')+'</td></tr>'))+'<div class="btns"><button class="btn" data-admin="previous"'+(currentPage===0?' disabled':'')+'>Previous</button><span>Page '+(currentPage+1)+' · 50 per list</span><button class="btn" data-admin="next"'+([data.accounts,data.authEvents,data.events].every(a=>a.length<50)?' disabled':'')+'>Next</button></div>';
 host.querySelector('#adminStatsRange').value=String(selectedDays);void loadStats();
 }
 host.onchange=e=>{if(e.target.id==='adminStatsRange'){selectedDays=Number(e.target.value);void loadStats();}};
 host.onclick=async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.admin==='statsRetry'){statsCache=null;await loadStats();return;}
 if(b.dataset.admin){if(b.dataset.admin==='retry')statsCache=null;if(b.dataset.admin==='next')currentPage++;if(b.dataset.admin==='previous')currentPage=Math.max(0,currentPage-1);await load();}
 if(b.dataset.ip){b.disabled=true;try{const {data}=await db.auth.getSession();const response=await fetch('/api/ip-info',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({ip:b.dataset.ip})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Lookup unavailable');b.parentElement.textContent=[result.org,result.city,result.region,result.country].filter(Boolean).join(' · ')||'Network not provided';}catch(error){b.parentElement.append(document.createTextNode(' '+error.message));b.disabled=false;}}
 };
 void load();
 return ()=>{disposed=true;++request;++statsTicket;destroyCharts();host.onclick=null;host.onchange=null;};
}
