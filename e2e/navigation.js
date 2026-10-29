export async function navigate(page,name){
 const target=page.locator('#nav').getByRole('button',{name,exact:true});
 if(!await target.isVisible()){
  await page.locator('#nav').getByRole('button',{name:'Menu',exact:true}).click();
  const label=name;
  await page.getByRole('dialog',{name:'Menu',exact:true}).getByRole('button',{name:label,exact:true}).click();
 }else await target.click();
}
