const fs = require('fs');
const text = fs.readFileSync('/Users/julio/Library/CloudStorage/OneDrive-Personal/Renal_Review/02-AKI/llm_create_10_flashcards_for_1779130503949.md', 'utf8');

const newDrafts = [];
const blocks = text.split(/\n\s*\n/);
for (const block of blocks) {
  const qMatch = block.match(/(?:\*\*[Qq](?:uestion)?:\*\*|[Qq](?:uestion)?:\s*)\s*(.+)/);
  const aMatch = block.match(/(?:\*\*[Aa](?:nswer)?:\*\*|[Aa](?:nswer)?:\s*)\s*(.+)/);
  if (qMatch && aMatch) {
    newDrafts.push({ front: qMatch[1].trim(), back: aMatch[1].trim() });
  } else {
    // try line by line
    const lines = block.split('\n');
    let q = "";
    let a = "";
    for (const line of lines) {
        const lqMatch = line.match(/(?:\*\*[Qq](?:uestion)?:\*\*|[Qq](?:uestion)?:\s*)\s*(.+)/);
        const laMatch = line.match(/(?:\*\*[Aa](?:nswer)?:\*\*|[Aa](?:nswer)?:\s*)\s*(.+)/);
        if (lqMatch) q = lqMatch[1].trim();
        if (laMatch) a = laMatch[1].trim();
    }
    if (q && a) {
        newDrafts.push({ front: q, back: a });
    }
  }
}
console.log(newDrafts.length);
console.log(newDrafts[0]);
