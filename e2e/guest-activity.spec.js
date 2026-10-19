import {test,expect} from '@playwright/test';
test('signed-out guests report visits, signup navigation and failed sign-in without credentials',async({page})=>{
 const events=[];await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('**/api/activity',r=>{events.push(...r.request().postDataJSON().events);return r.fulfill({status:204,body:''});});
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>r.fulfill({status:400,json:{message:'Invalid credentials'}}));
 await page.goto('/');await expect.poll(()=>events.some(e=>e.event==='page.view'&&e.details.page==='signin')).toBe(true);
 await page.getByRole('button',{name:'Create an account',exact:true}).click();await expect.poll(()=>events.some(e=>e.event==='page.view'&&e.details.page==='signup')).toBe(true);
 await page.getByRole('button',{name:'Already registered? Sign in',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('private-guest@example.com');await page.getByLabel('Password',{exact:true}).fill('private-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect.poll(()=>events.some(e=>e.event==='auth.result'&&e.details.outcome==='failed')).toBe(true);
 expect(JSON.stringify(events)).not.toContain('private-password');expect(JSON.stringify(events)).not.toContain('private-guest@example.com');
 expect(events.find(e=>e.event==='page.view').details.device.screen).toMatch(/\d+ × \d+/);expect(events.every(e=>!!e.session)).toBe(true);
});
test('public guest events carry sharing context without exposing it inside event details',async({page})=>{
 const batches=[];await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());await page.route('**/api/activity',r=>{batches.push(r.request().postDataJSON());return r.fulfill({status:204,body:''});});
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',r=>r.fulfill({json:{unit:'bags',receipts:[],issues:[],clients:[],seq:0}}));
 await page.goto('/view/public');await page.getByRole('button',{name:'Stock',exact:true}).click();await expect.poll(()=>batches.some(b=>b.share_slug==='public'&&b.events.some(e=>e.details.page==='stock'))).toBe(true);
 expect(batches.flatMap(b=>b.events).some(e=>JSON.stringify(e).includes('share_token'))).toBe(false);await expect(page.getByRole('button',{name:'Open superadmin'})).toHaveCount(0);
});
