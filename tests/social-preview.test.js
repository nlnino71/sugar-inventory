import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {socialMetadata,previewHtml,validPublicSlug} from '../social-preview.js';
import handler from '../api/public-view.js';
test('shared preview is present in raw HTML with the correct absolute URL',()=>{
 const html=previewHtml(readFileSync(new URL('../index.html',import.meta.url),'utf8'),'public');
 assert.match(html,/<meta property="og:url" content="https:\/\/sugar-inventory.vercel.app\/view\/public">/);
 assert.match(html,/<meta property="og:title" content="Sugar Inventory — Public View">/);
 assert.match(html,/<meta property="og:image" content="https:\/\/sugar-inventory.vercel.app\/share-preview-v2.png">/);
 assert.match(html,/og:image:width" content="1200/);assert.match(html,/og:image:height" content="630/);
 assert.match(html,/twitter:card" content="summary_large_image/);
 assert.equal((html.match(/property="og:title"/g)||[]).length,1);
});
test('custom slug uses its own URL rather than the home or default public URL',()=>{
 assert.match(socialMetadata('warehouse-stock'),/view\/warehouse-stock/);
 assert.equal(validPublicSlug('x"><script>'),false);assert.equal(validPublicSlug(['public']),false);
});
test('invalid preview request and unsupported methods are rejected',()=>{
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}});
 const invalid=response();handler({query:{slug:'<script>'},method:'GET'},invalid);assert.equal(invalid.statusCode,404);
 const post=response();handler({query:{slug:'public'},method:'POST'},post);assert.equal(post.statusCode,405);assert.equal(post.headers.Allow,'GET, HEAD');
});
test('preview PNG is a real 1200 by 630 image',()=>{
 const png=readFileSync(new URL('../public/share-preview-v2.png',import.meta.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
});
