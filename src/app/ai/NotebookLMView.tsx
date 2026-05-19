import { IconRobot, IconMessageCircle, IconCloudDownload } from "@tabler/icons-react";
import React, { useState, useEffect } from "react";
import { isTauri } from "@/lib/isTauri";
import "./NotebookLMView.css";

interface Notebook {
  id: string;
  name?: string;
  title?: string;
}

type TabType = "chat" | "materials";

const ONEDRIVE_BASE = "/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review";

export default function NotebookLMView() {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/notebooks");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (mounted) {
          setNotebooks(data.notebooks || []);
          setIsConnected(true);
        }
      } catch (err) {
        console.warn("MCP Proxy disconnected. Attempting to auto-start...", err);
        try {
          if (!isTauri()) {
            throw new Error("Cannot auto-start local proxy from web browser. Please run 'node server/mcpProxy.mjs' locally if using localhost proxy.");
          }
          const { Command } = await import("@tauri-apps/plugin-shell");
          const cmd = Command.create('start-mcp', ['/Users/julio/projects/Renal_Review/skola-main/server/mcpProxy.mjs']);
          await cmd.spawn();
          
          // Wait 3 seconds for it to boot up, then check again
          setTimeout(async () => {
            if (!mounted) return;
            try {
              const res2 = await fetch("http://localhost:3001/api/notebooks");
              const data2 = await res2.json();
              if (data2.error) throw new Error(data2.error);
              setNotebooks(data2.notebooks || []);
              setIsConnected(true);
              setError("");
            } catch (err2) {
              console.error(err2);
              setIsConnected(false);
              setError("Failed to auto-start local MCP proxy.");
            }
          }, 3000);
        } catch (spawnErr) {
          console.error("Failed to spawn start-mcp command:", spawnErr);
          if (mounted) {
            setIsConnected(false);
            setError("Failed to connect to local MCP proxy and could not auto-start it.");
          }
        }
      }
    };

    checkStatus();
    return () => { mounted = false; };
  }, []);

  const handleQuery = async () => {
    if (!selectedNotebook || !prompt.trim()) return;
    setLoading(true);
    setError("");
    setResponse("");

    try {
      const res = await fetch("http://localhost:3001/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebook_id: selectedNotebook, query: prompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResponse(data.answer);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3001/api/refresh_auth", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setIsConnected(true);
        const res2 = await fetch("http://localhost:3001/api/notebooks");
        const data2 = await res2.json();
        if (data2.error) {
          throw new Error(data2.error);
        } else {
          setNotebooks(data2.notebooks || []);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setError("Failed to reconnect: " + err.message);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToOneDrive = async () => {
    if (!response || !selectedNotebook) return;
    const nb = notebooks.find(n => n.id === selectedNotebook);
    const nbName = nb?.title || nb?.name || "";
    
    let folderPath = ONEDRIVE_BASE;
    if (nbName.includes("CKD")) folderPath += "/01-CKD";
    else if (nbName.includes("AKI")) folderPath += "/02-AKI";
    
    const ext = ".md";
    // Creating a readable file name based on the first few words of the prompt
    const promptSnippet = prompt.trim().split(" ").slice(0, 4).join("_").replace(/[^a-z0-9_]/gi, '').toLowerCase() || "flashcards";
    const fileName = `llm_${promptSnippet}_${Date.now()}${ext}`;

    try {
      const res = await fetch("http://localhost:3001/api/save_text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: response, fileName, folderPath })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`Saved ${fileName} to OneDrive! You can now sync it in Study Materials or Batch Import.`);
      } else {
        alert("Failed to save: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
    }
  };


  return (
    <div className="notebooklm-view">
      <div className="notebooklm-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <IconRobot size={32} />
          <h1>NotebookLM Assistant</h1>
          {isConnected !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className={`notebooklm-status ${isConnected ? 'connected' : 'disconnected'}`}>
                <span className="status-dot"></span>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <button 
                onClick={handleReconnect}
                disabled={loading}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  background: "var(--theme-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                {loading ? "Reconnecting..." : "Reconnect"}
              </button>
            </div>
          )}
        </div>
        
        <div className="notebooklm-tabs">
          <button 
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <IconMessageCircle size={20} />
            Chat
          </button>
        </div>
      </div>
      
      {error && <div className="notebooklm-error">{error}</div>}
      
      {activeTab === 'chat' && (
        <div className="notebooklm-tab-content">
          <div className="notebooklm-controls">
            <label>
              Select Project:
              <select 
                value={selectedNotebook} 
                onChange={e => setSelectedNotebook(e.target.value)}
              >
                <option value="">-- Choose a numbered Notebook --</option>
                {notebooks.map(nb => (
                  <option key={nb.id} value={nb.id}>{nb.title || nb.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="notebooklm-chat">
            <textarea
              placeholder="Ask NotebookLM a question about your project..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={loading}
              rows={4}
            />
            <button 
              onClick={handleQuery} 
              disabled={loading || !selectedNotebook || !prompt.trim()}
              className="notebooklm-button"
            >
              {loading ? "Querying NotebookLM..." : "Ask"}
            </button>
          </div>

          {response && (
            <div className="notebooklm-response">
              <h3>Response</h3>
              <p>{response}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  onClick={handleSaveToOneDrive}
                  className="notebooklm-button"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#10b981' }}
                >
                  <IconCloudDownload size={18} />
                  Save as Flashcards (.md) to OneDrive
                </button>
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
