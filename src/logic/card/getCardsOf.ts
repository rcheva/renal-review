import { db } from "../db";
import { Deck } from "../deck/deck";
import { NoteType } from "../note/note";
import { Card } from "./card";

export async function getCardsOf(
  deck?: Deck,
  excludeSubDecks?: boolean,
  ignoreTags?: string[]
): Promise<Card<NoteType>[] | undefined> {
  if (!deck) return undefined;
  let cards: Card<NoteType>[] = (await db.cards.bulkGet(deck.cards)).filter(
    (c) => c !== undefined
  );
  if (excludeSubDecks) {
    return cards;
  }
  await Promise.all(
    deck.subDecks.map((subDeckID) =>
      db.decks
        .get(subDeckID)
        .then((subDeck) => {
          if (subDeck) {
            return getCardsOf(subDeck, false, ignoreTags);
          }
        })
        .then((c) => {
          if (c) {
            cards = cards.concat(c);
          }
        })
    )
  );
  if (ignoreTags && ignoreTags.length > 0) {
    const noteIds = cards.map(c => c.note);
    const notes = await db.notes.bulkGet(noteIds);
    cards = cards.filter((c, i) => {
      const note = notes[i];
      if (!note || !note.tags) return true;
      return !note.tags.some(t => ignoreTags.includes(t.toLowerCase().trim()));
    });
  }

  return cards;
}
