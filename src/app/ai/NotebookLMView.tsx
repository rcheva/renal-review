import { IconRobot } from "@tabler/icons-react";
import React, { useState, useEffect } from "react";
import "./NotebookLMView.css";

interface Notebook {
  id: string;
  name?: string;
  title?: string;
}

export default function NotebookLMView() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:3001/api/notebooks")
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setNotebooks(data.notebooks || []);
      })
      .catch(err => {
        console.error(err);
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

  return (
    <div className="notebooklm-view">
      <div className="notebooklm-header">
        <IconRobot size={32} />
        <h1>NotebookLM Assistant</h1>
      </div>
      
      {error && <div className="notebooklm-error">{error}</div>}
      
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
  );
}
