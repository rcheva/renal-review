const fs = require('fs');
let content = fs.readFileSync('src/app/polling/EditPollView.tsx', 'utf8');

content = content.replace(
  'import { IconPlus, IconTrash, IconCheck, IconCopy, IconBrandWhatsapp, IconBrain, IconDownload } from "@tabler/icons-react";',
  'import { IconPlus, IconTrash, IconCheck, IconCopy, IconBrandWhatsapp, IconBrain, IconDownload, IconEdit } from "@tabler/icons-react";\nimport NoteEditor, { useNoteEditor } from "@/app/editor/NoteEditor/NoteEditor";\nimport parse from "html-react-parser";'
);

content = content.replace(
  '  const [newExplanation, setNewExplanation] = useState("");',
  `  const [newExplanation, setNewExplanation] = useState("");

  const newQuestionEditor = useNoteEditor({
    content: "",
    onUpdate: ({ editor }) => setNewQuestionText(editor.getHTML()),
  });

  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const editQuestionEditor = useNoteEditor({
    content: "",
    onUpdate: ({ editor }) => {
      setEditingQuestion(prev => prev ? { ...prev, question_text: editor.getHTML() } : null);
    },
  });

  const handleEditClick = (q: Question) => {
    setEditingQuestion({ ...q, options: [...q.options] });
    editQuestionEditor?.commands.setContent(q.question_text || "");
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion || !editingQuestion.question_text.trim() || editingQuestion.options.some(o => !o.trim())) return;
    
    const { error } = await supabase.from("questions").update({
      question_text: editingQuestion.question_text,
      options: editingQuestion.options,
      correct_option_index: editingQuestion.correct_option_index,
      explanation: editingQuestion.explanation
    }).eq("id", editingQuestion.id);

    if (!error) {
      setEditingQuestion(null);
      fetchPollData();
    }
  };
`
);

content = content.replace(
  '      setNewExplanation("");',
  '      setNewExplanation("");\n      newQuestionEditor?.commands.setContent("");'
);

content = content.replace(
  '                <IconButton variant="ghost" onClick={() => handleDeleteQuestion(q.id)}>',
  `                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <IconButton variant="ghost" onClick={() => handleEditClick(q)}>
                    <IconEdit size={16} color="var(--theme-neutral-500)" />
                  </IconButton>
                  <IconButton variant="ghost" onClick={() => handleDeleteQuestion(q.id)}>`
);

content = content.replace(
  '                </IconButton>\n              </div>',
  '                </IconButton>\n                </div>\n              </div>'
);

content = content.replace(
  '                <h3 style={{ margin: 0 }}>{i + 1}. {q.question_text}</h3>',
  '                <div style={{ margin: 0, fontWeight: "bold", fontSize: "1.125rem" }}>{i + 1}. {parse(q.question_text)}</div>'
);

content = content.replace(
  '            <TextInput\n              label="Question Text"\n              placeholder="e.g. What is the most common cause of AKI?"\n              value={newQuestionText}\n              onChange={(e) => setNewQuestionText(e.target.value)}\n            />',
  `            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", display: "block" }}>Question Text</label>
              <div style={{ border: "1px solid var(--theme-neutral-300)", borderRadius: "var(--radius-md)", backgroundColor: "white", minHeight: "100px" }}>
                <NoteEditor editor={newQuestionEditor} />
              </div>
            </div>`
);

content = content.replace(
  '  return (\n    <>',
  `  return (
    <>
      <Modal opened={!!editingQuestion} onClose={() => setEditingQuestion(null)} title="Edit Question" size="lg">
        {editingQuestion && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", display: "block" }}>Question Text</label>
              <div style={{ border: "1px solid var(--theme-neutral-300)", borderRadius: "var(--radius-md)", backgroundColor: "white", minHeight: "100px" }}>
                <NoteEditor editor={editQuestionEditor} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", display: "block" }}>Options</label>
              {editingQuestion.options.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                  <input 
                    type="radio" 
                    name="edit_correct_option" 
                    checked={editingQuestion.correct_option_index === i} 
                    onChange={() => setEditingQuestion({ ...editingQuestion, correct_option_index: i })} 
                    title="Mark as correct answer"
                  />
                  <TextInput
                    style={{ flex: 1 }}
                    placeholder={\`Option \${i + 1}\`}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...editingQuestion.options];
                      newOpts[i] = e.target.value;
                      setEditingQuestion({ ...editingQuestion, options: newOpts });
                    }}
                  />
                  {editingQuestion.options.length > 2 && (
                    <IconButton variant="ghost" onClick={() => {
                      const newOpts = editingQuestion.options.filter((_, idx) => idx !== i);
                      let newCorrect = editingQuestion.correct_option_index;
                      if (newCorrect === i) newCorrect = null;
                      else if (newCorrect !== null && newCorrect > i) newCorrect -= 1;
                      setEditingQuestion({ ...editingQuestion, options: newOpts, correct_option_index: newCorrect });
                    }}>
                      <IconTrash size={16} color="var(--theme-red-600)" />
                    </IconButton>
                  )}
                </div>
              ))}
              <Button variant="subtle" size="sm" onClick={() => setEditingQuestion({ ...editingQuestion, options: [...editingQuestion.options, ""] })} leftSection={<IconPlus size={14} />} style={{ marginTop: "0.5rem" }}>
                Add Option
              </Button>
            </div>
            <Textarea
              label="Explanation (optional)"
              placeholder="Why is this answer correct?"
              value={editingQuestion.explanation || ""}
              onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="subtle" onClick={() => setEditingQuestion(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={!editingQuestion.question_text.trim() || editingQuestion.options.some(o => !o.trim())}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
`
);

fs.writeFileSync('src/app/polling/EditPollView.tsx', content);
