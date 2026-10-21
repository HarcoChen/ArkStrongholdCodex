import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {INSTRUCTIONS} from '@arkstrongholdrl/ark-play-core';
import {createCodexRuntime} from './runtime.mjs';
import metadata from '../package.json' with {type:'json'};
import {fileURLToPath} from 'node:url';

const runtime=createCodexRuntime();
const setup=fileURLToPath(new URL('../configure.mjs',import.meta.url));
const instructions=INSTRUCTIONS+' Codex defaults to https://ark.minyako.top. An omitted roomCode uses saved client settings; an empty roomCode starts solo play. Saved settings are reread at a safe new-game boundary. To change defaults on user request, run node '+JSON.stringify(setup)+' --update --room-code AB12 (or --url https://site-host). Preserve existing credentials and do not start a game merely to configure settings.';
const server=new McpServer({name:'ark-play',version:metadata.version},{instructions});
for(const tool of runtime.tools) {
  server.registerTool(tool.name,{description:tool.description,inputSchema:tool.schema,
    annotations:{readOnlyHint:!!tool.readOnly,destructiveHint:!!tool.destructive,openWorldHint:true}},
  async(args,extra)=>{
    try {const value=await tool.execute(tool.schema.parse(args),extra.signal);return {content:[{type:'text',text:value.text}]};}
    catch(error){return {isError:true,content:[{type:'text',text:String(error.message)}]};}
  });
}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>runtime.close().then(()=>process.exit(0)));
process.stdin.once('end',()=>runtime.close());
await server.connect(new StdioServerTransport());
