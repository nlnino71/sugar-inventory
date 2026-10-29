import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {companyName} from '../companies.js';
import XLSX from 'xlsx-js-style';
const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function workbook(){
 const S={unit:'metric tonnes (t)',receipts:[{id:'r',sro:'S1',type:'Raw Sugar',qty:1234.123456,date:'2026-10-01',mill:'Mill',crop:'2026-2027'}],issues:[{id:'i',sro:'S1',type:'Raw Sugar',qty:0.123456,date:'2026-10-02',seq:1,client:'Client',atw:'__proto__',batch:'B1'}],clients:['Client'],seq:1};
 const ctx=vm.createContext({window:{XLSX},S,CO:'oil',companyName,today:()=> '2026-10-21',fd:x=>x,nf:x=>String(x),threshold:()=>20});
 vm.runInContext(src.slice(src.indexOf('function compute()'),src.indexOf('const knownClients='))+src.slice(src.indexOf('const serial='),src.indexOf('let exportingXlsx='))+';result=xlsxBook();',ctx);
 return ctx.result;
}
test('client workbook formatting preserves exact quantities, dates, branding and grouped data',()=>{
 const wb=workbook();assert.equal(wb.SheetNames.length,5);
 assert.equal(wb.Sheets.Dashboard.A1.v,'WILMAR EDIBLE OIL PHILIPPINES INC. Sugar Inventory Monitoring');
 for(const sheet of Object.values(wb.Sheets))assert.match(sheet.A2.v,/WILMAR EDIBLE OIL PHILIPPINES INC/);
 assert.equal(wb.Sheets['SRO Quantity'].B5.v,'No. of SROs');assert.equal(wb.Sheets['SRO Quantity'].C5.v,'SRO Quantity');
 const cells=Object.entries(wb.Sheets['SRO Quantity']).filter(([k])=>!k.startsWith('!')).map(([,c])=>c);
 const qty=cells.find(c=>c.v===1234.123456);assert.equal(qty.z,'#,##0.00');assert.equal(qty.s.alignment.horizontal,'right');
 const date=cells.find(c=>c.z==='dd-mmm-yyyy'&&c.t==='n');assert.ok(date);assert.equal(date.s.alignment.horizontal,'center');
 assert.ok(Object.values(wb.Sheets.Issuance).some(c=>c?.v==='__proto__'));
 const reread=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer',cellNF:true});
 assert.ok(Object.values(reread.Sheets['SRO Quantity']).some(c=>c?.v===1234.123456));
});
