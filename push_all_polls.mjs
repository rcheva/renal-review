import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vhdxlxwmkknmxrplpgfs.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZHhseHdta2tubXhycGxwZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTc3MTIsImV4cCI6MjA5MzQ3MzcxMn0.2II-886QHUmSYCrFdlud3cLlnwA2TPTAc7W13VNi--o";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function pushPolls() {
  const pollsToPush = [
    {
      id: "c3aea82d-2a1d-46bc-9f2f-ef1cd911fc5c",
      title: "26_08 MERCURI2 SGLT2 and Cardiac Surgery",
      status: "active",
      created_at: "2026-08-04T21:00:00.000Z"
    },
    {
      id: "26a00000-0000-4000-8000-000000000026",
      title: "26 Acute PD",
      status: "active",
      created_at: "2026-07-30T10:00:00.000Z"
    },
    {
      id: "fbd59c4f-7b18-4611-8acd-c17bc04f478a",
      title: "Hyponatraemia",
      status: "closed",
      created_at: "2026-07-29T22:01:20.495031+00:00"
    }
  ];

  for (const p of pollsToPush) {
    const { data, error } = await supabase.from("polls").upsert([p]).select();
    console.log("Pushed poll:", p.title, error || "SUCCESS", data);
  }
}

pushPolls();
