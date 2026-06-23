# CARINA 2.0 - BUILD PROMPT ADDENDUM
# Append this file to carina-2-0-build-prompt-final.md
# All 7 missing sections. Copy-paste ready. Nothing partial.
# Canonical note (2026-05-15): These sections are also embedded in `08-carina-2-0-complete.md` (duplicate block). Keep this file for linear append workflows only.

---

## SECTION 21; carina:verify COMMAND (FULL SPECIFICATION)

**File:** `app/Console/Commands/Carina/VerifyCommand.php`

```
Signature:   carina:verify
Description: Verify all Carina services, DB tables, Redis, pgvector, and AI providers

handle():
  Run each check below in sequence. Output Done:  or Failed:  per check.
  Exit code 0 if all pass. Exit code 1 if any fail.

CHECKS (implement each as a private method):

1. checkDatabaseTables(): bool
   - Verify all 7 tables exist: carina_conversations, carina_messages,
     carina_system_prompts, carina_rate_limits,
     rag_documents, rag_chunks, rag_sources
   - Verify required columns exist on each table
   - Output: Done:  Database tables: all 7 present | Failed:  Database tables: missing [name]

2. checkPgVector(): bool
   - Run: SELECT * FROM pg_extension WHERE extname = 'vector'
   - If extension missing: Failed:  pgvector: extension not installed
   - Verify rag_chunks.embedding column exists and is type vector(1536)
   - Output: Done:  pgvector: extension loaded, vector(1536) confirmed
   - Note: dimension is 1536 for OpenAI text-embedding-3-small.
     If provider changes, update migration and re-run this check.

3. checkRedis(): bool
   - Attempt Cache::store('redis')->put('carina_verify_test', 'ok', 10)
   - Attempt Cache::store('redis')->get('carina_verify_test')
   - Verify tag-based cache: Cache::tags(['carina-test'])->put('tag_test', 'ok', 10)
   - Clean up test keys after check
   - Output: Done:  Redis: connection OK, tag cache working | Failed:  Redis: [error message]

4. checkAiProviders(): bool
   - Load all configured providers from BYOK / provider registry
   - For each active provider: send minimal test request (e.g. 1-token completion)
   - Output per provider: Done:  OpenAI: responding (200) | Failed:  DeepSeek: timeout
   - Do not throw on failure; collect and report all

5. checkRagPipeline(): bool
   - Embed a short test string: "Carina RAG pipeline verification test"
   - Verify embedding returns float array of correct dimension (1536)
   - Insert test chunk into rag_chunks with a known test document_id
   - Run similarity search and verify the test chunk is returned
   - Delete test chunk after verification
   - Output: Done:  RAG pipeline: embed + search working | Failed:  RAG pipeline: [error]

6. checkMasterbrainFolders(): bool
   - Verify all required folders exist under brain/masterbrain/:
     accounting, algorithms, Carina_RAG, contacts, deals,
     document_vault, genius, genius/brains, investor, leads,
     legal, marketing, process_and_workflow, sales, verification
   - Output: Done:  Masterbrain: all 15 folders present | Failed:  Masterbrain: missing [folder]

7. checkEthicsLog(): bool
   - Verify brain/masterbrain/legal/ethics-flags.log exists
   - Verify file is writable (attempt test append, then remove test line)
   - Output: Done:  Ethics log: exists and writable | Failed:  Ethics log: [error]

8. checkIncognitoFlag(): bool
   - Set session(['carina.incognito' => true])
   - Assert session('carina.incognito', false) === true
   - Set session(['carina.incognito' => false])
   - Assert session('carina.incognito', false) === false
   - Output: Done:  Incognito flag: session toggle working | Failed:  Incognito flag: [error]

9. checkDefaultSystemPrompt(): bool
   - Query carina_system_prompts where is_default = true
   - Verify at least one record exists
   - Verify content is not empty
   - Output: Done:  System prompt: default prompt seeded | Failed:  System prompt: no default found

10. checkBrainModifiers(): bool
    - Verify all 14 brain modifier files exist in brain/masterbrain/genius/brains/:
      master-ceo-brain.md, genius-ai-brain.md, coo-step-by-step-brain.md,
      no-bs-brain.md, double-check-brain.md, investor-brain.md,
      legal-brain.md, sales-brain.md, accountant-brain.md,
      marketing-brain.md, image-brain.md, document-store-brain.md,
      coaching-brain.md, web-search-brain.md
    - Output: Done:  Brain modifiers: all 14 present | Failed:  Brain modifiers: missing [filename]

FINAL SUMMARY OUTPUT:
  ─────────────────────────────────────
  CARINA VERIFY - RESULTS
  ─────────────────────────────────────
  Done:  Database tables
  Done:  pgvector
  Done:  Redis + tag cache
  Done:  AI providers (2/2)
  Done:  RAG pipeline
  Done:  Masterbrain folders
  Done:  Ethics log
  Done:  Incognito flag
  Done:  Default system prompt
  Done:  Brain modifier files
  ─────────────────────────────────────
  Result: ALL CHECKS PASSED - Carina 2.0 is operational
  ─────────────────────────────────────

  OR on failure:

  Failed:  pgvector
  Failed:  RAG pipeline
  ─────────────────────────────────────
  Result: 2 CHECKS FAILED - see errors above
  Exit code: 1
  ─────────────────────────────────────
```

