// Standalone release packaging. No sibling checkout, game data or credentials.
import {mkdtemp,mkdir,copyFile,cp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const SOURCE=['src','tools','index.mjs','package.json','package-lock.json','plugin.json','mcp.json','.codex-plugin',
  'cordis.patch.yml','LICENSE','README.md','PUBLISH.md'];
export async function copySource(from,to) {
  await mkdir(to,{recursive:true});
  for(const name of SOURCE) {
    const path=join(from,name);try{await stat(path);}catch(e){if(e.code==='ENOENT')continue;throw e;}
    await cp(path,join(to,name),{recursive:true});
  }
}
export async function packageClient({kind,root,sharedRoot=root,output}) {
  if(!['codex','dsh'].includes(kind))throw new Error('Unknown client kind');
  const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  const name=kind==='codex'?'ark-play-codex':metadata.name.replace(/^@/,'').replaceAll('/','-');
  const destination=resolve(output||join(root,'results/releases'));await mkdir(destination,{recursive:true});
  const scratch=await mkdtemp(join(tmpdir(),'ark-play-release-'));
  try {
    const stage=join(scratch,name);await mkdir(stage);
    for(const file of ['README.md','LICENSE','PUBLISH.md'])await copyFile(join(root,file),join(stage,file));
    await copyFile(join(sharedRoot,'tools/configure.mjs'),join(stage,'configure.mjs'));
    if(kind==='codex') {
      for(const file of ['plugin.json','mcp.json'])await copyFile(join(root,file),join(stage,file));
      await cp(join(root,'.codex-plugin'),join(stage,'.codex-plugin'),{recursive:true});
      await cp(join(root,'dist'),join(stage,'dist'),{recursive:true});
    }else await cp(join(root,'dist'),stage,{recursive:true});
    await copySource(sharedRoot,join(stage,'corresponding-source/ark-play-core'));
    if(kind==='dsh')await copySource(root,join(stage,'corresponding-source/dsh-plugin'));
    const path=join(destination,name+'-'+metadata.version+'.zip');
    try{await stat(path);throw new Error('Archive already exists: '+path);}catch(e){if(e.code!=='ENOENT')throw e;}
    execFileSync('zip',['-q','-r',path,name],{cwd:scratch});
    const bytes=await readFile(path),record={filename:path.split('/').at(-1),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    await writeFile(path+'.sha256',record.sha256+'  '+record.filename+'\n');
    await writeFile(path+'.json',JSON.stringify(record,null,2)+'\n');
    return record;
  }finally{await rm(scratch,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await packageClient({kind:'codex',root:fileURLToPath(new URL('../',import.meta.url)),output:process.argv[2]}),null,2));
}
