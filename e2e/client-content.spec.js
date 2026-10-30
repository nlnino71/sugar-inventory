import {test,expect} from '@playwright/test';
import {navigate,selectCompany,expectCompany} from './navigation.js';
test('matches client sections and dashboard content while preserving records and styling',async({page},info)=>{
 const state={unit:'bags (LKg)',receipts:[{id:'r1',sro:'OIL-1',type:'Raw Sugar',mill:'Oil mill',date:'2024-01-01',qty:100,crop:'2023-2024'}],issues:[{id:'i1',sro:'OIL-1',type:'Raw Sugar',date:'2024-02-01',client:'Client A',qty:25,seq:1,van:'ABC 1234'}],clients:['Client A'],clientProfiles:{'Client A':{email:'private@example.com'}},activity:[{summary:'Private history'}],seq:1,companyInventories:{sugar:{unit:'kg',receipts:[],issues:[],clients:[],seq:0}}};
 let delayInventory=false,releaseInventory;
 const writes=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'staff@example.com',app_metadata:{provider:'email'},user_metadata:{}};
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async r=>{
  const url=r.request().url();if(url.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}});
  if(url.includes('/auth/v1/user'))return r.fulfill({json:user});
  if(url.includes('/rpc/save_inventory')){writes.push(r.request().postDataJSON());return r.fulfill({json:1});}
  if(url.includes('/rest/v1/inventory_shares'))return r.fulfill({json:{enabled:true,slug:'public',token:user.id}});
  if(url.includes('/rest/v1/inventory')){if(delayInventory)await new Promise(resolve=>releaseInventory=resolve);return r.fulfill({json:{data:state,revision:0}});}
  return r.fulfill({json:null});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('#title')).toHaveText('Dashboard');
 await expect(page.locator('#inventoryCharts canvas')).toHaveCount(3);
 delayInventory=true;await page.reload();
 await expect(page.locator('#inventoryCharts canvas')).toHaveCount(3);
 await expect(page.locator('html')).not.toHaveClass(/session-pending/);
 await expect(page.locator('#main')).toHaveAttribute('inert','');
 await expect.poll(()=>typeof releaseInventory).toBe('function');releaseInventory();delayInventory=false;
 await expect(page.locator('#main')).not.toHaveAttribute('inert');
 await expect(page.locator('#inventoryCharts canvas')).toHaveCount(3);
 await expect(page.locator('#account')).toBeHidden();
 await expect(page.getByText('Connecting to Supabase…')).toHaveCount(0);
 await expect(page.locator('#nav [data-act="tab"]')).toHaveCount(6);
 expect(await page.locator('#nav [data-act="tab"]').allTextContents()).toEqual(['Dashboard','Stock','SRO Registry','Withdrawal','Clients','More']);
 await expect(page.getByText('Stock needs attention',{exact:true})).toHaveCount(0);await expect(page.getByText('Recent changes',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Inventory chart period')).toHaveCount(0);
 const graph=page.locator('.admin-chart').filter({has:page.locator('[data-chart="inventory-clients"]')});await graph.locator('summary').click();await expect(graph.locator('tbody')).toContainText('25');
 await page.screenshot({path:'/tmp/client-content-'+info.project.name+'.png',fullPage:true});
 await navigate(page,'Clients');await expect(page.locator('.client-total')).toContainText('Issued to 1 client');await expect(page.locator('.client-total-quantity')).toHaveText('25.00');await page.locator('.client-total').screenshot({path:'/tmp/client-total-'+info.project.name+'.png',animations:'disabled'});await expect(page.getByRole('button',{name:/Client A/})).toBeVisible();await expect(page.getByRole('button',{name:'Add client'})).toHaveCount(0);await expect(page.getByText('private@example.com')).toHaveCount(0);
 await navigate(page,'Withdrawal');await expect(page.locator('#main')).toContainText('ABC 1234');await expect(page.getByLabel('From',{exact:true})).toHaveCount(0);
 await navigate(page,'More');await expect(page.getByLabel('Quantity unit',{exact:true})).toHaveValue('bags (LKg)');await expect(page.getByRole('heading',{name:'Public view-only sharing'})).toBeVisible();await expect(page.getByRole('heading',{name:'Account backups'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Convert and save inventory'})).toHaveCount(0);
 await selectCompany(page,'sugar');await expect(page.getByLabel('Quantity unit',{exact:true})).toHaveValue('kg');await navigate(page,'SRO Registry');await expect(page.getByText('No SRO quantities',{exact:true})).toBeVisible();
 await selectCompany(page,'oil');await expect(page.locator('#rList')).toContainText('OIL-1');
 for(const path of ['/reports','/spreadsheet']){await page.goto(path);await expect(page.locator('#title')).toHaveText('Dashboard');}
 expect(writes).toEqual([]);expect(errors).toEqual([]);
});