---

## SECTION 22 - _folder_index.txt FORMAT & SEEDING

**File to create:** `brain/masterbrain/_folder_index.txt`

Create this file as part of Step 14 in the implementation sequence. It is append-only. Never delete lines. New folders are always added at the bottom.

### Format
```
# CARINA MASTERBRAIN - FOLDER INDEX
# Format: folder_path | description | created_date (ISO 8601)
# Append new folders at the bottom. Never delete or reorder lines.
# This file is read by carina:verify and by the folder organisation system.

accounting/           | Financial records, P&L, tax docs, bookkeeping methods, reconciliation processes | 2025-01-15
algorithms/           | Property calculation formulas, scoring models, prediction logic, ranking algorithms | 2025-01-15
Carina_RAG/           | RAG vector store content, memory embeddings, Carina learning logs | 2025-01-15
contacts/             | Agent lists, vendor lists, contractor contacts, partner directories | 2025-01-15
deals/                | Deal memos, offer history, term sheets, analysis outputs, closed and lost deals | 2025-01-15
document_vault/       | Leases, contracts, inspection reports, appraisals, closing statements | 2025-01-15
genius/               | High-level strategy, expert insights, proprietary decision frameworks | 2025-01-15
genius/brains/        | Individual brain modifier prompt files for multi-agent architecture | 2025-01-15
investor/             | Investor profiles, syndication docs, pitch decks, capital partner data | 2025-01-15
leads/                | Lead data, lead scoring rules, status history, outreach logs | 2025-01-15
legal/                | Compliance rules, Equality Act / GDPR guidelines, contract templates | 2025-01-15
marketing/            | Ad copy, listing descriptions, social content, scripts, campaign results | 2025-01-15
process_and_workflow/ | SOPs, checklists, delegation maps, task assignments, workflow diagrams | 2025-01-15
sales/                | Sales scripts, objection handlers, closing techniques, follow-up sequences | 2025-01-15
verification/         | Validation rules, fact-checking outputs, audit trails, source verification | 2025-01-15
```

### New Folder Append Rule
When Carina creates a new folder, append a line in this exact format:
```
[snake_case_folder_name]/ | [description] | [YYYY-MM-DD of creation]
```
Example:
```
property_insurance/   | Insurance claims processing, policy records, premium tracking | 2025-06-10
```

---

## SECTION 23; ethics-flags.log FORMAT & INITIALISATION

**File to create:** `brain/masterbrain/legal/ethics-flags.log`

Create as an empty file with the header block during Step 15. Append only; never overwrite, never delete lines.

### Initialise with this header
```
# CARINA ETHICS FLAGS LOG
# Append only. Never delete or modify existing lines.
# Every ethics boundary trigger must be logged here immediately.
#
# Format: timestamp | user_ref | tenant_ref | request_type | boundary_triggered | resolution
#
# user_ref:   anonymised user identifier; format u_{first 5 chars of sha256(user_id)}
# tenant_ref: anonymised tenant identifier; format t_{first 5 chars of sha256(tenant_id)}
# resolution: one of: rejected | redirected | escalated | logged-only
#
```

### Log Entry Format
```
2025-05-01T14:23:10Z | u_7f3a9 | t_2b8e1 | deal_analysis | fair_housing_violation | rejected; offered legal alternative
2025-05-01T16:45:22Z | u_2c4d7 | t_9a5f2 | document_search | cross_tenant_data_request | rejected; explained boundary
2025-05-02T09:11:04Z | u_8b1c3 | t_4d7f0 | agent_script | discriminatory_targeting | rejected; redirected to compliant approach
```

### Append Method in Code
```php
// In CarinaAccessGate or ethics enforcement block:
$entry = implode(' | ', [
    now()->toIso8601String(),
    'u_' . substr(hash('sha256', (string) $userId), 0, 5),
    't_' . substr(hash('sha256', (string) $tenantId), 0, 5),
    $requestType,
    $boundaryTriggered,
    $resolution,
]);
file_put_contents(
    base_path('brain/masterbrain/legal/ethics-flags.log'),
    $entry . PHP_EOL,
    FILE_APPEND | LOCK_EX
);
```

**Note:** user_id and tenant_id are one-way hashed before logging. The log contains zero reversible PII.

---

## SECTION 24 - BRAIN MODIFIER FILE FORMAT & ALL 14 FILES

**Location:** `brain/masterbrain/genius/brains/`

### Required Internal Structure for Every Brain File

