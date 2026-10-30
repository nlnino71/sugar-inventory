import {test,expect} from '@playwright/test';
test('motion is brief and respects the device reduced-motion preference',async({page},info)=>{
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');
 await page.locator('#sheet').evaluate(el=>{document.body.classList.add('workspace');el.classList.add('on');});
 await expect(page.locator('#sheet')).toHaveCSS('animation-name',page.viewportSize().width>=1024?'inventory-side-sheet':'inventory-sheet');
 await expect(page.locator('#sheet')).toHaveCSS('animation-duration','0.2s');
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('#sheet')).toHaveCSS('animation-name','none');
 await expect(page.locator('#account')).toHaveCSS('animation-name','none');
 await expect(page.locator('#loginButton')).toHaveCSS('transition-duration','0s');
});
