# AI Integration Audit & Testing Summary
**Date:** 29 July 2026  
**Status:** Inactive / Hidden (Preserved for Future Evaluation)

---

## 1. Executive Summary
On 29 July 2026, extensive development and testing was performed on integrating **AnythingLLM** and **NotebookLM** into the Skola desktop application (`Renal Review.app`). 

While all backend infrastructure, document auto-deduplication, Anki flashcard JSON importers, Live Poll generators, OneDrive HTML report exporters, and custom CSS styling engines were built and fully functional, the RAG (Retrieval-Augmented Generation) context precision from standard LLM backends (AnythingLLM API / Groq / OpenAI) did not consistently match the synthesis quality of ChatGPT Web.

As a result, both AI Assistant navigation tabs (**NotebookLM Assistant** and **AnythingLLM Assistant**) have been temporarily hidden from the main sidebar navigation. All components, backend endpoints, and prompt presets remain intact in the codebase for future activation and refinement.

---

## 2. Infrastructure & Features Developed Today

### A. AnythingLLM RAG & Proxy Bridge
- **Backend Server (`server/mcpProxy.mjs`)**:
  - Implemented `/api/anything/upload` with automatic document deduplication (removes older versions of a PDF before embedding a new one).
  - Implemented `/api/anything/chat` supporting both `chat` (full document context) and `query` (vector distance RAG) modes.
  - Added automatic workspace `openAiPrompt` synchronization to instruct the LLM on reading workspace context directly.
  - Added model/provider metadata extraction (e.g. `Groq`, `OpenAI gpt-4o`, `Ollama`).

### B. EBM #JClub Master Clinical Synthesis & Appraisal
- Designed a 10-section Master Clinical Appraisal prompt preset:
  1. Article Identity & Classification
  2. Rapid Clinical Read (Thresholds, ICU prevalence, mortality)
  3. Diagnostic Framework & Physiology (Osmolality, volume status)
  4. Treatment, Sodium Deficit Formulas & Monitoring Protocols
  5. Correction-Rate & ODS Controversy
  6. Consensus, Uncertainty & Practice Takeaways
  7. Critical Appraisal & EBM Star Ratings (1-5 ⭐)
  8. Unanswered Clinical Questions
  9. Future Research Directions
  10. ACP Journal Club Style Bottom Line

### C. OneDrive HTML Exporter & CSS Engine
- Added **Export HTML Report (.html) to OneDrive** in `AnythingLLMView.tsx`.
- Integrated ChatGPT's exact CSS design system (`--navy: #153c55`, `--blue: #1e6c8f`, golden rating stars `<span class="stars">`, `.takeaway` boxes, `.alert` warning callouts, `.bottom` dark navy card).
- Implemented smart naming pattern: `YY_MM_journal_firstauthor.html` (e.g., `26_07_NephSAP_Spasovski.html`).
- Added an in-app interactive **Save Confirmation Modal** displaying the saved file name and full path.

### D. Flashcard & Poll Import Upgrades
- Added in-modal sub-deck creation (`+ Create New Deck` with parent deck selection, e.g., `AKI Fundamentals` under `AKI`).
- Made flashcard (`Prompt 2`) and poll (`Prompt 3`) presets self-contained for standalone PDF analysis.

---

## 3. Observed Limitations & Audit Findings (29 July 2026)
1. **RAG Context Retrieval Variance**:
   - Depending on the active LLM provider (Groq vs OpenAI vs Ollama), AnythingLLM's vector retrieval sometimes yields concise bullet points rather than deep 3,000-word clinical synthesis.
2. **OpenAI Medical Safety Refusals**:
   - Direct API calls to OpenAI `gpt-4o` with heavy clinical treatment instructions occasionally trigger false-positive safety guardrails (`"I'm sorry, I can't assist with that."`), requiring specific prompt disclaimer framing.
3. **Synthesis Depth Gap**:
   - ChatGPT Web's native document analyzer utilizes multi-turn chunk reading that standard single-call RAG APIs struggle to replicate without multi-stage agent workflows.

---

## 4. Next Steps for Future Evaluation
- Re-evaluate with dedicated multi-stage RAG pipelines (e.g. LangChain / LlamaIndex agentic chunking).
- Test direct Anthropic Claude 3.5 Sonnet context windows when API credentials are provided.
- Re-enable sidebar navigation tabs in `Sidebar.tsx` once multi-turn document synthesis meets publication-grade standards.
