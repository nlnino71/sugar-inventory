import {test,expect} from '@playwright/test';
test('dashboard client withdrawal bars are vertical, scrollable and cover every client',async({page},info)=>{
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.goto('/');
 await page.evaluate(async()=>{
  document.body.innerHTML='<main style="max-width:100%;padding:16px"><div id="charts"></div></main>';
  const {mountInventory}=await import('/inventory-charts.js');
  mountInventory(document.querySelector('#charts'),{unit:'kg',issues:Array.from({length:12},(_,i)=>({client:'Client '+String(i+1).padStart(2,'0'),qty:i+0.5,date:'2026-10-29'}))},'2026-10-29');
  const source=await (await fetch('/admin-charts.js')).text();
  const url=source.match(/from\s*["']([^"']*chart[^"']*\.js[^"']*)["']/)[1];
  window.clientChart=(await import(url)).Chart.getChart(document.querySelector('[data-chart="inventory-clients"]'));
 });
 const section=page.locator('section').filter({has:page.locator('[data-chart="inventory-clients"]')});
 await expect(section.getByRole('heading',{name:'Withdrawal by client',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>({axis:window.clientChart.options.indexAxis,count:window.clientChart.data.labels.length,y:window.clientChart.options.scales.y.title.text}))).toEqual({axis:'x',count:12,y:'Withdrawal · kg'});
 await section.locator('summary').click();await expect(section.locator('tbody tr')).toHaveCount(12);
 await expect(section.locator('tbody tr').first()).toContainText('Client 12');
 const scroll=section.locator('.chart-scroll');expect(await scroll.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.scrollIntoViewIfNeeded();await section.screenshot({path:'/tmp/withdrawal-client-'+info.project.name+'.png'});
});
