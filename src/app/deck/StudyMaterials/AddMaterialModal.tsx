import React, { useState, useRef } from "react";
import {
  Button,
  Modal,
  Select,
  Stack,
  TextInput,
  Textarea,
} from "@/components/ui";
import { isTauri } from "@/lib/isTauri";
import { db } from "@/logic/db";
import { Deck, MaterialType, StudyMaterial } from "@/logic/deck/deck";
import { v4 as uuidv4 } from "uuid";
import { saveStudyMaterialToOneDrive } from "@/logic/oneDriveSync";

interface AddMaterialModalProps {
  deck: Deck;
  opened: boolean;
  onClose: () => void;
}

const MATERIAL_TYPES = [
  { value: "doc", label: "Document (PDF/HTML/Link)" },
  { value: "resume", label: "Study Guide / Summary" },
  { value: "ppt", label: "Slide Deck" },
  { value: "video", label: "Video Overview" },
  { value: "audio", label: "Audio Overview / Podcast" },
  { value: "table", label: "Data Table" },
];

export default function AddMaterialModal({
  deck,
  opened,
  onClose,
}: AddMaterialModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("doc");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");

  const handleSave = async () => {
    if (!title.trim()) return;

    // Find parent topic name
    let parentTopicName = "Miscellaneous";
    if (deck.superDecks && deck.superDecks.length > 0) {
      const parentId = deck.superDecks[deck.superDecks.length - 1];
      const parentDeck = await db.decks.get(parentId);
      if (parentDeck) parentTopicName = parentDeck.name;
    }

    const fileName = title.trim().endsWith(".pdf") || title.trim().endsWith(".html")
      ? title.trim()
      : `${title.trim()}.txt`;

    let finalUrl = url.trim();

    // Copy or write file to OneDrive folder structure
    if (finalUrl || content.trim()) {
      const savedOneDrivePath = await saveStudyMaterialToOneDrive(
        parentTopicName,
        deck.name,
        fileName,
        finalUrl || content.trim()
      );
      if (savedOneDrivePath) {
        finalUrl = savedOneDrivePath;
      }
    }

    const newMaterial: StudyMaterial = {
      id: uuidv4(),
      title: title.trim(),
      type,
      url: finalUrl || undefined,
      content: content.trim() || undefined,
      createdAt: new Date(),
    };

    const currentMaterials = deck.studyMaterials || [];

    await db.decks.update(deck.id, {
      studyMaterials: [...currentMaterials, newMaterial],
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
      if (isTauri()) {
        const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await openDialog({
          multiple: false,
          directory: false,
          defaultPath:
            "/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review",
        });
        if (selectedPath && typeof selectedPath === "string") {
          setUrl(selectedPath);
          if (!title.trim()) {
            const filename = selectedPath.split(/[/\\]/).pop() || "";
            setTitle(filename);
          }
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      console.error("Failed to open file dialog", err);
      fileInputRef.current?.click();
    }
  };

  const handleHTMLFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const oneDrivePath = `/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review/${file.name}`;
      setUrl(oneDrivePath);
      if (!title.trim()) {
        setTitle(file.name);
      }
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add Study Material to Deck">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleHTMLFileSelected}
      />

      <Stack gap="md" style={{ marginTop: "var(--spacing-md)" }}>
        <TextInput
          label="Title"
          placeholder="e.g. Spasovski 2026 Hyponatremia Review"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
          autoFocus
        />

        <Select
          label="Material Type"
          options={MATERIAL_TYPES}
          value={type}
          onChange={(val) => setType(val as MaterialType)}
        />

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "var(--spacing-sm)",
          }}
        >
          <div style={{ flex: 1 }}>
            <TextInput
              label="OneDrive Path / Resource URL"
              placeholder="/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review/..."
              description="Points to document location in your OneDrive folder"
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
            />
          </div>
          <Button
            variant="subtle"
            onClick={handleBrowseFile}
            style={{ marginBottom: "var(--spacing-md)" }}
          >
            📁 Browse...
          </Button>
        </div>

        <Textarea
          label="Text Content or Summary Notes (Optional)"
          placeholder="Paste key notes, executive summary, or markdown notes here..."
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={5}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--spacing-md)",
            marginTop: "var(--spacing-md)",
          }}
        >
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            Save Study Material
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}
