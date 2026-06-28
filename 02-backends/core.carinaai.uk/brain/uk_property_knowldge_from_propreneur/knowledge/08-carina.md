# Carina AI Assistant

**Last updated:** 2026-06-24

## Overview
Carina is the embedded AI assistant inside Propreneur - chat interface providing investment analysis, property insights, deal evaluation, and UK property knowledge. Multi-provider architecture with priority-based fallback chain.

**Feature flags:** `carina_ai` (standard chat + RAG), `carina_agent` (tool-calling multi-step mode, Professional+)  
**Service:** `App\Services\Carina\CarinaService`  
**Agent service:** `App\Services\Carina\CarinaAgentService`  
**Config:** `config/ai.php` (persona, providers, Tavily), `config/carina.php` (rate limits, RAG, retention, training)

## Output Cleanliness Policy

Carina must never expose internal system identifiers, database IDs, backend tags, or technical metadata in user-facing responses. When a tool returns raw data (contact IDs, system tags, status codes, reference numbers), Carina translates the result into plain language the user can use. Internal plumbing stays invisible unless the user explicitly asks for technical details.

This rule is enforced in two places:
- `config/ai.php` under `carina_persona` - general output cleanliness instruction
- `CarinaAgentService::TOOL_INSTRUCTION` - specific rule for tool result responses

## Architecture

### Provider Chain
Providers tried in priority order: Anthropic (Claude), Groq (Llama), DeepSeek, OpenRouter, OpenAI (GPT), Google (Gemini). Order from `config('ai.priority')`, mergeable with central `ai_providers` DB and tenant BYOK keys.

### Carina Mode Split
- **Carina AI** - standard chat + RAG context (all plans)
- **Carina Agent** - tool-calling multi-step mode (Professional+). 19 live tenant tools including: search/create/update/delete contacts, run calculator, **run development calculator**, **run strategy finder**, get deal analysis, get/list properties, pipeline add/close, compliance, schedule session, accounting read (journals, integrations catalog), **generate deal pack** (confirmation), **send communication sequence** (confirmation). Spec: `brain/prompts/104-carina-agent-new-tools.md`.

### Tavily Web Search
Optional live web snippets appended to system prompt when configured. Keyword-gated search or `every_message` mode. Cited source excerpts.

### RAG (Per-Tenant Vector)
- `rag_documents` + `rag_chunks` (pgvector, 1536-d embeddings)
- Documents uploaded via Filament RAG UI or `POST /api/rag/documents`
- `ProcessDocumentJob` / `BatchEmbeddingJob` for ingestion
- `RAGService::retrieveContext` - hybrid search, 5 chunks per turn default
- `brain/knowledge/*.md` ingested via `rag:ingest-brain-knowledge` command
- **GDPR (tenant data subjects):** product behaviour and routes are documented in `brain/knowledge/72-gdpr-data-subject-rights.md` - use it when answering rights-to-access, erasure, consent, or retention questions for workspace users.
- **Promo vs referral vs Stripe coupons:** `brain/knowledge/152-promo-codes-vs-referral-codes.md` - use when users ask which code type to use, why a referral did not discount a signup, or how Stripe Dashboard coupons relate to `/admin/promo-codes`.

### Masterbrain
`brain/masterbrain/` directory contains persona definitions (accountant, coach, COO, investor, etc.) referenced by `config/carina.php` key `masterbrain_path`.

### Platform Carina Knowledge Training
Admin UI at `/admin/carina/knowledge-training` - upload documents (PDF, images, ZIP) with OCR, PDF extraction, ClamAV scan, and RAG queue.

### Platform admin agentic and security (prompts 53-55)
- **53 - Agentic platform Carina:** `PlatformCarinaAgentService` (tool loop), `PlatformCarinaToolRegistry`, `App\Services\Carina\PlatformTools\*` (10 tools), `PlatformCarinaController` uses the agent for messages + confirm; Feature tests under `tests/Feature/PlatformCarina/`. Spec: `brain/prompts/53-platform-carina-agentic.md`.
- **54 - Input/output hardening:** `CarinaInputSanitizer`, `CarinaOutputFilter`, `ConversationAnomalyDetector`, `CarinaSecurityAuditLogger`, tenant table `carina_security_events`; integrated in `CarinaService`. Spec: `brain/prompts/54-carina-security-input-output-hardening.md`.
- **55 - RAG, tool args, platform guardrails:** `RagDocumentSecurityScanner` on ingest, `CarinaToolArgumentValidator`, `PlatformCarinaGuardrail`. Spec: `brain/prompts/55-carina-security-rag-tool-platform-hardening.md`.
- **56 - Conversation insight extraction:** `InsightExtractionService`, `InsightPromotionService`, `ConversationPreRedactor`, Artisan `carina:extract-conversation-insights` and `carina:promote-insights`, central `carina_conversation_insights` / `carina_extraction_log`, platform admin review UI `CarinaInsightsController`. Spec: `brain/prompts/56-carina-conversation-insight-extraction.md`.

