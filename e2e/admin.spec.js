import {test,expect} from '@playwright/test';
import {navigate} from './navigation.js';
for(const mode of ['not-admin','history','sessions'])test('superadmin visibility and device metadata: '+mode,async({page})=>{
 const admin=mode!=='not-admin';
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 const user={id:'11111111-1111-4111-8111-111111111111',email:admin?'jcnino16@gmail.com':'other@example.com',aud:'authenticated',role:'authenticated'};
 let device,adminRequests=0;
 const current='22222222-2222-4222-8222-222222222222';const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:user.id,session_id:current,exp:2000000000})).toString('base64url')+'.test';
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
 const u=r.request().url();
 if(u.includes('/auth/v1/token'))return r.fulfill({json:{access_token:token,refresh_token:'refresh',expires_in:3600,user}});
 if(u.includes('/rpc/is_inventory_admin'))return r.fulfill({json:admin});
 if(u.includes('/rpc/record_inventory_access')){device=r.request().postDataJSON().device;return r.fulfill({json:null});}
 if(u.includes('/rpc/inventory_admin_dashboard')){adminRequests++;return r.fulfill({json:{totalUsers:1,accounts:[{id:user.id,email:user.email,receipts:2,issues:1}],authEvents:mode==='sessions'?[]:[{id:'1',ip_address:'203.0.113.1',action:'login',email:user.email,network:{isp:'Test Network',asn:'AS64500'}}],authSessions:mode==='sessions'?[{id:current,user_id:user.id,email:user.email,created_at:'2026-10-19T12:00:00Z',updated_at:'2026-10-21T01:00:00Z',ip_address:'203.0.113.1',user_agent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/155.0.0.0 Safari/537.36',network:{isp:'Test Network',asn:'AS64500',country:'Philippines'}},{id:'second',user_id:user.id,email:user.email,ip_address:'203.0.113.2/32',user_agent:'Mozilla/5.0 (Windows NT 10.0) Firefox/140.0'},{id:'third',user_id:'other',email:'staff@example.com',ip_address:'203.0.113.3',user_agent:'Mozilla/5.0 (Linux; Android 14; Mobile) Chrome/155.0.0.0'}]:[],events:[{event:'app.open',details:{device:{screen:'390 × 844',userAgent:'Browser test'}}}]}});}
 if(u.includes('/inventory_shares'))return r.fulfill({json:{enabled:false,token:user.id,slug:'private'}});
 if(u.includes('/rest/v1/inventory'))return r.fulfill({json:{data:{receipts:[],issues:[],clients:[],seq:0,unit:'bags'},revision:0}});
 return r.fulfill({json:null});
 });
 await page.route('**/api/ip-info',r=>r.fulfill({json:{isp:'Updated ISP',asn:'AS64501',country:'Philippines'}}));
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('password-example');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Inventory at a glance'})).toBeVisible();
 await navigate(page,'More');const button=page.getByRole('button',{name:'Open superadmin'});
 if(!admin){await expect(button).toHaveCount(0);await expect(page.locator('.session-device')).toHaveCount(0);expect(adminRequests).toBe(0);return;}
 await button.click();await expect(page.getByRole('heading',{name:'Superadmin',exact:true,level:2})).toBeVisible();await page.getByRole('tab',{name:mode==='sessions'?'Sessions':'Authentication',exact:true}).click();await expect(page.getByText('203.0.113.1',{exact:true})).toBeVisible();
 await expect(page.getByText('Test Network · AS64500',{exact:true})).toBeVisible();
 if(mode==='sessions'){await page.getByRole('tab',{name:'Authentication',exact:true}).click();await expect(page.getByText(/No authentication audit records yet/)).toBeVisible();await page.getByRole('tab',{name:'Sessions',exact:true}).click();await expect(page.getByRole('heading',{name:'Where users are signed in',exact:true})).toBeVisible();await expect(page.locator('.session-account')).toHaveCount(2);await expect(page.locator('.session-device')).toHaveCount(3);await expect(page.locator('.session-device').nth(1).locator('[data-session-location]')).toHaveText('Philippines');await expect(page.locator('.session-device').nth(1).locator('[data-session-network]')).toHaveText('Updated ISP · AS64501');await expect(page.getByText('This session',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Chrome · macOS',exact:true})).toBeVisible();await expect(page.getByText('Phone',{exact:true})).toBeVisible();await page.locator('.session-technical summary').first().click();await expect(page.getByText(current,{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.impeccable/review/sessions-'+page.viewportSize().width+'.png',fullPage:true,animations:'disabled'});await page.locator('.session-device').first().getByRole('button',{name:'Look up ISP'}).click();await expect(page.locator('.session-device').first().locator('[data-session-network]')).toHaveText('Updated ISP · AS64501');}
 await page.getByRole('tab',{name:'Activity',exact:true}).click();await expect(page.locator('.audit-device').getByText('Screen 390 × 844',{exact:true})).toBeVisible();
 expect(device.screen).toMatch(/\d+ × \d+/);expect(device.viewport).toMatch(/\d+ × \d+/);
 await page.reload();await expect(page.getByRole('heading',{name:'Superadmin',exact:true,level:2})).toBeVisible();await expect(page.getByRole('tab',{name:'Activity',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('[role=tabpanel]:visible')).toHaveCount(1);await page.getByRole('tab',{name:'Activity',exact:true}).press('Home');await expect(page.getByRole('tab',{name:'Traffic',exact:true})).toBeFocused();await page.getByRole('tab',{name:'Traffic',exact:true}).press('ArrowRight');await expect(page.getByRole('tab',{name:'Statistics',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Stock',exact:true}).click();await expect(page.getByRole('heading',{name:'Superadmin',exact:true,level:2})).toHaveCount(0);
 await page.reload();await expect(page.locator('#title')).toHaveText('Stock');
});
