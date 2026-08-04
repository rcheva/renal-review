import { supabase } from "@/logic/supabase";
import { Student, PollGroup, Poll, Question } from "./types";

const LOCAL_STUDENTS_KEY = "renal_review_students";
const LOCAL_GROUPS_KEY = "renal_review_poll_groups";
export const LOCAL_POLLS_KEY = "renal_review_polls";

export const DEFAULT_GROUPS: PollGroup[] = [
  { id: "renal", name: "Renal", description: "Renal Specialist Review" },
  { id: "ul", name: "UL", description: "University Hospital Limerick" },
  { id: "tuh", name: "TUH", description: "Tallaght University Hospital" },
];

export async function getPollGroups(): Promise<PollGroup[]> {
  try {
    const fetchCloud = async () => {
      const { data, error } = await supabase.from("poll_groups").select("*").order("name");
      if (!error && data && data.length > 0) {
        return data as PollGroup[];
      }
      return null;
    };
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 2000)
    );
    const res = await Promise.race([fetchCloud(), timeoutPromise]);
    if (res) return res;
  } catch (e) {
    console.warn("Supabase poll_groups table missing or unreachable, using local storage fallback", e);
  }

  const local = localStorage.getItem(LOCAL_GROUPS_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      // ignore
    }
  }

  localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(DEFAULT_GROUPS));
  return DEFAULT_GROUPS;
}

export async function addPollGroup(name: string, description?: string): Promise<PollGroup> {
  const newGroup: PollGroup = {
    id: name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now(),
    name: name.trim(),
    description: description?.trim() || "",
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase.from("poll_groups").insert([newGroup]).select().single();
    if (!error && data) {
      return data as PollGroup;
    }
  } catch (e) {
    console.warn("Could not insert poll_group into Supabase, saving locally", e);
  }

  const existing = await getPollGroups();
  const updated = [...existing, newGroup];
  localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(updated));
  return newGroup;
}

export async function getStudents(): Promise<Student[]> {
  try {
    const fetchCloud = async () => {
      const { data, error } = await supabase.from("students").select("*").order("name");
      if (!error && data) {
        return data as Student[];
      }
      return null;
    };
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 2000)
    );
    const res = await Promise.race([fetchCloud(), timeoutPromise]);
    if (res) return res;
  } catch (e) {
    console.warn("Supabase students table error, falling back to local storage", e);
  }

  const local = localStorage.getItem(LOCAL_STUDENTS_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      // ignore
    }
  }
  return [];
}

export async function findStudentByCode(studentCode: string): Promise<Student | null> {
  const codeClean = studentCode.trim().toUpperCase();
  const all = await getStudents();
  return all.find((s) => s.student_code.toUpperCase() === codeClean) || null;
}

export async function registerStudent(student: Omit<Student, "id" | "created_at">): Promise<Student> {
  const newStudent: Student = {
    id: "stu_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    student_code: student.student_code.trim().toUpperCase(),
    name: student.name.trim(),
    pin: student.pin.trim(),
    group_name: student.group_name || "Renal",
    rotation_start: student.rotation_start || new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase.from("students").insert([newStudent]).select().single();
    if (!error && data) {
      return data as Student;
    }
  } catch (e) {
    console.warn("Could not insert student into Supabase, saving locally", e);
  }

  const existing = await getStudents();
  const updated = [...existing, newStudent];
  localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(updated));
  return newStudent;
}

export function getCurrentSessionStudent(): Student | null {
  const json = sessionStorage.getItem("active_student_session");
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function setCurrentSessionStudent(student: Student | null): void {
  if (student) {
    sessionStorage.setItem("active_student_session", JSON.stringify(student));
  } else {
    sessionStorage.removeItem("active_student_session");
  }
}

export async function updateStudent(updatedStudent: Student): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("students")
      .update({
        name: updatedStudent.name,
        student_code: updatedStudent.student_code.toUpperCase(),
        pin: updatedStudent.pin,
        group_name: updatedStudent.group_name,
        rotation_start: updatedStudent.rotation_start,
      })
      .eq("id", updatedStudent.id);
    if (error) {
      console.warn("Could not update student in Supabase, updating locally", error);
    }
  } catch (e) {
    console.warn("Supabase student update error, updating locally", e);
  }

  const existing = await getStudents();
  const updatedList = existing.map((s) => (s.id === updatedStudent.id ? updatedStudent : s));
  localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(updatedList));
  return true;
}

