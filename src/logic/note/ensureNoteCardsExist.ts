import { db } from "../db";
import { Deck } from "../deck/deck";
import { NoteType } from "../note/note";
import { createCardSkeleton } from "../card/createCardSkeleton";
import { newCard } from "../card/newCard";

export async function ensureNoteCardsExist(deck: Deck) {
  if (!deck || !deck.notes || deck.notes.length === 0) return;

  const existingCards = await db.cards.bulkGet(deck.cards || []);
  const cardNoteIds = new Set(existingCards.filter(Boolean).map((c) => c!.note));

  const notesToFix: string[] = [];
  for (const noteId of deck.notes) {
    if (!cardNoteIds.has(noteId)) {
      notesToFix.push(noteId);
    }
  }

  if (notesToFix.length > 0) {
    for (const noteId of notesToFix) {
      const note = await db.notes.get(noteId);
      if (note) {
        await newCard(
          {
            ...createCardSkeleton(),
            note: noteId,
            content: { type: note.content?.type || NoteType.Basic },
          },
          deck
        );
      }
    }
  }
}