### System Prompts
- `config('ai.carina_persona')` - persona definition
- `config('ai.carina_product_inventory')` - module inventory
- `CarinaService::appendCarinaOutputStyleDirective()` - markdown, guardrails
- Tenant can override via `CarinaSystemPrompt` model (CRUD API)

## Chat Flow
```
User message → CarinaService::chat() →
  Rate limit check (Redis, config/carina.php) →
  Build history from DB →
  buildSystemPrompt (persona + product inventory + context + RAG) →
  Tavily web search (if enabled) →
  callWithFallback (multi-provider chain) →
  Persist messages →
  Return text
```

## Context-Aware Deep Links
Carina conversations can be started with context: property, deal, deal_calculator, contact, pipeline, pipeline_deal, compliance, report, course, community_post, mentorship, journal_entry, vcal_booking, accounting_hub. Each context type injects relevant data into the system prompt.

## Routes

**Tenant Blade:**
- `GET /carina/conversations` - list
- `GET /carina/conversations/{id}` - show thread
- `POST /carina/conversations` - start
- `POST /carina/conversations/{id}/messages` - send
- `GET /carina/conversations/{id}/transcript` - download (txt/md/json)
- `DELETE /carina/conversations/{id}` - delete
- `POST /carina/speech-transcribe` - voice input (MediaRecorder → Whisper)
- `GET /carina/widget/bootstrap` - floating panel in layout

**Tenant API:**
- `POST /api/carina/chat` - chat
- `POST /api/carina/chat/stream` - streaming chat
- `GET/POST/PUT/DELETE /api/carina/system-prompts` - CRUD system prompts

**Platform Admin:**
- `GET /admin/carina/conversations` - platform carina list
- `POST /admin/carina/knowledge-training/*` - training document management
- `POST /admin/carina/agent-tools/settings` - agent tool toggles

Deep links: `/carina/open-deal/{id}`, `/carina/open-property/{id}`, `/carina/open-contact/{id}`, `/carina/open-accounting/{surface}`, etc.

## Rate Limits (config/carina.php)
- Tenant hourly: 500 (default), daily: 5,000
- User hourly: 100, daily: 1,000

## Speech Transcription
Voice input via MediaRecorder → `CarinaSpeechTranscriptionService` → OpenAI/Groq Whisper. Live wavelength waveform canvas renders during recording (`resources/js/carina-voice.js`).

## Related
- `78-carina-agentic-architecture.md` - agent tool detail
- `59-carina-propreneur-full-codex.md` - system intelligence
- `config/ai.php` - provider and persona config
- `carina/01-devends/planning/operations/BRAIN_SYNC.md` - sync this knowledge tree to Carina standalone (property-uk pack)

## Carina in Propreneur vs Aiva workers (standalone)

Two products, one knowledge family. **Propreneur Carina** is the in-app agent with tenant tools and CRM writes. **Carina Aiva** is the fleet worker on Telegram/WhatsApp with optional read access to Propreneur via HTTP bridge.

| Capability | Propreneur `/carina` | Carina Aiva worker |
|------------|----------------------|-------------------|
| Runtime | `CarinaAgentService` (PHP) | Carina core (Node) |
| CRM / pipeline writes | Yes (confirmation gates) | Propose only; admin approves in review queue |
| Calculators, tenant tools | Yes | No |
| Telegram / WhatsApp delivery | Via Carina Remote (optional) | Native channel adapters |
| Daily portfolio brief | Propreneur scheduled digest (optional) | `AIVA_DAILY_SUMMARY_ENABLED` + bridge |
| Email ingestion owner | **Settings → Email ingestion** (IMAP) | Carina IMAP only if PP does not poll same mailbox |
| Property RAG | `rag:ingest-brain-knowledge` | property-uk pack (synced brain mirror) |
| Scout audit on tools | Platform + tenant security stack | Scout fleet (`LABYRINTH_ENABLED`) |

**Bridge (read-only, Phase 1):** When `aiva_external_bridge` is on for the tenant and the Aiva is bound (tenant slug + Carina Remote API key), Carina calls:

| Method | Path |
|--------|------|
| GET | `/api/aiva-bridge/portfolio` |
| GET | `/api/aiva-bridge/properties/{id}` |
| GET | `/api/aiva-bridge/properties/{id}/compliance` |
| GET | `/api/aiva-bridge/deals` |
| GET | `/api/aiva-bridge/email-activity?hours=24` |

**Operator guide:** `carina/01-devends/planning/operations/CARINA_PROPRENEUR_COMPLEMENT_GUIDE.md`  
**Pilot checklist:** `carina/01-devends/planning/operations/PILOT_AIVA_BRIDGE_ONBOARDING_CHECKLIST.md`  
**Bridge detail:** `brain/knowledge/132-aiva-propreneur-bridge-phase1.md`

Both surfaces share this `brain/knowledge/` corpus after sync; they do not share one agent engine. Do not deprecate in-app Carina in favour of Aiva.