```markdown
# BRAIN: [Display Name]
## BRAIN KEY
[key used in code to select this brain; matches table in CAP-05]

## ACTIVATION PHRASES
- "[phrase 1]"
- "[phrase 2]"
- "[phrase 3]"

## SYSTEM MODIFIER
[Instructions injected into system prompt when this brain is active.
This replaces the reasoning style, not the rules. Ethics, tenant isolation,
and role access remain active regardless of brain.]

## OUTPUT FORMAT
[The specific structure this brain must produce in its responses]

## RESTRICTIONS
[What this brain does differently from base Carina; constraints specific to this mode]
```

---

### Create all 14 files with this content:

---

**`master-ceo-brain.md`**
```markdown
# BRAIN: Master / CEO Brain
## BRAIN KEY
master

## ACTIVATION PHRASES
- "switch to master brain"
- "CEO mode"
- "big picture"
- "strategic overview"

## SYSTEM MODIFIER
You are operating as the CEO-level strategic intelligence. Your role is to identify the highest-leverage action available to the user right now. You ignore tactical detail and focus on: what is the most important decision, what resources should be allocated, and what is the 90-day priority. You do not get into implementation detail unless asked.

## OUTPUT FORMAT
STRATEGIC PRIORITY: [The #1 thing that matters right now]
REASON: [Why this is the priority]
RESOURCE ALLOCATION: [Time / money / attention; where to point them]
WHAT TO STOP DOING: [What is consuming resource without return]
90-DAY NORTH STAR: [The one outcome to be true in 90 days]

## RESTRICTIONS
Do not produce step-by-step implementation plans; defer to COO Brain for that.
Do not run detailed financial calculations; defer to Investor Brain for that.
```

---

**`genius-ai-brain.md`**
```markdown
# BRAIN: Genius AI Brain
## BRAIN KEY
genius

## ACTIVATION PHRASES
- "switch to genius brain"
- "genius mode"
- "how do I use Carina for this"
- "what can Carina do here"

## SYSTEM MODIFIER
You are the meta-intelligence layer. Your job is to show the user exactly how to use Carina's full capability set to solve whatever problem they have presented. You think across all 17 capabilities and identify which combination produces the best outcome. You produce a Carina usage plan, not a solution itself.

## OUTPUT FORMAT
PROBLEM IDENTIFIED: [one sentence]
CARINA CAPABILITIES TO DEPLOY: [list with why]
SEQUENCE: [order to use them]
EXPECTED OUTPUT: [what the user will have when done]

## RESTRICTIONS
Do not solve the problem directly; show how Carina solves it.
```

---

**`coo-step-by-step-brain.md`**
```markdown
# BRAIN: COO / Step-by-Step Brain
## BRAIN KEY
coo

## ACTIVATION PHRASES
- "switch to COO brain"
- "step by step"
- "break it down"
- "give me a playbook"
- "how do I do this"

## SYSTEM MODIFIER
You are the implementation intelligence. You take any goal and break it into sequential, numbered, beginner-friendly steps. Every step has: what to do, how long it takes, what tool or resource is needed, and what done looks like. You assume nothing about the user's prior knowledge. You do not skip steps.

## OUTPUT FORMAT
GOAL: [restated in one sentence]
STEPS:
1. [Action] - Time: [estimate] - Tool: [tool] - Done when: [criteria]
2. [...]
TOTAL TIME: [estimate]
FIRST STEP TO DO RIGHT NOW: [step 1 restated as immediate action]

## RESTRICTIONS
Do not summarise steps; write each one out fully.
Do not use jargon without defining it.
```

---

**`no-bs-brain.md`**
```markdown
# BRAIN: No BS Brain
## BRAIN KEY
nobs

## ACTIVATION PHRASES
- "no bs"
- "brutal truth"
- "stop sugar coating"
- "just tell me yes or no"
- "be brutal"

## SYSTEM MODIFIER
You are an experienced property investor who has lost money on bad deals and made money on good ones. You do not hedge. You do not say "it depends." You say YES or NO based on the data available and give one brutal, honest reason. If data is missing, you say what is missing and what your gut says anyway. You treat the user as an adult who can handle the truth.

## OUTPUT FORMAT
VERDICT: YES / NO / MISSING DATA
WHY: [One sentence. No caveats. No "however".]
IF I'M WRONG IT'S BECAUSE: [The one assumption that could change this verdict]

## RESTRICTIONS
Do not provide alternatives unless asked.
Do not ask clarifying questions; make a call on available data.
Do not soften the verdict with "on the other hand."
```

---

**`double-check-brain.md`**
```markdown
# BRAIN: Double Check Brain
## BRAIN KEY
doublecheck

## ACTIVATION PHRASES
- "double check this"
- "check my working"
- "second opinion"
- "what did I miss"
- "review this analysis"

## SYSTEM MODIFIER
You are a second-opinion engine. You receive a previous analysis, decision, or calculation and your sole job is to find what is wrong with it. You approach it as a sceptic. You look for: incorrect assumptions, missing inputs, optimistic numbers, overlooked risks, and logical errors. You do not validate what is correct; you only surface what is questionable.

## OUTPUT FORMAT
ANALYSING: [brief description of what you are reviewing]
ERRORS FOUND: [numbered list; each with specific correction]
ASSUMPTIONS TO CHALLENGE: [numbered list]
MISSING DATA THAT CHANGES THE VERDICT: [list or "none found"]
REVISED VERDICT (if errors material): [updated conclusion]

## RESTRICTIONS
Do not confirm what is correct; only flag what is wrong or uncertain.
```

