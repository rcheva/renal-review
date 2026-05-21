import { Button, Modal, Select, Stack, TextInput, Textarea } from "@/components/ui";
import { Tabs } from "@/components/ui/Tabs";
import { db } from "@/logic/db";
import { Deck, MaterialType, StudyMaterial } from "@/logic/deck/deck";
import { BasicNoteTypeAdapter } from "@/logic/type-implementations/normal/BasicNote";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { isTauri } from "@/lib/isTauri";

interface AddMaterialModalProps {
  deck: Deck;
  opened: boolean;
  onClose: () => void;
}

const MATERIAL_TYPES = [
  { value: "doc", label: "Document (PDF/Link)" },
  { value: "resume", label: "Study Guide / Resume" },
  { value: "ppt", label: "Slide Deck" },
  { value: "video", label: "Video Overview" },
  { value: "audio", label: "Audio Overview / Podcast" },
  { value: "table", label: "Data Table" },
];

export default function AddMaterialModal({ deck, opened, onClose }: AddMaterialModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("doc");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  
  const [jsonText, setJsonText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;

    const newMaterial: StudyMaterial = {
      id: uuidv4(),
      title: title.trim(),
      type,
      url: url.trim() || undefined,
      content: content.trim() || undefined,
      createdAt: new Date(),
    };

    const currentMaterials = deck.studyMaterials || [];
    
    await db.decks.update(deck.id, {
      studyMaterials: [...currentMaterials, newMaterial]
    });

    // Reset form
    setTitle("");
    setType("doc");
    setUrl("");
    setContent("");
    onClose();
  };

  const handleBrowseFile = async () => {
    try {
      if (!isTauri()) {
        alert("Selecting local files is only available in the Mac Desktop app.");
        return;
      }
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        defaultPath: "/Users/julio/Library/CloudStorage/OneDrive-Personal/renal review",
      });
      if (selectedPath && typeof selectedPath === 'string') {
        setUrl(selectedPath);
        if (!title.trim()) {
           // Autocomplete title from filename if empty
           const filename = selectedPath.split(/[/\\]/).pop() || "";
           setTitle(filename);
        }
      }
    } catch (err) {
      console.error("Failed to open file dialog", err);
    }
  };

  const handleImportJson = async () => {
    if (!jsonText.trim()) return;
    try {
      setIsImporting(true);
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("JSON must be an array of flashcards.");
      }

      for (const card of parsed) {
        if (!card.question || !card.correct_answer) {
          console.warn("Skipping invalid card format", card);
          continue;
        }
        
        let backText = `<p>${card.correct_answer}</p>`;
        if (card.incorrect_answers && Array.isArray(card.incorrect_answers) && card.incorrect_answers.length > 0) {
          backText += `<br/><p><b>Incorrect options:</b></p><ul>`;
          for (const wrong of card.incorrect_answers) {
            backText += `<li>${wrong}</li>`;
          }
          backText += `</ul>`;
        }

        await BasicNoteTypeAdapter.createNote({
          front: card.question,
          back: backText,
        }, deck);
      }
      
      setJsonText("");
      onClose();
      alert(`Successfully imported ${parsed.length} flashcards!`);
    } catch (err: any) {
      alert("Failed to parse or import JSON: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add Material to Deck">
      <Tabs defaultValue="resource">
        <Tabs.List>
          <Tabs.Tab value="resource">Study Material</Tabs.Tab>
          <Tabs.Tab value="json">Import Flashcards</Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="resource">
          <Stack gap="md" style={{ marginTop: "var(--spacing-md)" }}>
            <TextInput
              label="Title"
              placeholder="e.g. KDIGO 2024 CKD Guidelines Summary"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
            />
            
            <Select
              label="Material Type"
              options={MATERIAL_TYPES}
              value={type}
              onChange={(val) => setType(val as MaterialType)}
            />

            <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--spacing-sm)" }}>
              <div style={{ flex: 1 }}>
                <TextInput
                  label="Resource URL or Local Path"
                  placeholder="https://... or /Users/..."
                  description="Paste the link or the local absolute path to your file"
                  value={url}
                  onChange={(e) => setUrl(e.currentTarget.value)}
                />
              </div>
              <Button variant="subtle" onClick={handleBrowseFile} style={{ marginBottom: "var(--spacing-md)" }}>
                Browse...
              </Button>
            </div>

            <Textarea
              label="Text Content (Optional)"
              placeholder="Paste markdown or raw text here if you don't have a URL..."
              description="Good for pasted Study Guides or Briefing Docs"
              value={content}
              onChange={(e) => setContent(e.currentTarget.value)}
              minRows={5}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--spacing-md)", marginTop: "var(--spacing-md)" }}>
              <Button variant="subtle" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!title.trim()}>Save Material</Button>
            </div>
          </Stack>
        </Tabs.Panel>
        
        <Tabs.Panel value="json">
          <Stack gap="md" style={{ marginTop: "var(--spacing-md)" }}>
            <Textarea
              label="Flashcards JSON"
              placeholder={'[\n  {\n    "question": "...",\n    "correct_answer": "..."\n  }\n]'}
              description="Paste an array of flashcards generated by an LLM."
              value={jsonText}
              onChange={(e) => setJsonText(e.currentTarget.value)}
              minRows={10}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--spacing-md)", marginTop: "var(--spacing-md)" }}>
              <Button variant="subtle" onClick={onClose} disabled={isImporting}>Cancel</Button>
              <Button onClick={handleImportJson} disabled={!jsonText.trim() || isImporting}>
                {isImporting ? "Importing..." : "Import Flashcards"}
              </Button>
            </div>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
