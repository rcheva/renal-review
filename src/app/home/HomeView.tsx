import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import EmptyNotice from "@/components/EmptyNotice";
import { Button, IconButton, Kbd, Modal, Paper, TextInput, Tooltip } from "@/components/ui";
import { useDocumentTitle } from "@/lib/hooks/useDocumentTitle";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import { useAllDecks } from "@/logic/deck/hooks/useAllDecks";
import { useSetting } from "@/logic/settings/hooks/useSetting";
import { isTauri } from "@/lib/isTauri";
import { db } from "@/logic/db";
import { exportDB, importInto } from "dexie-export-import";
import { getSyncLogs } from "@/logic/sync/syncLogStore";
import {
  IconFileImport,
  IconFolder,
  IconPlus,
  IconPower,
  IconRefresh,
  IconSearch,
  IconDatabaseExport,
  IconTerminal,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import DeckModal from "../deck/DeckModal";
import DeckMenu from "../deck/DeckMenu";
import { ImportJsonFlashcardsModal } from "../deck/ImportJsonFlashcardsModal";
import { AppHeaderContent } from "../shell/Header/Header";
import { seedAllContent } from "@/logic/seedData";
import "./HomeView.css";

const BASE = "home-view";

export default function HomeView() {
  useDocumentTitle("Renal Review");
  const [t] = useTranslation();
  const navigate = useNavigate();
  const [newDeckModalOpened, setNewDeckModalOpened] = useState(false);
  const [isImportFlashcardsModalOpen, setIsImportFlashcardsModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allDecks, isReady] = useAllDecks();
  const [userName, userNameIsReady] = useSetting("#name");

  const [searchQuery, setSearchQuery] = useState("");

  useHotkeys([["n", () => setNewDeckModalOpened(true)]]);

  useEffect(() => {
    if (isReady && allDecks && allDecks.length === 0) {
      seedAllContent();
    }
  }, [isReady, allDecks]);

  const handleQuitApp = async () => {
    if (window.confirm("Are you sure you want to exit Renal Review completely?")) {
      try {
        if (isTauri()) {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("quit_app");
        } else {
          window.location.href = "about:blank";
          window.close();
        }
      } catch (err) {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          await getCurrentWindow().destroy();
        } catch {
          window.close();
        }
      }
    }
  };

  // Derive top-level topic decks (all root parent decks)
  const topicDecks = useMemo(() => {
    if (!allDecks) return [];
    return allDecks.filter(
      (d) => !d.superDecks || d.superDecks.length === 0
    );
  }, [allDecks]);

  // Derive subdecks for a specific parent
  const getSubdecks = (parentId: string) => {
    if (!allDecks) return [];
    return allDecks.filter(
      (d) => d.superDecks && d.superDecks.includes(parentId)
    );
  };

  // Filtered decks for the table
  const filteredDecks = useMemo(() => {
    if (!allDecks) return [];
    if (!searchQuery) return allDecks;
    return allDecks.filter(
      (d) =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allDecks, searchQuery]);

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs />
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Tooltip label="Refresh App">
            <IconButton
              onClick={() => window.location.reload()}
              variant="default"
            >
              <IconRefresh size={18} />
            </IconButton>
          </Tooltip>

          <Tooltip label="Import Flashcards (JSON)">
            <IconButton
              onClick={() => setIsImportFlashcardsModalOpen(true)}
              variant="default"
            >
              <IconFileImport size={18} />
            </IconButton>
          </Tooltip>

          <Tooltip label="View Sync Logs">
            <IconButton
              onClick={() => setIsLogsModalOpen(true)}
              variant="default"
            >
              <IconTerminal size={18} />
            </IconButton>
          </Tooltip>

          <Tooltip
            label={
              <>
                {t("deck.create-deck-tooltip")}
                <Kbd>n</Kbd>
              </>
            }
            position="left"
          >
            <Button
              onClick={() => setNewDeckModalOpened(true)}
              leftSection={<IconPlus />}
              variant="ghost"
            >
              {t("deck.new-deck-button")}
            </Button>
          </Tooltip>

          <Tooltip label="Quit App">
            <IconButton
              onClick={handleQuitApp}
              variant="ghost"
              style={{ color: "#ef4444" }}
            >
              <IconPower size={18} />
            </IconButton>
          </Tooltip>
        </div>
      </AppHeaderContent>

      <div className={`${BASE}__content`}>
        <section className={`${BASE}__welcome-section`}>
          <h1
            className={`${BASE}__welcome-title ${!userNameIsReady && "invisible"}`}
          >
            {userName
              ? t("home.welcome-user", { name: userName })
              : t("home.welcome")}
          </h1>
          <sub className={`${BASE}__welcome-subtitle`}>
            {t("home.welcome-subtitle")}
          </sub>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--spacing-lg)",
          }}
        >
          <h2 className={`${BASE}__section-title`} style={{ marginBottom: 0 }}>
            Renal Topics
          </h2>
        </div>

        {isReady && topicDecks.length === 0 ? (
          <div className={`${BASE}__empty-state`}>
            <EmptyNotice
              icon={IconFolder}
              description="No Renal Topics found. Create a new deck to get started."
            />
          </div>
        ) : (
          <div className={`${BASE}__topic-grid`}>
            {topicDecks.map((topicDeck) => {
              const subdecks = getSubdecks(topicDeck.id);
              const hasNew =
                topicDeck.statCache?.counts?.new !== undefined &&
                topicDeck.statCache.counts.new > 0;
              return (
                <Paper
                  key={topicDeck.id}
                  className={`${BASE}__topic-card ${hasNew ? `${BASE}__topic-card--has-new` : ""}`}
                  withBorder
                  onClick={() => navigate(`/deck/${topicDeck.id}`)}
                >
                  <div className={`${BASE}__topic-header`}>
                    <h3 className={`${BASE}__topic-title`}>{topicDeck.name}</h3>
                    <IconFolder size={20} color="var(--theme-neutral-400)" />
                  </div>
                  {subdecks.length > 0 ? (
                    <div className={`${BASE}__topic-subdecks`}>
                      {subdecks.map((sub) => {
                        const subHasNew =
                          sub.statCache?.counts?.new !== undefined &&
                          sub.statCache.counts.new > 0;
                        return (
                          <span
                            key={sub.id}
                            className={`${BASE}__topic-subdeck-pill ${subHasNew ? `${BASE}__topic-subdeck-pill--has-new` : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/deck/${sub.id}`);
                            }}
                          >
                            {sub.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--theme-neutral-500)",
                      }}
                    >
                      No subdecks yet
                    </span>
                  )}
                </Paper>
              );
            })}
          </div>
        )}

        <h2 className={`${BASE}__section-title`}>All Decks</h2>
        <div className={`${BASE}__filter-container`}>
          <TextInput
            placeholder="Search decks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ maxWidth: 300, width: "100%" }}
          />
        </div>

        <Paper withBorder className={`${BASE}__table-container`}>
          <table className={`${BASE}__table`}>
            <thead>
              <tr>
                <th>Deck Name</th>
                <th>Cards</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDecks.map((deck) => (
                <tr key={deck.id}>
                  <td>
                    <Link
                      to={`/deck/${deck.id}`}
                      className={`${BASE}__table-link`}
                    >
                      {deck.name}
                    </Link>
                  </td>
                  <td>{deck.cards.length}</td>
                  <td>{deck.notes.length}</td>
                  <td>
                    <DeckMenu deck={deck} ready={true} triggerSize="sm" withShortcuts={false} />
                  </td>
                </tr>
              ))}
              {filteredDecks.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      textAlign: "center",
                      padding: "var(--spacing-xl)",
                      color: "var(--theme-neutral-500)",
                    }}
                  >
                    No decks match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Paper>
      </div>

      <DeckModal
        mode="create"
        opened={newDeckModalOpened}
        setOpened={setNewDeckModalOpened}
      />

      <ImportJsonFlashcardsModal
        opened={isImportFlashcardsModalOpen}
        onClose={() => setIsImportFlashcardsModalOpen(false)}
      />

      <Modal
        title="Sync & Transfer Decks (Mac to iPhone)"
        opened={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", padding: "0.5rem 0" }}>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--theme-neutral-700)", lineHeight: 1.5 }}>
            Easily transfer your exact flashcards, subdecks (such as <strong>26 Acute PD</strong>), and renal topics between your Mac and your iPhone 14.
          </p>

          <div style={{ padding: "1rem", borderRadius: "8px", background: "var(--theme-neutral-50)", border: "1px solid var(--theme-neutral-200)" }}>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--theme-primary-900)" }}>1. On your Mac Desktop App:</h4>
            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "var(--theme-neutral-600)" }}>
              Export a complete backup file containing all your custom decks & flashcards.
            </p>
            <Button
              leftSection={<IconDatabaseExport size={16} />}
              onClick={async () => {
                const now = new Date();
                const blob = await exportDB(db);
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `renal-review-backup-${now.toISOString().slice(0, 10)}.json`;
                a.click();
              }}
            >
              Export Backup File (.json)
            </Button>
          </div>

          <div style={{ padding: "1rem", borderRadius: "8px", background: "var(--theme-neutral-50)", border: "1px solid var(--theme-neutral-200)" }}>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--theme-primary-900)" }}>2. On your iPhone 14 (Safari):</h4>
            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "var(--theme-neutral-600)" }}>
              Upload the exported backup file to instantly load all your decks on your phone.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await importInto(db, file, { clearTablesBeforeImport: false, overwriteValues: true });
                  alert("✅ Decks & flashcards successfully synced!");
                  window.location.reload();
                } catch (err: any) {
                  alert("Error importing backup: " + (err?.message || err));
                }
              }}
            />
            <Button
              variant="default"
              leftSection={<IconFileImport size={16} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Import Backup File (.json)
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Sync Diagnostic Logs"
        opened={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--theme-neutral-600)" }}>
              Diagnostic events & background sync activity:
            </span>
            <Button
              size="xs"
              variant="subtle"
              leftSection={copiedLogs ? <IconCheck size={14} /> : <IconCopy size={14} />}
              onClick={() => {
                const logs = getSyncLogs();
                const logText = logs
                  .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
                  .join("\n");
                navigator.clipboard.writeText(logText);
                setCopiedLogs(true);
                setTimeout(() => setCopiedLogs(false), 2000);
              }}
            >
              {copiedLogs ? "Copied!" : "Copy Logs"}
            </Button>
          </div>

          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              padding: "0.75rem",
              borderRadius: "8px",
              background: "#1e293b",
              color: "#e2e8f0",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              lineHeight: 1.6,
            }}
          >
            {getSyncLogs().length === 0 ? (
              <span style={{ color: "#94a3b8" }}>No sync events logged yet.</span>
            ) : (
              getSyncLogs().map((entry, idx) => (
                <div key={idx} style={{ marginBottom: "4px" }}>
                  <span style={{ color: "#64748b" }}>[{entry.timestamp}]</span>{" "}
                  <span
                    style={{
                      color:
                        entry.type === "error"
                          ? "#f87171"
                          : entry.type === "warn"
                          ? "#fbbf24"
                          : entry.type === "success"
                          ? "#4ade80"
                          : "#38bdf8",
                      fontWeight: 600,
                    }}
                  >
                    [{entry.type.toUpperCase()}]
                  </span>{" "}
                  {entry.message}
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
