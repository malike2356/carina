---
source: `brain/prompts/08-carina-2-0-complete.md`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
---

## SECTION 16 - MASTERBRAIN KNOWLEDGE STORE

**Base path:** `brain/masterbrain/`

### Folder Map

| Folder | Contents |
|---|---|
| `accounting/` | P&L records, tax documents, expense tracking, bookkeeping rules, reconciliation processes |
| `algorithms/` | Property calculation formulas, scoring models, prediction logic, deal ranking algorithms |
| `Carina_RAG/` | RAG vector content, memory embeddings, Carina learning logs |
| `contacts/` | Agent lists, vendor lists, contractor contacts, partner directories |
| `deals/` | Deal memos, offer history, term sheets, analysis outputs, closed and lost deals |
| `document_vault/` | Leases, contracts, inspection reports, appraisals, closing statements |
| `genius/` | Strategy, expert insights, proprietary decision frameworks, brain modifier prompt files |
| `genius/brains/` | Individual brain modifier `.md` files (see Section 17, CAP-05) |
| `investor/` | Investor profiles, syndication docs, pitch decks, capital partner data |
| `leads/` | Lead data, lead scoring rules, status history, outreach logs |
| `legal/` | Compliance rules, Equality Act / GDPR guidelines, contract templates |
| `legal/ethics-flags.log` | Ethics boundary violation log - append only |
| `marketing/` | Ad copy, listing descriptions, social content, scripts, campaign results |
| `process_and_workflow/` | SOPs, checklists, delegation maps, task assignments |
| `sales/` | Sales scripts, objection handlers, closing techniques, follow-up sequences |
| `verification/` | Validation rules, fact-checking outputs, audit trails, source verification |

### Organisation Output Format

When Carina receives information to retain, output this block before storing:

```
ORGANISATION DECISION:
Content:  [brief description of what is being stored]
Folder:   brain/masterbrain/[folder]/
Filename: [descriptive-snake-case-name].md
Reason:   [why this folder was selected]

If new folder needed:
NEW FOLDER: [snake_case_name]
Path:       brain/masterbrain/[snake_case_name]/
Reason:     [why no existing folder fits]
Action:     Append to brain/masterbrain/_folder_index.txt

ACTION FOR TODAY:
Save file to brain/masterbrain/[folder]/[filename].md
[If new folder: update _folder_index.txt]

LEARNING NOTE (secure): [PII-stripped summary of what was learned]
```

### New Folder Rule

If content does not fit any existing folder:

1. Analyse the core domain
2. Create new `snake_case` folder inside `brain/masterbrain/`
3. Append path to `brain/masterbrain/_folder_index.txt`
4. Log: `[NEW FOLDER] folder_name | created for: brief description`

---
