import {test,expect} from '@playwright/test';
import XLSX from 'xlsx-js-style';
import {readFile} from 'node:fs/promises';

test('guests can save the shared inventory as Excel from navigation',async({page})=>{
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('**/api/activity',r=>r.fulfill({status:204,body:''}));
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>r.fulfill({json:{unit:'bags',receipts:[{id:'r1',sro:'PUBLIC-SRO',type:'Raw Sugar',qty:250,date:'2026-10-01',mill:'Test mill'}],issues:[],clients:[],seq:0}}));
 await page.goto('/view/public');
 const button=page.getByRole('button',{name:'Save as Excel Dashboard',exact:true});
 await expect(button).toBeVisible();
 const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);
 expect(download.suggestedFilename()).toMatch(/^Sugar_Inventory_.*\.xlsx$/);
 const workbook=XLSX.read(await readFile(await download.path()),{type:'buffer'});
 expect(workbook.SheetNames).toHaveLength(5);
 expect(Object.values(workbook.Sheets['SRO Quantity']).some(c=>c?.v==='PUBLIC-SRO')).toBe(true);
 await expect(button).toBeEnabled();
 await expect(button.locator('svg')).toHaveCount(1);
 await page.getByRole('button',{name:'Stock',exact:true}).click();
 await expect(page).toHaveURL(/\/view\/public\/stock$/);
 await page.getByRole('button',{name:'Reports',exact:true}).click();
 await expect(page).toHaveURL(/\/view\/public\/reports$/);
 await page.reload();
 await expect(page.locator('#title')).toHaveText('Reports');
 await page.goBack();
 await expect(page.locator('#title')).toHaveText('Stock');
 await expect(button).toBeVisible();
 await expect(page.locator('[data-act="newReceipt"], [data-act="editReceipt"], [data-act="editIssue"]')).toHaveCount(0);
});
