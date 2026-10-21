import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderSessions,sessionId,deviceType} from '../admin-sessions.js';
test('sessions group by account, retain separate sign-ins and mark only the matching current session',()=>{
 const html=renderSessions([{id:'mine',user_id:'a',email:'owner@example.com',user_agent:'Macintosh Chrome/155',ip_address:'203.0.113.1',network:{country:'Philippines',isp:'Example ISP'}},{id:'other',user_id:'a',email:'owner@example.com',user_agent:'Windows Firefox/140'},{id:'phone',user_id:'b',email:'staff@example.com',user_agent:'Android Mobile Chrome/155'}],'mine');
 assert.equal((html.match(/class="session-account"/g)||[]).length,2);assert.equal((html.match(/class="session-device"/g)||[]).length,3);assert.equal((html.match(/This session/g)||[]).length,1);
 for(const text of ['Chrome · macOS','Firefox · Windows','Phone','Philippines','Example ISP','Location unavailable','Session last updated','Not recorded'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('Active now'));
});
test('missing and malformed tokens never mark a current session',()=>{
 assert.equal(sessionId('not-a-token'),'');assert.equal(sessionId(''), '');
 const token='header.'+Buffer.from(JSON.stringify({session_id:'current'})).toString('base64url')+'.signature';assert.equal(sessionId(token),'current');
 assert.ok(!renderSessions([{id:''}]).includes('This session'));assert.ok(renderSessions().includes('No stored sign-in sessions'));
});
test('untrusted device fields are escaped and unknown devices stay unknown',()=>{
 const html=renderSessions([{id:'<svg>',email:'<script>alert(1)</script>',user_agent:'<img onerror=bad>',network:{country:'<b>Country</b>'}}]);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;svg&gt;'));assert.ok(html.includes('&lt;b&gt;Country&lt;/b&gt;'));assert.equal(deviceType(''), 'Device not identified');assert.equal(deviceType('iPad'), 'Tablet');assert.equal(deviceType('Android Mobile'), 'Phone');
});
