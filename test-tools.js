import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function run() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "notebooklm-mcp"],
  });

  const mcpClient = new Client(
    { name: "test", version: "1.0.0" },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);
  
  const result = await mcpClient.listTools();
  const tool = result.tools.find(t => t.name === 'ask_question');
  console.log(JSON.stringify(tool, null, 2));
  process.exit(0);
}

run();
