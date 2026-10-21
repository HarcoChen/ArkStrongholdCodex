// Build/package contract audit, not a gameplay test harness. No sockets or models.
import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const portable=JSON.parse(await readFile(join(root,'plugin.json'),'utf8'));
const compatibility=JSON.parse(await readFile(join(root,'.codex-plugin/plugin.json'),'utf8'));
for(const path of ['plugin.json','.codex-plugin/plugin.json']) {
  const value=JSON.parse(await readFile(join(root,path),'utf8'));
  if(value.version!==metadata.version||value.name!=='ark-play')throw new Error('Plugin identity/version mismatch: '+path);
}
if(portable.$schema!=='https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')throw new Error('Portable manifest schema mismatch');
if(!portable.extensions?.['com.openai']?.requires_local_executor||!compatibility.requires_local_executor)throw new Error('Local execution requirement missing');
if(compatibility.mcpServers!=='./mcp.json')throw new Error('Compatibility MCP path mismatch');
const display=portable.extensions['com.openai'].interface;
if(JSON.stringify(display)!==JSON.stringify(compatibility.interface))throw new Error('Portable OpenAI metadata overrides compatibility metadata; keep them aligned');
for(const field of ['displayName','shortDescription','longDescription','developerName','category','websiteURL','supportURL']) {
  if(typeof display?.[field]!=='string'||!display[field].trim())throw new Error('Missing plugin display field: '+field);
}
const marketplace=JSON.parse(await readFile(join(root,'.agents/plugins/marketplace.json'),'utf8'));
if(marketplace.name!=='ark-stronghold'||!marketplace.interface?.displayName||marketplace.plugins?.length!==1)throw new Error('Marketplace identity/entries mismatch');
const entry=marketplace.plugins[0];
if(entry.name!==portable.name||entry.source?.source!=='local'||entry.source.path!=='./'||resolve(root,entry.source.path)!==resolve(root))throw new Error('Marketplace must resolve the root plugin');
if(entry.policy?.installation!=='AVAILABLE'||entry.policy.authentication!=='ON_INSTALL'||entry.category!==display.category)throw new Error('Marketplace policy/category mismatch');
const mcp=JSON.parse(await readFile(join(root,'mcp.json'),'utf8'));
if(mcp.mcpServers?.ark?.type!=='stdio'||mcp.mcpServers.ark.command!=='node'||mcp.mcpServers.ark.args?.[0]!=='${PLUGIN_ROOT}/dist/mcp.mjs'||mcp.mcpServers.ark.cwd!=='${PLUGIN_ROOT}')throw new Error('MCP entry mismatch');
for(const file of ['dist/mcp.mjs','dist/site-worker.mjs','dist/site-loader.mjs','dist/THIRD_PARTY_LICENSES.txt']) {
  if(!(await stat(join(root,file))).size)throw new Error('Missing runtime artifact: '+file);
}
for(const folder of ['src','tools','dist'])for(const file of await readdir(join(root,folder))) {
  if(file.endsWith('.mjs'))execFileSync(process.execPath,['--check',join(root,folder,file)]);
}
if(process.env.RELEASE_TAG&&process.env.RELEASE_TAG!=='v'+metadata.version)throw new Error('Release tag must equal v'+metadata.version);
console.log('Build/package contracts valid: '+metadata.name+'@'+metadata.version);
