import {savedNetwork,lookupAddress} from '../server/network.js';
import {createClient} from '@supabase/supabase-js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 const authorization=req.headers.authorization||'';
 if(!/^Bearer \S+$/.test(authorization))return res.status(401).json({error:'Sign in required'});
 if(!url||!key)return res.status(503).json({error:'Server authentication is not configured'});
 try{
 const db=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:user,error}=await db.auth.getUser(authorization.slice(7));
 if(error||!user.user)return res.status(401).json({error:'Invalid session'});
 const {data:allowed,error:denied}=await db.rpc('is_inventory_admin');
 if(denied||allowed!==true)return res.status(403).json({error:'Superadmin access required'});
 let body=req.body; if(typeof body==='string'){try{body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid request'});}}
 const ip=body?.ip;if(!lookupAddress(ip)||ip.length>45)return res.status(400).json({error:'Invalid IP address'});
 if(!process.env.IPINFO_TOKEN)return res.status(503).json({error:'ISP lookup requires a server-side IPINFO_TOKEN'});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Network storage is not configured'});
 const service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const network=await savedNetwork(service,ip);
 if(!network)return res.status(502).json({error:'Network not provided for this IP'});
 return res.status(200).json({...network,org:[network.asn,network.isp].filter(Boolean).join(' ')});
 }catch{return res.status(503).json({error:'Network lookup temporarily unavailable'});}
}
