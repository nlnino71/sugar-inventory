// Browser events are best effort; confirmed writes are audited by database triggers.
export function createActivityTracker({send,onError=()=>{},onSynced=()=>{},delay=750,maxQueue=2000}){
 let queue=[],timer=null,inflight=null,failures=0,context=null;
 let session=globalThis.crypto.randomUUID();
 function schedule(wait=delay){if(!timer&&queue.length)timer=setTimeout(()=>{timer=null;void flush();},wait);}
 function start(value){context=value;session=globalThis.crypto.randomUUID();}
 function track(event,details={}){
  if(!context)return;
  if(queue.length>=maxQueue){onError('Activity queue full; some browser activity was not recorded.');return;}
  queue.push({id:crypto.randomUUID(),event,at:new Date().toISOString(),session,details});schedule();
 }
 async function flush(){
  if(inflight)return inflight;if(!queue.length||!context)return;
  const batch=queue.slice(0,50),batchContext=context;
  inflight=(async()=>{try{
   const result=await send(batch,batchContext);if(result?.error)throw result.error;
   queue.splice(0,batch.length);failures=0;if(!queue.length)onSynced();
  }catch{failures++;onError('Some browser activity is waiting to sync.');}
  finally{inflight=null;schedule(Math.min(30000,delay*2**Math.min(failures,6)));}})();
  return inflight;
 }
 async function stop(){if(timer){clearTimeout(timer);timer=null;}while(queue.length){const count=queue.length;await flush();if(queue.length>=count)break;}if(queue.length)onError('Some browser activity could not be delivered before this session ended.');queue=[];context=null;if(timer){clearTimeout(timer);timer=null;}}
 return {start,track,flush,stop,pending:()=>queue.length};
}
