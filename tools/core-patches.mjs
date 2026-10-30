// Host patch until the pinned shared core includes the slow-network startup fix.
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
