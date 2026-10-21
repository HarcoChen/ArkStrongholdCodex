// Refresh saved settings only at a safe new-game boundary, as in the DSH host.
import {createTools} from '@arkstrongholdrl/ark-play-core';
import {resolveConfig} from '@arkstrongholdrl/ark-play-core/config';
export function createCodexRuntime(config={}) {
  const options={...config,client:'codex-mcp'};
  let runtime=createTools(options),detached=false,busy=false;
  const tools=runtime.tools.map(tool=>({...tool,async execute(args,signal) {
    signal?.throwIfAborted();
    if(busy)throw new Error('One gameplay call at a time');
    busy=true;
    try {
      if(detached){runtime=createTools(options);detached=false;}
      const previous=runtime.client;
      if(tool.name==='ark_start'&&!previous.room?.inMatch&&
        !previous.uncertain&&!previous.replaced&&!previous.sessionLost) {
        const next=resolveConfig(options);
        if(previous.result||JSON.stringify(next)!==JSON.stringify(previous.config)) {
          const replacement=createTools(options);
          await runtime.close();runtime=replacement;
        }
      }
      const result=await runtime.tools.find(selected=>selected.name===tool.name).execute(args,signal);
      if(tool.name==='ark_finish'){await runtime.close();detached=true;}
      return result;
    } finally {busy=false;}
  }}));
  return {tools,async close(){await runtime.close();}};
}
