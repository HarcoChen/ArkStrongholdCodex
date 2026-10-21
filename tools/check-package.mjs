// Build/package contract audit, not a gameplay test harness. No sockets or models.
import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
for(const path of ['plugin.json','.codex-plugin/plugin.json']) {
  const value=JSON.parse(await readFile(join(root,path),'utf8'));
  if(value.version!==metadata.version||value.name!=='ark-play')throw new Error('Plugin identity/version mismatch: '+path);
}
const mcp=JSON.parse(await readFile(join(root,'mcp.json'),'utf8'));
if(mcp.mcpServers?.ark?.args?.[0]!=='${PLUGIN_ROOT}/dist/mcp.mjs')throw new Error('MCP entry mismatch');
for(const file of ['dist/mcp.mjs','dist/site-worker.mjs','dist/site-loader.mjs','dist/THIRD_PARTY_LICENSES.txt']) {
  if(!(await stat(join(root,file))).size)throw new Error('Missing runtime artifact: '+file);
}
for(const folder of ['src','tools','dist'])for(const file of await readdir(join(root,folder))) {
  if(file.endsWith('.mjs'))execFileSync(process.execPath,['--check',join(root,folder,file)]);
}
if(process.env.RELEASE_TAG&&process.env.RELEASE_TAG!=='v'+metadata.version)throw new Error('Release tag must equal v'+metadata.version);
console.log('Build/package contracts valid: '+metadata.name+'@'+metadata.version);
