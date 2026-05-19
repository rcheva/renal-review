const fs = require('fs');
const text = fs.readFileSync('/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review/02-AKI/llm_create_10_flashcards_for_1779130503949.md', 'utf8');

const newDrafts = [];
const blocks = text.split(/\n\s*\n/);
for (const block of blocks) {
  let q = "";
  let a = "";
  
  const cleanBlock = block.replace(/\*\*/g, '');
  const qMatch = cleanBlock.match(/(?:^|\n)\s*[Qq](?:uestion)?:\s*(.+)/);
  const aMatch = cleanBlock.match(/(?:^|\n)\s*[Aa](?:nswer)?:\s*(.+)/);
  
  if (qMatch && aMatch) {
    q = qMatch[1].trim();
    a = aMatch[1].trim();
    newDrafts.push({ front: q, back: a });
  } else {
    const lines = cleanBlock.split('\n');
    for (const line of lines) {
       const lqMatch = line.match(/(?:^|\n)\s*[Qq](?:uestion)?:\s*(.+)/);
       const laMatch = line.match(/(?:^|\n)\s*[Aa](?:nswer)?:\s*(.+)/);
       if (lqMatch) q = lqMatch[1].trim();
       if (laMatch) a = laMatch[1].trim();
    }
    if (q && a) {
        newDrafts.push({ front: q, back: a });
    }
  }
}
console.log("Found:", newDrafts.length);
if (newDrafts.length > 0) console.log(newDrafts[0]);
