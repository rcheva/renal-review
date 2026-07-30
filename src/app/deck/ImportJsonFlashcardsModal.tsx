import React, { useState, useRef, useEffect } from "react";
import { Modal, Button, TextInput, Select, Textarea } from "@/components/ui";
import { BasicNoteTypeAdapter } from "@/logic/type-implementations/normal/BasicNote";
import { Deck } from "@/logic/deck/deck";
import { useAllDecks } from "@/logic/deck/hooks/useAllDecks";
import { newDeck } from "@/logic/deck/newDeck";
import { db } from "@/logic/db";
import { ColorIdentifier } from "@/lib/ColorIdentifier";
import DeckColorChooser from "./DeckColorChooser";
import { useNavigate } from "react-router-dom";
import { saveFlashcardsToOneDrive } from "@/logic/oneDriveSync";

const RENAL_TOPICS = [
  "CKD",
  "AKI",
  "GMN",
  "Dialysis",
  "Transplant",
  "Electrolytes",
  "Hypertension",
  "Genetics / Rare",
  "Guidelines",
  "RCT",
  "Miscellaneous",
  "GIM",
];

interface ImportJsonFlashcardsModalProps {
  opened: boolean;
  onClose: () => void;
  defaultParentId?: string;
}

export function ImportJsonFlashcardsModal({
  opened,
  onClose,
  defaultParentId = "",
}: ImportJsonFlashcardsModalProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allDecks] = useAllDecks();

  const [subdeckName, setSubdeckName] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(defaultParentId);
  const [deckColor, setDeckColor] = useState<ColorIdentifier>("sky");

  const [jsonText, setJsonText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [detectedCount, setDetectedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Filter top-level Renal topics
  const renalTopics = (allDecks || [])
    .filter(
      (d) =>
        (!d.superDecks || d.superDecks.length === 0) &&
        RENAL_TOPICS.includes(d.name)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (opened) {
      if (defaultParentId) {
        setSelectedParentId(defaultParentId);
      } else if (renalTopics.length > 0 && !selectedParentId) {
        setSelectedParentId(renalTopics[0].id);
      }
    }
  }, [opened, defaultParentId, renalTopics]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        let textToParse = content.trim();
        if (textToParse.startsWith("```json")) textToParse = textToParse.replace(/```json/g, "");
        if (textToParse.startsWith("```")) textToParse = textToParse.replace(/```/g, "");
        if (textToParse.endsWith("```")) textToParse = textToParse.slice(0, -3);

        const parsed = JSON.parse(textToParse);
        if (!Array.isArray(parsed)) throw new Error("JSON document must contain an array of flashcard objects.");

        setJsonText(textToParse);
        setUploadedFileName(file.name);
        setDetectedCount(parsed.length);
        setErrorMsg("");

        // Auto fill subdeck name if empty
        if (!subdeckName) {
          const cleanName = file.name.replace(/\.json$/i, "").replace(/_/g, " ");
          setSubdeckName(cleanName);
        }
      } catch (err: any) {
        setErrorMsg("Failed to parse JSON file: " + err.message);
        setUploadedFileName("");
        setDetectedCount(0);
      }
    };
    reader.readAsText(file);
  };

  const handleTextChange = (val: string) => {
    setJsonText(val);
    setErrorMsg("");
    try {
      let textToParse = val.trim();
      if (textToParse.startsWith("```json")) textToParse = textToParse.replace(/```json/g, "");
      if (textToParse.startsWith("```")) textToParse = textToParse.replace(/```/g, "");
      if (textToParse.endsWith("```")) textToParse = textToParse.slice(0, -3);

      if (textToParse) {
        const parsed = JSON.parse(textToParse);
        if (Array.isArray(parsed)) {
          setDetectedCount(parsed.length);
        } else {
          setDetectedCount(0);
        }
      } else {
        setDetectedCount(0);
      }
    } catch {
      setDetectedCount(0);
    }
  };

  const handleImport = async () => {
    if (!subdeckName.trim()) {
      setErrorMsg("Please enter a name for the subdeck.");
      return;
    }
    if (!jsonText.trim()) {
      setErrorMsg("Please upload or paste JSON flashcards.");
      return;
    }

    setIsImporting(true);
    setErrorMsg("");

    try {
      let textToParse = jsonText.trim();
      if (textToParse.startsWith("```json")) textToParse = textToParse.replace(/```json/g, "");
      if (textToParse.startsWith("```")) textToParse = textToParse.replace(/```/g, "");
      if (textToParse.endsWith("```")) textToParse = textToParse.slice(0, -3);

      const parsed = JSON.parse(textToParse);
      if (!Array.isArray(parsed)) throw new Error("JSON document must contain an array of items.");

      // 1. Get or create parent deck
      let parentDeckObj: Deck | undefined = undefined;
      if (selectedParentId) {
        const dbParent = await db.decks.get(selectedParentId);
        if (dbParent) parentDeckObj = dbParent as Deck;
      }

      // 2. Create the subdeck under the Renal Topic parent
      const subdeckId = await newDeck(
        subdeckName.trim(),
        parentDeckObj,
        descriptionValue.trim(),
        deckColor
      );
      const subdeckObj = await db.decks.get(subdeckId);
      if (!subdeckObj) throw new Error("Failed to initialize subdeck.");

      // 3. Batch insert all flashcards into the subdeck
      let importedCount = 0;
      for (const item of parsed) {
        const front = item.front || item.question || item.q || item.question_text || "";
        let back = item.back || item.answer || item.a || "";

        if (!back && item.options && Array.isArray(item.options)) {
          const correctIdx = item.correct_option_index ?? 0;
          back = `Correct Answer: ${item.options[correctIdx] || ""}\n\n${item.explanation || ""}`;
        }

        if (front.trim()) {
          await BasicNoteTypeAdapter.createNote(
            {
              front: front.trim(),
              back: back.trim(),
            },
            subdeckObj
          );
          importedCount++;
        }
      }

      // 4. Save JSON file into OneDrive under /Renal_Review/<ParentTopic>/<SubdeckName>/
      const parentTopicName = parentDeckObj ? parentDeckObj.name : "Miscellaneous";
      await saveFlashcardsToOneDrive(
        parentTopicName,
        subdeckName.trim(),
        textToParse,
        uploadedFileName
      );

      setIsImporting(false);
      onClose();

      // Reset state
      setSubdeckName("");
      setDescriptionValue("");
      setJsonText("");
      setUploadedFileName("");
      setDetectedCount(0);

      // Navigate directly to the new subdeck
      navigate(`/deck/${subdeckId}`);
    } catch (err: any) {
      setIsImporting(false);
      setErrorMsg("Error creating subdeck and flashcards: " + err.message);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        setUploadedFileName("");
        setDetectedCount(0);
        setErrorMsg("");
      }}
      title="Import Flashcards (JSON) into Subdeck"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <TextInput
          label="Subdeck Name"
          placeholder="e.g. 'Hyponatremia NSAP' or 'Glomerular Pathology'"
          value={subdeckName}
          onChange={(e) => setSubdeckName(e.target.value)}
          autoFocus
        />

        <TextInput
          label="Description (Optional)"
          placeholder="e.g. 'NephSAP 2026 Review Questions'"
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.target.value)}
        />

        <Select
          label="Parent Deck (Select Renal Topic)"
          value={selectedParentId}
          onChange={(val) => setSelectedParentId(val || "")}
          options={renalTopics.map((d) => ({
            label: d.name,
            value: d.id,
          }))}
        />

        <DeckColorChooser deckColor={deckColor} setDeckColor={setDeckColor} />

        {/* Browser File Upload */}
        <div
          style={{
            border: "2px dashed var(--theme-primary-500, #0284c7)",
            borderRadius: "10px",
            padding: "16px",
            textAlign: "center",
            background: "var(--theme-primary-50, #f0f9ff)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <div
            style={{
              color: "var(--theme-primary-600, #0284c7)",
              fontWeight: 700,
              fontSize: "14px",
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            📁 Click to Upload Flashcards JSON Document (.json)
          </div>
          <div style={{ fontSize: "12px", color: "var(--theme-neutral-500)" }}>
            Select a .json file generated from ChatGPT, Claude, or Skola AI
          </div>
        </div>

        {/* Confirmation Banner */}
        {uploadedFileName && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#047857",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>✅</span>
            <span>
              Loaded file <strong>"{uploadedFileName}"</strong> ({detectedCount} flashcards detected)
            </span>
          </div>
        )}

        <Textarea
          label="Or Paste JSON Output Below"
          placeholder='[\n  {\n    "front": "What is severe hyponatremia?",\n    "back": "Serum sodium < 120 mmol/L."\n  }\n]'
          value={jsonText}
          onChange={(e) => handleTextChange(e.target.value)}
          style={{ minHeight: "140px" }}
        />

        {errorMsg && (
          <p style={{ color: "var(--theme-red-600)", fontSize: "0.875rem", margin: 0 }}>
            {errorMsg}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!subdeckName.trim() || !jsonText.trim() || isImporting}
          >
            {isImporting
              ? "Creating Subdeck & Flashcards..."
              : detectedCount > 0
              ? `Create Subdeck & Import ${detectedCount} Cards`
              : "Create Subdeck & Import"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
