import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { exec, spawn } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import cors from "cors";
import express from "express";

const app = express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const PORT = 3001;

let mcpClient = null;
let isConnected = false;
const logBuffer = [];

function addLog(level, msg) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
  const formatted = `[${timestamp}] [${level.toUpperCase()}] ${msg}`;
  console.log(formatted);
  logBuffer.push(formatted);
  if (logBuffer.length > 300) logBuffer.shift();
}

async function connectMCP() {
  addLog("info", "Connecting to NotebookLM MCP server...");
  try {
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
    addLog("info", "Connected to NotebookLM MCP server successfully.");
  } catch (err) {
    addLog("error", `Failed to connect to MCP server: ${err.message}`);
    isConnected = false;
  }
}

app.get("/api/status", (req, res) => {
  res.json({ connected: isConnected });
});

app.get("/api/logs", (req, res) => {
  res.json({ logs: logBuffer });
});

app.post("/api/refresh_auth", async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: "MCP not connected" });
  addLog("info", "Reloading auth tokens from disk cache...");
  try {
    const result = await mcpClient.callTool({
      name: "refresh_auth",
      arguments: {},
    });
    const text = result.content?.[0]?.text || "";
    addLog("info", `Auth refresh result: ${text}`);
    res.json({ success: true, result: text });
  } catch (err) {
    addLog("error", `Auth refresh error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/save_cookies", async (req, res) => {
  let { cookieString } = req.body;
  if (!cookieString || typeof cookieString !== "string") {
    return res.status(400).json({ error: "cookieString is required" });
  }

  try {
    addLog("info", "Parsing provided cookie string or header payload...");

    // Auto-extract cookie string if full cURL command or headers block was pasted
    if (cookieString.includes("cookie:") || cookieString.includes("Cookie:")) {
      const match = cookieString.match(/cookie:\s*([^\r\n]+)/i);
      if (match) cookieString = match[1];
    } else if (cookieString.includes("-H 'cookie:") || cookieString.includes("-H \"cookie:") || cookieString.includes("-h 'cookie:")) {
      const match = cookieString.match(/-h\s+['"]cookie:\s*([^'"]+)['"]/i) || cookieString.match(/cookie:\s*([^'"]+)/i);
      if (match) cookieString = match[1];
    }

    const cookies = {};
    cookieString.split(";").forEach((pair) => {
      const parts = pair.trim().split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join("=").trim();
        if (key && val) cookies[key] = val;
      }
    });

    const keyCount = Object.keys(cookies).length;
    if (keyCount === 0) {
      throw new Error("No valid key-value pairs found in cookie string.");
    }

    const authDir = path.join(os.homedir(), ".notebooklm-mcp");
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const authPath = path.join(authDir, "auth.json");
    const payload = {
      cookies,
      csrf_token: "",
      session_id: "",
      extracted_at: Date.now() / 1000,
    };

    fs.writeFileSync(authPath, JSON.stringify(payload, null, 2), "utf8");
    addLog("info", `Saved ${keyCount} cookies to ${authPath}`);

    if (isConnected && mcpClient) {
      const refreshResult = await mcpClient.callTool({
        name: "refresh_auth",
        arguments: {},
      });
      addLog("info", `MCP reloaded tokens: ${refreshResult.content?.[0]?.text}`);
    }

    res.json({ success: true, count: keyCount });
  } catch (err) {
    addLog("error", `Failed to save cookies: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/notebooks", async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: "MCP not connected" });
  addLog("info", "Fetching notebook list...");
  try {
    const result = await mcpClient.callTool({
      name: "notebook_list",
      arguments: { max_results: 100 },
    });

    const content = result.content[0].text;
    const data = JSON.parse(content);

    if (data.error) {
      addLog("error", `notebook_list returned error: ${data.error}`);
      return res.status(500).json({ error: data.error });
    }

    const notebooksArray = Array.isArray(data) ? data : data.notebooks || [];
    const filtered = notebooksArray.filter((n) =>
      /^\d/.test(n.name || n.title)
    );
    addLog("info", `Retrieved ${filtered.length} numbered notebooks.`);
    res.json({ notebooks: filtered });
  } catch (error) {
    addLog("error", `Error fetching notebooks: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/query", async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: "MCP not connected" });
  const { notebook_id, query } = req.body;

  if (!notebook_id || !query) {
    return res
      .status(400)
      .json({ error: "notebook_id and query are required" });
  }

  addLog("info", `Querying notebook ${notebook_id}: "${query.slice(0, 30)}..."`);
  try {
    const result = await mcpClient.callTool({
      name: "notebook_query",
      arguments: { notebook_id, query },
    });

    const content = result.content[0].text;
    const data = JSON.parse(content);

    if (data.error) {
      addLog("error", `notebook_query error: ${data.error}`);
      return res.status(500).json({ error: data.error });
    }

    addLog("info", "Query response received successfully.");
    res.json({ answer: data.answer });
  } catch (error) {
    addLog("error", `Error querying notebook: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/studio_status/:notebook_id", async (req, res) => {
  if (!isConnected) return res.status(503).json({ error: "MCP not connected" });
  const { notebook_id } = req.params;
  try {
    const result = await mcpClient.callTool({
      name: "studio_status",
      arguments: { notebook_id },
    });
    const content = result.content[0].text;
    res.json(JSON.parse(content));
  } catch (error) {
    addLog("error", `Error fetching studio status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/download", async (req, res) => {
  const { url, fileName, folderPath } = req.body;
  if (!url || !fileName || !folderPath) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const authPath = path.join(os.homedir(), ".notebooklm-mcp", "auth.json");
    const authFile = fs.readFileSync(authPath, "utf8");
    const auth = JSON.parse(authFile);
    const cookieString = Object.entries(auth.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const dest = path.join(folderPath, fileName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const response = await fetch(url, {
      headers: {
        Cookie: cookieString,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download: ${response.status} ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));

    addLog("info", `Downloaded file to ${dest}`);
    res.json({ success: true, path: dest });
  } catch (error) {
    addLog("error", `Error initiating download: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/save_text", async (req, res) => {
  const { content, fileName, folderPath } = req.body;
  if (!content || !fileName || !folderPath) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const dest = path.join(folderPath, fileName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    fs.writeFileSync(dest, content, "utf8");
    addLog("info", `Saved flashcard text file to ${dest}`);
    res.json({ success: true, path: dest });
  } catch (error) {
    addLog("error", `Error saving text file: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// AnythingLLM Integration Endpoints
app.post("/api/anything/workspaces", async (req, res) => {
  let {
    baseUrl = "http://127.0.0.1:59484/api/v1",
    apiKey = "ANYTHINGLLM-RENAL-REVIEW-KEY-12345",
  } = req.body;
  if (!baseUrl || baseUrl.includes("3001")) {
    baseUrl = "http://127.0.0.1:59484/api/v1";
  }
  addLog("info", `Fetching AnythingLLM workspaces from ${baseUrl}...`);
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const url = `${baseUrl.replace(/\/$/, "")}/workspaces`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const workspaces = data.workspaces || data || [];
    addLog("info", `Retrieved ${workspaces.length} AnythingLLM workspaces.`);
    res.json({ workspaces });
  } catch (error) {
    addLog("error", `Error fetching AnythingLLM workspaces: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/anything/workspace_docs", async (req, res) => {
  let {
    baseUrl = "http://127.0.0.1:59484/api/v1",
    apiKey = "ANYTHINGLLM-RENAL-REVIEW-KEY-12345",
    slug,
  } = req.body;
  if (!baseUrl || baseUrl.includes("3001")) {
    baseUrl = "http://127.0.0.1:59484/api/v1";
  }
  if (!slug) {
    return res.status(400).json({ error: "slug is required" });
  }

  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const url = `${baseUrl.replace(/\/$/, "")}/workspace/${slug}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const ws = Array.isArray(data.workspace) ? data.workspace[0] : data.workspace || {};
    const docs = ws.documents || [];
    res.json({ documents: docs });
  } catch (error) {
    addLog("error", `Error fetching workspace docs: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/anything/chat", async (req, res) => {
  let {
    baseUrl = "http://127.0.0.1:59484/api/v1",
    apiKey = "ANYTHINGLLM-RENAL-REVIEW-KEY-12345",
    slug,
    message,
    mode = "query",
    sessionId,
  } = req.body;
  if (!baseUrl || baseUrl.includes("3001")) {
    baseUrl = "http://127.0.0.1:59484/api/v1";
  }
  if (!slug || !message) {
    return res.status(400).json({ error: "slug and message are required" });
  }

  const payload = { message, mode };
  if (sessionId) payload.sessionId = sessionId;

  addLog(
    "info",
    `Sending AnythingLLM query [mode:${mode}, session:${sessionId || "default"}] to workspace [${slug}]: "${message.slice(0, 30)}..."`
  );
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    // Fetch workspace metadata to extract provider and model
    let provider = "AnythingLLM (System Default)";
    let model = "Default Model";
    try {
      const wsUrl = `${baseUrl.replace(/\/$/, "")}/workspace/${slug}`;
      const wsRes = await fetch(wsUrl, { headers });
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        const ws = wsData.workspace?.[0];
        if (ws) {
          if (ws.chatProvider) provider = ws.chatProvider;
          if (ws.chatModel) model = ws.chatModel;
        }
      }
    } catch (e) {
      // Ignore meta fetch failure
    }

    // Ensure workspace system prompt is set to read workspace document context
    try {
      const updateUrl = `${baseUrl.replace(/\/$/, "")}/workspace/${slug}/update`;
      await fetch(updateUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          openAiPrompt:
            "You are an expert Evidence-Based Medicine research assistant. You are provided with the full text and document context of this workspace below. Analyze and synthesize the document context directly to answer the user instructions in complete detail. Never claim you cannot access or view the document context.",
        }),
      });
    } catch (e) {
      // Ignore prompt sync error
    }

    const url = `${baseUrl.replace(/\/$/, "")}/workspace/${slug}/chat`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const answer =
      data.textResponse || data.text || data.response || JSON.stringify(data);
    addLog("info", "AnythingLLM response received successfully.");
    res.json({ answer, sources: data.sources || [], provider, model });
  } catch (error) {
    addLog("error", `Error querying AnythingLLM: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/anything/upload", async (req, res) => {
  let {
    baseUrl = "http://127.0.0.1:59484/api/v1",
    apiKey = "ANYTHINGLLM-RENAL-REVIEW-KEY-12345",
    slug,
    fileName,
    fileBase64,
  } = req.body;

  if (!baseUrl || baseUrl.includes("3001")) {
    baseUrl = "http://127.0.0.1:59484/api/v1";
  }

  if (!fileName || !fileBase64 || !slug) {
    return res
      .status(400)
      .json({ error: "fileName, fileBase64, and slug are required" });
  }

  addLog(
    "info",
    `Uploading document "${fileName}" to AnythingLLM workspace [${slug}]...`
  );
  try {
    const buffer = Buffer.from(fileBase64, "base64");
    const formData = new FormData();
    const blob = new Blob([buffer]);
    formData.append("file", blob, fileName);

    const headers = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const uploadUrl = `${baseUrl.replace(/\/$/, "")}/document/upload`;
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error(
        `Upload HTTP ${uploadRes.status}: ${uploadRes.statusText}`
      );
    }

    const uploadData = await uploadRes.json();
    const docs = uploadData.documents || [];
    if (docs.length === 0) {
      throw new Error(
        "No document location returned from AnythingLLM upload."
      );
    }

    const location = docs[0].location;
    addLog(
      "info",
      `Uploaded document location: ${location}. Deduplicating and embedding into workspace...`
    );

    // Deduplicate: check workspace for existing documents with same filename
    try {
      const wsUrl = `${baseUrl.replace(/\/$/, "")}/workspace/${slug}`;
      const wsRes = await fetch(wsUrl, { headers });
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        const ws = Array.isArray(wsData.workspace)
          ? wsData.workspace[0]
          : wsData.workspace || {};
        const existingDocs = ws.documents || [];

        const baseCleanName = fileName.replace(/\.pdf$/i, "").toLowerCase();
        const deletes = existingDocs
          .filter((d) => {
            const title = (
              d.filename ||
              d.title ||
              d.docpath?.split("/").pop() ||
              ""
            ).toLowerCase();
            return title.includes(baseCleanName) || baseCleanName.includes(title);
          })
          .map((d) => d.docpath || d.filename)
          .filter(Boolean);

        if (deletes.length > 0) {
          addLog(
            "info",
            `Removing ${deletes.length} previous copy of "${fileName}" before embedding new version...`
          );
          const embedUrl = `${baseUrl.replace(/\/$/, "")}/workspace/${slug}/update-embeddings`;
          await fetch(embedUrl, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ deletes }),
          });
        }
      }
    } catch (dedupErr) {
      addLog("info", `Deduplication check skipped: ${dedupErr.message}`);
    }

    const embedUrl = `${baseUrl.replace(/\/$/, "")}/workspace/${slug}/update-embeddings`;
    const embedRes = await fetch(embedUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ adds: [location] }),
    });

    if (!embedRes.ok) {
      throw new Error(
        `Embed HTTP ${embedRes.status}: ${embedRes.statusText}`
      );
    }

    addLog(
      "info",
      `Successfully embedded "${fileName}" into workspace [${slug}].`
    );
    res.json({ success: true, fileName, location });
  } catch (error) {
    addLog(
      "error",
      `Error uploading document to AnythingLLM: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/anything/delete_doc", async (req, res) => {
  let {
    baseUrl = "http://127.0.0.1:59484/api/v1",
    apiKey = "ANYTHINGLLM-RENAL-REVIEW-KEY-12345",
    slug,
    docPath,
  } = req.body;

  if (!baseUrl || baseUrl.includes("3001")) {
    baseUrl = "http://127.0.0.1:59484/api/v1";
  }

  if (!slug || !docPath) {
    return res.status(400).json({ error: "slug and docPath are required" });
  }

  addLog(
    "info",
    `Removing document "${docPath}" from workspace [${slug}]...`
  );
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const url = `${baseUrl.replace(/\/$/, "")}/workspace/${slug}/update-embeddings`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ deletes: [docPath] }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    addLog("info", `Document removed successfully from [${slug}].`);
    res.json({ success: true });
  } catch (error) {
    addLog(
      "error",
      `Error deleting document from AnythingLLM: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  addLog("info", `MCP Proxy running on http://localhost:${PORT}`);
  await connectMCP().catch((err) => addLog("error", err.message));
});
