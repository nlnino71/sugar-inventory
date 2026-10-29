import {Chart,BarController,LineController,PieController,BarElement,LineElement,PointElement,ArcElement,CategoryScale,LinearScale,Tooltip,Legend} from 'chart.js';
Chart.register(BarController,LineController,PieController,BarElement,LineElement,PointElement,ArcElement,CategoryScale,LinearScale,Tooltip,Legend);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>Number(v)||0;
const pageNames={dashboard:'Overview',stock:'Stock',receive:'SRO quantity',issue:'Issuance',clients:'Clients',reports:'Reports',more:'Settings',signin:'Sign in',signup:'Sign up','public-loading':'Shared view loading','public-unavailable':'Shared view unavailable'};
export function chartSpecs(stats){
 const daily=stats.daily||[],dayLabels=daily.map(d=>d.day),series=(key,label)=>({label,data:daily.map(d=>number(d[key]))});
 const changes=['receipts','issues','clients'];
 return [
  {key:'activity',title:'Activity over time',note:'All logged events and recorded page views per day.',type:'line',wide:true,labels:dayLabels,datasets:[series('events','Logged events'),series('page_views','Page views')]},
  {key:'pages',title:'Most viewed pages',note:'Top 10 pages, including sign-in and shared-link screens.',type:'bar',horizontal:true,labels:(stats.pages||[]).map(p=>pageNames[p.label]||p.label),datasets:[{label:'Page views',data:(stats.pages||[]).map(p=>number(p.value))}]},
  {key:'sessions',title:'Guest and signed-in sessions',note:'Distinct recorded browser sessions, not unique people.',type:'pie',labels:(stats.sessions||[]).map(p=>p.label),datasets:[{label:'Sessions',data:(stats.sessions||[]).map(p=>number(p.value))}]},
  {key:'devices',title:'Device breakdown',note:'Device category inferred from browser-reported page views.',type:'bar',labels:(stats.devices||[]).map(p=>p.label),datasets:[{label:'Page views',data:(stats.devices||[]).map(p=>number(p.value))}]},
  {key:'browsers',title:'Browser breakdown',note:'Browser-reported page views. Some browsers may appear as Chrome.',type:'pie',labels:(stats.browsers||[]).map(p=>p.label),datasets:[{label:'Page views',data:(stats.browsers||[]).map(p=>number(p.value))}]},
  {key:'changes',title:'Record changes',note:'Database-confirmed changes, including imports and deletions.',type:'bar',labels:['SRO quantities','Issuance lines','Clients'],datasets:['add','edit','delete'].map((action,i)=>({label:['Added','Edited','Deleted'][i],data:changes.map(entity=>(stats.changes||[]).filter(c=>c.entity===entity&&c.action===action).reduce((sum,c)=>sum+number(c.value),0))}))},
  {key:'signins',title:'Sign-in activity',note:'Supabase sign-ins and browser-reported failed attempts.',type:'line',labels:dayLabels,datasets:[series('sign_ins','Recorded sign-ins'),series('reported_failures','Reported failures')]},
  {key:'registrations',title:'New accounts',note:'Account registrations per day from the authentication database.',type:'bar',wide:true,labels:dayLabels,datasets:[series('registrations','Registrations')]},
  {key:'hours',title:'Activity by hour',note:'All logged events, grouped by hour in Asia/Manila.',type:'bar',wide:true,labels:(stats.hours||[]).map(h=>String(h.hour).padStart(2,'0')+':00'),datasets:[{label:'Logged events',data:(stats.hours||[]).map(h=>number(h.value))}]}
 ];
}
function dataTable(spec){
 const total=spec.datasets[0].data.reduce((n,v)=>n+number(v),0);
 return '<details class="chart-values"'+(spec.shares?' open':'')+'><summary>View '+esc(spec.title.toLowerCase())+' data</summary><div class="table-scroll" tabindex="0"><table class="led"><caption>'+esc(spec.title)+'</caption><thead><tr><th>Category</th>'+spec.datasets.map(s=>'<th class="r">'+esc(s.label)+'</th>').join('')+(spec.shares?'<th class="r">% of total</th>':'')+'</tr></thead><tbody>'+spec.labels.map((label,i)=>'<tr><td>'+esc(label)+'</td>'+spec.datasets.map(s=>'<td class="r">'+number(s.data[i]).toLocaleString(undefined,{maximumFractionDigits:6})+'</td>').join('')+(spec.shares?'<td class="r">'+(total?number(spec.datasets[0].data[i])/total*100:0).toFixed(1)+'%</td>':'')+'</tr>').join('')+'</tbody></table></div></details>';
}
export function mountStats(host,stats){
 const specs=chartSpecs(stats),summary=stats.summary||{};
 host.innerHTML='<p class="hint stats-period">'+esc(stats.from)+' to '+esc(stats.to)+' · Asia/Manila · Includes today</p><dl class="metrics admin-stats-metrics">'+[['events','Logged events'],['pageViews','Page views'],['activeAccounts','Active signed-in accounts'],['guestSessions','Guest sessions']].map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+number(summary[key]).toLocaleString(undefined,{maximumFractionDigits:6})+'</dd></div>').join('')+'</dl>';
 return mountCharts(host,specs,true);
}
const barQuantityLabels={
 id:'barQuantityLabels',
 afterDatasetsDraw(chart){
  if(!chart.options.plugins.barQuantityLabels?.enabled)return;
  const ctx=chart.ctx,styles=getComputedStyle(document.documentElement);
  ctx.save();ctx.fillStyle=styles.getPropertyValue('--ink').trim();ctx.font='500 13px '+styles.getPropertyValue('--body').trim();
  ctx.textAlign='left';ctx.textBaseline='middle';
  chart.data.datasets.forEach((dataset,index)=>{
   if(!chart.isDatasetVisible(index))return;
   chart.getDatasetMeta(index).data.forEach((bar,i)=>{
    const value=Number(dataset.data[i]);if(!Number.isFinite(value))return;
    ctx.save();ctx.translate(bar.x,(value<0?bar.base:bar.y)-9);ctx.rotate(-Math.PI/2);
    ctx.fillText(value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6}),0,0);ctx.restore();
   });
  });ctx.restore();
 }
};
const niceAxis=value=>{if(!(value>0))return 1;const magnitude=10**Math.floor(Math.log10(value)),n=value/magnitude;return (n<=1?1:n<=2?2:n<=5?5:10)*magnitude;};
const shortAxis=value=>Math.abs(value)>=1e6?+(value/1e6).toFixed(2)+'M':Math.abs(value)>=1e3?+(value/1e3).toFixed(2)+'K':String(+value.toFixed(2));
export function mountCharts(host,specs,append=false){
 const markup='<div class="admin-chart-grid">'+specs.map(s=>'<section class="admin-chart'+(s.wide?' chart-wide':'')+'" aria-labelledby="chart-heading-'+s.key+'"><h3 id="chart-heading-'+s.key+'">'+esc(s.title)+'</h3><p class="hint">'+esc(s.note)+'</p>'+(s.datasets.some(d=>d.data.some(v=>v!==0))?'<div class="chart-scroll"><div class="chart-canvas"'+(s.allCategories?' style="min-width:'+Math.max(s.referenceBars?640:460,s.labels.length*(s.referenceBars?260:150))+'px'+(s.referenceBars?';height:420px':'')+'"':'')+'><canvas data-chart="'+s.key+'" role="img" aria-label="'+esc(s.title)+'. Exact values are available in the data table below."></canvas></div></div>'+dataTable(s):'<p class="chart-empty">No '+esc(s.emptyLabel|| (s.key==='changes'?'record changes':s.key==='registrations'?'registrations':'activity'))+' recorded in this period.</p>')+'</section>').join('')+'</div>';
 if(append)host.insertAdjacentHTML('beforeend',markup);else host.innerHTML=markup;
 const charts=[];
 function paint(){
  charts.splice(0).forEach(c=>c.destroy());
  const styles=getComputedStyle(document.documentElement),ink=styles.getPropertyValue('--muted').trim(),grid=styles.getPropertyValue('--line').trim(),surface=styles.getPropertyValue('--surface').trim();
  const dark=document.documentElement.dataset.theme==='dark'||(document.documentElement.dataset.theme!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);
  const colors=dark?['#80d7a6','#91bdec','#e2bc72','#cca6db','#e9a89a','#afc3ba']:['#226b4d','#456e9f','#91631b','#80608f','#a75442','#647a6e'];
  for(const spec of specs){
   const canvas=host.querySelector('[data-chart="'+spec.key+'"]');if(!canvas)continue;
   const palette=spec.referenceBars?(dark?['#50bdbd','#e2a313','#607281']:['#168484','#a96c00','#596c7b']):colors;
   const quantities=spec.datasets.flatMap(d=>d.data).map(number),maximum=niceAxis(Math.max(0,...quantities)),minimum=Math.min(0,...quantities);
   charts.push(new Chart(canvas,{plugins:[barQuantityLabels],type:spec.type,data:{labels:spec.labels,datasets:spec.datasets.map((s,i)=>({...s,backgroundColor:spec.type==='pie'?colors:palette[i%palette.length],borderColor:spec.type==='pie'?surface:palette[i%palette.length],borderWidth:spec.type==='line'?2:spec.type==='pie'?2:0,pointRadius:spec.labels.length>31?0:2,pointHitRadius:12,borderRadius:spec.type==='bar'?3:undefined,tension:0}))},options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:spec.referenceBars?Math.max(16,110-(1-Math.max(0,...quantities)/maximum)*300):0}},indexAxis:spec.horizontal?'y':'x',interaction:{mode:spec.type==='pie'?'nearest':'index',axis:spec.type==='pie'?'xy':spec.horizontal?'y':'x',intersect:spec.type==='pie'},plugins:{barQuantityLabels:{enabled:!!spec.referenceBars},legend:{display:spec.type==='pie'||spec.datasets.length>1,position:'bottom',labels:{color:ink,boxWidth:10,boxHeight:10,padding:18,font:{family:styles.getPropertyValue('--body')}}},tooltip:{callbacks:{label:context=>context.dataset.label+': '+number(spec.type==='pie'?context.parsed:spec.horizontal?context.parsed.x:context.parsed.y).toLocaleString(undefined,{maximumFractionDigits:6})}}},...(spec.type==='pie'?{}:{scales:{x:{title:{display:!!spec.xTitle,text:spec.xTitle,color:ink},grid:{display:!!spec.horizontal,color:grid},ticks:{color:ink,maxRotation:0,font:spec.referenceBars?{size:14,weight:'600'}:undefined,autoSkip:!spec.allCategories,maxTicksLimit:spec.allCategories?undefined:spec.horizontal?6:9,precision:spec.decimals?6:0},beginAtZero:!!spec.horizontal},y:{...(spec.referenceBars?{max:maximum,min:minimum<0?-niceAxis(-minimum):0}:{}),title:{display:!!spec.yTitle,text:spec.yTitle,color:ink},grid:{display:!spec.horizontal,color:grid},ticks:{color:ink,precision:spec.decimals?6:0,...(spec.referenceBars?{count:5,callback:shortAxis}: {})},beginAtZero:!spec.horizontal}}})}}));
  }
 }
 paint();
 const themeObserver=new MutationObserver(paint);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});const media=matchMedia('(prefers-color-scheme:dark)');media.addEventListener('change',paint);
 return ()=>{themeObserver.disconnect();media.removeEventListener('change',paint);charts.splice(0).forEach(c=>c.destroy());};
}
