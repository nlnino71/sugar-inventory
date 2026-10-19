export const UNITS=[{label:'bags (LKg)',kg:50},{label:'kg',kg:1},{label:'metric tonnes (t)',kg:1000}];
export function unitWeight(label){
 const name=String(label||'').trim().toLowerCase();
 if(['bags (lkg)','lkg','lkg bags','50 kg bags'].includes(name))return 50;
 if(['kg','kgs','kilogram','kilograms'].includes(name))return 1;
 if(['metric tonnes (t)','t','mt','tonne','tonnes','metric ton','metric tons','metric tonnes'].includes(name))return 1000;
 return null;
}
export function convertQuantity(qty,fromKg,toKg){
 const n=Number(qty);
 if(qty==null||qty===''||!Number.isFinite(n)||!Number.isFinite(fromKg)||fromKg<=0||!Number.isFinite(toKg)||toKg<=0)throw new Error('Enter a valid weight per current unit before converting.');
 const value=Number((n*fromKg/toKg).toPrecision(15));
 if(!Number.isFinite(value)||(n!==0&&value===0))throw new Error('This quantity is outside the supported conversion range.');
 return value;
}
export function convertInventory(state,target,sourceKg=unitWeight(state.unit)){
 const unit=UNITS.find(u=>u.label===target);if(!unit)throw new Error('Choose a supported target unit.');
 const next=structuredClone(state);
 for(const collection of ['receipts','issues'])next[collection]=(state[collection]||[]).map(row=>({...row,qty:convertQuantity(row.qty,sourceKg,unit.kg)}));
 // Validate the source even for an empty inventory.
 convertQuantity(1,sourceKg,unit.kg);next.unit=unit.label;return next;
}
