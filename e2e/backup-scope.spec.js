import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {navigate,selectCompany} from './navigation.js';
test('backs up and restores one company or both without cross-company changes',async({page})=>{
 const inventory=(prefix,qty)=>({unit:'kg',receipts:[{id:prefix,sro:prefix,date:'2026-10-29',type:'Raw Sugar',qty}],issues:[],clients:[],seq:0});
 let state={...inventory('OIL',100),companyInventories:{sugar:inventory('SUGAR',25)}},revision=0;const writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'staff@example.com',app_metadata:{},user_metadata:{}};
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async r=>{
  const url=r.request().url();if(url.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}});
  if(url.includes('/auth/v1/user'))return r.fulfill({json:user});
  if(url.includes('/rpc/restore_inventory_json')||url.includes('/rpc/save_inventory')){writes.push(r.request().postDataJSON());state=writes.at(-1).new_data;return r.fulfill({json:++revision});}
  if(url.includes('/rest/v1/inventory_shares'))return r.fulfill({json:{enabled:false,slug:'public',token:user.id}});
  if(url.includes('/rest/v1/inventory'))return r.fulfill({json:{data:state,revision}});
  return r.fulfill({json:null});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#nav').getByRole('button',{name:'Stock',exact:true})).toBeVisible();await navigate(page,'More');
 const section=page.getByRole('region',{name:'Backup and import'}),scope=page.getByRole('group',{name:'Backup and restore scope'});
 const download=async()=>{const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Save backup (.json)',exact:true}).click();const file=await promise;return {name:file.suggestedFilename(),data:JSON.parse(await readFile(await file.path(),'utf8'))};};
 await expect(scope.getByRole('button',{name:'Selected company',exact:true})).toHaveAttribute('aria-pressed','true');
 const oil=await download();expect(oil.name).toContain('Wilmar Edible Oil Philippines Inc.');expect(oil.data.company).toBe('oil');expect(oil.data.companyInventories).toBeUndefined();
 await selectCompany(page,'sugar');const sugar=await download();expect(sugar.data.company).toBe('sugar');expect(sugar.data.receipts[0].qty).toBe(25);
 await scope.getByRole('button',{name:'Both companies',exact:true}).click();const both=await download();expect(both.name).toContain('Both companies');expect(both.data.receipts[0].qty).toBe(100);expect(both.data.companyInventories.sugar.receipts[0].qty).toBe(25);
 await section.screenshot({path:'/tmp/backup-scope-'+test.info().project.name+'.png',animations:'disabled'});
 const upload=async data=>{const promise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Restore from backup',exact:true}).click();await (await promise).setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});};
 // A company-only file cannot masquerade as a both-company backup.
 await upload(sugar.data);await expect(page.locator('#toast')).toContainText('one company only');expect(writes).toHaveLength(0);
 // Restore only Sugar from a combined file; Oil remains untouched.
 await scope.getByRole('button',{name:'Selected company',exact:true}).click();
 both.data.companyInventories.sugar.receipts[0].qty=15;both.data.receipts[0].qty=80;
 await upload(both.data);await expect(page.getByRole('alertdialog')).toContainText('Wilmar Edible Oil Philippines Inc. stays unchanged');await page.getByRole('button',{name:'Restore',exact:true}).click();
 await expect(page.locator('#toast')).toContainText('Company backup restored');expect(state.receipts[0].qty).toBe(100);expect(state.companyInventories.sugar.receipts[0].qty).toBe(15);
 // Wrong-company labels are rejected without changing either inventory.
 await upload(oil.data);await expect(page.locator('#toast')).toContainText('belongs to Wilmar Edible Oil');expect(writes).toHaveLength(1);
 // Explicit full restore replaces both in one revision-checked operation.
 await scope.getByRole('button',{name:'Both companies',exact:true}).click();await upload(both.data);await expect(page.getByRole('alertdialog')).toContainText('BOTH');await page.getByRole('button',{name:'Restore',exact:true}).click();
 await expect(page.locator('#toast')).toContainText('Both company inventories restored');expect(state.receipts[0].qty).toBe(80);expect(state.companyInventories.sugar.receipts[0].qty).toBe(15);expect(writes).toHaveLength(2);expect(writes[1].expected_revision).toBe(1);
 await expect(section.getByRole('button',{name:'Import CSV — Wilmar Sugar Philippines Inc. only',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
