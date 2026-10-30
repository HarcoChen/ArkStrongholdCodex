import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {runInNewContext} from 'node:vm';
import {patchSiteRuntime} from '../tools/core-patches.mjs';

const original=await readFile(new URL('../node_modules/@arkstrongholdrl/ark-play-core/src/site.mjs',import.meta.url),'utf8');
const patched=patchSiteRuntime(original);
const files=['chess','enemies','tokens','stages','waves','bonds','items','garrisons','bands','effects','backups','bosses'];
function fixture() {
  const timers=new Set(),workers=[],failures=[];
  class Worker extends EventEmitter {
    constructor(){super();workers.push(this);}
    async terminate(){this.terminated=true;this.emit('exit',1);}
  }
  const cs='a'.repeat(64);
  const index={cs,v:1,vanilla:true,simFiles:{},data:Object.fromEntries(files.map(key=>[key,{url:'/data/'+key+'.json',bytes:2,sha256:'hash'}]))};
  const SiteRuntime=runInNewContext(patched.slice(patched.indexOf('export class')).replace('export class','class').replaceAll('import.meta.url',"'file:///runtime/site.mjs'")+'\nSiteRuntime',{
    Worker,URL,FILES:files,
    readSite:async url=>String(url).endsWith('index.json')?JSON.stringify(index):Buffer.from('{}'),
    createHash:()=>({update:()=>({digest:()=> 'hash'})}),
    setTimeout:(fn,ms)=>{const timer={fn:()=>{timers.delete(timer);fn();},ms};timers.add(timer);return timer;},
    clearTimeout:timer=>timers.delete(timer),
  });
  const runtime=new SiteRuntime('https://example.test',{},()=>{},error=>failures.push(error));
  return {runtime,cs,timers,workers,failures};
}
async function start(f) {
  const loading=f.runtime.load(f.cs,'player');
  // Flush manifest/data reads without network or a real game session.
  await new Promise(resolve=>setImmediate(resolve));
  return {loading,worker:f.workers[0]};
}
test('slow initialization has a 180-second budget and ready clears it',async()=>{
  const f=fixture(),{loading,worker}=await start(f);
  assert.equal([...f.timers][0].ms,180_000);
  worker.emit('message',{type:'ready',app:'test'});
  assert.equal(await loading,f.runtime);
  assert.equal(f.timers.size,0);
  assert.equal(worker.terminated,undefined);
  await f.runtime.close();
});
test('startup timeout terminates the worker and clears its timer',async()=>{
  const f=fixture(),{loading,worker}=await start(f);
  const rejected=assert.rejects(loading,/timed out after 180 seconds/);
  [...f.timers][0].fn();
  await rejected;
  assert.equal(worker.terminated,true);
  assert.equal(f.runtime.worker,null);
  assert.equal(f.timers.size,0);
});
for(const event of ['error','exit'])test('startup '+event+' rejects promptly and cleans up',async()=>{
  const f=fixture(),{loading,worker}=await start(f);
  const rejected=assert.rejects(loading,event==='error'?/broken/:/worker exited/);
  worker.emit(event,event==='error'?new Error('broken'):0);
  await rejected;
  assert.equal(worker.terminated,true);
  assert.equal(f.timers.size,0);
});
test('patch refuses changed upstream source',()=>{
  assert.throws(()=>patchSiteRuntime(patched),/no longer matches/);
});
