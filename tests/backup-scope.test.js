import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScopedBackup,prepareScopedRestore} from '../backup-scope.js';
import {saveCompany} from '../companies.js';
const blank=()=>({unit:'kg',receipts:[],issues:[],clients:[],seq:0});
const inventory=(qty,unit='kg')=>({...blank(),unit,receipts:[{id:'r',sro:'SAME',qty}],issues:[{id:'i',sro:'SAME',qty:2,seq:3}]});
const document=()=>({...inventory(100),companyInventories:{sugar:inventory(25,'bags (LKg)')}});
test('company backups contain only the selected inventory and retain the company label',()=>{
 const backup=createScopedBackup(document(),'sugar','company',blank);
 assert.equal(backup.company,'sugar');assert.equal(backup.receipts[0].qty,25);assert.equal(backup.companyInventories,undefined);assert.equal(backup.backupScope,'company');
});
test('both-company backups include independent units and an explicit empty Sugar inventory for legacy accounts',()=>{
 const both=createScopedBackup(document(),'sugar','both',blank);
 assert.equal(both.receipts[0].qty,100);assert.equal(both.companyInventories.sugar.receipts[0].qty,25);
 assert.equal(both.companyInventories.sugar.unit,'bags (LKg)');assert.equal(both.backupScope,'both');
 assert.deepEqual(createScopedBackup(inventory(10),'oil','both',blank).companyInventories.sugar.receipts,[]);
});
test('restoring one company from a combined backup preserves the other company',()=>{
 const original=document(),backup=createScopedBackup({...inventory(80),companyInventories:{sugar:inventory(15)}},'oil','both',blank);
 const prepared=prepareScopedRestore(backup,'sugar','company',blank);
 assert.equal(prepared.document,undefined);assert.equal(prepared.inventory.seq,3);
 const next=saveCompany(original,'sugar',prepared.inventory);
 assert.equal(next.receipts[0].qty,100);assert.equal(next.companyInventories.sugar.receipts[0].qty,15);
 assert.equal(next.companyInventories.sugar.backupScope,undefined);
});
test('full restore replaces both companies and strips transport metadata',()=>{
 const backup=createScopedBackup(document(),'oil','both',blank);
 const prepared=prepareScopedRestore(backup,'oil','both',blank);
 assert.equal(prepared.document.companyInventories.sugar.receipts[0].qty,25);
 assert.equal(prepared.document.backupVersion,undefined);assert.equal(prepared.inventory.backupScope,undefined);
 // Old account snapshots may contain a leftover root company label.
 assert.equal(prepareScopedRestore({...backup,company:'oil'},'sugar','both',blank).inventory.receipts[0].qty,25);
});
test('scope mismatches and malformed inventories cannot silently overwrite companies',()=>{
 const sugar=createScopedBackup(document(),'sugar','company',blank);
 assert.throws(()=>prepareScopedRestore(sugar,'oil','company',blank),/belongs to Wilmar Sugar/);
 assert.throws(()=>prepareScopedRestore(sugar,'sugar','both',blank),/one company only/);
 assert.throws(()=>prepareScopedRestore({...document(),companyInventories:{sugar:{receipts:[null],issues:[]}}},'oil','both',blank),/Sugar inventory.*invalid/);
 assert.throws(()=>prepareScopedRestore({receipts:[{sro:'A',qty:'bad'}],issues:[]},'oil','company',blank),/not a valid/);
 // Unlabelled legacy files remain usable with an explicitly selected company.
 assert.equal(prepareScopedRestore(inventory(8),'sugar','company',blank).inventory.receipts[0].qty,8);
});
