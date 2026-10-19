import {test,expect} from '@playwright/test';
import {navigate} from './navigation.js';
// Synthetic records are used only to verify chart rendering and reporting controls.
function stats(days,empty=false){return {days,timezone:'Asia/Manila',from:'2026-10-01',to:'2026-10-20',summary:{events:empty?0:1200,pageViews:empty?0:420,activeAccounts:empty?0:8,guestSessions:empty?0:38},daily:Array.from({length:days},(_,i)=>({day:'2026-10-'+String(i+1).padStart(2,'0'),events:empty?0:(i+1)*3,page_views:empty?0:i+1,sign_ins:empty?0:2,reported_failures:empty?0:i%2,registrations:empty?0:1})),pages:empty?[]:[{label:'stock',value:240},{label:'dashboard',value:180}],devices:empty?[]:[{label:'Phone',value:200},{label:'Desktop / other',value:220}],browsers:empty?[]:[{label:'Chrome',value:250},{label:'Safari',value:170}],sessions:empty?[]:[{label:'Guest sessions',value:38},{label:'Signed-in sessions',value:20}],changes:empty?[]:[{entity:'receipts',action:'add',value:12},{entity:'receipts',action:'edit',value:7},{entity:'issues',action:'add',value:18},{entity:'clients',action:'delete',value:2}],hours:Array.from({length:24},(_,hour)=>({hour,value:empty?0:hour*2}))};}
async function setup(page,{empty=false,missing=false}={}){
 const requested=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());await page.route('**/api/activity',r=>r.fulfill({status:204,body:''}));
 const user={id:'11111111-1111-4111-8111-111111111111',email:'jcnino16@gmail.com',aud:'authenticated',role:'authenticated'};
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
 const u=r.request().url();if(u.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'token',refresh_token:'refresh',expires_in:3600,user}});
 if(u.includes('/rpc/is_inventory_admin'))return r.fulfill({json:true});
 if(u.includes('/rpc/inventory_admin_stats')){const days=r.request().postDataJSON().days;requested.push(days);return missing?r.fulfill({status:404,json:{message:'Apply admin-stats.sql to enable statistics'}}):r.fulfill({json:stats(days,empty)});}
 if(u.includes('/rpc/inventory_admin_dashboard'))return r.fulfill({json:{totalUsers:1,accounts:[{email:user.email}],authEvents:[],events:[]}});
 if(u.includes('/inventory_shares'))return r.fulfill({json:{enabled:false,token:user.id,slug:'private'}});
 if(u.includes('/rest/v1/inventory'))return r.fulfill({json:{data:{unit:'bags',receipts:[],issues:[],clients:[],seq:0},revision:0}});
 return r.fulfill({json:null});});
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('password-example');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Inventory at a glance'})).toBeVisible();await navigate(page,'More');await page.getByRole('button',{name:'Open superadmin'}).click();return {requested,errors};
}
test('nine charts render, date range updates, theme changes and navigation clean up',async({page},info)=>{
 const {requested,errors}=await setup(page);await expect(page.locator('#adminStats canvas')).toHaveCount(9);await expect(page.locator('.admin-stats-metrics')).toContainText('1,200');
 await page.getByText('View activity over time data',{exact:true}).click();await expect(page.getByRole('table').first()).toBeVisible();
 await page.getByRole('combobox',{name:'Date range',exact:true}).selectOption('7');await expect.poll(()=>requested.at(-1)).toBe(7);await expect(page.locator('#adminStats canvas')).toHaveCount(9);
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'.impeccable/review/stats-'+info.project.name+'.png',fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const dimensions=await page.locator('#adminStats canvas').evaluateAll(nodes=>nodes.map(n=>[n.width,n.height]));expect(dimensions.every(([w,h])=>w>0&&h>0)).toBe(true);
 await page.getByRole('button',{name:'Stock',exact:true}).click();await expect(page.locator('#adminStats')).toHaveCount(0);expect(errors).toEqual([]);
});
test('empty stats show honest empty states',async({page})=>{const {errors}=await setup(page,{empty:true});await expect(page.locator('.chart-empty')).toHaveCount(9);await expect(page.locator('#adminStats canvas')).toHaveCount(0);expect(errors).toEqual([]);});
test('missing stats migration preserves admin records and shows retry',async({page})=>{await setup(page,{missing:true});await expect(page.getByText(/Statistics unavailable/)).toBeVisible();await expect(page.getByRole('button',{name:'Retry statistics'})).toBeVisible();await expect(page.getByRole('heading',{name:'Accounts (1)',exact:true})).toBeVisible();});
