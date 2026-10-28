import {test,expect} from '@playwright/test';
test('restoring a JSON file uses one bulk operation and one history entry',async({page})=>{
 const user={id:'11111111-1111-4111-8111-111111111111',email:'restore@example.com',aud:'authenticated',role:'authenticated'};
 let state={unit:'bags',receipts:[],issues:[],clients:[],seq:0,activity:[]},calls=[];
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('**/api/activity',r=>r.fulfill({status:204,body:''}));
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'test',refresh_token:'refresh',expires_in:3600,user}});
  if(path.endsWith('/rpc/is_inventory_admin'))return r.fulfill({json:false});
  if(path.endsWith('/rpc/restore_inventory_json')||path.endsWith('/rpc/save_inventory')){calls.push(path);state=r.request().postDataJSON().new_data;return r.fulfill({json:1});}
  if(path.endsWith('/inventory'))return r.fulfill({json:{data:state,revision:0}});
  if(path.endsWith('/inventory_account_backups'))return r.fulfill({json:[]});
  return r.fulfill({json:null});
 });
 await page.goto('/settings');
 await page.getByLabel('Email',{exact:true}).fill(user.email);
 await page.getByLabel('Password',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('#account')).toBeHidden();
 const data={...state,receipts:[{id:'a',sro:'A',type:'Raw',date:'2026-10-28',qty:100}],issues:[{id:'b',sro:'A',qty:20,date:'2026-10-28',seq:1}],activity:[{summary:'Foreign history'}]};
 const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Restore from backup',exact:true}).click();
 await (await chooser).setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await page.getByRole('button',{name:'Restore',exact:true}).click();
 await expect(page.locator('#toast')).toContainText('Backup restored');
 expect(calls).toEqual(['/rest/v1/rpc/restore_inventory_json']);
 expect(state.activity).toHaveLength(1);
 expect(state.activity[0].summary).toContain('Restored JSON backup');
 expect(state.receipts).toHaveLength(1);expect(state.issues).toHaveLength(1);
});