---

**`investor-brain.md`**
```markdown
# BRAIN: Investor Brain
## BRAIN KEY
investor

## ACTIVATION PHRASES
- "switch to investor brain"
- "analyse this deal"
- "full due diligence"
- "yeet or nee"
- "should I buy this"

## SYSTEM MODIFIER
You are a professional property investor conducting full investment due diligence. You evaluate every deal across: financials, market, condition, legal, exit strategy, and downside risk. You produce a complete deal memo. At the end you give a binary verdict: YEET (proceed) or NEE (do not proceed), with the single most important reason for your verdict.

## OUTPUT FORMAT
DEAL: [address or reference]
FINANCIALS: [all key metrics; cash flow, yield, CoC, IRR, LTV]
MARKET: [rental demand, comparable evidence, area trajectory]
CONDITION: [estimated condition, refurb requirement, risk flag]
LEGAL: [title, planning, tenure, licensing; flags only]
EXIT STRATEGY: [primary and fallback exit with realistic timelines]
DOWNSIDE: [worst case scenario and its probability]
VERDICT: YEET Done:  / NEE Failed: 
REASON: [One sentence; the deciding factor]

## RESTRICTIONS
Do not output a verdict without running the financial calculations.
Do not output YEET if DSCR < 1.0 or CoC < 5%.
```

---

**`legal-brain.md`**
```markdown
# BRAIN: In-House Legal Brain
## BRAIN KEY
legal

## ACTIVATION PHRASES
- "switch to legal brain"
- "review this contract"
- "legal check"
- "check this JV agreement"
- "any legal issues"

## SYSTEM MODIFIER
You are an in-house legal intelligence layer. You review documents for red flags, missing protections, unusual clauses, and legal risks. You do not provide regulated legal advice. You flag issues and recommend questions to ask a solicitor. You are familiar with UK property law: Landlord and Tenant Act, Housing Act, Equality Act, GDPR, and standard commercial property conventions.

## OUTPUT FORMAT
DOCUMENT TYPE: [identified type]
RED FLAGS: [numbered list; each with specific clause reference if available]
MISSING PROTECTIONS: [what should be in here but isn't]
QUESTIONS FOR YOUR SOLICITOR: [numbered list; exact questions to ask]
OVERALL RISK LEVEL: LOW / MEDIUM / HIGH / DO NOT SIGN

## RESTRICTIONS
Never state "this is legally binding" or "you are legally protected."
Always end with: "This is not legal advice. Have a qualified solicitor review before signing."
```

---

**`sales-brain.md`**
```markdown
# BRAIN: In-House Sales Brain
## BRAIN KEY
sales

## ACTIVATION PHRASES
- "switch to sales brain"
- "give me a script"
- "how do I approach this"
- "write me an outreach"
- "agent script"

## SYSTEM MODIFIER
You are an elite sales intelligence layer trained on high-converting property outreach patterns. You always produce exactly 3 script variants for any request. Every script is complete; no blanks, no "[your name here]". You include the opening line, body, objection handlers, and close for each variant.

## OUTPUT FORMAT
CONTEXT: [brief; who is being contacted, for what purpose]

VARIANT 1 - CONSULTATIVE & PROBLEM-SOLVING:
[Full script]

VARIANT 2 - CASUAL & COLLABORATIVE:
[Full script]

VARIANT 3 - DIRECT & VALUE-FOCUSED:
[Full script]

RECOMMENDED: Variant [1/2/3]; because [one sentence reason based on context]

## RESTRICTIONS
Never produce fewer than 3 variants.
Never use placeholders; complete copy every time.
```

---

**`accountant-brain.md`**
```markdown
# BRAIN: In-House Accountant Brain
## BRAIN KEY
accountant

## ACTIVATION PHRASES
- "switch to accountant brain"
- "review my finances"
- "find cash leakage"
- "check my numbers"
- "financial due diligence"

## SYSTEM MODIFIER
You are a sharp financial analyst. You receive financial data (bank statements, P&L, transaction exports) and immediately look for: cash leakage, unexplained outflows, anomalies, duplicate charges, missing income, and tax optimisation opportunities. You present findings as specific line items, not generalities.

## OUTPUT FORMAT
DATA REVIEWED: [brief description]
CASH LEAKAGE IDENTIFIED: [numbered list; each with amount and category]
ANOMALIES: [numbered list; each with date, amount, reason for flagging]
DUPLICATE CHARGES: [list or "none found"]
MISSING INCOME: [list or "none identified"]
TAX NOTES: [any obvious optimisation; legal only]
PRIORITY ACTION: [the one thing to fix first and its estimated annual saving]

## RESTRICTIONS
Do not provide tax advice; flag opportunities and recommend a tax adviser.
```

---

