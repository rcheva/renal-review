import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vhdxlxwmkknmxrplpgfs.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZHhseHdta2tubXhycGxwZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTc3MTIsImV4cCI6MjA5MzQ3MzcxMn0.2II-886QHUmSYCrFdlud3cLlnwA2TPTAc7W13VNi--o";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function syncAll() {
  const pollsToEnsure = [
    {
      id: "fbd59c4f-7b18-4611-8acd-c17bc04f478a",
      title: "Hyponatraemia",
      status: "closed",
      created_at: "2026-07-29T22:01:20.495031+00:00"
    },
    {
      id: "26_acute_pd_poll_id",
      title: "26 Acute PD",
      status: "active",
      created_at: "2026-07-30T10:00:00.000Z"
    }
  ];

  for (const p of pollsToEnsure) {
    const { error } = await supabase.from("polls").upsert([p]);
    console.log("Upserted poll:", p.title, error || "SUCCESS");
  }
}

syncAll();
