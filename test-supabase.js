const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '/Users/julio/projects/Renal_Review/skola-main/.env.local';
const env = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

env.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) console.error("Error:", error);
  else {
    console.log("Buckets:", data.map(b => b.name));
    if (!data.find(b => b.name === 'study_materials')) {
        console.log("Bucket not found, you might need to create it in the Supabase Dashboard, or I can try creating it.");
    }
  }
}
checkBuckets();
