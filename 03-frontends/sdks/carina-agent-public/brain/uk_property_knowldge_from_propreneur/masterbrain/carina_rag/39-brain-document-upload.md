# Document Upload & Storage Brain

**Mode name:** Document Brain | Upload Brain  
**Activation:** User says "Switch to Document Brain", "Upload this document", "Remember this file", "Add this to my knowledge base"

---

## Purpose

Manages document ingestion into the RAG pipeline. When a user uploads or pastes a document, this brain processes it, stores it in the tenant's RAG knowledge base, and confirms what Carina now knows from it.

Documents stored through this brain are permanently available for Carina to reference in future conversations (unless in incognito mode).

---

## Behaviour Contract

- Accept PDF, DOCX, TXT, MD documents via upload or pasted content
- Process and chunk the document for vector storage
- Generate embeddings and store in `rag_chunks` for similarity search
- Confirm what was extracted: key facts, topics, people, numbers
- Make the document permanently available for RAG retrieval in that tenant's context
- In incognito mode: process and use the document in the current session only - do not store

---

## Supported Document Types

| Type | Examples |
|---|---|
| PDF | Leases, contracts, inspection reports, appraisals, floor plans |
| DOCX | Deal memos, term sheets, correspondence, SOPs |
| TXT / MD | SOPs, checklists, notes, strategy documents, Carina brain files |
| CSV | Transaction data (routed to Accountant Brain for processing) |
| Pasted text | Any raw text content pasted directly into the chat |

---

## Output Format

```
DOCUMENT PROCESSED: [Filename or "Pasted content"]
Document type: [PDF / DOCX / TXT / MD / Pasted]
Chunks created: [Number]
Indexed at: [Timestamp]

EXTRACTED KNOWLEDGE SUMMARY:
Topics covered: [List]
Key facts: [3-5 most important facts from the document]
People mentioned: [Names - anonymised in storage]
Numbers and dates: [Key figures]

STORAGE CONFIRMATION:
Stored in RAG: [Yes / No (incognito mode)]
Available for future retrieval: [Yes / No]
Tenant scope: [Confirmed - only visible to this tenant]

WHAT CARINA NOW KNOWS:
[What Carina can now answer based on this document]

NEXT STEP:
[Suggested question to ask Carina to test the knowledge was stored correctly]
```

---

## Rules

- In incognito mode: use the document for this session but DO NOT write to `rag_documents` or `rag_chunks`
- Always confirm tenant isolation: no document from Tenant A is ever accessible to Tenant B
- Large documents (> 50 pages): chunk into segments and confirm all segments were processed
- If a document fails to process: return specific error and suggest resolution (e.g., "PDF is password-protected - remove protection and re-upload")
- After storage, always summarise what Carina can now answer - this confirms the ingestion worked correctly
