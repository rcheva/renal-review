import { useAllDecks } from "@/logic/deck/hooks/useAllDecks";
import { newDeck } from "@/logic/deck/newDeck";
import { db } from "@/logic/db";
import { supabase } from "@/logic/supabase";
import { BasicNoteTypeAdapter } from "@/logic/type-implementations/normal/BasicNote";
import {
  IconBrain,
  IconBug,
  IconCheck,
  IconCloudDownload,
  IconCode,
  IconCopy,
  IconFileUpload,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconTrophy,
  IconX,
} from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AnythingLLMView.css";

interface AnythingWorkspace {
  id: number | string;
  name: string;
  slug: string;
}

interface ParsedCard {
  front: string;
  back: string;
}

interface ParsedPollQuestion {
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation?: string;
}

const ONEDRIVE_BASE =
  "/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review";

const JCLUB_PROMPT = `Please provide a comprehensive Evidence-Based Medicine appraisal and detailed clinical synthesis of the attached article. Cover all of the following 10 sections in full detail:

1. Article Identity & Classification: Citation, study type (RCT, COHORT, SR, GL, etc.), confidence level, and core executive message.
2. Rapid Clinical Read: Biochemical definitions, diagnostic criteria, thresholds (e.g. sNa <135, mild 130-134, moderate 120-129, severe <120 mmol/L), ICU prevalence, and mortality.
3. Diagnostic Framework & Physiology: Stepwise osmolality evaluation (<275 hypotonic, 275-290 isotonic, >290 hypertonic), pseudohyponatremia, and volume status phenotypes.
4. Treatment & Monitoring Protocols: Sodium deficit equations, symptom-directed correction goals (4-6 mmol/L in 6h), safety upper limits (8 mmol/L in 24h), and overcorrection relowering protocols.
5. The Correction-Rate & ODS Controversy: Historical ODS thresholds vs recent cohort evidence and risk factors.
6. Consensus, Uncertainty & Practice Implications: Reasonably established practice principles and unresolved controversies.
7. Critical Appraisal & EBM Ratings: SANRA/STROBE alignment, Editorial EBM Ratings Table (1-5 ⭐ stars) with justifications, and GRADE evidence rating.
8. What Cannot Be Concluded From This PDF: Unanswered clinical questions.
9. Future Research Directions: Trial needs and validation models.
10. Clinical Bottom Line: 3-sentence definitive summary for bedside practice.`;

const ANKI_JSON_PROMPT = `Master Anki deck prompt — follow immediately:
Analyze the uploaded medical PDF article in this workspace. Generate 20 Anki flashcards based directly on the key clinical findings, methodology, sample size, primary outcomes, bias, and clinical bottom line of THIS uploaded article using the correct card distribution for the detected study type:
- 8 Basic — key results, effect sizes, statistical measures, framework scores
- 5 Cloze — fill in critical values, ratings, thresholds specific to this study
- 4 Clinical Scenario — applying findings at point of care with patient vignettes
- 3 Critical Appraisal — methodology, bias, and limitations specific to this design

The JSON format must be strictly compatible with the app's flashcard importer. Please generate a single, valid JSON array. Do not wrap the JSON in markdown code blocks or write any conversation text. Return ONLY the raw JSON array.

### Required JSON Schema:
[
  {
    "question": "The question/prompt on the front of the card",
    "correct_answer": "The main correct answer/fact on the back of the card",
    "incorrect_answers": [
      "Incorrect option/distractor 1",
      "Incorrect option/distractor 2",
      "Incorrect option/distractor 3"
    ]
  }
]`;

const POLL_JSON_PROMPT = `JSON poll prompt — follow immediately:
Analyze the uploaded medical PDF article in this workspace. Generate 5 high-yield multiple-choice quiz questions based directly on the key clinical findings, primary endpoints, and results of THIS uploaded article.

The JSON format must be strictly compatible with the app's importer. Please generate a single, valid JSON array. Do not wrap the JSON in any markdown code blocks, backticks, or write any introductory/concluding text. Return ONLY the raw JSON array.

### Required JSON Schema:
[
  {
    "question_text": "The text of the question",
    "options": [
      "Option A text",
      "Option B text",
      "Option C text",
      "Option D text"
    ],
    "correct_option_index": 0,
    "explanation": "A brief explanation of why the correct answer is right (optional)"
  }
]`;

