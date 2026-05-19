import React, { useState, useEffect } from "react";
import { supabase } from "@/logic/supabase";
import { Poll, Question } from "./types";
import { Button, Paper, TextInput } from "@/components/ui";
import { useParams } from "react-router-dom";
import { IconCheck, IconDownload } from "@tabler/icons-react";

export default function StudentPollView() {
  const { pollId } = useParams();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState("");
  
  const [studentName, setStudentName] = useState("");
  const [hospital, setHospital] = useState("MRHT");
  const [hasStarted, setHasStarted] = useState(false);

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

    const { data: questionData } = await supabase.from("questions").select("*").eq("poll_id", pollId).order("created_at", { ascending: true });
    if (questionData) setQuestions(questionData as Question[]);
  };

  const handleOptionClick = async (index: number) => {
    if (hasSubmitted) return;
    setHasSubmitted(true);

    const q = questions[currentQuestionIndex];
    await supabase.from("responses").insert([{
      question_id: q.id,
      selected_option_index: index,
      respondent_name: studentName.trim() || null,
      hospital: hospital.trim() || null
    }]);

    setCurrentQuestionIndex(prev => prev + 1);
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
  ${questions.map((q, i) => `
    <div class="question">
      <h3>${i + 1}. ${q.question_text}</h3>
      <ul>
        ${q.options.map((opt, optIndex) => {
          if (optIndex === q.correct_option_index) {
            return `<li class="correct">✓ ${opt}</li>`;
          }
          return `<li>${opt}</li>`;
        }).join('')}
      </ul>
      ${q.explanation ? `<div class="explanation"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
    </div>
  `).join('')}
</body>
</html>
    `;

    try {
      const isTauri = window.location.origin.includes('tauri://') || window.location.origin.includes('file://') || (window as any).__TAURI_INTERNALS__;
      
      if (isTauri) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        
        const filePath = await save({
          filters: [{ name: 'HTML Document', extensions: ['html'] }],
          defaultPath: `${poll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_answer_key.html`
        });
        
        if (filePath) {
          await writeTextFile(filePath, htmlContent);
        }
      } else {
        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${poll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_answer_key.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error saving file:', err);
      alert('Failed to save file. If you are on desktop, ensure you have permission to write to that directory.');
    }
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

  if (poll.status === "closed" || currentQuestionIndex >= questions.length) {
    const isClosed = poll.status === "closed";
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", minHeight: "100vh", backgroundColor: "var(--theme-neutral-50)", padding: "2rem 1rem" }}>
        <Paper withBorder style={{ width: "100%", maxWidth: 800, padding: "2rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            {isClosed ? (
              <>
                <h1 style={{ fontFamily: "var(--font-serif)", marginBottom: "0.5rem" }}>This poll is closed</h1>
                <p style={{ color: "var(--theme-neutral-600)" }}>You can no longer submit responses, but you can review the answer key below.</p>
              </>
            ) : (
              <>
                <IconCheck size={48} color="var(--theme-green-500)" style={{ marginBottom: "1rem" }} />
                <h1 style={{ fontFamily: "var(--font-serif)", marginBottom: "0.5rem" }}>You're all done!</h1>
                <p style={{ color: "var(--theme-neutral-600)" }}>Thank you for participating. Here is the answer key for your review.</p>
              </>
            )}
            <div style={{ marginTop: "1.5rem" }}>
               <Button variant="default" leftSection={<IconDownload size={16} />} onClick={handleDownloadKey}>
                 Download HTML Answer Key
               </Button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {questions.map((q, i) => (
              <div key={q.id} style={{ padding: "1.5rem", backgroundColor: "white", borderRadius: "8px", border: "1px solid var(--theme-neutral-200)" }}>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", lineHeight: 1.4 }}>{i + 1}. {q.question_text}</h3>
                <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {q.options.map((opt, optIndex) => {
                    const isCorrect = optIndex === q.correct_option_index;
                    return (
                      <li key={optIndex} style={{ 
                        padding: "0.75rem", 
                        borderRadius: "6px", 
                        backgroundColor: isCorrect ? "var(--theme-green-50)" : "var(--theme-neutral-50)",
                        border: isCorrect ? "1px solid var(--theme-green-200)" : "1px solid var(--theme-neutral-200)",
                        color: isCorrect ? "var(--theme-green-800)" : "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontWeight: isCorrect ? 600 : 400
                      }}>
                        {isCorrect && <IconCheck size={18} color="var(--theme-green-600)" />}
                        {opt}
                      </li>
                    );
                  })}
                </ul>
                {q.explanation && (
                  <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "var(--theme-blue-50)", borderLeft: "4px solid var(--theme-blue-500)", borderRadius: "4px", fontSize: "0.875rem" }}>
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
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "var(--theme-neutral-50)" }}>
        <Paper withBorder style={{ padding: "3rem", maxWidth: 500, width: "100%" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", marginBottom: "1rem", textAlign: "center" }}>Join Poll</h1>
          <p style={{ color: "var(--theme-neutral-600)", marginBottom: "2rem", textAlign: "center" }}>
            Enter your details to participate. Both fields are optional.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
            <TextInput
              label="Name (Optional)"
              placeholder="e.g. Dr. Smith"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
            <TextInput
              label="Hospital (Optional)"
              placeholder="e.g. MRHT"
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
            />
          </div>
          <Button size="lg" style={{ width: "100%" }} onClick={() => setHasStarted(true)}>
            Start Poll
          </Button>
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
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleOptionClick(i)}
              style={{
                padding: "1rem 1.5rem",
                borderRadius: "8px",
                border: "2px solid var(--theme-neutral-200)",
                backgroundColor: "white",
                cursor: hasSubmitted ? "default" : "pointer",
                textAlign: "left",
                fontSize: "1.125rem",
                transition: "all 0.2s ease"
              }}
              disabled={hasSubmitted}
              onMouseEnter={(e) => {
                if (!hasSubmitted) {
                  e.currentTarget.style.borderColor = "var(--theme-blue-400)";
                  e.currentTarget.style.backgroundColor = "var(--theme-blue-50)";
                }
              }}
              onMouseLeave={(e) => {
                if (!hasSubmitted) {
                  e.currentTarget.style.borderColor = "var(--theme-neutral-200)";
                  e.currentTarget.style.backgroundColor = "white";
                }
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center" }}>
          <Button 
            variant="ghost" 
            onClick={() => handleOptionClick(-1)}
            disabled={hasSubmitted}
            style={{ color: "var(--theme-neutral-500)" }}
          >
            Leave Blank / Skip
          </Button>
        </div>
      </Paper>
    </div>
  );
}
