import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import https from 'https';
import path from 'path';
import os from 'os';

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

import { exec } from 'child_process';

app.post('/api/refresh_auth', async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: "MCP not connected" });
  try {
    console.log("Running notebooklm-mcp-auth...");
    exec('/opt/anaconda3/bin/notebooklm-mcp-auth', async (error, stdout, stderr) => {
      if (error) {
        console.error("Auth script error:", stderr || error.message);
        return res.status(500).json({ error: stderr || error.message });
      }
      try {
        const result = await mcpClient.callTool({
          name: "refresh_auth",
          arguments: {}
        });
        res.json({ success: true, result: result.content[0].text });
      } catch (innerErr) {
        res.status(500).json({ error: innerErr.message });
      }
    });
  } catch (error) {
    console.error("Error refreshing auth:", error);
    res.status(500).json({ error: error.message });
  }
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
    console.log("Notebooks data:", data);
    
    if (data.error) {
      return res.status(500).json({ error: data.error });
    }
    
    // Filter notebooks that start with a number (e.g. "01_CKD")
    const notebooksArray = Array.isArray(data) ? data : (data.notebooks || []);
    const filtered = notebooksArray.filter(n => /^\d/.test(n.name || n.title));
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

app.get('/api/studio_status/:notebook_id', async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: "MCP not connected" });
  const { notebook_id } = req.params;
  try {
    const result = await mcpClient.callTool({
      name: "studio_status",
      arguments: { notebook_id }
    });
    let content = result.content[0].text;
    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Error fetching studio status:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/download', async (req, res) => {
  const { url, fileName, folderPath } = req.body;
  if (!url || !fileName || !folderPath) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const authPath = path.join(os.homedir(), '.notebooklm-mcp', 'auth.json');
    const authFile = fs.readFileSync(authPath, 'utf8');
    const auth = JSON.parse(authFile);
    const cookieString = Object.entries(auth.cookies).map(([k, v]) => `${k}=${v}`).join('; ');

    const dest = path.join(folderPath, fileName);
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const response = await fetch(url, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));
    
    res.json({ success: true, path: dest });
  } catch (error) {
    console.error("Error initiating download:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save_text', async (req, res) => {
  const { content, fileName, folderPath } = req.body;
  if (!content || !fileName || !folderPath) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const dest = path.join(folderPath, fileName);
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    fs.writeFileSync(dest, content, 'utf8');
    res.json({ success: true, path: dest });
  } catch (error) {
    console.error("Error saving text:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`MCP Proxy running on http://localhost:${PORT}`);
  await connectMCP().catch(console.error);
});
