import { IconRobot, IconBook, IconMessageCircle, IconHeadphones, IconPresentation, IconFileWord, IconFileDescription, IconCloudDownload } from "@tabler/icons-react";
import React, { useState, useEffect } from "react";
import { open } from '@tauri-apps/plugin-shell';
import "./NotebookLMView.css";

import { 
  ckdStudyGuideUrl, ckdBriefingDocUrl, ckdAudioOverviewUrl, ckdSlideDeckUrl,
  akiStudyGuideUrl, akiBriefingDocUrl, akiAudioOverviewUrl, akiSlideDeckUrl 
} from "../../logic/notebookLMData";

interface Notebook {
  id: string;
  name?: string;
  title?: string;
}

type TabType = "chat" | "materials";
type TopicType = "CKD" | "AKI";

export default function NotebookLMView() {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [selectedTopic, setSelectedTopic] = useState<TopicType>("CKD");
  
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("http://localhost:3001/api/notebooks")
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setNotebooks(data.notebooks || []);
        setIsConnected(true);
      })
      .catch(err => {
        console.error(err);
        setIsConnected(false);
        setError("Failed to connect to local MCP proxy. Make sure it is running.");
      });
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

  const handleOpenMedia = async (path: string) => {
    try {
      await open(path);
    } catch (err) {
      console.error("Failed to open file:", err);
      setError("Failed to open file. Make sure it has been synced to your OneDrive folder.");
    }
  };

  const handleSyncLLM = () => {
    // Placeholder for future sync implementation
    alert("Checking Notebook LM folder... No new items found to download.");
  };

  const materials = selectedTopic === "CKD" ? [
    { title: "Audio Overview", path: ckdAudioOverviewUrl, icon: <IconHeadphones size={32} />, color: "var(--primary)" },
    { title: "Study Guide", path: ckdStudyGuideUrl, icon: <IconFileWord size={32} />, color: "#2b579a" },
    { title: "Briefing Document", path: ckdBriefingDocUrl, icon: <IconFileDescription size={32} />, color: "#2b579a" },
    { title: "Slide Deck", path: ckdSlideDeckUrl, icon: <IconPresentation size={32} />, color: "#b7472a" },
  ] : [
    { title: "Audio Overview", path: akiAudioOverviewUrl, icon: <IconHeadphones size={32} />, color: "var(--primary)" },
    { title: "Study Guide", path: akiStudyGuideUrl, icon: <IconFileWord size={32} />, color: "#2b579a" },
    { title: "Briefing Document", path: akiBriefingDocUrl, icon: <IconFileDescription size={32} />, color: "#2b579a" },
    { title: "Slide Deck", path: akiSlideDeckUrl, icon: <IconPresentation size={32} />, color: "#b7472a" },
  ];

  return (
    <div className="notebooklm-view">
      <div className="notebooklm-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <IconRobot size={32} />
          <h1>NotebookLM Assistant</h1>
          {isConnected !== null && (
            <div className={`notebooklm-status ${isConnected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              {isConnected ? 'Connected' : 'Disconnected'}
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
          <button 
            className={`tab-btn ${activeTab === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveTab('materials')}
          >
            <IconBook size={20} />
            Study Materials
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
            </div>
          )}
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="notebooklm-materials-launcher">
          <div className="materials-launcher-header">
            <div className="topic-selector">
              <button 
                className={`topic-btn ${selectedTopic === 'CKD' ? 'active' : ''}`}
                onClick={() => setSelectedTopic('CKD')}
              >
                Chronic Kidney Disease (CKD)
              </button>
              <button 
                className={`topic-btn ${selectedTopic === 'AKI' ? 'active' : ''}`}
                onClick={() => setSelectedTopic('AKI')}
              >
                Acute Kidney Injury (AKI)
              </button>
            </div>
            <button className="sync-btn" onClick={handleSyncLLM}>
              <IconCloudDownload size={18} />
              Sync from LLM
            </button>
          </div>

          <div className="materials-grid">
            {materials.map((mat, i) => (
              <div key={i} className="material-card" onClick={() => handleOpenMedia(mat.path)}>
                <div className="material-icon" style={{ color: mat.color }}>
                  {mat.icon}
                </div>
                <div className="material-info">
                  <h3>{mat.title}</h3>
                  <p>Open locally from OneDrive</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
