import {test,expect} from '@playwright/test';
import {navigate} from './navigation.js';
async function setup(page,{empty=false,missing=false}={}){
 const calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:'11111111-1111-4111-8111-111111111111',email:'jcnino16@gmail.com',aud:'authenticated',role:'authenticated'};
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());await page.route('**/api/activity',r=>r.fulfill({status:204,body:''}));
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
  const url=r.request().url();if(url.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'token',refresh_token:'refresh',expires_in:3600,user}});
  if(url.includes('/rpc/is_inventory_admin'))return r.fulfill({json:true});
  if(url.includes('/rpc/inventory_admin_dashboard'))return r.fulfill({json:{totalUsers:1,accounts:[],events:[],authEvents:[],authSessions:[]}});
  if(url.includes('/rpc/inventory_admin_traffic')){
   const args=r.request().postDataJSON();calls.push(args);if(missing)return r.fulfill({status:404,json:{message:'Install visitor-traffic.sql'}});
   const total=empty||args.search_text==='no-match'?0:args.page_filter?12:60;
   return r.fulfill({json:{from:args.range_key==='all'?null:'2026-10-15T00:00:00+08:00',to:'2026-10-21T09:00:00+08:00',summary:{pageViews:total,visitors:total?6:0,mobilePct:total?50:0,topCountry:total?'Philippines':null},pageOptions:[{page:'stock'},{page:'/view/public · dashboard'}],pages:total?[{page:'stock',views:total,visitors:6,last_view:'2026-10-21T09:00:00+08:00'}]:[],locations:total?[{label:'Philippines',value:total}]:[],systems:total?[{label:'Android',value:total}]:[],browsers:total?[{label:'Chrome',value:total}]:[],logs:Array.from({length:Math.min(total,50)},(_,i)=>({id:i,occurred_at:'2026-10-21T09:00:00+08:00',visitor_kind:'Guest session',page:'stock',ip:'203.0.113.10',country:'Philippines',isp:'Example ISP',asn:'AS64500',device:'Phone',os:'Android',browser:'Chrome',screen:'390 × 844'})),totalLogs:total,pageNumber:args.page_number}});
  }
  if(url.includes('/inventory_shares'))return r.fulfill({json:{enabled:false,token:user.id,slug:'private'}});
  if(url.includes('/rest/v1/inventory'))return r.fulfill({json:{data:{unit:'bags (LKg)',receipts:[],issues:[],clients:[],seq:0},revision:0}});return r.fulfill({json:null});
 });
 await page.goto('/');await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#account')).toBeHidden();await navigate(page,'More');await page.getByRole('button',{name:'Open superadmin',exact:true}).click();return {calls,errors};
}
test('visitor traffic filters, pagination, theme and responsive reporting',async({page},info)=>{
 const {calls,errors}=await setup(page);const traffic=page.locator('#adminTraffic');await expect(traffic.locator('.traffic-metrics')).toContainText('60');
 await traffic.getByRole('button',{name:'Next visits',exact:true}).click();await expect.poll(()=>calls.at(-1)?.page_number).toBe(1);
 for(const [name,key] of [['Today','today'],['Last 24 hours','24h'],['Last 30 days','30d'],['All time','all'],['Last 7 days','7d']]){await traffic.getByRole('button',{name,exact:true}).click();await expect.poll(()=>calls.at(-1)?.range_key).toBe(key);await expect.poll(()=>calls.at(-1)?.page_number).toBe(0);}
 await page.getByLabel('Traffic page',{exact:true}).selectOption('stock');await page.getByLabel('Search traffic',{exact:true}).fill('Example ISP');await page.getByRole('button',{name:'Filter traffic',exact:true}).click();await expect.poll(()=>calls.at(-1)?.page_filter).toBe('stock');await expect.poll(()=>calls.at(-1)?.search_text).toBe('Example ISP');await expect(traffic.locator('.traffic-metrics')).toContainText('12');
 await page.getByLabel('Search traffic',{exact:true}).fill('no-match');await page.getByRole('button',{name:'Filter traffic',exact:true}).click();await expect(traffic.getByText('No matching page traffic.',{exact:true})).toBeVisible();await expect(traffic.getByText('Not available',{exact:true})).toBeVisible();
 await traffic.getByRole('button',{name:'Clear',exact:true}).click();await expect(traffic.locator('.traffic-metrics')).toContainText('60');await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await traffic.locator('.traffic-ranking-grid').screenshot({path:'.impeccable/review/visitor-rankings-'+info.project.name+'.png'});await traffic.locator('.traffic-filters').screenshot({path:'.impeccable/review/visitor-filters-'+info.project.name+'.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Stock',exact:true}).click();await expect(page.locator('#adminTraffic')).toHaveCount(0);expect(errors).toEqual([]);
});
test('empty and unavailable visitor traffic stay honest',async({page})=>{
 await setup(page,{empty:true});await expect(page.locator('#adminTraffic .traffic-metrics')).toContainText('Not available');await expect(page.getByText('No page views match these filters. Try another period or clear the filters.',{exact:true})).toBeVisible();
});
test('traffic database error offers retry without hiding admin records',async({page})=>{
 await setup(page,{missing:true});await expect(page.getByText(/Visitor traffic unavailable/)).toBeVisible();await expect(page.getByRole('button',{name:'Retry visitor traffic',exact:true})).toBeVisible();await page.getByRole('tab',{name:'Accounts',exact:true}).click();await expect(page.getByRole('heading',{name:'Accounts (1)',exact:true})).toBeVisible();
});
