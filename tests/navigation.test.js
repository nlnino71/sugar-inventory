import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PAGE_PATHS,pageFromUrl,pageUrl} from '../navigation.js';
test('all private page URLs resolve and root opens Stock',()=>{
 for(const [page,path] of Object.entries(PAGE_PATHS))assert.equal(pageFromUrl(new URL('https://example.com'+path),{isSuperadmin:true}),page);
 assert.equal(pageFromUrl(new URL('https://example.com/')),'stock');assert.equal(pageFromUrl(new URL('https://example.com/superadmin')),'stock');
});
test('public navigation preserves shared URLs and cannot select private pages',()=>{
 for(const shared of ['https://example.com/view/abc','https://example.com/#view=token']){
  const u=new URL(pageUrl(shared,'reports',{readOnly:true}),'https://example.com');assert.equal(pageFromUrl(u,{readOnly:true}),'reports');assert.equal(u.pathname,new URL(shared).pathname);assert.equal(u.hash,new URL(shared).hash);
  u.searchParams.set('page','superadmin');assert.equal(pageFromUrl(u,{readOnly:true,isSuperadmin:true}),'stock');
 }
});
