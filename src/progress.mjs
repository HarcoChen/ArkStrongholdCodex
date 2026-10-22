// Protocol-level activity only: never return intermediate gameplay to the model.
// A host may still enforce an absolute deadline; progress does not override it.
export async function withProgress(extra,run,intervalMs=15_000) {
  const token=extra._meta?.progressToken;
  if(token===undefined)return run();
  let progress=0,sending=false,stopped=false;
  const timer=setInterval(async()=>{
    if(stopped||sending||extra.signal?.aborted)return;
    sending=true;
    try {await extra.sendNotification({method:'notifications/progress',params:{progressToken:token,progress:++progress,message:'工具仍在运行；正在监听游戏站事件，无需轮询。'}});}
    catch {} finally {sending=false;}
  },intervalMs);
  timer.unref?.();
  const stop=()=>{stopped=true;clearInterval(timer);};
  extra.signal?.addEventListener('abort',stop,{once:true});
  try {return await run();}
  finally {stop();extra.signal?.removeEventListener('abort',stop);}
}
