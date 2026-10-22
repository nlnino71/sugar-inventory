// Keep useful history; successful inventory mutations are recorded by DB triggers.
const essential=new Set(['page.view','auth.result','file.exported','save.failed','save.conflict','admin.view']);
export function isSimpleAuditEvent(event,details={}){
 return essential.has(event)||(event==='session.end'&&details.reason==='sign_out');
}
