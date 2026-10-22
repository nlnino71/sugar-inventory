import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isSimpleAuditEvent} from '../audit-policy.js';
test('simple audit retains meaningful actions and explicit sign-out',()=>{
 for(const event of ['page.view','auth.result','file.exported','save.failed','save.conflict','admin.view'])assert.equal(isSimpleAuditEvent(event),true);
 assert.equal(isSimpleAuditEvent('session.end',{reason:'sign_out'}),true);
});
test('simple audit drops noisy interactions and automatic page exits',()=>{
 for(const event of ['action.requested','form.submit','field.change','visibility.change','panel.view','panel.close','form.invalid','session.end','unknown'])assert.equal(isSimpleAuditEvent(event),false);
 assert.equal(isSimpleAuditEvent('session.end',{reason:'pagehide'}),false);
});
test('server ignores noisy events from older tabs without writing to the database',async()=>{
 const {default:handler}=await import('../api/activity.js');let code,ended=false;
 const res={setHeader(){},status(n){code=n;return this;},end(){ended=true;},json(){throw Error('Unexpected rejection');}};
 await handler({method:'POST',headers:{'content-type':'application/json'},body:{events:[{id:'11111111-1111-4111-8111-111111111111',session:'22222222-2222-4222-8222-222222222222',event:'field.change',details:{field:'search'}}]}},res);
 assert.equal(code,204);assert.equal(ended,true);
});
