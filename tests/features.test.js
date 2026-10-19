import test from 'node:test';
import assert from 'node:assert/strict';
import {stockReport,matchingIssues,changeSummary,clientDirectory,threshold} from '../features.js';
const state={receipts:[{id:'r1',sro:'A',type:'Raw Sugar',date:'2026-09-01',qty:100},{id:'r2',sro:'B',type:'Refined Sugar',date:'2026-10-03',qty:50}],issues:[{id:'i1',sro:'A',date:'2026-09-15',client:'Alice',qty:20},{id:'i2',sro:'A',date:'2026-10-05',client:'Alice',batch:'BATCH-1',vessel:'MV Pearl',qty:30},{id:'i3',sro:'B',date:'2026-11-01',client:'Bob',qty:10}],clients:['Carol']};
test('reports carry opening stock forward and exclude future movements',()=>{
 const rows=stockReport(state,{from:'2026-10-01',to:'2026-10-31'});
 assert.deepEqual(rows.map(r=>[r.sro,r.opening,r.received,r.issued,r.closing]),[['A',80,0,30,50],['B',0,50,0,50]]);
});
test('type-filtered reports inherit sugar type from the SRO',()=>{
 const rows=stockReport(state,{type:'Raw Sugar',from:'2026-10-01',to:'2026-10-31'});
 assert.equal(rows.length,1);assert.equal(rows[0].issued,30);
});
test('search combines batch or vessel with inclusive dates and client',()=>{
 assert.equal(matchingIssues(state.issues,{query:'pearl',client:'Alice',from:'2026-10-05',to:'2026-10-05'}).length,1);
 assert.equal(matchingIssues(state.issues,{query:'BATCH-1',client:'Bob'}).length,0);
});
test('directory includes clients without deliveries and contact details',()=>{
 const clients=clientDirectory({...state,clientProfiles:{Carol:{phone:'123'}}});
 assert.equal(clients.find(c=>c.name==='Carol').phone,'123');assert.equal(clients.find(c=>c.name==='Carol').total,0);assert.equal(clients.find(c=>c.name==='Alice').total,50);
});
test('activity identifies adds edits and deletes without logging record contents',()=>{
 const next={...state,receipts:[{...state.receipts[0],qty:90},{id:'r3',sro:'C',qty:10}]};
 const summary=changeSummary(state,next);assert.match(summary,/1 SRO quantities added/);assert.match(summary,/1 SRO quantities updated/);assert.match(summary,/1 SRO quantities removed/);assert.doesNotMatch(summary,/Alice/);
});
test('legacy inventories retain the default alert threshold',()=>{
 assert.equal(threshold(state),20);assert.equal(threshold({...state,lowStockPercent:35}),35);assert.equal(threshold({...state,lowStockPercent:120}),100);
});
