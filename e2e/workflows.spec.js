import {navigate} from './navigation.js';
import {test,expect} from '@playwright/test';
// Exercise font fallback deterministically; third-party font outages must not stall workflows.
test.beforeEach(async({page})=>{await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());});
// No core workflow depends on an external spreadsheet CDN.
test.beforeEach(async({page})=>{await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());});
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
 await page.getByRole('button',{name:'Withdrawal',exact:true}).click();
 await expect(page.getByText('B1',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'New withdrawal'})).toHaveCount(0);
 await page.reload();await expect(page.locator('#title')).toHaveText('Withdrawal');
 await navigate(page,'Clients');
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
