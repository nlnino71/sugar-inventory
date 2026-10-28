import {test,expect} from '@playwright/test';
test('sugar chart groups three vertical metrics and pie selector switches quantities',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  document.body.innerHTML='<main style="max-width:100%;padding:16px"><div id="charts"></div></main>';
  const {mountInventory}=await import('/inventory-charts.js');
  mountInventory(document.querySelector('#charts'),{unit:'LKg',receipts:[{sro:'A',type:'Raw Sugar',qty:100},{sro:'B',type:'Refined Sugar',qty:60}],issues:[{sro:'A',qty:25}]},'2026-10-28');
 });
 await expect(page.locator('[data-chart="inventory-sugar-summary"]')).toBeVisible();
 const section=page.locator('section').filter({has:page.locator('[data-chart="inventory-sugar-summary"]')});
 await section.locator('summary').click();
 await expect(section.locator('thead')).toContainText('SRO Quantity · LKg');
 await expect(section.locator('tbody tr').first()).toContainText('75');
 await page.getByLabel('Pie chart metric').selectOption('issued');
 await expect(page.getByRole('heading',{name:'Withdrawal mix by sugar type'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/sugar-chart-'+test.info().project.name+'.png',fullPage:true});
});
