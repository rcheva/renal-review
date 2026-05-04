import { getAdapterOfType } from "../NoteTypeAdapter";
import { db } from "../db";
import { NoteContent } from "./NoteContent";
import { NoteType } from "./note";

export async function updateNoteContent<T extends NoteType>(
  noteId: string,
  content: NoteContent<T>,
  sourceReference?: string,
  tags?: string[]
) {
  const updateObj: any = {
    content,
    sortField: getAdapterOfType(content.type).getSortFieldFromNoteContent(
      content
    ),
  };
  if (sourceReference !== undefined) {
    updateObj.sourceReference = sourceReference;
  }
  if (tags !== undefined) {
    updateObj.tags = tags;
  }
  return db.notes.update(noteId, updateObj);
}
