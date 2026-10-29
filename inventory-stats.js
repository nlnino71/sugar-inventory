// Pure inventory aggregates; no extra data access or client contact information.
const quantity=r=>Number.isFinite(+r.qty)?+r.qty:0;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const dayOffset=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const entries=map=>[...map].sort((a,b)=>b[1]-a[1]);
export function inventorySpecs(state,days=30,end=new Date().toISOString().slice(0,10),mixMetric='balance'){
 days=[7,30,90].includes(+days)?+days:30;
 const from=dayOffset(end,1-days),receipts=state.receipts||[],issues=state.issues||[],types=new Map(),typeTotals=new Map(),firstType=new Map(),clients=new Map(),mills=new Map();
 const daily=new Map(Array.from({length:days},(_,i)=>[dayOffset(from,i),{received:0,issued:0}]));
 let opening=0,undated=0;
 for(const r of receipts)if(!firstType.has(r.sro))firstType.set(r.sro,r.type||'Unspecified');
 for(const [rows,kind,sign] of [[receipts,'received',1],[issues,'issued',-1]])for(const r of rows){
  const qty=quantity(r),type=(kind==='received'?firstType.get(r.sro):r.type||firstType.get(r.sro))||'Unspecified';types.set(type,(types.get(type)||0)+sign*qty);
  if(!typeTotals.has(type))typeTotals.set(type,{received:0,issued:0});
  typeTotals.get(type)[kind]+=qty;
  if(!validDate(r.date)){undated++;continue;}
  if(r.date<from)opening+=sign*qty;
  if(!daily.has(r.date))continue;
  daily.get(r.date)[kind]+=qty;
  const group=kind==='issued'?clients:mills,name=kind==='issued'?((r.client||'').trim()||'No client'):(r.mill||'No mill');group.set(name,(group.get(name)||0)+qty);
 }
 const labels=[...daily.keys()],values=[...daily.values()];let balance=opening;
 const balances=values.map(d=>(balance+=d.received-d.issued));
 const stock=entries(types);
 mixMetric=['received','issued','balance'].includes(mixMetric)?mixMetric:'balance';
 const metricNames={received:'SRO Quantity',issued:'Withdrawal',balance:'Balance'};
 const mix=stock.map(([type,balance])=>[type,mixMetric==='balance'?balance:typeTotals.get(type)[mixMetric]]).filter(([,qty])=>qty>0);
 const top=map=>{const all=entries(map);return all.length>8?[...all.slice(0,8),['Other (remaining '+(all.length-8)+')',all.slice(8).reduce((n,x)=>n+x[1],0)]]:all;};
 const clientRows=entries(clients),millRows=top(mills),unit=state.unit||'units';
 const spec=(key,title,note,type,labels,datasets,extra={})=>({key:'inventory-'+key,title,note,type,labels,datasets,decimals:true,emptyLabel:'inventory quantities',...extra});
 const series=(label,data)=>({label:label+' · '+unit,data});
 return {from,to:end,undated,specs:[
  spec('sugar-summary','SRO Quantity, Withdrawal and Balance by sugar type','All recorded quantities · '+unit+'. Negative balances show shortages.','bar',stock.map(x=>x[0]),[series('SRO Quantity',stock.map(([type])=>typeTotals.get(type).received)),series('Withdrawal',stock.map(([type])=>typeTotals.get(type).issued)),series('Balance',stock.map(x=>x[1]))],{wide:true,allCategories:true,referenceBars:true}),
  spec('movements','Received and issued','Daily quantities in the selected period · '+unit,'bar',labels,[series('Received',values.map(d=>d.received)),series('Issued',values.map(d=>d.issued))],{wide:true}),
  spec('balance','Running stock balance','End-of-day balance, including stock before this period. Undated records are excluded.','line',labels,[series('Balance',balances)],{wide:true}),
  spec('types','Balance by sugar type','All recorded quantities, including future and undated records. Negative values show shortages.','bar',stock.map(x=>x[0]),[series('On hand',stock.map(x=>x[1]))],{horizontal:true}),
  spec('mix',metricNames[mixMetric]+' mix by sugar type','All recorded quantities. Only positive values are included in the pie; negative balances appear in the bar graph.','pie',mix.map(x=>x[0]),[series(metricNames[mixMetric],mix.map(x=>x[1]))]),
  spec('clients','Withdrawal by client','Total withdrawals per client in the selected period · '+unit+'. Every client is shown; scroll horizontally for more clients.','bar',clientRows.map(x=>x[0]),[series('Withdrawal',clientRows.map(x=>x[1]))],{wide:true,allCategories:true,xTitle:'Client',yTitle:'Withdrawal · '+unit}),
  spec('mills','Received by mill','Quantities received in the selected period. Largest eight mills plus the remaining total.','bar',millRows.map(x=>x[0]),[series('Received',millRows.map(x=>x[1]))],{horizontal:true})
 ]};
}

// The client dashboard shows all saved records, with no date-period analytics.
export function clientDashboardSpecs(state,mixMetric='balance'){
 const specs=inventorySpecs(state,30,undefined,mixMetric).specs;
 const get=key=>specs.find(s=>s.key==='inventory-'+key);
 const clients=new Map();
 for(const issue of state.issues||[]){const name=(issue.client||'').trim()||'No client';clients.set(name,(clients.get(name)||0)+quantity(issue));}
 const rows=entries(clients),unit=state.unit||'units';
 const client={...get('clients'),note:'All recorded withdrawals per client · '+unit+'. Every client is shown; scroll horizontally for more clients.',labels:rows.map(r=>r[0]),datasets:[{label:'Withdrawal · '+unit,data:rows.map(r=>r[1])}]};
 return [{...get('mix'),wide:true,shares:true},get('sugar-summary'),client];
}
