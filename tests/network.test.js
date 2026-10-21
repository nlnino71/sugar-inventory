import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savedNetwork} from '../server/network.js';
function storage(cached=null){const writes=[];return {writes,from(name){assert.equal(name,'inventory_ip_networks');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:cached};},async upsert(row){writes.push(row);return {error:null};}};}};}
test('Lite lookup saves normalized ISP and ASN using server header and reuses fresh DB cache',async()=>{
 const token=process.env.IPINFO_TOKEN,oldFetch=globalThis.fetch,db=storage();process.env.IPINFO_TOKEN='test-private-token';let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.ipinfo.io/lite/8.8.8.8');assert.equal(options.headers.Authorization,'Bearer test-private-token');return new Response(JSON.stringify({ip:'8.8.8.8',asn:'AS15169',as_name:'Google LLC',as_domain:'google.com',country_code:'US',country:'United States',token:'must-not-copy'}));};
 try{const result=await savedNetwork(db,'8.8.8.8');assert.equal(result.isp,'Google LLC');assert.equal(result.asn,'AS15169');assert.equal(db.writes.length,1);assert.ok(!JSON.stringify(db.writes).includes('token'));
 const cached=storage(db.writes[0]);assert.deepEqual(await savedNetwork(cached,'8.8.8.8'),result);assert.equal(calls,1);assert.equal(cached.writes.length,0);}
 finally{globalThis.fetch=oldFetch;if(token===undefined)delete process.env.IPINFO_TOKEN;else process.env.IPINFO_TOKEN=token;}
});
test('provider outage keeps prior database network and never invents an ISP',async()=>{
 const token=process.env.IPINFO_TOKEN,oldFetch=globalThis.fetch;process.env.IPINFO_TOKEN='test-private-token';globalThis.fetch=async()=>{throw Error('offline');};
 const prior={network:{isp:'Known network'},looked_up_at:'2020-01-01T00:00:00Z'};
 try{assert.deepEqual(await savedNetwork(storage(prior),'8.8.8.8'),prior.network);await assert.rejects(()=>savedNetwork(storage(),'8.8.8.8'));assert.equal(await savedNetwork(storage(),'bad-ip'),null);}
 finally{globalThis.fetch=oldFetch;if(token===undefined)delete process.env.IPINFO_TOKEN;else process.env.IPINFO_TOKEN=token;}
});
test('session host masks and mapped IPv4 are normalized for the provider and cached under the session key',async()=>{
 const token=process.env.IPINFO_TOKEN,oldFetch=globalThis.fetch;process.env.IPINFO_TOKEN='test-private-token';
 const seen=[];globalThis.fetch=async url=>{seen.push(url);return new Response(JSON.stringify({as_name:'Example ISP',country:'Philippines',country_code:'PH'}));};
 try{
  for(const [stored,address] of [['203.0.113.1/32','203.0.113.1'],['2001:db8::1/128','2001:db8::1'],['::ffff:203.0.113.1/128','203.0.113.1']]){
   const db=storage();const result=await savedNetwork(db,stored);assert.equal(result.country,'Philippines');assert.equal(seen.at(-1),'https://api.ipinfo.io/lite/'+encodeURIComponent(address));assert.equal(db.writes[0].ip,stored);
  }
  assert.equal(await savedNetwork(storage(),'203.0.113.1/24'),null);
 }finally{globalThis.fetch=oldFetch;if(token===undefined)delete process.env.IPINFO_TOKEN;else process.env.IPINFO_TOKEN=token;}
});
test('a fresh ISP-only cache is enriched with missing country instead of returned unchanged',async()=>{
 const token=process.env.IPINFO_TOKEN,oldFetch=globalThis.fetch;process.env.IPINFO_TOKEN='test-private-token';
 globalThis.fetch=async()=>new Response(JSON.stringify({as_name:'Example ISP',country:'Philippines',country_code:'PH'}));
 try{const db=storage({network:{isp:'Example ISP'},looked_up_at:new Date().toISOString()});const result=await savedNetwork(db,'203.0.113.1');assert.equal(result.country,'Philippines');assert.equal(db.writes.length,1);}
 finally{globalThis.fetch=oldFetch;if(token===undefined)delete process.env.IPINFO_TOKEN;else process.env.IPINFO_TOKEN=token;}
});