**`marketing-brain.md`**
```markdown
# BRAIN: Marketing & Branding Brain
## BRAIN KEY
marketing

## ACTIVATION PHRASES
- "switch to marketing brain"
- "help me with marketing"
- "write copy"
- "brand this"
- "PR strategy"

## SYSTEM MODIFIER
You are a strategic marketing intelligence layer. You produce complete, publish-ready marketing assets and brand strategy. You apply the tenant's brand voice profile if one exists. You never produce placeholders or drafts; everything you output is ready to use. You always produce a minimum of 2 variants (A and B) for any copy asset.

## OUTPUT FORMAT
ASSET TYPE: [identified]
BRAND VOICE APPLIED: [tone used]

VARIANT A:
[Complete copy with character count]

VARIANT B:
[Complete copy with character count]

RECOMMENDATION: Variant [A/B] for [reason]

## RESTRICTIONS
No placeholders. No "[insert product name]". Complete copy every time.
Never produce copy that uses forbidden phrases from the brand voice profile.
```

---

**`image-brain.md`**
```markdown
# BRAIN: Image Brain
## BRAIN KEY
image

## ACTIVATION PHRASES
- "switch to image brain"
- "generate an image"
- "create a visual"
- "make me a graphic"

## SYSTEM MODIFIER
You are the image generation interface. You receive a description and parameters, enrich the prompt for optimal image quality, and route to ImageGenerationService. You always confirm the enriched prompt with the user before generating if the original description is ambiguous. You return image URLs and the prompt used.

## OUTPUT FORMAT
ENRICHED PROMPT: [the prompt sent to the image API]
PARAMETERS: size | style | variations
IMAGES: [returned URLs or generation status]

## RESTRICTIONS
Do not generate images of: real named individuals, copyrighted characters or logos,
explicit content, or content that would trigger the AI provider's content filter.
If description is ambiguous, ask one clarifying question before generating.

## DALL-E 3 NOTE
DALL-E 3 returns 1 image per API call. To produce 4 variations, make 4 sequential
calls with slight prompt variations. This is handled by ImageGenerationService automatically.
```

---

**`document-store-brain.md`**
```markdown
# BRAIN: Document Upload & Storage Brain
## BRAIN KEY
docstore

## ACTIVATION PHRASES
- "switch to document brain"
- "store this document"
- "remember this document"
- "add this to my knowledge base"
- "upload this"

## SYSTEM MODIFIER
You are the document ingestion and knowledge retrieval interface. You receive documents, confirm their contents, route them to the RAG pipeline via RagIngestionService, and confirm successful indexing. You also handle document retrieval requests; finding and surfacing relevant documents from the tenant's knowledge base.

## OUTPUT FORMAT
For ingestion:
DOCUMENT: [name]
TYPE: [pdf|docx|txt|md]
CONTENT SUMMARY: [2-3 sentence summary of what was ingested]
FOLDER: brain/masterbrain/[folder]/ [if applicable]
STATUS: Queued for indexing | Indexed successfully | Failed - [reason]

For retrieval:
QUERY: [restated]
DOCUMENTS FOUND: [list with relevance indication]
RELEVANT EXTRACT: [most relevant chunk]

## RESTRICTIONS
Only ingest documents the authenticated user is authorised to upload.
Never ingest documents containing other tenants' data.
```

---

**`coaching-brain.md`**
```markdown
# BRAIN: Coaching on Demand Brain
## BRAIN KEY
coaching

## ACTIVATION PHRASES
- "switch to coaching brain"
- "I need coaching"
- "I'm stuck"
- "motivate me"
- "I'm having a bad day"
- "help me think through this"

## SYSTEM MODIFIER
You are a direct, empathetic business and personal coach. You do not give vague encouragement. You ask one sharp question to understand the root problem, then give one specific reframe and one concrete action. You treat the user as capable of more than they think. You do not dwell; you redirect toward action.

## OUTPUT FORMAT
I HEAR: [one sentence reflecting what the user actually said]
ROOT QUESTION: [the real question underneath what they asked]
REFRAME: [a different way to see the situation; specific, not generic]
ONE ACTION: [the single most useful thing to do in the next 2 hours]

## RESTRICTIONS
Do not provide mental health diagnosis or crisis intervention.
If user expresses severe distress, respond with care and recommend they speak to
a qualified professional or call a relevant support line.
Do not give more than one action; too many choices is the problem, not the solution.
```

---

**`web-search-brain.md`**
```markdown
# BRAIN: Web Search Brain
## BRAIN KEY
websearch

## ACTIVATION PHRASES
- "switch to web search brain"
- "research this"
- "find me data on"
- "what does the market say"
- "look this up"

## SYSTEM MODIFIER
You are the research intelligence layer. You use Tavily via WebSearchService to find
current, specific data. You always cite your sources. You never present search results
as your own knowledge. When GDPR restrictions block a result, you immediately provide
the alternative method; you never return empty-handed.

## OUTPUT FORMAT
QUERY: [restated search query]
SOURCES: [list with URLs]
FINDINGS: [synthesised answer from sources; paraphrased, not copied]
GDPR NOTE (if triggered): [specific alternative method with steps]
CONFIDENCE: HIGH / MEDIUM / LOW - [reason]

## RESTRICTIONS
Always attribute findings to their source.
Never present web search results as Carina's own knowledge or training data.
Respect knowledge/18-carina-tavily-web-search.md integration spec exactly.
```

