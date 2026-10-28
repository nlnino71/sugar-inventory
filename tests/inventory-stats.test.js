import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inventorySpecs} from '../inventory-stats.js';
test('inventory trends carry opening stock, preserve fractions and separate all-record balances',()=>{
 const state={receipts:[{sro:'A',type:'Raw',qty:100.5,date:'2026-09-01'},{sro:'A',type:'Raw',qty:10.25,date:'2026-10-20'},{sro:'B',type:'Refined',qty:50,date:'2026-11-01'},{sro:'C',type:'Raw',qty:3,date:'bad'}],issues:[{sro:'A',qty:20.25,date:'2026-10-18',client:'A'},{sro:'missing',type:'Washed',qty:5,date:'2026-10-20',client:'B'}]};
 const result=inventorySpecs(state,7,'2026-10-20'),get=key=>result.specs.find(s=>s.key==='inventory-'+key);
 assert.equal(result.from,'2026-10-14');assert.equal(result.undated,1);
 assert.deepEqual(get('balance').datasets[0].data,[100.5,100.5,100.5,100.5,80.25,80.25,85.5]);
 assert.equal(get('movements').datasets[0].data.reduce((a,b)=>a+b,0),10.25);
 assert.equal(get('types').datasets[0].data.reduce((a,b)=>a+b,0),138.5);
 assert.ok(get('types').datasets[0].data.includes(-5));assert.ok(get('mix').datasets[0].data.every(v=>v>0));
 assert.equal(get('clients').datasets[0].data.reduce((a,b)=>a+b,0),25.25);
});
test('client chart retains every issuance when limiting categories and ignores impossible dates',()=>{
 const issues=Array.from({length:12},(_,i)=>({client:'Client '+i,qty:i+0.5,date:'2026-10-20'}));issues.push({qty:100,date:'2026-02-30'});
 const result=inventorySpecs({issues},30,'2026-10-20'),clients=result.specs.find(s=>s.key==='inventory-clients');
 assert.equal(clients.labels.length,9);assert.equal(clients.datasets[0].data.reduce((a,b)=>a+b,0),72);assert.equal(result.undated,1);
});
test('combined sugar graph includes all three ordered metrics and unmatched withdrawals',()=>{
 const state={unit:'LKg',receipts:[{sro:'A',type:'Raw',qty:100.5},{sro:'B',type:'Refined',qty:0}],issues:[{sro:'A',qty:20.25},{sro:'missing',type:'Washed',qty:5}]};
 const get=(metric,key)=>inventorySpecs(state,7,'2026-10-28',metric).specs.find(s=>s.key==='inventory-'+key);
 const graph=get('balance','sugar-summary');
 assert.equal(graph.horizontal,undefined);
 assert.deepEqual(graph.datasets.map(s=>s.label),['SRO Quantity · LKg','Withdrawal · LKg','Balance · LKg']);
 assert.equal(graph.labels.length,3);
 const raw=graph.labels.indexOf('Raw'),washed=graph.labels.indexOf('Washed');
 assert.deepEqual(graph.datasets.map(s=>s.data[raw]),[100.5,20.25,80.25]);
 assert.deepEqual(graph.datasets.map(s=>s.data[washed]),[0,5,-5]);
 assert.deepEqual(get('received','mix').datasets[0].data,[100.5]);
 assert.equal(get('issued','mix').datasets[0].data.reduce((a,b)=>a+b,0),25.25);
});
