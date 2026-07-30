import React, { useState, useEffect } from "react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { Button, Paper } from "@/components/ui";
import { AppHeaderContent } from "../shell/Header/Header";
import { supabase } from "@/logic/supabase";
import { Student, Response, Poll, Question } from "./types";
import { getStudents } from "./pollingStore";
import { saveStudentReportToOneDrive } from "@/logic/oneDriveSync";
import {
  IconReportAnalytics,
  IconDownload,
  IconArrowLeft,
  IconCheck,
  IconX,
  IconCalendar,
  IconAward,
  IconFileText,
} from "@tabler/icons-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import parse from "html-react-parser";

interface DetailedResponse {
  response: Response;
  question: Question | null;
  poll: Poll | null;
}

export default function StudentReportView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCode = searchParams.get("student") || "";

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>(preselectedCode);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [detailedResponses, setDetailedResponses] = useState<DetailedResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      if (selectedStudentCode) {
        const found = students.find((s) => s.student_code.toUpperCase() === selectedStudentCode.toUpperCase());
        if (found) {
          setActiveStudent(found);
          fetchStudentReport(found);
        } else {
          setActiveStudent(students[0]);
          fetchStudentReport(students[0]);
        }
      } else {
        setActiveStudent(students[0]);
        fetchStudentReport(students[0]);
      }
    }
  }, [selectedStudentCode, students]);

  const loadStudents = async () => {
    const list = await getStudents();
    setStudents(list);
  };

  const fetchStudentReport = async (student: Student) => {
    setLoading(true);
    let responses: Response[] = [];

    try {
      const { data, error } = await supabase
        .from("responses")
        .select("*")
        .or(`student_id.eq.${student.student_code},respondent_name.eq.${student.name}`);
      if (!error && data) {
        responses = data as Response[];
      }
    } catch (e) {
      console.warn("Could not load responses from Supabase, checking local backup", e);
    }

    if (responses.length === 0) {
      const localStr = localStorage.getItem("renal_review_responses");
      if (localStr) {
        const allLocal: Response[] = JSON.parse(localStr);
        responses = allLocal.filter(
          (r) =>
            (r.student_id || "").toUpperCase() === student.student_code.toUpperCase() ||
            (r.respondent_name || "").toLowerCase() === student.name.toLowerCase()
        );
      }
    }

    // Load referenced questions and polls
    const qIds = Array.from(new Set(responses.map((r) => r.question_id)));
    let questions: Question[] = [];
    let polls: Poll[] = [];

    if (qIds.length > 0) {
      try {
        const { data: qData } = await supabase.from("questions").select("*").in("id", qIds);
        if (qData) questions = qData as Question[];

        const pollIds = Array.from(new Set(questions.map((q) => q.poll_id)));
        if (pollIds.length > 0) {
          const { data: pData } = await supabase.from("polls").select("*").in("id", pollIds);
          if (pData) polls = pData as Poll[];
        }
      } catch (e) {
        console.warn("Error fetching questions or polls", e);
      }
    }

    const qMap = new Map<string, Question>();
    questions.forEach((q) => qMap.set(q.id, q));

    const pollMap = new Map<string, Poll>();
    polls.forEach((p) => pollMap.set(p.id, p));

    const combined: DetailedResponse[] = responses.map((resp) => {
      const q = qMap.get(resp.question_id) || null;
      const p = q ? pollMap.get(q.poll_id) || null : null;
      return {
        response: resp,
        question: q,
        poll: p,
      };
    });

    // Sort responses by date desc
    combined.sort((a, b) => new Date(b.response.created_at).getTime() - new Date(a.response.created_at).getTime());

    setDetailedResponses(combined);
    setLoading(false);
  };

  // Metrics computation
  const totalQuestions = detailedResponses.length;
  const totalCorrect = detailedResponses.filter((item) => {
    if (item.response.is_correct !== null && item.response.is_correct !== undefined) {
      return item.response.is_correct;
    }
    if (item.question && item.question.correct_option_index !== null) {
      return item.response.selected_option_index === item.question.correct_option_index;
    }
    return false;
  }).length;

  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 1000) / 10 : 0;
  const uniquePollsCount = new Set(detailedResponses.map((item) => item.poll?.id).filter(Boolean)).size;

  const firstPollDate = detailedResponses.length > 0
    ? detailedResponses[detailedResponses.length - 1].response.created_at
    : activeStudent?.rotation_start || null;

  // Monthly breakdown
  const monthlyStats = new Map<string, { monthYear: string; total: number; correct: number }>();
  detailedResponses.forEach((item) => {
    const d = new Date(item.response.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = d.toLocaleString("default", { month: "short", year: "numeric" });
    const isCorrect = item.response.is_correct || (item.question && item.response.selected_option_index === item.question.correct_option_index);

    const stat = monthlyStats.get(key) || { monthYear: monthName, total: 0, correct: 0 };
    stat.total += 1;
    if (isCorrect) stat.correct += 1;
    monthlyStats.set(key, stat);
  });

  const sortedMonthly = Array.from(monthlyStats.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([_, val]) => ({
      ...val,
      acc: Math.round((val.correct / val.total) * 100),
    }));

  const handleExportHTMLReport = async () => {
    if (!activeStudent) return;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>End-of-Rotation Performance Report - ${activeStudent.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 850px; margin: 0 auto; padding: 2.5rem; color: #1e293b; line-height: 1.5; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { margin: 0; color: #0f172a; font-size: 1.8rem; }
    .student-badge { background: #eff6ff; color: #1d4ed8; padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #bfdbfe; font-weight: bold; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; }
    .card .val { font-size: 1.6rem; font-weight: bold; color: #2563eb; }
    .card .lbl { font-size: 0.8rem; color: #64748b; text-transform: uppercase; margin-top: 4px; }
    h2 { border-bottom: 1px solid #cbd5e1; padding-bottom: 0.4rem; color: #1e293b; margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.9rem; }
    th { background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .correct { color: #16a34a; font-weight: bold; }
    .incorrect { color: #dc2626; font-weight: bold; }
    .explanation { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 0.75rem; font-size: 0.85rem; margin-top: 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>End-of-Rotation Performance Report</h1>
      <p style="margin: 4px 0 0 0; color: #64748b;">Renal Board Review & Live Polling Program</p>
    </div>
    <div class="student-badge">
      ${activeStudent.name} (${activeStudent.student_code})
    </div>
  </div>

  <div style="margin-bottom: 1.5rem; font-size: 0.95rem;">
    <strong>Group / Hospital:</strong> ${activeStudent.group_name} &nbsp;|&nbsp;
    <strong>Rotation First Poll Date:</strong> ${firstPollDate ? new Date(firstPollDate).toLocaleDateString() : "N/A"} &nbsp;|&nbsp;
    <strong>Report Generated:</strong> ${new Date().toLocaleDateString()}
  </div>

  <div class="grid">
    <div class="card"><div class="val">${uniquePollsCount}</div><div class="lbl">Polls Taken</div></div>
    <div class="card"><div class="val">${totalQuestions}</div><div class="lbl">Questions Attempted</div></div>
    <div class="card"><div class="val" style="color: #16a34a;">${totalCorrect}</div><div class="lbl">Correct Responses</div></div>
    <div class="card"><div class="val">${accuracy}%</div><div class="lbl">Overall Accuracy</div></div>
  </div>

  <h2>Monthly Progress Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Month / Period</th>
        <th>Questions Attempted</th>
        <th>Correct Responses</th>
        <th>Monthly Accuracy</th>
      </tr>
    </thead>
    <tbody>
      ${sortedMonthly.map((m) => `
        <tr>
          <td><strong>${m.monthYear}</strong></td>
          <td>${m.total}</td>
          <td class="correct">${m.correct}</td>
          <td><strong>${m.acc}%</strong></td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <h2>Detailed Response & Question History</h2>
  ${detailedResponses.map((item, idx) => {
    const q = item.question;
    const isCorrect = item.response.is_correct || (q && item.response.selected_option_index === q.correct_option_index);
    const selectedText = q && item.response.selected_option_index >= 0 ? q.options[item.response.selected_option_index] : "Skipped";
    const correctText = q && q.correct_option_index !== null ? q.options[q.correct_option_index] : "N/A";

    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 1rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 0.5rem;">
          <span>#${detailedResponses.length - idx}. ${item.poll?.title || "Poll Question"}</span>
          <span class="${isCorrect ? "correct" : "incorrect"}">${isCorrect ? "✓ CORRECT" : "✗ INCORRECT"}</span>
        </div>
        <div style="margin-bottom: 0.5rem;">${q ? q.question_text : "Question details unavailable."}</div>
        <div style="font-size: 0.85rem; color: #475569;">
          <strong>Student Answer:</strong> ${selectedText} <br>
          <strong>Correct Answer:</strong> ${correctText}
        </div>
        ${q?.explanation ? `<div class="explanation"><strong>Medical Rationale:</strong> ${q.explanation}</div>` : ""}
      </div>
    `;
  }).join("")}
</body>
</html>
    `;

    const res = await saveStudentReportToOneDrive(
      activeStudent.name,
      activeStudent.group_name || "Renal",
      htmlContent
    );

    alert(res.message);
  };

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs
          segments={[
            { label: "Live Polling", path: "/polling" },
            { label: "Leaderboard", path: "/polling/leaderboard" },
            { label: "Student Report" },
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
        {/* Top Header & Selector */}
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
              <IconReportAnalytics size={32} color="#2563eb" />
              <h1 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>
                End-of-Rotation Performance Report
              </h1>
            </div>
            <p style={{ color: "var(--theme-neutral-600)", margin: "4px 0 0 0", fontSize: "0.9rem" }}>
              Detailed performance metrics, monthly timeline, and rationale breakdown.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Button
              variant="default"
              onClick={() => navigate("/polling/leaderboard")}
              leftSection={<IconArrowLeft size={16} />}
            >
              Leaderboard
            </Button>
            <Button
              onClick={handleExportHTMLReport}
              disabled={!activeStudent || detailedResponses.length === 0}
              leftSection={<IconDownload size={16} />}
            >
              Export Report (HTML)
            </Button>
          </div>
        </div>

        {/* Student Selector Card */}
        <Paper
          withBorder
          style={{
            padding: "1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: "260px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Select Student Profile:
            </label>
            <select
              value={activeStudent?.student_code || ""}
              onChange={(e) => setSelectedStudentCode(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border, #d1d5db)",
                background: "var(--color-bg-card, white)",
                color: "var(--color-text-main, #111827)",
                fontSize: "0.9rem",
              }}
            >
              {students.map((s) => (
                <option key={s.id || s.student_code} value={s.student_code}>
                  {s.name} ({s.student_code}) - {s.group_name}
                </option>
              ))}
            </select>
          </div>

          {activeStudent && (
            <div style={{ display: "flex", gap: "2rem", fontSize: "0.9rem", flexWrap: "wrap" }}>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block", fontSize: "0.75rem" }}>Student Code</span>
                <strong>{activeStudent.student_code}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block", fontSize: "0.75rem" }}>Group / Hospital</span>
                <strong>{activeStudent.group_name}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block", fontSize: "0.75rem" }}>First Poll Date</span>
                <strong>{firstPollDate ? new Date(firstPollDate).toLocaleDateString() : "N/A"}</strong>
              </div>
            </div>
          )}
        </Paper>

        {loading ? (
          <p>Generating student report...</p>
        ) : !activeStudent ? (
          <Paper withBorder style={{ padding: "3rem", textAlign: "center" }}>
            No registered students found. Register students via the Poll View to view performance reports.
          </Paper>
        ) : (
          <>
            {/* Scorecard Metrics Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
                marginBottom: "2rem",
              }}
            >
              <Paper withBorder style={{ padding: "1.25rem", textAlign: "center" }}>
                <IconFileText size={28} color="#2563eb" style={{ marginBottom: "4px" }} />
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--color-primary, #2563eb)" }}>
                  {uniquePollsCount}
                </div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                  Polls Completed
                </div>
              </Paper>

              <Paper withBorder style={{ padding: "1.25rem", textAlign: "center" }}>
                <IconCalendar size={28} color="#0891b2" style={{ marginBottom: "4px" }} />
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0891b2" }}>
                  {totalQuestions}
                </div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                  Questions Answered
                </div>
              </Paper>

              <Paper withBorder style={{ padding: "1.25rem", textAlign: "center" }}>
                <IconCheck size={28} color="#16a34a" style={{ marginBottom: "4px" }} />
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#16a34a" }}>
                  {totalCorrect}
                </div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                  Correct Responses
                </div>
              </Paper>

              <Paper withBorder style={{ padding: "1.25rem", textAlign: "center" }}>
                <IconAward size={28} color="#eab308" style={{ marginBottom: "4px" }} />
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#eab308" }}>
                  {accuracy}%
                </div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                  Overall Accuracy
                </div>
              </Paper>
            </div>

            {/* Monthly Progress Table */}
            {sortedMonthly.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ fontFamily: "var(--font-serif)", marginBottom: "1rem" }}>
                  Monthly Progression
                </h3>
                <Paper withBorder style={{ overflow: "hidden", borderRadius: "8px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ background: "var(--color-bg-secondary, #f8fafc)", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "10px 16px" }}>Month / Period</th>
                        <th style={{ padding: "10px 16px" }}>Questions Attempted</th>
                        <th style={{ padding: "10px 16px" }}>Correct Answers</th>
                        <th style={{ padding: "10px 16px" }}>Accuracy %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMonthly.map((m) => (
                        <tr key={m.monthYear} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600 }}>{m.monthYear}</td>
                          <td style={{ padding: "12px 16px" }}>{m.total}</td>
                          <td style={{ padding: "12px 16px", color: "#16a34a", fontWeight: 700 }}>{m.correct}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 700 }}>{m.acc}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Paper>
              </div>
            )}

            {/* Question History & Rationale */}
            <div>
              <h3 style={{ fontFamily: "var(--font-serif)", marginBottom: "1rem" }}>
                Detailed Question & Rationale History ({detailedResponses.length})
              </h3>

              {detailedResponses.length === 0 ? (
                <Paper withBorder style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No poll responses recorded yet for this student.
                </Paper>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {detailedResponses.map((item, index) => {
                    const q = item.question;
                    const isCorrect = item.response.is_correct || (q && item.response.selected_option_index === q.correct_option_index);
                    const selectedText = q && item.response.selected_option_index >= 0 ? q.options[item.response.selected_option_index] : "Skipped";
                    const correctText = q && q.correct_option_index !== null ? q.options[q.correct_option_index] : "N/A";

                    return (
                      <Paper key={item.response.id || index} withBorder style={{ padding: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>
                            {item.poll?.title || "Poll Question"} • {new Date(item.response.created_at).toLocaleDateString()}
                          </div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              background: isCorrect ? "rgba(22, 163, 74, 0.1)" : "rgba(220, 38, 38, 0.1)",
                              color: isCorrect ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {isCorrect ? <IconCheck size={14} /> : <IconX size={14} />}
                            {isCorrect ? "CORRECT" : "INCORRECT"}
                          </span>
                        </div>

                        <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                          {q ? parse(q.question_text) : "Question details unavailable"}
                        </div>

                        <div style={{ fontSize: "0.85rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "0.75rem" }}>
                          <div style={{ padding: "8px", background: "var(--color-bg-secondary, #f8fafc)", borderRadius: "4px" }}>
                            <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Student's Choice:</span>
                            <strong style={{ color: isCorrect ? "#16a34a" : "#dc2626" }}>{selectedText}</strong>
                          </div>
                          <div style={{ padding: "8px", background: "rgba(22, 163, 74, 0.05)", borderRadius: "4px" }}>
                            <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Correct Choice:</span>
                            <strong style={{ color: "#16a34a" }}>{correctText}</strong>
                          </div>
                        </div>

                        {q?.explanation && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              padding: "10px 14px",
                              backgroundColor: "rgba(37, 99, 235, 0.05)",
                              borderLeft: "4px solid #2563eb",
                              borderRadius: "4px",
                              fontSize: "0.85rem",
                            }}
                          >
                            <strong>Medical Rationale:</strong> {q.explanation}
                          </div>
                        )}
                      </Paper>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
