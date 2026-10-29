import {test,expect} from '@playwright/test';
test('shared links show both separate company inventories and keep all edits blocked',async({page})=>{
 const oil={unit:'kg',receipts:[{id:'oil',sro:'SAME',type:'Raw',qty:100,date:'2026-10-29'}],issues:[],clients:[],clientProfiles:{},activity:[],seq:0};
 const sugar={...oil,unit:'bags (LKg)',receipts:[{id:'sugar',sro:'SAME',type:'Refined',qty:25,date:'2026-10-29'}]};
 const writes=[];await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async r=>{
  const url=r.request().url();if(url.includes('/rpc/get_public_inventory'))return r.fulfill({json:{...oil,companyInventories:{sugar}}});
  if(url.includes('/rpc/save_inventory')||url.includes('/rest/v1/inventory?'))writes.push(url);
  return r.fulfill({json:null});
 });
 await page.goto('/view/company?company=sugar');
 await expect(page.getByLabel('Company',{exact:true})).toHaveValue('sugar');await expect(page.locator('.metrics')).toContainText('25.00');
 await expect(page.locator('#unitLbl')).toHaveText('Unit: bags (LKg)');
 await page.getByLabel('Company',{exact:true}).selectOption('oil');await expect(page.locator('.metrics')).toContainText('100.00');await expect(page.locator('#unitLbl')).toHaveText('Unit: kg');
 await page.reload();await expect(page.getByLabel('Company',{exact:true})).toHaveValue('oil');await expect(page.locator('.metrics')).toContainText('100.00');
 await page.getByLabel('Company',{exact:true}).selectOption('sugar');await page.locator('#nav').getByRole('button',{name:'Stock',exact:true}).click();await expect(page).toHaveURL(/company=sugar/);
 await expect(page.locator('#main')).toContainText('Refined');await expect(page.locator('#main')).not.toContainText('Raw');
 await expect(page.getByRole('button',{name:'New issuance',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Receive stock',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Spreadsheet',exact:true})).toHaveCount(0);
 expect(writes).toEqual([]);
});
