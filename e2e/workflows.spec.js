import {test,expect} from '@playwright/test';
test('overview, stock report, delivery search and client editing',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let state={unit:'bags (LKg)',receipts:[{id:'r1',sro:'SRO-001',type:'Raw Sugar',mill:'Mill A',date:'2026-09-01',qty:100,crop:'2026-2027'}],issues:[{id:'i1',sro:'SRO-001',type:'Raw Sugar',client:'Client A',date:'2026-10-05',qty:85,seq:1,batch:'BATCH-A',atw:'ATW-100',vessel:'MV Pearl',sail:'2026-10-20'}],clients:['Client A'],seq:1};
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'staff@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async route=>{
  const url=route.request().url();
  if(url.includes('/auth/v1/token'))return route.fulfill({json:{access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,token_type:'bearer',user}});
  if(url.includes('/auth/v1/user'))return route.fulfill({json:user});
  if(url.includes('/rest/v1/rpc/save_inventory')){state=route.request().postDataJSON().new_data;return route.fulfill({json:1});}
  if(url.includes('/rest/v1/inventory'))return route.fulfill({json:{data:state,revision:0}});
  return route.fulfill({json:{}});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('staff@example.com');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Inventory at a glance'})).toBeVisible();
 await expect(page.getByRole('button',{name:/SRO-001.*Low/})).toBeVisible();
 await page.screenshot({path:'.impeccable/review/'+info.project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Reports',exact:true}).click();
 await page.locator('[data-report="from"]').fill('2026-10-01');await page.locator('[data-report="to"]').fill('2026-10-31');
 await expect(page.getByRole('cell',{name:'100.00',exact:true})).toBeVisible();
 await page.screenshot({path:'.impeccable/review/report-'+info.project.name+'.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export report CSV'}).click();expect((await download).suggestedFilename()).toContain('2026-10-01');
 await page.getByRole('button',{name:'Issuance',exact:true}).click();await page.getByLabel('Find deliveries').fill('not-present');await expect(page.getByText('No deliveries match these filters.')).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.getByText('ATW-100',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clients',exact:true}).click();await page.getByRole('button',{name:'Add client'}).click();await page.getByLabel('Client name').fill('Client B');await page.getByLabel('Contact person').fill('Maria');await page.getByLabel('Phone',{exact:true}).fill('09171234567');await page.getByRole('button',{name:'Save client'}).click();
 await expect(page.getByText('Client B',{exact:true})).toBeVisible();expect(state.clientProfiles['Client B'].contact).toBe('Maria');expect(state.activity[0].summary).toContain('Client directory updated');
 await page.screenshot({path:'.impeccable/review/clients-'+info.project.name+'.png',fullPage:true});
 await page.getByRole('button',{name:'More',exact:true}).click();await page.getByLabel('Low-stock alert').fill('10');await page.getByLabel('Low-stock alert').press('Tab');await expect(page.getByLabel('Low-stock alert')).toHaveValue('10');
 await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.getByText('No low or over-issued SROs.')).toBeVisible();
 expect(errors).toEqual([]);
});
