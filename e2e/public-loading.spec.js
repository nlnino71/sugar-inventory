import {test,expect} from '@playwright/test';
test('public loading skips the loading card and refresh keeps current content until verified',async({page})=>{
 let release;let requests=0;
 const inventory={unit:'kg',receipts:[{id:'a',sro:'A',type:'Raw',qty:100}],issues:[],clients:[],activity:[],seq:0};
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async route=>{
  if(route.request().url().includes('/rpc/get_public_inventory')){
   requests++;await new Promise(resolve=>release=resolve);
   return route.fulfill({json:requests===3?null:inventory});
  }
  return route.fulfill({json:null});
 });
 await page.goto('/view/public');
 await expect.poll(()=>requests).toBe(1);
 await expect(page.getByText('Loading shared inventory…')).toHaveCount(0);
 await expect(page.locator('#main')).toBeHidden();
 release();await expect(page.locator('#inventoryCharts')).toBeVisible();
 await page.reload();
 await expect.poll(()=>requests).toBe(2);
 await expect(page.getByText('Loading…',{exact:true})).toHaveCount(0);
 await expect(page.locator('html')).not.toHaveClass(/public-pending/);
 await expect(page.locator('#inventoryCharts')).toBeVisible();
 await expect(page.locator('#main')).toHaveAttribute('aria-busy','true');
 release();await expect(page.locator('#main')).not.toHaveAttribute('aria-busy');
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await expect.poll(()=>requests).toBe(3);release();
 await expect(page.getByText('Shared inventory unavailable', {exact:true})).toBeVisible();
 await expect(page.locator('#inventoryCharts')).toHaveCount(0);
});
