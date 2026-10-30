import {build} from 'esbuild';
import {mkdir,rm,chmod,readFile,writeFile,appendFile} from 'node:fs/promises';
import {patchSiteRuntime} from './core-patches.mjs';
import {writeNotices} from '@arkstrongholdrl/ark-play-core/build-notices';
import {copySource} from '@arkstrongholdrl/ark-play-core/build-package';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const shared=dirname(fileURLToPath(import.meta.resolve('@arkstrongholdrl/ark-play-core/package.json')));
const patchedSite=patchSiteRuntime(await readFile(join(shared,'src/site.mjs'),'utf8'));
await mkdir(join(root,'dist'),{recursive:true});
await build({entryPoints:[join(root,'src/mcp.mjs')],outfile:join(root,'dist/mcp.mjs'),bundle:true,
  platform:'node',format:'esm',target:'node22',minify:false,sourcemap:false,
  plugins:[{name:'core-startup-fix',setup(builder){builder.onLoad({filter:/[/\\]site\.mjs$/},args=>{
    if(args.path===join(shared,'src/site.mjs'))return {contents:patchedSite,loader:'js',resolveDir:join(shared,'src')};
  });}}],
  banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"}});
await build({entryPoints:[join(shared,'src/site-worker.mjs'),join(shared,'src/site-loader.mjs')],outdir:join(root,'dist'),
  outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22'});
await build({entryPoints:[join(shared,'tools/configure.mjs')],outfile:join(root,'configure.mjs'),bundle:true,platform:'node',format:'esm',target:'node22'});
await chmod(join(root,'configure.mjs'),0o755);
await writeNotices(join(root,'node_modules'),join(root,'dist/THIRD_PARTY_LICENSES.txt'));
await rm(join(root,'corresponding-source'),{recursive:true,force:true});
await copySource(shared,join(root,'corresponding-source/ark-play-core'));
await writeFile(join(root,'corresponding-source/ark-play-core/src/site.mjs'),patchedSite);
await appendFile(join(root,'corresponding-source/ark-play-core/PROVENANCE.md'),
  '\nCodex host patch: allow 180 seconds for public module initialization and terminate\nfailed startup workers. Applied reproducibly by tools/core-patches.mjs.\n');
console.log('Built Codex MCP host from the pinned shared core.');
