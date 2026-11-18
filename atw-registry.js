const compare = (a, b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'});
const numberKey = value => String(value ?? '').trim().toUpperCase();

export const ATW_COLUMNS = ['ATW No.', 'Source mill', 'Quantity', 'DR #', 'Shipping date', 'Withdrawn', 'Balance', 'Status'];

export function atwRows(state) {
  const withdrawals = new Map();
  for (const issue of state.issues) {
    const key = numberKey(issue.atw);
    if (key) withdrawals.set(key, (withdrawals.get(key) ?? 0) + (+issue.qty || 0));
  }
  return (Array.isArray(state.atws) ? state.atws : []).filter(record => record && numberKey(record.atw)).map(record => {
    const withdrawn = withdrawals.get(numberKey(record.atw)) ?? 0;
    const quantity = +record.qty || 0;
    const balance = Number((quantity - withdrawn).toFixed(6));
    return {...record, quantity, withdrawn, balance, status:!record.ship ? 'Not shipped' : balance > 0 ? 'Shipped, balance left' : 'Shipped'};
  }).sort((a, b) => Number(!!a.ship) - Number(!!b.ship) || compare(String(a.atw), String(b.atw)));
}

export function atwMillTotals(rows) {
  const mills = new Map();
  for (const row of rows) {
    const name = String(row.mill || '').trim() || 'No source mill';
    const mill = mills.get(name) ?? {name, count:0, shipped:0, pending:0, pendingCount:0};
    mill.count++;
    if (row.ship) mill.shipped += row.quantity;
    else {
      mill.pending += row.quantity;
      mill.pendingCount++;
    }
    mills.set(name, mill);
  }
  return [...mills.values()].sort((a, b) => compare(a.name, b.name));
}

export function atwValues(row) {
  return [row.atw, row.mill, row.quantity, row.dr, row.ship, row.withdrawn, row.balance, row.status];
}
