import {test,expect} from '@playwright/test';
test('Wilmar identity is readable on sign-in without horizontal overflow',async({page},info)=>{
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>r.fulfill({json:{}}));
 await page.goto('/');
 await expect(page.locator('#account .company-name')).toHaveText('WILMAR EDIBLE OIL PHILIPPINES INC.');
 await expect(page.locator('#account .product-name')).toHaveText('Sugar Inventory Monitoring');
 await expect(page.locator('#account .wilmar-logo')).toBeVisible();
 await expect.poll(()=>page.locator('#account .wilmar-logo').evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.impeccable/review/wilmar-login-'+info.project.name+'.png',fullPage:true});
});
