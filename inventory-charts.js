import {mountCharts} from './admin-charts.js';
import {clientDashboardSpecs} from './inventory-stats.js';
export function mountInventory(host,state){
 let cleanup=null,metric='balance';
 const choices=[['received','SRO Quantity'],['issued','Withdrawal'],['balance','Balance']];
 host.innerHTML='<div class="chips" role="group" aria-label="Pie chart metric">'+choices.map(([value,label])=>'<button type="button" class="chip-b" data-metric="'+value+'" aria-pressed="'+(value===metric)+'">'+label+'</button>').join('')+'</div><div class="inventory-plots"></div>';
 const controls=host.querySelector('[role="group"]');
 const draw=()=>{cleanup?.();cleanup=mountCharts(host.querySelector('.inventory-plots'),clientDashboardSpecs(state,metric));};
 const select=event=>{
  const button=event.target.closest('[data-metric]');if(!button||button.dataset.metric===metric)return;
  metric=button.dataset.metric;
  controls.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  draw();
 };
 controls.addEventListener('click',select);draw();
 return ()=>{controls.removeEventListener('click',select);cleanup?.();};
}
