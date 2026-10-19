export const quantity = value => Number(value) || 0;
export const threshold = state => Math.min(100, Math.max(0, Number(state.lowStockPercent ?? 20)));
export function stockReport(state, {from='',to='',type=''}={}) {
  const rows=new Map(), receipts=new Map();
  for(const receipt of state.receipts) if(!receipts.has(receipt.sro)) receipts.set(receipt.sro,receipt);
  const selected=r=>!type||r.type===type;
  const row=r=>{const key=r.sro; if(!rows.has(key)) rows.set(key,{sro:key,type:r.type||'',mill:r.mill||'',opening:0,received:0,issued:0,closing:0});return rows.get(key);};
  state.receipts.filter(selected).forEach(r=>{
    if(to&&r.date>to) return;
    const out=row(r); if(from&&r.date<from)out.opening+=quantity(r.qty);else out.received+=quantity(r.qty);
  });
  state.issues.forEach(i=>{
    const receipt=receipts.get(i.sro);
    if(!selected({type:i.type||receipt?.type})||(to&&i.date>to))return;
    const out=row({...i,type:i.type||receipt?.type,mill:receipt?.mill});
    if(from&&i.date<from)out.opening-=quantity(i.qty);else out.issued+=quantity(i.qty);
  });
  return [...rows.values()].map(r=>({...r,closing:r.opening+r.received-r.issued})).sort((a,b)=>a.sro.localeCompare(b.sro,undefined,{numeric:true}));
}
export function matchingIssues(issues,{query='',from='',to='',client=''}={}){
 const needle=query.trim().toLowerCase();
 return issues.filter(i=>(!from||i.date>=from)&&(!to||i.date<=to)&&(!client||i.client===client)&&(!needle||[i.sro,i.atw,i.client,i.batch,i.permit,i.waybill,i.bol,i.vessel,i.voy].join(' ').toLowerCase().includes(needle)));
}
export function changeSummary(before,after){
 const parts=[];
 for(const [key,label] of [['receipts','SRO quantities'],['issues','issuance lines']]){
  const old=new Map((before[key]||[]).map(r=>[r.id,r]));
  let added=0,edited=0;
  for(const r of after[key]||[]){ if(!old.has(r.id)) added++;else if(JSON.stringify(old.get(r.id))!==JSON.stringify(r))edited++;old.delete(r.id); }
  if(added)parts.push(`${added} ${label} added`);if(edited)parts.push(`${edited} ${label} updated`);if(old.size)parts.push(`${old.size} ${label} removed`);
 }
 if(JSON.stringify(before.clients)!==JSON.stringify(after.clients)||JSON.stringify(before.clientProfiles)!==JSON.stringify(after.clientProfiles))parts.push('Client directory updated');
 if(before.unit!==after.unit||threshold(before)!==threshold(after))parts.push('Inventory settings updated');
 return parts.join('; ');
}
export function clientDirectory(state){
 const totals=new Map();
 for(const issue of state.issues){
  if(!issue.client)continue;
  let entry=totals.get(issue.client);
  if(!entry){entry={total:0,lines:0,last:''};totals.set(issue.client,entry);}
  entry.total+=quantity(issue.qty);entry.lines++;
  if(issue.date>entry.last)entry.last=issue.date;
 }
 const names=[...new Set([...(state.clients||[]),...totals.keys()].filter(Boolean))];
 return names.sort((a,b)=>a.localeCompare(b)).map(name=>({name,...(state.clientProfiles||{})[name],...(totals.get(name)||{total:0,lines:0,last:''})}));
}
