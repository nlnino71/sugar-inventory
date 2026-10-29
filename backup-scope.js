import {companyInventory,companyName} from './companies.js';
const validRows=(rows,issue)=>Array.isArray(rows)&&rows.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.sro==='string'&&row.sro.trim()&&Number.isFinite(+row.qty)&&(issue?+row.qty>0:+row.qty>=0));
const validInventory=value=>value&&typeof value==='object'&&!Array.isArray(value)&&validRows(value.receipts,false)&&validRows(value.issues,true);
const clean=value=>{const {company,backupScope,backupVersion,exportedAt,...data}=structuredClone(value);return data;};
export function createScopedBackup(document,company,scope,blank){
 if(scope==='both'){
  const combined=clean(document);
  return {...combined,companyInventories:{...combined.companyInventories,sugar:clean(companyInventory(document,'sugar',blank))},backupScope:'both',backupVersion:2};
 }
 return {...clean(companyInventory(document,company,blank)),company,backupScope:'company',backupVersion:2};
}
export function prepareScopedRestore(file,company,scope,blank){
 if(!validInventory(file))throw new Error('That is not a valid inventory backup.');
 if(file.company&&!['oil','sugar'].includes(file.company))throw new Error('The backup has an unknown company label.');
 const both=file.companyInventories&&typeof file.companyInventories==='object'&&!Array.isArray(file.companyInventories);
 if(both&&file.companyInventories.sugar!==undefined&&!validInventory(file.companyInventories.sugar))throw new Error('The Sugar inventory in this backup is invalid.');
 if(scope==='both'&&!both)throw new Error('This file contains one company only. Choose Selected company to restore it; the other company will stay unchanged.');
 if(scope!=='both'&&!both&&file.company&&file.company!==company)throw new Error('This backup belongs to '+companyName(file.company)+'. Switch to that company before restoring it.');
 const document=both?clean(file):null;
 if(document?.companyInventories?.sugar)document.companyInventories.sugar=clean(document.companyInventories.sugar);
 const inventory=clean(companyInventory(both?document:clean(file),both?company:'oil',blank));
 const sequence=value=>Number.isSafeInteger(+value)&&+value>=0?+value:0;
 inventory.seq=inventory.issues.reduce((maximum,issue)=>Math.max(maximum,sequence(issue.seq)),sequence(inventory.seq));
 return {inventory,document:scope==='both'?document:undefined};
}
