import { Button, Modal, Paper } from "@/components/ui";
import { StudyMaterial } from "@/logic/deck/deck";
import { IconExternalLink } from "@tabler/icons-react";

interface MaterialViewerProps {
  material: StudyMaterial | null;
  onClose: () => void;
}

export default function MaterialViewer({ material, onClose }: MaterialViewerProps) {
  if (!material) return null;

  return (
    <Modal opened={!!material} onClose={onClose} title={material.title}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)", height: "70vh" }}>
        
        {material.url && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a href={material.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button
                variant="subtle"
                leftSection={<IconExternalLink size={16} />}
                size="sm"
              >
                Open in new tab
              </Button>
            </a>
          </div>
        )}

        <Paper withBorder style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {material.type === "video" || material.type === "audio" ? (
            <iframe
              src={material.url}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : material.type === "ppt" || material.type === "doc" || material.type === "resume" ? (
            material.url ? (
               <iframe
                  src={material.url}
                  style={{ width: "100%", height: "100%", border: "none" }}
               />
            ) : (
              <div style={{ padding: "var(--spacing-md)", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                {material.content}
              </div>
            )
          ) : (
             <div style={{ padding: "var(--spacing-md)", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                {material.content || material.url || "No content available."}
             </div>
          )}
        </Paper>
      </div>
    </Modal>
  );
}
