import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { Button, Modal, Paper, TextInput } from "@/components/ui";
import { supabase } from "@/logic/supabase";
import {
  IconChartBar,
  IconPlus,
  IconTrash,
  IconTrophy,
  IconReportAnalytics,
  IconFolderPlus,
  IconFilter,
} from "@tabler/icons-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeaderContent } from "../shell/Header/Header";
import { Poll, PollGroup } from "./types";
import { v4 as uuidv4 } from "uuid";
import { getPollGroups, addPollGroup } from "./pollingStore";

export default function PollingDashboard() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [groups, setGroups] = useState<PollGroup[]>([]);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  // Poll creation modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPollTitle, setNewPollTitle] = useState("");
  const [newPollGroup, setNewPollGroup] = useState("Renal");

  // New Group modal state
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
    fetchPolls();
  }, []);

  const fetchGroups = async () => {
    const gList = await getPollGroups();
    setGroups(gList);
  };

  const fetchPolls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("polls")
        .select("*, questions(count)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching polls from Supabase:", error);
        // Fallback local storage check if offline
        const localStr = localStorage.getItem("renal_review_polls");
        if (localStr) setPolls(JSON.parse(localStr));
      } else {
        setPolls(data as any[]);
      }
    } catch (e) {
      console.warn("Could not fetch polls, using local storage fallback", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!newPollTitle.trim()) return;

    const payload = {
      title: newPollTitle.trim(),
      group_name: newPollGroup,
      status: "active",
    };

    let pollId = "";

    try {
      const insertPromise = supabase
        .from("polls")
        .insert([payload])
        .select()
        .single();

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: new Error("Supabase create timeout") }),
          2500
        )
      );

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (!error && data) {
        pollId = data.id;
      }
    } catch (e) {
      console.warn("Could not save poll to Supabase, saving locally", e);
    }

    if (!pollId) {
      pollId = uuidv4();
      const localPollsStr = localStorage.getItem("renal_review_polls");
      const localPolls = localPollsStr ? JSON.parse(localPollsStr) : [];
      const createdPoll = {
        ...payload,
        id: pollId,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(
        "renal_review_polls",
        JSON.stringify([createdPoll, ...localPolls])
      );
    }

    setNewPollTitle("");
    setIsCreateModalOpen(false);
    navigate(`/polling/edit/${pollId}`);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await addPollGroup(newGroupName, newGroupDesc);
    setNewGroupName("");
    setNewGroupDesc("");
    setIsNewGroupModalOpen(false);
    fetchGroups();
  };

  const handleDeletePoll = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this poll?")) return;

    try {
      await supabase.from("polls").delete().eq("id", id);
    } catch (e) {
      console.warn("Error deleting poll from Supabase", e);
    }

    // Delete locally if present
    const localPollsStr = localStorage.getItem("renal_review_polls");
    if (localPollsStr) {
      const filtered = JSON.parse(localPollsStr).filter(
        (p: Poll) => p.id !== id
      );
      localStorage.setItem("renal_review_polls", JSON.stringify(filtered));
    }

    fetchPolls();
  };

  const filteredPolls =
    activeGroupFilter === "All"
      ? polls
      : polls.filter(
          (p) =>
            (p.group_name || "Renal").toLowerCase() ===
            activeGroupFilter.toLowerCase()
        );

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
        {/* Top Action Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>
              Live Polling Dashboard
            </h1>
            <p
              style={{
                color: "var(--theme-neutral-600)",
                margin: "4px 0 0 0",
                fontSize: "0.9rem",
              }}
            >
              Interactive medical board review polls with student performance tracking.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button
              variant="default"
              onClick={() => navigate("/polling/leaderboard")}
              leftSection={<IconTrophy size={18} color="#eab308" />}
            >
              Leaderboard
            </Button>
            <Button
              variant="default"
              onClick={() => navigate("/polling/reports")}
              leftSection={<IconReportAnalytics size={18} color="#2563eb" />}
            >
              Rotation Reports
            </Button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              leftSection={<IconPlus size={18} />}
            >
              New Poll
            </Button>
          </div>
        </div>

        {/* Poll Group Filter Tabs & Add Group button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--color-border, #e5e7eb)",
            paddingBottom: "8px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <IconFilter size={16} color="var(--color-text-muted, #6b7280)" />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
              Group Filter:
            </span>
            <button
              onClick={() => setActiveGroupFilter("All")}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "none",
                background: activeGroupFilter === "All" ? "var(--color-primary, #2563eb)" : "transparent",
                color: activeGroupFilter === "All" ? "white" : "var(--color-text-main)",
                fontWeight: activeGroupFilter === "All" ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              All Groups ({polls.length})
            </button>
            {groups.map((g) => {
              const count = polls.filter(
                (p) => (p.group_name || "Renal").toLowerCase() === g.name.toLowerCase()
              ).length;
              const isSelected = activeGroupFilter.toLowerCase() === g.name.toLowerCase();
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupFilter(g.name)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    border: "none",
                    background: isSelected ? "var(--color-primary, #2563eb)" : "transparent",
                    color: isSelected ? "white" : "var(--color-text-main)",
                    fontWeight: isSelected ? 600 : 400,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  {g.name} ({count})
                </button>
              );
            })}
          </div>

          <Button
            variant="subtle"
            size="xs"
            onClick={() => setIsNewGroupModalOpen(true)}
            leftSection={<IconFolderPlus size={14} />}
          >
            Add New Group
          </Button>
        </div>

        {/* Poll List */}
        {loading ? (
          <p>Loading polls...</p>
        ) : filteredPolls.length === 0 ? (
          <Paper
            withBorder
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "var(--theme-neutral-500)",
            }}
          >
            <p>
              No polls found for <strong>{activeGroupFilter}</strong>. Create a poll to get started!
            </p>
          </Paper>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filteredPolls.map((poll) => (
              <Paper
                key={poll.id}
                withBorder
                style={{
                  padding: "1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.25rem" }}>{poll.title}</h3>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: "rgba(37, 99, 235, 0.1)",
                        color: "#2563eb",
                        fontWeight: 600,
                      }}
                    >
                      {poll.group_name || "Renal"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      fontSize: "0.875rem",
                      color: "var(--theme-neutral-500)",
                    }}
                  >
                    <span>
                      Status:{" "}
                      <strong
                        style={{
                          color:
                            poll.status === "active"
                              ? "var(--theme-primary-600)"
                              : "inherit",
                        }}
                      >
                        {poll.status.toUpperCase()}
                      </strong>
                    </span>
                    <span>
                      Created: {new Date(poll.created_at).toLocaleDateString()}
                    </span>
                    <span>
                      Questions: {(poll as any).questions?.[0]?.count || 0}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button
                    variant="subtle"
                    onClick={() => navigate(`/polling/edit/${poll.id}`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => navigate(`/polling/live/${poll.id}`)}
                    leftSection={<IconChartBar size={16} />}
                  >
                    Live View
                  </Button>
                  <Button
                    variant="subtle"
                    onClick={() => handleDeletePoll(poll.id)}
                    style={{ color: "var(--theme-red-600)" }}
                  >
                    <IconTrash size={16} />
                  </Button>
                </div>
              </Paper>
            ))}
          </div>
        )}

        {/* Create Poll Modal */}
        <Modal
          opened={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Poll"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <TextInput
              label="Poll Title"
              placeholder="e.g. Acute Kidney Injury & Electrolyte Review"
              value={newPollTitle}
              onChange={(e) => setNewPollTitle(e.target.value)}
              autoFocus
            />

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Target Group / Category
              </label>
              <select
                value={newPollGroup}
                onChange={(e) => setNewPollGroup(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #d1d5db)",
                  background: "var(--color-bg-card, white)",
                  color: "var(--color-text-main, #111827)",
                  fontSize: "0.9rem",
                }}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <Button variant="subtle" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePoll} disabled={!newPollTitle.trim()}>
                Create & Add Questions
              </Button>
            </div>
          </div>
        </Modal>

        {/* Create New Group Modal */}
        <Modal
          opened={isNewGroupModalOpen}
          onClose={() => setIsNewGroupModalOpen(false)}
          title="Add New Poll Group"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <TextInput
              label="Group Name"
              placeholder="e.g. Pediatric Nephrology or Custom Hospital"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
            />
            <TextInput
              label="Description (Optional)"
              placeholder="e.g. Rotation group July 2026"
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <Button variant="subtle" onClick={() => setIsNewGroupModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                Save Group
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
