import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {navigate} from './navigation.js';
const owner='11111111-1111-4111-8111-111111111111';
const initial={unit:'bags (LKg)',receipts:[{id:'r',sro:'CURRENT',qty:123.456,date:'2026-10-01',type:'Raw Sugar'}],issues:[],clients:[],clientProfiles:{},seq:0,activity:[]};
const snapshot={...initial,receipts:[{...initial.receipts[0],sro:'BACKUP',qty:80.123456}]};
async function setup(page,{conflict=false,unavailable=false,writeFailure=false}={}){
 let state=structuredClone(initial),revision=4,created=0,restored=0,listRequests=[];
 let backups=Array.from({length:12},(_,i)=>({id:'backup-'+i,owner_id:owner,created_at:`2026-10-${String(25-i).padStart(2,'0')}T08:00:00.000Z`,revision:4-i,kind:i===0?'automatic':'manual',receipt_count:1,issue_count:0,unit:'bags (LKg)',data:structuredClone(snapshot)}));
 const user={id:owner,email:'backups@example.com',aud:'authenticated',role:'authenticated'};
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('**/api/activity',r=>r.fulfill({status:204,body:''}));
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
  const url=new URL(r.request().url());
  if(url.pathname.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'test',refresh_token:'refresh',expires_in:3600,user}});
  if(url.pathname.endsWith('/rpc/is_inventory_admin'))return r.fulfill({json:false});
  if(url.pathname.endsWith('/rpc/create_inventory_backup')){
   if(writeFailure)return r.fulfill({status:503,json:{message:'Offline'}});
   created++;backups.unshift({...backups[0],id:'manual-new',kind:'manual',data:structuredClone(state)});return r.fulfill({json:'manual-new'});
  }
  if(url.pathname.endsWith('/rpc/restore_inventory_backup')){
   if(writeFailure)return r.fulfill({status:503,json:{message:'Offline'}});
   restored++;
   const args=r.request().postDataJSON();expect(args.expected_revision).toBe(revision);
   if(conflict){state.receipts[0].sro='OTHER-DEVICE';revision++;return r.fulfill({json:null});}
   const backup=backups.find(b=>b.id===args.backup_id);
   backups.unshift({...backups[0],id:'before-restore',kind:'before_restore',revision,data:structuredClone(state)});
   state=structuredClone(backup.data);revision++;return r.fulfill({json:revision});
  }
  if(url.pathname.endsWith('/inventory_account_backups')){
   expect(url.searchParams.get('owner_id')).toBe('eq.'+owner);
   if(unavailable)return r.fulfill({status:403,json:{message:'Offline'}});
   if(url.searchParams.get('select')==='data')return r.fulfill({json:{data:backups.find(b=>'eq.'+b.id===url.searchParams.get('id'))?.data}});
   listRequests.push(url.href);
   const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||11);
   return r.fulfill({json:backups.slice(offset,offset+limit).map(({data,...b})=>b)});
  }
  if(url.pathname.endsWith('/inventory_shares'))return r.fulfill({json:{enabled:false,token:owner,slug:'private'}});
  if(url.pathname.endsWith('/inventory'))return r.fulfill({json:{data:state,revision}});
  return r.fulfill({json:null});
 });
 await page.goto('/settings');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#account')).toBeHidden();
 if(!await page.locator('#accountBackups').isVisible())await navigate(page,'More');
 return {get state(){return state;},get created(){return created;},get restored(){return restored;},get listRequests(){return listRequests;}};
}
test('private backup history supports pagination, manual snapshots, exact downloads and safe restore',async({page},info)=>{
 const app=await setup(page);const section=page.locator('#accountBackups');
 await expect(section.locator('li')).toHaveCount(10);
 await section.getByRole('button',{name:'Older',exact:true}).click();await expect(section.locator('li')).toHaveCount(2);
 await section.getByRole('button',{name:'Newer',exact:true}).click();await expect(section.locator('li')).toHaveCount(10);
 await section.getByRole('button',{name:'Create backup',exact:true}).click();await expect.poll(()=>app.created).toBe(1);
 await expect(section.locator('li').first()).toContainText('Manual backup');
 const [download]=await Promise.all([page.waitForEvent('download'),section.locator('[data-backup-action="download"]').first().click()]);
 const contents=JSON.parse(await readFile(await download.path(),'utf8'));expect(contents).toEqual(initial);expect(download.suggestedFilename()).toContain('manual-new');
 await section.locator('[data-backup-action="restore"]').nth(1).click();
 await expect(page.getByRole('alertdialog',{name:'Restore account backup',exact:true})).toContainText('Before restore');
 await page.getByRole('button',{name:'Restore backup',exact:true}).click();
 await expect.poll(()=>app.restored).toBe(1);expect(app.state.receipts[0].qty).toBe(80.123456);
 await expect(section.locator('li').first()).toContainText('Before restore');
 await expect(section.getByRole('button',{name:'Create backup',exact:true})).toBeEnabled();
 await section.scrollIntoViewIfNeeded();await page.screenshot({path:'.impeccable/review/backups-'+info.project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('conflicted restore reloads the latest inventory without reporting success',async({page})=>{
 const app=await setup(page,{conflict:true});await page.locator('#accountBackups [data-backup-action="restore"]').first().click();await page.getByRole('button',{name:'Restore backup',exact:true}).click();
 await expect(page.locator('#toast')).toContainText('Inventory changed on another device');expect(app.state.receipts[0].sro).toBe('OTHER-DEVICE');
});
test('backup loading and write failures are recoverable',async({page})=>{
 await setup(page,{unavailable:true});const section=page.locator('#accountBackups');await expect(section.getByRole('alert')).toContainText('Backups could not load');await expect(section.getByRole('button',{name:'Refresh backups'})).toBeEnabled();await expect(section.getByRole('button',{name:'Create backup',exact:true})).toBeDisabled();
});
test('failed creation and restore do not report success or change local inventory',async({page})=>{
 const app=await setup(page,{writeFailure:true});const section=page.locator('#accountBackups');await expect(section.locator('li')).toHaveCount(10);
 await section.getByRole('button',{name:'Create backup',exact:true}).click();await expect(page.locator('#toast')).toContainText('Backup could not be saved');
 await section.locator('[data-backup-action="restore"]').first().click();await page.getByRole('button',{name:'Restore backup',exact:true}).click();await expect(page.locator('#toast')).toContainText('Restore could not be confirmed');expect(app.state).toEqual(initial);
});
