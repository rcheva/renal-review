const fs = require('fs');
let content = fs.readFileSync('src/app/polling/StudentPollView.tsx', 'utf8');

content = content.replace(
  'import { IconCheck, IconDownload } from "@tabler/icons-react";',
  'import { IconCheck, IconDownload } from "@tabler/icons-react";\nimport parse from "html-react-parser";'
);

content = content.replace(
  '                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", lineHeight: 1.4 }}>{i + 1}. {q.question_text}</h3>',
  '                <div style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", lineHeight: 1.4, fontWeight: "bold" }}>{i + 1}. {parse(q.question_text)}</div>'
);

content = content.replace(
  '        <h2 style={{ fontSize: "1.5rem", marginBottom: "2rem", lineHeight: 1.4 }}>{q.question_text}</h2>',
  '        <div style={{ fontSize: "1.5rem", marginBottom: "2rem", lineHeight: 1.4, fontWeight: "bold" }}>{parse(q.question_text)}</div>'
);

fs.writeFileSync('src/app/polling/StudentPollView.tsx', content);
