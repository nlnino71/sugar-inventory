import {test,expect} from '@playwright/test';
test('pages, record views, filters and exports are reported without typed values',async({page})=>{
 const events=[];
 const user={id:'11111111-1111-4111-8111-111111111111',email:'staff@example.com',aud:'authenticated',role:'authenticated'};
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
 const u=r.request().url();
 if(u.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'token',refresh_token:'refresh',expires_in:3600,user}});
 if(u.includes('/rpc/record_inventory_events')){events.push(...r.request().postDataJSON().events);return r.fulfill({status:204,body:''});}
 if(u.includes('/rpc/is_inventory_admin'))return r.fulfill({json:false});
 if(u.includes('/rest/v1/inventory'))return r.fulfill({json:{data:{unit:'bags',receipts:[{id:'r1',sro:'SRO-TRACK',type:'Raw Sugar',qty:10,date:'2026-10-20'}],issues:[],clients:[],seq:0},revision:0}});
 return r.fulfill({json:null});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('PRIVATE-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Inventory at a glance'})).toBeVisible();await page.getByRole('button',{name:'Stock',exact:true}).click();await page.getByRole('button',{name:/SRO-TRACK.*In stock/}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByLabel('Search stock by SRO, type or mill').fill('PRIVATE-search');await page.getByLabel('Search stock by SRO, type or mill').press('Tab');
 await expect.poll(()=>events.filter(e=>e.event==='page.view').length).toBe(2);
 await expect.poll(()=>events.some(e=>e.event==='field.change')).toBe(true);
 expect(events.some(e=>e.event==='panel.view')).toBe(true);expect(events.some(e=>e.event==='panel.close')).toBe(true);
 expect(JSON.stringify(events)).not.toContain('PRIVATE-password');expect(JSON.stringify(events)).not.toContain('PRIVATE-search');expect(events.find(e=>e.event==='page.view').details.device.screen).toMatch(/\d+ × \d+/);
});
