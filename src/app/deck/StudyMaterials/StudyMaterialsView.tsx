import { Button, Paper, Text } from "@/components/ui";
import { db } from "@/logic/db";
import { Deck, StudyMaterial } from "@/logic/deck/deck";
import {
  IconFileDescription,
  IconFileText,
  IconHeadphones,
  IconPresentation,
  IconTable,
  IconTrash,
  IconVideo,
  IconPlus
} from "@tabler/icons-react";
import { useState } from "react";
import AddMaterialModal from "./AddMaterialModal";
import MaterialViewer from "./MaterialViewer";
import LLMDownloadButton from "./LLMDownloadButton";
import EmptyNotice from "@/components/EmptyNotice";

interface StudyMaterialsViewProps {
  deck: Deck;
}

const getIconForType = (type: string) => {
  switch (type) {
    case "doc": return <IconFileText size={24} color="var(--theme-primary-600)" />;
    case "resume": return <IconFileDescription size={24} color="var(--theme-primary-600)" />;
    case "ppt": return <IconPresentation size={24} color="var(--theme-primary-600)" />;
    case "video": return <IconVideo size={24} color="var(--theme-primary-600)" />;
    case "audio": return <IconHeadphones size={24} color="var(--theme-primary-600)" />;
    case "table": return <IconTable size={24} color="var(--theme-primary-600)" />;
    default: return <IconFileText size={24} color="var(--theme-primary-600)" />;
  }
};

export default function StudyMaterialsView({ deck }: StudyMaterialsViewProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);

  const materials = deck.studyMaterials || [];

  const handleDelete = async (e: React.MouseEvent, materialId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this material?")) return;

    const newMaterials = materials.filter(m => m.id !== materialId);
    await db.decks.update(deck.id, {
      studyMaterials: newMaterials
    });
  };

  return (
    <div style={{ padding: "var(--spacing-xl) 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-lg)" }}>
        <Text size="lg" weight="semibold">Study Materials & Guides</Text>
        <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
          <LLMDownloadButton deck={deck} />
          <Button leftSection={<IconPlus size={16} />} onClick={() => setAddModalOpen(true)}>
            Add Material
          </Button>
        </div>
      </div>

      {materials.length === 0 ? (
        <EmptyNotice 
          icon={IconFileDescription} 
          description="No study materials added yet. Export from NotebookLM and paste them here!" 
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--spacing-md)" }}>
          {materials.map(material => (
            <Paper 
              key={material.id} 
              withBorder 
              style={{ padding: "var(--spacing-md)", cursor: "pointer", display: "flex", alignItems: "center", gap: "var(--spacing-md)", transition: "transform 0.2s" }}
              onClick={() => setSelectedMaterial(material)}
            >
              {getIconForType(material.type)}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <Text weight="medium" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {material.title}
                </Text>
                <Text size="xs" variant="dimmed" style={{ textTransform: "capitalize", marginTop: "2px" }}>
                  {material.type}
                </Text>
              </div>
              <div 
                onClick={(e) => handleDelete(e, material.id)} 
                style={{ padding: "8px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
              >
                <IconTrash size={18} color="#ef4444" />
              </div>
            </Paper>
          ))}
        </div>
      )}

      <AddMaterialModal deck={deck} opened={addModalOpen} onClose={() => setAddModalOpen(false)} />
      <MaterialViewer material={selectedMaterial} onClose={() => setSelectedMaterial(null)} />
    </div>
  );
}
