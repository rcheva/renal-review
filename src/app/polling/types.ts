export interface Student {
  id: string;
  student_code: string; // e.g. "STU101"
  name: string;
  pin: string; // 4-digit PIN
  group_name: string; // "Renal" | "UL" | "TUH" | string
  rotation_start: string; // ISO date string of first poll or registration
  created_at: string;
}

export interface PollGroup {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Poll {
  id: string;
  title: string;
  status: "active" | "closed";
  group_name?: string; // "Renal" | "UL" | "TUH" | custom
  created_at: string;
}

export interface Question {
  id: string;
  poll_id: string;
  question_text: string;
  options: string[];
  correct_option_index: number | null;
  explanation?: string | null;
  created_at: string;
}

export interface Response {
  id: string;
  question_id: string;
  selected_option_index: number; // -1 represents skipped/no answer
  respondent_name?: string | null;
  hospital?: string | null;
  student_id?: string | null;
  is_correct?: boolean | null;
  created_at: string;
}

