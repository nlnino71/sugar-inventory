import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ip-info.js';
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}});
test('ISP endpoint denies missing session and non-POST requests',async()=>{
 const res=response();await handler({method:'POST',headers:{}},res);assert.equal(res.statusCode,401);assert.equal(res.headers['Cache-Control'],'no-store');
 const get=response();await handler({method:'GET',headers:{}},get);assert.equal(get.statusCode,405);
});
test('ISP endpoint verifies database role before provider access',async()=>{
 const oldFetch=globalThis.fetch;const previous={...process.env};const calls=[];
 process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='test-key';process.env.IPINFO_TOKEN='private-test-token';
 globalThis.fetch=async(input)=>{const url=String(input);calls.push(url);if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'user-1'}),{headers:{'Content-Type':'application/json'}});if(url.endsWith('/rest/v1/rpc/is_inventory_admin'))return new Response('false',{headers:{'Content-Type':'application/json'}});throw new Error('Unexpected external request');};
 try{const res=response();await handler({method:'POST',headers:{authorization:'Bearer test-token'},body:{ip:'8.8.8.8'}},res);assert.equal(res.statusCode,403);assert.equal(calls.length,2);assert.ok(calls.every(u=>u.startsWith('https://example.supabase.co/')));}
 finally{globalThis.fetch=oldFetch;for(const k of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','IPINFO_TOKEN']){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
});
