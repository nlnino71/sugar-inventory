// Legacy records belong to Edible Oil, matching the client reference's original key.
export const COMPANIES = [
  {id:'sugar',name:'Wilmar Sugar Philippines Inc.'},
  {id:'oil',name:'Wilmar Edible Oil Philippines Inc.'}
];
export const companyName = id => COMPANIES.find(c=>c.id===id)?.name || COMPANIES[1].name;
export function companyInventory(document, id, blank) {
  const {companyInventories,...legacy}=document;
  return Object.assign(blank(),structuredClone(id==='oil'?legacy:companyInventories?.[id]||{}));
}
export function saveCompany(document, id, inventory) {
  const {companyInventories:ignored,...clean}=structuredClone(inventory);
  if(id==='oil')return {...clean,companyInventories:structuredClone(document.companyInventories||{})};
  return {...structuredClone(document),companyInventories:{...structuredClone(document.companyInventories||{}),[id]:clean}};
}
export function registryRows(state,{type='all',crop='all',query=''}={}) {
  const needle=query.trim().toLowerCase();
  return state.receipts.filter(r=>(type==='all'||(r.type||'(no type)')===type)&&(crop==='all'||r.crop===crop)&&(!needle||[r.sro,r.mill,r.crop,r.type].join(' ').toLowerCase().includes(needle)))
    .sort((a,b)=>String(a.sro).localeCompare(String(b.sro),undefined,{numeric:true,sensitivity:'base'}));
}
