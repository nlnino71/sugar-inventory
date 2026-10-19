import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/activity.js';
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}});
const event=()=>({id:crypto.randomUUID(),session:crypto.randomUUID(),event:'page.view',details:{page:'signin'}});
const request=()=>({method:'POST',headers:{'content-type':'application/json',host:'inventory.example',origin:'https://inventory.example'},socket:{remoteAddress:'203.0.113.9'},body:{events:[event()]}});
test('guest collector rejects cross-origin, unsupported and oversized reports',async()=>{
 const cross=request();cross.headers.origin='https://other.example';const a=response();await handler(cross,a);assert.equal(a.statusCode,403);
 const fake=request();fake.body.events[0].event='receipts.edit';const b=response();await handler(fake,b);assert.equal(b.statusCode,400);
 const large=request();large.body.events[0].details.value='x'.repeat(70000);const c=response();await handler(large,c);assert.equal(c.statusCode,400);
});
test('guest collector derives network data on server and keeps service credential private',async()=>{
 const previous={...process.env},oldFetch=globalThis.fetch;const saved=[];
 process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='server-secret';delete process.env.VERCEL;
 globalThis.fetch=async(url,options)=>{saved.push(JSON.parse(options.body));return new Response(null,{status:204});};
 try{
  const req=request();req.headers['x-forwarded-for']='198.51.100.99';req.body.network={ip:'192.0.2.1'};
  const res=response();await handler(req,res);assert.equal(res.statusCode,204);assert.equal(saved[0].network.ip,'203.0.113.9');assert.equal(res.body,undefined);assert.ok(!JSON.stringify(res).includes('server-secret'));
  process.env.VERCEL='1';const vercel=request();vercel.headers['x-forwarded-for']='198.51.100.8';await handler(vercel,response());assert.equal(saved[1].network.ip,'198.51.100.8');
 }finally{globalThis.fetch=oldFetch;for(const k of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','VERCEL']){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
});
