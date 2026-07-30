import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { Paper, Button, TextInput } from "@/components/ui";
import { supabase } from "@/logic/supabase";
import {
  IconBrandWhatsapp,
  IconChartBar,
  IconCopy,
  IconRefresh,
  IconTrophy,
  IconPlayerPlay,
  IconPlayerPause,
  IconRotate,
  IconClock,
  IconEye,
  IconEyeOff,
  IconMoon,
  IconSun,
  IconCheck,
  IconMaximize,
  IconMinimize,
} from "@tabler/icons-react";
import parse from "html-react-parser";
import { QRCodeSVG } from "qrcode.react";
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { KidneyMedal } from "./KidneyMedal";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeaderContent } from "../shell/Header/Header";
import { Poll, Question, Response } from "./types";
import "./PollingGlassmorphism.css";

export default function LiveResultsView() {
  const { pollId } = useParams();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [activeTab, setActiveTab] = useState<"charts" | "leaderboard">("charts");

  // Modern UI & Timer States
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hideLiveVotes, setHideLiveVotes] = useState(false);
  const [revealRationaleMap, setRevealRationaleMap] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && !isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => setIsFullscreen(true));
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Countdown Timer State
  const [timerDuration, setTimerDuration] = useState<number>(60);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pollId) {
      fetchData();

      const channel = supabase
        .channel("public:responses")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "responses" },
          (payload) => {
            const newResponse = payload.new as Response;
            setResponses((prev) => [...prev, newResponse]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [pollId]);

  // Countdown Timer Logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLeft]);

  const startTimer = (secs?: number) => {
    const duration = secs || timerDuration;
    setTimerDuration(duration);
    setTimeLeft(duration);
    setIsTimerRunning(true);
  };

  const pauseTimer = () => setIsTimerRunning(false);
  const resumeTimer = () => {
    if (timeLeft > 0) setIsTimerRunning(true);
  };
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(timerDuration);
  };

  const fetchData = async () => {
    const { data: pollData } = await supabase
      .from("polls")
      .select("*")
      .eq("id", pollId)
      .single();
    if (pollData) setPoll(pollData as Poll);

    const { data: questionData } = await supabase
      .from("questions")
      .select("*")
      .eq("poll_id", pollId)
      .order("created_at", { ascending: true });
    if (questionData) setQuestions(questionData as Question[]);

    if (questionData && questionData.length > 0) {
      const qIds = questionData.map((q: any) => q.id);
      const { data: responseData } = await supabase
        .from("responses")
        .select("*")
        .in("question_id", qIds);
      if (responseData) setResponses(responseData as Response[]);
    }
  };

  const togglePollStatus = async () => {
    if (!poll) return;
    const newStatus = poll.status === "active" ? "closed" : "active";
    await supabase.from("polls").update({ status: newStatus }).eq("id", poll.id);
    setPoll({ ...poll, status: newStatus });
  };

  const handleResetResults = async () => {
    if (!poll || questions.length === 0) return;
    if (
      window.confirm(
        "Are you sure you want to delete ALL responses for this poll? This cannot be undone."
      )
    ) {
      const qIds = questions.map((q) => q.id);
      await supabase.from("responses").delete().in("question_id", qIds);
      setResponses([]);
    }
  };

  const toggleRevealRationale = (qId: string) => {
    setRevealRationaleMap((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  if (!poll) return <p style={{ padding: "2rem" }}>Loading presenter live results...</p>;

  const origin =
    window.location.origin.includes("tauri://") || window.location.origin.includes("file://")
      ? "https://rcheva.github.io/renal-review"
      : window.location.origin;
  const pollUrl = `${origin}/#/poll/${poll.id}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Join my live poll: ${poll.title}\n\n${pollUrl}`)}`;

  const timerPercent = (timeLeft / timerDuration) * 100;

  return (
    <div
      ref={containerRef}
      className={isDarkMode ? "dark-presenter-mode" : ""}
      style={{
        minHeight: isFullscreen ? "100vh" : "auto",
        background: isDarkMode ? "#0f172a" : isFullscreen ? "#f8fafc" : "transparent",
        padding: isFullscreen ? "2rem" : "0",
        overflowY: isFullscreen ? "auto" : "visible",
      }}
    >
      {!isFullscreen && (
        <AppHeaderContent>
          <AppBreadcrumbs
            segments={[
              { label: "Live Polling", path: "/polling" },
              { label: `${poll.title} - Presenter View` },
            ]}
          />
        </AppHeaderContent>
      )}

      <div
        style={{
          width: "100%",
          maxWidth: isFullscreen ? "100%" : "1400px",
          margin: "0 auto",
          padding: isFullscreen ? "0" : "20px 1.5rem",
        }}
      >
        {/* Header Bar */}
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
              <h1 style={{ fontFamily: "var(--font-serif)", margin: 0, fontSize: isFullscreen ? "2.2rem" : "1.8rem" }}>
                {poll.title}
              </h1>
              <span
                className="pulse-badge"
                style={{
                  background: poll.status === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: poll.status === "active" ? "#10b981" : "#ef4444",
                }}
              >
                {poll.status === "active" && <span className="pulse-dot" />}
                {poll.status === "active" ? "LIVE VOTING OPEN" : "POLL CLOSED"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", color: isDarkMode ? "#94a3b8" : "#64748b", fontSize: "0.95rem" }}>
              Category: <strong>{poll.group_name || "Renal"}</strong> • Total Responses: <strong>{responses.length}</strong>
            </p>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button
              variant="default"
              leftSection={isFullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? "Exit Full Screen" : "Full Screen Mode"}
            </Button>

            <Button
              variant="default"
              leftSection={isDarkMode ? <IconSun size={18} color="#f59e0b" /> : <IconMoon size={18} />}
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? "Light Mode" : "Dark Presentation Mode"}
            </Button>

            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={handleResetResults}
            >
              Reset Responses
            </Button>

            <Button
              onClick={togglePollStatus}
              style={{
                backgroundColor: poll.status === "active" ? "#dc2626" : "#16a34a",
                color: "white",
                fontWeight: "bold",
              }}
            >
              {poll.status === "active" ? "Close Voting" : "Open Voting"}
            </Button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <Button
            variant={activeTab === "charts" ? "default" : "subtle"}
            onClick={() => setActiveTab("charts")}
            leftSection={<IconChartBar size={18} />}
          >
            Questions & Live Charts
          </Button>
          <Button
            variant={activeTab === "leaderboard" ? "default" : "subtle"}
            onClick={() => setActiveTab("leaderboard")}
            leftSection={<IconTrophy size={18} color="#eab308" />}
          >
            Kidney Medal Leaderboard {poll.status === "closed" ? "🏆 (Poll Closed)" : ""}
          </Button>
        </div>

        {/* Presenter Countdown Timer Card */}
        <Paper
          withBorder
          className={isDarkMode ? "glass-card" : ""}
          style={{
            padding: "1.25rem",
            marginBottom: "1.5rem",
            borderRadius: "12px",
            background: isDarkMode ? "var(--poll-glass-bg)" : "white",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <IconClock size={24} color={timeLeft <= 10 ? "#ef4444" : "#06b6d4"} />
              <div>
                <span style={{ fontSize: "0.8rem", color: isDarkMode ? "#94a3b8" : "#64748b", fontWeight: 600 }}>
                  PRESENTER QUESTION TIMER
                </span>
                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 800,
                    fontFamily: "monospace",
                    color: timeLeft <= 10 ? "#ef4444" : isDarkMode ? "#f8fafc" : "#0f172a",
                  }}
                >
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                </div>
              </div>
            </div>

            {/* Timer Presets */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: isDarkMode ? "#94a3b8" : "#64748b" }}>Presets:</span>
              {[30, 60, 90, 120].map((s) => (
                <button
                  key={s}
                  onClick={() => startTimer(s)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border, #cbd5e1)",
                    background: timerDuration === s ? "#2563eb" : "transparent",
                    color: timerDuration === s ? "white" : isDarkMode ? "#e2e8f0" : "#1e293b",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  {s}s
                </button>
              ))}
            </div>

            {/* Timer Control Buttons */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {isTimerRunning ? (
                <Button variant="default" onClick={pauseTimer} leftSection={<IconPlayerPause size={16} />}>
                  Pause
                </Button>
              ) : (
                <Button variant="default" onClick={resumeTimer} leftSection={<IconPlayerPlay size={16} />}>
                  {timeLeft === timerDuration ? "Start" : "Resume"}
                </Button>
              )}
              <Button variant="subtle" onClick={resetTimer} leftSection={<IconRotate size={16} />}>
                Reset
              </Button>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="timer-bar-container">
            <div
              className={`timer-bar-fill ${timeLeft <= 10 ? "warning" : ""}`}
              style={{ width: `${Math.max(0, timerPercent)}%` }}
            />
          </div>
        </Paper>

        {/* Student Connection & Share Link */}
        <Paper
          withBorder
          className={isDarkMode ? "glass-card" : ""}
          style={{
            padding: "1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            borderRadius: "12px",
            background: isDarkMode ? "var(--poll-glass-bg)" : "white",
          }}
        >
          <div style={{ background: "white", padding: "6px", borderRadius: "8px" }}>
            <QRCodeSVG value={pollUrl} size={90} level="M" />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: isDarkMode ? "#cbd5e1" : "#475569" }}>
              Student Poll Access URL & QR Code:
            </span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <TextInput value={pollUrl} readOnly style={{ flex: 1 }} />
              <Button
                variant="default"
                leftSection={<IconCopy size={16} />}
                onClick={() => navigator.clipboard.writeText(pollUrl)}
              >
                Copy URL
              </Button>
              <Button
                variant="default"
                leftSection={<IconBrandWhatsapp size={16} color="#25D366" />}
                onClick={() => window.open(whatsappUrl, "_blank")}
              >
                Share WhatsApp
              </Button>
            </div>
          </div>
        </Paper>

        {/* View Toggle Tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
            borderBottom: "1px solid rgba(226, 232, 240, 0.2)",
            paddingBottom: "0.75rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Button
              variant={activeTab === "charts" ? "primary" : "default"}
              leftSection={<IconChartBar size={16} />}
              onClick={() => setActiveTab("charts")}
            >
              Live Charts
            </Button>
            <Button
              variant={activeTab === "leaderboard" ? "primary" : "default"}
              leftSection={<IconTrophy size={16} />}
              onClick={() => setActiveTab("leaderboard")}
            >
              Participant Leaderboard
            </Button>
          </div>

          {activeTab === "charts" && (
            <Button
              variant="subtle"
              leftSection={hideLiveVotes ? <IconEye size={16} /> : <IconEyeOff size={16} />}
              onClick={() => setHideLiveVotes(!hideLiveVotes)}
            >
              {hideLiveVotes ? "Show Live Votes" : "Hide Votes Until Revealed"}
            </Button>
          )}
        </div>

        {/* Charts View */}
        {activeTab === "charts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {questions.map((q, i) => {
              const qResponses = responses.filter((r) => r.question_id === q.id);
              const isRationaleRevealed = revealRationaleMap[q.id];

              const data = q.options.map((opt, optIndex) => {
                const count = qResponses.filter((r) => r.selected_option_index === optIndex).length;
                const percentage = qResponses.length > 0 ? Math.round((count / qResponses.length) * 100) : 0;
                return {
                  name: `Option ${optIndex + 1}`,
                  text: opt,
                  count: hideLiveVotes && !isRationaleRevealed ? 0 : count,
                  percentage,
                  isCorrect: q.correct_option_index === optIndex,
                };
              });

              return (
                <Paper
                  key={q.id}
                  withBorder
                  className={isDarkMode ? "glass-card" : ""}
                  style={{
                    padding: "1.5rem",
                    borderRadius: "12px",
                    background: isDarkMode ? "var(--poll-glass-bg)" : "white",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "1rem",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "0.8rem", color: isDarkMode ? "#38bdf8" : "#2563eb", fontWeight: 700 }}>
                        QUESTION {i + 1} OF {questions.length}
                      </span>
                      <h3 style={{ margin: "4px 0 0 0", fontSize: "1.25rem", color: isDarkMode ? "#f8fafc" : "#0f172a" }}>
                        {parse(q.question_text)}
                      </h3>
                    </div>

                    <Button
                      variant={isRationaleRevealed ? "primary" : "default"}
                      onClick={() => toggleRevealRationale(q.id)}
                      leftSection={isRationaleRevealed ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    >
                      {isRationaleRevealed ? "Hide Answer & Rationale" : "Reveal Answer & Rationale"}
                    </Button>
                  </div>

                  {/* Option List Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "0.75rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    {q.options.map((opt, optIndex) => {
                      const isCorrect = isRationaleRevealed && q.correct_option_index === optIndex;
                      return (
                        <div
                          key={optIndex}
                          style={{
                            padding: "0.75rem 1rem",
                            borderRadius: "8px",
                            border: isCorrect
                              ? "2px solid #10b981"
                              : isDarkMode
                              ? "1px solid rgba(255, 255, 255, 0.1)"
                              : "1px solid #e2e8f0",
                            background: isCorrect
                              ? "rgba(16, 185, 129, 0.15)"
                              : isDarkMode
                              ? "rgba(30, 41, 59, 0.5)"
                              : "#f8fafc",
                            color: isDarkMode ? "#f1f5f9" : "#0f172a",
                            fontSize: "0.9rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <strong style={{ color: isCorrect ? "#10b981" : isDarkMode ? "#38bdf8" : "#2563eb" }}>
                              Option {optIndex + 1}:
                            </strong>{" "}
                            {opt}
                          </div>
                          {isCorrect && <IconCheck size={18} color="#10b981" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bar Chart Container */}
                  <div style={{ height: 260, width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                        <XAxis dataKey="name" stroke={isDarkMode ? "#94a3b8" : "#64748b"} />
                        <YAxis allowDecimals={false} stroke={isDarkMode ? "#94a3b8" : "#64748b"} />
                        <RechartsTooltip
                          contentStyle={{
                            background: isDarkMode ? "#0f172a" : "#ffffff",
                            borderColor: isDarkMode ? "#334155" : "#cbd5e1",
                            color: isDarkMode ? "#f8fafc" : "#0f172a",
                            borderRadius: "8px",
                          }}
                          formatter={(value, name, props) => [
                            `${value} votes (${props.payload.percentage}%)`,
                            props.payload.text,
                          ]}
                        />
                        <Bar dataKey="count" name="Votes" radius={[6, 6, 0, 0]}>
                          <LabelList
                            dataKey="count"
                            position="top"
                            fill={isDarkMode ? "#f8fafc" : "#0f172a"}
                            formatter={(v: any) => (Number(v) > 0 ? `${v} (${data.find(d => d.count === Number(v))?.percentage || 0}%)` : "")}
                          />
                          {data.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                isRationaleRevealed
                                  ? entry.isCorrect
                                    ? "#10b981"
                                    : "#ef4444"
                                  : isDarkMode
                                  ? "#06b6d4"
                                  : "#2563eb"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Medical Rationale Box */}
                  {isRationaleRevealed && q.explanation && (
                    <div
                      style={{
                        marginTop: "1.25rem",
                        padding: "1rem 1.25rem",
                        borderRadius: "8px",
                        background: isDarkMode ? "rgba(6, 182, 212, 0.1)" : "rgba(37, 99, 235, 0.08)",
                        borderLeft: "4px solid #06b6d4",
                        color: isDarkMode ? "#e0f2fe" : "#1e3a8a",
                        fontSize: "0.9rem",
                      }}
                    >
                      <strong style={{ color: "#06b6d4", display: "block", marginBottom: "4px" }}>
                        Medical Rationale & Clinical Rationale:
                      </strong>
                      {q.explanation}
                    </div>
                  )}
                </Paper>
              );
            })}
          </div>
        )}

        {/* Participant Leaderboard View */}
        {activeTab === "leaderboard" &&
          (() => {
            const participantMap = new Map<
              string,
              {
                name: string;
                hospital: string;
                score: number;
                totalAnswered: number;
              }
            >();

            responses.forEach((r) => {
              const key = `${r.respondent_name || "Anonymous"}-${r.hospital || "Unknown"}`;
              if (!participantMap.has(key)) {
                participantMap.set(key, {
                  name: r.respondent_name || "Anonymous",
                  hospital: r.hospital || "Unknown",
                  score: 0,
                  totalAnswered: 0,
                });
              }

              const p = participantMap.get(key)!;
              const q = questions.find((question) => question.id === r.question_id);

              if (q) {
                p.totalAnswered++;
                if (r.selected_option_index === q.correct_option_index) {
                  p.score++;
                }
              }
            });

            const leaderboard = Array.from(participantMap.values()).sort((a, b) => b.score - a.score);

            return (
              <Paper
                withBorder
                className={isDarkMode ? "glass-card" : ""}
                style={{
                  padding: "2rem",
                  borderRadius: "12px",
                  background: isDarkMode ? "var(--poll-glass-bg)" : "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0, color: isDarkMode ? "#f8fafc" : "#0f172a" }}>
                      🏆 Live Participant Leaderboard & Kidney Medals
                    </h2>
                    <p style={{ margin: "4px 0 0 0", color: isDarkMode ? "#94a3b8" : "#64748b", fontSize: "0.85rem" }}>
                      Top 3 performers receive Gold, Silver, and Bronze Kidney Medals based on total score and accuracy.
                    </p>
                  </div>
                </div>

                {leaderboard.length === 0 ? (
                  <p style={{ color: isDarkMode ? "#94a3b8" : "#64748b", textAlign: "center", padding: "2rem" }}>
                    No participant answers submitted yet.
                  </p>
                ) : (
                  <>
                    {/* Kidney Medals Podium */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-end",
                        gap: "1.5rem",
                        margin: "1.5rem 0 2.5rem 0",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Silver #2 */}
                      {leaderboard[1] && (
                        <div style={{ textAlign: "center", width: "210px" }}>
                          <div style={{ marginBottom: "8px" }}>
                            <KidneyMedal rank={2} size={64} />
                          </div>
                          <div
                            style={{
                              background: isDarkMode
                                ? "linear-gradient(180deg, rgba(51, 65, 85, 0.6) 0%, rgba(30, 41, 59, 0.8) 100%)"
                                : "linear-gradient(180deg, rgba(241, 245, 249, 0.9) 0%, rgba(203, 213, 225, 0.4) 100%)",
                              borderRadius: "14px",
                              padding: "1.1rem",
                              border: "1px solid #94a3b8",
                              boxShadow: "0 8px 20px rgba(148, 163, 184, 0.2)",
                            }}
                          >
                            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94a3b8", letterSpacing: "1px" }}>
                              🥈 2ND PLACE
                            </div>
                            <div style={{ fontWeight: 800, fontSize: "1.15rem", marginTop: "4px", color: isDarkMode ? "#f8fafc" : "#0f172a" }}>
                              {leaderboard[1].name}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: isDarkMode ? "#cbd5e1" : "#64748b" }}>
                              {leaderboard[1].hospital}
                            </div>
                            <div style={{ marginTop: "8px", fontWeight: 800, color: "#2563eb", fontSize: "1.25rem" }}>
                              {leaderboard[1].score} / {questions.length}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Gold #1 */}
                      {leaderboard[0] && (
                        <div style={{ textAlign: "center", width: "240px" }}>
                          <div style={{ marginBottom: "8px" }}>
                            <KidneyMedal rank={1} size={84} />
                          </div>
                          <div
                            style={{
                              background: isDarkMode
                                ? "linear-gradient(180deg, rgba(133, 77, 14, 0.5) 0%, rgba(30, 41, 59, 0.9) 100%)"
                                : "linear-gradient(180deg, rgba(254, 240, 138, 0.8) 0%, rgba(253, 224, 71, 0.3) 100%)",
                              borderRadius: "16px",
                              padding: "1.25rem",
                              border: "2px solid #eab308",
                              boxShadow: "0 12px 30px rgba(234, 179, 8, 0.3)",
                            }}
                          >
                            <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#ca8a04", letterSpacing: "1px" }}>
                              🏆 1ST PLACE GOLD
                            </div>
                            <div style={{ fontWeight: 900, fontSize: "1.3rem", marginTop: "4px", color: isDarkMode ? "#fef08a" : "#0f172a" }}>
                              {leaderboard[0].name}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: isDarkMode ? "#fde047" : "#854d0e" }}>
                              {leaderboard[0].hospital}
                            </div>
                            <div style={{ marginTop: "10px", fontWeight: 900, color: "#eab308", fontSize: "1.4rem" }}>
                              {leaderboard[0].score} / {questions.length} ({Math.round((leaderboard[0].score / (questions.length || 1)) * 100)}%)
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Bronze #3 */}
                      {leaderboard[2] && (
                        <div style={{ textAlign: "center", width: "210px" }}>
                          <div style={{ marginBottom: "8px" }}>
                            <KidneyMedal rank={3} size={58} />
                          </div>
                          <div
                            style={{
                              background: isDarkMode
                                ? "linear-gradient(180deg, rgba(120, 53, 15, 0.5) 0%, rgba(30, 41, 59, 0.8) 100%)"
                                : "linear-gradient(180deg, rgba(254, 215, 170, 0.8) 0%, rgba(251, 146, 60, 0.3) 100%)",
                              borderRadius: "14px",
                              padding: "1.1rem",
                              border: "1px solid #d97706",
                              boxShadow: "0 8px 20px rgba(217, 119, 6, 0.2)",
                            }}
                          >
                            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#d97706", letterSpacing: "1px" }}>
                              🥉 3RD PLACE
                            </div>
                            <div style={{ fontWeight: 800, fontSize: "1.15rem", marginTop: "4px", color: isDarkMode ? "#ffedd5" : "#0f172a" }}>
                              {leaderboard[2].name}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: isDarkMode ? "#fed7aa" : "#92400e" }}>
                              {leaderboard[2].hospital}
                            </div>
                            <div style={{ marginTop: "8px", fontWeight: 800, color: "#d97706", fontSize: "1.25rem" }}>
                              {leaderboard[2].score} / {questions.length}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                      <thead>
                        <tr
                          style={{
                            borderBottom: isDarkMode ? "1px solid #334155" : "2px solid #e2e8f0",
                            color: isDarkMode ? "#94a3b8" : "#64748b",
                          }}
                        >
                          <th style={{ padding: "12px 16px" }}>Rank</th>
                          <th style={{ padding: "12px 16px" }}>Participant Name</th>
                          <th style={{ padding: "12px 16px" }}>Hospital / Group</th>
                          <th style={{ padding: "12px 16px" }}>Score</th>
                          <th style={{ padding: "12px 16px" }}>Total Answered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((p, idx) => {
                          const r = idx + 1;
                          return (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: isDarkMode ? "1px solid #1e293b" : "1px solid #f1f5f9",
                                color: isDarkMode ? "#f1f5f9" : "#0f172a",
                                background: r === 1 ? "rgba(234, 179, 8, 0.08)" : r === 2 ? "rgba(148, 163, 184, 0.08)" : r === 3 ? "rgba(217, 119, 6, 0.08)" : "transparent",
                              }}
                            >
                              <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                                {r === 1 ? "🥇 #1" : r === 2 ? "🥈 #2" : r === 3 ? "🥉 #3" : `#${r}`}
                              </td>
                              <td style={{ padding: "12px 16px", fontWeight: 600 }}>{p.name}</td>
                              <td style={{ padding: "12px 16px" }}>{p.hospital}</td>
                              <td style={{ padding: "12px 16px", fontWeight: 700, color: "#10b981" }}>{p.score}</td>
                              <td style={{ padding: "12px 16px", color: isDarkMode ? "#94a3b8" : "#64748b" }}>
                                {p.totalAnswered}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </Paper>
            );
          })()}
      </div>
    </div>
  );
}
