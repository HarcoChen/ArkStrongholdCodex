// Package the two already-built clients and corresponding source. No site data.
import {mkdtemp,mkdir,copyFile,cp,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const core=fileURLToPath(new URL('../',import.meta.url)),dsh=resolve(core,'../ark-play-dsh');
const metadata=JSON.parse(await readFile(join(core,'package.json'),'utf8'));
const destination=resolve(process.argv[2]||join(core,'results/releases'));await mkdir(destination,{recursive:true});
const scratch=await mkdtemp(join(tmpdir(),'ark-play-release-')),records={};
async function source(from,to) {
  await mkdir(to,{recursive:true});
  for(const entry of await readdir(from,{withFileTypes:true})) {
    if(['.git','node_modules','dist','results'].includes(entry.name))continue;
    await cp(join(from,entry.name),join(to,entry.name),{recursive:true});
  }
}
try {
  for(const [name,repo] of [['ark-play-codex',core],['ark-play-dsh',dsh]]) {
    const stage=join(scratch,name);await mkdir(stage);
    for(const file of ['README.md','LICENSE','PUBLISH.md'])await copyFile(join(repo,file),join(stage,file));
    await copyFile(join(core,'tools/configure.mjs'),join(stage,'configure.mjs'));
    if(name.endsWith('codex')) {
      for(const file of ['plugin.json','mcp.json'])await copyFile(join(core,file),join(stage,file));
      await cp(join(core,'.codex-plugin'),join(stage,'.codex-plugin'),{recursive:true});
      await cp(join(core,'dist'),join(stage,'dist'),{recursive:true});
    }else await cp(join(dsh,'dist'),stage,{recursive:true});
    await source(core,join(stage,'corresponding-source/ark-play-codex'));
    if(name.endsWith('dsh'))await source(dsh,join(stage,'corresponding-source/ark-play-dsh'));
    const path=join(destination,name+'-'+metadata.version+'.zip');
    try{await readFile(path);throw new Error('Archive already exists: '+path);}catch(e){if(e.code!=='ENOENT')throw e;}
    execFileSync('zip',['-q','-r',path,name],{cwd:scratch});
    const bytes=await readFile(path);records[name]={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  }
  await writeFile(join(destination,'manifest-'+metadata.version+'.json'),JSON.stringify(records,null,2)+'\n');
  console.log(JSON.stringify(records,null,2));
}finally{await rm(scratch,{recursive:true,force:true});}