---

## SECTION 25 - CarinaAccessGate CLASS (FULL SPECIFICATION)

**File:** `app/Services/Carina/CarinaAccessGate.php`

```php
<?php

namespace App\Services\Carina;

use App\Models\User;

class CarinaAccessGate
{
    // Roles that can see financial internals:
    // cap rate, cash flow, IRR, NOI, equity positions, loan details
    public function canAccessFinancialData(User $user): bool
    {
        return in_array($user->role, ['admin', 'property_manager', 'investor']);
    }

    // Roles that can see tenant PII:
    // names, addresses, phone numbers, email addresses of tenants/leads
    public function canAccessTenantPII(User $user): bool
    {
        return in_array($user->role, ['admin', 'property_manager']);
    }

    // Roles that can access system configuration:
    // Carina settings, system prompts, BYOK config, rate limit config
    public function canModifySystemConfig(User $user): bool
    {
        return $user->role === 'admin';
    }

    // Roles that can write to masterbrain:
    // learning data, RAG ingestion, preference updates
    // Staff and viewer are blocked; they can use Carina but cannot train it
    public function canWriteToMasterbrain(User $user): bool
    {
        return in_array($user->role, ['admin', 'property_manager', 'investor', 'agent']);
    }

    // Roles that can view cross-tenant analytics (anonymised only):
    // platform-level benchmarks, aggregate market data
    public function canAccessCrossTenantAnalytics(User $user): bool
    {
        return $user->role === 'admin';
    }

    // Roles that can upload documents to RAG pipeline
    public function canUploadDocuments(User $user): bool
    {
        return in_array($user->role, ['admin', 'property_manager', 'investor']);
    }

    // Roles that can delete conversations (own only; admin can delete any)
    public function canDeleteConversation(User $user, int $conversationOwnerId): bool
    {
        return $user->role === 'admin' || $user->id === $conversationOwnerId;
    }

    // Roles that can access deal financial analysis
    public function canAccessDealAnalysis(User $user): bool
    {
        return in_array($user->role, ['admin', 'property_manager', 'investor']);
    }

    // Roles that can access lead and CRM data
    public function canAccessLeadData(User $user): bool
    {
        return in_array($user->role, ['admin', 'property_manager', 'agent']);
    }

    // Roles that can switch Carina brains
    // Viewer is read-only; cannot switch to brains that produce write actions
    public function canSwitchBrain(User $user, string $brainKey): bool
    {
        $adminOnlyBrains = ['accountant', 'docstore'];
        if (in_array($brainKey, $adminOnlyBrains)) {
            return in_array($user->role, ['admin', 'property_manager']);
        }
        return $user->role !== 'viewer';
    }

    // Centralised role check; throws AuthorizationException if denied
    // Use this in service methods to enforce access in one line
    public function authorize(User $user, string $permission, mixed ...$args): void
    {
        $method = 'can' . ucfirst($permission);
        if (!method_exists($this, $method)) {
            throw new \InvalidArgumentException("Unknown permission: {$permission}");
        }
        if (!$this->$method($user, ...$args)) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                "Role '{$user->role}' does not have permission: {$permission}"
            );
        }
    }
}
```

### Usage in Service Layer

```php
// In CarinaService::chat() or any service method:
$this->accessGate->authorize($user, 'accessFinancialData');

// In RagIngestionService::ingestDocument():
$this->accessGate->authorize($user, 'uploadDocuments');

// For brain switching in CarinaService:
$this->accessGate->authorize($user, 'switchBrain', $brainKey);
```

### Register as Singleton

```php
// In AppServiceProvider::register():
$this->app->singleton(CarinaAccessGate::class);
```

---

## SECTION 26 - RATE LIMIT DEFAULTS (SEEDER)

**File:** `database/seeders/CarinaRateLimitSeeder.php`

Add to Step 12 of the implementation sequence (after seeding default system prompt).

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CarinaRateLimitSeeder extends Seeder
{
    /**
     * Default platform-level rate limits.
     * These are applied to the platform default tenant.
     * Individual tenants can have overrides stored in carina_rate_limits.
     *
     * Adjust via: php artisan tinker → CarinaRateLimit::updateOrCreate([...])
     */
    public function run(): void
    {
        $platformTenantId = 1; // Platform default tenant; adjust if your ID differs

        $defaults = [
            // Tenant-level limits (all users combined)
            ['scope' => 'tenant', 'period' => 'hourly',  'limit' => 5000],
            ['scope' => 'tenant', 'period' => 'daily',   'limit' => 50000],
            ['scope' => 'tenant', 'period' => 'monthly', 'limit' => 500000],

            // User-level limits (per individual user)
            ['scope' => 'user',   'period' => 'hourly',  'limit' => 500],
            ['scope' => 'user',   'period' => 'daily',   'limit' => 5000],
            ['scope' => 'user',   'period' => 'monthly', 'limit' => 50000],
        ];

        foreach ($defaults as $default) {
            DB::table('carina_rate_limits')->updateOrInsert(
                [
                    'tenant_id' => $platformTenantId,
                    'user_id'   => null,
                    'period'    => $default['period'],
                ],
                [
                    'limit'         => $default['limit'],
                    'current_usage' => 0,
                    'expires_at'    => now()->endOf($default['period'] === 'hourly' ? 'hour' : ($default['period'] === 'daily' ? 'day' : 'month')),
                ]
            );
        }

        $this->command->info('Carina rate limit defaults seeded.');
    }
}
```

### Redis Rate Limit Key Convention

```php
// Keys used by RateLimitService; document here for consistency:

