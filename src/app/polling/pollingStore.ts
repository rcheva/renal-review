import { supabase } from "@/logic/supabase";
import { Student, PollGroup } from "./types";

const LOCAL_STUDENTS_KEY = "renal_review_students";
const LOCAL_GROUPS_KEY = "renal_review_poll_groups";

export const DEFAULT_GROUPS: PollGroup[] = [
  { id: "renal", name: "Renal", description: "Renal Specialist Review" },
  { id: "ul", name: "UL", description: "University Hospital Limerick" },
  { id: "tuh", name: "TUH", description: "Tallaght University Hospital" },
];

export async function getPollGroups(): Promise<PollGroup[]> {
  try {
    const { data, error } = await supabase.from("poll_groups").select("*").order("name");
    if (!error && data && data.length > 0) {
      return data as PollGroup[];
    }
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
    const { data, error } = await supabase.from("students").select("*").order("name");
    if (!error && data) {
      return data as Student[];
    }
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
