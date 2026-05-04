import React, { useState, useEffect } from "react";
import { supabase } from "@/logic/supabase";
import { Poll } from "./types";
import { Button, Paper, Modal, TextInput } from "@/components/ui";
import { AppHeaderContent } from "../shell/Header/Header";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useNavigate } from "react-router-dom";
import { IconPlus, IconChartBar, IconTrash } from "@tabler/icons-react";

export default function PollingDashboard() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPollTitle, setNewPollTitle] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("polls")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching polls:", error);
    } else {
      setPolls(data as Poll[]);
    }
    setLoading(false);
  };

  const handleCreatePoll = async () => {
    if (!newPollTitle.trim()) return;

    const { data, error } = await supabase
      .from("polls")
      .insert([{ title: newPollTitle }])
      .select()
      .single();

    if (error) {
      console.error("Error creating poll:", error);
      return;
    }

    setNewPollTitle("");
    setIsCreateModalOpen(false);
    navigate(`/polling/edit/${data.id}`);
  };

  const handleDeletePoll = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this poll?")) return;

    await supabase.from("polls").delete().eq("id", id);
    fetchPolls();
  };

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs segments={[{ label: "Live Polling" }]} />
      </AppHeaderContent>

      <div
        style={{
          width: "100%",
          maxWidth: "var(--max-content-width)",
          margin: "0 auto",
          padding: "20px 0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "var(--font-serif)" }}>Live Polling Dashboard</h1>
          <Button onClick={() => setIsCreateModalOpen(true)} leftSection={<IconPlus size={16} />}>
            New Poll
          </Button>
        </div>

        {loading ? (
          <p>Loading polls...</p>
        ) : polls.length === 0 ? (
          <Paper withBorder style={{ padding: "2rem", textAlign: "center", color: "var(--theme-neutral-500)" }}>
            <p>No polls created yet. Create your first poll to engage your students!</p>
          </Paper>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {polls.map((poll) => (
              <Paper key={poll.id} withBorder style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>{poll.title}</h3>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.875rem", color: "var(--theme-neutral-500)" }}>
                    <span>Status: <strong style={{ color: poll.status === "active" ? "var(--theme-green-600)" : "inherit" }}>{poll.status.toUpperCase()}</strong></span>
                    <span>Created: {new Date(poll.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button variant="subtle" onClick={() => navigate(`/polling/edit/${poll.id}`)}>
                    Edit
                  </Button>
                  <Button variant="default" onClick={() => navigate(`/polling/live/${poll.id}`)} leftSection={<IconChartBar size={16} />}>
                    Live View
                  </Button>
                  <Button variant="subtle" onClick={() => handleDeletePoll(poll.id)} style={{ color: "var(--theme-red-600)" }}>
                    <IconTrash size={16} />
                  </Button>
                </div>
              </Paper>
            ))}
          </div>
        )}

        <Modal
          opened={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Poll"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <TextInput
              label="Poll Title"
              placeholder="e.g. Acute Kidney Injury Basics"
              value={newPollTitle}
              onChange={(e) => setNewPollTitle(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="subtle" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreatePoll} disabled={!newPollTitle.trim()}>Create</Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