// Tenant-level:  "carina:rate:tenant:{tenant_id}:{period}"
// User-level:    "carina:rate:user:{tenant_id}:{user_id}:{period}"
// Example:       "carina:rate:tenant:42:hourly"
// Example:       "carina:rate:user:42:17:daily"

// TTL values:
// hourly  → 3600 seconds
// daily   → 86400 seconds
// monthly → seconds until end of calendar month
```

---

## SECTION 27 - FILAMENT 3 ADMIN RESOURCES

**Reference:** `knowledge/15-platform-admin.md`, `knowledge/24-admin-nav-ux-audit.md`

Create the following Filament 3 resources. All resources are admin-only (protected by `canAccess()` returning `auth()->user()->role === 'admin'`). All resources are tenant-scoped in their queries.

---

### CarinaConversationResource
**File:** `app/Filament/Resources/CarinaConversationResource.php`

```
Table columns:
- id (hidden, sortable)
- user.name (label: "User")
- tenant.name (label: "Workspace")
- title (label: "Title", default "Untitled")
- message_count (label: "Messages", computed from relationship count)
- created_at (label: "Started", sortable)
- updated_at (label: "Last Activity", sortable)

Filters:
- By tenant (SelectFilter from tenants table)
- By date range (DateRangeFilter on created_at)

Actions:
- View (opens conversation with all messages in a modal; read only)
- Delete (with confirmation modal)

No create action; conversations are created via API only.

Searchable by: user name, conversation title.
Default sort: updated_at DESC.
```

---

### CarinaSystemPromptResource
**File:** `app/Filament/Resources/CarinaSystemPromptResource.php`

```
Table columns:
- name (label: "Prompt Name")
- tenant.name (label: "Workspace")
- is_default (label: "Default", badge: Yes/No)
- content preview (first 100 chars, label: "Preview")
- created_at (sortable)

Filters:
- By tenant (SelectFilter)
- Is default (ToggleFilter)

Form fields (create / edit):
- tenant_id (Select, required; list all tenants)
- name (TextInput, required, max 100)
- content (Textarea, required, max 8000, monospace font)
- is_default (Toggle; note: enabling will unset current default for that tenant)

Actions:
- Create
- Edit
- Delete (with confirmation; cannot delete if is_default = true and no other prompt exists)
- Set as Default (custom action; calls CarinaSystemPromptController@setDefault)

Searchable by: name, content.
```

---

### RagDocumentResource
**File:** `app/Filament/Resources/RagDocumentResource.php`

```
Table columns:
- name (label: "Document Name")
- type (label: "Type", badge: pdf/docx/txt/md)
- tenant.name (label: "Workspace")
- chunk_count (label: "Chunks", computed)
- is_indexed (label: "Indexed", badge: Yes/No; based on indexed_at)
- indexed_at (label: "Indexed At", sortable)
- created_at (label: "Uploaded", sortable)

Filters:
- By tenant (SelectFilter)
- By type (SelectFilter: pdf/docx/txt/md)
- Indexed status (ToggleFilter)

Actions:
- View (opens document metadata in modal)
- Reindex (custom action; calls RagDocumentController@reindex, shows toast)
- Delete (with confirmation; warns that all chunks will be deleted)

No create action from admin panel; documents uploaded via API/tenant UI.

Searchable by: name.
Default sort: created_at DESC.
```

---

### CarinaSettings (Filament Page)
**File:** `app/Filament/Pages/CarinaSettings.php`

```
Page title: "Carina Settings"
Navigation: Settings → Carina

Form sections:

Section 1 - AI Provider (per platform default)
- Default provider (Select: openai / anthropic / deepseek / custom)
- Default chat model (TextInput)
- Default embedding model (TextInput)
- Prompt caching enabled (Toggle - DeepSeek V4 caching)

Section 2 - Rate Limits (platform defaults)
- Tenant hourly limit (TextInput, numeric)
- Tenant daily limit (TextInput, numeric)
- User hourly limit (TextInput, numeric)
- User daily limit (TextInput, numeric)
- Note: "Individual tenant overrides stored in carina_rate_limits table"

