// Codex release staging includes the plugin's bundled skills and their sources.
import {copySource} from '@arkstrongholdrl/ark-play-core/build-package';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const sharedRoot=dirname(fileURLToPath(import.meta.resolve('@arkstrongholdrl/ark-play-core/package.json')));
const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const destination=resolve(process.argv[2]||join(root,'results/releases'));
await mkdir(destination,{recursive:true});
const path=join(destination,'ark-play-codex-'+metadata.version+'.zip');
try{await stat(path);throw new Error('Archive already exists: '+path);}catch(e){if(e.code!=='ENOENT')throw e;}
const scratch=await mkdtemp(join(tmpdir(),'ark-play-release-'));
try {
  const stage=join(scratch,'ark-play-codex');
  await mkdir(join(stage,'.agents/plugins'),{recursive:true});
  for(const file of ['README.md','LICENSE','configure.mjs','plugin.json','mcp.json','.codex-plugin','dist','skills','docs','.agents/plugins/marketplace.json']) {
    await cp(join(root,file),join(stage,file),{recursive:true});
  }
  try{await cp(join(root,'PUBLISH.md'),join(stage,'PUBLISH.md'));}catch(e){if(e.code!=='ENOENT')throw e;}
  await copySource(sharedRoot,join(stage,'corresponding-source/ark-play-core'));
  const source=join(stage,'corresponding-source/codex-plugin');
  await copySource(root,source);
  await cp(join(root,'skills'),join(source,'skills'),{recursive:true});
  await cp(join(root,'docs'),join(source,'docs'),{recursive:true});
  execFileSync('zip',['-q','-r',path,'ark-play-codex'],{cwd:scratch});
  const bytes=await readFile(path);
  const record={filename:path.split('/').at(-1),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  await writeFile(path+'.sha256',record.sha256+'  '+record.filename+'\n');
  await writeFile(path+'.json',JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify(record,null,2));
}finally{await rm(scratch,{recursive:true,force:true});}
