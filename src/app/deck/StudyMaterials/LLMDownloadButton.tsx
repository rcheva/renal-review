import { Button, Modal, Stack, Text } from "@/components/ui";
import { db } from "@/logic/db";
import { Deck, StudyMaterial } from "@/logic/deck/deck";
import { IconCloudDownload, IconFile, IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useNotifications } from "@/components/Notification";
import { isTauri } from "@/lib/isTauri";
import { newDeck } from "@/logic/deck/newDeck";
import { BasicNoteTypeAdapter } from "@/logic/type-implementations/normal/BasicNote";
import { supabase } from "@/logic/supabase";

interface LLMDownloadButtonProps {
  deck: Deck;
}

const ONEDRIVE_BASE = "/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review";

const getDeckFolderPath = (deckName: string) => {
  if (deckName.includes("CKD")) return `${ONEDRIVE_BASE}/01-CKD`;
  if (deckName.includes("AKI")) return `${ONEDRIVE_BASE}/02-AKI`;
  return null;
};

export default function LLMDownloadButton({ deck }: LLMDownloadButtonProps) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [pasteModalOpened, setPasteModalOpened] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<any>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const { showNotification } = useNotifications();

  // Flashcard Import State
  const [importModalOpened, setImportModalOpened] = useState(false);
  const [selectedFileToImport, setSelectedFileToImport] = useState<string | null>(null);
  const [parsedFlashcards, setParsedFlashcards] = useState<{front: string, back: string}[]>([]);
  const [subdeckName, setSubdeckName] = useState("");

  const handleOpenPasteModal = async (artifact: any) => {
    setActiveArtifact(artifact);
    setPasteContent("");
    setPasteModalOpened(true);
  };

  const handleSavePastedContent = async () => {
    if (!activeArtifact || !pasteContent || !folderPath) return;
    
    const ext = ".md";
    const fileName = `${activeArtifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${ext}`;

    try {
      // Use Tauri's fs API or your backend to save it
      const res = await fetch("http://localhost:3001/api/save_text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: pasteContent, fileName, folderPath })
      });
      const data = await res.json();
      
      if (data.success) {
        showNotification({ title: "Success", message: `Saved ${fileName} to OneDrive!`, type: "success" });
        setFiles(prev => [...prev, fileName]);
        setPasteModalOpened(false);
      } else {
        throw new Error(data.error || "Save failed");
      }
    } catch (err: any) {
      showNotification({ title: "Error", message: err.message, type: "error" });
    }
  };

  const loadFilesInFolder = async (path: string) => {
    try {
      if (!isTauri()) return;
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(path);
      const fileNames = entries.filter(e => e.isFile && e.name).map(e => e.name as string);
      setFiles(fileNames.filter(name => !name.startsWith(".")));
    } catch (err: any) {
      console.error("Error reading directory", err);
      setFiles([]);
    }
  };

  const handleSelectFolder = async () => {
    try {
      if (!isTauri()) {
        showNotification({ title: "Desktop Only", message: "Folder syncing is only available in the Mac Desktop app.", type: "info" });
        return;
      }
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: folderPath || ONEDRIVE_BASE,
      });
      if (selected && typeof selected === "string") {
        setFolderPath(selected);
        await loadFilesInFolder(selected);
      }
    } catch (err) {
      console.error("Error opening dialog", err);
    }
  };

  const handleOpen = async () => {
    setOpened(true);
    setLoading(true);
    
    // We only reset to default if folderPath is currently null
    const path = folderPath || getDeckFolderPath(deck.name);
    setFolderPath(path);

    if (path) {
      await loadFilesInFolder(path);
    } else {
      setFiles([]);
    }

    try {
      // Fetch notebook ID by matching deck.name
      const resNotebooks = await fetch("http://localhost:3001/api/notebooks");
      const dataNotebooks = await resNotebooks.json();
      
      if (dataNotebooks.error) {
        showNotification({ title: "NotebookLM Disconnected", message: `Please run notebooklm-mcp-auth in terminal. Error: ${dataNotebooks.error}`, type: "error" });
      } else {
        const notebook = dataNotebooks.notebooks?.find((n: any) => 
          n.title.replace("_", "-").includes(deck.name) || deck.name.includes(n.title.replace("_", "-"))
        );
        
        if (notebook) {
          setActiveNotebookId(notebook.id);
          const resStudio = await fetch(`http://localhost:3001/api/studio_status/${notebook.id}`);
          const dataStudio = await resStudio.json();
          if (dataStudio.error) {
            showNotification({ title: "Studio Status Error", message: dataStudio.error, type: "error" });
          } else if (dataStudio.artifacts) {
            setArtifacts(dataStudio.artifacts);
          }
        }
      }
    } catch (err: any) {
      console.error("Error fetching artifacts", err);
      showNotification({ title: "Connection Error", message: "Could not connect to local proxy server.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenImportModal = async (fileName: string) => {
    if (!folderPath) return;
    try {
      if (!isTauri()) {
         showNotification({ title: "Desktop Only", message: "Importing local files is only available on desktop.", type: "error" });
         return;
      }
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const fullPath = `${folderPath}/${fileName}`;
      const text = await readTextFile(fullPath);
      
      const newDrafts: {front: string, back: string}[] = [];
      const blocks = text.split(/\n\s*\n/);
      for (const block of blocks) {
        let q = "";
        let a = "";
        const cleanBlock = block.replace(/\*\*/g, '');
        const qMatch = cleanBlock.match(/(?:^|\n)\s*[Qq](?:uestion)?:\s*(.+)/);
        const aMatch = cleanBlock.match(/(?:^|\n)\s*[Aa](?:nswer)?:\s*(.+)/);
        if (qMatch && aMatch) {
          q = qMatch[1].trim();
          a = aMatch[1].trim();
          newDrafts.push({ front: q, back: a });
        } else {
            const lines = cleanBlock.split('\n');
            for (const line of lines) {
               const lqMatch = line.match(/(?:^|\n)\s*[Qq](?:uestion)?:\s*(.+)/);
               const laMatch = line.match(/(?:^|\n)\s*[Aa](?:nswer)?:\s*(.+)/);
               if (lqMatch) q = lqMatch[1].trim();
               if (laMatch) a = laMatch[1].trim();
            }
            if (q && a) {
                newDrafts.push({ front: q, back: a });
            }
        }
      }

      if (newDrafts.length === 0) {
        showNotification({ title: "No Flashcards Found", message: "Could not find any Q&A formatted flashcards in this file.", type: "error" });
        return;
      }

      setParsedFlashcards(newDrafts);
      setSelectedFileToImport(fileName);
      setSubdeckName(fileName.replace(/\.md$/i, ""));
      setImportModalOpened(true);
    } catch (err: any) {
      const errMsg = err.message || (typeof err === "string" ? err : JSON.stringify(err));
      showNotification({ title: "Error", message: "Failed to read file: " + errMsg, type: "error" });
    }
  };

  const handleAutoImportFlashcards = async (artifact: any) => {
    if (!activeNotebookId) {
      showNotification({ title: "Error", message: "Notebook ID not found.", type: "error" });
      return;
    }
    
    setLoading(true);
    showNotification({ title: "Generating Flashcards", message: "Asking NotebookLM to generate flashcards... (This takes about 10-15s)", type: "info" });
    
    try {
      const res = await fetch("http://localhost:3001/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          notebook_id: activeNotebookId, 
          query: "Create exactly 10 high-yield flashcards covering the most important concepts of this notebook. Format each flashcard strictly with 'Q: [question]' on one line and 'A: [answer]' on the next line. Do not use markdown bold or extra text."
        }),
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const text = data.answer;
      const newDrafts: {front: string, back: string}[] = [];
      const blocks = text.split(/\n\s*\n/);
      
      for (const block of blocks) {
        let q = "";
        let a = "";
        const cleanBlock = block.replace(/\*\*/g, '');
        const qMatch = cleanBlock.match(/(?:^|\n)\s*[Qq](?:uestion)?:\s*(.+)/);
        const aMatch = cleanBlock.match(/(?:^|\n)\s*[Aa](?:nswer)?:\s*(.+)/);
        if (qMatch && aMatch) {
          q = qMatch[1].trim();
          a = aMatch[1].trim();
          newDrafts.push({ front: q, back: a });
        } else {
            // Also try matching lines in a single block if split by newline failed
            const lines = cleanBlock.split('\n');
            for (const line of lines) {
               const lqMatch = line.match(/(?:^|\n)\s*[Qq](?:uestion)?:\s*(.+)/);
               const laMatch = line.match(/(?:^|\n)\s*[Aa](?:nswer)?:\s*(.+)/);
               if (lqMatch) q = lqMatch[1].trim();
               if (laMatch) a = laMatch[1].trim();
            }
            if (q && a) {
                newDrafts.push({ front: q, back: a });
            }
        }
      }

      if (newDrafts.length === 0) {
        showNotification({ title: "Parsing Failed", message: "LLM responded but we couldn't parse the Q: and A: format. Try again.", type: "error" });
        return;
      }

      setParsedFlashcards(newDrafts);
      setSelectedFileToImport("Auto-generated from LLM");
      setSubdeckName(artifact.title || "LLM Flashcards");
      setImportModalOpened(true);
      setOpened(false); // Close the Sync modal so the import modal is clear
      
    } catch (err: any) {
      showNotification({ title: "Error", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!selectedFileToImport || !subdeckName.trim() || parsedFlashcards.length === 0) return;
    setLoading(true);
    try {
      // 1. Create a subdeck
      const subdeckId = await newDeck(subdeckName, deck);

      // We need to fetch the newly created subdeck object to pass it to newNote
      const newSubdeck = await db.decks.get(subdeckId);
      if (!newSubdeck) throw new Error("Failed to create subdeck");

      // 2. Add notes to it
      for (const draft of parsedFlashcards) {
        await BasicNoteTypeAdapter.createNote({
          front: draft.front,
          back: draft.back
        }, newSubdeck);
      }

      showNotification({ title: "Success", message: `Imported ${parsedFlashcards.length} flashcards to "${subdeckName}"!`, type: "success" });
      setImportModalOpened(false);
    } catch (err: any) {
      showNotification({ title: "Error", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsyncFile = async (materialId: string) => {
    try {
      const currentMaterials = deck.studyMaterials || [];
      const newMaterials = currentMaterials.filter(m => m.id !== materialId);
      await db.decks.update(deck.id, {
        studyMaterials: newMaterials
      });
      showNotification({ title: "Success", message: "File unsynced from deck.", type: "success" });
    } catch (err: any) {
      showNotification({ title: "Error", message: err.message, type: "error" });
    }
  };

  const handleReconnect = async () => {
    try {
      showNotification({ title: "Reconnecting", message: "Refreshing NotebookLM connection...", type: "info" });
      const res = await fetch("http://localhost:3001/api/refresh_auth", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showNotification({ title: "Connected", message: "NotebookLM auth refreshed successfully!", type: "success" });
        handleOpen(); // Re-fetch the data
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      showNotification({ title: "Failed", message: "Could not reconnect. Please run notebooklm-mcp-auth in your terminal.", type: "error" });
    }
  };

  const handleSyncFiles = async () => {
    if (!folderPath || files.length === 0) return;
    setLoading(true);
    
    try {
      const currentMaterials = deck.studyMaterials || [];
      const newMaterials: StudyMaterial[] = [];

      // Get authenticated user ID to organize bucket
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || 'anonymous';

      for (const fileName of files) {
        const fullPath = `${folderPath}/${fileName}`;
        
        // Skip if a material with this exact title already exists
        const fileTitle = fileName.replace(/\.[^/.]+$/, "");
        if (currentMaterials.some(m => m.title === fileTitle)) continue;

        let type: "doc" | "ppt" | "audio" | "video" | "resume" = "doc";
        let mimeType = "text/plain";
        let finalUrl = "";
        let finalContent = "";

        if (fileName.endsWith(".pdf")) { type = "ppt"; mimeType = "application/pdf"; }
        else if (fileName.endsWith(".wav")) { type = "audio"; mimeType = "audio/wav"; }
        else if (fileName.endsWith(".mp3")) { type = "audio"; mimeType = "audio/mpeg"; }
        else if (fileName.endsWith(".m4a")) { type = "audio"; mimeType = "audio/mp4"; }
        else if (fileName.endsWith(".mp4")) { type = "video"; mimeType = "video/mp4"; }
        else if (fileName.endsWith(".md") || fileName.endsWith(".txt") || fileName.endsWith(".csv")) { type = "doc"; mimeType = "text/plain"; }

        if (type === "audio" || type === "video" || type === "ppt") {
            showNotification({ title: "Uploading...", message: `Uploading ${fileName} to cloud...`, type: "info" });
            if (!isTauri()) throw new Error("Cannot read local files from a web browser.");
            const { readFile } = await import("@tauri-apps/plugin-fs");
            const fileBytes = await readFile(fullPath);
            const ext = fileName.split('.').pop();
            const safeFileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`;
            const cloudPath = `${userId}/${safeFileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('renal-review')
              .upload(cloudPath, fileBytes, {
                contentType: mimeType,
                upsert: false
              });
              
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage
              .from('renal-review')
              .getPublicUrl(cloudPath);
              
            finalUrl = publicUrl;
        } else {
            // Read text content directly into the DB so it syncs perfectly
            if (!isTauri()) throw new Error("Cannot read local files from a web browser.");
            const { readTextFile } = await import("@tauri-apps/plugin-fs");
            finalContent = await readTextFile(fullPath);
        }

        newMaterials.push({
          id: uuidv4(),
          title: fileTitle,
          type,
          url: finalUrl || undefined,
          content: finalContent || undefined,
          createdAt: new Date(),
        });
      }

      if (newMaterials.length > 0) {
        await db.decks.update(deck.id, {
          studyMaterials: [...currentMaterials, ...newMaterials]
        });
        showNotification({ title: "Success", message: `Synced ${newMaterials.length} new file(s) to deck!`, type: "success" });
      } else {
        showNotification({ title: "Up to Date", message: "All files in this folder are already synced.", type: "info" });
      }
      setOpened(false);
    } catch (err: any) {
      showNotification({ title: "Error", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="subtle" 
        leftSection={<IconCloudDownload size={16} />} 
        onClick={handleOpen}
      >
        Sync NotebookLM Files
      </Button>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Sync NotebookLM Files">
        <Stack gap="md">
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="xs" variant="default" onClick={handleReconnect}>
              Reconnect / Refresh Auth
            </Button>
          </div>
          {!folderPath ? (
            <>
              <Text size="sm" style={{ color: "var(--theme-red-500, red)" }}>
                No folder currently selected.
              </Text>
              <Button size="xs" variant="default" onClick={handleSelectFolder}>
                Choose Sync Folder
              </Button>
            </>
          ) : (
            <>
              <Text size="sm" variant="dimmed">
                Checking your local folder for downloaded NotebookLM files:
              </Text>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <code style={{ fontSize: "11px", background: "var(--theme-neutral-100)", padding: "4px 8px", flex: 1, overflowX: "auto" }}>
                  {folderPath}
                </code>
                <Button size="xs" variant="default" onClick={handleSelectFolder}>
                  Change Folder
                </Button>
              </div>

              {loading ? (
                <Text size="sm">Scanning folder...</Text>
              ) : files.length === 0 ? (
                <div style={{ padding: "var(--spacing-md)", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px" }}>
                  <Text size="sm" style={{ fontWeight: 600, color: "#b45309" }}>No files found in folder!</Text>
                  <Text size="sm" style={{ marginTop: "8px", color: "#92400e" }}>
                    Please download your Study Guides, Briefing Documents, and Audio Overviews from NotebookLM and place them in the folder shown above.
                  </Text>
                </div>
              ) : (
                <>
                  <Text size="sm" style={{ fontWeight: 500 }}>Found {files.length} file(s):</Text>
                  <ul style={{ listStyleType: "none", padding: 0, margin: "8px 0" }}>
                    {files.map(file => {
                      const fileTitle = file.replace(/\.[^/.]+$/, "");
                      const syncedMaterial = deck.studyMaterials?.find(m => m.title === fileTitle);
                      const isSynced = !!syncedMaterial;
                      return (
                        <li 
                          key={file}
                          style={{ 
                            display: "flex", 
                            justifyContent: "space-between",
                            alignItems: "center", 
                            gap: "8px",
                            padding: "4px 0",
                            color: isSynced ? "var(--theme-neutral-500)" : "inherit" 
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {isSynced ? (
                              <IconCheck size={16} color="teal" />
                            ) : (
                              <IconFile size={16} color="var(--theme-primary)" />
                            )}
                            <span>
                              {file} {isSynced && "(Already synced)"}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "4px" }}>
                            {file.endsWith(".md") && (
                              <Button 
                                size="xs" 
                                variant="default" 
                                onClick={() => handleOpenImportModal(file)}
                              >
                                Import to Flashcards
                              </Button>
                            )}
                            {isSynced && syncedMaterial && (
                              <Button 
                                size="xs" 
                                variant="subtle" 
                                onClick={() => handleUnsyncFile(syncedMaterial.id)}
                              >
                                Unsync
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {artifacts.length > 0 && (
                <>
                  <Text size="sm" style={{ fontWeight: 600, marginTop: "var(--spacing-md)", borderTop: "1px solid var(--theme-border)", paddingTop: "var(--spacing-md)" }}>
                    NotebookLM Cloud Artifacts
                  </Text>
                  <ul style={{ listStyleType: "none", padding: 0, margin: "8px 0" }}>
                    {artifacts.filter(a => a.type === 'report' || a.type === 'flashcard' || a.type === 'flashcards').map(artifact => {
                      const ext = ".md";
                      const fileName = `${artifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${ext}`;
                      const isDownloaded = files.includes(fileName);

                      return (
                        <li key={artifact.artifact_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--theme-border-subtle)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <IconCloudDownload size={16} color="var(--theme-primary)" />
                            <Text size="sm">{artifact.title} ({artifact.type === 'report' ? artifact.report_content || 'Report' : artifact.type})</Text>
                          </div>
                          {isDownloaded ? (
                            <Text size="xs" style={{ color: "teal", fontWeight: 600 }}>Downloaded</Text>
                          ) : (artifact.type === 'flashcard' || artifact.type === 'flashcards') ? (
                            <Button 
                              size="xs" 
                              variant="default" 
                              onClick={() => handleAutoImportFlashcards(artifact)}
                            >
                              Auto-Import from LLM
                            </Button>
                          ) : (
                            <Button 
                              size="xs" 
                              variant="subtle" 
                              onClick={() => handleOpenPasteModal(artifact)}
                            >
                              Save to OneDrive
                            </Button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--spacing-md)", marginTop: "var(--spacing-md)" }}>
            <Button variant="subtle" onClick={() => setOpened(false)}>Cancel</Button>
            <Button 
              onClick={handleSyncFiles} 
              disabled={loading || !folderPath || files.length === 0}
            >
              {loading ? "Processing..." : "Sync to Deck"}
            </Button>
          </div>
        </Stack>
      </Modal>

      <Modal opened={pasteModalOpened} onClose={() => setPasteModalOpened(false)} title="Save to OneDrive">
        <Stack gap="md">
          <Text size="sm">
            Please paste the contents of <strong>{activeArtifact?.title}</strong> below.
          </Text>
          <Text size="xs" variant="dimmed">
            Your NotebookLM tab was just opened. Click "Copy" on the document there, and paste it here to automatically save it as a Markdown (.md) file to your OneDrive.
          </Text>
          
          <textarea 
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder="# Paste your content here..."
            style={{
              width: "100%",
              height: "200px",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid var(--theme-border)",
              fontFamily: "monospace",
              resize: "vertical"
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--spacing-md)", marginTop: "var(--spacing-md)" }}>
            <Button variant="subtle" onClick={() => setPasteModalOpened(false)}>Cancel</Button>
            <Button 
              onClick={handleSavePastedContent} 
              disabled={!pasteContent.trim()}
            >
              Save to OneDrive
            </Button>
          </div>
        </Stack>
      </Modal>

      <Modal opened={importModalOpened} onClose={() => setImportModalOpened(false)} title="Import to Flashcards">
        <Stack gap="md">
          <Text size="sm">
            Found <strong>{parsedFlashcards.length}</strong> flashcards in <code>{selectedFileToImport}</code>.
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500 }}>Collection / Subdeck Name</label>
            <input 
              type="text"
              value={subdeckName}
              onChange={e => setSubdeckName(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--theme-border)' }}
            />
          </div>
          <Text size="xs" variant="dimmed">
            This will create a new subdeck inside "{deck.name}" and add these flashcards to it. The original .md file will remain in your OneDrive folder.
          </Text>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--spacing-md)", marginTop: "var(--spacing-md)" }}>
            <Button variant="subtle" onClick={() => setImportModalOpened(false)}>Cancel</Button>
            <Button 
              onClick={handleImportConfirm} 
              disabled={loading || !subdeckName.trim()}
            >
              {loading ? "Importing..." : "Confirm Import"}
            </Button>
          </div>
        </Stack>
      </Modal>
    </>
  );
}
