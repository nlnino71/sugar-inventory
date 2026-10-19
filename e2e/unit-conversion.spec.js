import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {navigate} from './navigation.js';
for(const failure of [false,true])test('unit conversion persists atomically; failed save: '+failure,async({page},info)=>{
 let state={unit:'bags (LKg)',receipts:[{id:'r',sro:'A',type:'Washed Sugar',qty:100,date:'2026-10-01'}],issues:[{id:'i',sro:'A',type:'Washed Sugar',qty:85,date:'2026-10-02',client:'A'}],clients:['A'],seq:1};
 const user={id:'11111111-1111-4111-8111-111111111111',email:'units@example.com',aud:'authenticated',role:'authenticated'};
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());await page.route('**/api/activity',r=>r.fulfill({status:204,body:''}));
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
  const url=r.request().url();if(url.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'test',refresh_token:'refresh',expires_in:3600,user}});
  if(url.includes('/rpc/save_inventory')){if(failure)return r.fulfill({status:503,json:{message:'Offline'}});state=r.request().postDataJSON().new_data;return r.fulfill({json:1});}
  if(url.includes('/rpc/is_inventory_admin'))return r.fulfill({json:false});
  if(url.includes('/inventory_shares'))return r.fulfill({json:{enabled:false,token:user.id,slug:'private'}});
  if(url.includes('/rest/v1/inventory'))return r.fulfill({json:{data:state,revision:0}});return r.fulfill({json:null});
 });
 await page.goto('/');await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#account')).toBeHidden();await navigate(page,'More');
 await page.getByLabel('Convert to',{exact:true}).selectOption('kg');await expect(page.locator('#unitPreview')).toContainText('750.00 kg');
 expect(state.unit).toBe('bags (LKg)');await page.getByRole('button',{name:'Convert and save inventory'}).click();
 if(failure){await expect(page.locator('#unitLbl')).toHaveText('Unit: bags (LKg)');expect(state.receipts[0].qty).toBe(100);return;}
 await expect(page.locator('#unitLbl')).toHaveText('Unit: kg');expect(state.receipts[0].qty).toBe(5000);expect(state.issues[0].qty).toBe(4250);
 await page.getByLabel('Convert to',{exact:true}).selectOption('metric tonnes (t)');await page.getByRole('button',{name:'Convert and save inventory'}).click();await expect(page.locator('#unitLbl')).toHaveText('Unit: metric tonnes (t)');expect(state.receipts[0].qty).toBe(5);expect(state.issues[0].qty).toBe(4.25);
 const pendingDownload=page.waitForEvent('download');await page.getByRole('button',{name:'SRO Quantity (.csv)',exact:true}).click();const download=await pendingDownload;const csv=await readFile(await download.path(),'utf8');expect(csv).toContain('Unit');expect(csv).toContain('metric tonnes (t)');
 await page.screenshot({path:'.impeccable/review/units-'+info.project.name+'.png',fullPage:true});
 await page.reload();await expect(page.locator('#unitLbl')).toHaveText('Unit: metric tonnes (t)');await page.getByLabel('Convert to',{exact:true}).selectOption('bags (LKg)');await page.getByRole('button',{name:'Convert and save inventory'}).click();await expect(page.locator('#unitLbl')).toHaveText('Unit: bags (LKg)');expect(state.receipts[0].qty).toBe(100);expect(state.issues[0].qty).toBe(85);
 const pendingChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import SRO quantity or issuance CSV',exact:true}).click();const chooser=await pendingChooser;await chooser.setFiles({name:'kg.csv',mimeType:'text/csv',buffer:Buffer.from('SRO Date,SRO Number,Type of Sugar,Mill Source,Quantity,Unit\n2026-10-20,B,Washed Sugar,Mill B,1,kg')});await expect.poll(()=>state.receipts.find(r=>r.sro==='B')?.qty).toBe(0.02);
});
