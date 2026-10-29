export async function navigate(page,name){
 const target=page.locator('#nav').getByRole('button',{name,exact:true});
 if(!await target.isVisible()){
  await page.locator('#nav').getByRole('button',{name:'Menu',exact:true}).click();
  const label=name;
  await page.getByRole('dialog',{name:'Menu',exact:true}).getByRole('button',{name:label,exact:true}).click();
 }else await target.click();
}

export async function selectCompany(page,id){
 const trigger=page.getByRole('button',{name:'Switch company',exact:true}).filter({visible:true});
 await trigger.click();
 await page.getByRole('dialog',{name:'Switch company',exact:true}).locator('[data-act="setCompany"][data-company="'+id+'"]').click();
 await expectCompany(page,id);
}
export async function expectCompany(page,id){
 const {expect}=await import('@playwright/test');
 await expect(page.getByRole('button',{name:'Switch company',exact:true}).filter({visible:true})).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-company',id);
}
