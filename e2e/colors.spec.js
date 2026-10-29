import {test,expect} from '@playwright/test';
// Exercise font fallback deterministically; third-party font outages must not stall workflows.
test.beforeEach(async({page})=>{await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());});
function contrast(a,b){
 const luminance=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
for(const theme of ['light','dark','auto'])test('semantic color contrast and native controls: '+theme,async({page},info)=>{
 await page.emulateMedia({colorScheme:theme==='auto'?'dark':theme});
 await page.addInitScript(value=>localStorage.setItem('sugar-theme',value),theme);
 await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
 const receipts=['OK','LOW','EMPTY','OVER'].map((sro,i)=>({id:'r'+i,sro,type:'Raw Sugar',mill:'Mill A',date:'2026-10-01',qty:100}));
 const issues=[['LOW',85],['EMPTY',100],['OVER',120]].map(([sro,qty],i)=>({id:'i'+i,sro,type:'Raw Sugar',client:'Client A',date:'2026-10-02',qty,batch:'B'+i,seq:i+1}));
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'staff@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 await page.route('https://nvkawrmoacikzdfowvem.supabase.co/**',route=>{
  if(route.request().url().includes('/auth/v1/token'))return route.fulfill({json:{access_token:'test-token',refresh_token:'refresh-token',expires_in:3600,token_type:'bearer',user}});
  if(route.request().url().includes('/auth/v1/user'))return route.fulfill({json:user});
  return route.fulfill({json:{data:{unit:'bags',receipts,issues,clients:['Client A'],seq:3},revision:0}});
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('staff@example.com');await page.getByLabel('Password',{exact:true}).fill('password-example');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Inventory at a glance'}).waitFor();
 await page.getByRole('button',{name:'Stock',exact:true}).click();
 for(const status of ['ok','low','empty','over']){
  const styles=await page.locator('.chip.'+status).first().evaluate(el=>{const s=getComputedStyle(el);return {ink:s.color,bg:s.backgroundColor};});
  expect(contrast(styles.ink,styles.bg),status+' text contrast').toBeGreaterThanOrEqual(4.5);
 }
 const alert=await page.locator('.alert').evaluate(el=>({ink:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));expect(contrast(alert.ink,alert.bg)).toBeGreaterThanOrEqual(4.5);
 const emptyBadge=await page.locator('.chip.empty').boundingBox();expect(emptyBadge.height).toBeLessThan(32);
 await page.screenshot({path:'.impeccable/review/colors-'+theme+'-'+info.project.name+'.png',fullPage:true});
 if(theme==='light'&&info.project.name==='desktop'){
  const session=await page.context().newCDPSession(page);await session.send('Emulation.setEmulatedVisionDeficiency',{type:'deuteranopia'});
  await expect(page.locator('.chip.low')).toHaveText('Low');await expect(page.locator('.chip.over')).toHaveText('Over-issued');
  await page.screenshot({path:'.impeccable/review/colors-deuteranopia-desktop.png',fullPage:true});await session.send('Emulation.setEmulatedVisionDeficiency',{type:'none'});
 }
 await page.getByRole('button',{name:'Withdrawal',exact:true}).click();await page.getByRole('button',{name:'New withdrawal',exact:true}).click();
 const input=page.locator('#fIss [name=date]');
 const field=await input.evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderTopColor,bg:s.backgroundColor,scheme:s.colorScheme,focus:s.outlineColor};});
 expect(contrast(field.border,field.bg)).toBeGreaterThanOrEqual(3);expect(field.scheme).toBe(theme==='light'?'light':'dark');
 const panelBg=await page.locator('#sheet').evaluate(el=>getComputedStyle(el).backgroundColor);expect(contrast(field.focus,panelBg)).toBeGreaterThanOrEqual(3);
 const checkInfo=async()=>{const colors=await page.locator('#info').evaluate(el=>({ink:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));expect(contrast(colors.ink,colors.bg)).toBeGreaterThanOrEqual(4.5);};
 await checkInfo();await page.locator('#fIss [name=sro]').selectOption('LOW');await page.locator('#fIss [name=bqty]').first().fill('20');await expect(page.locator('#info')).toHaveClass('info bad');await checkInfo();
});
