const { spawn } = require('child_process');

const mcp = spawn('npx', ['-y', 'notebooklm-mcp']);

mcp.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  for (const line of lines) {
    console.log('RECV:', line);
    try {
      const parsed = JSON.parse(line);
      if (parsed.id === 1) {
         mcp.stdin.write(JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/initialized"
         }) + '\n');
         
         mcp.stdin.write(JSON.stringify({
           jsonrpc: "2.0",
           id: 2,
           method: "tools/call",
           params: {
             name: "mcp_notebooklm_notebook_list",
             arguments: {}
           }
         }) + '\n');
      }
    } catch(e) {}
  }
});

mcp.stderr.on('data', (data) => {
  console.error('ERR:', data.toString());
});

// Send initialization
const initMsg = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  }
};

mcp.stdin.write(JSON.stringify(initMsg) + '\n');
