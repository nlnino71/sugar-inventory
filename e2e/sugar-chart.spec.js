import {test,expect} from '@playwright/test';
test('sugar chart groups three vertical metrics and pie selector switches quantities',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  document.body.className='workspace';
  document.body.innerHTML='<main style="max-width:100%;padding:16px"><div id="charts"></div></main>';
  const {mountInventory}=await import('/inventory-charts.js');
  mountInventory(document.querySelector('#charts'),{unit:'LKg',receipts:[{sro:'A',type:'Raw Sugar',qty:31000},{sro:'B',type:'Refined Sugar',qty:20000},{sro:'C',type:'Washed Sugar',qty:10000}],issues:[{sro:'A',qty:22000},{sro:'B',qty:12500},{sro:'C',qty:6000}]},'2026-10-28');
 });
 await expect(page.locator('[data-chart="inventory-sugar-summary"]')).toBeVisible();
 const section=page.locator('.admin-chart').filter({has:page.locator('[data-chart="inventory-sugar-summary"]')});
 await section.locator('summary').click();
 await expect(section.locator('thead')).toContainText('SRO Quantity · LKg');
 await expect(section.locator('tbody tr').first()).toContainText('9,000');
 await page.getByLabel('Pie chart metric').selectOption('issued');
 await expect(page.getByRole('heading',{name:'Withdrawal mix by sugar type'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const options=await page.evaluate(async()=>{
  const source=await (await fetch('/admin-charts.js')).text(),url=source.match(/from\s*["']([^"']*chart[^"']*\.js[^"']*)["']/)[1];
  const {Chart}=await import(url),chart=Chart.getChart(document.querySelector('[data-chart="inventory-sugar-summary"]'));
  return {labels:chart.options.plugins.barQuantityLabels.enabled,max:chart.scales.y.max,ticks:chart.scales.y.ticks.map(t=>t.label),colors:chart.data.datasets.map(d=>d.backgroundColor)};
 });
 expect(options.labels).toBe(true);expect(options.max).toBe(50000);expect(options.ticks).toEqual(['0','12.5K','25K','37.5K','50K']);
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
 await expect.poll(()=>page.evaluate(async()=>{const source=await (await fetch('/admin-charts.js')).text();const url=source.match(/from\s*["']([^"']*chart[^"']*\.js[^"']*)["']/)[1];return (await import(url)).Chart.getChart(document.querySelector('[data-chart="inventory-sugar-summary"]')).data.datasets[0].backgroundColor;})).toBe('#50bdbd');
 await section.scrollIntoViewIfNeeded();await section.screenshot({path:'/tmp/sugar-reference-bars-'+test.info().project.name+'.png'});
});
