import { db } from "../db";

export async function cleanDuplicateDecks() {
  try {
    const allDecks = await db.decks.toArray();
    if (!allDecks || allDecks.length === 0) return;

    // Group decks by lowercase trimmed name + parent signature
    const map = new Map<string, typeof allDecks>();

    for (const deck of allDecks) {
      const parentKey = (deck.superDecks || []).sort().join(",");
      const key = `${deck.name.trim().toLowerCase()}__${parentKey}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(deck);
    }

    const deckIdsToDelete: string[] = [];

    const groups = Array.from(map.values());
    for (const group of groups) {
      if (group.length > 1) {
        // Keep the deck that has cards or notes, or the first one
        const sorted = [...group].sort((a, b) => {
          const aCount = (a.cards?.length || 0) + (a.notes?.length || 0) + (a.subDecks?.length || 0);
          const bCount = (b.cards?.length || 0) + (b.notes?.length || 0) + (b.subDecks?.length || 0);
          return bCount - aCount;
        });

        const primaryDeck = sorted[0];
        const duplicateDecks = sorted.slice(1);

        for (const dup of duplicateDecks) {
          deckIdsToDelete.push(dup.id);

          // 1. Move subdecks pointing to dup.id -> primaryDeck.id
          const subDecks = await db.decks
            .filter((d) => Array.isArray(d.superDecks) && d.superDecks.includes(dup.id))
            .toArray();

          for (const sub of subDecks) {
            const currentSuper = sub.superDecks || [];
            const updatedSuperDecks = Array.from(
              new Set(currentSuper.map((id) => (id === dup.id ? primaryDeck.id : id)))
            );
            await db.decks.update(sub.id, { superDecks: updatedSuperDecks });
          }

          // 2. Move cards pointing to dup.id -> primaryDeck.id
          const cards = await db.cards.where("deck").equals(dup.id).toArray();
          for (const card of cards) {
            await db.cards.update(card.id, { deck: primaryDeck.id });
          }

          // 3. Move notes pointing to dup.id -> primaryDeck.id
          const notes = await db.notes.where("deck").equals(dup.id).toArray();
          for (const note of notes) {
            await db.notes.update(note.id, { deck: primaryDeck.id });
          }
        }
      }
    }

    if (deckIdsToDelete.length > 0) {
      console.log(`Cleaning up ${deckIdsToDelete.length} duplicate decks...`);
      await db.decks.bulkDelete(deckIdsToDelete);
    }
  } catch (err) {
    console.error("Error in cleanDuplicateDecks:", err);
  }
}
