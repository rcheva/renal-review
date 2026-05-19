import { Kbd } from "@/components/ui/Kbd";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { Select, SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextInput } from "@/components/ui/TextInput";
import { Tooltip } from "@/components/ui/Tooltip";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import { useListState } from "@/lib/hooks/useListState";
import { db } from "@/logic/db";
import { useDeckFromUrl } from "@/logic/deck/hooks/useDeckFromUrl";
import { useNotesOf } from "@/logic/note/hooks/useNotesOf";
import { NoteType } from "@/logic/note/note";
import { Note } from "@/logic/note/note";
import { NoteSortFunction, NoteSorts } from "@/logic/note/sort";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import {
  IconCalendar,
  IconMenuOrder,
  IconTextCaption,
  IconChartBar,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/logic/supabase";
import { convert } from "html-to-text";
import NotebookCard from "./NotebookCard";
import "./NotebookView.css";

const BASE = "notebook";
const NOTEBOOK_LIMIT = 1000;

export default function NotebookView() {
  const [deck] = useDeckFromUrl();
  const navigate = useNavigate();

  const [excludeSubDecks, setExcludeSubDecks] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const [notes] = useNotesOf(deck, excludeSubDecks, NOTEBOOK_LIMIT);

  const [sortOption, setSortOption] = useState<SortOption>(sortOptions[0]);
  const [sortOrder] = useState<1 | -1>(1);
  const [sortedNotes, setSortedNotes] = useState<Note<NoteType>[]>(notes ?? []);

  const [useCustomSort, setUseCustomSort] = useState(false);
  const [customOrderTouched, setCustomOrderTouched] = useState(false);
  const [state, handlers] = useListState(sortedNotes ?? []);

  // Polling Selection State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [isCompileModalOpen, setIsCompileModalOpen] = useState(false);
  const [pollTitle, setPollTitle] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);

  useEffect(() => {
    if (useCustomSort && !customOrderTouched) {
      handlers.setState(sortedNotes ?? []);
    }
  }, [sortedNotes]);

  useEffect(() => {
    setUseCustomSort(sortOption.value === "custom_order");
    setSortedNotes(
      (notes ?? []).slice(0).sort(sortOption.sortFunction(sortOrder))
    );
  }, [notes, sortOption, sortOrder, setSortedNotes]);

  const toggleNoteSelection = (noteId: string) => {
    const newSelected = new Set(selectedNoteIds);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedNoteIds(newSelected);
  };

  const handleCompilePoll = async () => {
    if (!pollTitle.trim() || selectedNoteIds.size === 0) return;
    setIsCompiling(true);

    const { data: pollData, error: pollError } = await supabase
      .from("polls")
      .insert([{ title: pollTitle }])
      .select()
      .single();

    if (pollError || !pollData) {
      console.error("Error creating poll:", pollError);
      setIsCompiling(false);
      return;
    }

    const selectedNotesArray = sortedNotes.filter(n => selectedNoteIds.has(n.id));
    const allSelectedAnswers = selectedNotesArray.map(n => convert((n.content as any).back || ""));

    const questionsToInsert = selectedNotesArray.map((note) => {
      const qText = convert((note.content as any).front || "");
      const correctAns = convert((note.content as any).back || "");
      
      // Get 3 random distractors from other answers
      const distractors = allSelectedAnswers.filter(a => a !== correctAns);
      const shuffledDistractors = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);
      
      const options = [correctAns, ...shuffledDistractors];
      const finalOptions = options.sort(() => 0.5 - Math.random());
      const correctIndex = finalOptions.indexOf(correctAns);

      return {
        poll_id: pollData.id,
        question_text: qText,
        options: finalOptions,
        correct_option_index: correctIndex
      };
    });

    const { error: qError } = await supabase.from("questions").insert(questionsToInsert);
    
    setIsCompiling(false);
    if (!qError) {
      navigate(`/polling/edit/${pollData.id}`);
    } else {
      console.error("Error creating questions:", qError);
    }
  };

  return (
    <div className={BASE}>
      <div className={`${BASE}__toolbar`}>
        <SortSelect sortOption={sortOption} setSortOption={setSortOption} />
        <NotebookMenu
          excludeSubDecks={excludeSubDecks}
          setExcludeSubDecks={setExcludeSubDecks}
          showAnswer={showAnswer}
          setShowAnswer={setShowAnswer}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          selectedCount={selectedNoteIds.size}
        />
      </div>
      {deck?.notes && deck?.notes?.length > NOTEBOOK_LIMIT && (
        <div className={`${BASE}__limit-notice`}>
          Currently there is a limit of {NOTEBOOK_LIMIT} notes displayed.{" "}
          {deck.notes.length - NOTEBOOK_LIMIT} notes have been omitted.
        </div>
      )}
      {useCustomSort ? (
        <DragDropContext
          onDragEnd={({ destination, source }) => {
            if (!destination) return;

            const newState = [...state];
            const [removed] = newState.splice(source.index, 1);
            newState.splice(destination.index, 0, removed);

            handlers.reorder({
              from: source.index,
              to: destination.index,
            });
            setCustomOrderTouched(true);

            db.notes.bulkUpdate(
              newState.map((note, index) => ({
                key: note.id,
                changes: { customOrder: index },
              }))
            );
          }}
        >
          <Droppable droppableId="notebook" direction="vertical">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`${BASE}__list`}
              >
                {state.map((card, index) => (
                  <NotebookCard
                    key={card.id}
                    note={card}
                    index={index}
                    useCustomSort={true}
                    showAnswer={showAnswer}
                    selectionMode={selectionMode}
                    isSelected={selectedNoteIds.has(card.id)}
                    onToggleSelect={() => toggleNoteSelection(card.id)}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className={`${BASE}__list`}>
          {sortedNotes.map((note, index) => (
            <NotebookCard
              key={note.id}
              note={note}
              index={index}
              useCustomSort={false}
              showAnswer={showAnswer}
              selectionMode={selectionMode}
              isSelected={selectedNoteIds.has(note.id)}
              onToggleSelect={() => toggleNoteSelection(note.id)}
            />
          ))}
        </div>
      )}

      {selectionMode && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "1rem", backgroundColor: "var(--theme-surface)", borderTop: "1px solid var(--theme-border)", display: "flex", justifyContent: "center", gap: "1rem", zIndex: 100, boxShadow: "0 -4px 12px rgba(0,0,0,0.05)" }}>
          <Button variant="subtle" onClick={() => { setSelectionMode(false); setSelectedNoteIds(new Set()); }}>
            Cancel
          </Button>
          <Button onClick={() => setIsCompileModalOpen(true)} disabled={selectedNoteIds.size === 0}>
            Compile to Live Poll ({selectedNoteIds.size})
          </Button>
        </div>
      )}

      <Modal
        opened={isCompileModalOpen}
        onClose={() => setIsCompileModalOpen(false)}
        title="Compile Live Poll"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <TextInput
            label="Poll Title"
            placeholder="e.g. End of Chapter Review"
            value={pollTitle}
            onChange={(e) => setPollTitle(e.target.value)}
            autoFocus
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <Button variant="subtle" onClick={() => setIsCompileModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCompilePoll} disabled={!pollTitle.trim() || isCompiling}>Compile</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface SortOption {
  value: string;
  icon: React.ComponentType<any>;
  label: string;
  sortFunction: NoteSortFunction;
}

