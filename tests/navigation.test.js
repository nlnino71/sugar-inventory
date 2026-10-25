import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PAGE_PATHS,pageFromUrl,pageUrl} from '../navigation.js';
test('all private page URLs resolve and root opens Stock',()=>{
 for(const [page,path] of Object.entries(PAGE_PATHS))assert.equal(pageFromUrl(new URL('https://example.com'+path),{isSuperadmin:true}),page);
 assert.equal(pageFromUrl(new URL('https://example.com/')),'stock');assert.equal(pageFromUrl(new URL('https://example.com/superadmin')),'stock');
});
test('public slug navigation uses nested paths and preserves the sharing slug',()=>{
 for(const [page,path] of Object.entries(PAGE_PATHS).filter(([page])=>['stock','dashboard','issue','reports'].includes(page))){
  const u=new URL(pageUrl('https://example.com/view/abc?page=stock&keep=yes',page,{readOnly:true}),'https://example.com');
  assert.equal(u.pathname,'/view/abc'+path);assert.equal(u.search,'?keep=yes');
  assert.equal(pageFromUrl(u,{readOnly:true}),page);
  assert.equal(pageFromUrl(new URL('https://example.com'+u.pathname+'/'),{readOnly:true}),page);
 }
 assert.equal(pageUrl('https://example.com/view/abc/reports','superadmin',{readOnly:true}),'/view/abc/stock');
 assert.equal(pageFromUrl(new URL('https://example.com/view/abc/superadmin'),{readOnly:true,isSuperadmin:true}),'stock');
});
test('old public query and token links still resolve',()=>{
 assert.equal(pageFromUrl(new URL('https://example.com/view/abc?page=reports'),{readOnly:true}),'reports');
 const u=new URL(pageUrl('https://example.com/#view=token','reports',{readOnly:true}),'https://example.com');
 assert.equal(u.hash,'#view=token');assert.equal(u.pathname,'/');assert.equal(pageFromUrl(u,{readOnly:true}),'reports');
 u.searchParams.set('page','superadmin');assert.equal(pageFromUrl(u,{readOnly:true,isSuperadmin:true}),'stock');
});
