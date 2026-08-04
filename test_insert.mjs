import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vhdxlxwmkknmxrplpgfs.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZHhseHdta2tubXhycGxwZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTc3MTIsImV4cCI6MjA5MzQ3MzcxMn0.2II-886QHUmSYCrFdlud3cLlnwA2TPTAc7W13VNi--o";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAll() {
  const { error: pErr } = await supabase.from("polls").insert([{ id: "00000000-0000-4000-8000-000000000001", title: "Test Poll", status: "active" }]);
  console.log("Polls insert error:", pErr);

  const { error: qErr } = await supabase.from("questions").insert([{ poll_id: "fbd59c4f-7b18-4611-8acd-c17bc04f478a", question_text: "Test?", options: ["A", "B"], correct_option_index: 0 }]);
  console.log("Questions insert error:", qErr);

  const { error: rErr } = await supabase.from("responses").insert([{ question_id: "q1", selected_option_index: 0, is_correct: true }]);
  console.log("Responses insert error:", rErr);
}

testAll();
