import {isIP} from 'node:net';
export function lookupAddress(value){
 if(typeof value!=='string')return '';
 if(isIP(value))return value;
 const match=value.match(/^(.*)\/(32|128)$/);
 if(match&&((match[2]==='32'&&isIP(match[1])===4)||(match[2]==='128'&&isIP(match[1])===6)))return match[1];
 return '';
}
// The provider receives only the IP; credentials travel in a server-only header.
export async function savedNetwork(db,ip,{force=false}={}){
 const address=lookupAddress(ip);if(!address||ip.length>45)return null;
 const mapped=address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
 const providerIp=mapped&&isIP(mapped[1])===4?mapped[1]:address;
 const {data:cached,error:readError}=await db.from('inventory_ip_networks').select('network,looked_up_at').eq('ip',ip).maybeSingle();
 if(readError)throw new Error('Network storage unavailable');
 const fresh=cached&&Date.now()-Date.parse(cached.looked_up_at)<86400000;
 if(fresh&&!force&&(cached.network?.country||cached.network?.country_code))return cached.network;
 if(!process.env.IPINFO_TOKEN)return cached?.network||null;
 try{
  const response=await fetch('https://api.ipinfo.io/lite/'+encodeURIComponent(providerIp),{headers:{Authorization:'Bearer '+process.env.IPINFO_TOKEN},signal:AbortSignal.timeout(3000)});
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
