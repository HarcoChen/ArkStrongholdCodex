import {build} from 'esbuild';
import {mkdir,rm} from 'node:fs/promises';
import {writeNotices} from '@arkstrongholdrl/ark-play-core/build-notices';
import {copySource} from '@arkstrongholdrl/ark-play-core/build-package';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const shared=dirname(fileURLToPath(import.meta.resolve('@arkstrongholdrl/ark-play-core/package.json')));
await mkdir(join(root,'dist'),{recursive:true});
await build({entryPoints:[join(root,'src/mcp.mjs')],outfile:join(root,'dist/mcp.mjs'),bundle:true,
  platform:'node',format:'esm',target:'node22',minify:false,sourcemap:false,
  banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"}});
await build({entryPoints:[join(shared,'src/site-worker.mjs'),join(shared,'src/site-loader.mjs')],outdir:join(root,'dist'),
  outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22'});
await writeNotices(join(root,'node_modules'),join(root,'dist/THIRD_PARTY_LICENSES.txt'));
await rm(join(root,'corresponding-source'),{recursive:true,force:true});
await copySource(shared,join(root,'corresponding-source/ark-play-core'));
console.log('Built Codex MCP host from the pinned shared core.');
