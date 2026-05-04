import React, { useState, useEffect } from "react";
import { supabase } from "@/logic/supabase";
import { Poll, Question, Response } from "./types";
import { Paper } from "@/components/ui";
import { AppHeaderContent } from "../shell/Header/Header";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

export default function LiveResultsView() {
  const { pollId } = useParams();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);

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

  if (!poll) return <p>Loading live results...</p>;

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs segments={[{ label: "Live Polling", path: "/polling" }, { label: `${poll.title} - Live Results` }]} />
      </AppHeaderContent>

      <div style={{ width: "100%", maxWidth: "var(--max-content-width)", margin: "0 auto", padding: "20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>Live Results: {poll.title}</h1>
          <div style={{ padding: "0.5rem 1rem", borderRadius: "100px", backgroundColor: poll.status === "active" ? "var(--theme-green-100)" : "var(--theme-red-100)", color: poll.status === "active" ? "var(--theme-green-800)" : "var(--theme-red-800)", fontWeight: "bold" }}>
            {poll.status === "active" ? "LIVE - Accepting Responses" : "CLOSED"}
          </div>
        </div>
        
        <p style={{ marginBottom: "2rem", color: "var(--theme-neutral-500)" }}>Total responses recorded: {responses.length}</p>

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
                <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>{i + 1}. {q.question_text}</h3>
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
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isCorrect ? "#10b981" : "#3b82f6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Paper>
            );
          })}
        </div>
      </div>
    </>
  );
}
