import {navigate} from './navigation.js';
import {test,expect} from '@playwright/test';
// Exercise font fallback deterministically; third-party font outages must not stall workflows.
test.beforeEach(async({page})=>{await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());});
// No core workflow depends on an external spreadsheet CDN.
test.beforeEach(async({page})=>{await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());});
test('overview, stock report, delivery search and client editing',async({page},info)=>{
 const excelRequests=[];page.on('request',r=>{if(/xlsx|sheetjs|cdn.jsdelivr/.test(r.url()))excelRequests.push(r.url());});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let sharing={token:'11111111-1111-4111-8111-111111111111',enabled:true,slug:'public'};
 let state={unit:'bags (LKg)',receipts:[{id:'r1',sro:'SRO-001',type:'Raw Sugar',mill:'Mill A',date:'2026-09-01',qty:100,crop:'2026-2027'}],issues:[{id:'i1',sro:'SRO-001',type:'Raw Sugar',client:'Client A',date:'2026-10-05',qty:85,seq:1,batch:'BATCH-A',atw:'ATW-100',vessel:'MV Pearl',sail:'2026-10-20'}],clients:['Client A'],seq:1};
 const user={id:'11111111-1111-1111-1111-111111111111',aud:'authenticated',role:'authenticated',email:'staff@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async route=>{
  const url=route.request().url();
  if(url.includes('/auth/v1/token'))return route.fulfill({json:{access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,token_type:'bearer',user}});
  if(url.includes('/auth/v1/user'))return route.fulfill({json:user});
  if(url.includes('/rest/v1/rpc/save_inventory')){state=route.request().postDataJSON().new_data;return route.fulfill({json:1});}
  if(url.includes('/rpc/inventory_slug_available'))return route.fulfill({json:route.request().postDataJSON().requested_slug!=='taken1'});
  if(url.includes('/rpc/set_inventory_slug')){const code=route.request().postDataJSON().requested_slug;if(code==='taken1')return route.fulfill({status:409,json:{code:'23505',message:'taken'}});sharing={...sharing,slug:code};return route.fulfill({json:code});}
  if(url.includes('/rpc/replace_inventory_link')){sharing={...sharing,slug:'a7b2c9',token:'22222222-2222-4222-8222-222222222222'};return route.fulfill({json:null});}
  if(url.includes('/rest/v1/inventory_shares')){if(route.request().method()==='PATCH')sharing={...sharing,...route.request().postDataJSON()};return route.fulfill({json:sharing});}
  if(url.includes('/rest/v1/inventory'))return route.fulfill({json:{data:state,revision:0}});
  return route.fulfill({json:{}});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('staff@example.com');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('#nav').getByRole('button',{name:'Stock',exact:true})).toBeVisible();
 await expect(page.locator('#title')).toHaveText('Stock');
 await navigate(page,'Overview');
 if(info.project.name==='desktop'){await expect(page.locator('.nav-brand .wilmar-logo')).toHaveAttribute('src','/wilmar-white.png');await expect(page.locator('.nav-brand .wilmar-logo')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await page.locator('#nav').screenshot({path:'.impeccable/review/wilmar-white-sidebar.png'});}
 await expect(page.getByRole('heading',{name:'Inventory at a glance'})).toBeVisible();
 await expect(page.locator('header.top')).toBeVisible();
 const toolbar=await page.locator('header.top').boundingBox();
 const toolbarItems=await page.locator('#title,#unitLbl,#themeToggle,#reloadCloud,#signOut').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}));
 expect(Math.max(...toolbarItems.map(r=>r.top))).toBeLessThan(Math.min(...toolbarItems.map(r=>r.bottom)));
 expect(toolbar.height).toBeLessThanOrEqual(80);
 await page.locator('header.top').screenshot({path:'.impeccable/review/compact-header-'+info.project.name+'.png'});
 await expect(page.locator('#inventoryCharts canvas')).toHaveCount(5);
 await page.getByRole('combobox',{name:'Inventory chart period'}).selectOption('7');
 await expect(page.locator('#inventoryCharts .chart-empty')).toHaveCount(3);
 await page.getByRole('combobox',{name:'Inventory chart period'}).selectOption('30');
 await expect(page.locator('#inventoryCharts canvas')).toHaveCount(5);
 await page.getByText('View balance by sugar type data',{exact:true}).click();
 await expect(page.locator('#inventoryCharts table').filter({hasText:'Raw Sugar'}).first()).toContainText('15');
 await expect(page.getByRole('button',{name:/SRO-001.*Low/})).toBeVisible();
 await page.screenshot({path:'.impeccable/review/'+info.project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 const navBounds=await page.locator('#nav').boundingBox(),mainBounds=await page.locator('main').boundingBox();
 if(page.viewportSize().width>=1024){expect(navBounds.x).toBe(0);expect(navBounds.y).toBe(0);expect(mainBounds.x).toBeGreaterThanOrEqual(navBounds.width);}
 else expect(navBounds.y).toBeGreaterThan(page.viewportSize().height-100);
 if(page.viewportSize().width<1024){
  await expect(page.locator('#nav button:visible')).toHaveCount(4);
  const menu=page.locator('#nav').getByRole('button',{name:'Menu',exact:true});
  await menu.click();await expect(page.getByRole('dialog',{name:'Menu',exact:true})).toBeVisible();
  await page.screenshot({path:'.impeccable/review/mobile-navigation-menu.png',fullPage:true,animations:'disabled'});
  await page.keyboard.press('Escape');await expect(menu).toBeFocused();
  await navigate(page,'SRO Qty');await expect(page.locator('#title')).toHaveText('SRO Quantity');
  await expect(page.locator('#nav [aria-current="page"]:visible')).toHaveText('Menu');
 }
 await page.getByRole('button',{name:'Stock',exact:true}).click();
 await page.screenshot({path:'.impeccable/review/stock-'+info.project.name+'.png',fullPage:true});
 await page.getByRole('button',{name:/SRO-001.*Low/}).click();
 if(page.viewportSize().width>=1024){await expect.poll(async()=>{const panel=await page.locator('#sheet').boundingBox();return Math.round(panel.x+panel.width);}).toBe(page.viewportSize().width);const panel=await page.locator('#sheet').boundingBox();expect(panel.y).toBe(0);}
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await navigate(page,'Reports');
 await page.locator('[data-report="from"]').fill('2026-10-01');await page.locator('[data-report="to"]').fill('2026-10-31');
 await expect(page.getByRole('cell',{name:'100.00',exact:true})).toBeVisible();
 await page.screenshot({path:'.impeccable/review/report-'+info.project.name+'.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export report CSV'}).click();expect((await download).suggestedFilename()).toContain('2026-10-01');
 await page.getByRole('button',{name:'Issuance',exact:true}).click();await page.getByLabel('Find deliveries').fill('not-present');await expect(page.getByText('No deliveries match these filters.')).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.getByText('ATW-100',{exact:true})).toBeVisible();
 await navigate(page,'Clients');await page.getByRole('button',{name:'Add client'}).click();await page.getByLabel('Client name').fill('Client B');await page.getByLabel('Contact person').fill('Maria');await page.getByLabel('Phone',{exact:true}).fill('09171234567');await page.getByRole('button',{name:'Save client'}).click();
 await expect(page.getByText('Client B',{exact:true})).toBeVisible();expect(state.clientProfiles['Client B'].contact).toBe('Maria');expect(state.activity[0].summary).toContain('Client directory updated');
 await page.screenshot({path:'.impeccable/review/clients-'+info.project.name+'.png',fullPage:true});
 await page.getByLabel('Find a client').evaluate(el=>{window.clientSearchInput=el;});
 await page.getByLabel('Find a client').fill('Client B');await expect(page.getByText('Client A',{exact:true})).toHaveCount(0);
 expect(await page.getByLabel('Find a client').evaluate(el=>el===window.clientSearchInput)).toBe(true);
 await expect(page.getByLabel('Find a client')).toBeFocused();
 expect(excelRequests).toEqual([]);
 await navigate(page,'More');
 const excelDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Excel workbook (.xlsx)',exact:true}).click();
 const workbookDownload=await excelDownload;expect(workbookDownload.suggestedFilename()).toMatch(/\.xlsx$/);
 const XLSX=await import('xlsx-js-style');const wb=(XLSX.default||XLSX).readFile(await workbookDownload.path(),{cellNF:true});
 expect(wb.SheetNames).toEqual(['Dashboard','SRO Quantity','Issuance','SRO Balance','Client Summary']);
 expect(wb.Sheets.Dashboard.A1.v).toBe('WILMAR EDIBLE OIL PHILIPPINES INC. Sugar Inventory Monitoring');
 for(const name of wb.SheetNames)expect(wb.Sheets[name].A2.v).toContain('WILMAR EDIBLE OIL PHILIPPINES INC.');
 expect(wb.Sheets['SRO Quantity'].B5.v).toBe('No. of SROs');expect(wb.Sheets['SRO Quantity'].C5.v).toBe('SRO Quantity');
 await expect(page.getByLabel('View-only link')).toHaveValue(/\/view\/public$/);
 await page.getByLabel('Public link code',{exact:true}).fill('taken1');await expect(page.locator('#codeStatus')).toHaveText('This code is taken. Try another.');
 await page.getByRole('button',{name:'Save code',exact:true}).click();await expect(page.locator('#codeStatus')).toHaveText('This code is taken. Try another.');
 await page.getByLabel('Public link code',{exact:true}).fill('mine09');await expect(page.locator('#codeStatus')).toHaveText('This code is available.');
 await page.getByRole('button',{name:'Save code',exact:true}).click();await expect(page.getByLabel('View-only link')).toHaveValue(/\/view\/mine09$/);
 await page.getByRole('button',{name:'Replace link',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Replace link',exact:true}).click();
 await expect(page.getByLabel('View-only link')).toHaveValue(/\/view\/[a-z0-9]{6}$/);expect(sharing.slug).toBe('a7b2c9');
 await page.getByRole('button',{name:'Disable public sharing',exact:true}).click();await expect(page.getByText('Sharing is disabled',{exact:true})).toBeVisible();expect(sharing.enabled).toBe(false);
 await page.getByRole('button',{name:'Enable public sharing',exact:true}).click();await expect(page.getByLabel('View-only link')).toBeVisible();
 await page.getByLabel('Low-stock alert').fill('10');await page.getByLabel('Low-stock alert').press('Tab');await expect(page.getByLabel('Low-stock alert')).toHaveValue('10');
 await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.getByText('No low or over-issued SROs.')).toBeVisible();
 expect(errors).toEqual([]);
});

