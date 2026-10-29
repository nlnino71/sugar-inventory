const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={initial:'Initial backup',automatic:'Automatic backup',manual:'Manual backup',before_restore:'Before restore'};
const dateLabel=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));
export function backupFilename(backup){
 return 'Sugar_Inventory_backup_'+backup.created_at.replace(/[^0-9TZ]/g,'-')+'_r'+backup.revision+'_'+backup.id+'.json';
}
export function mountAccountBackups(host,{db,ownerId,saveFile,confirm,restore,toast}){
 if(!host)return ()=>{};
 let disposed=false,rows=[],page=0,more=false,loading=false,busy=false,error='',request=0,focusTarget=null;
 function render(){
  if(disposed)return;
  host.innerHTML='<h2 id="accountBackupTitle">Account backups</h2><p>Automatic backups are saved after every inventory change. Only you can access them. Snapshots include both companies. Restoring replaces both and also saves a copy of your current inventory. Summary quantities below describe Edible Oil.</p>'+
   '<div class="btns"><button type="button" class="btn primary" data-backup-action="create"'+(busy||loading||error?' disabled':'')+'>'+(busy?'Working…':'Create backup')+'</button><button type="button" class="btn" data-backup-action="refresh"'+(busy||loading?' disabled':'')+'>Refresh backups</button></div>'+
   (error?'<p class="err" role="alert">'+escape(error)+'</p>':loading?'<p class="hint" role="status">Loading backups…</p>':!rows.length?'<p class="hint" role="status">No backups yet. Create one now to save your current inventory.</p>':
    '<ul class="backup-history">'+rows.map((b,i)=>'<li><div><strong>'+escape(kinds[b.kind]||'Inventory backup')+'</strong><time datetime="'+escape(b.created_at)+'">'+escape(dateLabel(b.created_at))+'</time><span class="hint">Revision '+escape(b.revision)+' · '+escape(b.receipt_count)+' SRO quantities · '+escape(b.issue_count)+' issuance lines · '+escape(b.unit)+'</span></div><div class="btns"><button type="button" class="btn" data-backup-action="download" data-backup-index="'+i+'"'+(busy?' disabled':'')+' aria-label="Download backup from '+escape(dateLabel(b.created_at))+'">Download</button><button type="button" class="btn" data-backup-action="restore" data-backup-index="'+i+'"'+(busy?' disabled':'')+' aria-label="Restore backup from '+escape(dateLabel(b.created_at))+'">Restore</button></div></li>').join('')+'</ul><div class="btns backup-pagination"><button type="button" class="btn" data-backup-action="newer"'+(busy||page===0?' disabled':'')+'>Newer</button><span class="hint">Page '+(page+1)+'</span><button type="button" class="btn" data-backup-action="older"'+(busy||!more?' disabled':'')+'>Older</button></div>');
 }
 function focusButton(){
  if(disposed||busy||loading||!focusTarget)return;
  if(document.activeElement!==document.body&&!host.contains(document.activeElement))return;
  const selector='[data-backup-action="'+focusTarget.action+'"]'+(focusTarget.index!==undefined?'[data-backup-index="'+focusTarget.index+'"]':'');
  const button=host.querySelector(selector);
  (button&&!button.disabled?button:host.querySelector('[data-backup-action="refresh"]'))?.focus({preventScroll:true});
 }
 async function load(){
  const token=++request;loading=true;error='';render();
  try{
   const {data,error:failure}=await db.from('inventory_account_backups').select('id,created_at,revision,kind,receipt_count,issue_count,unit').eq('owner_id',ownerId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*10,page*10+10);
   if(failure)throw failure;
   if(!Array.isArray(data))throw new Error('Unavailable');
   if(disposed||token!==request)return;
   rows=data.slice(0,10);more=data.length>10;
  }catch{if(!disposed&&token===request)error='Backups could not load. Select Refresh backups to try again.';}
  finally{if(!disposed&&token===request){loading=false;render();focusButton();}}
 }
 async function click(event){
  const button=event.target.closest('[data-backup-action]');if(!button||busy||loading||button.disabled)return;
  const action=button.dataset.backupAction;
  focusTarget={action,index:button.dataset.backupIndex};
  if(action==='refresh'){void load();return;}
  if(action==='older'||action==='newer'){page=Math.max(0,page+(action==='older'?1:-1));void load();return;}
  const backup=rows[Number(button.dataset.backupIndex)];
  if(action==='restore'){
   if(!backup)return;
   busy=true;render();
   try{
    const approved=await confirm('Restore account backup','Replace both company inventories with the backup from '+dateLabel(backup.created_at)+' ('+backup.receipt_count+' SRO quantities, '+backup.issue_count+' issuance lines)? Your current inventory will be saved as a “Before restore” backup.','Restore backup',true);
    if(!approved||disposed)return;
    const restored=await restore(backup.id);
    if(restored&&!disposed){page=0;await load();}
   }catch{if(!disposed)toast('Backup could not be restored. Please try again.');}
   finally{busy=false;render();focusButton();}
   return;
  }
  busy=true;render();
  try{
   if(action==='create'){
    const {error:failure}=await db.rpc('create_inventory_backup');if(failure)throw failure;
    if(disposed)return;
    toast('Backup saved to your account');page=0;await load();
   }else if(action==='download'&&backup){
    const {data,error:failure}=await db.from('inventory_account_backups').select('data').eq('owner_id',ownerId).eq('id',backup.id).single();
    if(failure||!data?.data)throw failure||new Error('Not found');
    if(!disposed)await saveFile(backupFilename(backup),JSON.stringify(data.data,null,2));
   }
  }catch{if(!disposed)toast(action==='create'?'Backup could not be saved. Please try again.':'Backup could not be downloaded. Please try again.');}
  finally{busy=false;render();focusButton();}
 }
 host.addEventListener('click',click);void load();
 return ()=>{disposed=true;request++;host.removeEventListener('click',click);};
}
