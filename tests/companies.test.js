import {test} from 'node:test';
import assert from 'node:assert/strict';
import {companyInventory,saveCompany,registryRows} from '../companies.js';
const blank=()=>({unit:'bags (LKg)',receipts:[],issues:[],clients:[],seq:0});
test('legacy inventory stays in Edible Oil and Sugar starts empty',()=>{
 const legacy={...blank(),receipts:[{id:'oil',sro:'SAME',qty:100}]};
 assert.equal(companyInventory(legacy,'oil',blank).receipts[0].qty,100);
 assert.deepEqual(companyInventory(legacy,'sugar',blank).receipts,[]);
 const sugar={...blank(),unit:'kg',receipts:[{id:'sugar',sro:'SAME',qty:5}]};
 const saved=saveCompany(legacy,'sugar',sugar);
 assert.deepEqual(saved.receipts,legacy.receipts);
 assert.equal(companyInventory(saved,'sugar',blank).unit,'kg');
 const oil=companyInventory(saved,'oil',blank);oil.receipts[0].qty=90;
 const again=saveCompany(saved,'oil',oil);
 assert.equal(companyInventory(again,'sugar',blank).receipts[0].qty,5);
 assert.equal(legacy.receipts[0].qty,100);
 assert.equal(again.companyInventories.sugar.companyInventories,undefined);
});
test('bulk selection applies type, crop and literal search together',()=>{
 const state={receipts:[{id:'a',sro:'2',type:'Raw',crop:'2026',mill:'A'},{id:'b',sro:'1',type:'Raw',crop:'2025',mill:'A'},{id:'c',sro:'3',type:'Refined',crop:'2026',mill:'A'},{id:'d',sro:'4',type:'Raw',crop:'2026',mill:'B'}]};
 assert.deepEqual(registryRows(state,{type:'Raw',crop:'2026',query:'A'}).map(r=>r.id),['a','d']); // Raw also matches A.
 assert.deepEqual(registryRows(state,{type:'Raw',crop:'2026',query:'B'}).map(r=>r.id),['d']);
});
