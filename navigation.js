export const PAGE_PATHS={stock:'/stock',dashboard:'/overview',reports:'/reports',receive:'/sro-quantity',issue:'/issuance',clients:'/clients',spreadsheet:'/spreadsheet',more:'/settings',superadmin:'/superadmin'};
export function pageFromUrl(url,{readOnly=false,isSuperadmin=false}={}){
 const requested=readOnly?url.searchParams.get('page'):Object.keys(PAGE_PATHS).find(k=>PAGE_PATHS[k]===url.pathname.replace(/\/$/,''));
 const allowed=readOnly?['stock','dashboard','issue','reports']:Object.keys(PAGE_PATHS).filter(k=>k!=='superadmin'||isSuperadmin);
 return allowed.includes(requested)?requested:'stock';
}
export function pageUrl(url,page,{readOnly=false}={}){
 const next=new URL(url);
 if(readOnly)next.searchParams.set('page',page);
 else next.pathname=PAGE_PATHS[page]||PAGE_PATHS.stock;
 return next.pathname+next.search+next.hash;
}
