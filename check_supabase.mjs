import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vhdxlxwmkknmxrplpgfs.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZHhseHdta2tubXhycGxwZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTc3MTIsImV4cCI6MjA5MzQ3MzcxMn0.2II-886QHUmSYCrFdlud3cLlnwA2TPTAc7W13VNi--o";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: polls, error: pErr } = await supabase.from("polls").select("*");
  console.log("Polls in Supabase:", polls, pErr);

  const { data: questions, error: qErr } = await supabase.from("questions").select("*");
  console.log("Questions count in Supabase:", questions?.length, qErr);
}

main();
