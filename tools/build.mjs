import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {writeNotices} from './notices.mjs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(join(root,'dist'),{recursive:true});
await build({entryPoints:[join(root,'src/mcp.mjs')],outfile:join(root,'dist/mcp.mjs'),bundle:true,
  platform:'node',format:'esm',target:'node22',minify:false,sourcemap:false,
  banner:{js:"import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"}});
await build({entryPoints:[join(root,'src/site-worker.mjs'),join(root,'src/site-loader.mjs')],outdir:join(root,'dist'),
  outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22'});
await writeNotices(join(root,'node_modules'),join(root,'dist/THIRD_PARTY_LICENSES.txt'));
console.log('Built gameplay-only dist/mcp.mjs.');