export default function AnythingLLMView() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [baseUrl, setBaseUrl] = useState(() => {
    const saved = localStorage.getItem("anything_base_url");
    if (!saved || saved.includes("3001")) {
      localStorage.setItem("anything_base_url", "http://127.0.0.1:59484/api/v1");
      return "http://127.0.0.1:59484/api/v1";
    }
    return saved;
  });
  const [apiKey, setApiKey] = useState(
    () =>
      localStorage.getItem("anything_api_key") ||
      "ANYTHINGLLM-RENAL-REVIEW-KEY-12345"
  );

  const [workspaces, setWorkspaces] = useState<AnythingWorkspace[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [workspaceDocs, setWorkspaceDocs] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState(() => "session_" + Date.now());
  const [chatMode, setChatMode] = useState<"chat" | "query">("chat");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const handleResetSession = () => {
    setSessionId("session_" + Date.now());
    setResponse("");
    setParsedCards([]);
    setParsedPolls([]);
  };

  // JSON Flashcard Parsing & Import
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [createNewDeckMode, setCreateNewDeckMode] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [parentDeckId, setParentDeckId] = useState("");
  const [allDecks] = useAllDecks();
  const [importingCards, setImportingCards] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // JSON Poll Parsing & Import
  const [parsedPolls, setParsedPolls] = useState<ParsedPollQuestion[]>([]);
  const [showPollImportModal, setShowPollImportModal] = useState(false);
  const [pollTitle, setPollTitle] = useState("");
  const [importingPoll, setImportingPoll] = useState(false);

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showConsoleModal, setShowConsoleModal] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const fetchWorkspaceDocs = async (slug: string) => {
    if (!slug) {
      setWorkspaceDocs([]);
      return;
    }
    try {
      const res = await fetch("http://localhost:3001/api/anything/workspace_docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, slug }),
      });
      const data = await res.json();
      if (data.documents) {
        setWorkspaceDocs(data.documents);
      }
    } catch {
      setWorkspaceDocs([]);
    }
  };

  const fetchWorkspaces = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3001/api/anything/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const list = data.workspaces || [];
      setWorkspaces(list);
      setIsConnected(true);
      if (list.length > 0 && !selectedSlug) {
        const firstSlug = list[0].slug || list[0].name;
        setSelectedSlug(firstSlug);
        fetchWorkspaceDocs(firstSlug);
      }
    } catch (err: any) {
      setIsConnected(false);
      setError(
        err.message ||
          "Could not connect to AnythingLLM. Please check your API URL/Key in Settings."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [baseUrl, apiKey]);

  useEffect(() => {
    if (selectedSlug) {
      fetchWorkspaceDocs(selectedSlug);
    }
  }, [selectedSlug]);

  const fetchLogs = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/logs");
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [ERROR] Failed to fetch server logs: ${err.message}`,
      ]);
    }
  };

  const extractJsonCards = (text: string): ParsedCard[] => {
    try {
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) return [];
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return [];

      const cards: ParsedCard[] = [];
      for (const item of parsed) {
        let front = item.question || item.front || item.q || item.title || "";
        let back = item.correct_answer || item.back || item.answer || item.a || "";

        if (Array.isArray(item.incorrect_answers) && item.incorrect_answers.length > 0) {
          back += "\n\nOptions:\n- Correct: " + back + "\n" + item.incorrect_answers.map((opt: string) => "- Incorrect: " + opt).join("\n");
        }

        if (front && back) {
          cards.push({ front, back });
        }
      }
      return cards;
    } catch {
      return [];
    }
  };

  const extractJsonPolls = (text: string): ParsedPollQuestion[] => {
    try {
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) return [];
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return [];

      const polls: ParsedPollQuestion[] = [];
      for (const item of parsed) {
        if (item.question_text && Array.isArray(item.options)) {
          polls.push({
            question_text: item.question_text,
            options: item.options,
            correct_option_index: typeof item.correct_option_index === "number" ? item.correct_option_index : 0,
            explanation: item.explanation || "",
          });
        }
      }
      return polls;
    } catch {
      return [];
    }
  };

  const [activeProvider, setActiveProvider] = useState<string>("");
  const [activeModel, setActiveModel] = useState<string>("");

  const handleQuery = async () => {
    if (!selectedSlug || !prompt.trim()) return;
    setLoading(true);
    setError("");
    setResponse("");
    setParsedCards([]);
    setParsedPolls([]);

    try {
      const res = await fetch("http://localhost:3001/api/anything/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          slug: selectedSlug,
          message: prompt,
          mode: chatMode,
          sessionId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.provider) setActiveProvider(data.provider);
      if (data.model) setActiveModel(data.model);

      const ans = data.answer || "";
      setResponse(ans);

      // Auto detect flashcards or polls
      const cards = extractJsonCards(ans);
      if (cards.length > 0) setParsedCards(cards);

      const polls = extractJsonPolls(ans);
      if (polls.length > 0) {
        setParsedPolls(polls);
        setPollTitle(`Quiz - ${selectedSlug} (${new Date().toLocaleDateString()})`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCardsToDeck = async () => {
    if (parsedCards.length === 0) return;
    setImportingCards(true);
    try {
      let targetDeckId = selectedDeckId;

      if (createNewDeckMode) {
        if (!newDeckName.trim()) {
          throw new Error("Please enter a name for the new deck.");
        }
        let superDeck: any = undefined;
        if (parentDeckId) {
          superDeck = await db.decks.get(parentDeckId);
        }
        targetDeckId = await newDeck(newDeckName.trim(), superDeck);
      }

      if (!targetDeckId) {
        throw new Error("Please select an existing deck or type a new deck name.");
      }

      const deck = await db.decks.get(targetDeckId);
      if (!deck) throw new Error("Destination deck not found.");

      for (const card of parsedCards) {
        await BasicNoteTypeAdapter.createNote(
          { front: card.front, back: card.back },
          deck
        );
      }
      alert(
        `Successfully imported all ${parsedCards.length} flashcards into "${deck.name}" deck!`
      );
      setShowImportModal(false);
      setParsedCards([]);
      setNewDeckName("");
      setCreateNewDeckMode(false);
    } catch (err: any) {
      alert("Error importing cards: " + err.message);
    } finally {
      setImportingCards(false);
    }
  };

  const handleImportPollToDatabase = async () => {
    if (!pollTitle.trim() || parsedPolls.length === 0) return;
    setImportingPoll(true);
    try {
      const { data: pollData, error: pollErr } = await supabase
        .from("polls")
        .insert([{ title: pollTitle, status: "active" }])
        .select()
        .single();

      if (pollErr || !pollData) {
        throw new Error(pollErr?.message || "Failed to create poll in database.");
      }

      const questionRows = parsedPolls.map((q) => ({
        poll_id: pollData.id,
        question_text: q.question_text,
        options: q.options,
        correct_option_index: q.correct_option_index,
        explanation: q.explanation || null,
      }));

      const { error: qErr } = await supabase
        .from("questions")
        .insert(questionRows);

      if (qErr) {
        throw new Error(qErr.message);
      }

      alert(`Successfully created Poll "${pollTitle}" with ${parsedPolls.length} questions!`);
      setShowPollImportModal(false);
      setParsedPolls([]);
      navigate(`/polling/edit/${pollData.id}`);
    } catch (err: any) {
      alert("Error importing poll: " + err.message);
    } finally {
      setImportingPoll(false);
    }
  };

  // Saved Notification Modal state
  const [savedModalData, setSavedModalData] = useState<{
    show: boolean;
    fileName: string;
    path: string;
    isHtml: boolean;
  } | null>(null);

function buildSmartFileName(
  extension: ".html" | ".md",
  workspaceDocs: any[],
  selectedSlug: string,
  response: string
): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  let journal = selectedSlug ? selectedSlug.replace(/[^a-zA-Z0-9]/g, "") : "Nephrology";
  let firstAuthor = "Review";

  if (workspaceDocs && workspaceDocs.length > 0) {
    const docName = (
      workspaceDocs[0].filename ||
      workspaceDocs[0].title ||
      workspaceDocs[0].docpath?.split("/").pop() ||
      ""
    ).replace(/-[a-f0-9]{8}-[a-f0-9-]{27,}\.json$/i, "");

    const cleanName = docName.replace(/\.pdf|\.json$/gi, "");
    const parts = cleanName.split(/[-_\s]+/);
    if (parts.length >= 1 && parts[0].length > 2) {
      firstAuthor = parts[0];
    }

    if (cleanName.toLowerCase().includes("nephsap")) journal = "NephSAP";
    else if (cleanName.toLowerCase().includes("kdigo")) journal = "KDIGO";
    else if (cleanName.toLowerCase().includes("cjasn")) journal = "CJASN";
    else if (cleanName.toLowerCase().includes("jasn")) journal = "JASN";
    else if (cleanName.toLowerCase().includes("ki")) journal = "KidneyInt";
    else if (parts.length >= 2 && parts[1].length > 2 && !/^\d+$/.test(parts[1])) {
      journal = parts[1];
    }
  }

  const authorMatch = response.match(/Citation[:\s]*([A-Z][a-z]+)/i);
  if (authorMatch && authorMatch[1]) {
    firstAuthor = authorMatch[1];
  }
  const journalMatch = response.match(/(NephSAP|KDIGO|CJASN|JASN|Kidney International|Nephrology)/i);
  if (journalMatch && journalMatch[1]) {
    journal = journalMatch[1].replace(/\s+/g, "");
  }

  journal = journal.replace(/[^a-zA-Z0-9]/g, "");
  firstAuthor = firstAuthor.replace(/[^a-zA-Z0-9]/g, "");

  return `${yy}_${mm}_${journal}_${firstAuthor}${extension}`;
}

function convertMarkdownToHtmlReport(fallbackTitle: string, md: string): string {
  // Normalize header levels (convert ### 1., ### 2., etc. to ## 1., ## 2.)
  let normalized = md.replace(/^###\s+([0-9]+\.)/gim, "## $1");

  // 1. Extract Real Title & Subtitle if present
  let articleTitle = "Hyponatremia";
  const titleMatch = normalized.match(/(?:Hyponatremia|Acute Kidney Injury|CKD|Glomerulonephritis|Nephrotic|Dialysis|Renal)/i);
  if (titleMatch) {
    articleTitle = titleMatch[0];
  }

  // 2. Table Parser
  let parsed = normalized.replace(/((?:\|[^\n]+\|\n)+)/g, (match) => {
    const lines = match.trim().split("\n");
    if (lines.length < 2) return match;
    let html = "<table>";

    const headers = lines[0]
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, idx, arr) => idx > 0 && idx < arr.length - 1);
    html += "<thead><tr>";
    headers.forEach((h) => (html += `<th>${h}</th>`));
    html += "</tr></thead><tbody>";

    const bodyLines = lines.slice(2);
    bodyLines.forEach((line) => {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cells.length > 0) {
        html += "<tr>";
        cells.forEach((c) => {
          if (c.includes("⭐") || c.includes("★")) {
            html += `<td class="stars">${c}</td>`;
          } else {
            html += `<td>${c}</td>`;
          }
        });
        html += "</tr>";
      }
    });

    html += "</tbody></table>";
    return html;
  });

  // 3. Wrap star ratings (⭐) in golden star span
  parsed = parsed.replace(/(⭐[⭐☆]+|★[★☆]+)/g, '<span class="stars">$1</span>');

  // 4. Headings & Basic formatting
  parsed = parsed
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/^\* (.*$)/gim, "<li>$1</li>")
    .replace(/^- (.*$)/gim, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>");

  // 5. Wrap lists
  parsed = parsed.replace(/(<li>[\s\S]*?<\/li>)/gi, "<ul>$1</ul>");
  parsed = parsed.replace(/<\/ul>\s*<ul>/gi, "");

  // 6. Section Transformations into Callout Boxes & Cards (ChatGPT 100% Match)

  // Clinical Bottom Line Callout Box (Dark Navy)
  parsed = parsed.replace(
    /(<h2>10\. Clinical Bottom Line[\s\S]*?(?:<h2>|<div class="footer">|$))/gi,
    (match) => {
      const content = match.replace(/<h2>10\. Clinical Bottom Line<\/h2>/i, "");
      return `<div class="bottom"><h2>Clinical bottom line</h2>${content}</div>`;
    }
  );

  // Critical Appraisal Callout Box (Gold Warning Box)
  parsed = parsed.replace(
    /(<h2>7\. Critical Appraisal[\s\S]*?(?:<h2>|<div class="bottom">|$))/gi,
    (match) => {
      const content = match.replace(/<h2>7\. Critical Appraisal.*?<\/h2>/i, "");
      return `<div class="alert"><strong>Critical EBM Appraisal &amp; Evidence Ratings</strong>${content}</div>`;
    }
  );

  // Rapid Clinical Read Callout Box (Pale Blue Takeaway Box)
  parsed = parsed.replace(
    /(<h2>2\. Rapid Clinical Read[\s\S]*?(?:<h2>|<div class="alert">|<div class="bottom">|$))/gi,
    (match) => {
      const content = match.replace(/<h2>2\. Rapid Clinical Read.*?<\/h2>/i, "");
      return `<div class="takeaway"><strong>Rapid Clinical Read</strong>${content}</div>`;
    }
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${articleTitle} — Clinical Synthesis &amp; Appraisal</title>
  <style>
    :root{--ink:#17212b;--muted:#566573;--navy:#153c55;--blue:#1e6c8f;--pale:#eef7fa;--line:#d7e1e6;--warn:#fff5df;--warnline:#d99822;--good:#eaf6ef;--paper:#fff}
    *{box-sizing:border-box} body{margin:0;background:#edf2f4;color:var(--ink);font:16px/1.58 system-ui,-apple-system,"Segoe UI",sans-serif}
    main{max-width:1040px;margin:36px auto;padding:0 24px 70px} article{background:var(--paper);padding:48px 54px;border-radius:14px;box-shadow:0 8px 30px #18334216}
    h1,h2,h3{line-height:1.2;color:var(--navy)} h1{font-size:2.25rem;margin:.2rem 0 .5rem} h2{margin:2.2rem 0 .8rem;padding-bottom:.35rem;border-bottom:2px solid var(--line);font-size:1.45rem} h3{font-size:1.08rem;margin:1.5rem 0 .4rem}
    p{margin:.55rem 0 1rem}.kicker{color:var(--blue);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.78rem}.subtitle{font-size:1.12rem;color:var(--muted);margin-bottom:1.4rem}
    .alert,.takeaway,.bottom{border-radius:8px;padding:16px 18px;margin:1.2rem 0}.alert{background:var(--warn);border-left:5px solid var(--warnline)}.takeaway{background:var(--pale);border-left:5px solid var(--blue)}.bottom{background:var(--navy);color:white}.bottom h2{color:white;border-color:#ffffff55;margin-top:0}.bottom p,.bottom strong{color:#f8fafc}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{border:1px solid var(--line);border-radius:8px;padding:15px 17px;background:#fcfeff}.card h3{margin-top:0}
    table{width:100%;border-collapse:collapse;margin:1rem 0 1.4rem;font-size:.93rem}th,td{text-align:left;vertical-align:top;padding:10px 11px;border:1px solid var(--line)}th{background:#eaf2f5;color:var(--navy)}tr:nth-child(even) td{background:#fafcfd}
    ul,ol{padding-left:1.35rem}li{margin:.35rem 0}.small{font-size:.88rem;color:var(--muted)}.tag{display:inline-block;border-radius:999px;padding:3px 9px;background:#e8f1f5;color:var(--navy);font-size:.8rem;font-weight:650;margin:2px}
    .stars{color:#b76d00;letter-spacing:.08em;white-space:nowrap;font-weight:bold;font-size:1.1em}.flow{counter-reset:s;list-style:none;padding:0}.flow li{position:relative;padding:12px 14px 12px 46px;margin:8px 0;border:1px solid var(--line);border-radius:8px}.flow li:before{counter-increment:s;content:counter(s);position:absolute;left:13px;top:11px;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:var(--blue);color:white;font-weight:700;font-size:.8rem}
    code{background:#edf2f4;border-radius:4px;padding:2px 5px}.footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line);font-size:.82rem;color:var(--muted)}
    @media(max-width:720px){main{padding:0;margin:0}article{border-radius:0;padding:28px 20px;box-shadow:none}.grid{grid-template-columns:1fr}h1{font-size:1.85rem}table{display:block;overflow-x:auto}}
    @media print{body{background:white;font-size:11pt}main{margin:0;max-width:none;padding:0}article{box-shadow:none;padding:0}.alert,.takeaway,.bottom,.card{break-inside:avoid}h2{break-after:avoid}a{color:inherit}}
  </style>
</head>
<body>
  <main>
    <article>
      <div class="kicker">Clinical review appraisal · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <h1>${articleTitle}</h1>
      <p class="subtitle">Comfortable-reading clinical synthesis and evidence-based appraisal</p>
      ${parsed}
      <div class="footer">Generated via Skola AI Assistant &amp; AnythingLLM • Saved to OneDrive</div>
    </article>
  </main>
</body>
</html>`;
}

  const handleSaveToOneDrive = async () => {
    if (!response || !selectedSlug) return;
    const fileName = buildSmartFileName(".md", workspaceDocs, selectedSlug, response);

    let folderPath = ONEDRIVE_BASE;
    if (selectedSlug.toLowerCase().includes("ckd")) folderPath += "/01-CKD";
    else if (selectedSlug.toLowerCase().includes("aki")) folderPath += "/02-AKI";

    try {
      const res = await fetch("http://localhost:3001/api/save_text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: response, fileName, folderPath }),
      });
      const data = await res.json();

      if (data.success) {
        setSavedModalData({
          show: true,
          fileName,
          path: data.path,
          isHtml: false,
        });
      } else {
        alert("Failed to save: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
    }
  };

  const handleSaveHtmlToOneDrive = async () => {
    if (!response || !selectedSlug) return;
    const fileName = buildSmartFileName(".html", workspaceDocs, selectedSlug, response);

    let folderPath = ONEDRIVE_BASE;
    if (selectedSlug.toLowerCase().includes("ckd")) folderPath += "/01-CKD";
    else if (selectedSlug.toLowerCase().includes("aki")) folderPath += "/02-AKI";

    const reportTitle = fileName.replace(/\.html$/i, "").replace(/_/g, " ");
    const htmlContent = convertMarkdownToHtmlReport(reportTitle, response);

    try {
      const res = await fetch("http://localhost:3001/api/save_text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: htmlContent, fileName, folderPath }),
      });
      const data = await res.json();

      if (data.success) {
        setSavedModalData({
          show: true,
          fileName,
          path: data.path,
          isHtml: true,
        });
      } else {
        alert("Failed to save HTML report: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving HTML report: " + err.message);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem("anything_base_url", baseUrl);
    localStorage.setItem("anything_api_key", apiKey);
    setShowSettingsModal(false);
    fetchWorkspaces();
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join("\n"));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleDeleteDoc = async (docPath: string, fileName: string) => {
    if (!selectedSlug || !docPath) return;
    if (!confirm(`Are you sure you want to remove "${fileName}" from workspace [${selectedSlug}]?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/anything/delete_doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          slug: selectedSlug,
          docPath,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      fetchWorkspaceDocs(selectedSlug);
      handleResetSession();
    } catch (err: any) {
      alert("Error removing document: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!selectedSlug) {
      alert("Please select an AnythingLLM Workspace (Project) dropdown first before uploading documents!");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadingFile(true);
    setError("");

    try {
      for (const file of files) {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const resultStr = reader.result as string;
              const base64 = resultStr.split(",")[1];
              const res = await fetch("http://localhost:3001/api/anything/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  baseUrl,
                  apiKey,
                  slug: selectedSlug,
                  fileName: file.name,
                  fileBase64: base64,
                }),
              });

              const data = await res.json();
              if (data.error) throw new Error(data.error);
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      alert(
        `Successfully uploaded & embedded ${files.length} document(s) into workspace [${selectedSlug}]!`
      );
      fetchWorkspaceDocs(selectedSlug);
      handleResetSession();
    } catch (err: any) {
      setError("Upload error: " + err.message);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="anythingllm-view">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.txt,.md,.docx"
        style={{ display: "none" }}
      />
      <div className="anythingllm-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <IconBrain size={32} />
            <h1>AnythingLLM Assistant</h1>
            {isConnected !== null && (
              <div
                className={`anythingllm-status ${isConnected ? "connected" : "disconnected"}`}
              >
                <span className="status-dot"></span>
                {isConnected ? "Connected" : "Disconnected"}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || !selectedSlug}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#0284c7",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: uploadingFile || !selectedSlug ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <IconFileUpload size={16} />
              {uploadingFile ? "Uploading..." : "+ Add PDF / Articles"}
            </button>

            <button
              onClick={handleResetSession}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <IconTrash size={16} />
              Clear Chat
            </button>

            <button
              onClick={fetchWorkspaces}
              disabled={loading}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <IconRefresh size={16} />
              {loading ? "Refreshing..." : "Refresh Projects"}
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#4c1d95",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <IconSettings size={16} />
              Settings
            </button>

            <button
              onClick={() => {
                fetchLogs();
                setShowConsoleModal(true);
              }}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#4b5563",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <IconBug size={16} />
              Console Logs
            </button>
          </div>
        </div>
      </div>

      {error && <div className="anythingllm-error">{error}</div>}

      <div className="anythingllm-controls">
        <label>
          Select AnythingLLM Workspace (Project):
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
          >
            <option value="">-- Choose a Workspace --</option>
            {workspaces.map((w) => (
              <option key={w.id || w.slug} value={w.slug || w.name}>
                {w.name} ({w.slug})
              </option>
            ))}
          </select>
        </label>

        {selectedSlug && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#475569",
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              📄 Embedded Workspace Documents ({workspaceDocs.length}):
            </div>
            {workspaceDocs.length === 0 ? (
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                No documents uploaded yet. Click "+ Add PDF / Articles" above to add your journal paper!
              </span>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                {workspaceDocs.map((doc: any, i: number) => {
                  const title =
                    doc.filename ||
                    doc.title ||
                    doc.docpath?.split("/").pop() ||
                    `Document ${i + 1}`;
                  const cleanTitle = title.replace(/-[a-f0-9]{8}-[a-f0-9-]{27,}\.json$/i, "");
                  const docPath = doc.docpath || doc.filename || "";

                  return (
                    <span
                      key={i}
                      style={{
                        fontSize: "12px",
                        padding: "4px 10px",
                        background: "#e0f2fe",
                        color: "#0369a1",
                        borderRadius: "6px",
                        border: "1px solid #bae6fd",
                        fontWeight: 500,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>📄 {cleanTitle}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(docPath, cleanTitle);
                        }}
                        title={`Remove ${cleanTitle} from workspace`}
                        style={{
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "16px",
                          height: "16px",
                          fontSize: "10px",
                          fontWeight: "bold",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="anythingllm-chat">
        <textarea
          placeholder="Ask AnythingLLM a question about your project documents..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          rows={4}
        />

        {/* 3 Pipeline Preset Buttons */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => setPrompt(JCLUB_PROMPT)}
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              background: "#e0f2fe",
              color: "#0369a1",
              border: "1px solid #bae6fd",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Prompt 1: Journal Article Review (#JClub)
          </button>

          <button
            type="button"
            onClick={() => setPrompt(ANKI_JSON_PROMPT)}
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              background: "#ede9fe",
              color: "#5b21b6",
              border: "1px solid #ddd6fe",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Prompt 2: Generate JSON Flashcards
          </button>

          <button
            type="button"
            onClick={() => setPrompt(POLL_JSON_PROMPT)}
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              background: "#fae8ff",
              color: "#86198f",
              border: "1px solid #f5d0fe",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Prompt 3: Generate JSON Poll
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "10px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>
              RAG Search Mode:
            </span>
            <label style={{ fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", color: "#1e293b" }}>
              <input
                type="radio"
                name="chatMode"
                value="chat"
                checked={chatMode === "chat"}
                onChange={() => setChatMode("chat")}
              />
              <strong>Chat Mode</strong> (Full Document Context - Recommended)
            </label>

            <label style={{ fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", color: "#64748b" }}>
              <input
                type="radio"
                name="chatMode"
                value="query"
                checked={chatMode === "query"}
                onChange={() => setChatMode("query")}
              />
              <strong>Query Mode</strong> (Strict Vector Match)
            </label>
          </div>

          <button
            onClick={handleQuery}
            disabled={loading || !selectedSlug || !prompt.trim()}
            className="anythingllm-button"
          >
            {loading ? "Querying AnythingLLM..." : "Ask AnythingLLM"}
          </button>
        </div>
      </div>

      {response && (
        <div className="anythingllm-response">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "14px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <span style={{ color: "#10b981", fontSize: "14px" }}>⚡</span>
            <span>
              Provider: <strong style={{ color: "#0284c7" }}>{activeProvider || "AnythingLLM (System Default)"}</strong>
            </span>
            <span style={{ opacity: 0.35 }}>|</span>
            <span>
              Model: <strong style={{ color: "#7c3aed" }}>{activeModel || "Default Model"}</strong>
            </span>
            <span style={{ opacity: 0.35 }}>|</span>
            <span>
              Mode: <strong style={{ color: "#059669" }}>{chatMode.toUpperCase()}</strong>
            </span>
          </div>

          <h3>Response</h3>
          <p>{response}</p>

          {parsedCards.length > 0 && (
            <div className="anything-json-card">
              <h4>
                <IconCode size={20} />
                Detected {parsedCards.length} JSON Flashcards in Response!
              </h4>
              <div className="json-preview">
                {JSON.stringify(parsedCards.slice(0, 2), null, 2)}
                {parsedCards.length > 2 && "\n... (and more)"}
              </div>
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  marginTop: "12px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "#059669",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <IconPlus size={18} />
                Import {parsedCards.length} Flashcards into Deck
              </button>
            </div>
          )}

          {parsedPolls.length > 0 && (
            <div
              className="anything-json-card"
              style={{ background: "#fdf4ff", borderColor: "#f0abfc" }}
            >
              <h4 style={{ color: "#a21caf" }}>
                <IconTrophy size={20} />
                Detected {parsedPolls.length} Poll Questions in Response!
              </h4>
              <div className="json-preview" style={{ background: "#3b0764", color: "#f5d0fe" }}>
                {JSON.stringify(parsedPolls.slice(0, 2), null, 2)}
                {parsedPolls.length > 2 && "\n... (and more)"}
              </div>
              <button
                onClick={() => setShowPollImportModal(true)}
                style={{
                  marginTop: "12px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "#9333ea",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <IconPlus size={18} />
                Import {parsedPolls.length} Questions into Live Polling
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "1.5rem",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleSaveHtmlToOneDrive}
              className="anythingllm-button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#0284c7",
              }}
            >
              <IconCloudDownload size={18} />
              Export HTML Report (.html) to OneDrive
            </button>

            <button
              onClick={handleSaveToOneDrive}
              className="anythingllm-button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#10b981",
              }}
            >
              <IconCloudDownload size={18} />
              Save Markdown (.md) to OneDrive
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowSettingsModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <IconSettings size={22} color="#7c3aed" />
                AnythingLLM Connection Settings
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowSettingsModal(false)}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: "4px",
                    color: "#374151",
                  }}
                >
                  AnythingLLM API Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:59484/api/v1"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                  }}
                />
                <small style={{ color: "#6b7280" }}>
                  Default is http://127.0.0.1:59484/api/v1
                </small>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: "4px",
                    color: "#374151",
                  }}
                >
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={handleSaveSettings}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Save Settings & Test
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deck Selector Import Modal */}
      {showImportModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowImportModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <IconPlus size={22} color="#059669" />
                Select Deck for {parsedCards.length} Flashcards
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowImportModal(false)}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                <button
                  type="button"
                  onClick={() => setCreateNewDeckMode(false)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: createNewDeckMode ? "1px solid #d1d5db" : "2px solid #059669",
                    background: createNewDeckMode ? "#f9fafb" : "#ecfdf5",
                    color: createNewDeckMode ? "#4b5563" : "#047857",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Select Existing Deck
                </button>
                <button
                  type="button"
                  onClick={() => setCreateNewDeckMode(true)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: !createNewDeckMode ? "1px solid #d1d5db" : "2px solid #059669",
                    background: !createNewDeckMode ? "#f9fafb" : "#ecfdf5",
                    color: !createNewDeckMode ? "#4b5563" : "#047857",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  + Create New Deck
                </button>
              </div>

              {!createNewDeckMode ? (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "#374151",
                      fontSize: "13px",
                    }}
                  >
                    Target Deck:
                  </label>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  >
                    <option value="">-- Select Destination Deck --</option>
                    {allDecks?.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        📁 {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: "#374151",
                        fontSize: "13px",
                      }}
                    >
                      New Deck Name:
                    </label>
                    <input
                      type="text"
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      placeholder="e.g. AKI Fundamentals, AKI KSAP, Hyponatremia Review"
                      style={{
                        width: "100%",
                        padding: "0.65rem",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "4px",
                        color: "#374151",
                        fontSize: "13px",
                      }}
                    >
                      Parent / Group Deck (Optional):
                    </label>
                    <select
                      value={parentDeckId}
                      onChange={(e) => setParentDeckId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                      }}
                    >
                      <option value="">-- None (Top Level Deck) --</option>
                      {allDecks?.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          📁 {d.name}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", display: "block" }}>
                      Example: Choose parent "AKI" to place "AKI Fundamentals" inside it as a sub-deck!
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={handleImportCardsToDeck}
                disabled={
                  importingCards ||
                  (!createNewDeckMode && !selectedDeckId) ||
                  (createNewDeckMode && !newDeckName.trim())
                }
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "#059669",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    importingCards ||
                    (!createNewDeckMode && !selectedDeckId) ||
                    (createNewDeckMode && !newDeckName.trim())
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {importingCards
                  ? "Importing..."
                  : createNewDeckMode
                  ? "Create Deck & Import 20 Cards"
                  : "Confirm Import 20 Cards"}
              </button>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Poll Import Modal */}
      {showPollImportModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPollImportModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <IconTrophy size={22} color="#9333ea" />
                Import {parsedPolls.length} Questions into Live Polling
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowPollImportModal(false)}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="modal-body">
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "8px",
                  color: "#374151",
                }}
              >
                Poll Title:
              </label>
              <input
                type="text"
                value={pollTitle}
                onChange={(e) => setPollTitle(e.target.value)}
                placeholder="e.g. Baxdrostat Bax24 Quiz"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={handleImportPollToDatabase}
                disabled={importingPoll || !pollTitle.trim()}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "#9333ea",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    importingPoll || !pollTitle.trim()
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {importingPoll ? "Creating Poll..." : "Create Poll & Edit"}
              </button>
              <button
                onClick={() => setShowPollImportModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Console Modal */}
      {showConsoleModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowConsoleModal(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "750px" }}
          >
            <div className="modal-header">
              <h2>
                <IconBug size={22} color="#7c3aed" />
                Debug Console & Logs
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowConsoleModal(false)}
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  Real-time Proxy Output ({logs.length} lines):
                </span>
                <button
                  onClick={fetchLogs}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    background: "#e5e7eb",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Refresh Logs
                </button>
              </div>

              <div className="log-viewer">
                {logs.length === 0 ? (
                  <span style={{ color: "#94a3b8" }}>
                    No logs recorded yet.
                  </span>
                ) : (
                  logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.includes("[ERROR]")
                          ? "log-line-error"
                          : log.includes("[INFO]")
                          ? "log-line-info"
                          : ""
                      }
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={handleCopyLogs}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: copiedLogs ? "#10b981" : "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {copiedLogs ? <IconCheck size={18} /> : <IconCopy size={18} />}
                {copiedLogs ? "Copied!" : "Copy Logs to Clipboard"}
              </button>
              <button
                onClick={() => setShowConsoleModal(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Notification Modal */}
      {savedModalData?.show && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setSavedModalData(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "28px 32px",
              maxWidth: "540px",
              width: "90%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#ecfdf5",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: "32px",
                fontWeight: "bold",
                border: "2px solid #a7f3d0",
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
              {savedModalData.isHtml ? "HTML Report Saved to OneDrive" : "Markdown Document Saved to OneDrive"}
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>
              Your report was successfully compiled and saved in your OneDrive folder.
            </p>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "14px 18px",
                textAlign: "left",
                fontSize: "13px",
                marginBottom: "24px",
                wordBreak: "break-all",
              }}
            >
              <div style={{ color: "#334155", fontWeight: 700, marginBottom: "6px" }}>
                📄 File Name: <span style={{ color: "#0284c7" }}>{savedModalData.fileName}</span>
              </div>
              <div style={{ color: "#334155", fontWeight: 700 }}>
                📁 Full Saved Path: <span style={{ color: "#475569", fontWeight: 500 }}>{savedModalData.path}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setSavedModalData(null)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 6px -1px rgba(2, 132, 199, 0.3)",
                }}
              >
                Awesome, Done!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
