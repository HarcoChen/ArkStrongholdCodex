import {sameDecisionPublic} from '../src/decision-state.mjs';
// Host patches until the pinned shared core includes these fixes.
// Fail closed on source drift so dependency updates cannot silently drop it.
export function patchSiteRuntime(source) {
  const changes=[
    ["new Error('Upstream client loading timed out')),60_000)",
      "new Error('Upstream client loading timed out after 180 seconds')),180_000)"],
    ["worker.on('exit',code=>{if(code!==0){", "worker.on('exit',code=>{if(this.worker===worker){"],
    ["    });\n    return this;", "    }).catch(async error=>{await this.close();throw error;});\n    return this;"],
  ];
  for(const [before,after] of changes) {
    if(source.split(before).length!==2)throw new Error('Shared core startup patch no longer matches; review the dependency update');
    source=source.replace(before,after);
  }
  return source;
}

export function patchRpcRuntime(source) {
  const changes = [
    ["if(JSON.stringify(this[key])!==JSON.stringify(value)){this[key]=value;this.revision++;}",
      "if(JSON.stringify(this[key])!==JSON.stringify(value)){const unchanged=key==='pub'&&sameDecisionPublic(this.pub,value,this.myId,this.own);this[key]=value;if(!unchanged)this.revision++;}"],
    ['request(message) {', 'request(message,expectedRevision,signal) {'],
    ["      return await new Promise((resolve,reject)=>{\n        const timer=setTimeout",
      "      signal?.throwIfAborted();\n      if(expectedRevision!==undefined&&(expectedRevision!==this.revision||this.uncertain||this.roomClosed||this.replaced||this.sessionLost||this.siteError||!canAct(this.pub,this.own,this.myId,this.result)))throw Object.assign(new Error('Local decision changed before send'),{code:'LOCAL_STATE_CHANGED'});\n      return await new Promise((resolve,reject)=>{\n        const timer=setTimeout"],
    ['      const executed=[];let readyRound;',
      '      // Consume the batch token even if an ack has no state push; old batches cannot replay.\n      this.revision++;\n      const executed=[];let readyRound;'],
    ['        const phase=this.pub.phase,round=this.pub.round,message=this.normalize(step.action);',
      '        const expectedRevision=this.revision,choiceId=this.own?.personalChoice?.id;\n        const phase=this.pub.phase,round=this.pub.round,message=this.normalize(step.action);'],
    ['await this.request(message);executed.push', 'await this.request(message,expectedRevision,signal);executed.push'],
    ['if(readyRound!==undefined||this.pub.phase!==phase', 'if(choiceId!==this.own?.personalChoice?.id||readyRound!==undefined||this.pub.phase!==phase'],
  ];
  for (const [before, after] of changes) {
    if (source.split(before).length !== 2) throw new Error('Shared core concurrency patch no longer matches; review the dependency update');
    source = source.replace(before, after);
  }
  return sameDecisionPublic.toString() + '\n' + source;
}
