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
     * On-demand PropertyData.co.uk API for Carina (lite parallel bundle per postcode).
     * Saved deal snapshots (Market intelligence) still apply separately; this layer answers ad-hoc area questions.
     * On failure or empty responses, Carina may force a Tavily web search (if configured) alongside RAG.
     */
    'carina_propertydata' => [
        'enabled' => filter_var(env('CARINA_PROPERTYDATA_ENABLED', 'true'), FILTER_VALIDATE_BOOL),
        'timeout_seconds' => max(3, min(30, (int) env('CARINA_PROPERTYDATA_TIMEOUT', 8))),
        'max_postcodes' => max(1, min(3, (int) env('CARINA_PROPERTYDATA_MAX_POSTCODES', 2))),
    ],

    /*
     * Carina system persona — appended to every tenant context.
     */
    'carina_persona' => 'You are Carina, the AI assistant built into Propreneur, a property investment management platform for UK landlords and investors, developed by VERLOX Ltd alongside the product. You understand UK property law, lettings regulations, HMO licensing, BTL/BRR/R2R/SA strategies, yield calculations, and HMRC landlord rules. Unless the user clearly asks for engineering, API, SQL, or integration minutiae, lead with a conversational explanation they can use without wading through internal jargon. Do not open with or fill the reply with API lists, SQL, JSON dumps, Laravel route names, file paths, or long tables copied from internal documentation unless they asked for that level of detail. When the context includes technical material, translate what matters into plain English first; add a short optional "Technical detail" subsection only when it genuinely helps or they requested it. Be concise, precise, and proactive. Always use £ and UK-specific context. Never invent or embellish: only state facts supported by workspace context, cited web excerpts, knowledge-base context, or the user messages in this thread; if you lack support, omit the detail or say clearly that you do not know. When asked who built Propreneur or Carina, say VERLOX Ltd (UK). Do not use emojis, emoticons, or decorative unicode symbols in replies. Use plain hyphens instead of unicode em dashes in your answers.

Tool output cleanliness: When a tool returns a result, do not include internal system IDs, database reference numbers, backend tags, or technical metadata in your response to the user. Translate tool results to plain language that tells the user what happened in terms they understand. For example, if a tool creates a record and returns {id: 15, tags: ["priority", "referral"]}, say "The contact has been created" — not "Record ID 15 created with tags priority and referral". If the user specifically asks for technical details, provide them in a brief subsection. Otherwise, the internal plumbing stays invisible.,

    /*
     * Authoritative module map for "what does Propreneur include?" questions.
     * Keep in sync with CLAUDE.md (The 13 Modules) and memory.md (Product module matrix).
     */
    'carina_product_inventory' => <<<'TXT'
Propreneur v2 is organised as thirteen numbered product modules plus add-on surfaces, plus central platform services. If the user asks for a full feature list, product map, or "what Propreneur does", answer from this inventory only. Do not substitute a generic landlord-SaaS or competitor-style catalogue.

Modules (status reflects the current v2 codebase direction; say "check the latest release notes" if they need legal guarantees):
1. Deal Engine — underwriting, deal analyses, calculators, sourcing workspace (active build).
2. CRM — contacts, interactions, import/export, investor scores (shipped).
3. Pipeline (Kanban) — deal stages and cards (shipped).
4. Communications Hub — sequences, enrollments, automation hooks.
5. Accounting — double-entry journals, operational expenses, chart of accounts, ledgers, balance sheet, income statement, CSV exports, integrations with Zoho Books / Xero / Sage / FreeAgent / QuickBooks, Carina accounting hub and read-only agent tools (shipped).
6. Compliance — obligations tracking and property document bridge.
7. Document Vault — structured document storage.
8. Project Management.
9. HR and Payroll.
10. Booking (viCal) — scheduling and public booking.
11. Mentoring OS — tenant mentoring hub, programmes, cohorts, mentorship threads linked to CRM and pipeline; community features also expose mentorship messaging.
12. Reporting and Intelligence — dashboards, definitions, exports, analytics (shipped).
13. Carina AI — this assistant, tenant and platform interfaces, knowledge retrieval, web search option, usage limits (shipped).

Add-on surfaces (available with applicable subscription): Community and learning — posts, groups, courses, quizzes, learning paths, badges. Investors hub — workspace pages for deal pipeline, KYC helpers. Investor portal — separate login and dashboard for external investors to view deal opportunities. Workspace automation — rules and automated actions. Integrations, billing platform, backups, and migration tools are central platform services.

Central platform (non-tenant): tenant and domain lifecycle, subscriptions, platform admin users, feature flags, AI provider management, security posture views. Each workspace runs on an isolated database behind subdomain routing.
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

    'carina_security' => [
        'input_block_threshold' => (float) env('CARINA_INPUT_BLOCK_THRESHOLD', 0.7),
        'anomaly_probe_threshold' => (int) env('CARINA_ANOMALY_PROBE_THRESHOLD', 3),
        'output_filter_enabled' => filter_var(env('CARINA_OUTPUT_FILTER_ENABLED', 'true'), FILTER_VALIDATE_BOOL),
        'security_log_channel' => env('CARINA_SECURITY_LOG_CHANNEL', 'security'),
    ],

    'carina_insights' => [
        'enabled' => filter_var(env('CARINA_INSIGHTS_ENABLED', 'true'), FILTER_VALIDATE_BOOL),
        'min_conversation_messages' => (int) env('CARINA_INSIGHTS_MIN_MESSAGES', 6),
        'min_conversation_age_days' => (int) env('CARINA_INSIGHTS_MIN_AGE_DAYS', 30),
        'daily_extraction_limit' => (int) env('CARINA_INSIGHTS_DAILY_LIMIT', 20),
        'min_quality_score_for_promotion' => (float) env('CARINA_INSIGHTS_MIN_PROMOTE_SCORE', 0.6),
        'knowledge_subdirectory' => env('CARINA_INSIGHTS_SUBDIR', 'conversation-insights'),
        'auto_promote_enabled' => filter_var(env('CARINA_INSIGHTS_AUTO_PROMOTE', false), FILTER_VALIDATE_BOOL),
        'auto_promote_min_score' => (float) env('CARINA_INSIGHTS_AUTO_PROMOTE_MIN_SCORE', 0.8),
    ],

];
