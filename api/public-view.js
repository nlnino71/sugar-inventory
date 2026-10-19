import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {previewHtml,validPublicSlug} from '../social-preview.js';
let template;
export default function handler(req,res){
 const slug=req.query?.slug;
 if(!validPublicSlug(slug)){res.statusCode=404;res.end('Public view not found');return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');res.end('Method not allowed');return;}
 try{
  template??=readFileSync(resolve(process.cwd(),'dist/index.html'),'utf8');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.statusCode=200;res.end(req.method==='HEAD'?'':previewHtml(template,slug));
 }catch{res.statusCode=503;res.setHeader('Cache-Control','no-store');res.end('Public viewer temporarily unavailable');}
}
