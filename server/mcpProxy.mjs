import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

let mcpClient = null;
let isConnected = false;

async function connectMCP() {
  console.log("Connecting to NotebookLM MCP server...");
  const transport = new StdioClientTransport({
    command: "/opt/anaconda3/bin/notebooklm-mcp",
    args: [],
  });

  mcpClient = new Client(
    { name: "dashboard-proxy", version: "1.0.0" },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);
  isConnected = true;
  console.log("Connected to NotebookLM MCP server.");
}

app.get('/api/status', (req, res) => {
  res.json({ connected: isConnected });
});

app.get('/api/notebooks', async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: "MCP not connected" });
  try {
    const result = await mcpClient.callTool({
      name: "notebook_list",
      arguments: { max_results: 100 }
    });
    
    let content = result.content[0].text;
    const data = JSON.parse(content);
    
    if (data.error) {
      return res.status(500).json({ error: data.error });
    }
    
    // Filter notebooks that start with a number (e.g. "01_CKD")
    const filtered = data.notebooks.filter(n => /^\d/.test(n.name || n.title));
    res.json({ notebooks: filtered });
  } catch (error) {
    console.error("Error fetching notebooks:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/query', async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: "MCP not connected" });
  const { notebook_id, query } = req.body;
  
  if (!notebook_id || !query) {
    return res.status(400).json({ error: "notebook_id and query are required" });
  }

  try {
    const result = await mcpClient.callTool({
      name: "notebook_query",
      arguments: { notebook_id, query }
    });
    
    let content = result.content[0].text;
    const data = JSON.parse(content);
    
    if (data.error) {
      return res.status(500).json({ error: data.error });
    }
    
    res.json({ answer: data.answer });
  } catch (error) {
    console.error("Error querying notebook:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`MCP Proxy running on http://localhost:${PORT}`);
  await connectMCP().catch(console.error);
});
