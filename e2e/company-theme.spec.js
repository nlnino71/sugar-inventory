import {test,expect} from '@playwright/test';
import {selectCompany,expectCompany} from './navigation.js';
test('company chooser lives above the sidebar product and applies blue or teal throughout light/dark views',async({page},info)=>{
 const record=(prefix,qty)=>({unit:'kg',receipts:[{id:prefix,sro:prefix,type:'Raw Sugar',date:'2026-10-29',qty}],issues:[{id:prefix+'-issue',sro:prefix,type:'Raw Sugar',client:'Client',date:'2026-10-29',qty:5,seq:1}],clients:[],seq:1});
 const state={...record('OIL',100),companyInventories:{sugar:record('SUGAR',25)}};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('sugar-theme'))localStorage.setItem('sugar-theme','light');});
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>r.fulfill({json:state}));
 await page.goto('/view/theme');await expectCompany(page,'oil');
 const accent=()=>page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--cane').trim());
 expect(await accent()).toBe('#0e7c7b');
 if(info.project.name==='laptop'){
  const trigger=page.locator('.nav-brand .company-trigger');await expect(trigger).toBeVisible();
  expect(await trigger.evaluate(el=>el.nextElementSibling.classList.contains('product-name'))).toBe(true);
  await expect(page.locator('.company-mobile')).toBeHidden();
 }
 await page.getByRole('button',{name:'Switch company',exact:true}).click();
 const chooser=page.getByRole('dialog',{name:'Switch company',exact:true});await expect(chooser.locator('.company-choice')).toHaveCount(2);
 const triggerBounds=await page.getByRole('button',{name:'Switch company',exact:true}).boundingBox(),menuBounds=await chooser.boundingBox();
 expect(Math.abs(menuBounds.y-triggerBounds.y-triggerBounds.height-8)).toBeLessThan(2);
 await expect(page.locator('#sheet')).not.toHaveClass(/on/);await expect(page.locator('#scrim')).not.toHaveClass(/on/);
 await expect(chooser.locator('.company-choice-title').first()).toHaveText('WILMAR SUGAR PHILIPPINES INC.');
 await expect(chooser.locator('[data-company="oil"]')).toContainText('Current');await expect(chooser.locator('[data-company="sugar"]')).toContainText('1 SRO quantity · 1 withdrawal line');
 await page.getByRole('button',{name:'Switch company',exact:true}).click();await expect(chooser).toHaveCount(0);
 await page.getByRole('button',{name:'Switch company',exact:true}).click();await page.getByRole('heading',{name:'Dashboard',exact:true}).click();await expect(chooser).toHaveCount(0);
 await page.getByRole('button',{name:'Switch company',exact:true}).click();await page.keyboard.press('Home');await expect(chooser.locator('[data-company="sugar"]')).toBeFocused();
 await chooser.locator('[data-company="sugar"]').click();await expectCompany(page,'sugar');expect(await accent()).toBe('#096d9e');
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();expect(await accent()).toBe('#5bb6e8');
 await page.getByRole('button',{name:'Switch company',exact:true}).click();await expect(chooser.locator('[data-company="sugar"]')).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:'/tmp/company-chooser-'+info.project.name+'.png',fullPage:false,animations:'disabled'});
 await page.keyboard.press('Escape');await expect(chooser).toHaveCount(0);await expect(page.getByRole('button',{name:'Switch company',exact:true})).toBeFocused();await page.getByRole('button',{name:'Stock',exact:true}).click();await expect(page.locator('#sroList')).toContainText('SUGAR');await expect(page.locator('#sroList')).not.toContainText('OIL');
 await page.screenshot({path:'/tmp/company-sugar-'+info.project.name+'.png',fullPage:false,animations:'disabled'});
 await selectCompany(page,'oil');expect(await accent()).toBe('#4fc3bf');await expect(page.locator('#sroList')).toContainText('OIL');
 await page.reload();await expectCompany(page,'oil');expect(await accent()).toBe('#4fc3bf');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
