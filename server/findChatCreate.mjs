import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: "/opt/anaconda3/bin/notebooklm-mcp",
    args: [],
  });

  const mcpClient = new Client(
    { name: "test", version: "1.0.0" },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);
  const tools = await mcpClient.listTools();
  
  const tool = tools.tools.find(t => t.name === 'notebook_list');
  if (tool) {
     console.log("notebook_list Tool:", JSON.stringify(tool, null, 2));
  }
  process.exit(0);
}

main().catch(console.error);
