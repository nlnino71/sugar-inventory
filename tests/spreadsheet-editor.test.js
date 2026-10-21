import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateGrid,gridTotals,parseClipboard,gridDate} from '../spreadsheet-editor.js';
const inventory=()=>({unit:'bags (LKg)',seq:1,receipts:[{id:'r1',sro:'SRO-1',date:'2026-10-01',type:'Washed Sugar',qty:100,crop:'2026-2027',extra:'kept'}],issues:[{id:'i1',sro:'SRO-1',date:'2026-10-02',type:'Washed Sugar',client:'Client A',qty:20,seq:1}],clients:[],clientProfiles:{Private:{notes:'Keep'}}});
test('worksheet validation normalizes numbers, preserves metadata and maintains the client directory',()=>{
 const original=inventory(),draft=structuredClone(original);draft.receipts[0].qty='1,234.56';const {next,errors}=validateGrid(draft);assert.deepEqual(errors,[]);assert.equal(next.receipts[0].qty,1234.56);assert.equal(next.receipts[0].extra,'kept');assert.deepEqual(next.clientProfiles,original.clientProfiles);assert.deepEqual(next.clients,['Client A']);assert.equal(draft.receipts[0].qty,'1,234.56');assert.deepEqual(next.issues[0],original.issues[0]);assert.equal(gridTotals(next).sros.get('SRO-1').balance,1214.56);
});
test('invalid dates, empty quantities, duplicate SROs and broken issuance references cannot be saved',()=>{
 const draft=inventory();draft.receipts[0].date='2026-02-30';draft.receipts[0].qty='';draft.receipts.push({...draft.receipts[0],id:'r2'});draft.issues[0].sro='missing';draft.issues[0].qty=-1;const {errors}=validateGrid(draft);assert.ok(errors.some(e=>e.key==='date'));assert.ok(errors.some(e=>e.message.includes('Duplicate')));assert.ok(errors.some(e=>e.message.includes('does not exist')));assert.ok(errors.some(e=>e.sheet==='issues'&&e.key==='qty'));
});
test('running balances follow date and sequence and negative balances remain visible',()=>{
 const draft=inventory();draft.issues.push({id:'i2',sro:'SRO-1',date:'2026-10-01',qty:90,seq:2});const totals=gridTotals(draft);assert.equal(totals.running.get('i2'),10);assert.equal(totals.running.get('i1'),-10);assert.equal(totals.sros.get('SRO-1').balance,-10);
});
test('Excel paste accepts rectangular TSV, quoted fields and CRLF without adding a phantom row',()=>{
 assert.deepEqual(parseClipboard('2026-10-01\tSRO-1\t"Mill\tA"\r\n2026-10-02\tSRO-2\t"Mill ""B"""\r\n'),[['2026-10-01','SRO-1','Mill\tA'],['2026-10-02','SRO-2','Mill "B"']]);assert.throws(()=>parseClipboard('"unfinished'),/unfinished/);assert.throws(()=>parseClipboard('a\n'.repeat(1001)),/at most/);
});

test('paste dates normalize without accepting malformed quantities or impossible dates',()=>{
 assert.equal(gridDate('10/21/2026'),'2026-10-21');assert.equal(gridDate('45951'),'2025-10-21');const draft=inventory();draft.receipts[0].qty='12,34';assert.ok(validateGrid(draft).errors.some(e=>e.key==='qty'));
});
