import {test,expect} from '@playwright/test';
test('stock summary cards fit five types and keep large decimal quantities on one line',async({page},info)=>{
 const types=['Refined Sugar - PREMIUM','Raw Sugar - PREMIUM','Refined Sugar - IMPORTED','Raw Sugar - STANDARD','Refined Sugar - STANDARD'];
 const state={unit:'bags (LKg)',receipts:types.map((type,i)=>({id:'r'+i,sro:'SRO-'+i,type,mill:'Test mill',date:'2026-10-01',qty:[34998.52,19328.46,18600,6594.51,4225.39][i]})),issues:[],clients:[],seq:0};
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'staff@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',route=>{
  const url=route.request().url();
  if(url.includes('/auth/v1/token'))return route.fulfill({json:{access_token:'test-token',refresh_token:'refresh-token',expires_in:3600,token_type:'bearer',user}});
  if(url.includes('/auth/v1/user'))return route.fulfill({json:user});
  if(url.includes('/rpc/get_public_inventory'))return route.fulfill({json:state});
  return route.fulfill({json:{data:state,revision:0}});
 });

 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('staff@example.com');await page.getByLabel('Password',{exact:true}).fill('password-example');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#inventoryCharts').waitFor();await page.getByRole('button',{name:'Stock',exact:true}).click();
 await expect(page.locator('.typeCard')).toHaveCount(5);await expect(page.locator('.typeCard').first().getByRole('meter',{name:'Stock remaining'})).toHaveAttribute('aria-valuenow','100');await expect(page.locator('.typeCard').first().locator('.stock-level-label')).toContainText('100%');
 const values=await page.locator('.typeCard .tbal b,.typeCard .nums b,#sroList .nums b').evaluateAll(nodes=>nodes.map(n=>{const r=document.createRange();r.selectNodeContents(n);return {lines:r.getClientRects().length,fits:n.scrollWidth<=n.clientWidth};}));expect(values.every(v=>v.lines===1&&v.fits)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('#sroList .card')).toHaveCount(5);
 await page.getByRole('searchbox',{name:'Search stock by SRO, type or mill'}).fill('SRO-0');await expect(page.locator('#sroList .card')).toHaveCount(1);await page.getByRole('searchbox',{name:'Search stock by SRO, type or mill'}).fill('');
 await page.getByRole('button',{name:'Fully issued',exact:true}).click();await expect(page.locator('#sroList')).toContainText('No SRO matches');await page.getByRole('button',{name:'In stock',exact:true}).click();await expect(page.locator('#sroList .card')).toHaveCount(5);
});