for(const publicAddress of ['/#view=11111111-1111-4111-8111-111111111111','/view/public']){
test('public link '+publicAddress+' displays inventory without login or mutation controls',async({page})=>{
 let writes=0;
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async route=>{
  if(route.request().url().includes('/rpc/record_inventory_events'))return route.fulfill({status:204,body:''});
  if(route.request().url().includes('/rpc/get_public_inventory'))return route.fulfill({json:{unit:'bags',seq:1,receipts:[{id:'r',sro:'SHARED-001',type:'Raw Sugar',mill:'Mill A',date:'2026-09-01',qty:100}],issues:[{id:'i',sro:'SHARED-001',type:'Raw Sugar',client:'Client A',atw:'ATW-1',date:'2026-10-05',qty:20,batch:'B1',seq:1}],clients:[],activity:[],clientProfiles:{}}});
  writes++;return route.fulfill({status:403,json:{message:'Forbidden'}});
 });
 await page.goto(publicAddress);
 await expect(page.getByText('Public view · Read only')).toBeVisible();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeHidden();
 await expect(page.getByRole('button',{name:'Receive stock'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'More',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Stock',exact:true}).click();await page.getByRole('button',{name:/SHARED-001/}).click();
 await expect(page.getByText('B1',{exact:false}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:/Delete|Edit|Issue from/})).toHaveCount(0);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Issuance',exact:true}).click();
 await expect(page.getByText('B1',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'New issuance'})).toHaveCount(0);
 await page.reload();await expect(page.locator('#title')).toHaveText('Issuance');
 await navigate(page,'Reports');
 await expect(page.getByRole('button',{name:'Export report CSV'})).toHaveCount(0);
 await expect(page.getByText('Recent changes',{exact:true})).toHaveCount(0);
 expect(writes).toBe(0);
});
}
test('revoked public link shows unavailable instead of login or data',async({page})=>{
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',route=>route.fulfill({json:null}));
 await page.goto('/#view=11111111-1111-4111-8111-111111111111');
 await expect(page.getByText('Shared inventory unavailable',{exact:true})).toBeVisible();
 await expect(page.getByText(/This link is disabled/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Stock',exact:true})).toBeHidden();
});

test('signup sends email registration and explains confirmation',async({page})=>{
 let signupRequest;
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async route=>{
  if(route.request().url().includes('/auth/v1/signup')){signupRequest=route.request().postDataJSON();return route.fulfill({json:{id:'22222222-2222-4222-8222-222222222222',email:'new@example.com',identities:[]}});}
  return route.fulfill({json:{}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Create an account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create your account',exact:true})).toBeVisible();
 await expect(page.locator('header.top')).toBeHidden();
 await page.getByLabel('Email',{exact:true}).fill('new@example.com');await page.getByLabel('Password',{exact:true}).fill('example-password');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByText(/Check your email for a confirmation link/)).toBeVisible();
 expect(signupRequest.email).toBe('new@example.com');expect(signupRequest.password).toBe('example-password');
 await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Stock',exact:true})).toBeHidden();
});
test('signup errors allow retry without granting inventory access',async({page})=>{
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',route=>route.fulfill({status:429,json:{msg:'Too many signup attempts. Please try again later.'}}));
 await page.goto('/');await page.getByRole('button',{name:'Create an account',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('new@example.com');await page.getByLabel('Password',{exact:true}).fill('example-password');await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByText(/Too many signup attempts/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeEnabled();
 await expect(page.locator('#nav')).toBeHidden();
});
test('database setup failure keeps inventory unavailable with retry guidance',async({page})=>{
 const user={id:'22222222-2222-4222-8222-222222222222',aud:'authenticated',role:'authenticated',email:'new@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',route=>{
  if(route.request().url().includes('/auth/v1/token'))return route.fulfill({json:{access_token:'test-token',refresh_token:'refresh-token',expires_in:3600,token_type:'bearer',user}});
  if(route.request().url().includes('/rest/v1/inventory'))return route.fulfill({status:406,json:{code:'PGRST116',message:'No rows'}});
  return route.fulfill({json:user});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('new@example.com');await page.getByLabel('Password',{exact:true}).fill('example-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByText(/private inventory could not be opened/)).toBeVisible();
 await expect(page.locator('#nav')).toBeHidden();await expect(page.locator('#main')).toBeHidden();
});
