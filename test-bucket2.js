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

async function createB() {
  const { data, error } = await supabase.storage.createBucket('skola-media', {
    public: true
  });
  console.log("Create Bucket:", {data, error});
}
createB();
