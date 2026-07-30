import React, { useState, useEffect } from "react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { Button, Paper, TextInput } from "@/components/ui";
import { AppHeaderContent } from "../shell/Header/Header";
import { supabase } from "@/logic/supabase";
import { Student, PollGroup, Response, Question } from "./types";
import { getStudents, getPollGroups } from "./pollingStore";
import { seedTestStudentsAndResponses } from "./seedTestStudents";
import {
  IconTrophy,
  IconMedal,
  IconSearch,
  IconFilter,
  IconReportAnalytics,
  IconArrowLeft,
  IconUserPlus,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

interface StudentMetrics {
  student: Student;
  pollsCompleted: number;
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
  firstPollDate: string | null;
  latestPollDate: string | null;
}

export default function PollLeaderboardView() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<PollGroup[]>([]);
  const [leaderboard, setLeaderboard] = useState<StudentMetrics[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [allStudents, allGroups] = await Promise.all([getStudents(), getPollGroups()]);
    setGroups(allGroups);

    // Fetch responses from Supabase (or fallback local)
    let responses: Response[] = [];
    try {
      const { data, error } = await supabase.from("responses").select("*");
      if (!error && data) {
        responses = data as Response[];
      }
    } catch (e) {
      console.warn("Error loading responses from Supabase, using local fallback", e);
    }

    if (responses.length === 0) {
      const localStr = localStorage.getItem("renal_review_responses");
      if (localStr) responses = JSON.parse(localStr);
    }

    // Fetch questions to map correct indices if is_correct was missing
    let questions: Question[] = [];
    try {
      const { data } = await supabase.from("questions").select("*");
      if (data) questions = data as Question[];
    } catch (e) {
      // ignore
    }

    const qMap = new Map<string, Question>();
    questions.forEach((q) => qMap.set(q.id, q));

    // Aggregate stats per student (by student_code or respondent_name)
    const metricsMap = new Map<string, StudentMetrics>();

    // Initialize metrics for all registered students
    allStudents.forEach((s) => {
      metricsMap.set(s.student_code.toUpperCase(), {
        student: s,
        pollsCompleted: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        accuracy: 0,
        firstPollDate: null,
        latestPollDate: null,
      });
    });

    // Process responses
    responses.forEach((resp) => {
      const studentCode = (resp.student_id || "").toUpperCase();
      if (!studentCode) return;

      let metric = metricsMap.get(studentCode);
      if (!metric) {
        // Create dynamic record if student took poll prior to full registration
        const fallbackStudent: Student = {
          id: "temp_" + studentCode,
          student_code: studentCode,
          name: resp.respondent_name || studentCode,
          pin: "0000",
          group_name: resp.hospital || "Renal",
          rotation_start: resp.created_at || new Date().toISOString(),
          created_at: resp.created_at || new Date().toISOString(),
        };
        metric = {
          student: fallbackStudent,
          pollsCompleted: 0,
          totalQuestions: 0,
          totalCorrect: 0,
          accuracy: 0,
          firstPollDate: resp.created_at,
          latestPollDate: resp.created_at,
        };
        metricsMap.set(studentCode, metric);
      }

      metric.totalQuestions += 1;

      // Determine correctness
      let isCorrect = resp.is_correct;
      if (isCorrect === null || isCorrect === undefined) {
        const q = qMap.get(resp.question_id);
        if (q && q.correct_option_index !== null) {
          isCorrect = resp.selected_option_index === q.correct_option_index;
        }
      }
      if (isCorrect) metric.totalCorrect += 1;

      // Update dates
      const respDate = resp.created_at || new Date().toISOString();
      if (!metric.firstPollDate || respDate < metric.firstPollDate) {
        metric.firstPollDate = respDate;
      }
      if (!metric.latestPollDate || respDate > metric.latestPollDate) {
        metric.latestPollDate = respDate;
      }
    });

    // Calculate accuracy percentage & sort by score
    const computedList: StudentMetrics[] = Array.from(metricsMap.values()).map((m) => {
      const acc = m.totalQuestions > 0 ? (m.totalCorrect / m.totalQuestions) * 100 : 0;
      return {
        ...m,
        accuracy: Math.round(acc * 10) / 10,
      };
    });

    // Sort by Total Correct desc, then Accuracy desc
    computedList.sort((a, b) => {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return b.accuracy - a.accuracy;
    });

    setLeaderboard(computedList);
    setLoading(false);
  };

  const filteredLeaderboard = leaderboard.filter((item) => {
    const matchesGroup =
      selectedGroup === "All" ||
      item.student.group_name.toLowerCase() === selectedGroup.toLowerCase();
    const matchesSearch =
      item.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.student.student_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  const handleSeedStudents = async () => {
    const res = await seedTestStudentsAndResponses();
    alert(res.message);
    loadData();
  };

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs
          segments={[
            { label: "Live Polling", path: "/polling" },
            { label: "Leaderboard" },
          ]}
        />
      </AppHeaderContent>

      <div
        style={{
          width: "100%",
          maxWidth: "var(--max-content-width)",
          margin: "0 auto",
          padding: "20px 0",
        }}
      >
        {/* Header Title Bar */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <IconTrophy size={32} color="#eab308" />
              <h1 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>
                Student Leaderboard
              </h1>
            </div>
            <p
              style={{
                color: "var(--theme-neutral-600)",
                margin: "4px 0 0 0",
                fontSize: "0.9rem",
              }}
            >
              Comprehensive performance leaderboard based on total correct answers and accuracy.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button
              variant="default"
              onClick={handleSeedStudents}
              leftSection={<IconUserPlus size={16} color="#10b981" />}
            >
              Seed 5 Test Students
            </Button>
            <Button
              variant="default"
              onClick={() => navigate("/polling")}
              leftSection={<IconArrowLeft size={16} />}
            >
              Back to Dashboard
            </Button>
            <Button
              variant="default"
              onClick={() => navigate("/polling/reports")}
              leftSection={<IconReportAnalytics size={16} color="#2563eb" />}
            >
              Individual Reports
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Paper
          withBorder
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconFilter size={18} color="var(--color-text-muted)" />
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Filter Group:</span>
            <button
              onClick={() => setSelectedGroup("All")}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "none",
                background: selectedGroup === "All" ? "#2563eb" : "transparent",
                color: selectedGroup === "All" ? "white" : "inherit",
                fontWeight: selectedGroup === "All" ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              All Groups
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g.name)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: "none",
                  background: selectedGroup.toLowerCase() === g.name.toLowerCase() ? "#2563eb" : "transparent",
                  color: selectedGroup.toLowerCase() === g.name.toLowerCase() ? "white" : "inherit",
                  fontWeight: selectedGroup.toLowerCase() === g.name.toLowerCase() ? 600 : 400,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div style={{ minWidth: "260px" }}>
            <TextInput
              placeholder="Search Student Name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={16} />}
            />
          </div>
        </Paper>

        {/* Leaderboard Table */}
        {loading ? (
          <p>Loading leaderboard rankings...</p>
        ) : filteredLeaderboard.length === 0 ? (
          <Paper withBorder style={{ padding: "3rem", textAlign: "center", color: "var(--theme-neutral-500)" }}>
            No student poll records match your selected filter.
          </Paper>
        ) : (
          <Paper withBorder style={{ overflow: "hidden", borderRadius: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr
                  style={{
                    background: "var(--color-bg-secondary, #f8fafc)",
                    borderBottom: "1px solid var(--color-border, #e2e8f0)",
                    color: "var(--color-text-muted, #64748b)",
                  }}
                >
                  <th style={{ padding: "12px 16px", width: "80px" }}>Rank</th>
                  <th style={{ padding: "12px 16px" }}>Student Name</th>
                  <th style={{ padding: "12px 16px" }}>Student ID</th>
                  <th style={{ padding: "12px 16px" }}>Group / Hospital</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Questions Answered</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Correct Answers</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Accuracy %</th>
                  <th style={{ padding: "12px 16px" }}>First Poll Date</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Report</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((item, index) => {
                  const rank = index + 1;
                  let medalColor = "";
                  if (rank === 1) medalColor = "#eab308"; // Gold
                  else if (rank === 2) medalColor = "#94a3b8"; // Silver
                  else if (rank === 3) medalColor = "#b45309"; // Bronze

                  return (
                    <tr
                      key={item.student.id || item.student.student_code}
                      style={{
                        borderBottom: "1px solid var(--color-border, #f1f5f9)",
                        background: rank <= 3 ? "rgba(254, 240, 138, 0.1)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                        {medalColor ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <IconMedal size={20} color={medalColor} />
                            <span>#{rank}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b" }}>#{rank}</span>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px", fontWeight: 600 }}>
                        {item.student.name}
                      </td>

                      <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#2563eb" }}>
                        {item.student.student_code}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            background: "rgba(37, 99, 235, 0.08)",
                            color: "#2563eb",
                            fontWeight: 600,
                          }}
                        >
                          {item.student.group_name}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600 }}>
                        {item.totalQuestions}
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 700, color: "#16a34a" }}>
                        {item.totalCorrect}
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            background:
                              item.accuracy >= 75
                                ? "rgba(22, 163, 74, 0.15)"
                                : item.accuracy >= 50
                                ? "rgba(234, 179, 8, 0.15)"
                                : "rgba(225, 29, 72, 0.15)",
                            color:
                              item.accuracy >= 75
                                ? "#15803d"
                                : item.accuracy >= 50
                                ? "#a16207"
                                : "#be123c",
                          }}
                        >
                          {item.accuracy}%
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", fontSize: "0.85rem", color: "#64748b" }}>
                        {item.firstPollDate ? new Date(item.firstPollDate).toLocaleDateString() : "—"}
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() => navigate(`/polling/reports?student=${encodeURIComponent(item.student.student_code)}`)}
                        >
                          View Report
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Paper>
        )}
      </div>
    </>
  );
}
