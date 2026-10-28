import {test,expect} from '@playwright/test';
test('Wilmar identity is readable on sign-in without horizontal overflow',async({page},info)=>{
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>r.fulfill({json:{}}));
 await page.goto('/');
 await expect(page.locator('.company-name')).toHaveCount(0);
 await expect(page.locator('#account .product-name')).toHaveText('Sugar Inventory Monitoring');
 await expect(page.locator('#account .wilmar-logo')).toHaveAttribute('src','/wilmar-white.png');
 await expect(page.locator('#account .wilmar-logo')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 if(info.project.name==='desktop'){await expect(page.locator('#account .account-brand')).toBeHidden();await expect(page.locator('.login-brand .wilmar-logo')).toBeVisible();}else await expect(page.locator('#account .wilmar-logo')).toBeVisible();
 await expect.poll(()=>page.locator('#account .wilmar-logo').evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await expect(page.locator('#account .wilmar-logo')).toHaveCSS('filter','none');
 await page.screenshot({path:'.impeccable/review/wilmar-login-'+info.project.name+'.png',fullPage:true});
});