const sortOptions: SortOption[] = [
  {
    value: "custom_order",
    icon: IconMenuOrder,
    label: "Custom",
    sortFunction: NoteSorts.byCustomOrder,
  },
  {
    value: "sort_field",
    icon: IconTextCaption,
    label: "By Sort Field",
    sortFunction: NoteSorts.bySortField,
  },
  {
    value: "creation_date",
    icon: IconCalendar,
    label: "By Creation Date",
    sortFunction: NoteSorts.byCreationDate,
  },
];

function SortSelect({
  sortOption,
  setSortOption,
}: {
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
}) {
  const selectOptions: SelectOption<string>[] = sortOptions.map((s) => ({
    value: s.value,
    label: s.label,
    icon: s.icon,
  }));

  return (
    <Select
      value={sortOption.value}
      onChange={(value) => {
        const option = sortOptions.find((s) => s.value === value);
        if (option) {
          setSortOption(option);
        }
      }}
      options={selectOptions}
    />
  );
}

function NotebookMenu({
  excludeSubDecks,
  setExcludeSubDecks,
  showAnswer,
  setShowAnswer,
  selectionMode,
  setSelectionMode,
  selectedCount,
}: {
  excludeSubDecks: boolean;
  setExcludeSubDecks: (value: boolean) => void;
  showAnswer: boolean;
  setShowAnswer: (value: boolean) => void;
  selectionMode: boolean;
  setSelectionMode: (value: boolean) => void;
  selectedCount: number;
}) {
  const [t] = useTranslation();

  useHotkeys([["-", () => setShowAnswer(!showAnswer)]]);

  return (
    <Menu>
      <MenuItem
        checked={excludeSubDecks}
        onClick={() => {
          setExcludeSubDecks(!excludeSubDecks);
        }}
      >
        {t("notebook.options.exclude-subdecks")}
      </MenuItem>
      <Tooltip
        label={
          <>
            Press <Kbd>-</Kbd> to toggle all answers
          </>
        }
      >
        <MenuItem
          checked={showAnswer}
          onClick={() => {
            setShowAnswer(!showAnswer);
          }}
        >
          {t("notebook.options.show-answer")}
        </MenuItem>
      </Tooltip>
      <MenuItem
        onClick={() => {
          setSelectionMode(!selectionMode);
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <IconChartBar size={16} />
          {selectionMode ? "Cancel Poll Selection" : "Create Live Poll"}
        </div>
      </MenuItem>
    </Menu>
  );
}
