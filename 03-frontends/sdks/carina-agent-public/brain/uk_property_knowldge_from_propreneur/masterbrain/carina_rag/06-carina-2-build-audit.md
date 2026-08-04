# Carina 2.0 - Build Audit

**Last updated:** 2026-04-30
**Scope:** Full audit of `brain/prompts/08-carina-2-0-complete.md` (4,650 lines) against actual codebase

---

## Summary

Carina 2.0 is **substantially complete**. All core infrastructure is built and wired. Three gaps were found and fixed in this audit session.

---

## Audit Results

### COMPLETE (no action required)

| Component | Location | Status |
|---|---|---|
| Database migrations | `database/migrations/tenant/2026_05_01_120000_carina_v2_rag_prompts_rate_limits.php` | Complete - all 7 tables |
| Eloquent models | `app/Models/Carina/`, `app/Models/Rag/` | 7 models, full relationships |
| Services (15) | `app/Services/Carina/`, `app/Services/Rag/` | All implemented |
| Form requests (6) | `app/Http/Requests/Carina/`, `app/Http/Requests/Rag/` | All present |
| API controllers (6) | `app/Http/Controllers/Api/Carina/`, `app/Http/Controllers/Api/Rag/` | All present |
| Events (2) | `app/Events/Carina/` | CarinaMessageSent, CarinaConversationDeleted |
| Jobs (4) | `app/Jobs/Carina/`, `app/Jobs/Rag/` | All present |
| Artisan commands (4) | `app/Console/Commands/Carina/`, `app/Console/Commands/Rag/` | rag:index-pending, rag:reindex, rag:sync, carina:verify |
| Routes | `routes/tenant.php` (lines 229-277) | All Carina + RAG routes present |
| Tests (13 files) | `tests/Feature/Carina/`, `tests/Feature/Rag/` | 2,733 lines of Pest tests |
| Masterbrain folders (15) | `brain/masterbrain/` | All present |
| _folder_index.txt | `brain/masterbrain/_folder_index.txt` | Present, correct format |
| ethics-flags.log | `brain/masterbrain/legal/ethics-flags.log` | Present, append-only |
| CarinaAccessGate | `app/Services/Carina/CarinaAccessGate.php` | Implemented - uses Spatie roles, richer than spec |
| Filament resources | `app/Filament/Resources/`, `app/Filament/Pages/` | CarinaConversationResource, CarinaSystemPromptResource, RagDocumentResource, CarinaSettings, CarinaUsageDashboard all present |
| Default system prompt seeder | `database/seeders/Tenant/TenantBootstrapSeeder.php` | Calls `seedCarinaBaselinePrompt()` on tenant bootstrap |
| Baseline system prompt file | `database/data/carina_baseline_system_prompt.txt` | Present |

---

## Gaps Fixed in This Session

### Gap 1 - Brain modifier files were stubs

**Before:** All 14 files in `brain/masterbrain/genius/brains/` were 14-line generic stubs with no brain-specific system modifiers, output formats, or activation phrases.

**Fix:** Replaced all 14 files with full spec content from Section 24 of `08-carina-2-0-complete.md`. Each file now has the correct structure:
- Brain key (used in code by `CarinaBrainModifierService`)
- Activation phrases (detected in user messages)
- System modifier (injected into conversation system prompt when brain is active)
- Output format (specific structure this brain must produce)
- Restrictions (constraints specific to this brain mode)

**Files updated:** All 14 - `master-ceo-brain.md`, `genius-ai-brain.md`, `coo-step-by-step-brain.md`, `no-bs-brain.md`, `double-check-brain.md`, `investor-brain.md`, `legal-brain.md`, `sales-brain.md`, `accountant-brain.md`, `marketing-brain.md`, `image-brain.md`, `document-store-brain.md`, `coaching-brain.md`, `web-search-brain.md`

---

### Gap 2 - Baseline system prompt was truncated

**Before:** `database/data/carina_baseline_system_prompt.txt` contained only ~29 lines - missing the WHAT YOU DO WITH EVERY INPUT block, RESPONSE MODE, MATHS ENGINE, BRAINS section, OUTPUT RULES, and END-OF-RESPONSE BLOCK.

**Fix:** Replaced with full Section 19 content from the spec. The file now includes all mandatory sections including the end-of-response accountability block and the complete maths engine capability list.

---

### Gap 3 - CarinaRateLimitSeeder missing

**Before:** No rate limit seeder existed. The `carina_rate_limits` table was created by migration but never populated with defaults when a tenant was bootstrapped.

**Fix:** Created `database/seeders/Tenant/CarinaRateLimitSeeder.php` and called it from `TenantBootstrapSeeder::run()`. Seeds 3 default rate limit periods (hourly/daily/monthly) in tenant context. Idempotent - uses `updateOrInsert`.

---

## What Needs User Action (Cannot Be Fixed in Code)

### pgvector Extension
The `rag_chunks.embedding` column requires the PostgreSQL `pgvector` extension. The migration attempts `CREATE EXTENSION IF NOT EXISTS vector` but logs a warning if it fails. Until pgvector is installed:
- RAG search will not work
- `carina:verify` will report pgvector check as failed

**Install on Ubuntu:**
```bash
sudo apt install postgresql-16-pgvector
```
Then run tenant migrations (stancl command name is `tenants:migrate`, not `tenancy:migrate`):

```bash
php artisan tenants:migrate
# or one workspace only:
php artisan tenants:migrate --tenants=xelox
```

### AI Provider API Keys
Carina requires at least one configured AI provider. Add to `.env`:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```
Other supported providers: DEEPSEEK_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, TAVILY_API_KEY (for web search).

### Verify Command
After installing pgvector and adding API keys, run:
```bash
php artisan carina:verify
```
This checks all 10 items: tables, pgvector, Redis, AI providers, RAG pipeline, masterbrain folders, ethics log, incognito flag, default system prompt, and brain modifier files.

---

## Brain Modifier Keys (for CarinaBrainModifierService)

| Brain key | File | Activated by |
|---|---|---|
| `master` | master-ceo-brain.md | "switch to master brain", "CEO mode" |
| `genius` | genius-ai-brain.md | "switch to genius brain", "genius mode" |
| `coo` | coo-step-by-step-brain.md | "step by step", "give me a playbook" |
| `nobs` | no-bs-brain.md | "no bs", "brutal truth" |
| `doublecheck` | double-check-brain.md | "double check this", "second opinion" |
| `investor` | investor-brain.md | "analyse this deal", "yeet or nee" |
| `legal` | legal-brain.md | "review this contract", "legal check" |
| `sales` | sales-brain.md | "give me a script", "agent script" |
| `accountant` | accountant-brain.md | "review my finances", "find cash leakage" |
| `marketing` | marketing-brain.md | "write copy", "brand this" |
| `image` | image-brain.md | "generate an image", "create a visual" |
| `docstore` | document-store-brain.md | "store this document", "add to knowledge base" |
| `coaching` | coaching-brain.md | "I need coaching", "I'm stuck" |
| `websearch` | web-search-brain.md | "research this", "find me data on" |

---

## Cross-references

- Spec: `brain/prompts/08-carina-2-0-complete.md`
- Services: `app/Services/Carina/`, `app/Services/Rag/`
- Routes: `routes/tenant.php` (lines 229-277)
- Tests: `tests/Feature/Carina/`, `tests/Feature/Rag/`
- Brain modifiers: `brain/masterbrain/genius/brains/`
- Verify command: `app/Console/Commands/Carina/VerifyCommand.php`
