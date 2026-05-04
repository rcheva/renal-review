import { Stack } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";
import { EditMode } from "@/logic/NoteTypeAdapter";
import { Deck } from "@/logic/deck/deck";
import { Note, NoteType } from "@/logic/note/note";
import { BasicNoteTypeAdapter } from "@/logic/type-implementations/normal/BasicNote";
import { t } from "i18next";
import { useCallback, useEffect, useRef } from "react";
import "./NormalCardEditor.css";
import NoteEditor, { useNoteEditor } from "./NoteEditor";
import { useAutoSave, useClearEditors, useNoteCreation } from "./hooks";

const BASE = "normal-card-editor";

interface NormalCardEditorProps {
  note: Note<NoteType.Basic> | null;
  deck: Deck;
  mode: EditMode;
  requestedFinish?: boolean;
  setRequestedFinish?: (finish: boolean) => void;
  focusSelectNoteType?: () => void;
}

function NormalCardEditor({
  note,
  deck,
  mode,
  requestedFinish,
  setRequestedFinish,
  focusSelectNoteType,
}: NormalCardEditorProps) {
  const noteContent = note?.content ?? {
    type: NoteType.Basic,
    front: "",
    back: "",
  };

  const frontContentRef = useRef(noteContent.front);
  const backContentRef = useRef(noteContent.back);
  const sourceRefContentRef = useRef(note?.sourceReference ?? "");
  const tagsRef = useRef(note?.tags?.join(", ") ?? "");

  useEffect(() => {
    frontContentRef.current = noteContent.front;
    backContentRef.current = noteContent.back;
    sourceRefContentRef.current = note?.sourceReference ?? "";
    tagsRef.current = note?.tags?.join(", ") ?? "";
  }, [noteContent.front, noteContent.back, note?.sourceReference, note?.tags]);

  const getContent = useCallback(
    () => ({
      front: frontContentRef.current,
      back: backContentRef.current,
      sourceReference: sourceRefContentRef.current,
      tags: tagsRef.current ? tagsRef.current.split(",").map(t => t.trim()).filter(Boolean) : [],
    }),
    []
  );

  const debouncedAutoSave = useAutoSave(
    mode,
    note,
    getContent,
    BasicNoteTypeAdapter.updateNote
  );

  const handleFrontUpdate = useCallback(
    ({ editor }: { editor: any }) => {
      frontContentRef.current = editor.getHTML();
      debouncedAutoSave();
    },
    [debouncedAutoSave]
  );

  const handleBackUpdate = useCallback(
    ({ editor }: { editor: any }) => {
      backContentRef.current = editor.getHTML();
      debouncedAutoSave();
    },
    [debouncedAutoSave]
  );

  const frontEditor = useNoteEditor({
    content: noteContent.front,
    onUpdate: handleFrontUpdate,
    focusSelectNoteType,
  });

  const backEditor = useNoteEditor({
    content: noteContent.back,
    onUpdate: handleBackUpdate,
    focusSelectNoteType,
  });

  const clear = useClearEditors(frontEditor, backEditor);

  useNoteCreation(
    mode,
    deck,
    getContent,
    BasicNoteTypeAdapter.createNote,
    clear,
    requestedFinish,
    setRequestedFinish
  );

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Text size="sm" weight="semibold">
          {t("note.edit.type-specific.normal.front")}
        </Text>
        <NoteEditor
          editor={frontEditor}
          key="editor-1"
          className={`${BASE}__front`}
        />
      </Stack>
      <Stack gap="xs">
        <Text size="sm" weight="semibold">
          {t("note.edit.type-specific.normal.back")}
        </Text>
        <NoteEditor editor={backEditor} key="editor-2" />
      </Stack>
      <Stack gap="xs">
        <Text size="sm" weight="semibold">
          Source Reference (e.g. Zotero link)
        </Text>
        <input 
          type="text" 
          defaultValue={sourceRefContentRef.current}
          onChange={(e) => {
            sourceRefContentRef.current = e.target.value;
            debouncedAutoSave();
          }}
          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--background-color)" }}
        />
      </Stack>
      <Stack gap="xs">
        <Text size="sm" weight="semibold">
          Tags (comma separated, e.g. Student, Consultant)
        </Text>
        <input 
          type="text" 
          defaultValue={tagsRef.current}
          onChange={(e) => {
            tagsRef.current = e.target.value;
            debouncedAutoSave();
          }}
          placeholder="e.g. CKD, Student, Hard"
          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--background-color)" }}
        />
      </Stack>
    </Stack>
  );
}

export default NormalCardEditor;
