// Unit fixtures only: no sockets, live room, gameplay telemetry or model runs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {patchRpcRuntime} from '../tools/core-patches.mjs';
import {sameDecisionPublic} from '../src/decision-state.mjs';
import {canAct} from '../node_modules/@arkstrongholdrl/ark-play-core/src/native-view.mjs';
const original=await readFile(new URL('../node_modules/@arkstrongholdrl/ark-play-core/src/rpc.mjs',import.meta.url),'utf8');
const patched=patchRpcRuntime(original);
function fixture({validate=()=>{},send=()=>({t:'ok'}),timeout=false}={}) {
  const sent=[];
  const GameClient=runInNewContext(patched.replace(/^import .*;$/gm,'').replace('export class GameClient','class GameClient')+'\nGameClient',{
    resolveConfig:()=>({}),readFileSync:()=>{throw new Error('No file reads in fixture');},process:{env:{}},
    WebSocket:{OPEN:1},canAct,structuredClone,URL,console,
    setTimeout:(fn,ms)=>{if(timeout&&ms===15_000){queueMicrotask(fn);return 0;}return setTimeout(fn,ms);},clearTimeout,
  });
  const client=new GameClient();
  client.myId='me';client.room={code:'TEST',inMatch:true};
  client.pub={phase:'PREP',round:2,paused:false,players:[{playerId:'me',ready:false,boardCount:0},{playerId:'other',ready:false,boardCount:0,shopLevel:1,bonds:[]}]};
  client.own={playerId:'me',alive:true,ready:false,funds:10,hand:[{uid:1,id:'card'}],shop:{slots:[{id:'card',price:3}]}};
  client.quiet=async()=>{};client.connect=async()=>{};client.settle=async()=>{};
  client.view=async()=>({view:{revision:client.revision,phase:client.pub.phase}});
  client.site={request:async()=>validate(client)};
  client.ws={readyState:1,send:bytes=>{const message=JSON.parse(bytes);sent.push(message);const reply=send(client,message);if(reply)queueMicrotask(()=>client.receive({...reply,rid:message.rid}));}};
  return {client,sent};
}
const payload=(revision=0,steps=[{type:'move',uid:1,to:'board',row:1,col:1}])=>({op:'act',revision,steps:steps.map(action=>({action,reason:'fixture'}))});
function opponent(client) {const pub=structuredClone(client.pub);pub.players[1].boardCount++;pub.players[1].shopLevel++;pub.players[1].bonds=[{id:'bond',layers:2}];client.update('pub',pub);}

