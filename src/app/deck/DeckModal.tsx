import type ModalProps from "@/components/ModalProps";
import { Button, Modal, Select, TextInput } from "@/components/ui";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import type { Deck } from "@/logic/deck/deck";
import { db } from "@/logic/db";
import { newDeck } from "@/logic/deck/newDeck";
import { updateDeck } from "@/logic/deck/updateDeck";
import { t } from "i18next";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DeckModal.css";
import { ColorIdentifier } from "@/lib/ColorIdentifier";
import { useAllDecks } from "@/logic/deck/hooks/useAllDecks";
import DeckColorChooser from "./DeckColorChooser";

const BASE = "deck-modal";

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

interface DeckModalProps extends ModalProps {
  mode: "create" | "edit";
  deck?: Deck;
  superDeck?: Deck;
}

function DeckModal({
  opened,
  setOpened,
  mode,
  deck,
  superDeck,
}: DeckModalProps) {
  const navigate = useNavigate();
  const [decks] = useAllDecks();

  const [nameValue, setNameValue] = useState<string>("");
  const [descriptionValue, setDescriptionValue] = useState<string>("");
  const [deckColor, setDeckColor] = useState<ColorIdentifier>("sky");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [customParentName, setCustomParentName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);

  // Collect all parent choices (12 Renal Topics + existing DB root decks)
  const existingRootDecks = (decks || []).filter(
    (d) => !d.superDecks || d.superDecks.length === 0
  );
  const allParentNamesSet = new Set([
    ...RENAL_TOPICS,
    ...existingRootDecks.map((d) => d.name),
  ]);
  const sortedParentNames = Array.from(allParentNamesSet).sort((a, b) =>
    a.localeCompare(b)
  );

  const parentOptions = [
    { label: "None (Top Level)", value: "" },
    ...sortedParentNames.map((name) => {
      const existingObj = existingRootDecks.find(
        (d) => d.name.toLowerCase() === name.toLowerCase()
      );
      return {
        label: name,
        value: existingObj ? existingObj.id : `TOPIC:${name}`,
      };
    }),
    { label: "➕ Create Custom Parent Deck...", value: "CUSTOM_NEW_PARENT" },
  ];

  useEffect(() => {
    if (mode === "edit" && deck) {
      setNameValue(deck.name);
      setDescriptionValue(deck.description || "");
      setDeckColor(deck.color || "sky");
    } else {
      setNameValue("");
      setDescriptionValue("");
      setCustomParentName("");
      setDeckColor("sky");
      setSelectedParentId(superDeck?.id || "");
    }
  }, [mode, deck, superDeck, opened]);

  function isInputValid(): boolean {
    if (selectedParentId === "CUSTOM_NEW_PARENT") {
      return nameValue.trim() !== "" && customParentName.trim() !== "";
    }
    return nameValue.trim() !== "";
  }

  function handleClose() {
    setOpened(false);
    setStatus(null);
  }

  async function handleSubmit() {
    if (!isInputValid()) return;
    setIsSubmitting(true);
    setStatus(null);

    try {
      if (mode === "create") {
        let parent: Deck | undefined = superDeck;

        if (selectedParentId === "CUSTOM_NEW_PARENT") {
          const targetName = customParentName.trim();
          const existing = (decks || []).find(
            (d) => d.name.toLowerCase() === targetName.toLowerCase()
          );
          if (existing) {
            parent = existing as Deck;
          } else {
            const newParentId = await newDeck(
              targetName,
              undefined,
              "Custom Parent Deck",
              "slate"
            );
            parent = (await db.decks.get(newParentId)) as Deck;
          }
        } else if (selectedParentId.startsWith("TOPIC:")) {
          const topicName = selectedParentId.replace("TOPIC:", "");
          const existing = (decks || []).find(
            (d) => d.name.toLowerCase() === topicName.toLowerCase()
          );
          if (existing) {
            parent = existing as Deck;
          } else {
            const newParentId = await newDeck(
              topicName,
              undefined,
              `Renal Topic - ${topicName}`,
              "sky"
            );
            parent = (await db.decks.get(newParentId)) as Deck;
          }
        } else if (selectedParentId) {
          const dbParent = await db.decks.get(selectedParentId);
          if (dbParent) parent = dbParent as Deck;
        }

        const id = await newDeck(
          nameValue.trim(),
          parent,
          descriptionValue.trim(),
          deckColor
        );
        setOpened(false);
        navigate("/deck/" + id);
      } else if (mode === "edit" && deck) {
        await updateDeck(deck.id, nameValue.trim(), descriptionValue.trim(), deckColor);
        setOpened(false);
      }
    } catch (e: any) {
      setStatus("Error: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
  }

  useHotkeys([["Enter", () => void handleSubmit()]]);

  const modalTitle =
    mode === "create"
      ? t("deck.new-deck-modal.title")
      : t("deck.edit-deck-modal.title");

  const submitButtonText =
    mode === "create"
      ? t("deck.new-deck-modal.create-deck")
      : t("deck.edit-deck-modal.save");

  return (
    <Modal opened={opened} onClose={handleClose} title={modalTitle}>
      <div className={BASE}>
        <TextInput
          placeholder={t("deck.new-deck-modal.name-placeholder")}
          label={t("deck.new-deck-modal.name")}
          value={nameValue}
          onChange={(e) => setNameValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        <TextInput
          placeholder={t("deck.new-deck-modal.description-placeholder")}
          label={t("deck.new-deck-modal.description")}
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />

        {mode === "create" && (
          <>
            <Select
              label="Parent Deck (Select Renal Topic)"
              value={selectedParentId}
              onChange={(val) => setSelectedParentId(val || "")}
              options={parentOptions}
            />

            {selectedParentId === "CUSTOM_NEW_PARENT" && (
              <TextInput
                label="Custom Parent Deck Name"
                placeholder="e.g. 'Glomerulonephritis Special Topic' or 'Rotation 2026'"
                value={customParentName}
                onChange={(e) => setCustomParentName(e.target.value)}
              />
            )}
          </>
        )}

        <DeckColorChooser deckColor={deckColor} setDeckColor={setDeckColor} />
        {status && <p className={`${BASE}__status`}>{status}</p>}
        <div className={`${BASE}__actions`}>
          <Button variant="default" onClick={handleClose}>
            {t("global.cancel")}
          </Button>
          <Button
            disabled={!isInputValid() || isSubmitting}
            variant="primary"
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? "..." : submitButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default DeckModal;
