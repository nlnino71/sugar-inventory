import {test,expect} from '@playwright/test';
// Core workflows must stay available when the optional Excel CDN fails.
test.beforeEach(async({page})=>{await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());});
async function signIn(page,{failSave=false,unusualRecords=false}={}){
 const state={unit:'bags',receipts:[{id:'r',sro:'SRO-001',type:'Raw Sugar',mill:'Mill A',date:'2026-09-01',qty:100,crop:'2026-2027'}],issues:[{id:'i',sro:'SRO-001',client:'Client A',type:'Raw Sugar',date:'2026-10-01',qty:10,seq:1,batch:'B1',atw:'ATW-1'}],clients:['Client A'],seq:1};
 if(unusualRecords){state.receipts[0].sro='constructor';state.receipts[0].type='__proto__';state.receipts[0].date='<img data-audit-injection>';state.receipts[0].id='r\" data-injected=\"yes';state.issues[0].sro='constructor';state.issues[0].client='constructor';state.clients=['constructor'];}
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'staff@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',route=>{
  const url=route.request().url();
  if(url.includes('/auth/v1/token'))return route.fulfill({json:{access_token:'test-token',refresh_token:'refresh-token',expires_in:3600,token_type:'bearer',user}});
  if(url.includes('/auth/v1/user'))return route.fulfill({json:user});
  if(url.includes('/rpc/save_inventory'))return failSave?route.fulfill({status:503,json:{message:'Service unavailable'}}):route.fulfill({json:1});
  if(url.includes('/inventory'))return route.fulfill({json:{data:state,revision:0}});
  return route.fulfill({json:{}});
 });
 await page.goto('/');
 await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('main')).toHaveAttribute('id','account');
 await page.getByLabel('Email',{exact:true}).fill('staff@example.com');await page.getByLabel('Password',{exact:true}).fill('password-example');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Inventory at a glance'})).toBeVisible();await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('main')).toHaveAttribute('id','main');
}
test('modal focus is contained and restored to its trigger',async({page})=>{
 await signIn(page);const trigger=page.getByRole('button',{name:'New issuance',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'New issuance',exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator('[name=date]')).toBeFocused();
 await expect(page.locator('#nav')).toHaveAttribute('inert','');
 await dialog.getByRole('button',{name:'Save',exact:true}).focus();await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();await expect(page.locator('#nav')).not.toHaveAttribute('inert','');
});
test('ledger edits work with Enter and nested confirmation restores focus',async({page})=>{
 await signIn(page);await page.getByRole('button',{name:'Stock',exact:true}).click();await page.getByRole('button',{name:/SRO-001.*In stock/}).click();
 const edit=page.getByRole('button',{name:'Edit issuance B1',exact:true});await edit.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog',{name:'Edit issuance line',exact:true})).toBeVisible();await expect(page.locator('[name=bcode]')).toHaveValue('B1');
 const remove=page.getByRole('button',{name:'Delete',exact:true});await remove.click();
 const confirm=page.getByRole('alertdialog',{name:'Delete issuance line',exact:true});await expect(confirm).toBeVisible();await expect(confirm.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();await expect(page.locator('#sheet')).toHaveAttribute('inert','');
 await page.keyboard.press('Escape');await expect(confirm).toBeHidden();await expect(remove).toBeFocused();await expect(page.locator('#sheet')).not.toHaveAttribute('inert','');
 await expect(page.locator('#nav')).toHaveAttribute('inert','');await page.keyboard.press('Escape');await expect(page.locator('#nav')).not.toHaveAttribute('inert','');
});
test('validation announces the problem and focuses only the invalid field',async({page})=>{
 await signIn(page);await page.getByRole('button',{name:'Receive stock',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'New SRO quantity',exact:true});await dialog.locator('[name=qty]').fill('12');await dialog.getByRole('button',{name:'Save SRO quantity',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('Enter the date, SRO number');await expect(dialog.locator('[name=sro]')).toBeFocused();await expect(dialog.locator('[name=sro]')).toHaveAttribute('aria-invalid','true');await expect(dialog.locator('[name=qty]')).not.toHaveAttribute('aria-invalid','true');
});
test('a failed save preserves entered data and allows correcting or retrying',async({page})=>{
 await signIn(page,{failSave:true});await page.getByRole('button',{name:'Receive stock',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'New SRO quantity',exact:true});await dialog.locator('[name=sro]').fill('SRO-NEW');await dialog.locator('[name=qty]').fill('12');await dialog.getByRole('button',{name:'Save SRO quantity',exact:true}).click();
 await expect(page.locator('#toast')).toContainText('Save failed');await expect(dialog).toBeVisible();await expect(dialog.locator('[name=sro]')).toHaveValue('SRO-NEW');await expect(dialog.locator('[name=qty]')).toHaveValue('12');
 await expect(dialog.getByRole('button',{name:'Save SRO quantity',exact:true})).toBeEnabled();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
});

test('unusual record keys and imported markup stay inert',async({page})=>{
 await signIn(page,{unusualRecords:true});await page.getByRole('button',{name:'Stock',exact:true}).click();
 await expect(page.locator('[data-audit-injection]')).toHaveCount(0);await expect(page.getByText('<img data-audit-injection>',{exact:false}).first()).toBeVisible();
 await page.getByRole('button',{name:'SRO Qty',exact:true}).click();await expect(page.locator('[data-injected]')).toHaveCount(0);
});
