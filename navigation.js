export const PAGE_PATHS={stock:'/stock',dashboard:'/overview',receive:'/sro-quantity',issue:'/issuance',clients:'/clients',more:'/settings',superadmin:'/superadmin'};
export function pageFromUrl(url,{readOnly=false,isSuperadmin=false}={}){
 const path=url.pathname.replace(/\/$/,'');
 const shared=path.match(/^\/view\/[^/]+(?:\/([^/]+))?$/);
 const requested=readOnly?(shared?.[1]?Object.keys(PAGE_PATHS).find(k=>PAGE_PATHS[k]==='/'+shared[1]):url.searchParams.get('page')):Object.keys(PAGE_PATHS).find(k=>PAGE_PATHS[k]===path);
 const allowed=readOnly?['stock','dashboard','issue','clients']:Object.keys(PAGE_PATHS).filter(k=>k!=='superadmin'||isSuperadmin);
 return allowed.includes(requested)?requested:'dashboard';
}
export function pageUrl(url,page,{readOnly=false}={}){
 const next=new URL(url);
 if(readOnly){
  const shared=next.pathname.match(/^\/view\/([^/]+)(?:\/[^/]+)?\/?$/);
  if(shared){
   const allowed=['stock','dashboard','issue','clients'];
   next.pathname='/view/'+shared[1]+PAGE_PATHS[allowed.includes(page)?page:'stock'];
   next.searchParams.delete('page');
  }else next.searchParams.set('page',page);
 }
 else next.pathname=PAGE_PATHS[page]||PAGE_PATHS.stock;
 return next.pathname+next.search+next.hash;
}