test('opponent PREP display updates do not invalidate a batch, including validation awaits',async()=>{
  const {client,sent}=fixture({validate:c=>opponent(c)});opponent(client);
  assert.equal(client.revision,0);
  const result=await client.call(payload());assert.equal(result.executed.length,1);assert.equal(sent.length,1);
  assert.equal(client.pub.players[1].boardCount,3); // full public state remains observable
});
for(const [name,change] of Object.entries({
  funds:c=>c.update('own',{...c.own,funds:9}),
  identity:c=>c.update('own',{...c.own,hand:[{uid:2,id:'different'}]}),
  bossMate:c=>c.update('own',{...c.own,bossMate:{playerId:'other',units:[{uid:2}]}}),
  inventory:c=>c.update('own',{...c.own,items:[{uid:4}]}),
  phase:c=>c.update('pub',{...c.pub,phase:'COMBAT'}),
  round:c=>c.update('pub',{...c.pub,round:3}),
  paused:c=>c.update('pub',{...c.pub,paused:true}),
  global:c=>c.update('pub',{...c.pub,stageId:'new'}),
  room:c=>c.update('room',{...c.room,code:'NEXT'}),
  ownPublic:c=>{const p=structuredClone(c.pub);p.players[0].boardCount++;c.update('pub',p);},
  opponentReady:c=>{const p=structuredClone(c.pub);p.players[1].ready=true;c.update('pub',p);},
  unknownOpponentField:c=>{const p=structuredClone(c.pub);p.players[1].futureRule=1;c.update('pub',p);},
}))test(name+' invalidates with explicit nonexecution, without retry',async()=>{
  const {client,sent}=fixture();change(client);const result=await client.call(payload());
  assert.equal(result.error,'STALE_CLIENT_SNAPSHOT');assert.equal(result.executed.length,0);assert.equal(sent.length,0);
});
test('no exemption outside PREP or during personal choice',()=>{
  const {client}=fixture();const after=structuredClone(client.pub);after.players[1].boardCount++;
  assert.equal(sameDecisionPublic(client.pub,after,'me',{playerId:'me',personalChoice:{id:1}}),false);
  assert.equal(sameDecisionPublic({...client.pub,phase:'SP_DRAFT'},{...after,phase:'SP_DRAFT'},'me',{playerId:'me'}),false);
  assert.equal(sameDecisionPublic(client.pub,after,'missing',{}),false);
});
test('own state changing and reverting still invalidates the old revision',async()=>{
  const {client,sent}=fixture();const own=client.own;client.update('own',{...own,funds:0});client.update('own',own);
  assert.equal((await client.call(payload())).error,'STALE_CLIENT_SNAPSHOT');assert.equal(sent.length,0);
});
test('duplicate batch token cannot resend after ack with no state push',async()=>{
  const {client,sent}=fixture();await client.call(payload());
  assert.equal((await client.call(payload())).error,'STALE_CLIENT_SNAPSHOT');assert.equal(sent.length,1);
});
test('state change during per-step validation stops before send',async()=>{
  let validations=0;const {client,sent}=fixture({validate:c=>{if(++validations===2)c.update('own',{...c.own,funds:0});}});
  const result=await client.call(payload());assert.equal(sent.length,0);assert.equal(result.executed[0].result.error,'LOCAL_STATE_CHANGED');
});
test('queued intent revalidates phase after sendTail/pacing await',async()=>{
  const {client,sent}=fixture();let unblock;client.sendTail=new Promise(resolve=>unblock=resolve);
  const pending=client.call(payload());await new Promise(resolve=>setImmediate(resolve));
  client.update('pub',{...client.pub,phase:'COMBAT'});unblock();
  const result=await pending;assert.equal(sent.length,0);assert.equal(result.executed[0].accepted,false);
});
test('opponent change while queued still permits the local intent',async()=>{
  const {client,sent}=fixture();let unblock;client.sendTail=new Promise(resolve=>unblock=resolve);
  const pending=client.call(payload());await new Promise(resolve=>setImmediate(resolve));opponent(client);unblock();
  assert.equal((await pending).executed[0].accepted,true);assert.equal(sent.length,1);
});
test('partial batch stops on rejection and duplicate never replays accepted prefix',async()=>{
  let calls=0;const {client,sent}=fixture({send:()=>++calls===1?{t:'ok'}:{t:'error',code:'NO_FUNDS'}});
  const p=payload(0,[{type:'refresh'},{type:'refresh'},{type:'refresh'}]);const result=await client.call(p);
  assert.equal(result.executed.length,2);assert.equal(result.executed[0].accepted,true);assert.equal(result.executed[1].accepted,false);
  assert.equal(sent.length,2);assert.equal((await client.call(p)).error,'STALE_CLIENT_SNAPSHOT');assert.equal(sent.length,2);
});
test('timeout is uncertain, never retried; another act requires view recovery',async()=>{
  const {client,sent}=fixture({timeout:true,send:()=>null});
  await assert.rejects(client.call(payload()),/timed out/);assert.equal(client.uncertain,true);assert.equal(sent.length,1);
  await assert.rejects(client.call(payload(client.revision)),/resync the uncertain/);assert.equal(sent.length,1);
});
test('server INTERNAL is not retried',async()=>{
  const {client,sent}=fixture({send:()=>({t:'error',code:'INTERNAL'})});
  await client.call(payload());assert.equal(sent.length,1);
});
test('source drift fails closed',()=>assert.throws(()=>patchRpcRuntime(patched),/no longer matches/));
for(const flag of ['roomClosed','replaced','sessionLost','siteError'])test(flag+' appearing while queued prevents send',async()=>{
  const {client,sent}=fixture();let unblock;client.sendTail=new Promise(resolve=>unblock=resolve);
  const pending=client.call(payload());await new Promise(resolve=>setImmediate(resolve));client[flag]=true;unblock();
  assert.equal((await pending).executed[0].result.error,'LOCAL_STATE_CHANGED');assert.equal(sent.length,0);
});
test('missing or mismatched private player cannot use scoped exemption',()=>{
  const {client}=fixture();const after=structuredClone(client.pub);after.players[1].boardCount++;
  for(const own of [null,{}, {playerId:'other'}])assert.equal(sameDecisionPublic(client.pub,after,'me',own),false);
});
test('new personal choice stops batch before an unseen choice can be selected',async()=>{
  const {client,sent}=fixture({send:c=>{c.update('own',{...c.own,personalChoice:{id:'new',cards:[1,2]}});return {t:'ok'};}});
  const result=await client.call(payload(0,[{type:'art',itemUid:1,row:1,col:1},{type:'choice',idx:0}]));
  assert.equal(result.executed.length,1);assert.equal(sent.length,1);
});
test('local stale on second step preserves accepted prefix without resend',async()=>{
  let validations=0;const {client,sent}=fixture({validate:c=>{if(++validations===4)c.update('own',{...c.own,funds:0});}});
  const p=payload(0,[{type:'refresh'},{type:'refresh'}]);const result=await client.call(p);
  assert.equal(result.executed[0].accepted,true);assert.equal(result.executed[1].result.error,'LOCAL_STATE_CHANGED');
  assert.equal(sent.length,1);await client.call(p);assert.equal(sent.length,1);
});
test('abort while queued never sends or retries',async()=>{
  const {client,sent}=fixture();let unblock;client.sendTail=new Promise(resolve=>unblock=resolve);
  const controller=new AbortController();const pending=client.call(payload(),controller.signal);
  await new Promise(resolve=>setImmediate(resolve));controller.abort(new Error('cancelled'));unblock();
  await assert.rejects(pending,/cancelled/);assert.equal(sent.length,0);assert.equal(client.uncertain,true);
});
