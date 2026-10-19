import {isIP} from 'node:net';
// The provider receives only the IP; credentials travel in a server-only header.
export async function savedNetwork(db,ip,{force=false}={}){
 if(typeof ip!=='string'||!isIP(ip))return null;
 const {data:cached,error:readError}=await db.from('inventory_ip_networks').select('network,looked_up_at').eq('ip',ip).maybeSingle();
 if(readError)throw new Error('Network storage unavailable');
 const fresh=cached&&Date.now()-Date.parse(cached.looked_up_at)<86400000;
 if(fresh&&!force)return cached.network;
 if(!process.env.IPINFO_TOKEN)return cached?.network||null;
 try{
  const response=await fetch('https://api.ipinfo.io/lite/'+encodeURIComponent(ip),{headers:{Authorization:'Bearer '+process.env.IPINFO_TOKEN},signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error('Network provider unavailable');
  const result=await response.json();
  if(!result.as_name&&!result.asn&&!result.country_code)return cached?.network||null;
  const field=name=>typeof result[name]==='string'?result[name].slice(0,256):'';
  const network={isp:field('as_name'),asn:field('asn'),domain:field('as_domain'),country:field('country'),country_code:field('country_code'),continent:field('continent'),continent_code:field('continent_code'),source:'IPinfo Lite',looked_up_at:new Date().toISOString()};
  const {error}=await db.from('inventory_ip_networks').upsert({ip,network,looked_up_at:network.looked_up_at},{onConflict:'ip'});
  if(error)throw new Error('Network storage unavailable');
  return network;
 }catch(error){if(cached)return cached.network;throw error;}
}
