import {test,expect} from '@playwright/test';
test('horizontal chart hover selects the row under the pointer',async({page})=>{
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.goto('/');
 await page.evaluate(async()=>{
  document.body.innerHTML='<main style="width:min(700px,95vw);margin:0 auto"><div id="charts"></div></main>';
  const {mountCharts}=await import('/admin-charts.js');
  mountCharts(document.querySelector('#charts'),[{key:'sugar',title:'Balance by sugar type',type:'bar',horizontal:true,labels:['Raw Sugar','Refined Sugar','Washed Sugar'],datasets:[{label:'On hand',data:[9000,7500,4000]}]}]);
  // Import the exact dependency URL used by Vite so this is the renderer's Chart registry.
  const source=await (await fetch('/admin-charts.js')).text();
  const url=source.match(/from\s*["']([^"']*chart[^"']*\.js[^"']*)["']/)[1];
  window.testChart=(await import(url)).Chart.getChart(document.querySelector('canvas'));
 });
 const canvas=page.locator('canvas');await expect(canvas).toBeVisible();
 for(const [index,name] of ['Raw Sugar','Refined Sugar','Washed Sugar'].entries()){
  const point=await page.evaluate(index=>{const chart=window.testChart,bar=chart.getDatasetMeta(0).data[index];return {x:chart.chartArea.left+20,y:bar.y};},index);
  await canvas.hover({position:point});
  await expect.poll(()=>page.evaluate(()=>window.testChart.tooltip.title?.[0])).toBe(name);
  await expect.poll(()=>page.evaluate(()=>window.testChart.getActiveElements()[0]?.index)).toBe(index);
 }
});
