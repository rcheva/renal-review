import { isTauri } from "@/lib/isTauri";
import {
  IconBug,
  IconCheck,
  IconCloudDownload,
  IconCopy,
  IconKey,
  IconMessageCircle,
  IconRobot,
  IconX,
} from "@tabler/icons-react";
import React, { useState, useEffect } from "react";
import "./NotebookLMView.css";

interface Notebook {
  id: string;
  name?: string;
  title?: string;
}

type TabType = "chat" | "materials";

const ONEDRIVE_BASE =
  "/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review";

export default function NotebookLMView() {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Modals state
  const [showConsoleModal, setShowConsoleModal] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [pastedCookies, setPastedCookies] = useState("");
  const [savingCookies, setSavingCookies] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/logs");
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [ERROR] Failed to fetch server logs: ${err.message}`,
      ]);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/notebooks");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNotebooks(data.notebooks || []);
      setIsConnected(true);
      setError("");
    } catch (err: any) {
      console.warn("NotebookLM connection check failed:", err.message);
      setIsConnected(false);
      setError(
        err.message || "Disconnected from NotebookLM backend."
      );
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/notebooks");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (mounted) {
          setNotebooks(data.notebooks || []);
          setIsConnected(true);
        }
      } catch (err) {
        if (!mounted) return;
        try {
          if (isTauri()) {
            const { Command } = await import("@tauri-apps/plugin-shell");
            const cmd = Command.create("start-mcp", [
              "/Users/julio/projects/Renal_Review/skola-main/server/mcpProxy.mjs",
            ]);
            await cmd.spawn();
          }
        } catch (spawnErr) {
          console.error("Auto-start spawn error:", spawnErr);
        }
        setTimeout(async () => {
          if (!mounted) return;
          await checkStatus();
        }, 2000);
      }
    };

    init();
    return () => {
      mounted = false;
    };
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch("http://localhost:3001/api/refresh_auth", {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.success) {
        await checkStatus();
      } else {
        throw new Error(data.error || "Failed to reload tokens");
      }
    } catch (err: any) {
      const errMsg =
        err.name === "AbortError"
          ? "Reconnection timed out. Please try importing cookies manually."
          : err.message;
      setError("Reconnection failed: " + errMsg);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCookies = async () => {
    if (!pastedCookies.trim()) return;
    setSavingCookies(true);
    try {
      const res = await fetch("http://localhost:3001/api/save_cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookieString: pastedCookies }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      alert(`Successfully saved ${data.count} cookies! Connecting...`);
      setShowCookieModal(false);
      setPastedCookies("");
      await checkStatus();
    } catch (err: any) {
      alert("Failed to save cookies: " + err.message);
    } finally {
      setSavingCookies(false);
    }
  };

  const handleCopyLogs = () => {
    const fullLogText = logs.join("\n");
    navigator.clipboard.writeText(fullLogText);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleSaveToOneDrive = async () => {
    if (!response || !selectedNotebook) return;
    const nb = notebooks.find((n) => n.id === selectedNotebook);
    const nbName = nb?.title || nb?.name || "";

    let folderPath = ONEDRIVE_BASE;
    if (nbName.includes("CKD")) folderPath += "/01-CKD";
    else if (nbName.includes("AKI")) folderPath += "/02-AKI";

    const ext = ".md";
    const promptSnippet =
      prompt
        .trim()
        .split(" ")
        .slice(0, 4)
        .join("_")
        .replace(/[^a-z0-9_]/gi, "")
        .toLowerCase() || "flashcards";
    const fileName = `llm_${promptSnippet}_${Date.now()}${ext}`;

    try {
      const res = await fetch("http://localhost:3001/api/save_text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: response, fileName, folderPath }),
      });
      const data = await res.json();

      if (data.success) {
        alert(
          `Saved ${fileName} to OneDrive! You can now sync it in Study Materials.`
        );
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <IconRobot size={32} />
            <h1>NotebookLM Assistant</h1>
            {isConnected !== null && (
              <div
                className={`notebooklm-status ${isConnected ? "connected" : "disconnected"}`}
              >
                <span className="status-dot"></span>
                {isConnected ? "Connected" : "Disconnected"}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={handleReconnect}
              disabled={loading}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: "var(--theme-primary-600, #2563eb)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {loading ? "Reconnecting..." : "Reconnect"}
            </button>

            <button
              onClick={() => setShowCookieModal(true)}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#059669",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <IconKey size={16} />
              Import Cookies
            </button>

            <button
              onClick={() => {
                fetchLogs();
                setShowConsoleModal(true);
              }}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#4b5563",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <IconBug size={16} />
              Console Logs
            </button>
          </div>
        </div>

        <div className="notebooklm-tabs">
          <button
            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <IconMessageCircle size={20} />
            Chat
          </button>
        </div>
      </div>

      {error && (
        <div className="notebooklm-error">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{error}</span>
            <button
              onClick={() => setShowCookieModal(true)}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                background: "#991b1b",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginLeft: "12px",
              }}
            >
              Paste Cookies
            </button>
          </div>
        </div>
      )}

      {activeTab === "chat" && (
        <div className="notebooklm-tab-content">
          <div className="notebooklm-controls">
            <label>
              Select Project:
              <select
                value={selectedNotebook}
                onChange={(e) => setSelectedNotebook(e.target.value)}
              >
                <option value="">-- Choose a numbered Notebook --</option>
                {notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    {nb.title || nb.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="notebooklm-chat">
            <textarea
              placeholder="Ask NotebookLM a question about your project..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              rows={4}
            />
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "8px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setPrompt(
                    `Please provide a comprehensive Evidence-Based Medicine appraisal and detailed clinical synthesis of the attached article. Cover all of the following 10 sections in full detail:

1. Article Identity & Classification: Citation, study type (RCT, COHORT, SR, GL, etc.), confidence level, and core executive message.
2. Rapid Clinical Read: Biochemical definitions, diagnostic criteria, thresholds (e.g. sNa <135, mild 130-134, moderate 120-129, severe <120 mmol/L), ICU prevalence, and mortality.
3. Diagnostic Framework & Physiology: Stepwise osmolality evaluation (<275 hypotonic, 275-290 isotonic, >290 hypertonic), pseudohyponatremia, and volume status phenotypes.
4. Treatment & Monitoring Protocols: Sodium deficit equations, symptom-directed correction goals (4-6 mmol/L in 6h), safety upper limits (8 mmol/L in 24h), and overcorrection relowering protocols.
5. The Correction-Rate & ODS Controversy: Historical ODS thresholds vs recent cohort evidence and risk factors.
6. Consensus, Uncertainty & Practice Implications: Reasonably established practice principles and unresolved controversies.
7. Critical Appraisal & EBM Ratings: SANRA/STROBE alignment, Editorial EBM Ratings Table (1-5 ⭐ stars) with justifications, and GRADE evidence rating.
8. What Cannot Be Concluded From This PDF: Unanswered clinical questions.
9. Future Research Directions: Trial needs and validation models.
10. Clinical Bottom Line: 3-sentence definitive summary for bedside practice.`
                  )
                }
                style={{
                  fontSize: "12px",
                  padding: "6px 12px",
                  background: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #bae6fd",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Prompt 1: Journal Article Review (#JClub)
              </button>

              <button
                type="button"
                onClick={() =>
                  setPrompt(
                    `Master Anki deck prompt — follow immediately:
Analyze the uploaded medical PDF article in this workspace. Generate 20 Anki flashcards based directly on the key clinical findings, methodology, sample size, primary outcomes, bias, and clinical bottom line of THIS uploaded article using the correct card distribution for the detected study type:
- 8 Basic — key results, effect sizes, statistical measures, framework scores
- 5 Cloze — fill in critical values, ratings, thresholds specific to this study
- 4 Clinical Scenario — applying findings at point of care with patient vignettes
- 3 Critical Appraisal — methodology, bias, and limitations specific to this design

The JSON format must be strictly compatible with the app's flashcard importer. Please generate a single, valid JSON array. Do not wrap the JSON in markdown code blocks or write any conversation text. Return ONLY the raw JSON array.

### Required JSON Schema:
[
  {
    "question": "The question/prompt on the front of the card",
    "correct_answer": "The main correct answer/fact on the back of the card",
    "incorrect_answers": [
      "Incorrect option/distractor 1",
      "Incorrect option/distractor 2",
      "Incorrect option/distractor 3"
    ]
  }
]`
                  )
                }
                style={{
                  fontSize: "12px",
                  padding: "6px 12px",
                  background: "#ede9fe",
                  color: "#5b21b6",
                  border: "1px solid #ddd6fe",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Prompt 2: Generate JSON Flashcards
              </button>

              <button
                type="button"
                onClick={() =>
                  setPrompt(
                    `JSON poll prompt — follow immediately:
Analyze the uploaded medical PDF article in this workspace. Generate 5 high-yield multiple-choice quiz questions based directly on the key clinical findings, primary endpoints, and results of THIS uploaded article.

The JSON format must be strictly compatible with the app's importer. Please generate a single, valid JSON array. Do not wrap the JSON in any markdown code blocks, backticks, or write any introductory/concluding text. Return ONLY the raw JSON array.

### Required JSON Schema:
[
  {
    "question_text": "The text of the question",
    "options": [
      "Option A text",
      "Option B text",
      "Option C text",
      "Option D text"
    ],
    "correct_option_index": 0,
    "explanation": "A brief explanation of why the correct answer is right (optional)"
  }
]`
                  )
                }
                style={{
                  fontSize: "12px",
                  padding: "6px 12px",
                  background: "#fae8ff",
                  color: "#86198f",
                  border: "1px solid #f5d0fe",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Prompt 3: Generate JSON Poll
              </button>
            </div>

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
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "1rem",
                }}
              >
                <button
                  onClick={handleSaveToOneDrive}
                  className="notebooklm-button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#10b981",
                  }}
                >
                  <IconCloudDownload size={18} />
                  Save as Flashcards (.md) to OneDrive
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug Console Modal */}
      {showConsoleModal && (
        <div className="modal-overlay" onClick={() => setShowConsoleModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "750px" }}
          >
            <div className="modal-header">
              <h2>
                <IconBug size={22} color="#2563eb" />
                Debug Console & Logs
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowConsoleModal(false)}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  Real-time Proxy & MCP Server Output ({logs.length} lines):
                </span>
                <button
                  onClick={fetchLogs}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    background: "#e5e7eb",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Refresh Logs
                </button>
              </div>

              <div className="log-viewer">
                {logs.length === 0 ? (
                  <span style={{ color: "#94a3b8" }}>No logs recorded yet.</span>
                ) : (
                  logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.includes("[ERROR]")
                          ? "log-line-error"
                          : log.includes("[INFO]")
                          ? "log-line-info"
                          : ""
                      }
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={handleCopyLogs}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: copiedLogs ? "#10b981" : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {copiedLogs ? <IconCheck size={18} /> : <IconCopy size={18} />}
                {copiedLogs ? "Copied!" : "Copy Logs to Clipboard"}
              </button>
              <button
                onClick={() => setShowConsoleModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cookie Import Modal */}
      {showCookieModal && (
        <div className="modal-overlay" onClick={() => setShowCookieModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <IconKey size={22} color="#059669" />
                Import Google NotebookLM Cookies
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowCookieModal(false)}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.5 }}>
                Follow these simple steps in Google Chrome to get your cookies:
              </p>
              <ol
                style={{
                  fontSize: "13px",
                  color: "#4b5563",
                  paddingLeft: "20px",
                  lineHeight: "1.6",
                  marginBottom: "1rem",
                }}
              >
                <li>Open Chrome and go to <strong>https://notebooklm.google.com</strong></li>
                <li>Press <strong>Cmd + Option + I</strong> (or F12) to open DevTools</li>
                <li>Click the <strong>Network</strong> tab and type <code>batchexecute</code> in the filter box</li>
                <li>Click any notebook page to trigger a request</li>
                <li>Click on a <code>batchexecute</code> request, scroll down to <strong>Request Headers</strong></li>
                <li>Right-click the value next to <strong>cookie:</strong> and select <strong>Copy value</strong></li>
                <li>Paste the copied cookie text below!</li>
              </ol>

              <textarea
                placeholder="Paste your copied cookie string here (e.g., __Secure-3PSID=...; SID=...)"
                value={pastedCookies}
                onChange={(e) => setPastedCookies(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                }}
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={handleSaveCookies}
                disabled={savingCookies || !pastedCookies.trim()}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "#059669",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: savingCookies ? "not-allowed" : "pointer",
                }}
              >
                {savingCookies ? "Saving..." : "Save Cookies & Connect"}
              </button>
              <button
                onClick={() => setShowCookieModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
