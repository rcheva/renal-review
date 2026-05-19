const fs = require('fs');
let content = fs.readFileSync('src/app/polling/LiveResultsView.tsx', 'utf8');

content = content.replace(
  'import { IconCopy, IconBrandWhatsapp, IconRefresh, IconTrophy, IconChartBar, IconDownload } from "@tabler/icons-react";',
  'import { IconCopy, IconBrandWhatsapp, IconRefresh, IconTrophy, IconChartBar, IconDownload } from "@tabler/icons-react";\nimport parse from "html-react-parser";'
);

content = content.replace(
  '<h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>{i + 1}. {q.question_text}</h3>',
  '<div style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.125rem", fontWeight: "bold" }}>{i + 1}. {parse(q.question_text)}</div>'
);

fs.writeFileSync('src/app/polling/LiveResultsView.tsx', content);
