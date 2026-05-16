import { Button, Modal, Select, Stack, Text } from "@/components/ui";
import { db } from "@/logic/db";
import { Deck, StudyMaterial } from "@/logic/deck/deck";
import { IconCloudDownload } from "@tabler/icons-react";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useNotifications } from "@/components/Notification";

interface LLMDownloadButtonProps {
  deck: Deck;
}

interface Notebook {
  id: string;
  name?: string;
  title?: string;
}

export default function LLMDownloadButton({ deck }: LLMDownloadButtonProps) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string>("");
  const { showNotification } = useNotifications();

  const fetchNotebooks = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/notebooks");
      if (!res.ok) throw new Error("Failed to connect to MCP Proxy. Make sure it is running.");
      const data = await res.json();
      setNotebooks(data.notebooks || []);
      if (data.notebooks && data.notebooks.length > 0) {
         setSelectedNotebook(data.notebooks[0].id);
      }
    } catch (err: any) {
      showNotification({ title: "Error", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpened(true);
    fetchNotebooks();
  };

  const handleDownload = async () => {
    if (!selectedNotebook) return;
    setLoading(true);
    showNotification({ title: "Downloading...", message: "Fetching study guide from NotebookLM...", type: "info" });
    
    try {
      const res = await fetch("http://localhost:3001/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebook_id: selectedNotebook,
          query: "Please provide a comprehensive study guide and summary for this notebook."
        })
      });

      if (!res.ok) throw new Error("Failed to fetch study guide.");
      const data = await res.json();

      const nb = notebooks.find(n => n.id === selectedNotebook);
      const titleName = nb?.title || nb?.name || "NotebookLM Guide";

      const newMaterial: StudyMaterial = {
        id: uuidv4(),
        title: `${titleName} (Imported)`,
        type: "doc",
        content: data.answer || "No content returned.",
        createdAt: new Date(),
      };

      const currentMaterials = deck.studyMaterials || [];
      await db.decks.update(deck.id, {
        studyMaterials: [...currentMaterials, newMaterial]
      });

      showNotification({ title: "Success", message: "Study guide imported successfully!", type: "success" });
      setOpened(false);
    } catch (err: any) {
      showNotification({ title: "Error", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="subtle" 
        leftSection={<IconCloudDownload size={16} />} 
        onClick={handleOpen}
      >
        Download from LLM
      </Button>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Import from NotebookLM">
        <Stack gap="md">
          <Text size="sm" variant="dimmed">
            Select a notebook to automatically generate and import a comprehensive study guide into this deck.
          </Text>

          {notebooks.length === 0 && !loading && (
            <Text size="sm" style={{ color: "var(--theme-red-500, red)" }}>
              No notebooks found. Please ensure NotebookLM MCP is running and authenticated.
            </Text>
          )}

          {notebooks.length > 0 && (
            <Select
              label="Select Notebook"
              options={notebooks.map(n => ({ value: n.id, label: n.title || n.name || n.id }))}
              value={selectedNotebook}
              onChange={(val) => setSelectedNotebook(val as string)}
            />
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--spacing-md)", marginTop: "var(--spacing-md)" }}>
            <Button variant="subtle" onClick={() => setOpened(false)}>Cancel</Button>
            <Button onClick={handleDownload} disabled={loading || !selectedNotebook}>
              {loading ? "Processing..." : "Import Study Guide"}
            </Button>
          </div>
        </Stack>
      </Modal>
    </>
  );
}
