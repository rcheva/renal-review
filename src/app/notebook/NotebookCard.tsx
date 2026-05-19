import { IconButton } from "@/components/ui/IconButton";
import { Paper } from "@/components/ui/Paper";
import { useDisclosure } from "@/lib/hooks/useDisclosure";
import { getAdapter } from "@/logic/NoteTypeAdapter";
import { NoteType } from "@/logic/note/note";
import { Note } from "@/logic/note/note";
import { Draggable } from "@hello-pangea/dnd";
import { IconDots, IconCircleCheckFilled, IconCircle } from "@tabler/icons-react";
import { memo, useState } from "react";
import NoteMenu from "../editor/NoteMenu";

interface NotebookCardProps {
  index: number;
  note: Note<NoteType>;
  useCustomSort: boolean;
  showAnswer: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

function NotebookCard({
  note,
  index,
  useCustomSort,
  showAnswer,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: NotebookCardProps) {
  return useCustomSort ? (
    <Draggable key={note.id} index={index} draggableId={note.id}>
      {(provided, snapshot) => (
        <div
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          ref={provided.innerRef}
          className={`notebook__card-wrapper ${
            snapshot.isDragging ? "notebook__card-wrapper--dragging" : ""
          }`}
        >
          <InnerCard note={note} showAnswer={showAnswer} selectionMode={selectionMode} isSelected={isSelected} onToggleSelect={onToggleSelect} />
        </div>
      )}
    </Draggable>
  ) : (
    <div className="notebook__card-wrapper">
      <InnerCard note={note} showAnswer={showAnswer} selectionMode={selectionMode} isSelected={isSelected} onToggleSelect={onToggleSelect} />
    </div>
  );
}
export default memo(NotebookCard);

const InnerCard = memo(
  ({ note, showAnswer, selectionMode, isSelected, onToggleSelect }: { note: Note<NoteType>; showAnswer: boolean; selectionMode?: boolean; isSelected?: boolean; onToggleSelect?: () => void }) => {
    const [answerToggled, handlers] = useDisclosure(false);
    const [hasHovered, setHasHovered] = useState(false);

    return (
      <Paper
        onClick={selectionMode ? onToggleSelect : handlers.toggle}
        withBorder
        style={{
          position: "relative",
          padding: 0,
          cursor: "pointer",
          borderColor: isSelected ? "var(--theme-primary)" : undefined,
          borderWidth: isSelected ? 2 : 1,
        }}
      >
        {getAdapter(note).displayNote(
          note,
          showAnswer ? "strict" : answerToggled ? "optional" : "none"
        )}
        {selectionMode && (
          <div style={{ position: "absolute", top: "var(--spacing-sm)", left: "var(--spacing-sm)", color: isSelected ? "var(--theme-primary)" : "var(--theme-neutral-300)" }}>
            {isSelected ? <IconCircleCheckFilled /> : <IconCircle />}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: "var(--spacing-sm)",
            right: "var(--spacing-sm)",
          }}
        >
          {hasHovered ? (
            <NoteMenu note={note} withShortcuts={false} />
          ) : (
            <IconButton
              variant="subtle"
              aria-label="Menu"
              onMouseEnter={() => setHasHovered(true)}
              onClick={(e) => {
                e.stopPropagation();
                setHasHovered(true);
              }}
            >
              <IconDots />
            </IconButton>
          )}
        </div>
      </Paper>
    );
  }
);
