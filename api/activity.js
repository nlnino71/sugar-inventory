import {isIP} from 'node:net';
import {createClient} from '@supabase/supabase-js';
const kinds=new Set(['page.view','panel.view','panel.close','action.requested','form.submit','field.change','file.exported','save.failed','save.conflict','visibility.change','session.end','admin.view','auth.result','form.invalid']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Origin not allowed'});}catch{return res.status(403).json({error:'Origin not allowed'});}}
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return res.status(415).json({error:'JSON required'});
 let body=req.body;if(typeof body==='string'){if(Buffer.byteLength(body)>60000)return res.status(413).json({error:'Batch too large'});try{body=JSON.parse(body);}catch{return res.status(400).json({error:'Invalid JSON'});}}
 if(!body||Buffer.byteLength(JSON.stringify(body))>60000||!Array.isArray(body.events)||!body.events.length||body.events.length>50)return res.status(400).json({error:'Invalid batch'});
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 for(const e of body.events){if(!e||!kinds.has(e.event)||!uuid.test(e.id)||!uuid.test(e.session)||!e.details||Array.isArray(e.details)||typeof e.details!=='object'||Buffer.byteLength(JSON.stringify(e))>8192)return res.status(400).json({error:'Invalid event'});}
 if(body.share_slug!=null&&(typeof body.share_slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.share_slug)||body.share_slug.length>64))return res.status(400).json({error:'Invalid sharing context'});
 if(body.share_token!=null&&(typeof body.share_token!=='string'||!uuid.test(body.share_token)))return res.status(400).json({error:'Invalid sharing context'});
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return res.status(503).json({error:'Guest activity service is not configured'});
 // Only trust proxy headers on Vercel, where the platform overwrites X-Forwarded-For.
 const proxy=process.env.VERCEL==='1';
 const candidate=proxy?String(req.headers['x-forwarded-for']||'').split(',')[0].trim():req.socket?.remoteAddress;
 const ip=typeof candidate==='string'&&isIP(candidate)?candidate:null;
 try{
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await db.rpc('record_guest_inventory_events',{events:body.events,network:{ip,ip_source:proxy?'Vercel request IP':'Direct socket peer',user_agent:String(req.headers['user-agent']||'').slice(0,512)},share_slug:body.share_slug||null,share_token:body.share_token||null});
 if(error)return res.status(error.code==='P0001'?429:error.code==='42501'?403:503).json({error:'Guest activity could not be recorded'});
 return res.status(204).end();
 }catch{return res.status(503).json({error:'Guest activity temporarily unavailable'});}
}
