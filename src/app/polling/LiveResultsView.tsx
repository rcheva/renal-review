import React, { useState, useEffect } from "react";
import { supabase } from "@/logic/supabase";
import { Poll, Question, Response } from "./types";
import { Paper } from "@/components/ui";
import { AppHeaderContent } from "../shell/Header/Header";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { TextInput, Button } from "@/components/ui";
import { IconCopy, IconBrandWhatsapp, IconRefresh, IconTrophy, IconChartBar, IconDownload } from "@tabler/icons-react";
import parse from "html-react-parser";

export default function LiveResultsView() {
  const { pollId } = useParams();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [activeTab, setActiveTab] = useState<"charts" | "leaderboard">("charts");

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

  const fetchData = async () => {
    const { data: pollData } = await supabase.from("polls").select("*").eq("id", pollId).single();
    if (pollData) setPoll(pollData as Poll);

    const { data: questionData } = await supabase.from("questions").select("*").eq("poll_id", pollId).order("created_at", { ascending: true });
    if (questionData) setQuestions(questionData as Question[]);

    if (questionData && questionData.length > 0) {
      const qIds = questionData.map((q: any) => q.id);
      const { data: responseData } = await supabase.from("responses").select("*").in("question_id", qIds);
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
    if (window.confirm("Are you sure you want to delete ALL responses for this poll? This cannot be undone.")) {
      const qIds = questions.map(q => q.id);
      await supabase.from("responses").delete().in("question_id", qIds);
      setResponses([]);
    }
  };

  if (!poll) return <p>Loading live results...</p>;

  const origin = window.location.origin.includes('tauri://') || window.location.origin.includes('file://')
    ? 'https://rcheva.github.io/renal-review'
    : window.location.origin;
  const pollUrl = `${origin}/#/poll/${poll.id}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Join my live poll: ${poll.title}\n\n${pollUrl}`)}`;

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs segments={[{ label: "Live Polling", path: "/polling" }, { label: `${poll.title} - Live Results` }]} />
      </AppHeaderContent>

      <div style={{ width: "100%", maxWidth: "var(--max-content-width)", margin: "0 auto", padding: "20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>Live Results: {poll.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Button 
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={handleResetResults}
            >
              Reset Results
            </Button>
            <div style={{ padding: "0.5rem 1rem", borderRadius: "100px", backgroundColor: poll.status === "active" ? "var(--theme-primary-100)" : "var(--theme-red-100)", color: poll.status === "active" ? "var(--theme-primary-800)" : "var(--theme-red-800)", fontWeight: "bold" }}>
              {poll.status === "active" ? "LIVE - Accepting Responses" : "CLOSED"}
            </div>
            <Button 
              onClick={togglePollStatus}
              style={{ 
                backgroundColor: poll.status === "active" ? "var(--theme-red-600)" : "var(--theme-primary-600)", 
                color: "white",
                border: "none",
                fontWeight: "bold",
                padding: "0.5rem 1rem",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              {poll.status === "active" ? "Close Poll" : "Open Poll"}
            </Button>
          </div>
        </div>
        
        <Paper withBorder style={{ padding: "1.5rem", marginBottom: "2rem", display: "flex", gap: "2rem", alignItems: "center" }}>
          <div>
            <QRCodeSVG value={pollUrl} size={100} level="M" />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <TextInput value={pollUrl} readOnly style={{ flex: 1 }} />
              <Button variant="default" leftSection={<IconCopy size={16} />} onClick={() => navigator.clipboard.writeText(pollUrl)}>
                Copy
              </Button>
              <Button 
                variant="default" 
                leftSection={<IconBrandWhatsapp size={16} color="#25D366" />} 
                onClick={() => window.open(whatsappUrl, "_blank")}
              >
                Share
              </Button>
            </div>
          </div>
        </Paper>

        <p style={{ marginBottom: "2rem", color: "var(--theme-neutral-500)" }}>Total responses recorded: {responses.length}</p>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", borderBottom: "1px solid var(--theme-neutral-200)", paddingBottom: "1rem" }}>
          <Button 
            variant={activeTab === "charts" ? "primary" : "default"} 
            leftSection={<IconChartBar size={16} />}
            onClick={() => setActiveTab("charts")}
          >
            Charts
          </Button>
          <Button 
            variant={activeTab === "leaderboard" ? "primary" : "default"} 
            leftSection={<IconTrophy size={16} />}
            onClick={() => setActiveTab("leaderboard")}
          >
            Leaderboard
          </Button>
        </div>

        {activeTab === "charts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
            {questions.map((q, i) => {
              const qResponses = responses.filter(r => r.question_id === q.id);
              const data = q.options.map((opt, optIndex) => ({
                name: `Option ${optIndex + 1}`,
                text: opt,
                count: qResponses.filter(r => r.selected_option_index === optIndex).length,
                isCorrect: q.correct_option_index === optIndex
              }));

              return (
                <Paper key={q.id} withBorder style={{ padding: "1.5rem" }}>
                  <div style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.125rem", fontWeight: "bold" }}>{i + 1}. {parse(q.question_text)}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
                    {q.options.map((opt, optIndex) => (
                      <div key={optIndex} style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem", backgroundColor: "var(--theme-neutral-100)", borderRadius: "4px" }}>
                        <strong>Option {optIndex + 1}:</strong> {opt}
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <RechartsTooltip formatter={(value, name, props) => [value, props.payload.text]} />
                        <Bar dataKey="count" name="Votes">
                          <LabelList dataKey="count" position="top" />
                          {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.isCorrect ? "#10b981" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Paper>
              );
            })}
          </div>
        )}

        {activeTab === "leaderboard" && (() => {
          // Calculate Leaderboard
          const participantMap = new Map<string, { name: string, hospital: string, score: number, totalAnswered: number, correctAnswers: string[] }>();
          
          responses.forEach(r => {
            const key = `${r.respondent_name || 'Anonymous'}-${r.hospital || 'Unknown'}`;
            if (!participantMap.has(key)) {
              participantMap.set(key, { 
                name: r.respondent_name || 'Anonymous', 
                hospital: r.hospital || 'Unknown', 
                score: 0, 
                totalAnswered: 0,
                correctAnswers: []
              });
            }
            
            const p = participantMap.get(key)!;
            const q = questions.find(question => question.id === r.question_id);
            
            if (q) {
              p.totalAnswered++;
              if (r.selected_option_index === q.correct_option_index) {
                p.score++;
                p.correctAnswers.push(q.question_text);
              }
            }
          });

          const leaderboard = Array.from(participantMap.values()).sort((a, b) => b.score - a.score);

          const exportCsv = async () => {
            if (leaderboard.length === 0) return;
            const header = "Name,Hospital,Score,Total Answered\n";
            const rows = leaderboard.map(p => `"${p.name}","${p.hospital}",${p.score},${p.totalAnswered}`).join("\n");
            const csvContent = header + rows;

            try {
              const isTauri = window.location.origin.includes('tauri://') || window.location.origin.includes('file://') || (window as any).__TAURI_INTERNALS__;
              
              if (isTauri) {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeTextFile } = await import('@tauri-apps/plugin-fs');
                
                const filePath = await save({
                  filters: [{ name: 'CSV File', extensions: ['csv'] }],
                  defaultPath: `${poll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.csv`
                });
                
                if (filePath) {
                  await writeTextFile(filePath, csvContent);
                }
              } else {
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${poll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }
            } catch (err) {
              console.error('Error saving CSV:', err);
              alert('Failed to save file.');
            }
          };

          return (
            <Paper withBorder style={{ padding: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <h2 style={{ margin: 0 }}>Participant Rankings</h2>
                <Button variant="default" leftSection={<IconDownload size={16} />} onClick={exportCsv}>
                  Export CSV
                </Button>
              </div>
              
              {leaderboard.length === 0 ? (
                <p style={{ color: "var(--theme-neutral-500)", textAlign: "center", padding: "2rem" }}>No responses yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--theme-neutral-200)" }}>
                      <th style={{ padding: "1rem" }}>Rank</th>
                      <th style={{ padding: "1rem" }}>Name</th>
                      <th style={{ padding: "1rem" }}>Hospital</th>
                      <th style={{ padding: "1rem" }}>Score</th>
                      <th style={{ padding: "1rem" }}>Total Answered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--theme-neutral-100)" }}>
                        <td style={{ padding: "1rem", fontWeight: "bold", color: idx === 0 ? "var(--theme-yellow-600)" : "inherit" }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: "1rem" }}>{p.name}</td>
                        <td style={{ padding: "1rem" }}>{p.hospital}</td>
                        <td style={{ padding: "1rem", fontWeight: "bold", color: "var(--theme-primary-600)" }}>{p.score}</td>
                        <td style={{ padding: "1rem", color: "var(--theme-neutral-500)" }}>{p.totalAnswered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Paper>
          );
        })()}
      </div>
    </>
  );
}
