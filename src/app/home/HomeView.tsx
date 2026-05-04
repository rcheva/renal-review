import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import EmptyNotice from "@/components/EmptyNotice";
import { Button, Kbd, Tooltip, Paper, TextInput } from "@/components/ui";
import { useDocumentTitle } from "@/lib/hooks/useDocumentTitle";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import { useAllDecks } from "@/logic/deck/hooks/useAllDecks";
import { useSetting } from "@/logic/settings/hooks/useSetting";
import { IconFolder, IconPlus, IconSearch, IconDatabaseImport } from "@tabler/icons-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DeckModal from "../deck/DeckModal";
import { AppHeaderContent } from "../shell/Header/Header";
import { useNavigate, Link } from "react-router-dom";
import { seedAllContent } from "@/logic/seedData";
import "./HomeView.css";

const BASE = "home-view";

const MAIN_TOPICS = [
  "CKD",
  "AKI",
  "GMN",
  "Dialysis",
  "Transplant",
  "Electrolytes",
  "Hypertension",
  "Genetics / Rare",
  "Guidelines",
  "RCT",
];

export default function HomeView() {
  useDocumentTitle("Renal Review");
  const [t] = useTranslation();
  const navigate = useNavigate();
  const [newDeckModalOpened, setNewDeckModalOpened] = useState(false);
  const [allDecks, isReady] = useAllDecks();
  const [userName, userNameIsReady] = useSetting("#name");
  
  const [searchQuery, setSearchQuery] = useState("");

  useHotkeys([["n", () => setNewDeckModalOpened(true)]]);

  // Derive top-level topic decks
  const topicDecks = useMemo(() => {
    if (!allDecks) return [];
    return allDecks.filter(
      (d) => (!d.superDecks || d.superDecks.length === 0) && MAIN_TOPICS.includes(d.name)
    );
  }, [allDecks]);

  // Derive subdecks for a specific parent
  const getSubdecks = (parentId: string) => {
    if (!allDecks) return [];
    return allDecks.filter((d) => d.superDecks && d.superDecks.includes(parentId));
  };

  // Filtered decks for the table
  const filteredDecks = useMemo(() => {
    if (!allDecks) return [];
    if (!searchQuery) return allDecks;
    return allDecks.filter((d) => 
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allDecks, searchQuery]);

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs />
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-lg)" }}>
          <h2 className={`${BASE}__section-title`} style={{ marginBottom: 0 }}>Renal Topics</h2>
          <Button
            onClick={async () => {
              await seedAllContent();
            }}
            leftSection={<IconDatabaseImport size={16} />}
            variant="default"
          >
            Seed Demo Content
          </Button>
        </div>

        {isReady && topicDecks.length === 0 ? (
          <div className={`${BASE}__empty-state`}>
            <EmptyNotice
              icon={IconFolder}
              description="No Renal Topics found. Click 'Seed Demo Content' to auto-generate the decks."
            />
          </div>
        ) : (
          <div className={`${BASE}__topic-grid`}>
            {topicDecks.map((topicDeck) => {
              const subdecks = getSubdecks(topicDeck.id);
              const hasNew = topicDeck.statCache?.counts?.new !== undefined && topicDeck.statCache.counts.new > 0;
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
                        const subHasNew = sub.statCache?.counts?.new !== undefined && sub.statCache.counts.new > 0;
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
                    <span style={{ fontSize: "var(--font-size-sm)", color: "var(--theme-neutral-500)" }}>
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
              </tr>
            </thead>
            <tbody>
              {filteredDecks.map((deck) => (
                <tr key={deck.id}>
                  <td>
                    <Link to={`/deck/${deck.id}`} className={`${BASE}__table-link`}>
                      {deck.name}
                    </Link>
                  </td>
                  <td>{deck.cards.length}</td>
                  <td>{deck.notes.length}</td>
                </tr>
              ))}
              {filteredDecks.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "var(--spacing-xl)", color: "var(--theme-neutral-500)" }}>
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
    </>
  );
}
