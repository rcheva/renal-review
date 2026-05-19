import React, { useState, useEffect } from "react";
import { supabase } from "@/logic/supabase";
import { Poll, Question } from "./types";
import { Button, Paper, TextInput, Modal, Select, Textarea } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton";
import { AppHeaderContent } from "../shell/Header/Header";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useParams, useNavigate } from "react-router-dom";
import { IconPlus, IconTrash, IconCheck, IconCopy, IconBrandWhatsapp, IconBrain, IconDownload } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import { useAllDecks } from "@/logic/deck/hooks/useAllDecks";
import { useNotesOf } from "@/logic/note/hooks/useNotesOf";
import { convert } from "html-to-text";

export default function EditPollView() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // New Question State
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOptions, setNewOptions] = useState<string[]>(["", ""]);
  const [newCorrectIndex, setNewCorrectIndex] = useState<number | null>(null);
  const [newExplanation, setNewExplanation] = useState("");

  // AI Import State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiDeckId, setAiDeckId] = useState<string>("");
  const [aiJsonText, setAiJsonText] = useState("");
  const [aiParseError, setAiParseError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [decks] = useAllDecks();
  
  const aiSelectedDeck = decks?.find(d => d.id === aiDeckId) || undefined;
  const [aiNotes] = useNotesOf(aiSelectedDeck);

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
      correct_option_index: newCorrectIndex,
      explanation: newExplanation
    }]);

    if (!error) {
      setNewQuestionText("");
      setNewOptions(["", ""]);
      setNewCorrectIndex(null);
      setNewExplanation("");
      fetchPollData();
    }
  };


  const handleCopyAiPrompt = () => {
    if (!aiNotes || aiNotes.length === 0) return;
    
    let prompt = `I am building a multiple-choice medical quiz. Please generate 3 plausible but incorrect distractors for each of the following flashcards. Return ONLY a valid JSON array matching this exact format, with no extra markdown formatting or backticks:
[
  {
    "question_text": "...",
    "options": ["correct answer", "wrong 1", "wrong 2", "wrong 3"],
    "correct_option_index": 0,
    "explanation": "A brief explanation of why the correct answer is right and the others are wrong."
  }
]

Here are the flashcards:\n\n`;

    aiNotes.forEach((n, i) => {
      const q = convert((n.content as any).front || "").trim();
      const a = convert((n.content as any).back || "").trim();
      prompt += `${i + 1}. Q: ${q}\n   A: ${a}\n\n`;
    });

    navigator.clipboard.writeText(prompt);
    alert("Prompt copied to clipboard! Paste it into your AI assistant.");
  };

  const handleParseAiJson = async () => {
    setAiParseError("");
    setIsImporting(true);
    try {
      let textToParse = aiJsonText.trim();
      // basic cleanup in case AI includes markdown code blocks
      if (textToParse.startsWith("\`\`\`json")) textToParse = textToParse.replace(/\`\`\`json/g, "");
      if (textToParse.startsWith("\`\`\`")) textToParse = textToParse.replace(/\`\`\`/g, "");
      if (textToParse.endsWith("\`\`\`")) textToParse = textToParse.slice(0, -3);

      const parsed = JSON.parse(textToParse);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array.");
      
      const questionsToInsert = parsed.map(p => {
        if (!p.question_text || !Array.isArray(p.options) || p.correct_option_index === undefined) {
          throw new Error("Invalid question format in JSON.");
        }
        
        const originalCorrectAnswer = p.options[p.correct_option_index];
        const shuffledOptions = [...p.options].sort(() => 0.5 - Math.random());
        const newCorrectIndex = shuffledOptions.indexOf(originalCorrectAnswer);

        return {
          poll_id: pollId,
          question_text: p.question_text,
          options: shuffledOptions,
          correct_option_index: newCorrectIndex,
          explanation: p.explanation || null
        };
      });

      const { error } = await supabase.from("questions").insert(questionsToInsert);
      if (error) throw error;
      
      setIsAiModalOpen(false);
      setAiJsonText("");
      setAiDeckId("");
      fetchPollData();
    } catch (e: any) {
      setAiParseError(e.message || "Invalid JSON format.");
    } finally {
      setIsImporting(false);
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

  if (!poll) return <p>Loading...</p>;

  const origin = window.location.origin.includes('tauri://') || window.location.origin.includes('file://')
    ? 'https://rcheva.github.io/renal-review'
    : window.location.origin;
  const pollUrl = `${origin}/#/poll/${poll.id}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Join my live poll: ${poll.title}\n\n${pollUrl}`)}`;

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs segments={[{ label: "Live Polling", path: "/polling" }, { label: poll.title }]} />
      </AppHeaderContent>

      <div style={{ width: "100%", maxWidth: "var(--max-content-width)", margin: "0 auto", padding: "20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "var(--font-serif)" }}>Editing: {poll.title}</h1>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <Button variant="default" leftSection={<IconDownload size={16} />} onClick={handleDownloadKey}>
              Export Answer Key
            </Button>
            <Button 
              onClick={togglePollStatus}
              style={{ 
                backgroundColor: poll.status === "active" ? "var(--theme-red-600)" : "var(--theme-green-600)", 
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
            <Button onClick={() => navigate(`/polling/live/${poll.id}`)}>View Live Results</Button>
          </div>
        </div>

        <Paper withBorder style={{ padding: "1.5rem", marginBottom: "2rem", display: "flex", gap: "2rem", alignItems: "center" }}>
          <div>
            <QRCodeSVG value={pollUrl} size={150} level="M" />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3 style={{ margin: 0 }}>Share with Students</h3>
            <p style={{ margin: 0, color: "var(--theme-neutral-500)" }}>Students can scan the QR code to join instantly, or use the link below.</p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <TextInput value={pollUrl} readOnly style={{ flex: 1 }} />
              <Button variant="default" leftSection={<IconCopy size={16} />} onClick={() => navigator.clipboard.writeText(pollUrl)}>
                Copy
              </Button>
            </div>
            <div>
              <Button 
                variant="default" 
                leftSection={<IconBrandWhatsapp size={16} color="#25D366" />} 
                onClick={() => window.open(whatsappUrl, "_blank")}
              >
                Share via WhatsApp
              </Button>
            </div>
          </div>
        </Paper>

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
              {q.explanation && (
                <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "var(--theme-blue-50)", borderLeft: "4px solid var(--theme-blue-500)", borderRadius: "4px", fontSize: "0.875rem" }}>
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </Paper>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", margin: 0 }}>Add New Question</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button variant="default" leftSection={<IconBrain size={16} color="var(--theme-primary)" />} onClick={() => setIsAiModalOpen(true)}>
              Import via AI
            </Button>
          </div>
        </div>
        <Paper withBorder style={{ padding: "1.5rem", backgroundColor: "var(--theme-neutral-50)" }}>
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
            <Textarea
              label="Explanation (optional)"
              placeholder="Why is this answer correct?"
              value={newExplanation}
              onChange={(e) => setNewExplanation(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={handleAddQuestion} disabled={!newQuestionText.trim() || newOptions.some(o => !o.trim())}>
                Save Question
              </Button>
            </div>
          </div>
        </Paper>


        <Modal
          opened={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          title="Import via AI Workflow"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--theme-neutral-500)" }}>
              Step 1: Select a deck and copy the prompt.<br/>
              Step 2: Paste the prompt into an AI like ChatGPT or Claude.<br/>
              Step 3: Paste the raw JSON response below.
            </p>
            
            <Select
              label="Select Deck (for prompt generation)"
              value={aiDeckId}
              onChange={(val) => setAiDeckId(val || "")}
              options={(decks || []).map(d => ({ value: d.id, label: `${d.name} (${d.notes?.length || 0} cards)` }))}
            />

            <Button 
              variant="default" 
              leftSection={<IconCopy size={16} />} 
              disabled={!aiDeckId || (aiNotes?.length === 0)}
              onClick={handleCopyAiPrompt}
            >
              Copy Prompt to Clipboard
            </Button>

            <Textarea
              label="Paste AI JSON Output"
              placeholder='[\n  {\n    "question_text": "...",\n    "options": [...],\n    "correct_option_index": 0\n  }\n]'
              value={aiJsonText}
              onChange={(e) => {
                setAiJsonText(e.target.value);
                setAiParseError("");
              }}
              style={{ minHeight: "200px" }}
            />

            {aiParseError && (
              <p style={{ color: "var(--theme-red-600)", fontSize: "0.875rem", margin: 0 }}>{aiParseError}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="subtle" onClick={() => setIsAiModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleParseAiJson} 
                disabled={!aiJsonText.trim() || isImporting}
              >
                Parse and Add Questions
              </Button>
            </div>
          </div>
        </Modal>

      </div>
    </>
  );
}
