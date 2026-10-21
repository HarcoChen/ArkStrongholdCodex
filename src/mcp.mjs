import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createTools,INSTRUCTIONS} from './tools.mjs';

const runtime=createTools();
const server=new McpServer({name:'ark-play',version:'0.2.0-alpha.1'},{instructions:INSTRUCTIONS});
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
