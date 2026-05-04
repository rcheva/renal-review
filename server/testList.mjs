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
  const result = await mcpClient.callTool({
      name: "notebook_list",
      arguments: { max_results: 100 }
  });
  console.log("Raw Result Content:", result.content[0].text);
  
  process.exit(0);
}

main().catch(console.error);
