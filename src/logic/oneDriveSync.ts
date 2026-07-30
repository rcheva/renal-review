import { isTauri } from "@/lib/isTauri";
import { db } from "@/logic/db";
import { Deck } from "@/logic/deck/deck";

export const ONEDRIVE_ROOT =
  "/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review";

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

function sanitizeFolderName(name: string): string {
  return name
    .trim()
    .replace(/[/\\]/g, "_")
    .replace(/[:*?"<>|]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Ensures target path exists in OneDrive folder structure.
 */
export async function ensureOneDriveFolder(
  parentTopic: string,
  subdeckName?: string
): Promise<string> {
  const cleanParent = sanitizeFolderName(parentTopic || "Miscellaneous");
  let targetPath = `${ONEDRIVE_ROOT}/${cleanParent}`;

  if (subdeckName && subdeckName.trim()) {
    const cleanSub = sanitizeFolderName(subdeckName);
    targetPath = `${targetPath}/${cleanSub}`;
  }

  if (isTauri()) {
    try {
      const { mkdir, exists } = await import("@tauri-apps/plugin-fs");
      const isExist = await exists(targetPath);
      if (!isExist) {
        await mkdir(targetPath, { recursive: true });
      }
    } catch (err) {
      console.warn("Tauri mkdir notice/warning:", err);
    }
  }

  return targetPath;
}

/**
 * Saves uploaded or generated flashcards JSON directly to OneDrive subdeck folder.
 */
export async function saveFlashcardsToOneDrive(
  parentTopic: string,
  subdeckName: string,
  cardsJsonData: any,
  originalFileName?: string
): Promise<string> {
  const folderPath = await ensureOneDriveFolder(parentTopic, subdeckName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = originalFileName
    ? originalFileName.endsWith(".json")
      ? originalFileName
      : `${originalFileName}.json`
    : `flashcards_${timestamp}.json`;

  const fullFilePath = `${folderPath}/${fileName}`;

  if (isTauri()) {
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const content =
        typeof cardsJsonData === "string"
          ? cardsJsonData
          : JSON.stringify(cardsJsonData, null, 2);
      await writeTextFile(fullFilePath, content);
      console.log(`Saved flashcards JSON to OneDrive: ${fullFilePath}`);
    } catch (err) {
      console.error("Failed writing flashcards JSON to OneDrive:", err);
    }
  }

  return fullFilePath;
}

/**
 * Saves Study Material file or content to the subdeck OneDrive folder.
 */
export async function saveStudyMaterialToOneDrive(
  parentTopic: string,
  subdeckName: string,
  fileName: string,
  contentOrUrl: string
): Promise<string> {
  const folderPath = await ensureOneDriveFolder(parentTopic, subdeckName);
  const cleanFileName = sanitizeFolderName(fileName);
  const targetFilePath = `${folderPath}/${cleanFileName}`;

  if (isTauri()) {
    try {
      const { writeTextFile, copyFile, exists } = await import(
        "@tauri-apps/plugin-fs"
      );

      // If contentOrUrl is a local filepath that exists, copy it
      const sourceExists = await exists(contentOrUrl).catch(() => false);
      if (sourceExists) {
        await copyFile(contentOrUrl, targetFilePath);
      } else {
        await writeTextFile(targetFilePath, contentOrUrl);
      }
      console.log(`Saved Study Material to OneDrive: ${targetFilePath}`);
    } catch (err) {
      console.error("Failed saving Study Material to OneDrive:", err);
    }
  }

  return targetFilePath;
}

/**
 * Syncs existing top-level topics and subdecks to OneDrive on startup/demand.
 */
export async function syncAllStructureToOneDrive(): Promise<void> {
  try {
    const decks = await db.decks.toArray();
    const deckMap = new Map<string, Deck>();
    decks.forEach((d) => deckMap.set(d.id, d as Deck));

    // 1. Ensure all 12 top-level Renal Topic folders exist
    for (const topic of RENAL_TOPICS) {
      await ensureOneDriveFolder(topic);
    }

    // 2. Ensure subdecks exist inside their parent topic folder
    for (const deck of decks) {
      if (deck.superDecks && deck.superDecks.length > 0) {
        const parentId = deck.superDecks[deck.superDecks.length - 1];
        const parentDeck = deckMap.get(parentId);
        const parentName = parentDeck ? parentDeck.name : "Miscellaneous";
        await ensureOneDriveFolder(parentName, deck.name);
      }
    }
  } catch (err) {
    console.error("OneDrive initial structure sync error:", err);
  }
}
