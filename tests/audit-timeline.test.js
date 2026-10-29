import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderAuditTimeline,eventTitle} from '../audit-timeline.js';
test('browser activity is readable and retains false values, network, device and provenance without JSON',()=>{
 const html=renderAuditTimeline([{occurred_at:'2026-10-21T01:49:47Z',email:'staff@example.com',event:'browser.visibility.change',details:{source:'browser-reported',context:{page:'dashboard',state:'visible'},network:{isp:'Example ISP',asn:'AS64500',country:'Philippines'},session:'session-123',shared_view:false,client_at:'2026-10-21T01:49:47Z',request_network:{ip:'203.0.113.1',ip_source:'Vercel request IP',user_agent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/155.0.0.0 Safari/537.36'}}}]);
 for(const value of ['Page became visible','Dashboard','Chrome · macOS','Example ISP','203.0.113.1','Session &amp; provenance','session-123','Shared link','No','IP source','Vercel request IP','Browser event time'])assert.ok(html.includes(value),value);
 assert.ok(!html.includes('{"'));assert.ok(!html.includes('[object Object]'));
});
test('record edits show labeled before and after values, including zero and nested profile data',()=>{
 const html=renderAuditTimeline([{event:'receipts.edit',details:{before:{qty:0,profile:{notes:'old'}},after:{qty:12.5,profile:{notes:'new'}},revision:0}}]);
 for(const value of ['Updated SRO quantity','Before','After','Quantity','>0<','12.5','Profile / Notes','old','new','Revision'])assert.ok(html.includes(value),value);
 assert.equal(eventTitle('browser.action.requested'),'Used a control');assert.ok(!html.includes('{"'));
});
test('all nested values and keys escape HTML and empty timelines explain themselves',()=>{
 const html=renderAuditTimeline([{event:'guest.page.view',email:'<img onerror=bad>',details:{context:{page:'<script>bad</script>',custom:{'<key>':['<svg onload=bad>',false,null]}}}}]);
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<svg'));assert.ok(html.includes('&lt;key&gt;'));assert.ok(html.includes('Not provided'));assert.ok(html.includes('No'));assert.ok(renderAuditTimeline().includes('No activity records on this page.'));
});
test('bulk JSON restore has one clear audit title',()=>{
 assert.equal(eventTitle('inventory.restored_json'),'Restored JSON backup');
});
