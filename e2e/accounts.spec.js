import {test,expect} from '@playwright/test';
import {navigate} from './navigation.js';
test('accounts use separate inventories and sharing settings across sign-out and sign-in',async({page})=>{
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 const ids={owner:'11111111-1111-4111-8111-111111111111',new:'22222222-2222-4222-8222-222222222222'};
 const empty=()=>({unit:'bags',receipts:[],issues:[],clients:[],seq:0});
 const states={owner:{...empty(),receipts:[{id:'owner-r',sro:'OWNER-ONLY',qty:100,date:'2026-10-19',type:'Raw Sugar'}]},new:empty()};
 let current='owner';const provisioning=[];
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith('/token')){
   current=req.postDataJSON().email.startsWith('new')?'new':'owner';
   return route.fulfill({json:{access_token:'token-'+current,refresh_token:'refresh-'+current,expires_in:3600,token_type:'bearer',user:{id:ids[current],aud:'authenticated',role:'authenticated',email:current+'@example.com',app_metadata:{},user_metadata:{}}}});
  }
  if(url.pathname.endsWith('/logout')){expect(url.searchParams.get('scope')).toBe('local');return route.fulfill({json:{}});}
  if(url.pathname.endsWith('/ensure_inventory')){provisioning.push(current);return route.fulfill({json:null});}
  if(url.pathname.endsWith('/save_inventory')){states[current]=req.postDataJSON().new_data;return route.fulfill({json:1});}
  if(url.pathname.endsWith('/inventory_shares')){
   expect(url.searchParams.get('owner_id')).toBe('eq.'+ids[current]);
   return route.fulfill({json:{token:ids[current],slug:current==='owner'?'public':'inventory-new',enabled:current==='owner'}});
  }
  if(url.pathname.endsWith('/inventory')){
   expect(url.searchParams.get('owner_id')).toBe('eq.'+ids[current]);
   return route.fulfill({json:{data:states[current],revision:0}});
  }
  return route.fulfill({json:{}});
 });
 const signIn=async name=>{
  await page.getByLabel('Email',{exact:true}).fill(name+'@example.com');await page.getByLabel('Password',{exact:true}).fill('example-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#account')).toBeHidden();await expect(page.locator('#nav')).toBeVisible();
 };
 await page.goto('/');await signIn('owner');await navigate(page,'More');await expect(page.getByLabel('View-only link')).toHaveValue(/\/view\/public$/);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 await signIn('new');await expect(page.getByText('OWNER-ONLY',{exact:false})).toHaveCount(0);
 await navigate(page,'More');await expect(page.getByText('Sharing is disabled',{exact:true})).toBeVisible();await expect(page.getByLabel('View-only link')).toHaveCount(0);
 await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Receive stock',exact:true}).click();
 await page.getByLabel('SRO number',{exact:true}).fill('NEW-ONLY');await page.getByLabel('Quantity',{exact:true}).fill('25');await page.getByRole('button',{name:'Save SRO quantity',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeHidden();expect(states.new.receipts[0].sro).toBe('NEW-ONLY');expect(states.owner.receipts[0].sro).toBe('OWNER-ONLY');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await signIn('owner');
 await page.getByRole('button',{name:'Stock',exact:true}).click();
 await expect(page.getByRole('button',{name:/OWNER-ONLY/})).toBeVisible();await expect(page.getByText('NEW-ONLY',{exact:false})).toHaveCount(0);
 expect(provisioning).toEqual(['owner','new','owner']);
});