export async function deleteStudent(studentId: string, studentCode?: string): Promise<boolean> {
  try {
    await supabase.from("students").delete().eq("id", studentId);
    if (studentCode) {
      await supabase.from("responses").delete().eq("student_id", studentCode);
    }
  } catch (e) {
    console.warn("Could not delete student from Supabase, deleting locally", e);
  }

  const existing = await getStudents();
  const filtered = existing.filter((s) => s.id !== studentId && (studentCode ? s.student_code !== studentCode : true));
  localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(filtered));

  if (studentCode) {
    const localResponses = localStorage.getItem("renal_review_responses");
    if (localResponses) {
      try {
        const respList: any[] = JSON.parse(localResponses);
        const filteredResp = respList.filter((r) => r.student_id !== studentCode);
        localStorage.setItem("renal_review_responses", JSON.stringify(filteredResp));
      } catch (err) {
        // ignore
      }
    }
  }

  return true;
}

// Offline Queueing & Auto-Sync Engine
const OFFLINE_QUEUE_KEY = "renal_pending_offline_responses";
const CACHED_POLLS_KEY = "renal_cached_polls";
const CACHED_QUESTIONS_KEY = "renal_cached_questions";

export interface PendingResponse {
  id: string;
  question_id: string;
  selected_option_index: number;
  respondent_name: string | null;
  hospital: string | null;
  student_id: string | null;
  is_correct: boolean;
  created_at: string;
}

export function queueOfflineResponse(payload: Omit<PendingResponse, "id" | "created_at">): PendingResponse {
  const item: PendingResponse = {
    ...payload,
    id: "offline_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    created_at: new Date().toISOString(),
  };

  const existing = getOfflineResponsesQueue();
  const updated = [...existing, item];
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  return item;
}

export function getOfflineResponsesQueue(): PendingResponse[] {
  const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function flushOfflineResponsesQueue(): Promise<number> {
  const queue = getOfflineResponsesQueue();
  if (queue.length === 0) return 0;

  let syncedCount = 0;
  const remaining: PendingResponse[] = [];

  for (const item of queue) {
    try {
      const payload = {
        question_id: item.question_id,
        selected_option_index: item.selected_option_index,
        respondent_name: item.respondent_name,
        hospital: item.hospital,
        student_id: item.student_id,
        is_correct: item.is_correct,
        created_at: item.created_at,
      };

      const { error } = await supabase.from("responses").insert([payload]);
      if (!error) {
        syncedCount++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  return syncedCount;
}

export function cachePollAndQuestions(poll: any, questions: any[]): void {
  try {
    const pollsMap = JSON.parse(localStorage.getItem(CACHED_POLLS_KEY) || "{}");
    pollsMap[poll.id] = poll;
    localStorage.setItem(CACHED_POLLS_KEY, JSON.stringify(pollsMap));

    const questionsMap = JSON.parse(localStorage.getItem(CACHED_QUESTIONS_KEY) || "{}");
    questionsMap[poll.id] = questions;
    localStorage.setItem(CACHED_QUESTIONS_KEY, JSON.stringify(questionsMap));
  } catch {
    // ignore
  }
}

export function getCachedPollAndQuestions(pollId: string): { poll: any | null; questions: any[] } {
  try {
    const pollsMap = JSON.parse(localStorage.getItem(CACHED_POLLS_KEY) || "{}");
    const questionsMap = JSON.parse(localStorage.getItem(CACHED_QUESTIONS_KEY) || "{}");
    return {
      poll: pollsMap[pollId] || null,
      questions: questionsMap[pollId] || [],
    };
  } catch {
    return { poll: null, questions: [] };
  }
}

export async function savePollAndQuestions(
  poll: Poll,
  questions: Question[]
): Promise<{ success: boolean; isCloud: boolean; message: string }> {
  const pollId = poll.id;

  const pollWithCount = {
    ...poll,
    questions_count: questions.length,
  };

  // 1. Save locally (INSTANT)
  try {
    const localPollsStr = localStorage.getItem(LOCAL_POLLS_KEY);
    const localPolls: Poll[] = localPollsStr ? JSON.parse(localPollsStr) : [];

    const existingIndex = localPolls.findIndex((p) => p.id === pollId);
    let updatedLocalPolls: Poll[];
    if (existingIndex >= 0) {
      updatedLocalPolls = [...localPolls];
      updatedLocalPolls[existingIndex] = pollWithCount;
    } else {
      updatedLocalPolls = [pollWithCount, ...localPolls];
    }
    localStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(updatedLocalPolls));

    // Save questions locally
    const localQKey = `renal_questions_${pollId}`;
    localStorage.setItem(localQKey, JSON.stringify(questions));

    // Cache poll & questions
    cachePollAndQuestions(pollWithCount, questions);
  } catch (err) {
    console.warn("Failed saving poll locally:", err);
  }

  // 2. Try Supabase cloud sync with timeout safety
  let cloudSuccess = false;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pollId);

    const pollPayload = {
      id: poll.id,
      title: poll.title,
      status: poll.status,
      group_name: poll.group_name || "Renal",
      created_at: poll.created_at || new Date().toISOString(),
    };

    const syncCloud = async () => {
      const { error: pollErr } = await supabase.from("polls").upsert([pollPayload]);
      if (pollErr) return false;

      if (questions.length > 0) {
        const qPayloads = questions.map((q) => {
          const payload: any = {
            poll_id: pollId,
            question_text: q.question_text,
            options: q.options,
            correct_option_index: q.correct_option_index,
            explanation: q.explanation || null,
          };
          if (isUuid && q.id && !q.id.startsWith("q_")) {
            payload.id = q.id;
          }
          return payload;
        });

        const { error: qErr } = await supabase.from("questions").upsert(qPayloads);
        if (qErr) {
          console.warn("Questions cloud upsert error:", qErr);
        }
      }
      return true;
    };

    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 2000)
    );

    cloudSuccess = await Promise.race([syncCloud(), timeoutPromise]);
  } catch (e) {
    console.warn("Cloud sync exception:", e);
  }

  if (cloudSuccess) {
    return {
      success: true,
      isCloud: true,
      message: `Poll "${poll.title}" (${questions.length} questions) is saved in system cloud and available live!`,
    };
  } else {
    return {
      success: true,
      isCloud: false,
      message: `Poll "${poll.title}" (${questions.length} questions) is saved on this device and available live!`,
    };
  }
}

