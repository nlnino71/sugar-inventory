import { performance } from 'node:perf_hooks';
import { stockReport, clientDirectory } from '../features.js';
const state={receipts:Array.from({length:5000},(_,n)=>({sro:`SRO-${n}`,type:'Raw Sugar',date:'2026-10-01',qty:100})),issues:Array.from({length:50000},(_,n)=>({sro:`SRO-${n%5000}`,client:`Client ${n%1000}`,date:'2026-10-02',qty:1})),clients:[]};
for(const [name,fn] of Object.entries({stockReport,clientDirectory})){
 fn(state);const samples=[];
 for(let n=0;n<5;n++){const start=performance.now();fn(state);samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);console.log(`${name}: ${samples[2].toFixed(1)} ms median (5 runs; 5,000 SROs, 50,000 issuance lines, 1,000 clients)`);
}
