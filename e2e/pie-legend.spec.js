import {test,expect} from '@playwright/test';
test('pie slice colors match text rows and hover, focus and taps highlight both',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.goto('/');
 await page.evaluate(async()=>{
  document.body.className='workspace';document.documentElement.dataset.theme='dark';
  document.body.innerHTML='<main style="max-width:100%;padding:16px"><div id="charts"></div></main>';
  const {mountInventory}=await import('/inventory-charts.js');
  mountInventory(document.querySelector('#charts'),{unit:'LKg',receipts:[{sro:'A',type:'Raw Sugar',qty:100},{sro:'B',type:'Refined Sugar',qty:60},{sro:'C',type:'Washed Sugar',qty:40}],issues:[{sro:'A',qty:10},{sro:'B',qty:20},{sro:'C',qty:5}]});
  const source=await (await fetch('/admin-charts.js')).text();const url=source.match(/from\s*["']([^"']*chart[^"']*\.js[^"']*)["']/)[1];
  window.PieChart=(await import(url)).Chart;
 });
 const canvas=page.locator('[data-chart="inventory-mix"]'),rows=page.locator('.pie-legend-row');
 await expect(rows).toHaveCount(3);await expect(rows.nth(0)).toContainText('Raw Sugar');
 const normalTextColor=await rows.nth(0).locator('.pie-legend-name').evaluate(el=>getComputedStyle(el).color);
 const chartData=()=>page.evaluate(()=>{const chart=window.PieChart.getChart(document.querySelector('[data-chart="inventory-mix"]'));return {colors:chart.data.datasets[0].backgroundColor,active:chart.getActiveElements().map(e=>e.index)};});
 expect((await chartData()).colors).toEqual(['#0e7c7b','#e2a313','#0b6fa4']);
 await expect(rows.nth(0).locator('.pie-legend-swatch')).toHaveCSS('background-color','rgb(14, 124, 123)');
 for(let index=0;index<3;index++){
  const point=await page.evaluate(index=>window.PieChart.getChart(document.querySelector('[data-chart="inventory-mix"]')).getDatasetMeta(0).data[index].getCenterPoint(),index);
  await canvas.hover({position:point});await expect(rows.nth(index)).toHaveClass(/is-highlighted/);
  expect((await chartData()).active).toEqual([index]);
 }
 await rows.nth(1).hover();await expect(rows.nth(1)).toHaveClass(/is-highlighted/);expect((await chartData()).active).toEqual([1]);
 await rows.nth(2).focus();await expect(rows.nth(2)).toHaveClass(/is-highlighted/);expect((await chartData()).active).toEqual([2]);
 await rows.nth(0).click();await expect(rows.nth(0)).toHaveClass(/is-highlighted/);expect((await chartData()).active).toEqual([0]);
 expect(await rows.nth(0).locator('.pie-legend-name').evaluate(el=>getComputedStyle(el).color)).not.toBe(normalTextColor);
 await expect(rows.nth(0).locator('.pie-legend-name')).toHaveCSS('font-weight','600');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.admin-chart').filter({has:canvas}).screenshot({path:'/tmp/sugar-linked-pie-'+info.project.name+'.png'});
 await page.getByRole('group',{name:'Pie chart metric'}).getByRole('button',{name:'Withdrawal',exact:true}).click();
 expect((await chartData()).colors).toEqual(['#0e7c7b','#e2a313','#0b6fa4']);
 await page.evaluate(()=>{document.documentElement.dataset.theme='light';});await rows.nth(1).focus();await expect(rows.nth(1)).toHaveClass(/is-highlighted/);expect((await chartData()).active).toEqual([1]);
 expect(errors).toEqual([]);
});
