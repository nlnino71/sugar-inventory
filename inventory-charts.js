import {mountCharts} from './admin-charts.js';
import {clientDashboardSpecs} from './inventory-stats.js';
export function mountInventory(host,state){
 let cleanup=null;
 host.innerHTML='<label class="f">Pie chart metric<select aria-label="Pie chart metric"><option value="received">SRO Quantity</option><option value="issued">Withdrawal</option><option value="balance" selected>Balance</option></select></label><div class="inventory-plots"></div>';
 const metric=host.querySelector('select');
 const draw=()=>{cleanup?.();cleanup=mountCharts(host.querySelector('.inventory-plots'),clientDashboardSpecs(state,metric.value));};
 metric.addEventListener('change',draw);draw();
 return ()=>{metric.removeEventListener('change',draw);cleanup?.();};
}
