import { supabase } from "@/logic/supabase";
import { Student, Question, Response } from "./types";

export interface SeedingResult {
  studentsCount: number;
  responsesCount: number;
  message: string;
}

export const TEST_STUDENTS: Omit<Student, "id" | "created_at">[] = [
  {
    student_code: "STU101",
    name: "Dr. Sarah Jenkins",
    pin: "1001",
    group_name: "Renal",
    rotation_start: "2026-07-01T08:00:00Z",
  },
  {
    student_code: "STU102",
    name: "Dr. Michael O'Connor",
    pin: "1002",
    group_name: "UL",
    rotation_start: "2026-07-05T08:00:00Z",
  },
  {
    student_code: "STU103",
    name: "Dr. Aoife Walsh",
    pin: "1003",
    group_name: "TUH",
    rotation_start: "2026-07-10T08:00:00Z",
  },
  {
    student_code: "STU104",
    name: "Dr. David Chen",
    pin: "1004",
    group_name: "UL",
    rotation_start: "2026-07-12T08:00:00Z",
  },
  {
    student_code: "STU105",
    name: "Dr. Emma Higgins",
    pin: "1005",
    group_name: "Renal",
    rotation_start: "2026-07-15T08:00:00Z",
  },
];

// Target correct response ratios per student out of 20 questions
const STUDENT_PERFORMANCE_ACCURACY: Record<string, number> = {
  STU101: 0.95, // 19 / 20 correct (95% - Top 1%)
  STU102: 0.80, // 16 / 20 correct (80% - High Performer)
  STU103: 0.70, // 14 / 20 correct (70% - Solid Mid-Tier)
  STU104: 0.55, // 11 / 20 correct (55% - Developing)
  STU105: 0.40, // 8 / 20 correct  (40% - Needs Review)
};

export async function seedTestStudentsAndResponses(): Promise<SeedingResult> {
  const createdStudents: Student[] = [];

  // 1. Create / Seed 5 Test Students
  for (const s of TEST_STUDENTS) {
    const studentObj: Student = {
      ...s,
      id: `stu_${s.student_code.toLowerCase()}_${Date.now()}`,
      created_at: s.rotation_start,
    };
    createdStudents.push(studentObj);

    try {
      await supabase.from("students").upsert([studentObj]);
    } catch (e) {
      console.warn("Could not upsert student into Supabase", e);
    }
  }

  // Save to LocalStorage fallback
  const existingStudentsStr = localStorage.getItem("renal_review_students");
  const existingStudents: Student[] = existingStudentsStr ? JSON.parse(existingStudentsStr) : [];
  const mergedStudentsMap = new Map<string, Student>();
  existingStudents.forEach((st) => mergedStudentsMap.set(st.student_code.toUpperCase(), st));
  createdStudents.forEach((st) => mergedStudentsMap.set(st.student_code.toUpperCase(), st));
  const finalStudents = Array.from(mergedStudentsMap.values());
  localStorage.setItem("renal_review_students", JSON.stringify(finalStudents));

  // 2. Fetch or create sample Poll & Questions
  let pollId = "sample_renal_poll_2026";
  let questions: Question[] = [];

  try {
    const { data: pData } = await supabase.from("polls").select("*").limit(1);
    if (pData && pData.length > 0) {
      pollId = pData[0].id;
      const { data: qData } = await supabase.from("questions").select("*").eq("poll_id", pollId);
      if (qData && qData.length > 0) {
        questions = qData as Question[];
      }
    }
  } catch (e) {
    // fallback
  }

  // If no questions exist, create 20 synthetic sample renal questions
  if (questions.length === 0) {
    for (let i = 1; i <= 20; i++) {
      questions.push({
        id: `q_sample_${i}`,
        poll_id: pollId,
        question_text: `Renal Board Review Question ${i}: Management of Hyponatraemia & AKI Case ${i}`,
        options: [
          `Option A: 3% Hypertonic Saline Bolus ${i}`,
          `Option B: Fluid Restriction & Furosemide ${i}`,
          `Option C: Isotonic 0.9% Saline Infusion ${i}`,
          `Option D: Tolvaptan / Vasopressin Receptor Antagonist ${i}`,
        ],
        correct_option_index: 0, // Option A is correct
        explanation: `Clinical rationale for Question ${i}: Hypertonic saline or specific fluid management based on volume status.`,
        created_at: new Date(Date.now() - (20 - i) * 86400000).toISOString(),
      });
    }
  }

  // 3. Generate structured responses reflecting performance profiles
  const newResponses: Response[] = [];

  createdStudents.forEach((student) => {
    const targetAccuracy = STUDENT_PERFORMANCE_ACCURACY[student.student_code] || 0.7;
    const correctCount = Math.round(questions.length * targetAccuracy);

    questions.forEach((q, qIndex) => {
      const isCorrect = qIndex < correctCount;
      const selectedIndex = isCorrect
        ? (q.correct_option_index !== null ? q.correct_option_index : 0)
        : ((q.correct_option_index !== null ? q.correct_option_index + 1 : 1) % (q.options.length || 4));

      const respDate = new Date(
        new Date(student.rotation_start).getTime() + (qIndex + 1) * 3600000 * 6
      ).toISOString();

      const respObj: Response = {
        id: `resp_${student.student_code.toLowerCase()}_${q.id}`,
        question_id: q.id,
        selected_option_index: selectedIndex,
        respondent_name: student.name,
        hospital: student.group_name,
        student_id: student.student_code,
        is_correct: isCorrect,
        created_at: respDate,
      };

      newResponses.push(respObj);
    });
  });

  // Upload to Supabase if possible
  try {
    await supabase.from("responses").upsert(newResponses);
  } catch (e) {
    console.warn("Could not upsert responses into Supabase", e);
  }

  // Save to LocalStorage fallback
  const existingRespStr = localStorage.getItem("renal_review_responses");
  const existingResp: Response[] = existingRespStr ? JSON.parse(existingRespStr) : [];
  const respMap = new Map<string, Response>();
  existingResp.forEach((r) => respMap.set(r.id, r));
  newResponses.forEach((r) => respMap.set(r.id, r));
  localStorage.setItem("renal_review_responses", JSON.stringify(Array.from(respMap.values())));

  return {
    studentsCount: createdStudents.length,
    responsesCount: newResponses.length,
    message: `Successfully created 5 test students with 100 total graded poll responses across 5 performance profiles!`,
  };
}
