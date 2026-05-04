import React, { useState, useEffect } from "react";
import { supabase } from "@/logic/supabase";
import { Poll, Question } from "./types";
import { Button, Paper, TextInput } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton";
import { AppHeaderContent } from "../shell/Header/Header";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useParams, useNavigate } from "react-router-dom";
import { IconPlus, IconTrash, IconCheck } from "@tabler/icons-react";

export default function EditPollView() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // New Question State
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOptions, setNewOptions] = useState<string[]>(["", ""]);
  const [newCorrectIndex, setNewCorrectIndex] = useState<number | null>(null);

  useEffect(() => {
    if (pollId) {
      fetchPollData();
    }
  }, [pollId]);

  const fetchPollData = async () => {
    const { data: pollData } = await supabase.from("polls").select("*").eq("id", pollId).single();
    if (pollData) setPoll(pollData as Poll);

    const { data: questionData } = await supabase.from("questions").select("*").eq("poll_id", pollId).order("created_at", { ascending: true });
    if (questionData) setQuestions(questionData as Question[]);
  };

  const handleAddOption = () => setNewOptions([...newOptions, ""]);
  const handleOptionChange = (index: number, value: string) => {
    const updated = [...newOptions];
    updated[index] = value;
    setNewOptions(updated);
  };
  const handleRemoveOption = (index: number) => {
    if (newOptions.length <= 2) return;
    const updated = newOptions.filter((_, i) => i !== index);
    setNewOptions(updated);
    if (newCorrectIndex === index) setNewCorrectIndex(null);
    else if (newCorrectIndex !== null && newCorrectIndex > index) setNewCorrectIndex(newCorrectIndex - 1);
  };

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim() || newOptions.some(o => !o.trim())) return;

    const { error } = await supabase.from("questions").insert([{
      poll_id: pollId,
      question_text: newQuestionText,
      options: newOptions,
      correct_option_index: newCorrectIndex
    }]);

    if (!error) {
      setNewQuestionText("");
      setNewOptions(["", ""]);
      setNewCorrectIndex(null);
      fetchPollData();
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    await supabase.from("questions").delete().eq("id", id);
    fetchPollData();
  };

  const togglePollStatus = async () => {
    if (!poll) return;
    const newStatus = poll.status === "active" ? "closed" : "active";
    await supabase.from("polls").update({ status: newStatus }).eq("id", poll.id);
    setPoll({ ...poll, status: newStatus });
  };

  if (!poll) return <p>Loading...</p>;

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs segments={[{ label: "Live Polling", path: "/polling" }, { label: poll.title }]} />
      </AppHeaderContent>

      <div style={{ width: "100%", maxWidth: "var(--max-content-width)", margin: "0 auto", padding: "20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "var(--font-serif)" }}>Editing: {poll.title}</h1>
          <div style={{ display: "flex", gap: "1rem" }}>
            <Button 
              variant={poll.status === "active" ? "default" : "primary"}
              onClick={togglePollStatus}
              style={{ backgroundColor: poll.status === "active" ? "var(--theme-red-600)" : "var(--theme-green-600)", color: "white" }}
            >
              {poll.status === "active" ? "Close Poll" : "Open Poll"}
            </Button>
            <Button onClick={() => navigate(`/polling/live/${poll.id}`)}>View Live Results</Button>
          </div>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <p><strong>Student Join Link:</strong> <code>{window.location.origin}/#/poll/{poll.id}</code></p>
        </div>

        <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: "1rem" }}>Questions ({questions.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "3rem" }}>
          {questions.map((q, i) => (
            <Paper key={q.id} withBorder style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>{i + 1}. {q.question_text}</h3>
                <IconButton variant="ghost" onClick={() => handleDeleteQuestion(q.id)}>
                  <IconTrash size={16} color="var(--theme-red-600)" />
                </IconButton>
              </div>
              <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
                {q.options.map((opt, oIndex) => (
                  <li key={oIndex} style={{ padding: "0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem", color: q.correct_option_index === oIndex ? "var(--theme-green-600)" : "inherit" }}>
                    {q.correct_option_index === oIndex && <IconCheck size={16} />}
                    {opt}
                  </li>
                ))}
              </ul>
            </Paper>
          ))}
        </div>

        <Paper withBorder style={{ padding: "1.5rem", backgroundColor: "var(--theme-neutral-50)" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>Add New Question</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <TextInput
              label="Question Text"
              placeholder="e.g. What is the most common cause of AKI?"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
            />
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", display: "block" }}>Options</label>
              {newOptions.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                  <input 
                    type="radio" 
                    name="correct_option" 
                    checked={newCorrectIndex === i} 
                    onChange={() => setNewCorrectIndex(i)} 
                    title="Mark as correct answer"
                  />
                  <TextInput
                    style={{ flex: 1 }}
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                  />
                  {newOptions.length > 2 && (
                    <IconButton variant="ghost" onClick={() => handleRemoveOption(i)}>
                      <IconTrash size={16} color="var(--theme-red-600)" />
                    </IconButton>
                  )}
                </div>
              ))}
              <Button variant="subtle" size="sm" onClick={handleAddOption} leftSection={<IconPlus size={14} />} style={{ marginTop: "0.5rem" }}>
                Add Option
              </Button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={handleAddQuestion} disabled={!newQuestionText.trim() || newOptions.some(o => !o.trim())}>
                Save Question
              </Button>
            </div>
          </div>
        </Paper>
      </div>
    </>
  );
}
