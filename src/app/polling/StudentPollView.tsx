import React, { useState, useEffect } from "react";
import { supabase } from "@/logic/supabase";
import { Poll, Question } from "./types";
import { Button, Paper } from "@/components/ui";
import { useParams } from "react-router-dom";
import { IconCheck } from "@tabler/icons-react";

export default function StudentPollView() {
  const { pollId } = useParams();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (pollId) {
      fetchData();
    }
  }, [pollId]);

  const fetchData = async () => {
    const { data: pollData, error: pollError } = await supabase.from("polls").select("*").eq("id", pollId).single();
    if (pollError || !pollData) {
      setError("Poll not found.");
      return;
    }
    setPoll(pollData as Poll);

    if (pollData.status === "closed") {
      setError("This poll is currently closed.");
      return;
    }

    const { data: questionData } = await supabase.from("questions").select("*").eq("poll_id", pollId).order("created_at", { ascending: true });
    if (questionData) setQuestions(questionData as Question[]);
  };

  const handleSubmit = async () => {
    if (selectedOption === null) return;
    const q = questions[currentQuestionIndex];

    await supabase.from("responses").insert([{
      question_id: q.id,
      selected_option_index: selectedOption
    }]);

    setHasSubmitted(true);
  };

  const handleNext = () => {
    setCurrentQuestionIndex(prev => prev + 1);
    setSelectedOption(null);
    setHasSubmitted(false);
  };

  if (error) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "var(--theme-neutral-50)" }}>
        <Paper withBorder style={{ padding: "2rem", textAlign: "center", maxWidth: 400 }}>
          <h2 style={{ color: "var(--theme-red-600)" }}>Oops!</h2>
          <p>{error}</p>
        </Paper>
      </div>
    );
  }

  if (!poll || questions.length === 0) {
    return <div style={{ textAlign: "center", padding: "2rem" }}>Loading poll...</div>;
  }

  if (currentQuestionIndex >= questions.length) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "var(--theme-neutral-50)" }}>
        <Paper withBorder style={{ padding: "3rem", textAlign: "center", maxWidth: 500 }}>
          <IconCheck size={48} color="var(--theme-green-500)" style={{ marginBottom: "1rem" }} />
          <h1 style={{ fontFamily: "var(--font-serif)", marginBottom: "1rem" }}>You're all done!</h1>
          <p style={{ color: "var(--theme-neutral-600)" }}>Thank you for participating. Please look at the presenter's screen for the results.</p>
        </Paper>
      </div>
    );
  }

  const q = questions[currentQuestionIndex];

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "var(--theme-neutral-50)", padding: "1rem" }}>
      <Paper withBorder style={{ width: "100%", maxWidth: 600, padding: "2rem", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.875rem", color: "var(--theme-neutral-500)", marginBottom: "1.5rem", fontWeight: "bold" }}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
        
        <h2 style={{ fontSize: "1.5rem", marginBottom: "2rem", lineHeight: 1.4 }}>{q.question_text}</h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => !hasSubmitted && setSelectedOption(i)}
              style={{
                padding: "1rem 1.5rem",
                borderRadius: "8px",
                border: selectedOption === i ? "2px solid var(--theme-blue-500)" : "2px solid var(--theme-neutral-200)",
                backgroundColor: selectedOption === i ? "var(--theme-blue-50)" : "white",
                cursor: hasSubmitted ? "default" : "pointer",
                textAlign: "left",
                fontSize: "1.125rem",
                transition: "all 0.2s ease"
              }}
              disabled={hasSubmitted}
            >
              {opt}
            </button>
          ))}
        </div>

        {hasSubmitted ? (
          <Button size="lg" onClick={handleNext} style={{ alignSelf: "flex-end" }}>
            Next Question
          </Button>
        ) : (
          <Button size="lg" onClick={handleSubmit} disabled={selectedOption === null} style={{ alignSelf: "flex-end" }}>
            Submit Answer
          </Button>
        )}
      </Paper>
    </div>
  );
}
