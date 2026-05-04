import { Button, Modal, Select, Stack, TextInput, Textarea } from "@/components/ui";
import { db } from "@/logic/db";
import { Deck, MaterialType, StudyMaterial } from "@/logic/deck/deck";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

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

  return (
    <Modal opened={opened} onClose={onClose} title="Add Study Material (NotebookLM Export)">
      <Stack gap="md">
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

        <TextInput
          label="Resource URL (Optional)"
          placeholder="https://..."
          description="Paste the link to the audio, video, or PDF file"
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
        />

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
    </Modal>
  );
}