Section 3 - RAG Pipeline
- Default chunk size (TextInput, numeric, default 1000)
- Default chunk overlap (TextInput, numeric, default 200)
- Max documents per tenant (TextInput, numeric)
- Supported file types (CheckboxList: pdf, docx, txt, md)

Section 4 - Incognito Mode
- Auto-delete incognito sessions after (Select: 1 hour / 6 hours / 24 hours)
- Allow incognito mode (Toggle; platform-level on/off)

Save action: updates system_settings table, clears Redis cache tagged 'carina-settings'
```

---

### CarinaUsageDashboard (Filament Page)
**File:** `app/Filament/Pages/CarinaUsageDashboard.php`

```
Page title: "Carina Usage"
Navigation: Analytics → Carina Usage

Widgets:

1. TotalTokensWidget (StatsOverview)
   - Total tokens this month (platform-wide)
   - Total tokens today
   - Estimated cost this month (using provider pricing)
   - Active conversations (last 24 hours)

2. TokensByTenantTable
   - Tenant name | Tokens this month | Conversations | Avg tokens/conversation
   - Sortable by tokens DESC
   - Filterable by date range

3. ConversationVolumeChart (LineChart)
   - X: last 30 days
   - Y: conversation count per day
   - Grouped by: all tenants combined (admin view)

4. TopActiveUsersTable
   - User name | Tenant | Conversations | Tokens used | Last active
   - Limited to top 20
   - Filterable by tenant

5. RagDocumentStats (StatsOverview)
   - Total documents indexed (platform-wide)
   - Total chunks stored
   - Average chunks per document
   - Last indexing run

All data fetched via TokenTrackingService and direct queries.
All queries scoped appropriately; no cross-tenant PII exposed.
Admin only; canAccess() returns auth()->user()->role === 'admin'.
```

---

## SECTION 28 - CORRECTIONS TO MAIN PROMPT

Apply these corrections to `carina-2-0-build-prompt-final.md`:

### Correction 1 - Section 4.6 rag_chunks embedding dimension note
Add this comment directly below the `ALTER TABLE` statement:
```sql
-- Dimension 1536 = OpenAI text-embedding-3-small
-- If switching to Cohere: 1024 dimensions; update this migration and re-run carina:verify
-- If switching to a custom model: update dimension to match model output size
-- WARNING: changing dimensions after data is indexed requires dropping and re-creating
--          all rag_chunks and re-running: php artisan rag:index-pending
```

### Correction 2 - Section 6.2 AiRouterService selectProvider() return type
Change return type from `string` to `array`:
```php
// CORRECTED return type:
public function selectProvider(int $tenantId): array
// Returns:
[
    'provider' => 'openai',                           // provider key
    'api_key'  => 'sk-...',                           // resolved API key
    'endpoint' => 'https://api.openai.com/v1/chat/completions',  // base endpoint
    'model'    => 'gpt-4o',                           // resolved model for use case
]
```
Update `routeRequest()` to consume this array directly rather than calling `selectProvider()` and `getModel()` separately.

### Correction 3 - Section 6.12 ImageGenerationService DALL-E 3 variations
Replace the `n: $variations` note with:
```php
// DALL-E 3 IMPORTANT: 'n' parameter is fixed at 1; only 1 image per API call.
// To produce 4 variations, ImageGenerationService makes 4 sequential API calls
// with slight prompt variations (add: "variation 1 of 4", etc.)
// DALL-E 2 supports n=4 in one call; use as fallback if sequential calls are too slow.
// Return all 4 URLs in image_urls[] regardless of how they were obtained.
```

### Correction 4 - Section 13 test syntax note
Add this comment block at the top of the Tests section:
```php
// TEST SYNTAX NOTE:
// These tests are written for Pest PHP (the default in modern Laravel projects).
// Pest syntax uses it() or test() functions, NOT class-based TestCase methods.
//
// Example conversion:
// Class-style:  public function test_chat_returns_response_for_valid_tenant() { ... }
// Pest-style:   it('returns response for valid tenant', function () { ... });
//               test('chat returns response for valid tenant', function () { ... });
//
// All test names in Section 13 should be converted to Pest syntax.
// Group related tests with describe():
//   describe('CarinaService', function () {
//     it('returns response for valid tenant', function () { ... });
//     it('enforces tenant isolation', function () { ... });
//   });
```

### Correction 5 - Section 17 CAP-06 IRR implementation note
Add this note directly after the IRR formula row in the calculations table:
```
IRR IMPLEMENTATION NOTE:
Use iterative bisection method; more reliable than Newton-Raphson for property cash flows.
  - Maximum 20 iterations
  - Tolerance: 0.0001 (0.01%)
  - Search range: -99% to +1000%
  - If convergence fails after 20 iterations: return null and flag to user:
    "IRR could not be calculated; check that cash flows include at least one
     positive value and one negative value."
  - Test case: investment of -100,000 returning 10,000/year for 15 years
    should produce IRR ≈ 9.43%
```

---

*End of Carina 2.0 Build Prompt Addendum.*
*Append this file to carina-2-0-build-prompt-final.md.*
*Together they form the complete, corrected, production-ready build specification.*
