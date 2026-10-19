import {readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const svg=readFileSync('public/app-icon.svg','utf8');
 for(const [size,name] of [[32,'favicon-32'],[180,'apple-touch-icon'],[192,'app-icon-192'],[512,'app-icon-512']]){
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
  await page.screenshot({path:`public/${name}.png`,omitBackground:true});await page.close();
 }
}finally{await browser.close();}
