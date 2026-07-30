import React, { useState, useMemo } from "react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { Button, Paper, Select, TextInput } from "@/components/ui";
import { useDocumentTitle } from "@/lib/hooks/useDocumentTitle";
import { useAllDecks } from "@/logic/deck/hooks/useAllDecks";
import { deleteDeck } from "@/logic/deck/deleteDeck";
import { Deck } from "@/logic/deck/deck";
import {
  IconExternalLink,
  IconFileImport,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import DeckModal from "../deck/DeckModal";
import { ImportJsonFlashcardsModal } from "../deck/ImportJsonFlashcardsModal";
import { AppHeaderContent } from "../shell/Header/Header";
import "./DeckAdminView.css";

const BASE = "deck-admin-view";

export default function DeckAdminView() {
  useDocumentTitle("Deck Administration | Renal Review");
  const navigate = useNavigate();

  const [allDecks, isReady] = useAllDecks();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTopic, setFilterTopic] = useState("all");
  const [filterType, setFilterType] = useState("all"); // 'all' | 'subdecks' | 'toplevel'

  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [newDeckModalOpened, setNewDeckModalOpened] = useState(false);
  const [importModalOpened, setImportModalOpened] = useState(false);

  // Map of parent IDs to Deck names for easy lookup
  const deckMap = useMemo(() => {
    const map = new Map<string, string>();
    if (allDecks) {
      allDecks.forEach((d) => map.set(d.id, d.name));
    }
    return map;
  }, [allDecks]);

  // Statistics
  const stats = useMemo(() => {
    if (!allDecks) return { totalDecks: 0, subDecks: 0, topTopics: 0, totalCards: 0 };
    let totalCards = 0;
    let subDecks = 0;
    let topTopics = 0;

    allDecks.forEach((d) => {
      totalCards += d.cards?.length || 0;
      if (d.superDecks && d.superDecks.length > 0) {
        subDecks++;
      } else {
        topTopics++;
      }
    });

    return {
      totalDecks: allDecks.length,
      subDecks,
      topTopics,
      totalCards,
    };
  }, [allDecks]);

  // Filtered Deck List
  const filteredDecks = useMemo(() => {
    if (!allDecks) return [];
    return allDecks.filter((d) => {
      // Search text
      if (
        searchQuery &&
        !d.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !d.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Filter by type
      const isSub = d.superDecks && d.superDecks.length > 0;
      if (filterType === "subdecks" && !isSub) return false;
      if (filterType === "toplevel" && isSub) return false;

      // Filter by Parent Topic
      if (filterTopic !== "all") {
        if (!isSub) {
          if (d.id !== filterTopic) return false;
        } else {
          const directParentId = d.superDecks ? d.superDecks[d.superDecks.length - 1] : undefined;
          if (directParentId !== filterTopic) return false;
        }
      }

      return true;
    });
  }, [allDecks, searchQuery, filterType, filterTopic]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Only select subdecks for safety
      const subdeckIds = filteredDecks
        .filter((d) => d.superDecks && d.superDecks.length > 0)
        .map((d) => d.id);
      setSelectedDeckIds(subdeckIds);
    } else {
      setSelectedDeckIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedDeckIds.includes(id)) {
      setSelectedDeckIds(selectedDeckIds.filter((i) => i !== id));
    } else {
      setSelectedDeckIds([...selectedDeckIds, id]);
    }
  };

  const handleDeleteSingle = async (deckToDelete: Deck) => {
    const isSub = deckToDelete.superDecks && deckToDelete.superDecks.length > 0;
    const msg = isSub
      ? `Are you sure you want to delete subdeck "${deckToDelete.name}" and all its flashcards?`
      : `CAUTION: "${deckToDelete.name}" is a Top-Level Renal Topic. Deleting it will also delete ALL its subdecks and flashcards! Are you sure?`;

    if (window.confirm(msg)) {
      try {
        await deleteDeck(deckToDelete);
        setSelectedDeckIds(selectedDeckIds.filter((id) => id !== deckToDelete.id));
      } catch (err) {
        alert("Failed to delete deck: " + err);
      }
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedDeckIds.length === 0) return;
    if (
      window.confirm(
        `Are you sure you want to delete the ${selectedDeckIds.length} selected decks and all their flashcards?`
      )
    ) {
      try {
        for (const id of selectedDeckIds) {
          const targetDeck = allDecks?.find((d) => d.id === id);
          if (targetDeck) {
            await deleteDeck(targetDeck);
          }
        }
        setSelectedDeckIds([]);
      } catch (err) {
        alert("Error during bulk delete: " + err);
      }
    }
  };

  const getParentName = (deck: Deck) => {
    if (!deck.superDecks || deck.superDecks.length === 0) {
      return "Top-Level Renal Topic";
    }
    const parentId = deck.superDecks[deck.superDecks.length - 1];
    return deckMap.get(parentId) || "Parent Topic";
  };

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs segments={[{ label: "Administration" }]} />
        <Button
          onClick={() => window.location.reload()}
          leftSection={<IconRefresh size={16} />}
          variant="default"
        >
          Refresh App
        </Button>
      </AppHeaderContent>

      <div className={BASE}>
        <div className={`${BASE}__header`}>
          <h1 className={`${BASE}__title`}>Deck Administration Registry</h1>
          <p className={`${BASE}__subtitle`}>
            Manage, audit, and clean up uploaded JSON decks, manual subdecks, and Renal topics.
          </p>
        </div>

        {/* Stats Section */}
        <div className={`${BASE}__stats`}>
          <Paper withBorder className={`${BASE}__stat-card`}>
            <div className={`${BASE}__stat-val`}>{stats.totalDecks}</div>
            <div className={`${BASE}__stat-lbl`}>Total Decks</div>
          </Paper>
          <Paper withBorder className={`${BASE}__stat-card`}>
            <div className={`${BASE}__stat-val`}>{stats.subDecks}</div>
            <div className={`${BASE}__stat-lbl`}>Subdecks (Uploaded/Manual)</div>
          </Paper>
          <Paper withBorder className={`${BASE}__stat-card`}>
            <div className={`${BASE}__stat-val`}>{stats.topTopics}</div>
            <div className={`${BASE}__stat-lbl`}>Renal Parent Topics</div>
          </Paper>
          <Paper withBorder className={`${BASE}__stat-card`}>
            <div className={`${BASE}__stat-val`}>{stats.totalCards}</div>
            <div className={`${BASE}__stat-lbl`}>Total Flashcards</div>
          </Paper>
        </div>

        {/* Toolbar Section */}
        <div className={`${BASE}__toolbar`}>
          <div className={`${BASE}__filters`}>
            <TextInput
              placeholder="Search by deck name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={16} />}
              style={{ minWidth: "220px" }}
            />
            <div style={{ minWidth: "170px" }}>
              <Select
                value={filterType}
                onChange={(val) => setFilterType(val || "all")}
                options={[
                  { label: "All Decks", value: "all" },
                  { label: "Subdecks Only", value: "subdecks" },
                  { label: "Top-Level Topics Only", value: "toplevel" },
                ]}
              />
            </div>
            <div style={{ minWidth: "180px" }}>
              <Select
                value={filterTopic}
                onChange={(val) => setFilterTopic(val || "all")}
                options={[
                  { label: "All Parent Topics", value: "all" },
                  ...(allDecks || [])
                    .filter((d) => !d.superDecks || d.superDecks.length === 0)
                    .map((d) => ({ label: d.name, value: d.id })),
                ]}
              />
            </div>
          </div>

          <div className={`${BASE}__actions`}>
            {selectedDeckIds.length > 0 && (
              <Button
                variant="default"
                onClick={handleDeleteBulk}
                leftSection={<IconTrash size={16} />}
                style={{ color: "#ef4444", borderColor: "#fca5a5" }}
              >
                Delete Selected ({selectedDeckIds.length})
              </Button>
            )}
            <Button
              onClick={() => setImportModalOpened(true)}
              leftSection={<IconFileImport size={16} />}
              variant="default"
            >
              Import JSON Flashcards
            </Button>
            <Button
              onClick={() => setNewDeckModalOpened(true)}
              leftSection={<IconPlus size={16} />}
              variant="primary"
            >
              + New Subdeck
            </Button>
          </div>
        </div>

        {/* Registry Table */}
        <Paper withBorder className={`${BASE}__table-container`}>
          <table className={`${BASE}__table`}>
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedDeckIds.length > 0 &&
                      selectedDeckIds.length ===
                        filteredDecks.filter((d) => d.superDecks?.length).length
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Deck / Subdeck Name</th>
                <th>Parent Topic</th>
                <th>Type</th>
                <th>Cards / Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!isReady ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading deck registry...
                  </td>
                </tr>
              ) : filteredDecks.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--theme-neutral-500)",
                    }}
                  >
                    No decks match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredDecks.map((deck) => {
                  const isSubdeck = deck.superDecks && deck.superDecks.length > 0;
                  const isChecked = selectedDeckIds.includes(deck.id);

                  return (
                    <tr key={deck.id}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(deck.id)}
                        />
                      </td>
                      <td>
                        <Link
                          to={`/deck/${deck.id}`}
                          className={`${BASE}__deck-link`}
                        >
                          {deck.name}
                        </Link>
                        {deck.description && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--theme-neutral-500)",
                              marginTop: "2px",
                            }}
                          >
                            {deck.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`${BASE}__badge-tag ${
                            isSubdeck
                              ? `${BASE}__badge-parent`
                              : `${BASE}__badge-subdeck`
                          }`}
                        >
                          {getParentName(deck)}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "12px",
                            color: isSubdeck
                              ? "var(--theme-neutral-700)"
                              : "var(--theme-primary-600)",
                            fontWeight: 600,
                          }}
                        >
                          {isSubdeck ? "Subdeck" : "Top-Level Topic"}
                        </span>
                      </td>
                      <td>
                        <strong>{deck.cards?.length || 0}</strong> cards (
                        {deck.notes?.length || 0} notes)
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => navigate(`/deck/${deck.id}`)}
                            leftSection={<IconExternalLink size={14} />}
                          >
                            Open
                          </Button>
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => handleDeleteSingle(deck)}
                            leftSection={<IconTrash size={14} />}
                            style={{ color: "#ef4444" }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Paper>

        <DeckModal
          mode="create"
          opened={newDeckModalOpened}
          setOpened={setNewDeckModalOpened}
        />

        <ImportJsonFlashcardsModal
          opened={importModalOpened}
          onClose={() => setImportModalOpened(false)}
        />
      </div>
    </>
  );
}
