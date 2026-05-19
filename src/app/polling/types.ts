export interface Poll {
  id: string;
  title: string;
  status: "active" | "closed";
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
  selected_option_index: number;
  created_at: string;
}
