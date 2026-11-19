import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import XLSX from 'xlsx-js-style';
import {navigate,selectCompany} from './navigation.js';

test('ATW registry saves manual withdrawals by company and exports both ATW worksheets',async({page})=>{
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'staff@example.com',app_metadata:{},user_metadata:{}};
 let state={unit:'bags',receipts:[],issues:[{id:'i1',sro:'SRO-1',atw:' atw-1 ',qty:25}],clients:[],seq:1};
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
  const url=r.request().url();
  if(url.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,user}});
  if(url.includes('/rpc/save_inventory')){
   state=r.request().postDataJSON().new_data;
   return r.fulfill({json:1});
  }
  if(url.includes('/rest/v1/inventory?'))return r.fulfill({json:{data:state,revision:0}});
  return r.fulfill({json:null});
 });
 await page.goto('/');
 await page.getByLabel('Email',{exact:true}).fill(user.email);
 await page.getByLabel('Password',{exact:true}).fill('password-example');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('#nav')).toBeVisible();
 await navigate(page,'ATW Registry');
 await expect(page).toHaveURL(/\/atw-registry$/);
 await page.getByRole('button',{name:'New ATW',exact:true}).click();
 const form=page.locator('#fAtw');
 await form.getByLabel('ATW No.').fill('ATW-1');
 await form.getByLabel('Source mill').fill('Mill A');
 await form.getByLabel('Total ATW Quantity').fill('100');
 await expect(form.getByLabel('Withdrawal Quantity')).toHaveValue('0');
 await form.getByLabel('Withdrawal Quantity').fill('105');
 await expect(form.getByRole('status')).toHaveText('Balance: -5.00');
 await form.getByRole('button',{name:'Save ATW'}).click();
 await expect(page.getByRole('heading',{name:'Withdrawal exceeds total'})).toBeVisible();
 await page.locator('#dNo').click();
 await expect(form.getByLabel('Withdrawal Quantity')).toHaveValue('105');
 await form.getByLabel('Withdrawal Quantity').fill('30.5');
 await expect(form.getByRole('status')).toHaveText('Balance: 69.50');
 await form.getByLabel('DR #').fill('DR-1');
 await form.getByRole('button',{name:'Save ATW'}).click();
 const registry=page.getByRole('region',{name:'ATW records'});
 await expect(registry.getByRole('button',{name:'Edit ATW ATW-1'})).toContainText('69.50');
 await page.getByRole('button',{name:/^Shipped 0$/}).click();
 await expect(registry).toContainText('No ATW matches');
 await page.getByRole('button',{name:/^Show all/}).click();
 await page.getByRole('searchbox',{name:'Search ATW registry'}).fill('DR-1');
 await expect(registry.getByRole('button',{name:'Edit ATW ATW-1'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'ATW Registry',exact:true}).first()).toBeVisible();
 await navigate(page,'Dashboard');
 await expect(page.locator('[data-chart="atw-mill"]')).toBeVisible();
 await navigate(page,'ATW Registry');
 await selectCompany(page,'sugar');
 await expect(page.getByText('No ATWs recorded yet.',{exact:false})).toBeVisible();
 await selectCompany(page,'oil');
 await expect(registry).toContainText('Not shipped');
 await page.getByRole('button',{name:'Edit ATW ATW-1'}).click();
 await expect(form.getByLabel('Withdrawal Quantity')).toHaveValue('30.5');
 await page.locator('#sheet').getByRole('button',{name:'Close'}).click();
 await navigate(page,'More');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Excel ATW Registry.*Wilmar Edible Oil/}).click()]);
 const book=XLSX.read(await readFile(await download.path()),{type:'buffer'});
 for(const name of ['ATW Registry','Not Shipped']){
  expect(XLSX.utils.sheet_to_json(book.Sheets[name],{range:4})[0]).toMatchObject({'ATW No.':'ATW-1','DR #':'DR-1','Total ATW Quantity':100,'Withdrawal Quantity':30.5,Balance:69.5});
 }
 expect(book.SheetNames).toEqual(['ATW Registry','Not Shipped']);
 expect(book.Sheets['ATW Registry'].A5.v).toBe('ATW No.');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 const [dashboard]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Excel dashboard.*Wilmar Edible Oil/}).click()]);
 const dashboardBook=XLSX.read(await readFile(await dashboard.path()),{type:'buffer'});
 expect(dashboardBook.SheetNames).toEqual(['Dashboard','SRO Registry','Withdrawal','SRO Balance','Client Summary']);
 expect(Object.values(dashboardBook.Sheets.Dashboard).some(cell=>cell?.v==='Mill A')).toBe(true);
});
