import {isSimpleAuditEvent} from '../audit-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as features from '../features.js';

async function harness(rpc, cloud) {
 let source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 source=source.slice(source.indexOf('(async function(){'),source.indexOf("$('#loginForm').addEventListener"));
 source=source.replaceAll('import.meta.env.VITE_SUPABASE_URL',"'https://example.supabase.co'").replaceAll('import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY',"'public-key'");
 source+=`render=()=>{}; ready=true; globalThis.app={save,compute,clientStats,typeStats,fd,state:()=>S,revision:()=>revision,set:(value)=>{S=value},commit:()=>{committed=structuredClone(S)}}; })();`;
 const elements=new Map();
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',dataset:{},addEventListener(){},classList:{add(){},remove(){},contains(){return false;}}});return elements.get(selector);};
 const context=vm.createContext({...features,isSimpleAuditEvent,createActivityTracker:()=>({start(){},track(){},flush(){},stop:async()=>{}}),history:{state:null},window:{addEventListener(){},location:{hash:""}},URLSearchParams,structuredClone,setTimeout:()=>0,clearTimeout(){},console,document:{body:{},querySelector:element,addEventListener(){}},createClient:()=>({rpc,from:()=>({select:()=>({eq:()=>({single:async()=>({data:cloud,error:null})})})})})});
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