export async function getAllPolls(): Promise<(Poll & { questions_count?: number })[]> {
  const localPollsStr = localStorage.getItem(LOCAL_POLLS_KEY);
  let localPolls: (Poll & { questions_count?: number })[] = [];
  if (localPollsStr) {
    try {
      localPolls = JSON.parse(localPollsStr);
    } catch {
      // ignore
    }
  }

  let cloudPolls: any[] = [];
  try {
    const fetchCloud = async () => {
      const { data, error } = await supabase
        .from("polls")
        .select("*, questions(count)")
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data.map((p) => ({
          ...p,
          questions_count: p.questions?.[0]?.count ?? 0,
        }));
      }
      return [];
    };

    const timeoutPromise = new Promise<any[]>((resolve) =>
      setTimeout(() => resolve([]), 2000)
    );

    cloudPolls = await Promise.race([fetchCloud(), timeoutPromise]);
  } catch (e) {
    console.warn("Could not fetch cloud polls:", e);
  }

  const map = new Map<string, Poll & { questions_count?: number }>();

  for (const lp of localPolls) {
    if (lp.questions_count === undefined || lp.questions_count === 0) {
      const qStr = localStorage.getItem(`renal_questions_${lp.id}`);
      if (qStr) {
        try {
          lp.questions_count = JSON.parse(qStr).length;
        } catch {
          lp.questions_count = 0;
        }
      } else {
        lp.questions_count = 0;
      }
    }
    map.set(lp.id, lp);
  }

  for (const cp of cloudPolls) {
    const existing = map.get(cp.id);
    map.set(cp.id, {
      ...existing,
      ...cp,
      questions_count: cp.questions_count ?? existing?.questions_count ?? 0,
    });
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return merged;
}

export function exportAllPollsJson(): string {
  const localPollsStr = localStorage.getItem(LOCAL_POLLS_KEY);
  const localPolls: Poll[] = localPollsStr ? JSON.parse(localPollsStr) : [];

  const packageData = localPolls.map((poll) => {
    const qStr = localStorage.getItem(`renal_questions_${poll.id}`);
    const questions: Question[] = qStr ? JSON.parse(qStr) : [];
    return {
      poll,
      questions,
    };
  });

  return JSON.stringify(packageData, null, 2);
}

export async function importPollsFromJson(jsonStr: string): Promise<number> {
  try {
    let text = jsonStr.trim();
    if (text.startsWith("```json")) text = text.replace(/```json/g, "");
    if (text.startsWith("```")) text = text.replace(/```/g, "");
    if (text.endsWith("```")) text = text.slice(0, -3);

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("JSON must be an array of poll package objects.");

    let importedCount = 0;
    for (const item of parsed) {
      if (item.poll && item.poll.id && item.poll.title) {
        await savePollAndQuestions(item.poll, item.questions || []);
        importedCount++;
      }
    }
    return importedCount;
  } catch (err: any) {
    throw new Error("Invalid poll package format: " + err.message);
  }
}


