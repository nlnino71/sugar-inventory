import {test} from 'node:test';
import assert from 'node:assert/strict';
import {convertInventory,convertQuantity,unitWeight} from '../units.js';
test('LKg conversions preserve received, issued, deficits and record metadata through round trips',()=>{
 const original={unit:'bags (LKg)',receipts:[{id:'r',sro:'A',qty:100.125}],issues:[{id:'i',sro:'A',qty:105.25}],clients:['Client'],seq:8};
 const kg=convertInventory(original,'kg');assert.equal(kg.receipts[0].qty,5006.25);assert.equal(kg.issues[0].qty,5262.5);assert.equal(kg.receipts[0].qty-kg.issues[0].qty,-256.25);assert.equal(original.receipts[0].qty,100.125);
 const tonnes=convertInventory(kg,'metric tonnes (t)');assert.equal(tonnes.receipts[0].qty,5.00625);assert.deepEqual(convertInventory(tonnes,'bags (LKg)'),original);
});
test('custom unit requires explicit weight and invalid quantities cannot partially convert an inventory',()=>{
 const state={unit:'crates',receipts:[{qty:3}],issues:[]};assert.throws(()=>convertInventory(state,'kg'));assert.equal(convertInventory(state,'kg',25).receipts[0].qty,75);
 assert.throws(()=>convertInventory({...state,receipts:[{qty:2},{qty:'bad'}]},'kg',25));assert.deepEqual(state.receipts,[{qty:3}]);
 assert.throws(()=>convertQuantity(Infinity,50,1));assert.throws(()=>convertQuantity(1,0,1));assert.throws(()=>convertInventory(state,'unsupported',25));assert.equal(unitWeight('bags'),null);
});
