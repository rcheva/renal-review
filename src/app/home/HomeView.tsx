import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import EmptyNotice from "@/components/EmptyNotice";
import { Button, Kbd, Paper, TextInput, Tooltip } from "@/components/ui";
import { useDocumentTitle } from "@/lib/hooks/useDocumentTitle";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import { useAllDecks } from "@/logic/deck/hooks/useAllDecks";
import { useSetting } from "@/logic/settings/hooks/useSetting";
import { isTauri } from "@/lib/isTauri";
import { IconFileImport, IconFolder, IconPlus, IconPower, IconRefresh, IconSearch } from "@tabler/icons-react";
import { useMemo, useState, useEffect } from "react";
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
          <Button
            onClick={() => window.location.reload()}
            leftSection={<IconRefresh size={16} />}
            variant="default"
          >
            Refresh App
          </Button>

          <Button
            onClick={() => setIsImportFlashcardsModalOpen(true)}
            leftSection={<IconFileImport size={16} />}
            variant="default"
          >
            Import Flashcards (JSON)
          </Button>

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

          <Button
            onClick={handleQuitApp}
            leftSection={<IconPower size={16} />}
            variant="ghost"
            style={{ color: "#ef4444" }}
          >
            Quit App
          </Button>
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
    </>
  );
}
