import {mountCharts} from './admin-charts.js';
import {inventorySpecs} from './inventory-stats.js';
export function mountInventory(host,state,end,initialDays=30,onDays=()=>{}){
 let cleanup=null;
 host.innerHTML='<div class="stats-toolbar"><div><h2>Inventory statistics</h2><p class="hint">Stock, movements and distribution · '+String(state.unit||'units').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p></div><label class="f">Movement period<select aria-label="Inventory chart period"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label></div><label class="f">Pie chart metric<select aria-label="Pie chart metric"><option value="received">SRO Quantity</option><option value="issued">Withdrawal</option><option value="balance" selected>Balance</option></select></label><p class="hint inventory-period"></p><div class="inventory-plots"></div>';
 const select=host.querySelector('select'),metric=host.querySelector('[aria-label="Pie chart metric"]');select.value=String(initialDays);
 const draw=()=>{cleanup?.();const stats=inventorySpecs(state,+select.value,end,metric.value);host.querySelector('.inventory-period').textContent=stats.from+' to '+stats.to+' · Includes today'+(stats.undated?' · '+stats.undated+' records with missing or invalid dates excluded from period charts.':'.');cleanup=mountCharts(host.querySelector('.inventory-plots'),stats.specs);onDays(+select.value);};
 select.addEventListener('change',draw);metric.addEventListener('change',draw);draw();
 return ()=>{select.removeEventListener('change',draw);metric.removeEventListener('change',draw);cleanup?.();};
}
