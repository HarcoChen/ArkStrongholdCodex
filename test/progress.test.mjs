import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {withProgress} from '../src/progress.mjs';

test('progress is protocol activity, never resolves the call, and stops on completion',async()=>{
  const sent=[];let resolve;
  const result=withProgress({_meta:{progressToken:0},sendNotification:async n=>sent.push(n)},()=>new Promise(done=>resolve=done),5);
  await delay(22);assert.ok(sent.length>0);
  assert.equal(sent[0].params.progressToken,0);assert.equal(sent[0].method,'notifications/progress');
  assert.deepEqual(sent.map(n=>n.params.progress),sent.map((_,i)=>i+1));
  resolve('decision');assert.equal(await result,'decision');const count=sent.length;
  await delay(20);assert.equal(sent.length,count);
});

test('no unrequested progress; cancellation removes the notification timer',async()=>{
  let sends=0;
  await withProgress({sendNotification:async()=>sends++},async()=>{await delay(15);});assert.equal(sends,0);
  const controller=new AbortController();
  const result=withProgress({_meta:{progressToken:'wait'},signal:controller.signal,sendNotification:async()=>sends++},async()=>{
    await delay(15);controller.abort();await delay(15);throw new Error('cancelled');
  },5);
  await assert.rejects(result,/cancelled/);const count=sends;await delay(20);assert.equal(sends,count);
});
