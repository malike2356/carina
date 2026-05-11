<?php

return [

    /*
     * Default provider used by CarinaService when no tenant preference is set.
     * Tenant can configure their own via BYOK settings.
     */
    'default_provider' => env('AI_DEFAULT_PROVIDER', 'anthropic'),

    /*
     * Embedding model for RAG (OpenAI-compatible /embeddings only — skips Anthropic in router).
     */
    'embedding_model' => env('AI_EMBEDDING_MODEL', 'text-embedding-3-small'),

    /*
     * Rough USD cost estimates per 1M tokens (used for usage dashboards only).
     */
    'pricing_usd_per_million' => [
        '_default' => ['input' => 1.0, 'output' => 1.0],
        'anthropic' => ['input' => 3.0, 'output' => 15.0],
        'openai' => ['input' => 0.15, 'output' => 0.6],
        'groq' => ['input' => 0.05, 'output' => 0.08],
        'deepseek' => ['input' => 0.14, 'output' => 0.28],
        'openrouter' => ['input' => 1.0, 'output' => 1.0],
        'google' => ['input' => 0.1, 'output' => 0.4],
    ],

    'providers' => [
        'anthropic' => [
            'api_key' => env('ANTHROPIC_API_KEY'),
            'base_url' => env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com/v1'),
            'model' => env('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
            'max_tokens' => 4096,
        ],
        'openai' => [
            'api_key' => env('OPENAI_API_KEY'),
            'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
            'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
            'max_tokens' => 4096,
        ],
        'groq' => [
            'api_key' => env('GROQ_API_KEY'),
            'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
            'model' => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
            'max_tokens' => 4096,
        ],
        'deepseek' => [
            'api_key' => env('DEEPSEEK_API_KEY'),
            'base_url' => env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
            'model' => env('DEEPSEEK_MODEL', 'deepseek-v4-flash'),
            'pro_model' => env('DEEPSEEK_PRO_MODEL', 'deepseek-v4-pro'),
            'reasoner_model' => env('DEEPSEEK_REASONER_MODEL', 'deepseek-reasoner'),
            'max_tokens' => 8192,  // R1 needs more room for reasoning tokens
        ],
        'openrouter' => [
            'api_key' => env('OPENROUTER_API_KEY'),
            'base_url' => env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
            'model' => env('OPENROUTER_MODEL', 'anthropic/claude-3.5-haiku'),
            'max_tokens' => 4096,
        ],
        'google' => [
            'api_key' => env('GOOGLE_AI_API_KEY'),
            'base_url' => env('GOOGLE_AI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
            'model' => env('GOOGLE_AI_MODEL', 'gemini-2.0-flash'),
            'max_tokens' => 4096,
        ],
    ],

    /*
     * Priority order for chat — first provider with a valid key wins.
     * Override per-tenant via BYOK settings.
     */
    'priority' => explode(',', env('AI_PRIORITY', 'anthropic,groq,deepseek,openrouter,openai,google')),

    /*
     * RAG embeddings use POST {base_url}/embeddings (OpenAI-compatible). Chat-first APIs (DeepSeek, Anthropic) are excluded.
     * First slug below that has a non-empty api_key in the merged runtime map wins. Override with AI_EMBEDDING_PROVIDER_PRIORITY.
     *
     * @var list<string>
     */
    'embedding_provider_priority' => array_values(array_filter(array_map(
        static fn (string $s): string => trim($s),
        explode(',', (string) env('AI_EMBEDDING_PROVIDER_PRIORITY', 'openai,openrouter,groq,google'))
    ))),

    /*
     * Tavily web search — optional live context for Carina (tenant chat, platform chat, deal narrative).
     * Prefer storing the key and toggles under Admin → Platform keys → AI and Carina → Tavily (central DB).
     * Environment variables below are fallbacks when no database value is set.
     */
    'tavily' => [
        'enabled' => (bool) env('CARINA_TAVILY_ENABLED', false),
        'api_key' => env('TAVILY_API_KEY'),
        'base_url' => rtrim((string) env('TAVILY_BASE_URL', 'https://api.tavily.com'), '/'),
        'search_depth' => env('TAVILY_SEARCH_DEPTH', 'basic'),
        'max_results' => (int) env('TAVILY_MAX_RESULTS', 5),
        'include_answer' => filter_var(env('TAVILY_INCLUDE_ANSWER', 'true'), FILTER_VALIDATE_BOOL),
        'timeout' => (int) env('TAVILY_TIMEOUT', 30),
        'max_query_length' => (int) env('TAVILY_MAX_QUERY_LENGTH', 400),
        'max_context_chars' => (int) env('TAVILY_MAX_CONTEXT_CHARS', 12000),
        'max_snippet_chars' => (int) env('TAVILY_MAX_SNIPPET_CHARS', 600),
        'trigger' => env('CARINA_TAVILY_TRIGGER', 'keywords'),
        'keyword_triggers' => array_values(array_filter(array_map('trim', explode(',', (string) env(
            'CARINA_TAVILY_KEYWORDS',
            'latest,news,current,today,recent,search,internet,web,look up,find out,regulation,legislation,hmrc,gov.uk,interest rate,bank of england,stamp duty,section 24,mees,epc,hmo licence'
        ))))),
    ],

    /*
     * Carina system persona — appended to every tenant context.
     */
    'carina_persona' => 'You are Carina, the AI assistant built into Propreneur, a property investment management platform for UK landlords and investors, developed by VERLOX Ltd alongside the product. You understand UK property law, lettings regulations, HMO licensing, BTL/BRR/R2R/SA strategies, yield calculations, and HMRC landlord rules. Unless the user clearly asks for engineering, API, SQL, or integration minutiae, lead with a conversational explanation they can use without wading through internal jargon. Do not open with or fill the reply with API lists, SQL, JSON dumps, Laravel route names, file paths, or long tables copied from internal documentation unless they asked for that level of detail. When the context includes technical material, translate what matters into plain English first; add a short optional "Technical detail" subsection only when it genuinely helps or they requested it. Be concise, precise, and proactive. Always use £ and UK-specific context. Never invent or embellish: only state facts supported by workspace context, cited web excerpts, knowledge-base context, or the user messages in this thread; if you lack support, omit the detail or say clearly that you do not know. When asked who built Propreneur or Carina, say VERLOX Ltd (UK). Do not use emojis, emoticons, or decorative unicode symbols in replies. Use plain hyphens instead of unicode em dashes in your answers.',

    /*
     * Authoritative module map for "what does Propreneur include?" questions.
     * Keep in sync with CLAUDE.md (The 13 Modules) and memory.md (Product module matrix).
     */
    'carina_product_inventory' => <<<'TXT'
Propreneur v2 is organised as thirteen numbered product modules plus add-on surfaces, plus central platform services. If the user asks for a full feature list, product map, or "what Propreneur does", answer from this inventory only. Do not substitute a generic landlord-SaaS or competitor-style catalogue.

Modules (status reflects the current v2 codebase direction; say "check the latest release notes" if they need legal guarantees):
1. Deal Engine — underwriting, deal analyses, calculators, sourcing workspace (partial; active build).
2. CRM — contacts, interactions, import/export, investor scores (shipped core).
3. Pipeline (Kanban) — deal stages and cards (shipped).
4. Communications Hub — sequences, enrollments, automation hooks (partial).
5. Accounting — double-entry journals, chart of accounts, ledgers, exports (shipped).
6. Compliance — obligations tracking and property document bridge (partial).
7. Document Vault — structured doc storage (not started as standalone module).
8. Project Management — not started.
9. HR and Payroll — not started.
10. Booking (viCal) — scheduling and public booking (partial; phase 1 shipped).
11. Mentoring OS — tenant mentoring hub, programmes, cohorts, mentorship threads linked to CRM and pipeline (partial); community API also exposes mentorship messages.
12. Reporting and Intelligence — dashboards, definitions, exports, analytics (shipped).
13. Carina AI — this assistant, tenant and platform UIs, RAG, Tavily option, usage limits (shipped).

Add-on billing-gated surfaces (not always one of the thirteen): Community and learning — posts, groups, courses, quizzes, learning paths, badges (tenant API and hub shipped in part under subscription module community_learning). Investors hub — workspace Blade surfaces under /investors for funnel, pipeline, KYC helpers (CRM-gated). Investor portal — separate Sanctum JSON auth under /api/investor-portal for investor_portal_users. Workspace automation — rules and runs under /settings/automation. Integrations, Stripe billing API, platform backups and DR, SCOUT security console, v1 migration tools are central or cross-cutting; see brain/knowledge/59 through 63 for mechanical indexes.

Central platform (non-tenant): tenant and domain lifecycle, subscriptions, platform admin users, feature flags, AI provider catalogue, SCOUT security posture views. Tenant workspaces are isolated PostgreSQL databases behind subdomain routing.

Canonical prose for engineers lives under brain/knowledge/ (start at 00-README.md and 59-carina-propreneur-full-codex.md). Workspace RAG vectors come from uploaded or ingested documents, not from reading the git tree at runtime unless operators run rag:ingest-brain-knowledge.
TXT,

    /*
     * Carina web UI voice input: browser records audio (MediaRecorder), server calls Whisper-compatible API.
     * Uses merged runtime keys (tenant BYOK when $centralTenantId is set). Only openai and groq slugs here.
     *
     * @var list<string>
     */
    'speech_transcription' => [
        'provider_priority' => array_values(array_filter(array_map(
            static fn (string $s): string => trim($s),
            explode(',', (string) env('AI_SPEECH_TRANSCRIPTION_PRIORITY', 'openai,groq'))
        ))),
        'models' => [
            'openai' => env('AI_SPEECH_OPENAI_MODEL', 'whisper-1'),
            'groq' => env('AI_SPEECH_GROQ_MODEL', 'whisper-large-v3-turbo'),
        ],
        'timeout_seconds' => (int) env('AI_SPEECH_TRANSCRIPTION_TIMEOUT', 120),
    ],

];
