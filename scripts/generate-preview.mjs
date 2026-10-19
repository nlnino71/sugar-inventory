import {readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#eef2ef;color:#14231d;font-family:Arial,sans-serif;width:1200px;height:630px;padding:64px 72px}header{display:flex;align-items:center;gap:18px;font-size:25px;font-weight:bold}svg{width:64px;height:64px}h1{font-size:82px;line-height:1.05;letter-spacing:-3px;margin:60px 0 24px;max-width:900px}p{font-size:29px;color:#4a6155;margin:0;line-height:1.5}footer{position:absolute;bottom:55px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #bccdc2;padding-top:26px;font-size:21px;color:#365343}.badge{background:#1f6f4a;color:white;border-radius:8px;padding:12px 20px;font-size:19px}</style></head><body><header>${readFileSync('public/app-icon.svg','utf8')}Sugar Inventory</header><h1>Stock and deliveries.<br>One shared view.</h1><p>Sugar stock · SRO balances · Delivery records</p><footer><span>sugar-inventory.vercel.app</span><span class="badge">Public view · Read only</span></footer></body></html>`);
 await page.screenshot({path:'public/share-preview-v2.png'});
}finally{await browser.close();}
