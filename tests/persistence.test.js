import {isSimpleAuditEvent} from '../audit-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as companies from '../companies.js';
import * as features from '../features.js';

async function harness(rpc, cloud) {
 let source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 source=source.slice(source.indexOf('(async function(){'),source.indexOf("$('#loginForm').addEventListener"));
 source=source.replaceAll('import.meta.env.VITE_SUPABASE_URL',"'https://example.supabase.co'").replaceAll('import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY',"'public-key'");
 source+=`render=()=>{}; ready=true; globalThis.app={hydrate:(document,id)=>{cloudDocument=document;CO=id;S=companyInventory(document,id,blank);committed=structuredClone(S)},save,compute,clientStats,typeStats,fd,state:()=>S,revision:()=>revision,set:(value)=>{S=value},commit:()=>{committed=structuredClone(S)}}; })();`;
 const elements=new Map();
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',dataset:{},addEventListener(){},classList:{add(){},remove(){},contains(){return false;}}});return elements.get(selector);};
 const context=vm.createContext({...features,...companies,isSimpleAuditEvent,createActivityTracker:()=>({start(){},track(){},flush(){},stop:async()=>{}}),history:{state:null},window:{addEventListener(){},location:{hash:""}},URLSearchParams,structuredClone,setTimeout:()=>0,clearTimeout(){},console,document:{body:{},querySelector:element,addEventListener(){}},createClient:()=>({rpc,from:()=>({select:()=>({eq:()=>({single:async()=>({data:cloud,error:null})})})})})});
 await vm.runInContext(source,context);
 return {app:context.app,elements};
}
const state=(qty=10)=>({unit:'bags',receipts:[{id:'r',sro:'SRO1',date:'2026-10-19',qty,type:'Raw Sugar'}],issues:[],clients:[],seq:0});

test('confirmed writes advance the revision and retain inventory',async()=>{
 let request;
 const {app}=await harness(async(name,args)=>{request={name,args};return {data:1,error:null};});
 app.set(state()); assert.equal(await app.save(),true); assert.equal(app.revision(),1);
 assert.equal(request.name,'save_inventory');assert.equal(request.args.expected_revision,0);assert.equal(app.compute().list[0].balance,10);
});
test('failed writes restore last confirmed state',async()=>{
 const {app}=await harness(async()=>({data:null,error:{message:'Network unavailable'}}));
 app.set(state(10));app.commit();app.set(state(20));
 assert.equal(await app.save(),false);assert.equal(app.state().receipts[0].qty,10);assert.equal(app.revision(),0);
});
test('concurrent edits reload server data instead of overwriting it',async()=>{
 const {app}=await harness(async()=>({data:null,error:null}),{data:state(30),revision:5});
 app.set(state(20));assert.equal(await app.save(),false);assert.equal(app.state().receipts[0].qty,30);assert.equal(app.revision(),5);
});
test('save lock prevents overlapping writes',async()=>{
 let complete,calls=0;
 const {app}=await harness(()=>{calls++;return new Promise(resolve=>complete=resolve);});
 app.set(state());const first=app.save();assert.equal(await app.save(),false);assert.equal(calls,1);
 complete({data:1,error:null});assert.equal(await first,true);
});

test('reserved property names remain valid record keys',async()=>{
 const {app}=await harness(async()=>({data:1,error:null}));
 app.set({unit:'bags',receipts:[{id:'constructor',sro:'__proto__',type:'constructor',date:'2026-10-01',qty:20}],issues:[{id:'__proto__',sro:'__proto__',client:'constructor',type:'constructor',date:'2026-10-02',qty:5,seq:1}],clients:['constructor'],seq:1});
 assert.equal(app.compute().list[0].balance,15);assert.equal(app.clientStats()[0].total,5);assert.equal(app.typeStats(app.compute())[0].received,20);
});
test('invalid date strings display as escaped text',async()=>{
 const {app}=await harness(async()=>({data:1,error:null}));
 assert.equal(app.fd('<img src=x>'),'&lt;img src=x&gt;');
});

test('JSON restore uses one dedicated database operation and one history summary',async()=>{
 let request;
 const {app}=await harness(async(name,args)=>{request={name,args};return {data:1,error:null};});
 app.set({...state(10),activity:[{id:'old',summary:'Previous change'}]});app.commit();
 app.set({...state(20),activity:[{id:'foreign',summary:'Imported history'}]});
 assert.equal(await app.save({operation:'json_restore'}),true);
 assert.equal(request.name,'restore_inventory_json');
 assert.equal(request.args.expected_revision,0);
 assert.equal(app.state().activity.length,2);
 assert.match(app.state().activity[0].summary,/Restored JSON backup \(1 SRO quantities, 0 issuance lines\)/);
 assert.equal(app.state().activity[1].id,'old');
});
test('failed JSON restore retains the previously confirmed inventory',async()=>{
 const {app}=await harness(async()=>({data:null,error:{message:'Restore unavailable'}}));
 app.set(state(10));app.commit();app.set(state(20));
 assert.equal(await app.save({operation:'json_restore'}),false);
 assert.equal(app.state().receipts[0].qty,10);
});

test('Sugar saves and revision conflicts retain both company inventories',async()=>{
 const original={...state(100),companyInventories:{sugar:state(20)}};
 let request;
 const {app}=await harness(async(name,args)=>{request=args;return {data:1,error:null}});
 app.hydrate(original,'sugar');app.set(state(25));
 assert.equal(await app.save(),true);
 assert.equal(request.new_data.receipts[0].qty,100);
 assert.equal(request.new_data.companyInventories.sugar.receipts[0].qty,25);
 const latest={...state(110),companyInventories:{sugar:state(35)}};
 const conflict=await harness(async()=>({data:null,error:null}),{data:latest,revision:4});
 conflict.app.hydrate(original,'sugar');conflict.app.set(state(30));
 assert.equal(await conflict.app.save(),false);
 assert.equal(conflict.app.state().receipts[0].qty,35);
 assert.equal(conflict.app.revision(),4);
});
test('full account JSON restore replaces both companies atomically',async()=>{
 let request;
 const {app}=await harness(async(name,args)=>{request={name,args};return {data:2,error:null}});
 app.hydrate({...state(100),companyInventories:{sugar:state(20)}},'sugar');
 const snapshot={...state(80),companyInventories:{sugar:state(10)}};
 app.set(state(10));assert.equal(await app.save({operation:'json_restore',document:snapshot}),true);
 assert.equal(request.name,'restore_inventory_json');
 assert.equal(request.args.new_data.receipts[0].qty,80);
 assert.equal(request.args.new_data.companyInventories.sugar.receipts[0].qty,10);
});
