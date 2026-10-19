import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createActivityTracker} from '../activity.js';
test('activity batches preserve order and drain all events on session end',async()=>{
 const batches=[];const tracker=createActivityTracker({delay:60000,send:async(events,context)=>{batches.push({events,context});}});
 tracker.track('page.view');assert.equal(tracker.pending(),0);
 tracker.start({owner:'owner'});for(let i=0;i<121;i++)tracker.track('action.requested',{index:i});
 await tracker.stop();assert.deepEqual(batches.map(b=>b.events.length),[50,50,21]);assert.equal(batches.flatMap(b=>b.events).at(-1).details.index,120);assert.equal(tracker.pending(),0);
});
test('failed activity sends retry identical event IDs without losing events',async()=>{
 let fail=true;const seen=[],errors=[];const tracker=createActivityTracker({delay:60000,onError:m=>errors.push(m),send:async events=>{seen.push(structuredClone(events));if(fail)throw Error('offline');}});
 tracker.start({owner:'owner'});tracker.track('page.view',{page:'stock'});await tracker.flush();assert.equal(tracker.pending(),1);assert.equal(errors.length,1);
 fail=false;await tracker.flush();assert.equal(tracker.pending(),0);assert.equal(seen[0][0].id,seen[1][0].id);await tracker.stop();
});
test('queue limits and failed session ends are visible and isolated',async()=>{
 const errors=[];let fail=true;const sent=[];const tracker=createActivityTracker({delay:60000,maxQueue:1,onError:m=>errors.push(m),send:async(events,context)=>{if(fail)throw Error();sent.push({events,context});}});
 tracker.start({owner:'old'});tracker.track('page.view');tracker.track('page.view');assert.equal(tracker.pending(),1);assert.match(errors[0],/queue full/);
 await tracker.stop();assert.equal(tracker.pending(),0);assert.ok(errors.some(m=>m.includes('session ended')));
 fail=false;tracker.start({owner:'new'});tracker.track('page.view');await tracker.stop();assert.equal(sent.length,1);assert.equal(sent[0].context.owner,'new');
});
