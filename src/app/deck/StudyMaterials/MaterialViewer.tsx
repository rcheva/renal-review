import { Button, Modal, Paper } from "@/components/ui";
import { StudyMaterial } from "@/logic/deck/deck";
import { IconExternalLink, IconPlayerPlay } from "@tabler/icons-react";
import { useNotifications } from "@/components/Notification";
import { open as openShell } from "@tauri-apps/plugin-shell";

interface MaterialViewerProps {
  material: StudyMaterial | null;
  onClose: () => void;
}

export default function MaterialViewer({ material, onClose }: MaterialViewerProps) {
  const { showNotification } = useNotifications();

  if (!material) return null;

  const isLocalFile = material.url?.startsWith("/") || material.url?.startsWith("file://") || material.url?.includes(":\\");

  const handleLaunchDocument = async () => {
    if (!material.url) return;
    try {
      // Attempt to use native Tauri shell to open the file
      await openShell(material.url);
      showNotification({ title: "Launched", message: "Opening document...", type: "info" });
    } catch (err) {
      console.error("Failed to launch document natively", err);
      // Fallback: Copy to clipboard if not running in Tauri
      navigator.clipboard.writeText(material.url);
      showNotification({ title: "Copied Path", message: "Running in web mode. Path copied to clipboard.", type: "info" });
    }
  };

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
          {isLocalFile ? (
            <div style={{ padding: "var(--spacing-xl)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "var(--spacing-md)" }}>
              <p>This is a local file stored on your computer or OneDrive.</p>
              <p style={{ wordBreak: "break-all", background: "var(--theme-neutral-100)", padding: "var(--spacing-sm)", borderRadius: "var(--radius-md)" }}>
                {material.url}
              </p>
              <Button leftSection={<IconPlayerPlay size={16} />} onClick={handleLaunchDocument} size="lg">
                Launch Document
              </Button>
              <p style={{ fontSize: "12px", color: "var(--theme-neutral-500)", maxWidth: "80%" }}>
                (This will open the file in your default Mac application. If you are not using the Desktop app, it will copy the path instead.)
              </p>
            </div>
          ) : material.type === "video" || material.type === "audio" ? (
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
