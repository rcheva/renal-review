import { Button, Paper } from "@/components/ui";
import { supabase } from "@/logic/supabase";
import { IconCheck, IconDownload, IconWifi, IconWifiOff, IconCloudUpload } from "@tabler/icons-react";
import parse from "html-react-parser";
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Poll, Question, Student } from "./types";
import StudentAuthModal from "./StudentAuthModal";
import {
  getCurrentSessionStudent,
  queueOfflineResponse,
  flushOfflineResponsesQueue,
  getOfflineResponsesQueue,
  cachePollAndQuestions,
  getCachedPollAndQuestions,
} from "./pollingStore";

export default function StudentPollView() {
  const { pollId } = useParams();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [activeStudent, setActiveStudent] = useState<Student | null>(() => getCurrentSessionStudent());
  const [showAuthModal, setShowAuthModal] = useState(!getCurrentSessionStudent());

  const [studentName, setStudentName] = useState("");
  const [hospital, setHospital] = useState("Renal");
  const [hasStarted, setHasStarted] = useState(false);
  const [studentResponses, setStudentResponses] = useState<
    Record<string, number>
  >({});
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [offlineNotice, setOfflineNotice] = useState<string>("");

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const synced = await flushOfflineResponsesQueue();
      if (synced > 0) {
        setOfflineNotice(`✅ Automatically synced ${synced} offline answer(s) to cloud!`);
        setTimeout(() => setOfflineNotice(""), 4000);
      }
      setPendingOfflineCount(getOfflineResponsesQueue().length);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setPendingOfflineCount(getOfflineResponsesQueue().length);

    if (navigator.onLine) {
      flushOfflineResponsesQueue().then((synced) => {
        if (synced > 0) {
          setOfflineNotice(`✅ Synced ${synced} pending offline answer(s)`);
          setTimeout(() => setOfflineNotice(""), 4000);
        }
        setPendingOfflineCount(getOfflineResponsesQueue().length);
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (activeStudent) {
      setStudentName(activeStudent.name);
      setHospital(activeStudent.group_name || "Renal");
    }
  }, [activeStudent]);

  useEffect(() => {
    if (pollId) {
      fetchData();
    }
  }, [pollId]);

  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      const q = questions[currentQuestionIndex];
      if (q && q.options) {
        const indices = q.options.map((_, i) => i);
        // Fisher-Yates shuffle
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setShuffledIndices(indices);
      }
    }
  }, [currentQuestionIndex, questions]);

  const fetchData = async () => {
    if (!pollId) return;

    // 1. Local / Cache fallback FIRST
    const cached = getCachedPollAndQuestions(pollId);
    let fallbackPoll = cached.poll;
    let fallbackQuestions = cached.questions || [];

    if (!fallbackPoll) {
      const localPollsStr = localStorage.getItem("renal_review_polls");
      if (localPollsStr) {
        try {
          const localPolls = JSON.parse(localPollsStr);
          fallbackPoll = localPolls.find((p: any) => p.id === pollId) || null;
        } catch {}
      }
    }

    if (!fallbackQuestions || fallbackQuestions.length === 0) {
      const localQStr = localStorage.getItem(`renal_questions_${pollId}`);
      if (localQStr) {
        try {
          fallbackQuestions = JSON.parse(localQStr);
        } catch {}
      }
    }

    if (fallbackPoll) {
      setPoll(fallbackPoll);
      setQuestions(fallbackQuestions || []);
    }

    // 2. Cloud sync in background with timeout safety
    try {
      const fetchCloud = async () => {
        const { data: pollData, error: pollError } = await supabase
          .from("polls")
          .select("*")
          .eq("id", pollId)
          .single();

        if (pollError || !pollData) return null;

        const { data: questionData } = await supabase
          .from("questions")
          .select("*")
          .eq("poll_id", pollId)
          .order("created_at", { ascending: true });

        return {
          poll: pollData as Poll,
          questions: (questionData as Question[]) || [],
        };
      };

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 2000)
      );

      const cloudResult = await Promise.race([fetchCloud(), timeoutPromise]);

      if (cloudResult && cloudResult.poll) {
        setPoll(cloudResult.poll);
        setQuestions(cloudResult.questions);
        cachePollAndQuestions(cloudResult.poll, cloudResult.questions);
      } else if (!fallbackPoll) {
        setError("Poll not found or offline cache unavailable.");
      }
    } catch {
      if (!fallbackPoll) {
        setError("Poll not found or offline cache unavailable.");
      }
    }
  };

  const handleOptionClick = async (originalIndex: number) => {
    if (hasSubmitted) return;
    setHasSubmitted(true);

    const q = questions[currentQuestionIndex];
    const isCorrect = q.correct_option_index !== null && originalIndex === q.correct_option_index;

    setStudentResponses((prev) => ({ ...prev, [q.id]: originalIndex }));

    const responsePayload = {
      question_id: q.id,
      selected_option_index: originalIndex,
      respondent_name: activeStudent ? activeStudent.name : studentName.trim() || null,
      hospital: activeStudent ? activeStudent.group_name : hospital.trim() || null,
      student_id: activeStudent ? activeStudent.student_code : null,
      is_correct: isCorrect,
    };

    let savedToCloud = false;

    if (navigator.onLine) {
      try {
        const { error: insErr } = await supabase.from("responses").insert([responsePayload]);
        if (!insErr) savedToCloud = true;
      } catch (e) {
        console.warn("Could not insert response into Supabase", e);
      }
    }

    if (!savedToCloud) {
      queueOfflineResponse(responsePayload);
      setPendingOfflineCount(getOfflineResponsesQueue().length);
      setOfflineNotice("⚡ Saved offline! Will sync automatically when connection restores.");
      setTimeout(() => setOfflineNotice(""), 3500);
    }

    // Always preserve local backup of responses for leaderboard & reports fallback
    try {
      const LOCAL_RESPONSES_KEY = "renal_review_responses";
      const existingStr = localStorage.getItem(LOCAL_RESPONSES_KEY);
      const existing = existingStr ? JSON.parse(existingStr) : [];
      existing.push({
        ...responsePayload,
        id: "resp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(LOCAL_RESPONSES_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn("Could not save response locally", e);
    }

    setCurrentQuestionIndex((prev) => prev + 1);
    setHasSubmitted(false);
  };

  const handleDownloadKey = async () => {
    if (!poll || questions.length === 0) return;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${poll.title} - Answer Key</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; line-height: 1.6; }
    h1 { border-bottom: 2px solid #eaeaea; padding-bottom: 0.5rem; }
    .question { margin-bottom: 2rem; background: #f9fafb; padding: 1.5rem; border-radius: 8px; border: 1px solid #e5e7eb; }
    .question h3 { margin-top: 0; }
    ul { list-style-type: none; padding: 0; }
    li { padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 4px; background: white; border: 1px solid #e5e7eb; }
    .correct { background-color: #d1fae5; border-color: #10b981; color: #047857; font-weight: bold; }
    .explanation { margin-top: 1rem; padding: 1rem; background-color: #e0f2fe; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Answer Key: ${poll.title}</h1>
  ${questions
    .map(
      (q, i) => `
    <div class="question">
      <h3>${i + 1}. ${q.question_text}</h3>
      <ul>
        ${q.options
          .map((opt, optIndex) => {
            if (optIndex === q.correct_option_index) {
              return `<li class="correct">✓ ${opt}</li>`;
            }
            return `<li>${opt}</li>`;
          })
          .join("")}
      </ul>
      ${q.explanation ? `<div class="explanation"><strong>Explanation:</strong> ${q.explanation}</div>` : ""}
    </div>
  `
    )
    .join("")}
</body>
</html>
    `;

    try {
      const isTauri =
        window.location.origin.includes("tauri://") ||
        window.location.origin.includes("file://") ||
        (window as any).__TAURI_INTERNALS__;

      if (isTauri) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");

        const filePath = await save({
          filters: [{ name: "HTML Document", extensions: ["html"] }],
          defaultPath: `${poll.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_answer_key.html`,
        });

        if (filePath) {
          await writeTextFile(filePath, htmlContent);
        }
      } else {
        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${poll.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_answer_key.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Error saving file:", err);
      alert(
        "Failed to save file. If you are on desktop, ensure you have permission to write to that directory."
      );
    }
  };

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "var(--theme-neutral-50)",
        }}
      >
        <Paper
          withBorder
          style={{ padding: "2rem", textAlign: "center", maxWidth: 400 }}
        >
          <h2 style={{ color: "var(--theme-red-600)" }}>Oops!</h2>
          <p>{error}</p>
        </Paper>
      </div>
    );
  }

  if (!poll || questions.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        Loading poll...
      </div>
    );
  }

  if (poll.status === "closed" || currentQuestionIndex >= questions.length) {
    const isClosed = poll.status === "closed";
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          minHeight: "100vh",
          backgroundColor: "var(--theme-neutral-50)",
          padding: "2rem 1rem",
        }}
      >
        <Paper
          withBorder
          style={{ width: "100%", maxWidth: 800, padding: "2rem" }}
        >
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            {isClosed ? (
              <>
                <h1
                  style={{
                    fontFamily: "var(--font-serif)",
                    marginBottom: "0.5rem",
                  }}
                >
                  This poll is closed
                </h1>
                <p style={{ color: "var(--theme-neutral-600)" }}>
                  You can no longer submit responses, but you can review the
                  answer key below.
                </p>
              </>
            ) : (
              <>
                <IconCheck
                  size={48}
                  color="var(--theme-primary-500)"
                  style={{ marginBottom: "1rem" }}
                />
                <h1
                  style={{
                    fontFamily: "var(--font-serif)",
                    marginBottom: "0.5rem",
                  }}
                >
                  You're all done!
                </h1>
                <p style={{ color: "var(--theme-neutral-600)" }}>
                  Thank you for participating. Here is the answer key for your
                  review.
                </p>
              </>
            )}
            <div style={{ marginTop: "1.5rem" }}>
              <Button
                variant="default"
                leftSection={<IconDownload size={16} />}
                onClick={handleDownloadKey}
              >
                Download HTML Answer Key
              </Button>
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {questions.map((q, i) => (
              <div
                key={q.id}
                style={{
                  padding: "1.5rem",
                  backgroundColor: "var(--theme-card-bg)",
                  borderRadius: "8px",
                  border: "1px solid var(--theme-neutral-200)",
                }}
              >
                <div
                  style={{
                    margin: "0 0 1rem 0",
                    fontSize: "1.125rem",
                    lineHeight: 1.4,
                    fontWeight: "bold",
                  }}
                >
                  {i + 1}. {parse(q.question_text)}
                </div>
                <ul
                  style={{
                    listStyleType: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {q.options.map((opt, optIndex) => {
                    const isCorrect = optIndex === q.correct_option_index;
                    const isSelected = studentResponses[q.id] === optIndex;

                    let bgColor = "var(--theme-neutral-50)";
                    let borderColor = "var(--theme-neutral-200)";
                    let textColor = "inherit";

                    if (isCorrect) {
                      bgColor = "var(--theme-primary-50)";
                      borderColor = "var(--theme-primary-200)";
                      textColor = "var(--theme-primary-800)";
                    } else if (isSelected) {
                      bgColor = "var(--theme-red-50)";
                      borderColor = "var(--theme-red-200)";
                      textColor = "var(--theme-red-800)";
                    }

                    return (
                      <li
                        key={optIndex}
                        style={{
                          padding: "0.75rem",
                          borderRadius: "6px",
                          backgroundColor: bgColor,
                          border: `1px solid ${borderColor}`,
                          color: textColor,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontWeight: isCorrect || isSelected ? 600 : 400,
                        }}
                      >
                        {isCorrect && (
                          <IconCheck
                            size={18}
                            color="var(--theme-primary-600)"
                          />
                        )}
                        {isSelected && !isCorrect && (
                          <strong
                            style={{
                              color: "var(--theme-red-600)",
                              padding: "0 2px",
                            }}
                          >
                            ✕
                          </strong>
                        )}
                        {opt}
                        {isSelected && (
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: "0.75rem",
                              color: isCorrect
                                ? "var(--theme-primary-700)"
                                : "var(--theme-red-700)",
                              fontWeight: "bold",
                            }}
                          >
                            YOUR ANSWER
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {studentResponses[q.id] === -1 && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      color: "var(--theme-neutral-500)",
                      fontSize: "0.875rem",
                      fontStyle: "italic",
                      padding: "0.5rem",
                      backgroundColor: "var(--theme-neutral-100)",
                      borderRadius: "4px",
                    }}
                  >
                    You skipped this question.
                  </div>
                )}
                {q.explanation && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      backgroundColor: "var(--theme-blue-50)",
                      borderLeft: "4px solid var(--theme-blue-500)",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                    }}
                  >
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Paper>
      </div>
    );
  }

  if (!hasStarted && poll.status === "active") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "var(--theme-neutral-50)",
        }}
      >
        <Paper
          withBorder
          style={{ padding: "3rem", maxWidth: 500, width: "100%" }}
        >
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              marginBottom: "1rem",
              textAlign: "center",
            }}
          >
            Join Poll
          </h1>
          <p
            style={{
              color: "var(--theme-neutral-600)",
              marginBottom: "2rem",
              textAlign: "center",
            }}
          >
            Authenticated as <strong>{activeStudent?.name || "Student"}</strong> ({activeStudent?.student_code || "Guest"}) - Group: {activeStudent?.group_name || "Renal"}
          </p>

          <StudentAuthModal
            isOpen={showAuthModal || !activeStudent}
            onAuthenticated={(student) => {
              setActiveStudent(student);
              setStudentName(student.name);
              setHospital(student.group_name);
              setShowAuthModal(false);
              setHasStarted(true);
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              marginBottom: "2rem",
            }}
          >
            <div style={{ padding: "12px", background: "#f3f4f6", borderRadius: "6px", fontSize: "0.9rem" }}>
              <div><strong>Student ID:</strong> {activeStudent?.student_code}</div>
              <div><strong>Name:</strong> {activeStudent?.name}</div>
              <div><strong>Group:</strong> {activeStudent?.group_name}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-primary, #2563eb)",
                fontSize: "0.85rem",
                cursor: "pointer",
                textAlign: "center",
                textDecoration: "underline",
              }}
            >
              Switch Student / Enter PIN
            </button>
          </div>
          <Button
            size="lg"
            style={{ width: "100%" }}
            onClick={() => setHasStarted(true)}
          >
            Start Poll
          </Button>
        </Paper>
      </div>
    );
  }

  const q = questions[currentQuestionIndex];
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
  const optionLetters = ["A", "B", "C", "D", "E", "F", "G"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "var(--theme-neutral-50)",
        padding: "1rem",
      }}
    >
      {/* Offline Network Status Banner */}
      {(!isOnline || pendingOfflineCount > 0 || offlineNotice) && (
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            padding: "10px 16px",
            borderRadius: "10px",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: !isOnline
              ? "#fff7ed"
              : pendingOfflineCount > 0
              ? "#eff6ff"
              : "#f0fdf4",
            border: !isOnline
              ? "1px solid #fdba74"
              : pendingOfflineCount > 0
              ? "1px solid #93c5fd"
              : "1px solid #86efac",
            color: !isOnline
              ? "#c2410c"
              : pendingOfflineCount > 0
              ? "#1d4ed8"
              : "#15803d",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {!isOnline ? (
              <IconWifiOff size={18} color="#c2410c" />
            ) : pendingOfflineCount > 0 ? (
              <IconCloudUpload size={18} color="#1d4ed8" />
            ) : (
              <IconWifi size={18} color="#15803d" />
            )}
            <span>
              {offlineNotice ||
                (!isOnline
                  ? `Offline Mode — Answers saved locally (${pendingOfflineCount} queued)`
                  : pendingOfflineCount > 0
                  ? `Syncing ${pendingOfflineCount} offline response(s) to cloud...`
                  : "Online — All responses synced")}
            </span>
          </div>
        </div>
      )}

      <Paper
        key={q.id}
        withBorder
        style={{
          width: "100%",
          maxWidth: 640,
          padding: "2rem",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Progress Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#2563eb" }}>
            <span>QUESTION {currentQuestionIndex + 1} OF {questions.length}</span>
            <span style={{ color: "#64748b" }}>{activeStudent?.name} ({activeStudent?.group_name || "Renal"})</span>
          </div>
          <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)",
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Question Text */}
        <div
          style={{
            fontSize: "1.35rem",
            marginBottom: "2rem",
            lineHeight: 1.45,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {parse(q.question_text)}
        </div>

        {/* Shuffled Options List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {shuffledIndices.map((originalIndex, optIdx) => {
            const opt = q.options[originalIndex];
            const letter = optionLetters[optIdx] || String(optIdx + 1);

            return (
              <button
                key={`${q.id}-${originalIndex}`}
                onClick={() => handleOptionClick(originalIndex)}
                className="option-button-modern"
                disabled={hasSubmitted}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "rgba(37, 99, 235, 0.1)",
                      color: "#2563eb",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      flexShrink: 0,
                    }}
                  >
                    {letter}
                  </span>
                  <span>{opt}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Skip Button */}
        <div
          style={{
            marginTop: "1.75rem",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Button
            variant="subtle"
            onClick={() => handleOptionClick(-1)}
            disabled={hasSubmitted}
            style={{ color: "#64748b" }}
          >
            Leave Blank / Skip Question
          </Button>
        </div>
      </Paper>
    </div>
  );
}
