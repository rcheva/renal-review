import { useState } from "react";
import { useDecks } from "@/logic/deck/hooks/useDecks";
import { newNote } from "@/logic/note/newNote";
import { NoteType } from "@/logic/note/note";
import { Button } from "@/components/ui/Button";
import { useDocumentTitle } from "@/lib/hooks/useDocumentTitle";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { AppHeaderContent } from "../shell/Header/Header";
import "./ImportView.css";
import { Deck } from "@/logic/deck/deck";
import { useNotifications } from "@/components/Notification";

const BASE = "import-view";

interface DraftCard {
  front: string;
  back: string;
}

export default function ImportView() {
  useDocumentTitle("Batch Import | Renal Review");
  const [decks] = useDecks();
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [sourceRef, setSourceRef] = useState<string>("");
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const { showNotification } = useNotifications();

  const handleParse = () => {
    const newDrafts: DraftCard[] = [];
    
    // Attempt block-based Q&A parsing
    const blocks = text.split(/\n\s*\n/);
    for (const block of blocks) {
      // Regex matches optional markdown bolding around Q/A
      const qMatch = block.match(/(?:\*\*[Qq](?:uestion)?:\*\*|[Qq](?:uestion)?:\s*)\s*(.+)/);
      const aMatch = block.match(/(?:\*\*[Aa](?:nswer)?:\*\*|[Aa](?:nswer)?:\s*)\s*(.+)/);
      if (qMatch && aMatch) {
        newDrafts.push({ front: qMatch[1].trim(), back: aMatch[1].trim() });
        continue;
      }
      
      // Attempt line-based parsing (CSV/TSV)
      const lines = block.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
        const parts = line.split(delimiter);
        if (parts.length >= 2) {
          // Unquote naive logic
          const cleanFront = parts[0].replace(/^"|"$/g, "").trim();
          const cleanBack = parts.slice(1).join(delimiter).replace(/^"|"$/g, "").trim();
          if (cleanFront && cleanBack) {
            newDrafts.push({ front: cleanFront, back: cleanBack });
          }
        }
      }
    }
    
    setDrafts(newDrafts);
  };

  const handleImport = async () => {
    if (!selectedDeck) {
      showNotification({ title: "Error", message: "Please select a deck first.", type: "error" });
      return;
    }
    const deck = decks?.find(d => d.id === selectedDeck);
    if (!deck) return;

    let importedCount = 0;
    for (const draft of drafts) {
      if (draft.front && draft.back) {
        await newNote(deck, {
          type: NoteType.Basic,
          front: draft.front,
          back: draft.back
        }, sourceRef || undefined);
        importedCount++;
      }
    }

    showNotification({ title: "Success", message: `Imported ${importedCount} cards successfully.`, type: "success" });
    setDrafts([]);
    setText("");
  };

  const updateDraft = (index: number, field: "front" | "back", value: string) => {
    const updated = [...drafts];
    updated[index][field] = value;
    setDrafts(updated);
  };

  const removeDraft = (index: number) => {
    setDrafts(drafts.filter((_, i) => i !== index));
  };

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs />
      </AppHeaderContent>
      <div className={BASE}>
        <h1 className={`${BASE}__title`}>Batch Import Tool</h1>
        <p className={`${BASE}__subtitle`}>
          Paste your Markdown Q&A from NotebookLM or CSV data from Zotero. We will parse it into flashcards.
        </p>

        <div className={`${BASE}__form`}>
          <label className={`${BASE}__draft-label`}>Target Deck</label>
          <select 
            value={selectedDeck} 
            onChange={(e) => setSelectedDeck(e.target.value)}
            className={`${BASE}__draft-input`}
          >
            <option value="">Select a deck...</option>
            {decks?.map((deck: Deck) => (
              <option key={deck.id} value={deck.id}>{deck.name}</option>
            ))}
          </select>

          <label className={`${BASE}__draft-label`}>Source Reference (Optional Zotero URI / NotebookLM Link)</label>
          <input 
            type="text" 
            className={`${BASE}__draft-input`} 
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
            placeholder="zotero://select/items/1_AAAAAA or citation"
          />

          <label className={`${BASE}__draft-label`}>Data (Markdown / CSV / TSV)</label>
          <textarea
            className={`${BASE}__textarea`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"**Q:** What is the most common cause of AKI?\n**A:** Prerenal azotemia.\n\nPrerenal, decreased perfusion"}
          />
          <Button variant="primary" onClick={handleParse}>Parse Data</Button>
        </div>

        {drafts.length > 0 && (
          <div className={`${BASE}__drafts`}>
            <h2>Draft Cards ({drafts.length})</h2>
            {drafts.map((draft, i) => (
              <div key={i} className={`${BASE}__draft-card`}>
                <div className={`${BASE}__draft-fields`}>
                  <div className={`${BASE}__draft-field`}>
                    <span className={`${BASE}__draft-label`}>Front</span>
                    <input 
                      type="text" 
                      className={`${BASE}__draft-input`} 
                      value={draft.front}
                      onChange={(e) => updateDraft(i, "front", e.target.value)}
                    />
                  </div>
                  <div className={`${BASE}__draft-field`}>
                    <span className={`${BASE}__draft-label`}>Back</span>
                    <input 
                      type="text" 
                      className={`${BASE}__draft-input`} 
                      value={draft.back}
                      onChange={(e) => updateDraft(i, "back", e.target.value)}
                    />
                  </div>
                </div>
                <div className={`${BASE}__actions`}>
                  <Button variant="ghost" onClick={() => removeDraft(i)}>Reject</Button>
                </div>
              </div>
            ))}
            <div className={`${BASE}__actions`}>
              <Button variant="default" onClick={() => setDrafts([])}>Clear All</Button>
              <Button variant="primary" onClick={handleImport}>Import Selected ({drafts.length})</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
