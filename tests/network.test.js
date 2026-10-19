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
