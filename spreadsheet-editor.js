const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>{const text=String(v??'').trim();return /^(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?)$/.test(text)?Number(text.replace(/,/g,'')):NaN;};
export function gridDate(value){
 const text=String(value??'').trim();const match=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(match)return match[3]+'-'+match[1].padStart(2,'0')+'-'+match[2].padStart(2,'0');
 if(/^\d{5}$/.test(text))return new Date((Number(text)-25569)*86400000).toISOString().slice(0,10);
 return text;
}
const nf=v=>Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6});
export const SHEETS={
 receipts:{title:'SRO quantities',columns:[['date','SRO date','date'],['sro','SRO number'],['type','Sugar type'],['mill','Mill source'],['crop','Crop year'],['qty','Received quantity','number']]},
 issues:{title:'Issuance',columns:[['date','Issue date','date'],['sro','SRO number'],['type','Sugar type'],['client','Client'],['atw','ATW reference'],['permit','SRA permit'],['waybill','Mill waybill'],['batch','Batch code'],['qty','Issued quantity','number'],['bol','Bill of lading'],['vessel','Vessel'],['voy','Voyage'],['sail','Sailing date','date'],['van','Van / Truck plate']]}
};
export function parseClipboard(text){
 const rows=[];let row=[],cell='',quoted=false;
 const input=text.replace(/\r\n?/g,'\n');
 for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'&&(quoted||cell==='')){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c==='\t'||c==='\n')){row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[];}}else cell+=c;}
 if(quoted)throw new Error('The pasted range has an unfinished quoted cell.');
 row.push(cell);if(row.length>1||row[0]!==''||!rows.length)rows.push(row);
 if(rows.length>1000||rows.reduce((n,r)=>n+r.length,0)>10000)throw new Error('Paste at most 1,000 rows and 10,000 cells at a time.');
 return rows;
}
export function gridTotals(state){
 const sros=new Map();for(const r of state.receipts){const key=r.sro;const item=sros.get(key)||{received:0,issued:0};item.received+=Number.isFinite(number(r.qty))?number(r.qty):0;sros.set(key,item);}
 const running=new Map(),balance=new Map([...sros].map(([k,v])=>[k,v.received]));
 for(const i of [...state.issues].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.seq||0)-Number(b.seq||0))){const qty=Number.isFinite(number(i.qty))?number(i.qty):0;if(sros.has(i.sro)){sros.get(i.sro).issued+=qty;balance.set(i.sro,balance.get(i.sro)-qty);running.set(i.id,balance.get(i.sro));}}
 for(const v of sros.values())v.balance=v.received-v.issued;
 return {sros,running,received:state.receipts.reduce((n,r)=>n+(Number.isFinite(number(r.qty))?number(r.qty):0),0),issued:state.issues.reduce((n,r)=>n+(Number.isFinite(number(r.qty))?number(r.qty):0),0)};
}
export function validateGrid(draft){
 const next=structuredClone(draft),errors=[];const add=(sheet,row,key,message)=>errors.push({sheet,id:row.id,key,message});
 const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const receipts=new Map(),ids=new Set();
 for(const [sheet,config] of Object.entries(SHEETS))for(const row of next[sheet]){
  if(!row.id||ids.has(sheet+':'+row.id))add(sheet,row,'sro','Each row needs a unique record ID.');ids.add(sheet+':'+row.id);
  for(const [key,label,type] of config.columns){if(type==='date'&&(key==='date'||Object.hasOwn(row,key))){row[key]=gridDate(row[key]);if((key==='date'||row[key])&&!validDate(row[key]))add(sheet,row,key,label+' must be a real date in YYYY-MM-DD format.');}}
  if(!String(row.sro||'').trim())add(sheet,row,'sro','Enter an SRO number.');
  const qty=number(row.qty);if(!Number.isFinite(qty)||qty<0||(sheet==='issues'&&qty===0))add(sheet,row,'qty',sheet==='issues'?'Issued quantity must be greater than zero.':'Received quantity must be zero or greater.');else row.qty=qty;
  if(sheet==='receipts'){if(receipts.has(row.sro))add(sheet,row,'sro','Duplicate SRO number. Combine quantities into one SRO row.');else receipts.set(row.sro,row);}
 }
 for(const row of next.issues){const receipt=receipts.get(row.sro);if(!receipt)add('issues',row,'sro','This SRO does not exist in SRO quantities. Update references after renaming or deleting an SRO.');else if(row.type&&row.type!==receipt.type)add('issues',row,'type','Sugar type must match the referenced SRO.');else if(!row.type)row.type=receipt.type||'';}
 next.clients=[...new Set([...(next.clients||[]),...next.issues.map(i=>i.client).filter(Boolean)])];
 next.seq=next.issues.reduce((n,i)=>Math.max(n,Number(i.seq)||0),Number(next.seq)||0);
 const totals=gridTotals(next);if(!Number.isFinite(totals.received)||!Number.isFinite(totals.issued))errors.push({message:'The combined quantities exceed the supported range.'});
 return {next,errors};
}
export function mountSpreadsheet(host,{getState,onSave,onConfirm,onDownload,today}){
 let base=structuredClone(getState()),draft=structuredClone(base),sheet='receipts',query='',errors=[],busy=false,conflict=false,disposed=false;
 const dirty=()=>JSON.stringify(base)!==JSON.stringify(draft);
 const beforeUnload=e=>{if(dirty()){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);
 const newRow=()=>sheet==='receipts'?{id:crypto.randomUUID(),date:today(),sro:'',type:'',mill:'',crop:'',qty:''}:{id:crypto.randomUUID(),seq:++draft.seq,date:today(),sro:'',type:'',client:'',atw:'',permit:'',waybill:'',batch:'',qty:'',bol:'',vessel:'',voy:'',sail:'',van:''};
 const visible=()=>draft[sheet].map((row,index)=>({row,index})).filter(({row})=>!query||SHEETS[sheet].columns.some(([key])=>String(row[key]??'').toLowerCase().includes(query.toLowerCase())));
 const inputFor=(id,key)=>[...host.querySelectorAll('input[data-grid-id]')].find(el=>el.dataset.gridId===id&&el.dataset.key===key);
 const showMessage=(message,alert=false)=>{const el=host.querySelector('#gridMessage');el.textContent=message;el.className=alert?'alert':'hint';el.setAttribute('role',alert?'alert':'status');};
 function status(){
  const changed=dirty();host.querySelector('[data-grid-action=save]').disabled=busy||!changed||conflict;host.querySelector('[data-grid-action=discard]').disabled=busy||!changed;
  host.querySelector('#gridSaveStatus').textContent=busy?'Saving changes…':conflict?'Conflict: draft kept locally':changed?'Unsaved changes':'All changes saved';
  const totals=gridTotals(draft);host.querySelector('#gridTotals').textContent='Received '+nf(totals.received)+' · Issued '+nf(totals.issued)+' · Balance '+nf(totals.received-totals.issued)+' '+draft.unit;
  for(const cell of host.querySelectorAll('[data-grid-computed]')){const row=draft[sheet].find(r=>r.id===cell.dataset.id),stats=totals.sros.get(row?.sro);const value=cell.dataset.gridComputed==='running'?totals.running.get(row?.id):stats?.[cell.dataset.gridComputed];cell.textContent=value===undefined?'—':nf(value);cell.classList.toggle('negative',value<0);}
 }
 function paintTable(){
  const rows=visible(),columns=SHEETS[sheet].columns,calculated=sheet==='receipts'?[['issued','Issued (calculated)'],['balance','Balance (calculated)']]:[['running','Running balance (calculated)']];
  const old=new Map(base[sheet].map(r=>[r.id,JSON.stringify(r)]));
  host.querySelector('#gridRows').textContent=rows.length+' of '+draft[sheet].length+' rows';
  host.querySelector('#gridTable').innerHTML='<table class="editable-grid"><caption class="sr-only">'+SHEETS[sheet].title+' editable worksheet. Quantities in '+esc(draft.unit)+'.</caption><thead><tr><th scope="col" class="grid-row-number">Row</th>'+columns.map(([,label],j)=>'<th scope="col"><small>'+String.fromCharCode(65+j)+'</small>'+label+'</th>').join('')+calculated.map(([,label],j)=>'<th scope="col" class="grid-calculated"><small>'+String.fromCharCode(65+columns.length+j)+'</small>'+label+'</th>').join('')+'<th scope="col">Actions</th></tr></thead><tbody>'+rows.map(({row,index})=>'<tr class="'+(old.get(row.id)!==JSON.stringify(row)?'grid-modified':'')+'"><th scope="row" class="grid-row-number">'+(index+1)+'</th>'+columns.map(([key,label,type],j)=>{const error=errors.find(e=>e.sheet===sheet&&e.id===row.id&&e.key===key);return '<td><input data-grid-id="'+esc(row.id)+'" data-key="'+key+'" data-column="'+j+'" aria-label="'+label+', row '+(index+1)+'"'+(error?' aria-invalid="true" title="'+esc(error.message)+'"':'')+' type="'+(type==='date'?'date':'text')+'"'+(type==='number'?' inputmode="decimal"':'')+' value="'+esc(row[key])+'" autocomplete="off"></td>';}).join('')+calculated.map(([key])=>'<td class="grid-calculated num" data-grid-computed="'+key+'" data-id="'+esc(row.id)+'"></td>').join('')+'<td><button type="button" class="btn grid-delete" data-grid-action="delete" data-id="'+esc(row.id)+'" aria-label="Delete row '+(index+1)+'">Delete</button></td></tr>').join('')+'</tbody></table>'+(rows.length?'':'<p class="dashboard-empty">'+(draft[sheet].length?'No rows match this search.':'No rows yet. Add a row or paste a range from Excel into a new row.')+'</p>');
  status();
 }
 function render(){
  host.innerHTML='<section class="spreadsheet-editor"><h2>Edit inventory in a table</h2><p class="hint">Edit cells directly, or paste a range copied from Excel. Changes stay in this page until you choose Save changes. All quantities use '+esc(draft.unit)+'.</p><div class="grid-toolbar"><div class="btns"><button type="button" class="btn primary" data-grid-action="save">Save changes</button><button type="button" class="btn" data-grid-action="discard">Discard changes</button><button type="button" class="btn" data-grid-action="add">Add row</button><button type="button" class="btn" data-grid-action="download">Download draft backup</button></div><strong id="gridSaveStatus" role="status"></strong></div><div class="admin-tabs editor-tabs" role="tablist" aria-label="Inventory worksheets">'+Object.entries(SHEETS).map(([key,config])=>'<button type="button" role="tab" id="worksheet-'+key+'" data-grid-action="sheet" data-sheet="'+key+'" aria-controls="gridPanel" aria-selected="'+(key===sheet)+'" tabindex="'+(key===sheet?0:-1)+'">'+config.title+' ('+draft[key].length+')</button>').join('')+'</div><div class="grid-search"><label class="f">Search this sheet<input id="gridSearch" type="search" value="'+esc(query)+'" placeholder="Search any column"></label><span id="gridRows" class="hint"></span></div><p id="gridMessage" class="hint" role="status">'+(conflict?'Another device changed this inventory. Your draft is kept here. Download it if needed, then discard changes to load the latest records.':'Tab moves between cells · Enter moves down · Ctrl/Cmd+S saves. Calculated columns cannot be edited.')+'</p><p id="gridTotals" class="grid-totals"></p><div id="gridPanel" role="tabpanel" aria-labelledby="worksheet-'+sheet+'"><div id="gridTable" class="grid-scroll" tabindex="0" role="region" aria-label="'+SHEETS[sheet].title+' worksheet"></div></div><details class="grid-help"><summary>Editing guidance</summary><p>SRO quantities: date, SRO number, sugar type, mill source, crop year, received quantity, and calculated issued quantity and balance.</p><p>Issuance: date, SRO, sugar type, client, ATW, permit, waybill, batch, quantity, bill of lading, vessel, voyage, sailing date, van / truck plate, and calculated running balance.</p><p>Renaming or deleting an SRO requires updating its references in Issuance before saving. Paste columns in the displayed order, without headers. Clear search before pasting multiple rows. Dates use YYYY-MM-DD; pasted MM/DD/YYYY dates and Excel date serials are converted automatically. Negative received quantities and zero or negative issuance are rejected. New client names are added to the client directory when saved.</p></details></section>';
  paintTable();
 }
 async function commit(){
  if(busy||!dirty()||conflict)return;
  const result=validateGrid(draft);errors=result.errors;if(errors.length){sheet=errors[0].sheet||sheet;render();showMessage(errors.length+' correction'+(errors.length===1?'':'s')+' needed. '+errors[0].message,true);inputFor(errors[0].id,errors[0].key)?.focus();return;}
  const old=gridTotals(base).sros,worse=[...gridTotals(result.next).sros].filter(([sro,t])=>t.balance<Math.min(0,old.get(sro)?.balance||0));
  if(worse.length&&!await onConfirm('Save shortages?',worse.length+' SRO balance'+(worse.length===1?' will':'s will')+' be negative or more over-issued. Review the calculated balances before saving.','Save anyway'))return;
  busy=true;host.querySelectorAll('input,button').forEach(el=>el.disabled=true);status();
  try{const saved=await onSave(result.next);if(disposed)return;if(saved.ok){base=structuredClone(getState());draft=structuredClone(base);errors=[];conflict=false;busy=false;render();showMessage('Changes saved to your account.');}else{conflict=!!saved.conflict;busy=false;host.querySelectorAll('input,button').forEach(el=>el.disabled=false);status();showMessage(conflict?'Another device changed this inventory. Your draft is kept here. Download it if needed, then discard changes to load the latest records.':'Could not save. Your draft is still here; retry when the connection is restored.',true);}}
  catch{if(!disposed){busy=false;host.querySelectorAll('input,button').forEach(el=>el.disabled=false);status();showMessage('Could not save. Your draft is still here. Please retry.',true);}}
 }
 host.oninput=e=>{const el=e.target;if(el.id==='gridSearch'){query=el.value;paintTable();return;}if(el.dataset.gridId){const row=draft[sheet].find(r=>r.id===el.dataset.gridId);row[el.dataset.key]=el.value;el.removeAttribute('aria-invalid');el.closest('tr').classList.add('grid-modified');status();}};
 host.onclick=async e=>{const button=e.target.closest('[data-grid-action]');if(!button||busy)return;const action=button.dataset.gridAction;
  if(action==='save')return commit();
  if(action==='download'){const result=validateGrid(draft);if(result.errors.length){showMessage('Fix invalid cells before downloading a restorable backup. '+result.errors[0].message,true);return;}return onDownload(result.next);}
  if(action==='sheet'){sheet=button.dataset.sheet;query='';render();host.querySelector('#worksheet-'+sheet).focus();return;}
  if(action==='add'){query='';const row=newRow();draft[sheet].push(row);render();inputFor(row.id,SHEETS[sheet].columns[0][0])?.focus();return;}
  if(action==='discard'){if(!await onConfirm('Discard spreadsheet changes?','This removes your unsaved table edits and reloads the last inventory loaded from your account.','Discard changes'))return;base=structuredClone(getState());draft=structuredClone(base);conflict=false;errors=[];render();return;}
  if(action==='delete'&&await onConfirm('Delete this row?','The row will be removed from the draft. This becomes permanent only when you save changes.','Remove row')){draft[sheet]=draft[sheet].filter(r=>r.id!==button.dataset.id);render();}
 };
 host.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void commit();return;}
  const tab=e.target.closest('[role=tab]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();host.querySelector('#worksheet-'+(e.key==='Home'?'receipts':e.key==='End'?'issues':sheet==='receipts'?'issues':'receipts')).click();return;}
  const input=e.target;if(input.dataset.gridId&&e.key==='Enter'){e.preventDefault();const rows=visible(),index=rows.findIndex(r=>r.row.id===input.dataset.gridId),next=rows[index+(e.shiftKey?-1:1)];if(next)inputFor(next.row.id,input.dataset.key)?.focus();}
 };
 host.onpaste=e=>{const input=e.target;if(!input.dataset.gridId)return;const text=e.clipboardData.getData('text/plain');if(!text.includes('\t')&&!text.includes('\n'))return;e.preventDefault();if(busy)return;
  try{const pasted=parseClipboard(text),columns=SHEETS[sheet].columns,start=Number(input.dataset.column),rows=visible(),rowIndex=rows.findIndex(r=>r.row.id===input.dataset.gridId);if(query&&pasted.length>1)throw new Error('Clear search before pasting multiple rows.');if(pasted.some(r=>r.length+start>columns.length))throw new Error('The range extends past the editable columns. Do not paste calculated columns.');
   const index=draft[sheet].findIndex(r=>r.id===rows[rowIndex].row.id);while(draft[sheet].length<index+pasted.length)draft[sheet].push(newRow());pasted.forEach((values,y)=>values.forEach((v,x)=>draft[sheet][index+y][columns[start+x][0]]=columns[start+x][2]==='date'?gridDate(v):v));errors=[];render();showMessage('Pasted '+pasted.length+' row'+(pasted.length===1?'':'s')+'. Review and save changes.');inputFor(draft[sheet][index].id,columns[start][0])?.focus();
  }catch(error){showMessage(error.message,true);}
 };
 render();return {dirty,async canLeave(){return !busy&&(!dirty()||await onConfirm('Leave unsaved spreadsheet changes?','Your table edits have not been saved. Stay here to save or download your draft, or leave and discard them.','Leave without saving'));},destroy(){disposed=true;window.removeEventListener('beforeunload',beforeUnload);host.oninput=null;host.onclick=null;host.onkeydown=null;host.onpaste=null;}};
}
