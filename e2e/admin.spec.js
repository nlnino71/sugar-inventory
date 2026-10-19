import {test,expect} from '@playwright/test';
import {navigate} from './navigation.js';
for(const admin of [false,true])test('superadmin visibility and device metadata: '+admin,async({page})=>{
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 const user={id:'11111111-1111-4111-8111-111111111111',email:admin?'jcnino16@gmail.com':'other@example.com',aud:'authenticated',role:'authenticated'};
 let device;
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>{
 const u=r.request().url();
 if(u.includes('/auth/v1/token'))return r.fulfill({json:{access_token:'token',refresh_token:'refresh',expires_in:3600,user}});
 if(u.includes('/rpc/is_inventory_admin'))return r.fulfill({json:admin});
 if(u.includes('/rpc/record_inventory_access')){device=r.request().postDataJSON().device;return r.fulfill({json:null});}
 if(u.includes('/rpc/inventory_admin_dashboard'))return r.fulfill({json:{totalUsers:1,accounts:[{id:user.id,email:user.email,receipts:2,issues:1}],authEvents:[{id:'1',ip_address:'203.0.113.1',action:'login',email:user.email,network:{isp:'Test Network',asn:'AS64500'}}],events:[{event:'app.open',details:{device:{screen:'390 × 844',userAgent:'Browser test'}}}]}});
 if(u.includes('/inventory_shares'))return r.fulfill({json:{enabled:false,token:user.id,slug:'private'}});
 if(u.includes('/rest/v1/inventory'))return r.fulfill({json:{data:{receipts:[],issues:[],clients:[],seq:0,unit:'bags'},revision:0}});
 return r.fulfill({json:null});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('password-example');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Inventory at a glance'})).toBeVisible();
 await navigate(page,'More');const button=page.getByRole('button',{name:'Open superadmin'});
 if(!admin){await expect(button).toHaveCount(0);return;}
 await button.click();await expect(page.getByRole('heading',{name:'Superadmin',exact:true})).toBeVisible();await expect(page.getByText('203.0.113.1',{exact:true})).toBeVisible();await expect(page.getByText('390 × 844',{exact:false})).toBeVisible();
 await expect(page.getByText('Test Network · AS64500',{exact:true})).toBeVisible();
 expect(device.screen).toMatch(/\d+ × \d+/);expect(device.viewport).toMatch(/\d+ × \d+/);
 await page.getByRole('button',{name:'Stock',exact:true}).click();await expect(page.getByRole('heading',{name:'Superadmin',exact:true})).toHaveCount(0);
});
